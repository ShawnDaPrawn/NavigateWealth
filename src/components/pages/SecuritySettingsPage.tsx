/**
 * SecuritySettingsPage
 *
 * Client portal security settings — password management, 2FA, and activity log.
 * Follows the portal page pattern established by ProfilePage: PortalPageHeader,
 * sidebar section nav (desktop) / select dropdown (mobile), section-based content.
 *
 * Guidelines refs: §7 (presentation layer), §8.1 (existing UI standards),
 * §8.3 (stat cards, status indicators), §8.4 (AI builder / Figma Make)
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ActivityLogTable } from '../admin/ActivityLogTable';
import { TwoFactorModal } from '../auth/TwoFactorModal';
import { useSecuritySettings } from '../../hooks/useSecuritySettings';
import { PortalPageHeader } from '../portal/PortalPageHeader';
import { ACTIVE_THEME } from '../portal/portal-theme';
import {
  Shield,
  Lock,
  Smartphone,
  Eye,
  EyeOff,
  Save,
  Key,
  Info,
  Mail,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

// ── Section Navigation ────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'activity', label: 'System Activity', icon: Clock },
  { id: 'password', label: 'Change Password', icon: Lock },
  { id: 'two-factor', label: 'Two-Factor Auth', icon: Key },
] as const;

type SectionId = (typeof NAV_ITEMS)[number]['id'];

// ── Password Strength ─────────────────────────────────────────────────────────

function getPasswordStrength(password: string) {
  if (!password) return { strength: 0, label: '', color: '', textColor: '' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { strength: 33, label: 'Weak', color: 'bg-red-500', textColor: 'text-red-600' };
  if (score <= 3) return { strength: 66, label: 'Medium', color: 'bg-amber-500', textColor: 'text-amber-600' };
  return { strength: 100, label: 'Strong', color: 'bg-green-500', textColor: 'text-green-600' };
}

function formatLastChanged(date: string | null): string {
  if (!date) return 'Never';
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// ── Security Score ────────────────────────────────────────────────────────────

function computeSecurityScore(twoFactorEnabled: boolean, passwordLastChanged: string | null): number {
  let score = 40; // base score for having an account with a password
  if (twoFactorEnabled) score += 35;
  if (passwordLastChanged) {
    const daysSinceChange = Math.floor(
      (Date.now() - new Date(passwordLastChanged).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceChange < 90) score += 25;
    else if (daysSinceChange < 180) score += 15;
    else score += 5;
  }
  return Math.min(score, 100);
}

function getScoreConfig(score: number) {
  if (score >= 80) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-500', ringColor: 'stroke-green-500' };
  if (score >= 60) return { label: 'Good', color: 'text-amber-600', bg: 'bg-amber-500', ringColor: 'stroke-amber-500' };
  return { label: 'Needs Attention', color: 'text-red-600', bg: 'bg-red-500', ringColor: 'stroke-red-500' };
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SecuritySettingsPage() {
  const { user } = useAuth();
  const {
    isLoading,
    activityLoading,
    passwordData,
    securitySettings,
    activityLogs,
    handlePasswordChange,
    updatePassword,
    toggleTwoFactor,
    verifyTwoFactorCode,
    sendTwoFactorCode,
  } = useSecuritySettings(user?.id, user?.email);

  const [activeSection, setActiveSection] = useState<SectionId>('activity');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);

  const passwordStrength = getPasswordStrength(passwordData.newPassword || '');

  const securityScore = useMemo(
    () => computeSecurityScore(securitySettings.twoFactorEnabled, securitySettings.passwordLastChanged),
    [securitySettings.twoFactorEnabled, securitySettings.passwordLastChanged]
  );
  const scoreConfig = getScoreConfig(securityScore);

  // ── 2FA Handlers ──────────────────────────────────────────────────────────
  const handleEnable2FAClick = () => {
    if (securitySettings.twoFactorEnabled) {
      toggleTwoFactor(false, securitySettings.twoFactorMethod);
    } else {
      sendTwoFactorCode();
      setShow2FAModal(true);
    }
  };

  const on2FAVerified = () => {
    toggleTwoFactor(true, securitySettings.twoFactorMethod);
    setShow2FAModal(false);
  };

  // ── Circumference for SVG ring (radius = 40) ─────────────────────────────
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (securityScore / 100) * circumference;

  return (
    <div className={`min-h-screen ${ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'}`}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <PortalPageHeader
        title="Security Settings"
        subtitle="Manage your account security, password, and authentication"
        icon={Shield}
        compact
      />

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* ── Sidebar (Desktop) ──────────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 z-10 hidden lg:block space-y-4">
              <Card className="border-gray-200">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold text-gray-900">Navigation</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <nav className="space-y-0.5">
                    {NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveSection(item.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-[13px] transition-colors ${
                            activeSection === item.id
                              ? 'bg-[#6d28d9]/10 text-[#6d28d9] border-r-2 border-[#6d28d9] font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </CardContent>
              </Card>

              {/* Security Score Card (Desktop) */}
              <Card className="border-gray-200">
                <CardContent className="pt-6 pb-5 flex flex-col items-center">
                  <div className="relative w-24 h-24 mb-3">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                      <circle cx="48" cy="48" r="40" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                      <circle
                        cx="48" cy="48" r="40" fill="none"
                        className={scoreConfig.ringColor}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-gray-900">{securityScore}</span>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${scoreConfig.color}`}>{scoreConfig.label}</p>
                  <p className="text-xs text-gray-500 mt-1 text-center">Security Score</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Mobile Section Selector ─────────────────────────────────── */}
          <div className="lg:hidden">
            <Select value={activeSection} onValueChange={(v) => setActiveSection(v as SectionId)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {NAV_ITEMS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Main Content ────────────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-6">

            {/* ════════════════════ SYSTEM ACTIVITY ════════════════════ */}
            {activeSection === 'activity' && (
              <div className="space-y-6">
                {/* Security Score (Mobile only — desktop score lives in sidebar) */}
                <Card className="lg:hidden border-gray-200">
                  <CardContent className="py-5 flex items-center gap-5">
                    <div className="relative w-20 h-20 flex-shrink-0">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 96 96">
                        <circle cx="48" cy="48" r="40" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                        <circle
                          cx="48" cy="48" r="40" fill="none"
                          className={scoreConfig.ringColor}
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-bold text-gray-900">{securityScore}</span>
                      </div>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${scoreConfig.color}`}>{scoreConfig.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Security Score</p>
                    </div>
                  </CardContent>
                </Card>

                <ActivityLogTable
                  logs={activityLogs}
                  isLoading={activityLoading}
                  title="Account Activity"
                  description="Recent security events and login history"
                />
              </div>
            )}

            {/* ════════════════════ CHANGE PASSWORD ════════════════════ */}
            {activeSection === 'password' && (
              <Card className="border-gray-200">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center">
                      <Lock className="h-5 w-5 text-[#6d28d9]" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-gray-900">Change Password</CardTitle>
                      <CardDescription className="text-sm text-gray-500">Update your password to keep your account secure</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Current Password */}
                  <div className="max-w-md">
                    <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700">Current Password</Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                        placeholder="Enter your current password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Separator />

                  {/* New + Confirm */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">New Password</Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="newPassword"
                          type={showNewPassword ? 'text' : 'password'}
                          value={passwordData.newPassword}
                          onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                          placeholder="Enter new password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm New Password</Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={passwordData.confirmPassword}
                          onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                          placeholder="Confirm new password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password Strength */}
                  {passwordData.newPassword && (
                    <div className="space-y-2 p-4 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">Password Strength</span>
                        <span className={`text-xs font-semibold ${passwordStrength.textColor}`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: `${passwordStrength.strength}%` }}
                        />
                      </div>
                      <ul className="text-xs text-gray-500 space-y-0.5 mt-1">
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className={`h-3 w-3 flex-shrink-0 ${(passwordData.newPassword?.length ?? 0) >= 8 ? 'text-green-500' : 'text-gray-300'}`} />
                          At least 8 characters
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className={`h-3 w-3 flex-shrink-0 ${/[a-z]/.test(passwordData.newPassword || '') && /[A-Z]/.test(passwordData.newPassword || '') ? 'text-green-500' : 'text-gray-300'}`} />
                          Upper and lower case letters
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className={`h-3 w-3 flex-shrink-0 ${/[0-9]/.test(passwordData.newPassword || '') ? 'text-green-500' : 'text-gray-300'}`} />
                          At least one number
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className={`h-3 w-3 flex-shrink-0 ${/[^a-zA-Z0-9]/.test(passwordData.newPassword || '') ? 'text-green-500' : 'text-gray-300'}`} />
                          At least one special character
                        </li>
                      </ul>
                    </div>
                  )}

                  {/* Password Mismatch Warning */}
                  {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-sm text-red-700">
                        Passwords do not match.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-gray-500">
                      Last changed: {formatLastChanged(securitySettings.passwordLastChanged)}
                    </p>
                    <Button
                      onClick={updatePassword}
                      disabled={
                        isLoading ||
                        !passwordData.currentPassword ||
                        !passwordData.newPassword ||
                        !passwordData.confirmPassword ||
                        passwordData.newPassword !== passwordData.confirmPassword
                      }
                      className="bg-[#6d28d9] hover:bg-[#5b21b6] text-white"
                    >
                      {isLoading ? (
                        <div className="contents">
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Updating...
                        </div>
                      ) : (
                        <div className="contents">
                          <Save className="h-4 w-4 mr-2" />
                          Update Password
                        </div>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ════════════════════ TWO-FACTOR AUTH ════════════════════ */}
            {activeSection === 'two-factor' && (
              <Card className="border-gray-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center">
                        <Key className="h-5 w-5 text-[#6d28d9]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-semibold text-gray-900">Two-Factor Authentication</CardTitle>
                          {securitySettings.twoFactorEnabled && (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-sm text-gray-500">Add an extra layer of security to your account</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert className="border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-800">
                      A one-time verification code will be sent to your email each time you sign in from a new device. We currently support 2FA via email only.
                    </AlertDescription>
                  </Alert>

                  {/* Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                        securitySettings.twoFactorEnabled ? 'bg-green-100' : 'bg-gray-200'
                      }`}>
                        {securitySettings.twoFactorEnabled
                          ? <ShieldCheck className="h-4.5 w-4.5 text-green-600" />
                          : <ShieldAlert className="h-4.5 w-4.5 text-gray-500" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Enable Two-Factor Authentication</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Verification sent to {user?.email}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={securitySettings.twoFactorEnabled}
                      onCheckedChange={handleEnable2FAClick}
                      disabled={isLoading}
                      className="data-[state=checked]:bg-[#6d28d9]"
                    />
                  </div>

                  {/* Method Selection (visible when enabled) */}
                  {securitySettings.twoFactorEnabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Delivery Method</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Email (active) */}
                          <div
                            className={`p-4 rounded-lg border-2 transition-all ${
                              securitySettings.twoFactorMethod === 'email'
                                ? 'border-[#6d28d9] bg-[#6d28d9]/5 shadow-sm'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                securitySettings.twoFactorMethod === 'email'
                                  ? 'border-[#6d28d9]'
                                  : 'border-gray-300'
                              }`}>
                                {securitySettings.twoFactorMethod === 'email' && (
                                  <div className="h-2.5 w-2.5 rounded-full bg-[#6d28d9]" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Mail className="h-4 w-4 text-[#6d28d9]" />
                                  <p className="text-sm font-medium text-gray-900">Email</p>
                                </div>
                                <p className="text-xs text-gray-500">{user?.email}</p>
                              </div>
                            </div>
                          </div>

                          {/* SMS (coming soon) */}
                          <div className="p-4 rounded-lg border-2 border-gray-200 opacity-50 cursor-not-allowed">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 h-5 w-5 rounded-full border-2 border-gray-300 flex items-center justify-center" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Smartphone className="h-4 w-4 text-gray-400" />
                                  <p className="text-sm font-medium text-gray-500">SMS</p>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gray-300 text-gray-400">
                                    Coming Soon
                                  </Badge>
                                </div>
                                <p className="text-xs text-gray-400">Not yet available</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* ── 2FA Verification Modal ───────────────────────────────────── */}
      {show2FAModal && user?.email && (
        <TwoFactorModal
          email={user.email}
          onVerified={on2FAVerified}
          onCancel={() => setShow2FAModal(false)}
          verifyCode={verifyTwoFactorCode}
          resendCode={sendTwoFactorCode}
          context="settings"
        />
      )}
    </div>
  );
}