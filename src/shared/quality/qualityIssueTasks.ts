import type {
  QualityIssue,
  QualityIssueAlert,
} from './qualityIssues.ts';

export interface QualityIssueTaskPlan {
  title: string;
  description: string;
  checklist: string[];
  tags: string[];
  statusNote: string;
}

const TASK_TITLE_LIMIT = 500;
const TASK_DESCRIPTION_LIMIT = 5000;

function compact(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : undefined;
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? value.slice(0, limit - 1).trimEnd() : value;
}

function formatField(label: string, value: unknown): string | undefined {
  const text = compact(value);
  return text ? `- ${label}: ${text}` : undefined;
}

function formatPackage(issue: QualityIssue): string | undefined {
  if (!issue.packageName) return undefined;
  return `${issue.packageName}${issue.packageVersion ? `@${issue.packageVersion}` : ''}`;
}

function issueLocation(issue: QualityIssue): string | undefined {
  if (!issue.filePath) return undefined;
  return `${issue.filePath}${typeof issue.line === 'number' ? `:${issue.line}` : ''}${typeof issue.column === 'number' ? `:${issue.column}` : ''}`;
}

function securityTitle(issue: QualityIssue): string {
  const packageLabel = issue.packageName || 'dependency';
  const action = issue.fixVersion ? `Upgrade ${packageLabel} to ${issue.fixVersion}` : `Assess ${packageLabel} vulnerability`;
  return `[Security] ${action}: ${issue.title}`;
}

function defaultTitle(issue: QualityIssue, alert?: QualityIssueAlert): string {
  const prefix = issue.category === 'runtime'
    ? 'Investigate'
    : issue.category === 'configuration'
      ? 'Fix configuration'
      : issue.category === 'test'
        ? 'Stabilize test'
        : 'Resolve';

  return alert ? `[Issue Manager] ${prefix}: ${alert.title}: ${issue.title}` : `${prefix}: ${issue.title}`;
}

function buildSecurityDescription(issue: QualityIssue, alert?: QualityIssueAlert): string {
  const packageLabel = formatPackage(issue) || issue.packageName || 'Unknown package';
  const references = [
    formatField('CVE', issue.cve),
    formatField('Advisory', issue.advisoryId),
    formatField('Reference', issue.referenceUrl),
    formatField('Workflow run', issue.runUrl),
  ].filter(Boolean);

  const context = [
    formatField('Package', packageLabel),
    formatField('Installed version', issue.packageVersion),
    formatField('Vulnerable range', issue.vulnerableRange),
    formatField('Fix version', issue.fixVersion),
    formatField('Priority', issue.priority),
    formatField('CVSS score', issue.cvssScore),
    formatField('Detected by', issue.detectedBy || issue.source),
    formatField('First seen', issue.firstSeenAt),
    formatField('Last seen', issue.lastSeenAt),
    formatField('Occurrences', issue.occurrences),
    formatField('Fingerprint', issue.fingerprint),
  ].filter(Boolean);

  const remediation = issue.fixVersion
    ? `Upgrade ${issue.packageName || 'the affected package'} to ${issue.fixVersion}, or replace the dependency if that upgrade is not safe for Navigate Wealth.`
    : 'No safe fixed version is recorded in the feed yet. Confirm exposure, document the compensating control, and choose a replacement path if the package is reachable in production.';

  return [
    'Security Issue',
    '',
    `Finding: ${issue.title}`,
    `Impact: ${issue.message}`,
    alert ? `Automation signal: ${alert.title} - ${alert.message}` : undefined,
    '',
    'Affected Dependency',
    ...context,
    '',
    'Why This Matters',
    'This task was generated from the Issue Manager security feed. It should not be closed until the affected dependency is patched, replaced, or explicitly accepted with evidence that the vulnerable path is not reachable in production.',
    '',
    'Required Remediation',
    `1. Confirm whether ${packageLabel} is bundled into any production path or admin workflow.`,
    `2. ${remediation}`,
    '3. Run a fresh dependency audit and the normal app verification suite.',
    '4. Deploy any code or dependency change that is required.',
    '5. Rerun the Issue Manager security intake and attach the audit/deploy evidence before resolving the linked issue.',
    references.length ? '' : undefined,
    references.length ? 'References' : undefined,
    ...references,
  ].filter((line): line is string => line !== undefined).join('\n');
}

function buildDefaultDescription(issue: QualityIssue, alert?: QualityIssueAlert): string {
  const context = [
    formatField('Priority', issue.priority),
    formatField('Source', issue.source),
    formatField('Category', issue.category),
    formatField('Rule', issue.ruleId),
    formatField('Location', issueLocation(issue)),
    formatField('Component', issue.component),
    formatField('Environment', issue.environment),
    formatField('Reference', issue.referenceUrl),
    formatField('Workflow run', issue.runUrl),
    formatField('First seen', issue.firstSeenAt),
    formatField('Last seen', issue.lastSeenAt),
    formatField('Occurrences', issue.occurrences),
    formatField('Fingerprint', issue.fingerprint),
  ].filter(Boolean);

  return [
    'Issue Manager Task',
    '',
    `Finding: ${issue.title}`,
    `Impact: ${issue.message}`,
    alert ? `Automation signal: ${alert.title} - ${alert.message}` : undefined,
    '',
    'Context',
    ...context,
    '',
    'Required Response',
    '1. Reproduce or verify the signal from the source feed.',
    '2. Apply the smallest fix or record the current mitigation.',
    '3. Rerun the originating verification path.',
    '4. Add evidence to the Issue Manager before resolving the issue.',
  ].filter((line): line is string => line !== undefined).join('\n');
}

function buildSecurityChecklist(issue: QualityIssue): string[] {
  const packageLabel = issue.packageName || 'affected dependency';
  return [
    `Confirm where ${packageLabel} is used and whether the vulnerable code path is reachable in production.`,
    issue.fixVersion
      ? `Upgrade or replace ${packageLabel}; target fixed version ${issue.fixVersion}.`
      : `Choose a mitigation or replacement path for ${packageLabel}; no fixed version is currently recorded.`,
    'Run npm audit and capture the fresh result.',
    'Run npm test.',
    'Run npm run build.',
    'Deploy the fix if source, lockfile, or Edge Function behavior changed.',
    'Rerun the Issue Manager security intake so the feed reflects the new state.',
    'Paste the audit, test, build, deploy, and intake evidence into the linked Issue Manager issue before resolving it.',
  ];
}

function buildDefaultChecklist(): string[] {
  return [
    'Verify the issue still reproduces on the latest code path.',
    'Apply the smallest fix or document the accepted mitigation.',
    'Rerun the originating check or browser flow.',
    'Attach verification evidence to the linked Issue Manager issue.',
  ];
}

export function buildQualityIssueTaskPlan(issue: QualityIssue, alert?: QualityIssueAlert): QualityIssueTaskPlan {
  const title = issue.category === 'security' ? securityTitle(issue) : defaultTitle(issue, alert);
  const description = issue.category === 'security'
    ? buildSecurityDescription(issue, alert)
    : buildDefaultDescription(issue, alert);
  const checklist = issue.category === 'security' ? buildSecurityChecklist(issue) : buildDefaultChecklist();

  return {
    title: truncate(title, TASK_TITLE_LIMIT),
    description: truncate(description, TASK_DESCRIPTION_LIMIT),
    checklist,
    tags: ['issue-manager', issue.category, issue.source, issue.priority],
    statusNote: alert
      ? `Automation opened or refreshed a remediation task because: ${alert.message}`
      : 'Issue Manager opened or refreshed a remediation task with current issue context.',
  };
}
