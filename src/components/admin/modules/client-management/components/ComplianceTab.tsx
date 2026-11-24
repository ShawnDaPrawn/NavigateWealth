/**
 * The client's Compliance tab: the compliance record kept on their profile.
 *
 * Three sections, the open one in the address (?ksec=):
 * - Overview — what needs attention (`complianceIndicators`) and the headline
 *   facts.
 * - Client declarations — what the client declared (PEP, source of funds and
 *   wealth, tax residency, FATCA, consents). The client fills these in from
 *   the portal (Profile → Compliance & Consent); staff can complete or correct
 *   them here.
 * - Compliance review — the firm's own assessment (risk rating, sanctions
 *   outcome, KYC review dates). Staff only; never returned to the client.
 *
 * Data and rules live in `src/shared/compliance/clientCompliance.ts`, built to
 * be lifted into the self-built compliance engine. A save sends only the key it
 * edits, merged over the stored record, so it can never overwrite another part
 * of the profile.
 *
 * This replaced the Honeycomb/Beeswax checks (removed 2026-11-24). Records those
 * checks wrote are still in the KV store, unread.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, FileText, Loader2, Save, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../ui/button';
import { ErrorState, useClientSubCrumbs, useUrlState } from '../../../layout/page';
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
  useUnsavedChangesRegistry,
} from '../../../../shared/unsaved-changes';
import {
  ComplianceDeclarationsCard,
  ComplianceIndicatorList,
  ComplianceReviewCard,
} from '../../../../shared/client-profile';
import { applicationHints } from '../../../../../shared/client-profile';
import {
  COMPLIANCE_DECLARATIONS_PROFILE_KEY,
  COMPLIANCE_REVIEW_PROFILE_KEY,
  CLIENT_RISK_RATING_OPTIONS,
  SANCTIONS_RESULT_OPTIONS,
  complianceIndicators,
  legacyConsentEvidence,
  normalizeComplianceDeclarations,
  normalizeComplianceReview,
  outstandingDeclarations,
  type ComplianceDeclarations,
  type ComplianceReview,
} from '../../../../../shared/compliance';
import { api } from '../../../../../utils/api';
import type { Client } from '../types';
import { getClientProfileQueryOptions } from '../api';
import { ProfileSectionView } from './clientProfile/ProfileSectionView';
import {
  complianceDeclarationsView,
  complianceReviewView,
} from './clientProfile/profileSectionRows';

type ComplianceSection = 'overview' | 'declarations' | 'review';

const SECTIONS: Array<{
  id: ComplianceSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'declarations', label: 'Client declarations', icon: FileText },
  { id: 'review', label: 'Compliance review', icon: ClipboardCheck },
];
const SECTION_IDS = SECTIONS.map((s) => s.id);

const REGISTRY_ID = 'admin-client-compliance';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface ComplianceTabProps {
  selectedClient: Client;
}

export function ComplianceTab({ selectedClient }: ComplianceTabProps) {
  const clientId = selectedClient.id;
  const queryClient = useQueryClient();
  const profileQuery = useQuery(getClientProfileQueryOptions(clientId));
  const record = useMemo(
    () => (profileQuery.data ?? {}) as unknown as Record<string, unknown>,
    [profileQuery.data],
  );
  const stored = useMemo(
    () => ({
      declarations: normalizeComplianceDeclarations(record[COMPLIANCE_DECLARATIONS_PROFILE_KEY]),
      review: normalizeComplianceReview(record[COMPLIANCE_REVIEW_PROFILE_KEY]),
    }),
    [record],
  );

  const [section, setSection] = useUrlState<ComplianceSection>('ksec', 'overview', SECTION_IDS);
  const sectionLabel = SECTIONS.find((s) => s.id === section)?.label ?? '';
  useClientSubCrumbs(sectionLabel ? [{ label: sectionLabel }] : []);

  // Edit state: a draft of the one part being edited, or null in view mode.
  const [draftDeclarations, setDraftDeclarations] = useState<ComplianceDeclarations | null>(null);
  const [draftReview, setDraftReview] = useState<ComplianceReview | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = draftDeclarations !== null || draftReview !== null;
  const isDirty =
    (draftDeclarations !== null &&
      JSON.stringify(draftDeclarations) !== JSON.stringify(stored.declarations)) ||
    (draftReview !== null && JSON.stringify(draftReview) !== JSON.stringify(stored.review));

  const cancel = useCallback(() => {
    setDraftDeclarations(null);
    setDraftReview(null);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const data: Record<string, unknown> = {};
    if (draftDeclarations) data[COMPLIANCE_DECLARATIONS_PROFILE_KEY] = draftDeclarations;
    if (draftReview) data[COMPLIANCE_REVIEW_PROFILE_KEY] = draftReview;
    if (Object.keys(data).length === 0) return true;
    setSaving(true);
    try {
      await api.post('/profile/personal-info', {
        key: `user_profile:${clientId}:personal_info`,
        data,
        // Only these keys: merge them over the stored record.
        mode: 'merge',
      });
      const queryKey = getClientProfileQueryOptions(clientId).queryKey;
      queryClient.setQueryData(queryKey, (old: unknown) =>
        old && typeof old === 'object' ? { ...(old as object), ...data } : old,
      );
      await queryClient.invalidateQueries({ queryKey });
      toast.success('Compliance record saved');
      cancel();
      return true;
    } catch (error) {
      toast.error(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setSaving(false);
    }
  }, [cancel, clientId, draftDeclarations, draftReview, queryClient]);

  const guard = useUnsavedChangesGuard({
    isDirty,
    onSave: save,
    onDiscard: cancel,
    message: "You have unsaved changes to this client's compliance record.",
  });
  const registry = useUnsavedChangesRegistry();
  useEffect(() => {
    registry.register({ id: REGISTRY_ID, isDirty, tryAction: guard.tryAction });
    return () => registry.unregister(REGISTRY_ID);
  }, [registry, isDirty, guard.tryAction]);

  const changeSection = (next: ComplianceSection) => {
    if (next === section) return;
    guard.tryAction(() => {
      cancel();
      setSection(next);
    });
  };

  if (profileQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-nw-violet" aria-label="Loading compliance" />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <ErrorState
        title="Couldn't load compliance"
        description="The client's compliance record could not be loaded."
        onRetry={() => void profileQuery.refetch()}
        details={profileQuery.error instanceof Error ? profileQuery.error.message : undefined}
      />
    );
  }

  const indicators = complianceIndicators(stored.declarations, stored.review, todayIso());
  const outstanding = outstandingDeclarations(stored.declarations);
  const fromApplication = applicationHints(record);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Compliance sections" className="lg:sticky lg:top-4 lg:self-start">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => changeSection(s.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60 ${
                    active
                      ? 'bg-nw-violet-50 font-medium text-nw-violet-600'
                      : 'text-nw-text-2 hover:bg-gray-50 hover:text-nw-ink'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {s.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-col gap-4">
        {section === 'overview' && (
          <ProfileSectionView
            title="Compliance overview"
            canEdit={false}
            onEdit={() => undefined}
            banner={
              indicators.length > 0 ? (
                <ComplianceIndicatorList indicators={indicators} />
              ) : (
                <p className="text-sm text-nw-text-2">Nothing needs attention.</p>
              )
            }
            groups={[
              {
                rows: [
                  {
                    label: 'Risk rating',
                    value:
                      CLIENT_RISK_RATING_OPTIONS.find((o) => o.value === stored.review.riskRating)
                        ?.label ?? '',
                  },
                  {
                    label: 'Sanctions screening',
                    value:
                      SANCTIONS_RESULT_OPTIONS.find(
                        (o) => o.value === stored.review.sanctionsResult,
                      )?.label ?? '',
                  },
                  {
                    label: 'Next KYC review due',
                    value: formatDate(stored.review.nextKycReviewDate),
                  },
                  {
                    label: 'Client declarations',
                    value:
                      outstanding.length === 0
                        ? stored.declarations.confirmedAt
                          ? `Complete, confirmed ${formatDate(stored.declarations.confirmedAt)}`
                          : 'Complete, not yet confirmed by the client'
                        : `${outstanding.length} still to answer`,
                  },
                ],
              },
            ]}
          />
        )}

        {section === 'declarations' &&
          (draftDeclarations ? (
            <ComplianceDeclarationsCard
              value={draftDeclarations}
              onChange={setDraftDeclarations}
              audience="adviser"
              legacyConsent={legacyConsentEvidence(record)}
              applicationSaysSaTaxResident={fromApplication.saTaxResident}
              saTaxNumber={typeof record.taxNumber === 'string' ? record.taxNumber : ''}
            />
          ) : (
            <ProfileSectionView
              title="Client declarations"
              {...complianceDeclarationsView(stored.declarations)}
              banner={
                <p className="text-sm text-nw-text-2">
                  The client completes these in their portal under Profile → Compliance &amp;
                  Consent. Edit here to complete or correct them on the client&apos;s behalf.
                </p>
              }
              onEdit={() => setDraftDeclarations(stored.declarations)}
            />
          ))}

        {section === 'review' &&
          (draftReview ? (
            <ComplianceReviewCard
              value={draftReview}
              onChange={setDraftReview}
              declarations={stored.declarations}
            />
          ) : (
            <ProfileSectionView
              title="Compliance review"
              {...complianceReviewView(stored.review)}
              banner={
                indicators.length > 0 ? <ComplianceIndicatorList indicators={indicators} /> : null
              }
              onEdit={() => setDraftReview(stored.review)}
            />
          ))}

        {editing && (
          <div
            className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-nw-line bg-white px-5 py-3 shadow-sm"
            role="region"
            aria-label="Unsaved changes"
          >
            <span className="flex items-center gap-2 text-sm text-nw-text-2">
              {isDirty && <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />}
              {isDirty ? 'You have unsaved changes' : 'Editing'}
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={saving || !isDirty}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        )}
      </div>
      <UnsavedChangesDialog {...guard.dialogProps} />
    </div>
  );
}
