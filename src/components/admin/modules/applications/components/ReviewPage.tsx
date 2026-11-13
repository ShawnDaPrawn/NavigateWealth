/**
 * ReviewPage — one application as a page of its own (design system: records
 * are pages), with a section rail, SYNC markers, Amend and the decision bar.
 */
import { useState, useMemo, useCallback } from 'react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { toast } from 'sonner';
import {
  Clock,
  Building2,
  AlertTriangle,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { BackLink } from '../../../layout/page/FilterControls';
import { StatusBadge } from './StatusBadge';
import { ClientAvatar } from './review-dialog/shared';
import { APPLICATION_PROFILE_FIELD_MAP } from '../constants';
import { Application, ApplicationData } from '../types';
import { formatDate, normalizeApplicationData, normalizeApplicationStringArray } from '../utils';
import { applicationsApi } from '../api';
import { ReviewSection } from './review-dialog/shared';
import { ExternalProductsSection } from './review-dialog/ExternalProductsSection';
import { FinancialOverviewSection } from './review-dialog/FinancialOverviewSection';
import { ExternalFSPSection } from './review-dialog/ExternalFSPSection';
import { PersonalInfoSection } from './review-dialog/PersonalInfoSection';
import { IdentificationSection } from './review-dialog/IdentificationSection';
import { MaritalStatusSection } from './review-dialog/MaritalStatusSection';
import { ContactInfoSection } from './review-dialog/ContactInfoSection';
import { AddressSection } from './review-dialog/AddressSection';
import { EmploymentSection } from './review-dialog/EmploymentSection';
import { ServicesSection } from './review-dialog/ServicesSection';
import { ConsentSection } from './review-dialog/ConsentSection';
import { ProfileFieldMapSection } from './review-dialog/ProfileFieldMapSection';

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------
const URGENCY_MAP: Record<string, { label: string; dotColor: string; className: string }> = {
  immediately: {
    label: 'Immediately',
    dotColor: 'bg-red-500',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  within_1_month: {
    label: 'Within 1 month',
    dotColor: 'bg-amber-500',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  within_3_months: {
    label: 'Within 3 months',
    dotColor: 'bg-blue-500',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  exploring: {
    label: 'Just exploring',
    dotColor: 'bg-gray-400',
    className: 'bg-gray-50 text-gray-600 border-gray-200',
  },
};

const ACCOUNT_TYPES = [
  {
    value: 'Personal Client',
    label: 'Personal Client',
    description: 'Individual seeking financial advisory',
  },
  {
    value: 'Business Client',
    label: 'Business Client',
    description: 'Corporate financial services (coming soon)',
    comingSoon: true,
  },
  {
    value: 'Partner Financial Adviser',
    label: 'Partner Financial Adviser',
    description: 'Independent adviser joining the platform (coming soon)',
    comingSoon: true,
  },
];

// ---------------------------------------------------------------------------
// Sections (the rail)
// ---------------------------------------------------------------------------
const SECTIONS = [
  { id: 'personal', label: 'Personal information' },
  { id: 'identification', label: 'Identification' },
  { id: 'marital', label: 'Marital status' },
  { id: 'contact', label: 'Contact information' },
  { id: 'address', label: 'Residential address' },
  { id: 'employment', label: 'Employment' },
  { id: 'financial', label: 'Financial overview' },
  { id: 'services', label: 'Services & interests' },
  { id: 'providers', label: 'External providers (FSPs)' },
  { id: 'products', label: 'External financial products' },
  { id: 'consent', label: 'Consent & agreements' },
] as const;

const ORIGIN_LABEL: Record<string, string> = {
  admin_invite: 'Invited',
  admin_import: 'Import',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ReviewPageProps {
  application: Application;
  /** Leaves the page, back to the list. */
  onClose: () => void;
  /** Where "‹ …" goes, e.g. "Pending review". */
  backLabel: string;
  onApprove: (app: Application) => void;
  onDecline: (app: Application) => void;
  onApplicationUpdated?: (app: Application) => void;
  onCompleteOnBehalf?: (app: Application) => void;
  onResendInvite?: (app: Application) => void;
  /** Hides Approve / Reject when the person may not decide. */
  canApprove?: boolean;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function ReviewPage({
  application: selectedApplication,
  onClose,
  backLabel,
  onApprove,
  onDecline,
  onApplicationUpdated,
  onCompleteOnBehalf,
  onResendInvite,
  canApprove = true,
}: ReviewPageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [originalSnapshot, setOriginalSnapshot] = useState<Record<string, unknown>>({});
  const [showFieldMap, setShowFieldMap] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('personal');

  const data = normalizeApplicationData(selectedApplication.application_data);

  const enterEditMode = useCallback(() => {
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
    setEditData((prev) => ({ ...prev, [field]: value }));
  }, []);

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
    if (amendedCount === 0) {
      toast.info('No changes to save');
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
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

      const mergedApplicationData = { ...data, ...amendedPayload } as ApplicationData;

      if (onApplicationUpdated) {
        onApplicationUpdated({
          ...selectedApplication,
          application_data: mergedApplicationData,
          updated_at: new Date().toISOString(),
        });
      }

      setIsEditing(false);
      setEditData({});
      setOriginalSnapshot({});
    } catch (error: unknown) {
      console.error('Failed to save amendments:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save amendments');
    } finally {
      setIsSaving(false);
    }
  }, [amendedCount, amendedFields, editData, selectedApplication, data, onApplicationUpdated]);

  const fv = useCallback(
    (field: string): string => {
      if (isEditing) return String(editData[field] ?? '');
      return String((data as Record<string, unknown>)?.[field] ?? '');
    },
    [isEditing, editData, data],
  );

  const isPending =
    selectedApplication.status === 'submitted' || selectedApplication.status === 'invited';
  const isIncomplete =
    selectedApplication.status === 'draft' || selectedApplication.status === 'in_progress';
  const isActionable = isPending || isIncomplete;
  const urgencyInfo = data?.urgency ? URGENCY_MAP[data.urgency] : null;

  const fullName =
    [data?.title, data?.firstName, data?.middleName, data?.lastName].filter(Boolean).join(' ') ||
    selectedApplication.user_name ||
    'Unknown applicant';
  const firstName = data?.preferredName || data?.firstName || 'them';

  const services = data?.accountReasons || [];
  const existingProducts = (data?.existingProducts || []).filter(
    (p: string) => p !== 'None of the above',
  );
  const existingProductProviders = (data?.existingProductProviders || {}) as Record<string, string>;

  const currentExternalProviders: string[] = isEditing
    ? normalizeApplicationStringArray(editData.externalProviders)
    : (data?.externalProviders ?? []);
  const currentCustomProviders: string[] = isEditing
    ? normalizeApplicationStringArray(editData.customProviders)
    : (data?.customProviders ?? []);

  const sectionProps = { isEditing, fv, updateField, amendedFields, data };
  const hasUnsaved = isEditing && amendedCount > 0;
  const currentAccountType = isEditing
    ? (editData.accountType as string) || 'Personal Client'
    : (data?.accountType as string) || 'Personal Client';

  const goTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(`app-section-${id}`)?.scrollIntoView({ behavior: 'smooth' });
  };

  const meta = [
    selectedApplication.application_number || selectedApplication.id.substring(0, 12),
    currentAccountType.replace('Personal Client', 'Personal client'),
    `${isIncomplete ? 'Signed up' : 'Submitted'} ${formatDate(
      isIncomplete
        ? selectedApplication.created_at
        : selectedApplication.submitted_at || selectedApplication.created_at,
    )}`,
    `Updated ${formatDate(selectedApplication.updated_at)}`,
    ORIGIN_LABEL[selectedApplication.origin ?? ''] ?? 'Self-service',
  ].join(' · ');

  const showMenu =
    (isActionable && !!onCompleteOnBehalf) ||
    (selectedApplication.status === 'invited' && !!onResendInvite);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-6 pb-28 lg:p-8 lg:pb-28">
      <BackLink label={`Back to ${backLabel.toLowerCase()}`} onClick={onClose} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ClientAvatar name={fullName} />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-[26px] leading-tight font-semibold tracking-tight text-nw-ink">
              {fullName}
              <StatusBadge status={selectedApplication.status} />
            </h1>
            <p className="mt-1 text-sm text-nw-text-3">{meta}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {isActionable &&
            (isEditing ? (
              <>
                <span className="mr-1 text-sm font-medium text-amber-700">
                  Amending
                  {amendedCount > 0
                    ? ` · ${amendedCount} change${amendedCount !== 1 ? 's' : ''}`
                    : ''}
                </span>
                <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Discard
                </Button>
                <Button
                  onClick={() => void saveAmendments()}
                  disabled={isSaving || amendedCount === 0}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden="true" />
                  )}
                  Save{amendedCount > 0 ? ` (${amendedCount})` : ''}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={enterEditMode}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Amend application
              </Button>
            ))}
          {showMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More application actions">
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isActionable && onCompleteOnBehalf && (
                  <DropdownMenuItem onSelect={() => onCompleteOnBehalf(selectedApplication)}>
                    Complete on behalf
                  </DropdownMenuItem>
                )}
                {selectedApplication.status === 'invited' && onResendInvite && (
                  <DropdownMenuItem onSelect={() => onResendInvite(selectedApplication)}>
                    Resend invite
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Section rail */}
        <nav aria-label="Application sections" className="shrink-0 lg:sticky lg:top-4 lg:w-60">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#app-section-${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    goTo(s.id);
                  }}
                  aria-current={activeSection === s.id ? 'true' : undefined}
                  className={`block rounded-md px-3 py-1.5 text-sm ${
                    activeSection === s.id
                      ? 'bg-nw-violet-50 font-medium text-nw-violet-600'
                      : 'text-nw-text-2 hover:bg-gray-100 hover:text-nw-ink'
                  }`}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 px-3 text-xs font-medium text-nw-text-3">Reference</p>
          <a
            href="#app-section-fieldmap"
            onClick={(e) => {
              e.preventDefault();
              setShowFieldMap(true);
              goTo('fieldmap');
            }}
            className="mt-1 block rounded-md px-3 py-1.5 text-sm text-nw-text-2 hover:bg-gray-100 hover:text-nw-ink"
          >
            Profile field mapping · {APPLICATION_PROFILE_FIELD_MAP.length}
          </a>
          <p className="mt-3 px-3 text-xs text-nw-text-3">
            <span className="rounded bg-blue-50 px-1 py-px text-[10px] font-semibold text-blue-700">
              SYNC
            </span>{' '}
            marks fields copied to the client profile on approval.
          </p>
        </nav>

        <div className="min-w-0 max-w-[880px] flex-1 space-y-4">
          {/* Account type and timeline */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-nw-line bg-white px-4 py-3">
            <Building2 className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span className="shrink-0 text-xs font-medium text-nw-text-3">Account type</span>
            {isEditing ? (
              <Select
                value={currentAccountType}
                onValueChange={(v) => updateField('accountType', v)}
              >
                <SelectTrigger
                  aria-label="Account type"
                  className="h-7 w-auto min-w-[180px] border-gray-200 bg-gray-50/60 text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} disabled={t.comingSoon}>
                      <span className="flex items-center gap-2">
                        {t.label}
                        {t.comingSoon && (
                          <span className="rounded bg-gray-100 px-1 py-px text-[9px] text-gray-400">
                            Soon
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge
                variant="outline"
                className="border-purple-200 bg-purple-50 text-[11px] font-medium text-purple-700"
              >
                {currentAccountType}
              </Badge>
            )}
            {urgencyInfo && (
              <span className="ml-auto flex items-center gap-2 text-xs text-nw-text-3">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Timeline
                <Badge
                  className={`gap-1.5 border text-[11px] font-medium ${urgencyInfo.className}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${urgencyInfo.dotColor}`} />
                  {urgencyInfo.label}
                </Badge>
              </span>
            )}
          </div>

          <div id="app-section-personal" className="scroll-mt-4">
            <PersonalInfoSection {...sectionProps} />
          </div>
          <div id="app-section-identification" className="scroll-mt-4">
            <IdentificationSection {...sectionProps} />
          </div>
          <div id="app-section-marital" className="scroll-mt-4">
            <MaritalStatusSection {...sectionProps} />
          </div>
          <div id="app-section-contact" className="scroll-mt-4">
            <ContactInfoSection {...sectionProps} />
          </div>
          <div id="app-section-address" className="scroll-mt-4">
            <AddressSection {...sectionProps} />
          </div>
          <div id="app-section-employment" className="scroll-mt-4">
            <EmploymentSection {...sectionProps} />
          </div>
          <div id="app-section-financial" className="scroll-mt-4">
            {data?.grossMonthlyIncome || data?.monthlyExpensesEstimate ? (
              <FinancialOverviewSection
                grossMonthlyIncome={data?.grossMonthlyIncome}
                monthlyExpensesEstimate={data?.monthlyExpensesEstimate}
                amendedFields={amendedFields}
              />
            ) : (
              <ReviewSection icon={FileText} title="Financial overview">
                <p className="text-sm text-nw-text-3">Not provided</p>
              </ReviewSection>
            )}
          </div>
          <div id="app-section-services" className="scroll-mt-4">
            <ServicesSection {...sectionProps} />
          </div>
          <div id="app-section-providers" className="scroll-mt-4">
            <ExternalFSPSection
              currentExternalProviders={currentExternalProviders}
              currentCustomProviders={currentCustomProviders}
              isEditing={isEditing}
              onProvidersChange={(providers) => updateField('externalProviders', providers)}
              onCustomProvidersChange={(providers) => updateField('customProviders', providers)}
            />
          </div>
          <div id="app-section-products" className="scroll-mt-4">
            <ExternalProductsSection
              existingProducts={existingProducts}
              existingProductProviders={existingProductProviders}
            />
            {existingProducts.length === 0 && (
              <ReviewSection icon={FileText} title="External financial products">
                <p className="text-sm text-nw-text-3">None recorded</p>
              </ReviewSection>
            )}
          </div>
          <div id="app-section-consent" className="scroll-mt-4">
            <ConsentSection data={data} />
          </div>

          {selectedApplication.review_notes && (
            <ReviewSection icon={FileText} title="Review notes">
              <div className="text-sm whitespace-pre-wrap text-gray-700">
                {selectedApplication.review_notes}
              </div>
              {selectedApplication.reviewed_at && (
                <div className="mt-2 text-xs text-gray-400">
                  Reviewed on {formatDate(selectedApplication.reviewed_at)}
                </div>
              )}
            </ReviewSection>
          )}

          <div id="app-section-fieldmap" className="scroll-mt-4">
            <ProfileFieldMapSection
              showFieldMap={showFieldMap}
              onToggle={() => setShowFieldMap(!showFieldMap)}
              data={data as Record<string, unknown>}
            />
          </div>
          <p className="text-xs text-nw-text-3">
            {services.length} service{services.length !== 1 ? 's' : ''} requested
          </p>
        </div>
      </div>

      {/* Decision bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-nw-line bg-white/95 backdrop-blur lg:left-[248px]">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-6 py-3 lg:px-8">
          {hasUnsaved ? (
            <p className="flex items-center gap-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {amendedCount} unsaved amendment{amendedCount !== 1 ? 's' : ''}. Save or discard them
              before approving or rejecting.
            </p>
          ) : isActionable ? (
            <p className="text-sm text-nw-text-2">
              Approving creates the client profile and gives {firstName} access.
            </p>
          ) : (
            <span />
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {isActionable && canApprove && (
              <>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => onDecline(selectedApplication)}
                  disabled={hasUnsaved}
                >
                  Reject…
                </Button>
                <Button onClick={() => onApprove(selectedApplication)} disabled={hasUnsaved}>
                  Approve
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
