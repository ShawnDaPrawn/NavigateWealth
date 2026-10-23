/**
 * quality-issues-normalize.ts — what an untrusted issue payload is allowed to become.
 *
 * Every CI snapshot, browser report and security-feed row is passed through
 * these functions on read (`combineSnapshots`) and on ingest. A bad value that
 * gets stored changes what an admin sees, which issue a recurrence matches,
 * and how a workflow update moves a finding. These tests pin the rules that
 * decide that, not the happy path of a well-formed row.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_AFFECTED_USER_IDS,
  MAX_BREADCRUMBS,
  MAX_RESOLUTION_EVIDENCE_LENGTH,
  MAX_WORKFLOW_NOTE_LENGTH,
  issueId,
  normalizeAutomationRun,
  normalizeIssue,
  normalizeSecurityFeed,
  normalizeSnapshot,
  normalizeWorkflowMap,
  normalizeWorkflowUpdate,
} from '../quality-issues-normalize.ts';

const NOW = '2026-10-15T10:00:00.000Z';

describe('normalizeIssue', () => {
  it('trims a well-formed issue and keeps a score of zero', () => {
    const issue = normalizeIssue(
      {
        id: '  advisory-1  ',
        source: 'audit',
        category: 'security',
        severity: 'error',
        status: 'open',
        priority: 'high',
        title: '  brace-expansion  ',
        message: '  unbounded expansion  ',
        fingerprint: '  fp-1  ',
        cvssScore: 0,
        line: 0,
        column: 12,
        occurrences: 2.9,
        anonymous: true,
        firstSeenAt: '2026-10-01T00:00:00.000Z',
      },
      4,
      NOW,
    );

    expect(issue).toMatchObject({
      id: 'advisory-1',
      source: 'audit',
      category: 'security',
      severity: 'error',
      status: 'open',
      priority: 'high',
      title: 'brace-expansion',
      message: 'unbounded expansion',
      fingerprint: 'fp-1',
      cvssScore: 0,
      line: 0,
      column: 12,
      occurrences: 2,
      anonymous: true,
      firstSeenAt: '2026-10-01T00:00:00.000Z',
      lastSeenAt: NOW,
    });
  });

  it('drops enum values that are not on the list, so a report cannot invent one', () => {
    const issue = normalizeIssue(
      {
        source: 'browser',
        severity: 'fatal',
        status: 'closed',
        category: 'pwned',
        priority: 'urgent',
        title: 'Render failed',
        ruleId: 'env-missing',
      },
      0,
      NOW,
    );

    // Invalid source falls back to build; the env rule then files it as
    // configuration, and an invalid priority is inferred rather than stored.
    expect(issue.source).toBe('build');
    expect(issue.severity).toBe('error');
    expect(issue.status).toBe('open');
    expect(issue.category).toBe('configuration');
    expect(issue.priority).toBe('high');
    expect(issue.id).toBe('build:env-missing:repo:0');
  });

  it('ranks a security finding from a finite CVSS score, and ignores one that is not', () => {
    const security = (cvssScore: unknown, severity: string = 'error') =>
      normalizeIssue(
        {
          source: 'audit',
          category: 'security',
          severity,
          title: 'Advisory',
          cvssScore,
        },
        0,
        NOW,
      );

    expect(security(9).priority).toBe('critical');
    expect(security(8.9).priority).toBe('high');
    expect(security(7).priority).toBe('high');
    expect(security(6.9).priority).toBe('medium');
    expect(security(4).priority).toBe('medium');
    expect(security(3.9).priority).toBe('low');
    expect(security(0).priority).toBe('low');

    // A missing or unreadable score must not take the numeric ladder. NaN
    // would compare as low and hide a security error; a string must not be
    // coerced into a 9.
    for (const cvssScore of [Number.NaN, Number.POSITIVE_INFINITY, '9']) {
      const issue = security(cvssScore);
      expect(issue.cvssScore).toBeUndefined();
      expect(issue.priority).toBe('critical');
    }

    const warning = security('9', 'warning');
    expect(warning.cvssScore).toBeUndefined();
    expect(warning.priority).toBe('high');

    // A real high score outranks a severity of info.
    expect(security(9, 'info').priority).toBe('critical');
  });

  it('caps the text and lists a public report can store', () => {
    expect(MAX_BREADCRUMBS).toBe(20);
    expect(MAX_AFFECTED_USER_IDS).toBe(50);

    const issue = normalizeIssue(
      {
        title: '   ',
        message: '   ',
        line: '12',
        column: Number.NaN,
        occurrences: 0,
        anonymous: 'yes',
        details: 'd'.repeat(8001),
        breadcrumbs: [
          ...Array.from({ length: 25 }, (_, index) => `step-${index}`),
          12,
          'x'.repeat(400),
        ],
        affectedUserIds: [...Array.from({ length: 55 }, (_, index) => `user-${index}`), 7],
      },
      3,
      NOW,
    );

    expect(issue.title).toBe('build issue');
    expect(issue.message).toBe('build issue');
    expect(issue.line).toBeUndefined();
    expect(issue.occurrences).toBe(1);
    expect(issue.anonymous).toBeUndefined();
    expect(issue.details).toHaveLength(8000);
    expect(issue.breadcrumbs).toHaveLength(20);
    expect(issue.breadcrumbs?.[0]).toBe('step-6');
    expect(issue.breadcrumbs?.at(-1)).toBe('x'.repeat(300));
    expect(issue.affectedUserIds).toEqual(
      Array.from({ length: 50 }, (_, index) => `user-${index}`),
    );
    expect(issue.fingerprint).toBe('build:build-issue');
  });

  it('rebuilds a blank fingerprint and keeps a supplied one', () => {
    const blank = normalizeIssue({ title: 'Same bug', fingerprint: '   ' }, 0, NOW);
    const missing = normalizeIssue({ title: 'Same bug' }, 1, NOW);
    expect(blank.fingerprint).toBe(missing.fingerprint);
    expect(blank.fingerprint).toBe('build:same-bug');

    expect(normalizeIssue({ title: 'Same bug', fingerprint: '  kept  ' }, 0, NOW).fingerprint).toBe(
      'kept',
    );
  });
});

describe('normalizeSnapshot', () => {
  it('skips entries that are not issues and keeps a supplied timestamp', () => {
    const snapshot = normalizeSnapshot({
      generatedAt: '2026-10-01T00:00:00.000Z',
      runId: 'run-1',
      issues: [null, 'nope', 4, { title: 'One real finding' }],
    });

    expect(snapshot.generatedAt).toBe('2026-10-01T00:00:00.000Z');
    expect(snapshot.runId).toBe('run-1');
    expect(snapshot.issues).toHaveLength(1);
    expect(snapshot.issues[0]?.title).toBe('One real finding');
    expect(snapshot.summary.total).toBe(1);
    expect(snapshot.summary.open).toBe(1);
  });

  it('treats a missing issue list as empty', () => {
    expect(normalizeSnapshot({ issues: 'corrupt' }).issues).toEqual([]);
  });
});

describe('normalizeSecurityFeed', () => {
  it('files an item with no source as an audit security finding', () => {
    const [issue] = normalizeSecurityFeed({
      tool: 'npm-audit',
      detectedBy: '   ',
      branch: 'main',
      environment: '   ',
      issues: [null, { title: 'brace-expansion', severity: 'error' }],
    });

    expect(issue).toMatchObject({
      source: 'audit',
      category: 'security',
      severity: 'error',
      priority: 'critical',
      detectedBy: 'npm-audit',
      environment: 'main',
      title: 'brace-expansion',
    });
  });

  it('uses an explicit detectedBy and returns nothing for a non-list', () => {
    const [issue] = normalizeSecurityFeed({
      detectedBy: ' dependabot ',
      tool: 'npm-audit',
      issues: [{ title: 'Noted', severity: 'warning' }],
    });
    expect(issue?.detectedBy).toBe('dependabot');
    expect(issue?.priority).toBe('high');
    expect(normalizeSecurityFeed({ issues: { not: 'a list' } })).toEqual([]);
  });
});

describe('normalizeWorkflowMap', () => {
  it('keeps a resolved row, and does not treat an unknown status as resolved', () => {
    const map = normalizeWorkflowMap({
      'fp-resolved': {
        status: 'resolved',
        statusNote: `  ${'n'.repeat(MAX_WORKFLOW_NOTE_LENGTH + 5)}`,
        regressionCount: 2.8,
        workflowUpdatedAt: '2026-10-01T00:00:00.000Z',
      },
      'fp-garbage': { status: 'done' },
      'fp-not-an-object': 'resolved',
      '': { fingerprint: '   ' },
    });

    expect(map['fp-not-an-object']).toBeUndefined();
    expect(map['']).toBeUndefined();
    expect(map['fp-garbage']?.status).toBe('open');
    expect(map['fp-resolved']).toMatchObject({
      fingerprint: 'fp-resolved',
      status: 'resolved',
      regressionCount: 2,
      workflowUpdatedAt: '2026-10-01T00:00:00.000Z',
    });
    expect(map['fp-resolved']?.statusNote).toHaveLength(MAX_WORKFLOW_NOTE_LENGTH);
  });

  it('drops a regression count that is not a positive number', () => {
    const map = normalizeWorkflowMap({
      zero: { regressionCount: 0 },
      negative: { regressionCount: -2 },
      text: { regressionCount: '3' },
    });
    expect(map.zero?.regressionCount).toBeUndefined();
    expect(map.negative?.regressionCount).toBeUndefined();
    expect(map.text?.regressionCount).toBeUndefined();
    expect(normalizeWorkflowMap(null)).toEqual({});
    expect(normalizeWorkflowMap('nope')).toEqual({});
  });
});

describe('normalizeWorkflowUpdate', () => {
  it('returns null without a fingerprint, so the update cannot land on every issue', () => {
    expect(normalizeWorkflowUpdate(null)).toBeNull();
    expect(normalizeWorkflowUpdate({ status: 'resolved' })).toBeNull();
    expect(normalizeWorkflowUpdate({ fingerprint: '   ' })).toBeNull();
  });

  it('clears a field set to null, and leaves an omitted field unset', () => {
    expect(
      normalizeWorkflowUpdate({
        fingerprint: '  fp-1  ',
        status: 'done',
        ownerName: null,
        statusNote: '  still open  ',
        resolutionEvidence: '   ',
        linkedTaskTitle: null,
      }),
    ).toEqual({
      fingerprint: 'fp-1',
      status: undefined,
      ownerName: null,
      statusNote: 'still open',
      resolutionEvidence: undefined,
      linkedTaskId: undefined,
      linkedTaskTitle: null,
    });

    const cleared = normalizeWorkflowUpdate({
      fingerprint: 'fp-1',
      resolutionEvidence: 'e'.repeat(MAX_RESOLUTION_EVIDENCE_LENGTH + 10),
    });
    expect(cleared?.status).toBeUndefined();
    expect(cleared?.ownerName).toBeUndefined();
    expect(cleared?.resolutionEvidence).toHaveLength(MAX_RESOLUTION_EVIDENCE_LENGTH);
  });
});

describe('normalizeAutomationRun', () => {
  it('floors negative counts and drops an alert that cannot be keyed', () => {
    const run = normalizeAutomationRun({
      runAt: '2026-10-15T10:00:00.000Z',
      runBy: '  nightly  ',
      activeAlerts: -1.2,
      criticalAlerts: 1.9,
      tasksCreated: -5,
      tasksLinked: 2.2,
      alerts: [
        { id: 'a1', fingerprint: 'fp-1', severity: 'critical' },
        { id: 'missing-fingerprint' },
        { fingerprint: 'missing-id' },
        null,
      ],
    });

    expect(run).toMatchObject({
      runAt: '2026-10-15T10:00:00.000Z',
      runBy: 'nightly',
      activeAlerts: 0,
      criticalAlerts: 1,
      tasksCreated: 0,
      tasksLinked: 2,
    });
    expect(run?.alerts).toEqual([{ id: 'a1', fingerprint: 'fp-1', severity: 'critical' }]);
  });

  it('counts the alerts it kept when the run did not record a count', () => {
    const run = normalizeAutomationRun({
      alerts: [
        { id: 'a1', fingerprint: 'fp-1', severity: 'critical' },
        { id: 'a2', fingerprint: 'fp-2', severity: 'warning' },
      ],
    });
    expect(run?.activeAlerts).toBe(2);
    expect(run?.criticalAlerts).toBe(1);
    expect(run?.tasksCreated).toBe(0);
    expect(normalizeAutomationRun(null)).toBeUndefined();
    expect(normalizeAutomationRun('nope')).toBeUndefined();
  });
});

describe('issueId', () => {
  it('lowercases, strips characters that are not safe in a key, and stops at 180', () => {
    expect(issueId(['Build', 'Failed!!!', '../src/App.tsx'])).toBe('build:failed-:../src/app.tsx');
    expect(issueId([null, '', 'Policy Number'])).toBe('policy-number');
    expect(issueId(['A'.repeat(200)])).toHaveLength(180);
  });
});
