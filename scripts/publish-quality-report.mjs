import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const now = new Date().toISOString();
const endpoint = process.env.QUALITY_ISSUES_INGEST_URL;
const token = process.env.QUALITY_ISSUES_INGEST_TOKEN;

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readExitCode(path) {
  const value = readText(path).trim();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function issueId(parts) {
  return parts
    .filter(Boolean)
    .join(':')
    .toLowerCase()
    .replace(/[^a-z0-9:_./-]+/g, '-')
    .slice(0, 180);
}

function excerptLog(log) {
  const lines = log.split(/\r?\n/).filter(Boolean);
  const errorIndex = lines.findIndex((line) => /error|failed|✗/i.test(line));
  const start = errorIndex >= 0 ? Math.max(0, errorIndex - 2) : Math.max(0, lines.length - 8);
  return lines.slice(start, start + 10).join('\n').slice(0, 1600);
}

function createIssue(input) {
  return {
    status: 'open',
    firstSeenAt: now,
    lastSeenAt: now,
    occurrences: 1,
    runUrl: process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
      ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined,
    ...input,
  };
}

function collectBuildIssues() {
  const exitCode = readExitCode('quality-build.exit');
  if (exitCode === 0) return [];

  const log = readText('quality-build.log');
  return [
    createIssue({
      id: issueId(['build', 'npm-run-build']),
      source: 'build',
      severity: 'error',
      title: 'Production build failed',
      message: excerptLog(log) || 'npm run build exited with a non-zero status.',
      ruleId: 'npm run build',
    }),
  ];
}

function collectTestIssues() {
  const exitCode = readExitCode('quality-test.exit');
  if (exitCode === 0) return [];

  const report = readJson('quality-vitest-report.json');
  const issues = [];

  for (const testResult of report?.testResults || []) {
    for (const assertion of testResult.assertionResults || []) {
      if (assertion.status !== 'failed') continue;
      issues.push(createIssue({
        id: issueId(['test', testResult.name, assertion.fullName || assertion.title]),
        source: 'test',
        severity: 'error',
        title: assertion.fullName || assertion.title || 'Test failed',
        message: (assertion.failureMessages || []).join('\n').slice(0, 1600) || 'Vitest reported a failing assertion.',
        filePath: testResult.name,
        ruleId: 'vitest',
      }));
    }
  }

  if (issues.length > 0) return issues;

  return [
    createIssue({
      id: issueId(['test', 'vitest']),
      source: 'test',
      severity: 'error',
      title: 'Test run failed',
      message: excerptLog(readText('quality-test.log')) || 'npm test exited with a non-zero status.',
      ruleId: 'vitest',
    }),
  ];
}

function collectAuditIssues() {
  const report = readJson('quality-npm-audit-report.json');
  const vulnerabilities = report?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== 'object') return [];

  return Object.entries(vulnerabilities).map(([name, vulnerability]) => {
    const severity = ['critical', 'high'].includes(vulnerability.severity) ? 'error' : 'warning';
    const via = Array.isArray(vulnerability.via)
      ? vulnerability.via.map((entry) => typeof entry === 'string' ? entry : entry.title).filter(Boolean).join('; ')
      : '';

    return createIssue({
      id: issueId(['audit', name, vulnerability.severity]),
      source: 'audit',
      severity,
      title: `${name} has ${vulnerability.severity} vulnerability risk`,
      message: via || `npm audit reported ${vulnerability.severity} risk for ${name}.`,
      filePath: 'package-lock.json',
      ruleId: name,
    });
  });
}

const issues = [
  ...collectBuildIssues(),
  ...collectTestIssues(),
  ...collectAuditIssues(),
];

const payload = {
  generatedAt: now,
  runId: process.env.GITHUB_RUN_ID,
  runUrl: process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
    ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined,
  branch: process.env.GITHUB_REF_NAME,
  commitSha: process.env.GITHUB_SHA,
  issues,
};

writeFileSync('quality-issues-payload.json', JSON.stringify(payload, null, 2));

if (!endpoint || !token) {
  console.log('QUALITY_ISSUES_INGEST_URL or QUALITY_ISSUES_INGEST_TOKEN is not set; wrote quality-issues-payload.json only.');
  process.exit(0);
}

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`Failed to publish quality issues: ${response.status} ${response.statusText}\n${body}`);
}

console.log(`Published ${issues.length} quality issue(s).`);
