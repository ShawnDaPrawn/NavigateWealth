import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner@2.0.3';
import { securityService } from '../utils/auth/securityService';
import { 
  ActivityLogEntry, 
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
  
  const [securitySettings, setSecuritySettings] = useState<SecurityStatus>({
    twoFactorEnabled: false,
    twoFactorMethod: 'email',
    loginNotifications: true,
    passwordLastChanged: null
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

  return {
    isLoading,
    activityLoading,
    saveSuccess,
    passwordData,
    securitySettings,
    activityLogs,
    handlePasswordChange,
    updatePassword,
    toggleTwoFactor,
    verifyTwoFactorCode,
    sendTwoFactorCode,
    refreshLogs: fetchActivityLogs
  };
}