/**
 * Tests for buildQualityIssueTaskPlan — pure function, no mocks needed.
 */

import { describe, expect, it } from 'vitest';
import { buildQualityIssueTaskPlan } from '../qualityIssueTasks';
import type { QualityIssue, QualityIssueAlert } from '../qualityIssues';

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseIssue(overrides: Partial<QualityIssue> = {}): QualityIssue {
  return {
    id: 'issue-1',
    source: 'build',
    category: 'build',
    priority: 'medium',
    fingerprint: 'fp-123',
    severity: 'error',
    status: 'open',
    title: 'Build failure',
    message: 'The build process failed unexpectedly.',
    firstSeenAt: '2026-01-01T00:00:00Z',
    lastSeenAt: '2026-01-02T00:00:00Z',
    occurrences: 3,
    ...overrides,
  };
}

function baseAlert(overrides: Partial<QualityIssueAlert> = {}): QualityIssueAlert {
  return {
    id: 'alert-1',
    fingerprint: 'fp-123',
    type: 'critical-open',
    severity: 'critical',
    title: 'Alert Title',
    message: 'This is critical.',
    actionLabel: 'Fix now',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── title generation ──────────────────────────────────────────────────────────

describe('buildQualityIssueTaskPlan — title', () => {
  it('uses "Resolve" prefix for build category', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue({ category: 'build' }));
    expect(plan.title).toBe('Resolve: Build failure');
  });

  it('uses "Investigate" prefix for runtime category', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue({ category: 'runtime' }));
    expect(plan.title).toMatch(/^Investigate:/);
  });

  it('uses "Fix configuration" prefix for configuration category', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue({ category: 'configuration' }));
    expect(plan.title).toMatch(/^Fix configuration:/);
  });

  it('uses "Stabilize test" prefix for test category', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue({ category: 'test' }));
    expect(plan.title).toMatch(/^Stabilize test:/);
  });

  it('prefixes title with [Issue Manager] when alert is provided', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue(), baseAlert({ title: 'Alert' }));
    expect(plan.title).toMatch(/^\[Issue Manager\]/);
  });

  it('includes alert title in the title', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue(), baseAlert({ title: 'My Alert' }));
    expect(plan.title).toContain('My Alert');
  });

  it('generates security title with upgrade action when fixVersion set', () => {
    const plan = buildQualityIssueTaskPlan(
      baseIssue({
        category: 'security',
        packageName: 'lodash',
        fixVersion: '4.17.21',
        title: 'CVE-2021-1234',
      }),
    );
    expect(plan.title).toBe('[Security] Upgrade lodash to 4.17.21: CVE-2021-1234');
  });

  it('generates security title with assess action when no fixVersion', () => {
    const plan = buildQualityIssueTaskPlan(
      baseIssue({ category: 'security', packageName: 'lodash', title: 'CVE-2021-1234' }),
    );
    expect(plan.title).toBe('[Security] Assess lodash vulnerability: CVE-2021-1234');
  });

  it('uses "dependency" when packageName is absent for security title', () => {
    const plan = buildQualityIssueTaskPlan(
      baseIssue({ category: 'security', title: 'Mystery CVE' }),
    );
    expect(plan.title).toContain('dependency');
  });

  it('truncates title at 500 characters', () => {
    const longTitle = 'X'.repeat(600);
    const plan = buildQualityIssueTaskPlan(baseIssue({ title: longTitle }));
    expect(plan.title.length).toBeLessThanOrEqual(500);
  });
});

// ── tags ──────────────────────────────────────────────────────────────────────

describe('buildQualityIssueTaskPlan — tags', () => {
  it('always includes issue-manager tag', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue());
    expect(plan.tags).toContain('issue-manager');
  });

  it('includes category in tags', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue({ category: 'test' }));
    expect(plan.tags).toContain('test');
  });

  it('includes source in tags', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue({ source: 'audit' }));
    expect(plan.tags).toContain('audit');
  });

  it('includes priority in tags', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue({ priority: 'critical' }));
    expect(plan.tags).toContain('critical');
  });
});

// ── statusNote ────────────────────────────────────────────────────────────────

describe('buildQualityIssueTaskPlan — statusNote', () => {
  it('returns generic statusNote when no alert provided', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue());
    expect(plan.statusNote).toContain('Issue Manager opened or refreshed');
  });

  it('includes alert message in statusNote when alert provided', () => {
    const plan = buildQualityIssueTaskPlan(
      baseIssue(),
      baseAlert({ message: 'critical alert fired' }),
    );
    expect(plan.statusNote).toContain('critical alert fired');
  });
});

// ── checklist ─────────────────────────────────────────────────────────────────

describe('buildQualityIssueTaskPlan — checklist', () => {
  it('returns default checklist for non-security issues', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue({ category: 'build' }));
    expect(plan.checklist).toHaveLength(4);
    expect(plan.checklist[0]).toContain('Verify');
  });

  it('returns security checklist for security issues', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue({ category: 'security', packageName: 'pkg' }));
    expect(plan.checklist.length).toBeGreaterThan(4);
    expect(plan.checklist.some((item) => item.includes('npm audit'))).toBe(true);
  });

  it('security checklist references fixVersion upgrade when fixVersion is set', () => {
    const plan = buildQualityIssueTaskPlan(
      baseIssue({ category: 'security', packageName: 'pkg', fixVersion: '2.0.0' }),
    );
    expect(plan.checklist.some((item) => item.includes('2.0.0'))).toBe(true);
  });

  it('security checklist uses mitigation wording when no fixVersion', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue({ category: 'security', packageName: 'pkg' }));
    expect(plan.checklist.some((item) => item.includes('no fixed version'))).toBe(true);
  });
});

// ── description ───────────────────────────────────────────────────────────────

describe('buildQualityIssueTaskPlan — description', () => {
  it('contains "Issue Manager Task" for default issues', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue());
    expect(plan.description).toContain('Issue Manager Task');
  });

  it('contains the issue title in description', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue({ title: 'Unique finding ABC' }));
    expect(plan.description).toContain('Unique finding ABC');
  });

  it('contains "Security Issue" for security category', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue({ category: 'security', packageName: 'pkg' }));
    expect(plan.description).toContain('Security Issue');
  });

  it('includes alert signal in description when alert is provided', () => {
    const plan = buildQualityIssueTaskPlan(
      baseIssue(),
      baseAlert({ title: 'Automation Alert', message: 'past target' }),
    );
    expect(plan.description).toContain('Automation Alert');
  });

  it('includes CVE in security description when provided', () => {
    const plan = buildQualityIssueTaskPlan(
      baseIssue({ category: 'security', packageName: 'pkg', cve: 'CVE-2025-9999' }),
    );
    expect(plan.description).toContain('CVE-2025-9999');
  });

  it('includes file location in default description when filePath provided', () => {
    const plan = buildQualityIssueTaskPlan(baseIssue({ filePath: 'src/app.ts', line: 42 }));
    expect(plan.description).toContain('src/app.ts:42');
  });

  it('truncates description at 5000 characters', () => {
    const longMessage = 'M'.repeat(6000);
    const plan = buildQualityIssueTaskPlan(baseIssue({ message: longMessage }));
    expect(plan.description.length).toBeLessThanOrEqual(5000);
  });
});
