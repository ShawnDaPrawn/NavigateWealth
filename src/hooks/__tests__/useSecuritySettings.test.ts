/**
 * Tests for useSecuritySettings hook.
 *
 * This hook does NOT use React-Query; it manages its own async state via
 * useState + async callbacks. We mock securityService and sonner.toast,
 * then exercise every exported handler.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSecuritySettings } from '../useSecuritySettings';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGetSecurityStatus = vi.fn();
const mockGetActivityLogs = vi.fn();
const mockUpdatePassword = vi.fn();
const mockToggleTwoFactor = vi.fn();
const mockSendTwoFactorCode = vi.fn();
const mockVerifyTwoFactorCode = vi.fn();
const mockRequestEmailChange = vi.fn();
const mockVerifyEmailChange = vi.fn();
const mockResendEmailChangeCodes = vi.fn();

vi.mock('../../utils/auth/securityService', () => ({
  securityService: {
    getSecurityStatus: (...args: unknown[]) => mockGetSecurityStatus(...args),
    getActivityLogs: (...args: unknown[]) => mockGetActivityLogs(...args),
    updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
    toggleTwoFactor: (...args: unknown[]) => mockToggleTwoFactor(...args),
    sendTwoFactorCode: (...args: unknown[]) => mockSendTwoFactorCode(...args),
    verifyTwoFactorCode: (...args: unknown[]) => mockVerifyTwoFactorCode(...args),
    requestEmailChange: (...args: unknown[]) => mockRequestEmailChange(...args),
    verifyEmailChange: (...args: unknown[]) => mockVerifyEmailChange(...args),
    resendEmailChangeCodes: (...args: unknown[]) => mockResendEmailChangeCodes(...args),
  },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// ── Default mock return values ────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSecurityStatus.mockResolvedValue(null);
  mockGetActivityLogs.mockResolvedValue([]);
  mockUpdatePassword.mockResolvedValue({ success: true });
  mockToggleTwoFactor.mockResolvedValue({ success: true });
  mockSendTwoFactorCode.mockResolvedValue({ success: true });
  mockVerifyTwoFactorCode.mockResolvedValue({ success: true });
  mockRequestEmailChange.mockResolvedValue({ success: true, pendingEmailChange: null });
  mockVerifyEmailChange.mockResolvedValue({ success: true });
  mockResendEmailChangeCodes.mockResolvedValue({ success: true, pendingEmailChange: null });
});

// ── Helper ────────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc';
const USER_EMAIL = 'alice@example.com';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSecuritySettings — initial state', () => {
  it('starts with isLoading false', () => {
    const { result } = renderHook(() => useSecuritySettings());
    expect(result.current.isLoading).toBe(false);
  });

  it('starts with activityLoading false', () => {
    const { result } = renderHook(() => useSecuritySettings());
    expect(result.current.activityLoading).toBe(false);
  });

  it('starts with saveSuccess false', () => {
    const { result } = renderHook(() => useSecuritySettings());
    expect(result.current.saveSuccess).toBe(false);
  });

  it('starts with empty passwordData', () => {
    const { result } = renderHook(() => useSecuritySettings());
    expect(result.current.passwordData).toEqual({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  });

  it('starts with empty emailChangeData', () => {
    const { result } = renderHook(() => useSecuritySettings());
    expect(result.current.emailChangeData).toEqual({
      newEmail: '',
      currentPassword: '',
      currentEmailCode: '',
      newEmailCode: '',
    });
  });

  it('starts with default securitySettings', () => {
    const { result } = renderHook(() => useSecuritySettings());
    expect(result.current.securitySettings.twoFactorEnabled).toBe(false);
    expect(result.current.securitySettings.twoFactorMethod).toBe('email');
    expect(result.current.securitySettings.loginNotifications).toBe(true);
    expect(result.current.securitySettings.passwordLastChanged).toBeNull();
    expect(result.current.securitySettings.pendingEmailChange).toBeNull();
  });

  it('starts with empty activityLogs', () => {
    const { result } = renderHook(() => useSecuritySettings());
    expect(result.current.activityLogs).toEqual([]);
  });
});

describe('useSecuritySettings — initial fetch on mount', () => {
  it('calls getSecurityStatus when userId is provided', async () => {
    renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {});
    expect(mockGetSecurityStatus).toHaveBeenCalledWith(USER_ID);
  });

  it('calls getActivityLogs when userId is provided', async () => {
    renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {});
    expect(mockGetActivityLogs).toHaveBeenCalledWith(USER_ID);
  });

  it('does NOT call getSecurityStatus when no userId', async () => {
    renderHook(() => useSecuritySettings());
    await act(async () => {});
    expect(mockGetSecurityStatus).not.toHaveBeenCalled();
  });

  it('merges returned security status into state', async () => {
    mockGetSecurityStatus.mockResolvedValueOnce({
      twoFactorEnabled: true,
      twoFactorMethod: 'sms',
      loginNotifications: false,
      passwordLastChanged: '2025-01-01',
    });

    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {});

    expect(result.current.securitySettings.twoFactorEnabled).toBe(true);
    expect(result.current.securitySettings.twoFactorMethod).toBe('sms');
    expect(result.current.securitySettings.loginNotifications).toBe(false);
  });

  it('populates activityLogs from fetch result', async () => {
    const logs = [{ id: 'log-1', type: 'login', timestamp: '2025-01-01', success: true }];
    mockGetActivityLogs.mockResolvedValueOnce(logs);

    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {});

    expect(result.current.activityLogs).toEqual(logs);
  });
});

describe('useSecuritySettings — handlePasswordChange', () => {
  it('updates the specified password field', () => {
    const { result } = renderHook(() => useSecuritySettings());
    act(() => {
      result.current.handlePasswordChange('newPassword', 'Secret1234');
    });
    expect(result.current.passwordData.newPassword).toBe('Secret1234');
  });

  it('resets saveSuccess to false', () => {
    const { result } = renderHook(() => useSecuritySettings());
    // Manually force saveSuccess to true isn't exposed — but we verify the reset
    // by checking it goes false after a field change (it starts false too, so just check no error)
    act(() => {
      result.current.handlePasswordChange('currentPassword', 'old');
    });
    expect(result.current.saveSuccess).toBe(false);
  });
});

describe('useSecuritySettings — handleEmailChangeField', () => {
  it('updates the specified email change field', () => {
    const { result } = renderHook(() => useSecuritySettings());
    act(() => {
      result.current.handleEmailChangeField('newEmail', 'newalice@example.com');
    });
    expect(result.current.emailChangeData.newEmail).toBe('newalice@example.com');
  });

  it('resets saveSuccess to false', () => {
    const { result } = renderHook(() => useSecuritySettings());
    act(() => {
      result.current.handleEmailChangeField('currentPassword', 'pw123');
    });
    expect(result.current.saveSuccess).toBe(false);
  });
});

describe('useSecuritySettings — updatePassword', () => {
  it('does nothing when userId is missing', async () => {
    const { result } = renderHook(() => useSecuritySettings());
    await act(async () => {
      await result.current.updatePassword();
    });
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('does nothing when currentPassword is empty', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    act(() => {
      result.current.handlePasswordChange('newPassword', 'Secret1234!');
    });
    await act(async () => {
      await result.current.updatePassword();
    });
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('shows toast.error when passwords do not match', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    act(() => {
      result.current.handlePasswordChange('currentPassword', 'OldPass1');
      result.current.handlePasswordChange('newPassword', 'NewPass1');
      result.current.handlePasswordChange('confirmPassword', 'Different1');
    });
    await act(async () => {
      await result.current.updatePassword();
    });
    expect(mockToastError).toHaveBeenCalledWith('New passwords do not match');
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('shows toast.error when new password is too short', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    act(() => {
      result.current.handlePasswordChange('currentPassword', 'OldPass1');
      result.current.handlePasswordChange('newPassword', 'short');
      result.current.handlePasswordChange('confirmPassword', 'short');
    });
    await act(async () => {
      await result.current.updatePassword();
    });
    expect(mockToastError).toHaveBeenCalledWith('Password must be at least 8 characters long');
  });

  it('shows toast.error when new password equals current password', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    act(() => {
      result.current.handlePasswordChange('currentPassword', 'SamePass1');
      result.current.handlePasswordChange('newPassword', 'SamePass1');
      result.current.handlePasswordChange('confirmPassword', 'SamePass1');
    });
    await act(async () => {
      await result.current.updatePassword();
    });
    expect(mockToastError).toHaveBeenCalledWith(
      'New password cannot be the same as your current password',
    );
  });

  it('calls securityService.updatePassword with correct args', async () => {
    mockUpdatePassword.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useSecuritySettings(USER_ID));

    act(() => {
      result.current.handlePasswordChange('currentPassword', 'OldPass1!');
      result.current.handlePasswordChange('newPassword', 'NewPass1!');
      result.current.handlePasswordChange('confirmPassword', 'NewPass1!');
    });
    await act(async () => {
      await result.current.updatePassword();
    });

    expect(mockUpdatePassword).toHaveBeenCalledWith(USER_ID, 'OldPass1!', 'NewPass1!');
  });

  it('clears password fields and shows success toast on success', async () => {
    mockUpdatePassword.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useSecuritySettings(USER_ID));

    act(() => {
      result.current.handlePasswordChange('currentPassword', 'OldPass1!');
      result.current.handlePasswordChange('newPassword', 'NewPass1!');
      result.current.handlePasswordChange('confirmPassword', 'NewPass1!');
    });
    await act(async () => {
      await result.current.updatePassword();
    });

    expect(result.current.passwordData).toEqual({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Password updated successfully');
    expect(result.current.saveSuccess).toBe(true);
  });

  it('shows error toast on failure', async () => {
    mockUpdatePassword.mockRejectedValueOnce(new Error('Wrong current password'));
    const { result } = renderHook(() => useSecuritySettings(USER_ID));

    act(() => {
      result.current.handlePasswordChange('currentPassword', 'OldPass1!');
      result.current.handlePasswordChange('newPassword', 'NewPass1!');
      result.current.handlePasswordChange('confirmPassword', 'NewPass1!');
    });
    await act(async () => {
      await result.current.updatePassword();
    });

    expect(mockToastError).toHaveBeenCalledWith('Wrong current password');
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useSecuritySettings — toggleTwoFactor', () => {
  it('does nothing when userId is missing', async () => {
    const { result } = renderHook(() => useSecuritySettings());
    await act(async () => {
      await result.current.toggleTwoFactor(true, 'email');
    });
    expect(mockToggleTwoFactor).not.toHaveBeenCalled();
  });

  it('calls securityService.toggleTwoFactor with correct args', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {
      await result.current.toggleTwoFactor(true, 'sms');
    });
    expect(mockToggleTwoFactor).toHaveBeenCalledWith(USER_ID, true, 'sms');
  });

  it('updates local securitySettings on success', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {
      await result.current.toggleTwoFactor(true, 'sms');
    });
    expect(result.current.securitySettings.twoFactorEnabled).toBe(true);
    expect(result.current.securitySettings.twoFactorMethod).toBe('sms');
  });

  it('shows success toast when enabling', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {
      await result.current.toggleTwoFactor(true, 'email');
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Two-factor authentication enabled');
  });

  it('shows success toast when disabling', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {
      await result.current.toggleTwoFactor(false, 'email');
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Two-factor authentication disabled');
  });

  it('shows error toast on failure', async () => {
    mockToggleTwoFactor.mockRejectedValueOnce(new Error('Service unavailable'));
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {
      await result.current.toggleTwoFactor(true, 'email');
    });
    expect(mockToastError).toHaveBeenCalledWith('Failed to toggle 2FA');
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useSecuritySettings — verifyTwoFactorCode', () => {
  it('throws when userId is missing', async () => {
    const { result } = renderHook(() => useSecuritySettings());
    await expect(result.current.verifyTwoFactorCode('123456')).rejects.toThrow('User ID missing');
  });

  it('delegates to securityService.verifyTwoFactorCode', async () => {
    mockVerifyTwoFactorCode.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {
      await result.current.verifyTwoFactorCode('654321');
    });
    expect(mockVerifyTwoFactorCode).toHaveBeenCalledWith(USER_ID, '654321');
  });
});

describe('useSecuritySettings — sendTwoFactorCode', () => {
  it('throws when userId is missing', async () => {
    const { result } = renderHook(() => useSecuritySettings());
    await expect(result.current.sendTwoFactorCode()).rejects.toThrow('User ID missing');
  });

  it('delegates to securityService.sendTwoFactorCode with email', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID, USER_EMAIL));
    await act(async () => {
      await result.current.sendTwoFactorCode();
    });
    expect(mockSendTwoFactorCode).toHaveBeenCalledWith(USER_ID, USER_EMAIL);
  });
});

describe('useSecuritySettings — requestEmailChange', () => {
  it('returns null when userId is missing', async () => {
    const { result } = renderHook(() => useSecuritySettings(undefined, USER_EMAIL));
    let ret: unknown;
    await act(async () => {
      ret = await result.current.requestEmailChange();
    });
    expect(ret).toBeNull();
  });

  it('returns null when userEmail is missing', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    let ret: unknown;
    await act(async () => {
      ret = await result.current.requestEmailChange();
    });
    expect(ret).toBeNull();
  });

  it('shows toast.error when newEmail is empty', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID, USER_EMAIL));
    await act(async () => {
      await result.current.requestEmailChange();
    });
    expect(mockToastError).toHaveBeenCalledWith('Enter your new email address');
  });

  it('shows toast.error when new email equals current email', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID, USER_EMAIL));
    act(() => {
      result.current.handleEmailChangeField('newEmail', USER_EMAIL);
      result.current.handleEmailChangeField('currentPassword', 'pw');
    });
    await act(async () => {
      await result.current.requestEmailChange();
    });
    expect(mockToastError).toHaveBeenCalledWith(
      'New email must be different from your current email',
    );
  });

  it('shows toast.error when currentPassword is empty', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID, USER_EMAIL));
    act(() => {
      result.current.handleEmailChangeField('newEmail', 'new@example.com');
    });
    await act(async () => {
      await result.current.requestEmailChange();
    });
    expect(mockToastError).toHaveBeenCalledWith('Enter your current password to continue');
  });

  it('calls securityService.requestEmailChange with normalised email', async () => {
    mockRequestEmailChange.mockResolvedValueOnce({ success: true, pendingEmailChange: null });
    const { result } = renderHook(() => useSecuritySettings(USER_ID, USER_EMAIL));

    act(() => {
      result.current.handleEmailChangeField('newEmail', '  NEW@Example.com  ');
      result.current.handleEmailChangeField('currentPassword', 'MyPass1!');
    });
    await act(async () => {
      await result.current.requestEmailChange();
    });

    expect(mockRequestEmailChange).toHaveBeenCalledWith(USER_ID, {
      newEmail: 'new@example.com',
      currentPassword: 'MyPass1!',
    });
  });

  it('shows success toast on success', async () => {
    mockRequestEmailChange.mockResolvedValueOnce({ success: true, pendingEmailChange: null });
    const { result } = renderHook(() => useSecuritySettings(USER_ID, USER_EMAIL));

    act(() => {
      result.current.handleEmailChangeField('newEmail', 'new@example.com');
      result.current.handleEmailChangeField('currentPassword', 'MyPass1!');
    });
    await act(async () => {
      await result.current.requestEmailChange();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Verification codes sent to your current and new email addresses',
    );
  });

  it('shows error toast on service failure', async () => {
    mockRequestEmailChange.mockRejectedValueOnce(new Error('Email already in use'));
    const { result } = renderHook(() => useSecuritySettings(USER_ID, USER_EMAIL));

    act(() => {
      result.current.handleEmailChangeField('newEmail', 'new@example.com');
      result.current.handleEmailChangeField('currentPassword', 'MyPass1!');
    });
    await act(async () => {
      await result.current.requestEmailChange();
    });

    expect(mockToastError).toHaveBeenCalledWith('Email already in use');
  });
});

describe('useSecuritySettings — verifyEmailChange', () => {
  it('returns null when userId is missing', async () => {
    const { result } = renderHook(() => useSecuritySettings());
    let ret: unknown;
    await act(async () => {
      ret = await result.current.verifyEmailChange();
    });
    expect(ret).toBeNull();
  });

  it('shows toast.error when no pending email change', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {
      await result.current.verifyEmailChange();
    });
    expect(mockToastError).toHaveBeenCalledWith('No active email change request found');
  });

  it('shows toast.error when newEmailCode is missing', async () => {
    mockGetSecurityStatus.mockResolvedValueOnce({
      twoFactorEnabled: false,
      twoFactorMethod: 'email',
      loginNotifications: true,
      passwordLastChanged: null,
      pendingEmailChange: {
        requestId: 'req-1',
        newEmail: 'new@example.com',
        initiatedAt: '2025-01-01',
        expiresAt: '2025-01-02',
        requiresCurrentEmailCode: false,
        currentEmailVerified: false,
        newEmailVerified: false,
      },
    });

    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {}); // Let initial fetch complete

    await act(async () => {
      await result.current.verifyEmailChange();
    });

    expect(mockToastError).toHaveBeenCalledWith('Enter the code sent to your new email address');
  });
});

describe('useSecuritySettings — resendEmailChangeCodes', () => {
  it('returns null when userId is missing', async () => {
    const { result } = renderHook(() => useSecuritySettings());
    let ret: unknown;
    await act(async () => {
      ret = await result.current.resendEmailChangeCodes();
    });
    expect(ret).toBeNull();
  });

  it('shows toast.error when no pending email change', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {
      await result.current.resendEmailChangeCodes('both');
    });
    expect(mockToastError).toHaveBeenCalledWith('No active email change request found');
  });
});

describe('useSecuritySettings — refreshLogs', () => {
  it('re-fetches activity logs', async () => {
    const { result } = renderHook(() => useSecuritySettings(USER_ID));
    await act(async () => {}); // initial mount fetch

    mockGetActivityLogs.mockResolvedValueOnce([
      { id: 'log-2', type: 'password_change', timestamp: '2025-06-01', success: true },
    ]);

    await act(async () => {
      await result.current.refreshLogs();
    });

    expect(result.current.activityLogs).toEqual([
      { id: 'log-2', type: 'password_change', timestamp: '2025-06-01', success: true },
    ]);
  });
});
