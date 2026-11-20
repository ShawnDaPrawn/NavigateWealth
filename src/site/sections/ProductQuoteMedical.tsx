/**
 * ProductQuoteMedical — the medical aid quote in the board's frame: who needs
 * cover, cover preferences, medical aid history (with the late-joiner
 * question from age 35), chronic conditions, and the review. The questions,
 * options, checks, saved progress and request are the live
 * MedicalAidQuoteWizard's (medicalAid/model.ts), drawn in the board's
 * controls.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BUDGET_BANDS,
  CHRONIC_PRESETS,
  COMMON_SCHEMES,
  COVER_TYPES,
  LPJ_OPTIONS,
  MEMBERSHIP_TYPES,
  NETWORK_OPTIONS,
  SA_PROVINCES,
  TENURE_OFF_OPTIONS,
  TENURE_ON_OPTIONS,
  WIZARD_STEPS,
  clearDraft,
  displayDob,
  getInitialHealth,
  getInitialHistory,
  getInitialMembers,
  getInitialPreferences,
  getMainMemberAge,
  getMemberLabels,
  hasMemberAge,
  loadDraft,
  saveDraft,
  type HealthState,
  type MedicalAidHistoryState,
  type MemberEntry,
  type MembersState,
  type PreferencesState,
} from '../../components/pages/quote/components/medicalAid/model';
import {
  Chips,
  ChipsMulti,
  Choices,
  Field,
  FieldGrid,
  NumberInput,
  Note,
  Pair,
  Panel,
  Review,
  ReviewRows,
  ReviewSection,
  SelectInput,
  Step,
  TextInput,
} from './ProductQuoteFields';
import { medicalProductDetails } from './ProductQuoteModel';
import { ProductQuoteWizard } from './ProductQuoteWizard';
import { COMPLETE_FIELDS, useQuoteSend, type WizardProps } from './ProductQuoteSend';

const EMPTY_MEMBER: MemberEntry = { dob: '', age: '' };
const STATUS_OPTIONS = [
  { value: 'currently_on', label: 'I am currently on a South African medical aid' },
  { value: 'not_currently_on', label: 'I am not currently on a South African medical aid' },
];
const NO_YES = [
  { value: false, label: 'No' },
  { value: true, label: 'Yes' },
] as const;

const labelOf = (options: readonly { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label;

/** Today, for the date fields' upper bound (as the live fields set it). */
const today = () => new Date().toISOString().split('T')[0];

