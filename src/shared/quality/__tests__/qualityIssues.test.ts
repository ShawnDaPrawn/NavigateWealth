import { describe, expect, it } from 'vitest';
import {
  applyQualityIssueWorkflow,
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
});
