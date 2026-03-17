/**
 * EstatePlanningQuoteWizard — Phase 2 Estate Planning "Get a Quote" Wizard
 *
 * Purpose: Capture what type of estate planning assistance the client requires.
 *
 * 3-step wizard + Review & Submit:
 *   Step 1: What do you need assistance with? (Will, Living Will, Both, Not sure)
 *   Step 2: Existing documents (current Will/Living Will status + replacement intent)
 *   Step 3: Basic context (marital status, minor children, trusts, offshore assets)
 *   Step 4: Review & Submit
 *
 * Hard rules:
 * - No asset breakdown, no beneficiary capture, no executor appointment
 * - No detailed legal drafting, no uploads
 * - Intention capture only
 *
 * §7  — Presentation layer (UI only, no business logic)
 * §5.3 — Constants centralised below
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner@2.0.3';
import { Button } from '../../../ui/button';
import { Label } from '../../../ui/label';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  FileText,
  FolderSearch,
  User,
  ClipboardList,
  Loader2,
  Info,
  Pencil,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

// ── Constants (§5.3) ────────────────────────────────────────────────────────────

const DRAFT_KEY = 'nw_estate_planning_quote_draft';

interface DocumentOption {
  id: string;
  label: string;
  info: string;
}

const DOCUMENT_OPTIONS: DocumentOption[] = [
  {
    id: 'last_will',
    label: 'Last Will & Testament',
    info: 'A legal document that sets out how your assets must be distributed when you pass away and who will administer your estate.',
  },
  {
    id: 'living_will',
    label: 'Living Will (Advance Healthcare Directive)',
    info: 'A document that records your medical wishes should you become unable to communicate decisions about life-sustaining treatment.',
  },
  {
    id: 'both',
    label: 'Both Last Will & Testament and Living Will',
    info: '',
  },
  {
    id: 'not_sure',
    label: 'Not sure — require adviser assistance',
    info: "We'll guide you on what documents are appropriate for your situation.",
  },
];

const YES_NO_NOTSURE = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'life_partner', label: 'Life partner' },
] as const;

// ── State types ─────────────────────────────────────────────────────────────────

interface ExistingDocsState {
  has_valid_will: string;          // 'yes' | 'no' | 'not_sure' | ''
  replace_existing_will: string;   // 'yes' | 'no' | 'not_sure' | ''
  has_living_will: string;         // 'yes' | 'no' | 'not_sure' | ''
  replace_existing_living_will: string; // 'yes' | 'no' | 'not_sure' | ''
}

interface ContextState {
  marital_status: string;
  married_in_community: string;    // 'yes' | 'no' | 'not_sure' | ''
  has_minor_children: string;      // 'yes' | 'no' | ''
  has_trusts: string;              // 'yes' | 'no' | ''
  has_offshore_assets: string;     // 'yes' | 'no' | ''
}

interface WizardDraft {
  selected_document: string;
  existing_docs: ExistingDocsState;
  context: ContextState;
  currentStep: number;
}

// ── Props ───────────────────────────────────────────────────────────────────────

interface EstatePlanningQuoteWizardProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  parentSubmissionId?: string;
  onSuccess: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function getInitialExistingDocs(): ExistingDocsState {
  return { has_valid_will: '', replace_existing_will: '', has_living_will: '', replace_existing_living_will: '' };
}

function getInitialContext(): ContextState {
  return { marital_status: '', married_in_community: '', has_minor_children: '', has_trusts: '', has_offshore_assets: '' };
}

function loadDraft(): WizardDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveDraft(draft: WizardDraft) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* non-critical */ }
}

function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* non-critical */ }
}

function ynsLabel(val: string): string {
  if (val === 'yes') return 'Yes';
  if (val === 'no') return 'No';
  if (val === 'not_sure') return 'Not sure';
  return '—';
}