export function ProductQuoteMedical({ contact, parentSubmissionId, onSuccess }: WizardProps) {
  const [draft] = useState(loadDraft);
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [members, setMembers] = useState<MembersState>(draft?.members ?? getInitialMembers());
  const [preferences, setPreferences] = useState<PreferencesState>(
    draft?.preferences ?? getInitialPreferences(),
  );
  const [history, setHistory] = useState<MedicalAidHistoryState>(
    draft?.medical_aid_history ?? getInitialHistory(),
  );
  const [health, setHealth] = useState<HealthState>(draft?.health ?? getInitialHealth());

  useEffect(() => {
    saveDraft({ members, preferences, medical_aid_history: history, health, currentStep });
  }, [members, preferences, history, health, currentStep]);

  const mainMemberAge = useMemo(() => getMainMemberAge(members.main), [members.main]);
  const memberLabels = useMemo(() => getMemberLabels(members), [members]);

  const step1Valid = useMemo(() => {
    if (!members.membership_type) return false;
    if (!hasMemberAge(members.main)) return false;
    const showSpouse =
      members.membership_type === 'main_spouse' || members.membership_type === 'family';
    if (showSpouse && !hasMemberAge(members.spouse)) return false;
    if (members.membership_type === 'family') {
      if (members.children.length === 0) return false;
      if (members.children.some((c) => !hasMemberAge(c))) return false;
    }
    return true;
  }, [members]);

  const step2Valid = Boolean(
    preferences.cover_type &&
    preferences.network &&
    preferences.budget_band &&
    preferences.province,
  );

  const step3Valid = useMemo(() => {
    if (!history.current_status) return false;
    if (history.current_status === 'currently_on') {
      if (!history.current_scheme || !history.current_plan || !history.current_tenure_band)
        return false;
    }
    if (history.current_status === 'not_currently_on') {
      if (!history.time_without_sa_medical_aid) return false;
    }
    const showLpj = mainMemberAge !== null && mainMemberAge >= 35;
    if (showLpj && !history.lpj_time_off_since_35) return false;
    return true;
  }, [history, mainMemberAge]);

  const step4Valid = useMemo(() => {
    if (health.has_chronic_conditions === null) return false;
    if (health.has_chronic_conditions) {
      if (health.selected_conditions.length === 0) return false;
      if (health.applies_to_members.length === 0) return false;
    }
    return true;
  }, [health]);

  const canProceed =
    [true, step1Valid, step2Valid, step3Valid, step4Valid, true][currentStep] ?? false;

  const { submitting, failure, send } = useQuoteSend({
    contact,
    parentSubmissionId,
    onSuccess,
    service: 'medical-aid',
    productName: 'Medical Aid',
    logName: 'Medical aid',
    successMessage: 'Your medical aid quote request has been submitted!',
    clearDraft,
  });

  const submit = useCallback(() => {
    void send(() => medicalProductDetails(members, preferences, history, health, mainMemberAge));
  }, [send, members, preferences, history, health, mainMemberAge]);

  return (
    <ProductQuoteWizard
      steps={WIZARD_STEPS.map((s) => s.label)}
      step={currentStep}
      onStep={setCurrentStep}
      valid={canProceed}
      hint={COMPLETE_FIELDS}
      backHref="/get-quote/medical-aid/contact"
      submitting={submitting}
      failure={failure}
      onSubmit={submit}
    >
      {currentStep === 1 ? <MembersStep members={members} onChange={setMembers} /> : null}
      {currentStep === 2 ? (
        <PreferencesStep preferences={preferences} onChange={setPreferences} />
      ) : null}
      {currentStep === 3 ? (
        <HistoryStep history={history} mainMemberAge={mainMemberAge} onChange={setHistory} />
      ) : null}
      {currentStep === 4 ? (
        <HealthStep health={health} memberLabels={memberLabels} onChange={setHealth} />
      ) : null}
      {currentStep === 5 ? (
        <ReviewStep
          members={members}
          preferences={preferences}
          history={history}
          health={health}
          mainMemberAge={mainMemberAge}
          onEdit={setCurrentStep}
        />
      ) : null}
    </ProductQuoteWizard>
  );
}

// ── Step 1: members ───────────────────────────────────────────────────────────

function MemberFields({
  member,
  onChange,
  agePlaceholder,
  dobLabel = 'Date of birth (preferred)',
}: {
  member: MemberEntry;
  onChange: (m: MemberEntry) => void;
  agePlaceholder: string;
  dobLabel?: string;
}) {
  return (
    <FieldGrid>
      <Field small label={dobLabel}>
        {(id) => (
          <TextInput
            id={id}
            type="date"
            max={today()}
            value={member.dob}
            onChange={(dob) => onChange({ ...member, dob })}
          />
        )}
      </Field>
      <Field small label="Or age">
        {(id) => (
          <NumberInput
            id={id}
            placeholder={agePlaceholder}
            value={member.age}
            disabled={!!member.dob}
            onChange={(age) => onChange({ ...member, age })}
          />
        )}
      </Field>
    </FieldGrid>
  );
}

