import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const now = new Date().toISOString();
const DEFAULT_INGEST_URL = 'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/quality-issues/ingest-ci-report';
const token = process.env.QUALITY_ISSUES_INGEST_TOKEN;
const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

function normalizeIngestUrl(value) {
  const rawValue = typeof value === 'string' ? value.trim() : '';
  if (!rawValue) return DEFAULT_INGEST_URL;

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error(
      `QUALITY_ISSUES_INGEST_URL is not a valid URL: ${rawValue}`,
    );
  }

  if (parsed.pathname.endsWith('/quality-issues')) {
    parsed.pathname = `${parsed.pathname}/ingest-ci-report`;
  } else if (parsed.pathname.endsWith('/quality-issues/')) {
    parsed.pathname = `${parsed.pathname}ingest-ci-report`;
  }

  return parsed.toString();
}

const endpoint = normalizeIngestUrl(process.env.QUALITY_ISSUES_INGEST_URL);

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

function normalizeKeyPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_./-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inferCategory(source, ruleId = '') {
  if (source === 'audit') return 'security';
  if (source === 'accessibility') return 'accessibility';
  if (source === 'runtime-client' || source === 'runtime-server') return 'runtime';
  if (source === 'test') return 'test';
  if (source === 'build') {
    const normalizedRule = normalizeKeyPart(ruleId);
    if (normalizedRule.includes('env') || normalizedRule.includes('config')) {
      return 'configuration';
    }
    return 'build';
  }

  return 'unknown';
}

function inferPriority({ source, severity, category, cvssScore }) {
  if (category === 'security' && typeof cvssScore === 'number') {
    if (cvssScore >= 9) return 'critical';
    if (cvssScore >= 7) return 'high';
    if (cvssScore >= 4) return 'medium';
    return 'low';
  }
  if (severity === 'info') return 'low';
  if (category === 'security' && severity === 'error') return 'critical';
  if (severity === 'error') return 'high';
  if (category === 'security' || source === 'runtime-server') return 'high';
  return 'medium';
}

