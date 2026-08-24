/**
 * Step 5 — review before submitting.
 *
 * Split out of `MedicalAidQuoteWizard.tsx` (1,534 lines), where all five steps
 * shared one file with the wizard itself. It was already a self-contained
 * function with its own props; only its address changed.
 */
import { Pencil } from 'lucide-react';
import {
  BUDGET_BANDS,
  COVER_TYPES,
  type HealthState,
  LPJ_OPTIONS,
  MEMBERSHIP_TYPES,
  type MedicalAidHistoryState,
  type MembersState,
  NETWORK_OPTIONS,
  type PreferencesState,
  TENURE_OFF_OPTIONS,
  TENURE_ON_OPTIONS,
  displayDob,
} from './model';

export function Step5Review({
  members,
  preferences,
  history,
  health,
  mainMemberAge,
  onEditStep,
}: {
  members: MembersState;
  preferences: PreferencesState;
  history: MedicalAidHistoryState;
  health: HealthState;
  mainMemberAge: number | null;
  onEditStep: (step: number) => void;
}) {
  const coverTypeLabel =
    COVER_TYPES.find((c) => c.value === preferences.cover_type)?.label ?? preferences.cover_type;
  const networkLabel =
    NETWORK_OPTIONS.find((n) => n.value === preferences.network)?.label ?? preferences.network;
  const budgetLabel =
    BUDGET_BANDS.find((b) => b.value === preferences.budget_band)?.label ?? preferences.budget_band;
  const membershipLabel =
    MEMBERSHIP_TYPES.find((m) => m.value === members.membership_type)?.label ??
    members.membership_type;

  const showLpj = mainMemberAge !== null && mainMemberAge >= 35;

  function SectionHeader({ title, step }: { title: string; step: number }) {
    return (
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <button
          type="button"
          onClick={() => onEditStep(step)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
    );
  }

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex justify-between py-1.5 text-sm">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-900 font-medium text-right max-w-[60%]">{value || '—'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Review & submit</h2>
        <p className="text-sm text-gray-500">
          Please review your details before submitting your medical aid quote request.
        </p>
      </div>

      {/* Members */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Members" step={1} />
        <Row label="Membership type" value={membershipLabel} />
        <Row label="Main member" value={displayDob(members.main)} />
        {(members.membership_type === 'main_spouse' || members.membership_type === 'family') && (
          <Row label="Spouse / Partner" value={displayDob(members.spouse)} />
        )}
        {members.membership_type === 'family' &&
          members.children.map((child, i) => (
            <Row key={i} label={`Child ${i + 1}`} value={displayDob(child)} />
          ))}
      </div>

      {/* Preferences */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Cover Preferences" step={2} />
        <Row label="Cover type" value={coverTypeLabel} />
        <Row label="Network" value={networkLabel} />
        <Row label="Monthly budget" value={budgetLabel} />
        <Row label="Province" value={preferences.province} />
      </div>

      {/* Medical aid history */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Medical Aid History" step={3} />
        <Row
          label="Current status"
          value={
            history.current_status === 'currently_on'
              ? 'Currently on a SA medical aid'
              : history.current_status === 'not_currently_on'
                ? 'Not currently on a SA medical aid'
                : '—'
          }
        />
        {history.current_status === 'currently_on' && (
          <div className="contents">
            <Row label="Scheme" value={history.current_scheme} />
            <Row label="Plan" value={history.current_plan} />
            <Row
              label="Tenure"
              value={
                TENURE_ON_OPTIONS.find((o) => o.value === history.current_tenure_band)?.label ?? '—'
              }
            />
          </div>
        )}
        {history.current_status === 'not_currently_on' && (
          <Row
            label="Time without medical aid"
            value={
              TENURE_OFF_OPTIONS.find((o) => o.value === history.time_without_sa_medical_aid)
                ?.label ?? '—'
            }
          />
        )}
        {showLpj && (
          <Row
            label="Time off since age 35 (LPJ)"
            value={LPJ_OPTIONS.find((o) => o.value === history.lpj_time_off_since_35)?.label ?? '—'}
          />
        )}
      </div>

      {/* Health */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Health & Chronic Conditions" step={4} />
        <Row
          label="Chronic conditions"
          value={
            health.has_chronic_conditions === null
              ? '—'
              : health.has_chronic_conditions
                ? 'Yes'
                : 'No'
          }
        />
        {health.has_chronic_conditions && (
          <div className="contents">
            <Row label="Conditions" value={health.selected_conditions.join(', ') || '—'} />
            <Row label="Applies to" value={health.applies_to_members.join(', ') || '—'} />
            {health.notes && <Row label="Notes" value={health.notes} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main wizard component ───────────────────────────────────────────────────────