// ── Step Indicator ──────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Documents', icon: FileText },
    { num: 2, label: 'Existing', icon: FolderSearch },
    { num: 3, label: 'Context', icon: User },
    { num: 4, label: 'Review', icon: ClipboardList },
  ];

  return (
    <div className="flex items-center justify-between w-full mb-6">
      {steps.map((step, idx) => {
        const isCompleted = currentStep > step.num;
        const isActive = currentStep === step.num;
        const IconComp = step.icon;
        return (
          <React.Fragment key={step.num}>
            {idx > 0 && (
              <div className={`flex-1 h-0.5 mx-1 sm:mx-2 transition-colors ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isCompleted
                    ? 'bg-green-600 text-white'
                    : isActive
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}
              >
                {isCompleted ? <CheckCircle className="h-4 w-4" /> : <IconComp className="h-4 w-4" />}
              </div>
              <span className={`text-[10px] sm:text-xs font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step 1: Document Type ───────────────────────────────────────────────────────

function Step1DocumentType({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">What estate planning assistance do you need?</h2>
        <p className="text-sm text-gray-500">Select the document(s) you'd like help with.</p>
      </div>

      <div className="space-y-2">
        {DOCUMENT_OPTIONS.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-primary/50 bg-primary/[0.03] shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                isSelected ? 'border-primary' : 'border-gray-300'
              }`}>
                {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-gray-900 text-sm">{opt.label}</span>
                {opt.info && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-400" />
                    {opt.info}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: Existing Documents ──────────────────────────────────────────────────

function Step2ExistingDocs({
  selectedDocument,
  existingDocs,
  onChange,
}: {
  selectedDocument: string;
  existingDocs: ExistingDocsState;
  onChange: (d: ExistingDocsState) => void;
}) {
  const showWillQuestions = selectedDocument === 'last_will' || selectedDocument === 'both' || selectedDocument === 'not_sure';
  const showLivingWillQuestions = selectedDocument === 'living_will' || selectedDocument === 'both' || selectedDocument === 'not_sure';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Do you already have estate documents in place?</h2>
        <p className="text-sm text-gray-500">This helps your adviser understand whether we're creating new documents or replacing existing ones.</p>
      </div>

      {/* Last Will */}
      {showWillQuestions && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-gray-700">
            Do you currently have a valid Last Will & Testament? <span className="text-red-500">*</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {YES_NO_NOTSURE.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({
                  ...existingDocs,
                  has_valid_will: opt.value,
                  replace_existing_will: opt.value !== 'yes' ? '' : existingDocs.replace_existing_will,
                })}
                className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                  existingDocs.has_valid_will === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {existingDocs.has_valid_will === 'yes' && (
            <div className="ml-4 pl-3 border-l-2 border-gray-200 space-y-2">
              <Label className="text-xs font-medium text-gray-600">
                Do you want to replace your existing Will? <span className="text-red-500">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {YES_NO_NOTSURE.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ ...existingDocs, replace_existing_will: opt.value })}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      existingDocs.replace_existing_will === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Living Will */}
      {showLivingWillQuestions && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-gray-700">
            Do you currently have a Living Will? <span className="text-red-500">*</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {YES_NO_NOTSURE.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({
                  ...existingDocs,
                  has_living_will: opt.value,
                  replace_existing_living_will: opt.value !== 'yes' ? '' : existingDocs.replace_existing_living_will,
                })}
                className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                  existingDocs.has_living_will === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {existingDocs.has_living_will === 'yes' && (
            <div className="ml-4 pl-3 border-l-2 border-gray-200 space-y-2">
              <Label className="text-xs font-medium text-gray-600">
                Do you want to replace your existing Living Will? <span className="text-red-500">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {YES_NO_NOTSURE.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ ...existingDocs, replace_existing_living_will: opt.value })}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      existingDocs.replace_existing_living_will === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 3: Basic Context ───────────────────────────────────────────────────────

function Step3Context({
  context,
  onChange,
}: {
  context: ContextState;
  onChange: (c: ContextState) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">A few quick details</h2>
        <p className="text-sm text-gray-500">High-level context to help your adviser prepare the right recommendation.</p>
      </div>

      {/* Marital status */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Marital status <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {MARITAL_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({
                ...context,
                marital_status: opt.value,
                married_in_community: opt.value === 'married' ? context.married_in_community : '',
              })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                context.marital_status === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Community of property (conditional) */}
      {context.marital_status === 'married' && (
        <div className="ml-4 pl-3 border-l-2 border-gray-200 space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Are you married in community of property? <span className="text-red-500">*</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {YES_NO_NOTSURE.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...context, married_in_community: opt.value })}
                className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                  context.married_in_community === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Minor children */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Do you have minor children? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2 max-w-xs">
          {YES_NO.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...context, has_minor_children: opt.value })}
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                context.has_minor_children === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trusts */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Do you currently have any trusts in place? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2 max-w-xs">
          {YES_NO.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...context, has_trusts: opt.value })}
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                context.has_trusts === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Offshore assets */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Do you have significant offshore assets? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2 max-w-xs">
          {YES_NO.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...context, has_offshore_assets: opt.value })}
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                context.has_offshore_assets === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Review ──────────────────────────────────────────────────────────────

function Step4Review({
  selectedDocument,
  existingDocs,
  context,
  onEditStep,
}: {
  selectedDocument: string;
  existingDocs: ExistingDocsState;
  context: ContextState;
  onEditStep: (step: number) => void;
}) {
  const documentLabel = DOCUMENT_OPTIONS.find((d) => d.id === selectedDocument)?.label ?? selectedDocument;
  const maritalLabel = MARITAL_STATUS_OPTIONS.find((m) => m.value === context.marital_status)?.label ?? '';

  const showWillQuestions = selectedDocument === 'last_will' || selectedDocument === 'both' || selectedDocument === 'not_sure';
  const showLivingWillQuestions = selectedDocument === 'living_will' || selectedDocument === 'both' || selectedDocument === 'not_sure';

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
        <p className="text-sm text-gray-500">Please review your details before submitting your estate planning quote request.</p>
      </div>

      {/* Document type */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Estate Planning Documents" step={1} />
        <Row label="Selected document(s)" value={documentLabel} />
      </div>

      {/* Existing documents */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Existing Documents" step={2} />
        {showWillQuestions && (
          <div className="contents">
            <Row label="Has valid Last Will" value={ynsLabel(existingDocs.has_valid_will)} />
            {existingDocs.has_valid_will === 'yes' && (
              <Row label="Replace existing Will" value={ynsLabel(existingDocs.replace_existing_will)} />
            )}
          </div>
        )}
        {showLivingWillQuestions && (
          <div className="contents">
            <Row label="Has Living Will" value={ynsLabel(existingDocs.has_living_will)} />
            {existingDocs.has_living_will === 'yes' && (
              <Row label="Replace existing Living Will" value={ynsLabel(existingDocs.replace_existing_living_will)} />
            )}
          </div>
        )}
      </div>

      {/* Context */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Personal Context" step={3} />
        <Row label="Marital status" value={maritalLabel} />
        {context.marital_status === 'married' && (
          <Row label="Married in community of property" value={ynsLabel(context.married_in_community)} />
        )}
        <Row label="Minor children" value={ynsLabel(context.has_minor_children)} />
        <Row label="Trusts in place" value={ynsLabel(context.has_trusts)} />
        <Row label="Significant offshore assets" value={ynsLabel(context.has_offshore_assets)} />
      </div>
    </div>
  );
}

// ── Main wizard component ───────────────────────────────────────────────────────

export function EstatePlanningQuoteWizard({
  firstName,
  lastName,
  email,
  phone,
  parentSubmissionId,
  onSuccess,
}: EstatePlanningQuoteWizardProps) {
  const draft = loadDraft();
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [selectedDocument, setSelectedDocument] = useState(draft?.selected_document ?? '');
  const [existingDocs, setExistingDocs] = useState<ExistingDocsState>(draft?.existing_docs ?? getInitialExistingDocs());
  const [context, setContext] = useState<ContextState>(draft?.context ?? getInitialContext());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist draft
  useEffect(() => {
    saveDraft({
      selected_document: selectedDocument,
      existing_docs: existingDocs,
      context,
      currentStep,
    });
  }, [selectedDocument, existingDocs, context, currentStep]);

  // ── Validation ──

  const step1Valid = useMemo(() => Boolean(selectedDocument), [selectedDocument]);

  const step2Valid = useMemo(() => {
    const showWill = selectedDocument === 'last_will' || selectedDocument === 'both' || selectedDocument === 'not_sure';
    const showLiving = selectedDocument === 'living_will' || selectedDocument === 'both' || selectedDocument === 'not_sure';

    if (showWill) {
      if (!existingDocs.has_valid_will) return false;
      if (existingDocs.has_valid_will === 'yes' && !existingDocs.replace_existing_will) return false;
    }
    if (showLiving) {
      if (!existingDocs.has_living_will) return false;
      if (existingDocs.has_living_will === 'yes' && !existingDocs.replace_existing_living_will) return false;
    }
    return true;
  }, [selectedDocument, existingDocs]);

  const step3Valid = useMemo(() => {
    if (!context.marital_status) return false;
    if (context.marital_status === 'married' && !context.married_in_community) return false;
    return Boolean(context.has_minor_children && context.has_trusts && context.has_offshore_assets);
  }, [context]);

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1: return step1Valid;
      case 2: return step2Valid;
      case 3: return step3Valid;
      case 4: return true;
      default: return false;
    }
  }, [currentStep, step1Valid, step2Valid, step3Valid]);

  const goNext = useCallback(() => { if (currentStep < 4) setCurrentStep((s) => s + 1); }, [currentStep]);
  const goBack = useCallback(() => { if (currentStep > 1) setCurrentStep((s) => s - 1); }, [currentStep]);
  const goToStep = useCallback((step: number) => { setCurrentStep(step); }, []);

  // ── Submit ──

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const documentLabel = DOCUMENT_OPTIONS.find((d) => d.id === selectedDocument)?.label ?? selectedDocument;
      const maritalLabel = MARITAL_STATUS_OPTIONS.find((m) => m.value === context.marital_status)?.label ?? context.marital_status;

      const productDetails = {
        vertical: 'EstatePlanning',
        phase: 2,
        selected_document: documentLabel,
        selected_document_id: selectedDocument,
        existing_documents: {
          has_valid_will: ynsLabel(existingDocs.has_valid_will),
          has_valid_will_id: existingDocs.has_valid_will,
          replace_existing_will: existingDocs.has_valid_will === 'yes' ? ynsLabel(existingDocs.replace_existing_will) : null,
          replace_existing_will_id: existingDocs.has_valid_will === 'yes' ? existingDocs.replace_existing_will : null,
          has_living_will: ynsLabel(existingDocs.has_living_will),
          has_living_will_id: existingDocs.has_living_will,
          replace_existing_living_will: existingDocs.has_living_will === 'yes' ? ynsLabel(existingDocs.replace_existing_living_will) : null,
          replace_existing_living_will_id: existingDocs.has_living_will === 'yes' ? existingDocs.replace_existing_living_will : null,
        },
        personal_context: {
          marital_status: maritalLabel,
          marital_status_id: context.marital_status,
          married_in_community: context.marital_status === 'married' ? ynsLabel(context.married_in_community) : null,
          married_in_community_id: context.marital_status === 'married' ? context.married_in_community : null,
          has_minor_children: ynsLabel(context.has_minor_children),
          has_trusts: ynsLabel(context.has_trusts),
          has_offshore_assets: ynsLabel(context.has_offshore_assets),
        },
        metadata: {
          source: 'NavigateWealthApp',
          submitted_at: new Date().toISOString(),
          status: 'submitted',
        },
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/quote-request/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            productName: 'Estate Planning',
            stage: 'full',
            service: 'estate-planning',
            parentSubmissionId: parentSubmissionId ?? undefined,
            productDetails,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        console.error('Estate planning quote submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      clearDraft();
      toast.success('Your estate planning quote request has been submitted!');
      onSuccess();
    } catch (error) {
      console.error('Estate planning quote network error:', error);
      toast.error('Unable to submit your request. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [firstName, lastName, email, phone, parentSubmissionId, selectedDocument, existingDocs, context, onSuccess]);

  // ── Render ──

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} />

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6">
          {currentStep === 1 && <Step1DocumentType selected={selectedDocument} onChange={setSelectedDocument} />}
          {currentStep === 2 && (
            <Step2ExistingDocs
              selectedDocument={selectedDocument}
              existingDocs={existingDocs}
              onChange={setExistingDocs}
            />
          )}
          {currentStep === 3 && <Step3Context context={context} onChange={setContext} />}
          {currentStep === 4 && (
            <Step4Review
              selectedDocument={selectedDocument}
              existingDocs={existingDocs}
              context={context}
              onEditStep={goToStep}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-t border-gray-100 bg-gray-50/50">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 1}
            className="h-11 px-5"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {currentStep < 4 ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={!canProceed}
              className="h-11 px-6 font-semibold"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-11 px-6 font-semibold"
            >
              {isSubmitting ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </div>
              ) : (
                <div className="contents">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit Quote Request
                </div>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
