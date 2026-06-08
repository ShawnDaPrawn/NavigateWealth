import { describe, expect, it } from 'vitest';
import {
  SECURITY_API_ENDPOINTS,
  PASSWORD_REQUIREMENTS,
  CONTACT_INFO,
  SECURITY_COLORS,
} from '../securityConstants';

describe('auth/securityConstants', () => {
  it('SECURITY_API_ENDPOINTS functions return correct URL patterns', () => {
    const uid = 'user-123';
    expect(SECURITY_API_ENDPOINTS.STATUS(uid)).toBe(`/security/${uid}/status`);
    expect(SECURITY_API_ENDPOINTS.ACTIVITY(uid)).toBe(`/security/${uid}/activity`);
    expect(SECURITY_API_ENDPOINTS.PASSWORD(uid)).toBe(`/security/${uid}/password`);
    expect(SECURITY_API_ENDPOINTS.TWO_FACTOR(uid)).toBe(`/security/${uid}/2fa`);
    expect(SECURITY_API_ENDPOINTS.VERIFY_CODE(uid)).toBe(`/security/${uid}/2fa/verify-code`);
    expect(SECURITY_API_ENDPOINTS.SEND_CODE(uid)).toBe(`/security/${uid}/2fa/send-code`);
  });

  it('SECURITY_API_ENDPOINTS email change endpoints use correct paths', () => {
    const uid = 'abc';
    expect(SECURITY_API_ENDPOINTS.EMAIL_CHANGE_REQUEST(uid)).toContain('email-change/request');
    expect(SECURITY_API_ENDPOINTS.EMAIL_CHANGE_VERIFY(uid)).toContain('email-change/verify');
    expect(SECURITY_API_ENDPOINTS.EMAIL_CHANGE_RESEND(uid)).toContain('email-change/resend');
  });

  it('PASSWORD_REQUIREMENTS has MIN_LENGTH >= 8', () => {
    expect(PASSWORD_REQUIREMENTS.MIN_LENGTH).toBeGreaterThanOrEqual(8);
    expect(typeof PASSWORD_REQUIREMENTS.MIN_STRENGTH).toBe('number');
  });

  it('CONTACT_INFO has support email and phone', () => {
    expect(CONTACT_INFO.SUPPORT_EMAIL).toMatch(/@/);
    expect(CONTACT_INFO.PHONE).toBeTruthy();
    expect(CONTACT_INFO.PHONE_HREF).toMatch(/^tel:/);
  });

  it('SECURITY_COLORS has PRIMARY as a hex string', () => {
    expect(SECURITY_COLORS.PRIMARY).toMatch(/^#/);
    expect(SECURITY_COLORS.PRIMARY_HOVER).toMatch(/^#/);
  });
});
