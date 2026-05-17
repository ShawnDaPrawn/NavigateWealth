import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner@2.0.3';
import { securityService } from '../utils/auth/securityService';
import { 
  ActivityLogEntry, 
  EmailChangeRequestData,
  SecurityStatus, 
  TwoFactorMethod,
  PasswordUpdateData 
} from '../utils/auth/securityTypes';

export function useSecuritySettings(userId?: string, userEmail?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [passwordData, setPasswordData] = useState<PasswordUpdateData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [emailChangeData, setEmailChangeData] = useState<EmailChangeRequestData>({
    newEmail: '',
    currentPassword: '',
    currentEmailCode: '',
    newEmailCode: ''
  });
  
  const [securitySettings, setSecuritySettings] = useState<SecurityStatus>({
    twoFactorEnabled: false,
    twoFactorMethod: 'email',
    loginNotifications: true,
    passwordLastChanged: null,
    pendingEmailChange: null,
  });

  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);

  const fetchSecurityStatus = useCallback(async () => {
    if (!userId) return;
    const status = await securityService.getSecurityStatus(userId);
    if (status) {
      setSecuritySettings(prev => ({ ...prev, ...status }));
    }
  }, [userId]);

  const fetchActivityLogs = useCallback(async () => {
    if (!userId) return;
    setActivityLoading(true);
    const logs = await securityService.getActivityLogs(userId);
    setActivityLogs(logs);
    setActivityLoading(false);
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchSecurityStatus();
      fetchActivityLogs();
    }
  }, [userId, fetchSecurityStatus, fetchActivityLogs]);

  const handlePasswordChange = (field: keyof PasswordUpdateData, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  };

  const handleEmailChangeField = (field: keyof EmailChangeRequestData, value: string) => {
    setEmailChangeData(prev => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  };

  const updatePassword = async () => {
    if (!userId) return;
    if (!passwordData.currentPassword || !passwordData.newPassword) return;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      toast.error('New password cannot be the same as your current password');
      return;
    }

    setIsLoading(true);
    try {
      await securityService.updatePassword(userId, passwordData.currentPassword, passwordData.newPassword);
      
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      toast.success('Password updated successfully');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Refresh data
      fetchActivityLogs();
      fetchSecurityStatus();
    } catch (error) {
      console.error('❌ Failed to update password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTwoFactor = async (enabled: boolean, method: TwoFactorMethod) => {
    if (!userId) return;
    setIsLoading(true);
    try {
      await securityService.toggleTwoFactor(userId, enabled, method);
      
      setSecuritySettings(prev => ({
        ...prev,
        twoFactorEnabled: enabled,
        twoFactorMethod: method
      }));
      
      toast.success(`Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`);
      fetchActivityLogs();
    } catch (error) {
      console.error('❌ Failed to toggle 2FA:', error);
      toast.error('Failed to toggle 2FA');
      // Revert state on failure if needed, but we're relying on fetch to sync
      fetchSecurityStatus(); 
    } finally {
      setIsLoading(false);
    }
  };

  const verifyTwoFactorCode = async (code: string) => {
    if (!userId) throw new Error('User ID missing');
    return await securityService.verifyTwoFactorCode(userId, code);
  };

  const sendTwoFactorCode = async () => {
    if (!userId) throw new Error('User ID missing');
    return await securityService.sendTwoFactorCode(userId, userEmail);
  };

  const requestEmailChange = async () => {
    if (!userId || !userEmail) return null;

    const normalizedNewEmail = emailChangeData.newEmail.trim().toLowerCase();
    const normalizedCurrentEmail = userEmail.trim().toLowerCase();

    if (!normalizedNewEmail) {
      toast.error('Enter your new email address');
      return null;
    }

    if (normalizedNewEmail === normalizedCurrentEmail) {
      toast.error('New email must be different from your current email');
      return null;
    }

    if (!emailChangeData.currentPassword) {
      toast.error('Enter your current password to continue');
      return null;
    }

    setIsLoading(true);
    try {
      const result = await securityService.requestEmailChange(userId, {
        newEmail: normalizedNewEmail,
        currentPassword: emailChangeData.currentPassword,
      });

      setSecuritySettings(prev => ({
        ...prev,
        pendingEmailChange: result.pendingEmailChange ?? null,
      }));
      setEmailChangeData(prev => ({
        ...prev,
        currentPassword: '',
        currentEmailCode: '',
        newEmailCode: '',
      }));
      toast.success('Verification codes sent to your current and new email addresses');
      fetchActivityLogs();
      return result;
    } catch (error) {
      console.error('❌ Failed to start email change:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start email change');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmailChange = async () => {
    if (!userId) return null;

    const pendingEmailChange = securitySettings.pendingEmailChange;
    if (!pendingEmailChange) {
      toast.error('No active email change request found');
      return null;
    }

    if (!emailChangeData.newEmailCode) {
      toast.error('Enter the code sent to your new email address');
      return null;
    }

    if (pendingEmailChange.requiresCurrentEmailCode && !pendingEmailChange.currentEmailVerified && !emailChangeData.currentEmailCode) {
      toast.error('Enter the code sent to your current email address');
      return null;
    }

    setIsLoading(true);
    try {
      const result = await securityService.verifyEmailChange(userId, {
        requestId: pendingEmailChange.requestId,
        currentEmailCode: emailChangeData.currentEmailCode || undefined,
        newEmailCode: emailChangeData.newEmailCode,
      });

      setSecuritySettings(prev => ({
        ...prev,
        pendingEmailChange: null,
      }));
      setEmailChangeData({
        newEmail: '',
        currentPassword: '',
        currentEmailCode: '',
        newEmailCode: '',
      });
      fetchActivityLogs();
      fetchSecurityStatus();
      return result;
    } catch (error) {
      console.error('❌ Failed to verify email change:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to verify email change');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const resendEmailChangeCodes = async (target: 'current' | 'new' | 'both' = 'both') => {
    if (!userId) return null;
    const pendingEmailChange = securitySettings.pendingEmailChange;
    if (!pendingEmailChange) {
      toast.error('No active email change request found');
      return null;
    }

    setIsLoading(true);
    try {
      const result = await securityService.resendEmailChangeCodes(userId, {
        requestId: pendingEmailChange.requestId,
        target,
      });

      setSecuritySettings(prev => ({
        ...prev,
        pendingEmailChange: result.pendingEmailChange ?? prev.pendingEmailChange ?? null,
      }));
      toast.success('Verification code resent');
      return result;
    } catch (error) {
      console.error('❌ Failed to resend email change codes:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to resend verification code');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    activityLoading,
    saveSuccess,
    passwordData,
    emailChangeData,
    securitySettings,
    activityLogs,
    handlePasswordChange,
    handleEmailChangeField,
    updatePassword,
    toggleTwoFactor,
    verifyTwoFactorCode,
    sendTwoFactorCode,
    requestEmailChange,
    verifyEmailChange,
    resendEmailChangeCodes,
    refreshLogs: fetchActivityLogs
  };
}
