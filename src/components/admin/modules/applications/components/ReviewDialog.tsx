import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent } from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { toast } from 'sonner';
import {
  XCircle,
  CheckCircle2,
  Clock,
  Building2,
  AlertTriangle,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { Application, ApplicationData } from '../types';
import { formatDate, normalizeApplicationData, normalizeApplicationStringArray } from '../utils';
import { StatusBadge } from './StatusBadge';
import { applicationsApi } from '../api';
import { EXTERNAL_PRODUCT_CATEGORIES } from '../constants';
import { ReviewSection } from './review-dialog/shared';
import { ReviewDialogHeader } from './review-dialog/ReviewDialogHeader';
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

  const data = selectedApplication
    ? normalizeApplicationData(selectedApplication.application_data)
    : null;

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
    if (!selectedApplication || !data) return;
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

  // ── Early return AFTER all hooks ──
  if (!selectedApplication || !data) return null;

  const isPending =
    selectedApplication.status === 'submitted' || selectedApplication.status === 'invited';
  const isIncomplete =
    selectedApplication.status === 'draft' || selectedApplication.status === 'in_progress';
  const isActionable = isPending || isIncomplete;
  const urgencyInfo = data?.urgency ? URGENCY_MAP[data.urgency] : null;

  const fullName = [data?.title, data?.firstName, data?.middleName, data?.lastName]
    .filter(Boolean)
    .join(' ');

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
  const hasExternalProviders =
    currentExternalProviders.length > 0 || currentCustomProviders.length > 0;

  const sectionProps = { isEditing, fv, updateField, amendedFields, data };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) cancelEdit();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-[960px] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* HEADER */}
        <ReviewDialogHeader
          selectedApplication={selectedApplication}
          fullName={fullName}
          preferredName={data?.preferredName}
          firstName={data?.firstName}
          isActionable={isActionable}
          isEditing={isEditing}
          isSaving={isSaving}
          amendedCount={amendedCount}
          onEnterEditMode={enterEditMode}
          onCancelEdit={cancelEdit}
          onSaveAmendments={saveAmendments}
        />

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-gray-50/30">
          {/* Overview strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'Application ID',
                value:
                  selectedApplication.application_number || selectedApplication.id.substring(0, 12),
                mono: true,
              },
              {
                label: isIncomplete ? 'Signed Up' : 'Submitted',
                value: formatDate(
                  isIncomplete
                    ? selectedApplication.created_at
                    : selectedApplication.submitted_at || selectedApplication.created_at,
                ),
              },
              { label: 'Last Updated', value: formatDate(selectedApplication.updated_at) },
              {
                label: 'Services Requested',
                value: `${services.length} service${services.length !== 1 ? 's' : ''}`,
                bold: true,
              },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-lg border border-gray-200 p-3.5">
                <Label className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                  {item.label}
                </Label>
                <div
                  className={`text-xs mt-1 ${item.mono ? 'font-mono text-gray-600 truncate' : item.bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}
                  title={item.mono ? selectedApplication.id : undefined}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Account Type */}
          {(() => {
            const currentAccountType = isEditing
              ? (editData.accountType as string) || 'Personal Client'
              : (data?.accountType as string) || 'Personal Client';
            return (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white border border-gray-200">
                <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-500 font-medium shrink-0">Account Type:</span>
                {isEditing ? (
                  <Select
                    value={currentAccountType}
                    onValueChange={(v) => updateField('accountType', v)}
                  >
                    <SelectTrigger className="h-7 text-xs w-auto min-w-[180px] bg-gray-50/60 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} disabled={t.comingSoon}>
                          <span className="flex items-center gap-2">
                            {t.label}
                            {t.comingSoon && (
                              <span className="text-[9px] text-gray-400 bg-gray-100 px-1 py-px rounded">
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
                    className="text-[11px] font-medium bg-purple-50 text-purple-700 border-purple-200"
                  >
                    {currentAccountType}
                  </Badge>
                )}
                {isIncomplete && !isEditing && (
                  <span className="text-[10px] text-gray-400 ml-auto">
                    Click "Amend Application" to change
                  </span>
                )}
              </div>
            );
          })()}

          {/* Urgency */}
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

          <ExternalProductsSection
            existingProducts={existingProducts}
            existingProductProviders={existingProductProviders}
          />

          <PersonalInfoSection {...sectionProps} />
          <IdentificationSection {...sectionProps} />
          <MaritalStatusSection {...sectionProps} />
          <ContactInfoSection {...sectionProps} />
          <AddressSection {...sectionProps} />
          <EmploymentSection {...sectionProps} />

          {!isEditing && (data?.grossMonthlyIncome || data?.monthlyExpensesEstimate) && (
            <FinancialOverviewSection
              grossMonthlyIncome={data?.grossMonthlyIncome}
              monthlyExpensesEstimate={data?.monthlyExpensesEstimate}
              amendedFields={amendedFields}
            />
          )}

          <ServicesSection {...sectionProps} />
          <ConsentSection data={data} />

          {(hasExternalProviders || isEditing) && (
            <ExternalFSPSection
              currentExternalProviders={currentExternalProviders}
              currentCustomProviders={currentCustomProviders}
              isEditing={isEditing}
              onProvidersChange={(providers) => updateField('externalProviders', providers)}
              onCustomProvidersChange={(providers) => updateField('customProviders', providers)}
            />
          )}

          {/* Review Notes */}
          {selectedApplication.review_notes && (
            <ReviewSection icon={FileText} title="Review Notes">
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {selectedApplication.review_notes}
              </div>
              {selectedApplication.reviewed_at && (
                <div className="text-xs text-gray-400 mt-2">
                  Reviewed on {formatDate(selectedApplication.reviewed_at)}
                </div>
              )}
            </ReviewSection>
          )}

          <ProfileFieldMapSection
            showFieldMap={showFieldMap}
            onToggle={() => setShowFieldMap(!showFieldMap)}
            data={data as Record<string, unknown>}
          />
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          {isEditing && amendedCount > 0 && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{amendedCount}</strong> unsaved amendment{amendedCount !== 1 ? 's' : ''}.
                Save your changes before approving or rejecting.
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => {
                cancelEdit();
                onOpenChange(false);
              }}
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
