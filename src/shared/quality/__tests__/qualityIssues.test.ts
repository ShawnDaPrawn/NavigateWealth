import { describe, expect, it } from 'vitest';
import {
  applyQualityIssueWorkflow,
  coalesceQualityIssuesByFingerprint,
  createQualityIssueFingerprint,
  getQualityIssueAutomationAlerts,
  hasQualityIssueRecurredAfterResolution,
  inferQualityIssueCategory,
  inferQualityIssuePriority,
  isQualityIssuePastResponseSla,
  recommendQualityIssueActions,
  summarizeQualityIssues,
  type QualityIssue,
} from '../qualityIssues';
import { buildQualityIssueTaskPlan } from '../qualityIssueTasks';

function issue(overrides: Partial<QualityIssue>): QualityIssue {
  const base: QualityIssue = {
    id: 'issue-1',
    source: 'build',
    category: 'build',
    priority: 'high',
    fingerprint: 'build:build:npm-run-build',
    severity: 'error',
    status: 'open',
    title: 'Production build failed',
    message: 'npm run build failed',
    firstSeenAt: '2026-04-28T00:00:00.000Z',
    lastSeenAt: '2026-04-28T00:00:00.000Z',
    occurrences: 1,
  };

  return { ...base, ...overrides };
}

describe('quality issue model', () => {
  it('infers normalized categories from issue sources', () => {
    expect(inferQualityIssueCategory('audit')).toBe('security');
    expect(inferQualityIssueCategory('runtime-client')).toBe('runtime');
    expect(inferQualityIssueCategory('build', 'env validation')).toBe('configuration');
  });

  it('prioritizes security errors ahead of general errors', () => {
    expect(inferQualityIssuePriority({
      source: 'audit',
      severity: 'error',
      category: 'security',
    })).toBe('critical');

    expect(inferQualityIssuePriority({
      source: 'audit',
      severity: 'warning',
      category: 'security',
      cvssScore: 8.2,
    })).toBe('high');

    expect(inferQualityIssuePriority({
      source: 'test',
      severity: 'error',
      category: 'test',
    })).toBe('high');
  });

  it('summarizes by source, category, and priority', () => {
    const summary = summarizeQualityIssues([
      issue({ source: 'audit', category: 'security', priority: 'critical' }),
      issue({ id: 'issue-2', source: 'runtime-client', category: 'runtime', priority: 'high' }),
      issue({ id: 'issue-3', source: 'test', category: 'test', priority: 'medium', severity: 'warning' }),
    ]);

    expect(summary.total).toBe(3);
    expect(summary.bySource.audit).toBe(1);
    expect(summary.byCategory.security).toBe(1);
    expect(summary.byCategory.runtime).toBe(1);
    expect(summary.byPriority.critical).toBe(1);
    expect(summary.byPriority.high).toBe(1);
    expect(summary.warnings).toBe(1);
  });

  it('coalesces repeated issue fingerprints into one queue item', () => {
    const issues = coalesceQualityIssuesByFingerprint([
      issue({
        id: 'runtime-1',
        fingerprint: 'runtime-client:runtime:react-error-boundary:/admin:typeerror',
        firstSeenAt: '2026-04-29T07:35:02.581Z',
        lastSeenAt: '2026-04-29T07:35:02.581Z',
        occurrences: 1,
      }),
      issue({
        id: 'runtime-2',
        fingerprint: 'runtime-client:runtime:react-error-boundary:/admin:typeerror',
        message: 'Latest stack trace',
        firstSeenAt: '2026-04-29T18:53:25.455Z',
        lastSeenAt: '2026-04-29T18:53:25.455Z',
        occurrences: 2,
      }),
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('runtime-2');
    expect(issues[0].firstSeenAt).toBe('2026-04-29T07:35:02.581Z');
    expect(issues[0].lastSeenAt).toBe('2026-04-29T18:53:25.455Z');
    expect(issues[0].occurrences).toBe(3);
    expect(issues[0].message).toBe('Latest stack trace');
  });

  it('creates stable fingerprints from normalized issue identity fields', () => {
    expect(createQualityIssueFingerprint(issue({
      source: 'audit',
      category: 'security',
      packageName: 'minimist',
      advisoryId: 'GHSA-vh95-rmgr-6w4m',
      cve: 'CVE-2021-44906',
      ruleId: 'GHSA-vh95-rmgr-6w4m',
      filePath: 'package-lock.json',
      title: 'Prototype pollution in minimist',
    }))).toBe('audit:security:minimist:ghsa-vh95-rmgr-6w4m:cve-2021-44906:package-lock.json:prototype-pollution-in-minimist');
  });

  it('overlays workflow state onto an issue for triage queues', () => {
    const updated = applyQualityIssueWorkflow(
      issue({ fingerprint: 'runtime:dashboard:load' }),
      {
        fingerprint: 'runtime:dashboard:load',
        status: 'acknowledged',
        ownerName: 'Platform Team',
        statusNote: 'Reproduced in staging',
        linkedTaskId: 'task-123',
        linkedTaskTitle: 'Investigate dashboard runtime incident',
        workflowUpdatedAt: '2026-04-29T08:00:00.000Z',
        workflowUpdatedBy: 'shawn@navigatewealth.co',
      },
    );

    expect(updated.status).toBe('acknowledged');
    expect(updated.ownerName).toBe('Platform Team');
    expect(updated.linkedTaskId).toBe('task-123');
    expect(updated.workflowUpdatedBy).toBe('shawn@navigatewealth.co');
  });

  it('reopens resolved issues when the same fingerprint appears again', () => {
    const updated = applyQualityIssueWorkflow(
      issue({
        fingerprint: 'runtime:dashboard:load',
        lastSeenAt: '2026-04-29T10:00:00.000Z',
      }),
      {
        fingerprint: 'runtime:dashboard:load',
        status: 'resolved',
        ownerName: 'Platform Team',
        resolutionEvidence: 'Build passed and dashboard smoke test completed.',
        resolvedAt: '2026-04-29T09:00:00.000Z',
        regressionCount: 2,
      },
    );

    expect(updated.status).toBe('open');
    expect(updated.resolvedAt).toBeUndefined();
    expect(updated.reopenedAt).toBe('2026-04-29T10:00:00.000Z');
    expect(updated.reopenedFromResolvedAt).toBe('2026-04-29T09:00:00.000Z');
    expect(updated.resolutionEvidence).toContain('dashboard smoke test');
    expect(hasQualityIssueRecurredAfterResolution(updated, {
      fingerprint: 'runtime:dashboard:load',
      status: 'resolved',
      resolvedAt: '2026-04-29T09:00:00.000Z',
    })).toBe(true);
  });

  it('flags open issues that are past the priority response target', () => {
    expect(isQualityIssuePastResponseSla(
      issue({
        priority: 'critical',
        status: 'open',
        firstSeenAt: '2026-04-28T00:00:00.000Z',
      }),
      new Date('2026-04-29T01:00:00.000Z'),
    )).toBe(true);

    expect(isQualityIssuePastResponseSla(
      issue({
        priority: 'critical',
        status: 'resolved',
        firstSeenAt: '2026-04-28T00:00:00.000Z',
      }),
      new Date('2026-04-29T01:00:00.000Z'),
    )).toBe(false);
  });

  it('creates automation alerts for critical, stale, reopened, and fixable security issues', () => {
    const alerts = getQualityIssueAutomationAlerts([
      issue({
        source: 'audit',
        category: 'security',
        priority: 'critical',
        packageName: 'minimist',
        fixAvailable: true,
        fixVersion: '1.2.8',
        reopenedAt: '2026-04-29T10:00:00.000Z',
        firstSeenAt: '2026-04-27T00:00:00.000Z',
      }),
    ], new Date('2026-04-29T10:00:00.000Z'));

    expect(alerts.map((alert) => alert.type)).toEqual([
      'critical-open',
      'past-response-target',
      'reopened-regression',
      'security-fix-available',
    ]);
    expect(alerts.filter((alert) => alert.severity === 'critical')).toHaveLength(4);
  });

  it('recommends response actions that match issue type and workflow state', () => {
    const actions = recommendQualityIssueActions(issue({
      source: 'audit',
      category: 'security',
      priority: 'critical',
      packageName: 'minimist',
      fixAvailable: true,
      fixVersion: '1.2.8',
    }));

    expect(actions.some((action) => action.includes('Assign an owner'))).toBe(true);
    expect(actions.some((action) => action.includes('upgrade minimist to 1.2.8'))).toBe(true);
    expect(actions.some((action) => action.includes('Create a linked task'))).toBe(true);
  });

  it('builds descriptive security remediation task plans', () => {
    const plan = buildQualityIssueTaskPlan(issue({
      source: 'audit',
      category: 'security',
      priority: 'critical',
      title: 'Prototype pollution in xlsx',
      message: 'xlsx is vulnerable when parsing crafted workbook files.',
      packageName: 'xlsx',
      packageVersion: '0.18.5',
      vulnerableRange: '<=0.18.5',
      fixVersion: '0.20.0',
      cve: 'CVE-2026-1234',
      advisoryId: 'GHSA-test',
      cvssScore: 9.1,
      referenceUrl: 'https://github.com/advisories/GHSA-test',
      runUrl: 'https://github.com/ShawnDaPrawn/NavigateWealth/actions/runs/1',
      fingerprint: 'audit:security:xlsx:prototype-pollution',
    }));

    expect(plan.title).toContain('[Security] Upgrade xlsx to 0.20.0');
    expect(plan.description).toContain('Affected Dependency');
    expect(plan.description).toContain('Package: xlsx@0.18.5');
    expect(plan.description).toContain('Vulnerable range: <=0.18.5');
    expect(plan.description).toContain('CVE: CVE-2026-1234');
    expect(plan.description).toContain('Required Remediation');
    expect(plan.description).toContain('Rerun the Issue Manager security intake');
    expect(plan.checklist).toEqual(expect.arrayContaining([
      'Run npm audit and capture the fresh result.',
      'Run npm test.',
      'Run npm run build.',
    ]));
  });
});