function createFingerprint(issue) {
  return [
    issue.source,
    issue.category,
    issue.packageName,
    issue.advisoryId,
    issue.cve,
    issue.ruleId,
    issue.filePath,
    issue.line,
    issue.column,
    issue.title,
  ]
    .map(normalizeKeyPart)
    .filter(Boolean)
    .filter((part, index, values) => values.indexOf(part) === index)
    .join(':')
    .slice(0, 220);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toOptionalNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function severityFromAuditSeverity(value) {
  return ['critical', 'high'].includes(String(value)) ? 'error' : 'warning';
}

function extractIdentifierFromUrl(url) {
  const value = toOptionalString(url);
  if (!value) return undefined;

  const ghsaMatch = value.match(/GHSA-[a-z0-9-]+/i);
  if (ghsaMatch) return ghsaMatch[0].toUpperCase();

  const cveMatch = value.match(/CVE-\d{4}-\d+/i);
  if (cveMatch) return cveMatch[0].toUpperCase();

  return undefined;
}

function extractCveFromUrl(url) {
  const value = toOptionalString(url);
  if (!value) return undefined;

  const cveMatch = value.match(/CVE-\d{4}-\d+/i);
  return cveMatch ? cveMatch[0].toUpperCase() : undefined;
}

function normalizeFixAvailable(fixAvailable) {
  if (fixAvailable === true) {
    return { fixAvailable: true, fixVersion: undefined };
  }

  if (!fixAvailable || typeof fixAvailable !== 'object') {
    return { fixAvailable: false, fixVersion: undefined };
  }

  return {
    fixAvailable: true,
    fixVersion: toOptionalString(fixAvailable.version),
  };
}

function getPackageVersion(report, packageName) {
  return toOptionalString(report?.dependencies?.[packageName]?.version);
}

function excerptLog(log) {
  const lines = log.split(/\r?\n/).filter(Boolean);
  const errorIndex = lines.findIndex((line) => /error|failed|✗/i.test(line));
  const start = errorIndex >= 0 ? Math.max(0, errorIndex - 2) : Math.max(0, lines.length - 8);
  return lines.slice(start, start + 10).join('\n').slice(0, 1600);
}

function createIssue(input) {
  const category = input.category || inferCategory(input.source, input.ruleId);
  const priority = input.priority || inferPriority({
    source: input.source,
    severity: input.severity,
    category,
    cvssScore: input.cvssScore,
  });
  const issue = {
    status: 'open',
    category,
    priority,
    firstSeenAt: now,
    lastSeenAt: now,
    occurrences: 1,
    runUrl: process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
      ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined,
    ...input,
  };

  return {
    ...issue,
    fingerprint: input.fingerprint || createFingerprint(issue),
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
      component: 'frontend',
      environment: process.env.GITHUB_REF_NAME || 'local',
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
        component: 'test-suite',
        environment: process.env.GITHUB_REF_NAME || 'local',
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
      component: 'test-suite',
      environment: process.env.GITHUB_REF_NAME || 'local',
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

  return Object.entries(vulnerabilities).flatMap(([name, vulnerability]) => {
    const packageVersion = getPackageVersion(report, name);
    const fix = normalizeFixAvailable(vulnerability.fixAvailable);
    const advisoryEntries = toArray(vulnerability.via).filter((entry) => entry && typeof entry === 'object');
    const stringEntries = toArray(vulnerability.via).filter((entry) => typeof entry === 'string');

    if (advisoryEntries.length === 0) {
      return [createIssue({
        id: issueId(['audit', name, vulnerability.severity]),
        source: 'audit',
        severity: severityFromAuditSeverity(vulnerability.severity),
        component: 'dependencies',
        environment: process.env.GITHUB_REF_NAME || 'local',
        detectedBy: 'npm-audit',
        packageName: name,
        packageVersion,
        vulnerableRange: toOptionalString(vulnerability.range),
        fixVersion: fix.fixVersion,
        fixAvailable: fix.fixAvailable,
        title: `${name} has ${vulnerability.severity} vulnerability risk`,
        message: stringEntries.join('; ') || `npm audit reported ${vulnerability.severity} risk for ${name}.`,
        filePath: 'package-lock.json',
        ruleId: name,
      })];
    }

    return advisoryEntries.map((advisory, index) => {
      const advisoryId = toOptionalString(advisory.source) || extractIdentifierFromUrl(advisory.url);
      const cve = toOptionalString(toArray(advisory.cves)[0]) || extractCveFromUrl(advisory.url);
      const cvssScore = toOptionalNumber(advisory.cvss?.score);
      const advisorySeverity = advisory.severity || vulnerability.severity;
      const range = toOptionalString(advisory.range) || toOptionalString(vulnerability.range);
      const title = toOptionalString(advisory.title)
        || `${name} vulnerability advisory`;
      const referenceUrl = toOptionalString(advisory.url);

      return createIssue({
        id: issueId(['audit', name, advisoryId || cve || advisorySeverity, index]),
        source: 'audit',
        severity: severityFromAuditSeverity(advisorySeverity),
        component: 'dependencies',
        environment: process.env.GITHUB_REF_NAME || 'local',
        detectedBy: 'npm-audit',
        packageName: name,
        packageVersion,
        vulnerableRange: range,
        fixVersion: fix.fixVersion,
        fixAvailable: fix.fixAvailable,
        advisoryId,
        cve,
        cvssScore,
        referenceUrl,
        title,
        message: stringEntries.join('; ') || `Affected range: ${range || 'unknown'}${fix.fixVersion ? `; fix version: ${fix.fixVersion}` : ''}`,
        filePath: 'package-lock.json',
        ruleId: advisoryId || cve || name,
      });
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

if (!token) {
  if (isCi) {
    throw new Error(
      'QUALITY_ISSUES_INGEST_TOKEN is not set in CI. Configure it in GitHub Actions secrets.',
    );
  }

  console.log(
    `QUALITY_ISSUES_INGEST_TOKEN is not set; wrote quality-issues-payload.json only. Expected ingest URL: ${endpoint}`,
  );
  process.exit(0);
}

console.log(`Publishing quality issue snapshot to ${endpoint}`);

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
  throw new Error(
    `Failed to publish quality issues to ${endpoint}: ${response.status} ${response.statusText}\n${body.slice(0, 1600)}`,
  );
}

console.log(`Published ${issues.length} quality issue(s).`);
