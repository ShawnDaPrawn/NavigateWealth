export interface ActivityLogEntry {
  id: string;
  type: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export type TwoFactorMethod = 'email' | 'sms';

export interface SecurityStatus {
  twoFactorEnabled: boolean;
  twoFactorMethod: TwoFactorMethod; // Default to 'email' if not set
  loginNotifications: boolean;
  passwordLastChanged: string | null;
  pendingEmailChange?: PendingEmailChangeSummary | null;
}

export interface PasswordUpdateData {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export interface PendingEmailChangeSummary {
  requestId: string;
  newEmail: string;
  initiatedAt: string;
  expiresAt: string;
  requiresCurrentEmailCode: boolean;
  currentEmailVerified: boolean;
  newEmailVerified: boolean;
}

export interface EmailChangeRequestData {
  newEmail: string;
  currentPassword: string;
  currentEmailCode: string;
  newEmailCode: string;
}

export interface TwoFactorToggleData {
  enabled: boolean;
  method: TwoFactorMethod;
}

export interface SecurityState {
  isLoading: boolean;
  activityLoading: boolean;
  saveSuccess: boolean;
  passwordData: PasswordUpdateData;
  settings: SecurityStatus;
  activityLogs: ActivityLogEntry[];
}
