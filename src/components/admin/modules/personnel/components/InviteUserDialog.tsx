/**
 * InviteUserDialog — Modal for inviting or creating new personnel accounts.
 *
 * Features:
 *  - Mode toggle: "Send Invitation" (email invite) vs "Create Account" (instant)
 *  - Clear visual hierarchy with branded header
 *  - Role selection via descriptive radio cards
 *  - Module access picker with role-based presets
 *  - Inline validation with contextual error messages
 *  - Recovery link display (Create Account mode) with copy-to-clipboard
 *  - Loading/submitting state with disabled controls
 *  - Accessible labels, descriptions, and keyboard navigation
 *
 * @module personnel/components/InviteUserDialog
 */

import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form@7.55.0';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Badge } from '../../../../ui/badge';
import { Switch } from '../../../../ui/switch';
import { inviteUserSchema, InviteUserFormValues } from '../schema';
import { cn } from '../../../../ui/utils';
import {
  UserPlus,
  Mail,
  User,
  ShieldCheck,
  Briefcase,
  FileCheck,
  Calculator,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Shield,
  Info,
  Copy,
  Check,
  KeyRound,
} from 'lucide-react';

import { PERMISSIONED_MODULES, ROLE_MODULE_PRESETS } from '../constants';
import { moduleConfig, moduleGroups } from '../../../layout/config';
import type { AdminModule } from '../../../layout/types';

// ── Types ──────────────────────────────────────────────────────────
type DialogMode = 'invite' | 'create';

/** Result shape returned by the create-account flow */
interface CreateAccountResult {
  recoveryLink: string | null;
}

// ── Role card metadata ─────────────────────────────────────────────
interface RoleOption {
  value: InviteUserFormValues['role'];
  label: string;
  description: string;
  icon: React.ReactNode;
  badgeColor: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'adviser',
    label: 'Financial Adviser',
    description: 'Client-facing role with access to client management, applications, and advice tools.',
    icon: <Briefcase className="h-5 w-5" />,
    badgeColor: 'bg-green-50 text-green-700 border-green-200',
  },
  {
    value: 'paraplanner',
    label: 'Paraplanner',
    description: 'Supports advisers with research, analysis, and application preparation.',
    icon: <Calculator className="h-5 w-5" />,
    badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    value: 'compliance',
    label: 'Compliance Officer',
    description: 'Oversees regulatory compliance, audits, and risk management processes.',
    icon: <FileCheck className="h-5 w-5" />,
    badgeColor: 'bg-red-50 text-red-700 border-red-200',
  },
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Full platform access including personnel management and system configuration.',
    icon: <ShieldCheck className="h-5 w-5" />,
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
];

// ── Mode metadata ──────────────────────────────────────────────────
const MODE_CONFIG: Record<DialogMode, {
  headerTitle: string;
  headerDescription: string;
  headerIcon: React.ReactNode;
  submitLabel: string;
  submitIcon: React.ReactNode;
  submittingLabel: string;
}> = {
  invite: {
    headerTitle: 'Invite Team Member',
    headerDescription: 'Send a secure invitation and configure module access.',
    headerIcon: <Mail className="h-5 w-5 text-white" />,
    submitLabel: 'Send Invitation',
    submitIcon: <Mail className="h-4 w-4" />,
    submittingLabel: 'Sending…',
  },
  create: {
    headerTitle: 'Create Account',
    headerDescription: 'Create an account instantly — no invite email required.',
    headerIcon: <KeyRound className="h-5 w-5 text-white" />,
    submitLabel: 'Create Account',
    submitIcon: <UserPlus className="h-4 w-4" />,
    submittingLabel: 'Creating…',
  },
};

// ── Props ──────────────────────────────────────────────────────────
interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when mode is "invite" — sends an email invitation */
  onInvite: (values: InviteUserFormValues) => Promise<boolean>;
  /** Called when mode is "create" — creates account directly and returns recovery link */
  onCreateAccount?: (values: InviteUserFormValues) => Promise<CreateAccountResult | false>;
}

