import { describe, expect, it } from 'vitest';
import { ENDPOINTS } from '../constants';

describe('dashboard/constants', () => {
  it('ENDPOINTS has required keys', () => {
    expect(typeof ENDPOINTS.ADMIN_STATS).toBe('string');
    expect(typeof ENDPOINTS.TASKS_DUE_TODAY).toBe('string');
    expect(typeof ENDPOINTS.DASHBOARD_STATS).toBe('string');
  });

  it('all endpoint values start with /', () => {
    Object.values(ENDPOINTS).forEach((path) => {
      expect(path).toMatch(/^\//);
    });
  });

  it('ENDPOINTS has system activity and audit log paths', () => {
    expect(ENDPOINTS.SYSTEM_ACTIVITY).toBeDefined();
    expect(ENDPOINTS.ADMIN_AUDIT_LOG).toBeDefined();
  });
});
