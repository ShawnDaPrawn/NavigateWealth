import { describe, expect, it } from 'vitest';
import { isSuppressedRuntimeIssue, shouldDropLoopbackReport } from '../runtimeNoise';

describe('isSuppressedRuntimeIssue', () => {
  it('drops stale chunks, loopback previews, expected auth, and bare network blips', () => {
    expect(
      isSuppressedRuntimeIssue({
        message: "Cannot read properties of undefined (reading 'ClientGroupsTab')",
        title: 'Handled error',
      }),
    ).toBe(true);
    expect(
      isSuppressedRuntimeIssue({
        message: "Cannot read properties of undefined (reading 'default')",
        title: 'Handled error',
      }),
    ).toBe(true);
    expect(
      isSuppressedRuntimeIssue({
        message: "Cannot read properties of undefined (reading 'map')",
        details: 'URL: http://localhost:4173/',
      }),
    ).toBe(true);
    expect(
      isSuppressedRuntimeIssue({
        message: 'Invalid credentials',
        title: 'Handled error: Invalid credentials',
      }),
    ).toBe(true);
    expect(
      isSuppressedRuntimeIssue({
        message: 'Cannot open Ask Vasco for staff accounts',
        ruleId: 'handled-error',
      }),
    ).toBe(true);
    expect(
      isSuppressedRuntimeIssue({
        ruleId: 'api-failure',
        message: 'Failed to fetch',
        title: 'GET /admin/stats failed: Network request failed',
      }),
    ).toBe(true);
  });

  it('keeps a gateway timeout and a validation failure', () => {
    expect(
      isSuppressedRuntimeIssue({
        ruleId: 'api-failure',
        message: 'POST /vasco/index returned 546',
        title: 'POST /vasco/index failed (546)',
      }),
    ).toBe(false);
    expect(
      isSuppressedRuntimeIssue({
        ruleId: 'handled-error',
        message: 'Validation failed',
        title: 'Save fields: Validation failed',
      }),
    ).toBe(false);
    expect(
      isSuppressedRuntimeIssue({
        ruleId: 'handled-error',
        message: 'Network error. Please check your connection.',
        title: 'Failed to publish',
      }),
    ).toBe(false);
  });
});

describe('shouldDropLoopbackReport', () => {
  it('drops production reports from a loopback host only', () => {
    expect(shouldDropLoopbackReport(true, 'localhost')).toBe(true);
    expect(shouldDropLoopbackReport(true, '127.0.0.1')).toBe(true);
    expect(shouldDropLoopbackReport(true, '[::1]')).toBe(true);
    expect(shouldDropLoopbackReport(false, 'localhost')).toBe(false);
    expect(shouldDropLoopbackReport(true, 'www.navigatewealth.co')).toBe(false);
  });
});
