import { describe, expect, it } from 'vitest';
import {
  AUTH_ROUTES,
  AUTH_ERRORS,
  USER_ROLES,
  DEFAULT_ROLE,
  SUPER_ADMIN_EMAIL,
  DEFAULT_ACCOUNT_TYPE,
  DEFAULT_ACCOUNT_STATUS,
} from '../constants';

describe('auth/constants', () => {
  it('AUTH_ROUTES has expected route keys', () => {
    expect(typeof AUTH_ROUTES.LOGIN).toBe('string');
    expect(typeof AUTH_ROUTES.DASHBOARD).toBe('string');
    expect(typeof AUTH_ROUTES.ADMIN).toBe('string');
  });

  it('AUTH_ROUTES paths start with /', () => {
    Object.values(AUTH_ROUTES).forEach((path) => {
      expect(path).toMatch(/^\//);
    });
  });

  it('AUTH_ERRORS has expected keys', () => {
    expect(typeof AUTH_ERRORS.DUPLICATE_EMAIL).toBe('string');
    expect(typeof AUTH_ERRORS.INVALID_CREDENTIALS).toBe('string');
    expect(typeof AUTH_ERRORS.UNAUTHORIZED).toBe('string');
  });

  it('USER_ROLES has client, admin, super_admin', () => {
    expect(USER_ROLES.CLIENT).toBe('client');
    expect(USER_ROLES.ADMIN).toBe('admin');
    expect(USER_ROLES.SUPER_ADMIN).toBe('super_admin');
  });

  it('DEFAULT_ROLE is client', () => {
    expect(DEFAULT_ROLE).toBe('client');
  });

  it('SUPER_ADMIN_EMAIL is a valid email', () => {
    expect(SUPER_ADMIN_EMAIL).toMatch(/@/);
  });

  it('DEFAULT_ACCOUNT_TYPE and DEFAULT_ACCOUNT_STATUS are strings', () => {
    expect(typeof DEFAULT_ACCOUNT_TYPE).toBe('string');
    expect(typeof DEFAULT_ACCOUNT_STATUS).toBe('string');
  });
});