export function InviteUserDialog({ open, onOpenChange, onInvite, onCreateAccount }: InviteUserDialogProps) {
  const [mode, setMode] = useState<DialogMode>('invite');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showModuleAccess, setShowModuleAccess] = useState(false);
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const cfg = MODE_CONFIG[mode];

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: 'adviser',
      moduleAccess: ROLE_MODULE_PRESETS['adviser'] || [],
    },
  });

  const selectedRole = watch('role');
  const selectedModules = watch('moduleAccess') || [];

  // Apply role-based presets when role changes
  useEffect(() => {
    if (selectedRole) {
      const preset = ROLE_MODULE_PRESETS[selectedRole] || [];
      setValue('moduleAccess', preset);
    }
  }, [selectedRole, setValue]);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setTimeout(() => {
        reset();
        setSubmitError(null);
        setSubmitSuccess(false);
        setShowModuleAccess(false);
        setRecoveryLink(null);
        setLinkCopied(false);
        setMode('invite');
      }, 200);
    }
    onOpenChange(isOpen);
  };

  const onSubmit = async (data: InviteUserFormValues) => {
    setSubmitError(null);
    setSubmitSuccess(false);
    setRecoveryLink(null);
    setLinkCopied(false);

    try {
      if (mode === 'create' && onCreateAccount) {
        const result = await onCreateAccount(data);
        if (result !== false) {
          setSubmitSuccess(true);
          setRecoveryLink(result.recoveryLink);
          // Don't auto-close — admin needs time to copy the recovery link
        }
      } else {
        const success = await onInvite(data);
        if (success) {
          setSubmitSuccess(true);
          setTimeout(() => {
            reset();
            setSubmitError(null);
            setSubmitSuccess(false);
            setShowModuleAccess(false);
            onOpenChange(false);
          }, 1200);
        }
      }
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'Operation failed. Please try again.'
      );
    }
  };

  const handleCopyLink = async () => {
    if (!recoveryLink) return;
    try {
      await navigator.clipboard.writeText(recoveryLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback: select the input text
      linkInputRef.current?.select();
    }
  };

  const handleDoneAfterCreate = () => {
    reset();
    setSubmitError(null);
    setSubmitSuccess(false);
    setShowModuleAccess(false);
    setRecoveryLink(null);
    setLinkCopied(false);
    setMode('invite');
    onOpenChange(false);
  };

  const toggleModule = (module: AdminModule) => {
    const current = selectedModules as string[];
    const updated = current.includes(module)
      ? current.filter((m) => m !== module)
      : [...current, module];
    setValue('moduleAccess', updated, { shouldDirty: true });
  };

  const enabledCount = (selectedModules as string[]).filter((m) =>
    PERMISSIONED_MODULES.includes(m as AdminModule)
  ).length;

  // ── Create-account success view ─────────────────────────────────
  if (submitSuccess && mode === 'create') {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-green-600 to-green-700 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogHeader className="space-y-0.5 text-left">
                  <DialogTitle className="text-lg font-semibold text-white">
                    Account Created
                  </DialogTitle>
                  <DialogDescription className="text-sm text-green-100">
                    The personnel account is active and ready to use.
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Recovery link section */}
            {recoveryLink ? (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">
                  Password Setup Link
                </Label>
                <p className="text-[11px] text-gray-500">
                  Share this link with the new user so they can set their password.
                  This link is single-use and will expire.
                </p>
                <div className="flex gap-2">
                  <Input
                    ref={linkInputRef}
                    value={recoveryLink}
                    readOnly
                    className="text-xs font-mono h-9 bg-gray-50"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 h-9"
                    onClick={handleCopyLink}
                  >
                    {linkCopied ? (
                      <div className="contents">
                        <Check className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-green-700">Copied</span>
                      </div>
                    ) : (
                      <div className="contents">
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-800">
                  No recovery link was generated. The user may need to use the
                  "Forgot Password" flow to set their password.
                </p>
              </div>
            )}

            {/* Info */}
            <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-blue-800">
                The account is immediately active. Module permissions have been
                configured based on the selected role. You can adjust them later
                via the Permissions tab.
              </p>
            </div>
          </div>

          <DialogFooter className="px-6 pb-5 pt-0">
            <Button
              size="sm"
              className="min-w-[100px] bg-green-600 hover:bg-green-700 text-white"
              onClick={handleDoneAfterCreate}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[580px] p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 px-6 py-5 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              {cfg.headerIcon}
            </div>
            <div>
              <DialogHeader className="space-y-0.5 text-left">
                <DialogTitle className="text-lg font-semibold text-white">
                  {cfg.headerTitle}
                </DialogTitle>
                <DialogDescription className="text-sm text-purple-100">
                  {cfg.headerDescription}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        {/* ── Form ───────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* ── Mode Toggle ────────────────────────────────────────── */}
          {onCreateAccount && (
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all',
                  mode === 'invite'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
                onClick={() => {
                  setMode('invite');
                  setSubmitError(null);
                }}
                disabled={isSubmitting || submitSuccess}
              >
                <Mail className="h-3.5 w-3.5" />
                Send Invitation
              </button>
              <button
                type="button"
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all',
                  mode === 'create'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
                onClick={() => {
                  setMode('create');
                  setSubmitError(null);
                }}
                disabled={isSubmitting || submitSuccess}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Create Account
              </button>
            </div>
          )}

          {/* ── Mode description ──────────────────────────────────── */}
          {onCreateAccount && (
            <div className="flex items-start gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
              <Info className="h-3.5 w-3.5 text-gray-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-gray-600">
                {mode === 'invite'
                  ? 'An invitation email will be sent. The user must click the link to complete account setup.'
                  : 'The account will be created immediately with a temporary password. You\'ll receive a password-setup link to share.'}
              </p>
            </div>
          )}

          {/* ── Name fields ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-firstName" className="text-xs font-medium text-gray-700">
                First Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="invite-firstName"
                  {...register('firstName')}
                  placeholder="e.g. Sarah"
                  className={cn(
                    'pl-9 h-10 text-sm',
                    errors.firstName && 'border-red-400 focus-visible:ring-red-400'
                  )}
                  disabled={isSubmitting || submitSuccess}
                  autoFocus
                  aria-invalid={!!errors.firstName}
                  aria-describedby={errors.firstName ? 'invite-firstName-error' : undefined}
                />
              </div>
              {errors.firstName && (
                <p id="invite-firstName-error" role="alert" className="flex items-center gap-1 text-xs text-red-500 mt-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-lastName" className="text-xs font-medium text-gray-700">
                Last Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="invite-lastName"
                  {...register('lastName')}
                  placeholder="e.g. van der Merwe"
                  className={cn(
                    'pl-9 h-10 text-sm',
                    errors.lastName && 'border-red-400 focus-visible:ring-red-400'
                  )}
                  disabled={isSubmitting || submitSuccess}
                  aria-invalid={!!errors.lastName}
                  aria-describedby={errors.lastName ? 'invite-lastName-error' : undefined}
                />
              </div>
              {errors.lastName && (
                <p id="invite-lastName-error" role="alert" className="flex items-center gap-1 text-xs text-red-500 mt-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          {/* ── Email ────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-xs font-medium text-gray-700">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                id="invite-email"
                {...register('email')}
                type="email"
                placeholder="sarah@yourpractice.co.za"
                className={cn(
                  'pl-9 h-10 text-sm',
                  errors.email && 'border-red-400 focus-visible:ring-red-400'
                )}
                disabled={isSubmitting || submitSuccess}
                aria-invalid={!!errors.email}
                aria-describedby={[
                  errors.email ? 'invite-email-error' : '',
                  'invite-email-hint',
                ].filter(Boolean).join(' ') || undefined}
              />
            </div>
            {errors.email && (
              <p id="invite-email-error" role="alert" className="flex items-center gap-1 text-xs text-red-500 mt-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {errors.email.message}
              </p>
            )}
            <p id="invite-email-hint" className="text-[11px] text-gray-400 mt-0.5">
              {mode === 'invite'
                ? 'A secure invitation link will be sent to this address.'
                : 'This will be the login email for the new account.'}
            </p>
          </div>

          {/* ── Divider: Role ─────────────────────────────────────── */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Assign Role
              </span>
            </div>
          </div>

          {/* ── Role selection cards ─────────────────────────────── */}
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ROLE_OPTIONS.map((opt) => {
                  const isSelected = field.value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isSubmitting || submitSuccess}
                      onClick={() => field.onChange(opt.value)}
                      className={cn(
                        'group relative flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all duration-150',
                        'hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-1',
                        isSelected
                          ? 'border-purple-500 bg-purple-50/60 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300',
                        (isSubmitting || submitSuccess) && 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      {/* Selection indicator */}
                      <div
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          isSelected
                            ? 'border-purple-600 bg-purple-600'
                            : 'border-gray-300 bg-white group-hover:border-gray-400'
                        )}
                      >
                        {isSelected && (
                          <svg
                            className="h-3 w-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-sm font-medium transition-colors',
                              isSelected ? 'text-purple-900' : 'text-gray-800'
                            )}
                          >
                            {opt.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500 line-clamp-2">
                          {opt.description}
                        </p>
                      </div>

                      <div
                        className={cn(
                          'shrink-0 mt-0.5 transition-colors',
                          isSelected ? 'text-purple-600' : 'text-gray-400'
                        )}
                      >
                        {opt.icon}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          />
          {errors.role && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {errors.role.message}
            </p>
          )}

          {/* ── Divider: Module Access ────────────────────────────── */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Module Access
              </span>
            </div>
          </div>

          {/* ── Module Access Section ────────────────────────────── */}
          <div className="space-y-3">
            {/* Summary bar + expand toggle */}
            <button
              type="button"
              onClick={() => setShowModuleAccess(!showModuleAccess)}
              className={cn(
                'w-full flex items-center justify-between px-3.5 py-3 rounded-lg border-2 transition-all text-left',
                'hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-1',
                showModuleAccess
                  ? 'border-purple-300 bg-purple-50/50'
                  : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
              )}
              disabled={isSubmitting || submitSuccess}
            >
              <div className="flex items-center gap-2.5">
                <Shield className={cn('h-4 w-4', showModuleAccess ? 'text-purple-600' : 'text-gray-400')} />
                <div>
                  <span className="text-sm font-medium text-gray-800">
                    {enabledCount} of {PERMISSIONED_MODULES.length} modules enabled
                  </span>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Pre-configured for the{' '}
                    <span className="font-medium text-gray-700">
                      {ROLE_OPTIONS.find((r) => r.value === selectedRole)?.label || selectedRole}
                    </span>{' '}
                    role. Click to customise.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-purple-50 text-purple-700 border-purple-200">
                  {enabledCount} / {PERMISSIONED_MODULES.length}
                </Badge>
                {showModuleAccess ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </button>

            {/* Expandable module grid */}
            {showModuleAccess && (
              <div className="space-y-4 pt-1">
                {/* Quick actions */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setValue('moduleAccess', [...PERMISSIONED_MODULES], { shouldDirty: true })}
                    disabled={isSubmitting || submitSuccess}
                  >
                    Grant All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setValue('moduleAccess', [], { shouldDirty: true })}
                    disabled={isSubmitting || submitSuccess}
                  >
                    Revoke All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 text-purple-700 border-purple-200 hover:bg-purple-50"
                    onClick={() => {
                      const preset = ROLE_MODULE_PRESETS[selectedRole] || [];
                      setValue('moduleAccess', preset, { shouldDirty: true });
                    }}
                    disabled={isSubmitting || submitSuccess}
                  >
                    Reset to Role Default
                  </Button>
                </div>

                {/* Grouped module toggles */}
                {moduleGroups
                  .filter((group) =>
                    group.modules.some((m) => PERMISSIONED_MODULES.includes(m))
                  )
                  .map((group) => {
                    const groupModules = group.modules.filter((m) =>
                      PERMISSIONED_MODULES.includes(m)
                    );
                    if (groupModules.length === 0) return null;

                    return (
                      <div key={group.label} className="space-y-1.5">
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {group.label}
                        </h4>
                        <div className="space-y-1">
                          {groupModules.map((module) => {
                            const config = moduleConfig[module];
                            const Icon = config.icon;
                            const isEnabled = (selectedModules as string[]).includes(module);

                            return (
                              <div
                                key={module}
                                className={cn(
                                  'flex items-center justify-between px-3 py-2 rounded-lg border transition-colors',
                                  isEnabled
                                    ? 'bg-purple-50/50 border-purple-200'
                                    : 'bg-gray-50/30 border-gray-100'
                                )}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Icon
                                    className={cn(
                                      'h-4 w-4 shrink-0',
                                      isEnabled ? 'text-purple-600' : 'text-gray-400'
                                    )}
                                  />
                                  <Label
                                    htmlFor={`invite-perm-${module}`}
                                    className={cn(
                                      'text-sm cursor-pointer',
                                      isEnabled ? 'text-gray-900 font-medium' : 'text-gray-500'
                                    )}
                                  >
                                    {config.label}
                                  </Label>
                                </div>
                                <Switch
                                  id={`invite-perm-${module}`}
                                  checked={isEnabled}
                                  onCheckedChange={() => toggleModule(module)}
                                  disabled={isSubmitting || submitSuccess}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                {/* Info note */}
                <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <Info className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-blue-800">
                    This sets initial module visibility. Granular capabilities (create, edit, delete, etc.)
                    can be configured after the user is created via the Permissions tab.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Submit error ─────────────────────────────────────── */}
          {submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{submitError}</p>
            </div>
          )}

          {/* ── Success state (invite mode only — create mode has its own view) */}
          {submitSuccess && mode === 'invite' && (
            <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <p className="text-xs text-green-700">
                Invitation sent successfully! The dialog will close shortly.
              </p>
            </div>
          )}

          {/* ── Footer ───────────────────────────────────────────── */}
          <DialogFooter className="pt-2 border-t border-gray-100 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
              className="min-w-[80px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || submitSuccess}
              className="min-w-[140px] gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
            >
              {isSubmitting ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {cfg.submittingLabel}
                </div>
              ) : submitSuccess ? (
                <div className="contents">
                  <CheckCircle2 className="h-4 w-4" />
                  Done
                </div>
              ) : (
                <div className="contents">
                  {cfg.submitIcon}
                  {cfg.submitLabel}
                </div>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}