function MembersStep({
  members,
  onChange,
}: {
  members: MembersState;
  onChange: (m: MembersState) => void;
}) {
  const setMembershipType = (type: string) => {
    const next: MembersState = { ...members, membership_type: type };
    if (type === 'main_only') {
      next.spouse = { dob: '', age: '' };
      next.children = [];
    } else if (type === 'main_spouse') {
      next.children = [];
    } else if (type === 'family' && next.children.length === 0) {
      next.children = [{ dob: '', age: '' }];
    }
    onChange(next);
  };
  const updateChild = (index: number, child: MemberEntry) => {
    const updated = [...members.children];
    updated[index] = child;
    onChange({ ...members, children: updated });
  };
  const removeChild = (index: number) => {
    const updated = members.children.filter((_, i) => i !== index);
    onChange({ ...members, children: updated.length > 0 ? updated : [{ ...EMPTY_MEMBER }] });
  };
  const showSpouse =
    members.membership_type === 'main_spouse' || members.membership_type === 'family';

  return (
    <Step
      title="Who needs cover?"
      lead="Tell us about everyone who needs to be on the medical aid."
    >
      <Choices
        label="Membership type"
        required
        options={MEMBERSHIP_TYPES}
        value={members.membership_type}
        onChange={setMembershipType}
      />
      {members.membership_type ? (
        <Panel title="Main member">
          <MemberFields
            member={members.main}
            agePlaceholder="e.g. 34"
            onChange={(main) => onChange({ ...members, main })}
          />
        </Panel>
      ) : null}
      {showSpouse ? (
        <Panel title="Spouse / Partner">
          <MemberFields
            member={members.spouse}
            agePlaceholder="e.g. 32"
            onChange={(spouse) => onChange({ ...members, spouse })}
          />
        </Panel>
      ) : null}
      {members.membership_type === 'family' ? (
        <Panel
          title="Children"
          action={
            <button
              type="button"
              className="nw-outline nwpq-add"
              onClick={() =>
                onChange({ ...members, children: [...members.children, { ...EMPTY_MEMBER }] })
              }
            >
              Add child
            </button>
          }
        >
          {members.children.map((child, i) => (
            <div key={i} className="nwpq-child">
              <div className="nwpq-child-head">
                <span className="nwpq-child-title">Child {i + 1}</span>
                {members.children.length > 1 ? (
                  <button
                    type="button"
                    className="nwpq-link nwpq-remove"
                    aria-label={`Remove child ${i + 1}`}
                    onClick={() => removeChild(i)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <MemberFields
                member={child}
                dobLabel="Date of birth"
                agePlaceholder="e.g. 7"
                onChange={(c) => updateChild(i, c)}
              />
            </div>
          ))}
        </Panel>
      ) : null}
    </Step>
  );
}

// ── Step 2: preferences ───────────────────────────────────────────────────────

function PreferencesStep({
  preferences,
  onChange,
}: {
  preferences: PreferencesState;
  onChange: (p: PreferencesState) => void;
}) {
  const update = (field: keyof PreferencesState, value: string) =>
    onChange({ ...preferences, [field]: value });
  return (
    <Step
      title="What kind of cover do you want?"
      lead="Help us narrow down the best options for you."
    >
      <Choices
        label="Cover type"
        required
        options={COVER_TYPES}
        value={preferences.cover_type}
        onChange={(v) => update('cover_type', v)}
      />
      <Choices
        label="Network preference"
        required
        options={NETWORK_OPTIONS}
        value={preferences.network}
        onChange={(v) => update('network', v)}
      />
      <Chips
        label="Monthly budget"
        required
        options={BUDGET_BANDS}
        value={preferences.budget_band}
        onChange={(v) => update('budget_band', v)}
      />
      <Field label="Province" required>
        {(id) => (
          <SelectInput
            id={id}
            required
            placeholder="Select your province"
            options={SA_PROVINCES.map((p) => ({ value: p, label: p }))}
            value={preferences.province}
            onChange={(v) => update('province', v)}
          />
        )}
      </Field>
    </Step>
  );
}

// ── Step 3: history ───────────────────────────────────────────────────────────

function HistoryStep({
  history,
  mainMemberAge,
  onChange,
}: {
  history: MedicalAidHistoryState;
  mainMemberAge: number | null;
  onChange: (h: MedicalAidHistoryState) => void;
}) {
  const update = (field: keyof MedicalAidHistoryState, value: string) =>
    onChange({ ...history, [field]: value });
  const setStatus = (status: string) => {
    const next = { ...history, current_status: status };
    if (status === 'currently_on') {
      next.time_without_sa_medical_aid = '';
    } else {
      next.current_scheme = '';
      next.current_plan = '';
      next.current_tenure_band = '';
    }
    onChange(next);
  };
  const showLpj = mainMemberAge !== null && mainMemberAge >= 35;

  return (
    <Step
      title="Current medical aid history"
      lead="This helps us determine the best options and any applicable waiting periods."
    >
      <Choices
        label="Current cover status"
        required
        options={STATUS_OPTIONS}
        value={history.current_status}
        onChange={setStatus}
      />
      {history.current_status === 'currently_on' ? (
        <Panel>
          <Field label="Current scheme name" required>
            {(id) => (
              <SelectInput
                id={id}
                required
                placeholder="Select your scheme"
                options={COMMON_SCHEMES.map((s) => ({ value: s, label: s }))}
                value={history.current_scheme}
                onChange={(v) => update('current_scheme', v)}
              />
            )}
          </Field>
          <Field label="Current plan name" required>
            {(id) => (
              <TextInput
                id={id}
                required
                placeholder="e.g. Classic Saver"
                value={history.current_plan}
                onChange={(v) => update('current_plan', v)}
              />
            )}
          </Field>
          <Chips
            label="How long have you been on this scheme?"
            required
            options={TENURE_ON_OPTIONS}
            value={history.current_tenure_band}
            onChange={(v) => update('current_tenure_band', v)}
          />
        </Panel>
      ) : null}
      {history.current_status === 'not_currently_on' ? (
        <Panel>
          <Chips
            label="How long have you been without a South African medical aid?"
            required
            options={TENURE_OFF_OPTIONS}
            value={history.time_without_sa_medical_aid}
            onChange={(v) => update('time_without_sa_medical_aid', v)}
          />
        </Panel>
      ) : null}
      {showLpj && history.current_status ? (
        <Panel tone="warn">
          <Chips
            label="Since turning 35, how long in total have you been without a South African medical aid?"
            required
            note={
              <Note warn>
                Some schemes apply late-joiner penalties if you join later in life after being
                without cover.
              </Note>
            }
            options={LPJ_OPTIONS}
            value={history.lpj_time_off_since_35}
            onChange={(v) => update('lpj_time_off_since_35', v)}
          />
        </Panel>
      ) : null}
    </Step>
  );
}

// ── Step 4: health ────────────────────────────────────────────────────────────

function HealthStep({
  health,
  memberLabels,
  onChange,
}: {
  health: HealthState;
  memberLabels: string[];
  onChange: (h: HealthState) => void;
}) {
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  return (
    <Step
      title="Health & chronic conditions"
      lead="This helps us identify plans that cover chronic medication benefits."
    >
      <Pair
        label="Any diagnosed chronic conditions?"
        required
        options={NO_YES}
        value={health.has_chronic_conditions}
        onChange={(value) =>
          onChange({
            ...health,
            has_chronic_conditions: value,
            ...(value === false
              ? { selected_conditions: [], applies_to_members: [], notes: '' }
              : {}),
          })
        }
      />
      {health.has_chronic_conditions === true ? (
        <Panel>
          <ChipsMulti
            label="Select conditions"
            options={CHRONIC_PRESETS}
            values={health.selected_conditions}
            onToggle={(c) =>
              onChange({ ...health, selected_conditions: toggle(health.selected_conditions, c) })
            }
          />
          <Field small label="Add details (optional)">
            {(id) => (
              <TextInput
                id={id}
                placeholder="e.g. Controlled with medication"
                value={health.notes}
                onChange={(notes) => onChange({ ...health, notes })}
              />
            )}
          </Field>
          <ChipsMulti
            label="Which member(s) does this apply to?"
            required
            options={memberLabels}
            values={health.applies_to_members}
            onToggle={(m) =>
              onChange({ ...health, applies_to_members: toggle(health.applies_to_members, m) })
            }
          />
        </Panel>
      ) : null}
    </Step>
  );
}

// ── Step 5: review ────────────────────────────────────────────────────────────

function ReviewStep({
  members,
  preferences,
  history,
  health,
  mainMemberAge,
  onEdit,
}: {
  members: MembersState;
  preferences: PreferencesState;
  history: MedicalAidHistoryState;
  health: HealthState;
  mainMemberAge: number | null;
  onEdit: (step: number) => void;
}) {
  const v = (value: string | undefined) => value || '—';
  const memberRows: [string, string][] = [
    [
      'Membership type',
      v(labelOf(MEMBERSHIP_TYPES, members.membership_type) ?? members.membership_type),
    ],
    ['Main member', v(displayDob(members.main))],
  ];
  if (members.membership_type === 'main_spouse' || members.membership_type === 'family') {
    memberRows.push(['Spouse / Partner', v(displayDob(members.spouse))]);
  }
  if (members.membership_type === 'family') {
    members.children.forEach((child, i) =>
      memberRows.push([`Child ${i + 1}`, v(displayDob(child))]),
    );
  }

  const historyRows: [string, string][] = [
    [
      'Current status',
      history.current_status === 'currently_on'
        ? 'Currently on a SA medical aid'
        : history.current_status === 'not_currently_on'
          ? 'Not currently on a SA medical aid'
          : '—',
    ],
  ];
  if (history.current_status === 'currently_on') {
    historyRows.push(
      ['Scheme', v(history.current_scheme)],
      ['Plan', v(history.current_plan)],
      ['Tenure', labelOf(TENURE_ON_OPTIONS, history.current_tenure_band) ?? '—'],
    );
  }
  if (history.current_status === 'not_currently_on') {
    historyRows.push([
      'Time without medical aid',
      labelOf(TENURE_OFF_OPTIONS, history.time_without_sa_medical_aid) ?? '—',
    ]);
  }
  if (mainMemberAge !== null && mainMemberAge >= 35) {
    historyRows.push([
      'Time off since age 35 (LPJ)',
      labelOf(LPJ_OPTIONS, history.lpj_time_off_since_35) ?? '—',
    ]);
  }

  const healthRows: [string, string][] = [
    [
      'Chronic conditions',
      health.has_chronic_conditions === null ? '—' : health.has_chronic_conditions ? 'Yes' : 'No',
    ],
  ];
  if (health.has_chronic_conditions) {
    healthRows.push(
      ['Conditions', health.selected_conditions.join(', ') || '—'],
      ['Applies to', health.applies_to_members.join(', ') || '—'],
    );
    if (health.notes) healthRows.push(['Notes', health.notes]);
  }

  return (
    <Step
      title="Review & submit"
      lead="Please review your details before submitting your medical aid quote request."
    >
      <Review>
        <ReviewSection title="Members" onEdit={() => onEdit(1)}>
          <ReviewRows rows={memberRows} />
        </ReviewSection>
        <ReviewSection title="Cover Preferences" onEdit={() => onEdit(2)}>
          <ReviewRows
            rows={[
              [
                'Cover type',
                v(labelOf(COVER_TYPES, preferences.cover_type) ?? preferences.cover_type),
              ],
              ['Network', v(labelOf(NETWORK_OPTIONS, preferences.network) ?? preferences.network)],
              [
                'Monthly budget',
                v(labelOf(BUDGET_BANDS, preferences.budget_band) ?? preferences.budget_band),
              ],
              ['Province', v(preferences.province)],
            ]}
          />
        </ReviewSection>
        <ReviewSection title="Medical Aid History" onEdit={() => onEdit(3)}>
          <ReviewRows rows={historyRows} />
        </ReviewSection>
        <ReviewSection title="Health & Chronic Conditions" onEdit={() => onEdit(4)}>
          <ReviewRows rows={healthRows} />
        </ReviewSection>
      </Review>
    </Step>
  );
}
