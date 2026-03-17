import React, { useState, useEffect } from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../../../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/alert';
import { Switch } from '../../../../ui/switch';
import { Separator } from '../../../../ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Checkbox } from '../../../../ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { ActivityLogTable } from '../../../ActivityLogTable';
import {
  Shield,
  Lock,
  Key,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Ban,
  CheckCircle2,
  RefreshCw,
  Activity,
  Info,
  UserX,
  UserCheck,
  Smartphone,
  Eye,
  EyeOff
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../../../../auth/AuthContext';

interface SecurityTabProps {
  selectedClient: { id: string; firstName: string; lastName: string; email: string; accountStatus?: string };
}

interface SecurityStatus {
  suspended: boolean;
  suspendedAt?: string;
  suspendedBy?: string;
  suspendedReason?: string;
  deleted?: boolean;
  deletedAt?: string;
  closedBy?: string;
  closureReason?: string;
  twoFactorEnabled: boolean;
  passwordLastChanged?: string;
}

interface ActivityLogEntry {
  id: string;
  type: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export function SecurityTab({ selectedClient }: SecurityTabProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    suspended: false,
    twoFactorEnabled: false
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [unsuspendDialogOpen, setUnsuspendDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [emailPasswordToClient, setEmailPasswordToClient] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (selectedClient?.id) {
      fetchSecurityStatus();
      fetchActivityLogs();
    }
  }, [selectedClient?.id]);

  const fetchSecurityStatus = async () => {
    if (!selectedClient?.id) return;

    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${selectedClient.id}/status`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch security status');
      }

      const data = await response.json();
      if (data.success && data.status) {
        setSecurityStatus(data.status);
      }
    } catch (error) {
      console.error('❌ Error fetching security status:', error);
      toast.error('Failed to load security status');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    if (!selectedClient?.id) return;

    try {
      setActivityLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${selectedClient.id}/activity?limit=50`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch activity logs');
      }

      const data = await response.json();
      if (data.success) {
        setActivityLogs(data.logs || []);
      }
    } catch (error) {
      console.error('❌ Error fetching activity logs:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleSuspendAccount = async () => {
    if (!selectedClient?.id || !user?.id) return;

    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${selectedClient.id}/suspend`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            suspended: true,
            reason: suspensionReason,
            adminId: user.id
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to suspend account');
      }

      setSecurityStatus(data.status);
      toast.success('Account suspended successfully');
      setSuspendDialogOpen(false);
      setSuspensionReason('');
      
      // Refresh activity logs
      fetchActivityLogs();
    } catch (error) {
      console.error('❌ Failed to suspend account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to suspend account');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsuspendAccount = async () => {
    if (!selectedClient?.id || !user?.id) return;

    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${selectedClient.id}/suspend`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            suspended: false,
            adminId: user.id
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to unsuspend account');
      }

      setSecurityStatus(data.status);
      toast.success('Account unsuspended successfully');
      setUnsuspendDialogOpen(false);
      
      // Refresh activity logs
      fetchActivityLogs();
    } catch (error) {
      console.error('❌ Failed to unsuspend account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to unsuspend account');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedClient?.id || !newPassword) return;

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${selectedClient.id}/password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            currentPassword: 'admin-override',
            newPassword: newPassword,
            emailPassword: emailPasswordToClient
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to reset password');
      }

      toast.success('Password reset successfully');
      setResetPasswordDialogOpen(false);
      setNewPassword('');
      setShowPassword(false);
      
      // Refresh activity logs and status
      fetchActivityLogs();
      fetchSecurityStatus();
    } catch (error) {
      console.error('❌ Failed to reset password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle2FA = async (enabled: boolean) => {
    if (!selectedClient?.id) return;

    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${selectedClient.id}/2fa`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            enabled,
            method: 'email'
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to toggle 2FA');
      }

      setSecurityStatus(data.status);
      toast.success(`Two-factor authentication ${enabled ? 'enabled' : 'disabled'} for ${selectedClient.firstName} ${selectedClient.lastName}`);
      
      // Refresh activity logs
      fetchActivityLogs();
    } catch (error) {
      console.error('❌ Failed to toggle 2FA:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to toggle 2FA');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  if (!selectedClient) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Select a client to view their security settings
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium tracking-tight">Security Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage security settings for {selectedClient.firstName} {selectedClient.lastName}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchSecurityStatus();
            fetchActivityLogs();
          }}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Account Status Alert */}
      {securityStatus.suspended && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Account Suspended</AlertTitle>
          <AlertDescription>
             This account was suspended by admin on {formatDate(securityStatus.suspendedAt)}. 
             Reason: {securityStatus.suspendedReason || 'No reason provided'}
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Account Status
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {securityStatus.suspended ? 'Suspended' : 'Active'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {securityStatus.suspended 
                ? 'Access is currently restricted' 
                : 'Full access granted'
              }
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              2FA Status
            </CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {securityStatus.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {securityStatus.twoFactorEnabled 
                ? 'Via email verification' 
                : 'Standard security only'
              }
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Password Age
            </CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDate(securityStatus.passwordLastChanged)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last updated
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Administrator Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Administrator Actions</CardTitle>
          <CardDescription>
            Perform sensitive administrative tasks for this client account.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          
          {/* Action Row: Suspend/Unsuspend */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-muted rounded-full shrink-0">
                <Ban className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium leading-none">Suspend Account</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Temporarily disable the client's access to the platform.
                </p>
              </div>
            </div>
            <Button
               variant={securityStatus.suspended ? "outline" : "destructive"}
               onClick={() => securityStatus.suspended ? setUnsuspendDialogOpen(true) : setSuspendDialogOpen(true)}
               disabled={loading}
               className="shrink-0"
            >
              {securityStatus.suspended ? "Unsuspend Access" : "Suspend Access"}
            </Button>
          </div>

          <Separator />

          {/* Action Row: Reset Password */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-muted rounded-full shrink-0">
                <Key className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium leading-none">Reset Password</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Force a password reset for the client's next login.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(true)} className="shrink-0">
              Reset Password
            </Button>
          </div>

          <Separator />

          {/* Action Row: 2FA */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
               <div className="p-2 bg-muted rounded-full shrink-0">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium leading-none">Two-Factor Authentication (Email)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  When enabled, a verification code is sent to the client's registered email address at login. Only email-based 2FA is currently supported.
                </p>
              </div>
            </div>
            <Switch
              checked={!!securityStatus.twoFactorEnabled}
              onCheckedChange={handleToggle2FA}
              disabled={loading}
              className="shrink-0"
            />
          </div>

        </CardContent>
      </Card>

      {/* Activity Log */}
      <ActivityLogTable 
        logs={activityLogs}
        isLoading={activityLoading}
        title="Security Audit Log"
        description="Detailed history of security-related events for this account."
      />

      {/* Dialogs */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Suspend Client Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to suspend {selectedClient.firstName} {selectedClient.lastName}'s account?
              They will not be able to log in until the account is unsuspended.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Suspension</Label>
              <Textarea
                id="reason"
                placeholder="Enter the reason for suspending this account..."
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSuspendDialogOpen(false);
                setSuspensionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspendAccount}
              disabled={loading || !suspensionReason.trim()}
            >
              {loading ? (
                <div className="contents">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Suspending...
                </div>
              ) : (
                <div className="contents">
                  <Ban className="h-4 w-4 mr-2" />
                  Suspend Account
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={unsuspendDialogOpen} onOpenChange={setUnsuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsuspend Client Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore access for {selectedClient.firstName} {selectedClient.lastName}?
              They will be able to log in immediately after unsuspension.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnsuspendAccount}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <div className="contents">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Unsuspending...
                </div>
              ) : (
                <div className="contents">
                  <UserCheck className="h-4 w-4 mr-2" />
                  Unsuspend Account
                </div>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Client Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedClient.firstName} {selectedClient.lastName}.
              Make sure to securely communicate this password to the client.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password (min 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="sr-only">Toggle password visibility</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters long
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="emailPassword" 
                checked={emailPasswordToClient}
                onCheckedChange={(checked) => setEmailPasswordToClient(checked as boolean)}
              />
              <Label htmlFor="emailPassword" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Email new password to client
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetPasswordDialogOpen(false);
                setNewPassword('');
                setShowPassword(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={loading || newPassword.length < 8}
            >
              {loading ? (
                <div className="contents">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </div>
              ) : (
                <div className="contents">
                  <Key className="h-4 w-4 mr-2" />
                  Reset Password
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}