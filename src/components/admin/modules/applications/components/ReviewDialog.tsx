/**
 * Application Review Dialog
 *
 * Full-screen review of a client application with inline amendment,
 * profile-sync field indicators, and external product visibility.
 *
 * §7 — Presentation layer; no business logic, uses derived display state.
 * §8.3 — Follows admin panel design conventions (stat card style, badges, spacing).
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Badge } from '../../../../ui/badge';
import { Separator } from '../../../../ui/separator';
import { Textarea } from '../../../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../ui/tooltip';
import { toast } from 'sonner@2.0.3';
import {
  User,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  XCircle,
  CheckCircle2,
  Target,
  Clock,
  Package,
  Fingerprint,
  Heart,
  Phone,
  MessageSquare,
  Globe,
  Users,
  FileText,
  Shield,
  PenLine,
  Pencil,
  Save,
  X,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Hash,
  Calendar,
  Building,
  Building2,
  Link2,
  ExternalLink,
  Info,
  HeartPulse,
  Stethoscope,
  PiggyBank,
  TrendingUp,
  ShieldCheck,
  ShieldPlus,
  Home,
  Car,
  GraduationCap,
  Wallet,
  Landmark,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Application, ApplicationData } from '../types';
import { formatDate } from '../utils';
import { StatusBadge } from './StatusBadge';
import { applicationsApi } from '../api';
import {
  SYNCED_FIELDS,
  APPLICATION_PROFILE_FIELD_MAP,
  FIELD_MAP_BY_SECTION,
  SECTION_LABELS,
  EXTERNAL_PRODUCT_CATEGORIES,
  SA_PROVIDER_MAP,
} from '../constants';
import { ExternalProvidersSection } from './ExternalProvidersSection';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Life Partner'];
const MARITAL_REGIMES = [
  'In Community of Property',
  'Out of Community of Property (with accrual)',
  'Out of Community of Property (without accrual)',
];
const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
];
const EMPLOYMENT_STATUSES = [
  { value: 'employed', label: 'Employed' },
  { value: 'self-employed', label: 'Self-Employed' },
  { value: 'contract', label: 'Contract Worker' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'retired', label: 'Retired' },
  { value: 'student', label: 'Student' },
];
const URGENCY_MAP: Record<string, { label: string; dotColor: string; className: string }> = {
  immediately: { label: 'Immediately', dotColor: 'bg-red-500', className: 'bg-red-50 text-red-700 border-red-200' },
  within_1_month: { label: 'Within 1 month', dotColor: 'bg-amber-500', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  within_3_months: { label: 'Within 3 months', dotColor: 'bg-blue-500', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  exploring: { label: 'Just exploring', dotColor: 'bg-gray-400', className: 'bg-gray-50 text-gray-600 border-gray-200' },
};

/** Icon map for external product categories */
const PRODUCT_ICON_MAP: Record<string, React.ElementType> = {
  'heart-pulse': HeartPulse,
  'stethoscope': Stethoscope,
  'piggy-bank': PiggyBank,
  'trending-up': TrendingUp,
  'shield-check': ShieldCheck,
  'shield-plus': ShieldPlus,
  'home': Home,
  'car': Car,
  'graduation-cap': GraduationCap,
  'wallet': Wallet,
  'file-text': FileText,
  'landmark': Landmark,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedApplication: Application | null;
  onApprove: (app: Application) => void;
  onDecline: (app: Application) => void;
  onApplicationUpdated?: (app: Application) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Section card wrapper — consistent with admin panel card style */
function ReviewSection({ icon: Icon, title, children, badge, actions, className }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white overflow-hidden ${className || ''}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/40">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-[#6d28d9]" />
          </div>
          <span className="text-[13px] font-semibold text-gray-900">{title}</span>
          {badge}
        </div>
        {actions}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

/** Profile sync indicator — shows when a field maps to client profile */
function SyncIndicator({ field }: { field: string }) {
  if (!SYNCED_FIELDS.has(field)) return null;

  const mapping = APPLICATION_PROFILE_FIELD_MAP.find(m => m.applicationField === field);
  if (!mapping) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-blue-600 bg-blue-50 border border-blue-200/60 rounded px-1 py-px ml-1 normal-case tracking-normal cursor-help">
            <Link2 className="h-2.5 w-2.5" />
            Sync
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[220px]">
          <p className="font-medium">Syncs to Client Profile</p>
          <p className="text-gray-400 mt-0.5">Maps to: <span className="font-mono text-[10px]">{mapping.profileField}</span></p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Read-only field */
function ViewField({ label, value, icon: Icon, className, amended, syncField }: {
  label: string;
  value: string | undefined | null;
  icon?: React.ElementType;
  className?: string;
  amended?: boolean;
  syncField?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1 mb-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
        {amended && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-px ml-0.5 normal-case tracking-normal">
            Amended
          </span>
        )}
        {syncField && <SyncIndicator field={syncField} />}
      </Label>
      <div className={`text-sm font-medium ${value ? 'text-gray-900' : 'text-gray-300 italic font-normal'}`}>
        {value || 'Not provided'}
      </div>
    </div>
  );
}

/** Editable text input */
function EditField({ label, value, onChange, placeholder, type, icon: Icon }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ElementType;
}) {
  return (
    <div>
      <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      <Input
        type={type || 'text'}
        className="h-8 text-sm bg-gray-50/60 border-gray-200 focus:bg-white transition-colors"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/** Editable select */
function EditSelect({ label, value, onChange, options, placeholder, icon: Icon }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[] | string[];
  placeholder?: string;
  icon?: React.ElementType;
}) {
  const normalised = typeof options[0] === 'string'
    ? (options as string[]).map(o => ({ value: o, label: o }))
    : options as { value: string; label: string }[];

  return (
    <div>
      <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm bg-gray-50/60 border-gray-200 focus:bg-white transition-colors">
          <SelectValue placeholder={placeholder || 'Select'} />
        </SelectTrigger>
        <SelectContent>
          {normalised.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Client avatar / initials circle */
function ClientAvatar({ name }: { name: string }) {
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return (
    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#6d28d9] to-purple-400 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
      {initials || '??'}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function ReviewDialog({
  open,
  onOpenChange,
  selectedApplication,
  onApprove,
  onDecline,
  onApplicationUpdated,
}: ReviewDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [originalSnapshot, setOriginalSnapshot] = useState<Record<string, unknown>>({});
  const [showFieldMap, setShowFieldMap] = useState(false);

  const data = selectedApplication?.application_data ?? null;

  // ── Edit helpers (must be above early return to satisfy Rules of Hooks) ──
  const enterEditMode = useCallback(() => {
    if (!data) return;
    const snapshot = { ...data } as Record<string, unknown>;
    setOriginalSnapshot(snapshot);
    setEditData(snapshot);
    setIsEditing(true);
  }, [data]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditData({});
    setOriginalSnapshot({});
  }, []);

  const updateField = useCallback((field: string, value: string | number | boolean | string[]) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Track which fields were amended
  const amendedFields = useMemo(() => {
    if (!isEditing) return new Set<string>();
    const changed = new Set<string>();
    for (const key of Object.keys(editData)) {
      const oldVal = JSON.stringify(originalSnapshot[key] ?? '');
      const newVal = JSON.stringify(editData[key] ?? '');
      if (oldVal !== newVal) changed.add(key);
    }
    return changed;
  }, [isEditing, editData, originalSnapshot]);

  const amendedCount = amendedFields.size;

  const saveAmendments = useCallback(async () => {
    if (!selectedApplication || !data) return;
    if (amendedCount === 0) {
      toast.info('No changes to save');
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      // Build a payload containing ONLY the amended fields for a clean server merge
      const amendedPayload: Record<string, unknown> = {};
      for (const key of amendedFields) {
        amendedPayload[key] = editData[key];
      }

      await applicationsApi.updateApplicationData(
        selectedApplication.id,
        amendedPayload,
        `Admin amended ${amendedCount} field(s)`,
      );
      toast.success(`${amendedCount} field(s) amended successfully`);

      // Construct optimistic update with full merged application_data
      const mergedApplicationData = { ...data, ...amendedPayload } as ApplicationData;

      if (onApplicationUpdated) {
        const updatedApp: Application = {
          ...selectedApplication,
          application_data: mergedApplicationData,
          updated_at: new Date().toISOString(),
        };
        onApplicationUpdated(updatedApp);
      }

      setIsEditing(false);
      setEditData({});
      setOriginalSnapshot({});
    } catch (error: unknown) {
      console.error('Failed to save amendments:', error);
      toast.error(error?.message || 'Failed to save amendments');
    } finally {
      setIsSaving(false);
    }
  }, [amendedCount, amendedFields, editData, selectedApplication, data, onApplicationUpdated]);

  // Current field value helper
  const fv = useCallback((field: string): string => {
    if (isEditing) return editData[field] ?? '';
    return (data as Record<string, unknown>)?.[field] ?? '';
  }, [isEditing, editData, data]);

  // ── Early return AFTER all hooks ──
  if (!selectedApplication || !data) return null;

  const isPending = selectedApplication.status === 'submitted' || selectedApplication.status === 'invited';
  const isIncomplete = selectedApplication.status === 'draft' || selectedApplication.status === 'in_progress';
  const isActionable = isPending || isIncomplete;
  const urgencyInfo = data?.urgency ? URGENCY_MAP[data.urgency] : null;

  const fullName = [data?.title, data?.firstName, data?.middleName, data?.lastName].filter(Boolean).join(' ');
  const hasSpouseDetails = data?.spouseFirstName;
  const hasEmploymentDetails = data?.employmentStatus && data.employmentStatus !== '';
  const isSelfEmployed = data?.employmentStatus === 'self-employed';
  const isEmployed = data?.employmentStatus === 'employed' || data?.employmentStatus === 'contract';
  const existingProducts = (data?.existingProducts || []).filter((p: string) => p !== 'None of the above');
  const existingProductProviders = (data?.existingProductProviders || {}) as Record<string, string>;
  const services = data?.accountReasons || [];

  // External providers (FSPs)
  const currentExternalProviders: string[] = isEditing
    ? (editData.externalProviders as string[] ?? data?.externalProviders ?? [])
    : (data?.externalProviders ?? []);
  const currentCustomProviders: string[] = isEditing
    ? (editData.customProviders as string[] ?? data?.customProviders ?? [])
    : (data?.customProviders ?? []);
  const hasExternalProviders = currentExternalProviders.length > 0 || currentCustomProviders.length > 0;

  const addressParts = [
    data?.residentialAddressLine1,
    data?.residentialAddressLine2,
    data?.residentialSuburb,
    data?.residentialCity,
    data?.residentialProvince,
    data?.residentialPostalCode,
  ].filter(Boolean);

  // ── Render ──
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cancelEdit(); onOpenChange(o); }}>
      <DialogContent className="max-w-[960px] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* ============================================================== */}
        {/* HEADER                                                         */}
        {/* ============================================================== */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
          {/* Purple accent stripe */}
          <div className="h-1 bg-gradient-to-r from-[#6d28d9] via-purple-500 to-purple-400" />

          <div className="px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <ClientAvatar name={fullName || 'Unknown'} />
                <div>
                  <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    {fullName || 'Unknown Applicant'}
                    {data?.preferredName && data.preferredName !== data.firstName && (
                      <span className="text-sm font-normal text-gray-400">"{data.preferredName}"</span>
                    )}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {selectedApplication.application_number || selectedApplication.id.substring(0, 8)}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(selectedApplication.submitted_at || selectedApplication.created_at)}
                    </span>
                    {selectedApplication.user_email && (
                      <span className="contents">
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {selectedApplication.user_email}
                        </span>
                      </span>
                    )}
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={selectedApplication.status} />
                {selectedApplication.origin === 'admin_import' && (
                  <Badge variant="outline" className="text-[10px] font-medium bg-blue-50 text-blue-700 border-blue-200">
                    Admin Added
                  </Badge>
                )}
                {selectedApplication.origin === 'admin_invite' && (
                  <Badge variant="outline" className="text-[10px] font-medium bg-indigo-50 text-indigo-700 border-indigo-200">
                    Invited
                  </Badge>
                )}
              </div>
            </div>

            {/* Edit mode controls */}
            {isActionable && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8 border-[#6d28d9]/30 text-[#6d28d9] hover:bg-[#6d28d9]/5"
                    onClick={enterEditMode}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Amend Application
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="font-medium text-amber-700">Edit Mode</span>
                      {amendedCount > 0 && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0">
                          {amendedCount} change{amendedCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs h-8"
                      onClick={cancelEdit}
                      disabled={isSaving}
                    >
                      <X className="h-3.5 w-3.5" />
                      Discard
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs h-8 bg-[#6d28d9] hover:bg-[#5b21b6]"
                      onClick={saveAmendments}
                      disabled={isSaving || amendedCount === 0}
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save {amendedCount > 0 ? `(${amendedCount})` : ''}
                    </Button>
                  </div>
                ) : (
                  <div />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* SCROLLABLE BODY                                                */}
        {/* ============================================================== */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-gray-50/30">

          {/* Overview strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Application ID', value: selectedApplication.application_number || selectedApplication.id.substring(0, 12), mono: true },
              { label: isIncomplete ? 'Signed Up' : 'Submitted', value: formatDate(isIncomplete ? selectedApplication.created_at : (selectedApplication.submitted_at || selectedApplication.created_at)) },
              { label: 'Last Updated', value: formatDate(selectedApplication.updated_at) },
              { label: 'Services Requested', value: `${services.length} service${services.length !== 1 ? 's' : ''}`, bold: true },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-lg border border-gray-200 p-3.5">
                <Label className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{item.label}</Label>
                <div className={`text-xs mt-1 ${item.mono ? 'font-mono text-gray-600 truncate' : item.bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`} title={item.mono ? selectedApplication.id : undefined}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Account Type — visible for incomplete applications, editable in edit mode */}
          {(() => {
            const ACCOUNT_TYPES = [
              { value: 'Personal Client', label: 'Personal Client', description: 'Individual seeking financial advisory' },
              { value: 'Business Client', label: 'Business Client', description: 'Corporate financial services (coming soon)', comingSoon: true },
              { value: 'Partner Financial Adviser', label: 'Partner Financial Adviser', description: 'Independent adviser joining the platform (coming soon)', comingSoon: true },
            ];
            const currentAccountType = isEditing
              ? (editData.accountType as string || 'Personal Client')
              : (data?.accountType as string || 'Personal Client');

            return (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white border border-gray-200">
                <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-500 font-medium shrink-0">Account Type:</span>
                {isEditing ? (
                  <Select value={currentAccountType} onValueChange={(v) => updateField('accountType', v)}>
                    <SelectTrigger className="h-7 text-xs w-auto min-w-[180px] bg-gray-50/60 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} disabled={t.comingSoon}>
                          <span className="flex items-center gap-2">
                            {t.label}
                            {t.comingSoon && (
                              <span className="text-[9px] text-gray-400 bg-gray-100 px-1 py-px rounded">Soon</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className="text-[11px] font-medium bg-purple-50 text-purple-700 border-purple-200">
                    {currentAccountType}
                  </Badge>
                )}
                {isIncomplete && !isEditing && (
                  <span className="text-[10px] text-gray-400 ml-auto">Click "Amend Application" to change</span>
                )}
              </div>
            );
          })()}

          {/* Urgency badge (if present) */}
          {urgencyInfo && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-200">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Timeline:</span>
              <Badge className={`text-[11px] font-medium border gap-1.5 ${urgencyInfo.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${urgencyInfo.dotColor}`} />
                {urgencyInfo.label}
              </Badge>
            </div>
          )}

          {/* ── EXTERNAL FINANCIAL PRODUCTS ────────────────────────────── */}
          {existingProducts.length > 0 && (
            <ReviewSection
              icon={Package}
              title="External Financial Products"
              badge={
                <Badge variant="outline" className="text-[10px] font-medium bg-orange-50 text-orange-700 border-orange-200 ml-2">
                  {existingProducts.length} product{existingProducts.length !== 1 ? 's' : ''}
                </Badge>
              }
              actions={
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 cursor-help">
                        <Info className="h-3 w-3" />
                        <span>Informational only</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs max-w-[260px]">
                      These products are held at external providers. They do not link to the client profile but indicate where to look for existing cover.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              }
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {existingProducts.map((product: string) => {
                  const category = EXTERNAL_PRODUCT_CATEGORIES.find(
                    c => c.label === product || c.id === product
                  );
                  const IconComponent = category ? (PRODUCT_ICON_MAP[category.icon] || Package) : Package;

                  return (
                    <div
                      key={product}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gradient-to-r from-orange-50/40 to-white hover:border-orange-200/60 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-lg bg-orange-100/80 flex items-center justify-center shrink-0">
                        <IconComponent className="h-4 w-4 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{product}</p>
                        {existingProductProviders[product] ? (
                          <p className="text-[10px] text-orange-600 font-medium truncate">{existingProductProviders[product]}</p>
                        ) : category ? (
                          <p className="text-[10px] text-gray-400 truncate">{category.description}</p>
                        ) : null}
                      </div>
                      <ExternalLink className="h-3 w-3 text-gray-300 shrink-0 ml-auto" />
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1.5">
                <Info className="h-3 w-3 shrink-0" />
                These products are held at external providers and serve as reference for the adviser. They are not linked to the client profile.
              </p>
            </ReviewSection>
          )}

          {/* 1. PERSONAL INFORMATION */}
          <ReviewSection icon={User} title="Personal Information">
            {isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <EditSelect label="Title" value={fv('title')} onChange={v => updateField('title', v)} options={TITLES} />
                  <EditField label="First Name" value={fv('firstName')} onChange={v => updateField('firstName', v)} placeholder="First name" />
                  <EditField label="Middle Name" value={fv('middleName')} onChange={v => updateField('middleName', v)} />
                  <EditField label="Last Name" value={fv('lastName')} onChange={v => updateField('lastName', v)} placeholder="Last name" />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <EditField label="Preferred Name" value={fv('preferredName')} onChange={v => updateField('preferredName', v)} />
                  <EditField label="Date of Birth" value={fv('dateOfBirth')} onChange={v => updateField('dateOfBirth', v)} type="date" />
                  <EditSelect label="Gender" value={fv('gender')} onChange={v => updateField('gender', v)} options={GENDERS} />
                  <EditField label="Nationality" value={fv('nationality')} onChange={v => updateField('nationality', v)} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                <ViewField label="Full Name" value={fullName} amended={amendedFields.has('firstName') || amendedFields.has('lastName')} syncField="firstName" />
                {data?.preferredName && data.preferredName !== data.firstName && (
                  <ViewField label="Known As" value={data.preferredName} />
                )}
                <ViewField label="Date of Birth" value={data?.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined} syncField="dateOfBirth" />
                <ViewField label="Gender" value={data?.gender} syncField="gender" />
                <ViewField label="Nationality" value={data?.nationality} syncField="nationality" />
                <ViewField label="SA Tax Resident" value={data?.isSATaxResident === true ? 'Yes' : data?.isSATaxResident === false ? 'No' : undefined} />
              </div>
            )}
          </ReviewSection>

          {/* 2. IDENTIFICATION */}
          <ReviewSection
            icon={Fingerprint}
            title="Identification"
            badge={data?.idType ? (
              <Badge variant="outline" className="text-[10px] font-medium ml-2">
                {data.idType === 'sa_id' ? 'SA ID' : 'Passport'}
              </Badge>
            ) : undefined}
          >
            {isEditing ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <EditSelect
                  label="ID Type"
                  value={fv('idType')}
                  onChange={v => updateField('idType', v)}
                  options={[
                    { value: 'sa_id', label: 'SA ID Number' },
                    { value: 'passport', label: 'Passport' },
                  ]}
                />
                <EditField label="ID / Passport Number" value={fv('idNumber')} onChange={v => updateField('idNumber', v)} placeholder="ID number" />
                <EditField label="Tax Number" value={fv('taxNumber')} onChange={v => updateField('taxNumber', v)} placeholder="10-digit number" />
                <EditField label="Number of Dependants" value={fv('numberOfDependants')} onChange={v => updateField('numberOfDependants', v)} />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                <ViewField label="ID Type" value={data?.idType === 'sa_id' ? 'South African ID Number' : data?.idType === 'passport' ? 'Passport Number' : undefined} amended={amendedFields.has('idType')} />
                <ViewField label="ID / Passport Number" value={data?.idNumber} amended={amendedFields.has('idNumber')} syncField="idNumber" />
                <ViewField label="Tax Number" value={data?.taxNumber} amended={amendedFields.has('taxNumber')} syncField="taxNumber" />
                <ViewField label="Number of Dependants" value={data?.numberOfDependants} />
              </div>
            )}
          </ReviewSection>

          {/* 3. MARITAL STATUS */}
          <ReviewSection icon={Heart} title="Marital Status">
            {isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <EditSelect label="Marital Status" value={fv('maritalStatus')} onChange={v => updateField('maritalStatus', v)} options={MARITAL_STATUSES} />
                  {(fv('maritalStatus') === 'Married' || fv('maritalStatus') === 'Life Partner') && (
                    <div className="col-span-2">
                      <EditSelect label="Marital Regime" value={fv('maritalRegime')} onChange={v => updateField('maritalRegime', v)} options={MARITAL_REGIMES} />
                    </div>
                  )}
                </div>
                {(fv('maritalStatus') === 'Married' || fv('maritalStatus') === 'Life Partner') && (
                  <div className="contents">
                    <Separator />
                    <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                      <Users className="h-3 w-3" /> Spouse / Partner Details
                    </Label>
                    <div className="grid grid-cols-3 gap-3">
                      <EditField label="Spouse First Name" value={fv('spouseFirstName')} onChange={v => updateField('spouseFirstName', v)} />
                      <EditField label="Spouse Last Name" value={fv('spouseLastName')} onChange={v => updateField('spouseLastName', v)} />
                      <EditField label="Spouse Date of Birth" value={fv('spouseDateOfBirth')} onChange={v => updateField('spouseDateOfBirth', v)} type="date" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="contents">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                  <ViewField label="Marital Status" value={data?.maritalStatus} amended={amendedFields.has('maritalStatus')} syncField="maritalStatus" />
                  {data?.maritalRegime && <ViewField label="Marital Regime" value={data.maritalRegime} amended={amendedFields.has('maritalRegime')} syncField="maritalRegime" />}
                </div>
                {hasSpouseDetails && (
                  <div className="contents">
                    <Separator className="my-4" />
                    <div>
                      <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5 mb-3">
                        <Users className="h-3 w-3" /> Spouse / Partner Details
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                        <ViewField label="Spouse Name" value={`${data.spouseFirstName || ''} ${data.spouseLastName || ''}`.trim()} />
                        {data.spouseDateOfBirth && (
                          <ViewField label="Spouse Date of Birth" value={new Date(data.spouseDateOfBirth).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })} />
                        )}
                        {data.spouseEmployed && (
                          <ViewField label="Spouse Employed" value={data.spouseEmployed === 'yes' ? 'Yes' : data.spouseEmployed === 'no' ? 'No' : data.spouseEmployed} />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ReviewSection>

          {/* 4. CONTACT INFORMATION */}
          <ReviewSection icon={Mail} title="Contact Information">
            {isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Email Address" value={fv('emailAddress')} onChange={v => updateField('emailAddress', v)} icon={Mail} type="email" placeholder="client@example.com" />
                  <EditField label="Cellphone" value={fv('cellphoneNumber')} onChange={v => updateField('cellphoneNumber', v)} icon={Phone} placeholder="+27 82 123 4567" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Alternative Email" value={fv('alternativeEmail')} onChange={v => updateField('alternativeEmail', v)} type="email" />
                  <EditField label="WhatsApp Number" value={fv('whatsappNumber')} onChange={v => updateField('whatsappNumber', v)} icon={MessageSquare} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Alternative Cellphone" value={fv('alternativeCellphone')} onChange={v => updateField('alternativeCellphone', v)} />
                  <EditSelect
                    label="Preferred Contact Method"
                    value={fv('preferredContactMethod')}
                    onChange={v => updateField('preferredContactMethod', v)}
                    options={['Email', 'Phone', 'WhatsApp', 'SMS']}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                <ViewField label="Email Address" value={data?.emailAddress} icon={Mail} amended={amendedFields.has('emailAddress')} syncField="emailAddress" />
                {data?.alternativeEmail && <ViewField label="Alternative Email" value={data.alternativeEmail} syncField="alternativeEmail" />}
                <ViewField label="Cellphone" value={data?.cellphoneNumber} icon={Phone} amended={amendedFields.has('cellphoneNumber')} syncField="cellphoneNumber" />
                {data?.alternativeCellphone && <ViewField label="Alt. Cellphone" value={data.alternativeCellphone} syncField="alternativeCellphone" />}
                {data?.whatsappNumber && <ViewField label="WhatsApp" value={data.whatsappNumber} icon={MessageSquare} />}
                {data?.preferredContactMethod && <ViewField label="Preferred Contact Method" value={data.preferredContactMethod} syncField="preferredContactMethod" />}
                {data?.bestTimeToContact && <ViewField label="Best Time to Contact" value={data.bestTimeToContact} icon={Clock} />}
              </div>
            )}
          </ReviewSection>

          {/* 5. ADDRESS */}
          <ReviewSection icon={MapPin} title="Residential Address">
            {isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Address Line 1" value={fv('residentialAddressLine1')} onChange={v => updateField('residentialAddressLine1', v)} placeholder="Street address" />
                  <EditField label="Address Line 2" value={fv('residentialAddressLine2')} onChange={v => updateField('residentialAddressLine2', v)} placeholder="Apartment, suite, etc." />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <EditField label="Suburb" value={fv('residentialSuburb')} onChange={v => updateField('residentialSuburb', v)} />
                  <EditField label="City" value={fv('residentialCity')} onChange={v => updateField('residentialCity', v)} />
                  <EditSelect label="Province" value={fv('residentialProvince')} onChange={v => updateField('residentialProvince', v)} options={PROVINCES} />
                  <EditField label="Postal Code" value={fv('residentialPostalCode')} onChange={v => updateField('residentialPostalCode', v)} />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <EditField label="Country" value={fv('residentialCountry')} onChange={v => updateField('residentialCountry', v)} icon={Globe} />
                </div>
              </div>
            ) : (
              <div className="contents">
                {addressParts.length > 0 ? (
                  <div className="space-y-0.5">
                    {data?.residentialAddressLine1 && <div className="text-sm font-medium text-gray-900">{data.residentialAddressLine1}</div>}
                    {data?.residentialAddressLine2 && <div className="text-sm text-gray-700">{data.residentialAddressLine2}</div>}
                    <div className="text-sm text-gray-700">
                      {[data?.residentialSuburb, data?.residentialCity, data?.residentialProvince, data?.residentialPostalCode].filter(Boolean).join(', ')}
                    </div>
                    {data?.residentialCountry && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-700 mt-1">
                        <Globe className="h-3.5 w-3.5 text-gray-400" />
                        {data.residentialCountry}
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-2">
                      <SyncIndicator field="residentialAddressLine1" />
                      <span className="text-[10px] text-gray-400">All address fields sync to client profile</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-300 italic">No address provided</div>
                )}
              </div>
            )}
          </ReviewSection>

          {/* 6. EMPLOYMENT */}
          <ReviewSection
            icon={Briefcase}
            title="Employment"
            badge={
              hasEmploymentDetails ? (
                <Badge variant="outline" className="text-[10px] font-medium capitalize ml-2">
                  {data.employmentStatus?.replace('-', ' ')}
                </Badge>
              ) : undefined
            }
          >
            {isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <EditSelect label="Employment Status" value={fv('employmentStatus')} onChange={v => updateField('employmentStatus', v)} options={EMPLOYMENT_STATUSES} />
                  <EditField label="Job Title" value={fv('jobTitle')} onChange={v => updateField('jobTitle', v)} icon={Briefcase} placeholder="e.g. Financial Manager" />
                  <EditField label="Employer Name" value={fv('employerName')} onChange={v => updateField('employerName', v)} icon={Building} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <EditField label="Industry" value={fv('industry')} onChange={v => updateField('industry', v)} />
                  <EditField label="Gross Monthly Income" value={fv('grossMonthlyIncome')} onChange={v => updateField('grossMonthlyIncome', v)} icon={DollarSign} />
                  <EditField label="Monthly Expenses Estimate" value={fv('monthlyExpensesEstimate')} onChange={v => updateField('monthlyExpensesEstimate', v)} />
                </div>
                {(fv('employmentStatus') === 'self-employed') && (
                  <div className="grid grid-cols-3 gap-3">
                    <EditField label="Company / Business Name" value={fv('selfEmployedCompanyName')} onChange={v => updateField('selfEmployedCompanyName', v)} />
                    <EditField label="Business Industry" value={fv('selfEmployedIndustry')} onChange={v => updateField('selfEmployedIndustry', v)} />
                    <EditField label="Business Description" value={fv('selfEmployedDescription')} onChange={v => updateField('selfEmployedDescription', v)} />
                  </div>
                )}
              </div>
            ) : (
              <div className="contents">
                {hasEmploymentDetails ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                    <ViewField label="Employment Status" value={data.employmentStatus ? data.employmentStatus.charAt(0).toUpperCase() + data.employmentStatus.slice(1).replace('-', ' ') : undefined} amended={amendedFields.has('employmentStatus')} syncField="employmentStatus" />
                    {isEmployed && (
                      <div className="contents">
                        <ViewField label="Job Title" value={data?.jobTitle} amended={amendedFields.has('jobTitle')} syncField="jobTitle" />
                        <ViewField label="Employer" value={data?.employerName} amended={amendedFields.has('employerName')} syncField="employerName" />
                        <ViewField label="Industry" value={data?.industry === 'Other' && data?.industryOther ? `Other — ${data.industryOther}` : data?.industry} syncField="industry" />
                      </div>
                    )}
                    {isSelfEmployed && (
                      <div className="contents">
                        {data?.selfEmployedCompanyName && <ViewField label="Company / Business Name" value={data.selfEmployedCompanyName} syncField="selfEmployedCompanyName" />}
                        <ViewField label="Industry" value={data?.selfEmployedIndustry === 'Other' && data?.selfEmployedIndustryOther ? `Other — ${data.selfEmployedIndustryOther}` : data?.selfEmployedIndustry} syncField="selfEmployedIndustry" />
                        {data?.selfEmployedDescription && (
                          <ViewField label="Business Description" value={data.selfEmployedDescription} className="col-span-2 md:col-span-3" syncField="selfEmployedDescription" />
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-300 italic">No employment details provided</div>
                )}
              </div>
            )}
          </ReviewSection>

          {/* 7. FINANCIAL OVERVIEW (view only) */}
          {!isEditing && (data?.grossMonthlyIncome || data?.monthlyExpensesEstimate) && (
            <ReviewSection icon={DollarSign} title="Financial Overview">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <ViewField label="Gross Monthly Income" value={data?.grossMonthlyIncome} amended={amendedFields.has('grossMonthlyIncome')} syncField="grossMonthlyIncome" />
                <ViewField label="Monthly Expenses Estimate" value={data?.monthlyExpensesEstimate} amended={amendedFields.has('monthlyExpensesEstimate')} />
              </div>
            </ReviewSection>
          )}

          {/* 8. SERVICES & INTERESTS */}
          <ReviewSection
            icon={Target}
            title="Services & Interests"
            badge={<span className="text-[11px] text-gray-400 font-normal ml-2">{services.length} selected</span>}
          >
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-2 block">Financial Goals</Label>
                  <Textarea
                    className="text-sm bg-gray-50/60 border-gray-200 focus:bg-white transition-colors min-h-[60px]"
                    value={fv('financialGoals')}
                    onChange={e => updateField('financialGoals', e.target.value)}
                    placeholder="Financial goals"
                  />
                </div>
                {services.length > 0 && (
                  <div>
                    <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-2 block">Services Requested (view only)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {services.map((r: string) => (
                        <Badge key={r} className="text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5">{r}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="contents">
                <div className="mb-4">
                  <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-2 block">Services Requested</Label>
                  {services.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {services.map((r: string) => (
                        <Badge key={r} className="text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5">{r}</Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-300 italic">None selected</span>
                  )}
                </div>

                {data?.otherReason && (
                  <div className="mb-4">
                    <ViewField label="Other Reason Specified" value={data.otherReason} />
                  </div>
                )}

                {data?.financialGoals && (
                  <div className="pt-3 border-t border-gray-100">
                    <ViewField label="Financial Goals" value={data.financialGoals} amended={amendedFields.has('financialGoals')} />
                  </div>
                )}
              </div>
            )}
          </ReviewSection>

          {/* 9. CONSENT & AGREEMENTS */}
          <ReviewSection icon={Shield} title="Consent & Agreements">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { label: 'Terms & Conditions', value: data?.termsAccepted },
                { label: 'POPIA Consent', value: data?.popiaConsent },
                { label: 'Disclosure Acknowledged', value: data?.disclosureAcknowledged },
                { label: 'FAIS Disclosure', value: data?.faisAcknowledged },
                { label: 'Electronic Communications', value: data?.electronicCommunicationConsent },
                { label: 'Marketing Consent', value: data?.communicationConsent },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50/80 border border-gray-100">
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.value ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {item.value ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </div>
                  <span className={`text-xs ${item.value ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{item.label}</span>
                </div>
              ))}
            </div>
            {data?.signatureFullName && (
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-3">
                <PenLine className="h-4 w-4 text-[#6d28d9]" />
                <div>
                  <Label className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Digital Signature</Label>
                  <div className="text-sm font-semibold italic text-gray-900 mt-0.5">{data.signatureFullName}</div>
                </div>
              </div>
            )}
          </ReviewSection>

          {/* ── EXTERNAL PROVIDERS (FSPs) ─────────────────────────────── */}
          {(hasExternalProviders || isEditing) && (
            <ReviewSection
              icon={Building2}
              title="External Providers (FSPs)"
              badge={
                hasExternalProviders ? (
                  <Badge variant="outline" className="text-[10px] font-medium bg-purple-50 text-purple-700 border-purple-200 ml-2">
                    {currentExternalProviders.length + currentCustomProviders.length} provider{currentExternalProviders.length + currentCustomProviders.length !== 1 ? 's' : ''}
                  </Badge>
                ) : undefined
              }
              actions={
                !isEditing ? (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 cursor-help">
                          <Info className="h-3 w-3" />
                          <span>Existing policies</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-[260px]">
                        Financial service providers where the client may hold existing policies. Helps advisers identify existing cover.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <ExternalProvidersSection
                selectedProviders={currentExternalProviders}
                customProviders={currentCustomProviders}
                isEditing={isEditing}
                onProvidersChange={(providers) => updateField('externalProviders', providers)}
                onCustomProvidersChange={(providers) => updateField('customProviders', providers)}
              />
            </ReviewSection>
          )}

          {/* 10. REVIEW NOTES */}
          {selectedApplication.review_notes && (
            <ReviewSection icon={FileText} title="Review Notes">
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{selectedApplication.review_notes}</div>
              {selectedApplication.reviewed_at && (
                <div className="text-xs text-gray-400 mt-2">
                  Reviewed on {formatDate(selectedApplication.reviewed_at)}
                </div>
              )}
            </ReviewSection>
          )}

          {/* 11. PROFILE FIELD MAPPING REFERENCE */}
          <div className="rounded-xl border border-blue-200/60 bg-blue-50/30 overflow-hidden">
            <button
              onClick={() => setShowFieldMap(!showFieldMap)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-blue-50/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Link2 className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div>
                  <span className="text-[13px] font-semibold text-gray-900">Profile Field Mapping Reference</span>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {APPLICATION_PROFILE_FIELD_MAP.length} fields sync between Application and Client Profile on approval
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-medium bg-blue-50 text-blue-700 border-blue-200">
                  {APPLICATION_PROFILE_FIELD_MAP.length} mapped
                </Badge>
                {showFieldMap ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </button>

            {showFieldMap && (
              <div className="px-5 pb-5 pt-1 border-t border-blue-200/40">
                <div className="space-y-4 mt-3">
                  {Object.entries(FIELD_MAP_BY_SECTION).map(([section, mappings]) => (
                    <div key={section}>
                      <Label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2 block">
                        {SECTION_LABELS[section] || section}
                      </Label>
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50/60 border-b border-gray-100">
                              <th className="text-left py-1.5 px-3 font-medium text-gray-500 w-[35%]">Application Field</th>
                              <th className="text-center py-1.5 px-1 font-medium text-gray-400 w-[30px]" />
                              <th className="text-left py-1.5 px-3 font-medium text-gray-500 w-[35%]">Client Profile Field</th>
                              <th className="text-center py-1.5 px-3 font-medium text-gray-500 w-[20%]">Has Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mappings.map((m) => {
                              const val = (data as Record<string, unknown>)?.[m.applicationField];
                              const hasValue = val !== undefined && val !== null && val !== '';
                              return (
                                <tr key={m.applicationField} className="border-b border-gray-50 last:border-0">
                                  <td className="py-1.5 px-3 text-gray-700 font-medium">{m.label}</td>
                                  <td className="text-center px-1">
                                    <ArrowRight className="h-3 w-3 text-blue-400 inline" />
                                  </td>
                                  <td className="py-1.5 px-3 text-gray-500 font-mono text-[10px]">{m.profileField}</td>
                                  <td className="text-center py-1.5 px-3">
                                    {hasValue ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 inline" />
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* FOOTER                                                         */}
        {/* ============================================================== */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          {isEditing && amendedCount > 0 && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{amendedCount}</strong> unsaved amendment{amendedCount !== 1 ? 's' : ''}. Save your changes before approving or rejecting.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => { cancelEdit(); onOpenChange(false); }}
              className="px-5"
            >
              Close
            </Button>
            {isActionable && (
              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => onDecline(selectedApplication)}
                  disabled={isEditing && amendedCount > 0}
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
                <Button
                  className="gap-1.5 bg-green-600 hover:bg-green-700 px-5"
                  onClick={() => onApprove(selectedApplication)}
                  disabled={isEditing && amendedCount > 0}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                  <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
