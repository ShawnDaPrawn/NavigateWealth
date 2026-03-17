/**
 * WillDraftingFlow — Multi-step guided will drafting wizard.
 *
 * Walks a client through the key sections of a South African Last Will & Testament,
 * collects structured data across 6 steps, and persists the draft via the
 * estate-planning-fna/wills/create backend endpoint.
 *
 * Steps:
 *  1. Personal Details (pre-filled from clientDetails prop)
 *  2. Executor & Trustee Appointment
 *  3. Beneficiaries & Distribution
 *  4. Guardianship (minor children)
 *  5. Special Bequests & Wishes
 *  6. Review & Submit
 *
 * @module modules/wills/WillDraftingFlow
 */

import React, { useState, useMemo } from 'react';
import { toast } from 'sonner@2.0.3';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Textarea } from '../../ui/textarea';
import { Separator } from '../../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { cn } from '../../ui/utils';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  User,
  Shield,
  Users,
  Heart,
  Gift,
  FileText,
  Plus,
  Trash2,
  AlertCircle,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface ClientDetails {
  name: string;
  surname: string;
  email: string;
  cellphone: string;
}

interface WillDraftingFlowProps {
  clientDetails: ClientDetails;
  onComplete: () => void;
  onBack: () => void;
}

interface PersonalInfo {
  firstName: string;
  surname: string;
  idNumber: string;
  dateOfBirth: string;
  maritalStatus: string;
  spouseName: string;
  address: string;
  email: string;
  cellphone: string;
}

interface Executor {
  fullName: string;
  idNumber: string;
  relationship: string;
  cellphone: string;
  email: string;
}

interface Beneficiary {
  id: string;
  fullName: string;
  idNumber: string;
  relationship: string;
  sharePercentage: number;
  isAlternate: boolean;
}

interface Guardian {
  id: string;
  fullName: string;
  relationship: string;
  cellphone: string;
  isAlternate: boolean;
}

interface SpecialBequest {
  id: string;
  description: string;
  beneficiaryName: string;
  conditions: string;
}

// ═══════════════════════════════════════════════════════════════════
// STEP DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

const STEPS = [
  { id: 1, label: 'Personal Details', icon: User, description: 'Your personal information' },
  { id: 2, label: 'Executor', icon: Shield, description: 'Appoint your executor' },
  { id: 3, label: 'Beneficiaries', icon: Users, description: 'Who inherits your estate' },
  { id: 4, label: 'Guardianship', icon: Heart, description: 'Guardians for minor children' },
  { id: 5, label: 'Special Bequests', icon: Gift, description: 'Specific gifts & wishes' },
  { id: 6, label: 'Review & Submit', icon: FileText, description: 'Review and save your draft' },
] as const;

const MARITAL_OPTIONS = [
  'Single',
  'Married in Community of Property',
  'Married out of Community of Property (with Accrual)',
  'Married out of Community of Property (without Accrual)',
  'Divorced',
  'Widowed',
  'Civil Union',
  'Customary Marriage',
];

const RELATIONSHIP_OPTIONS = [
  'Spouse',
  'Son',
  'Daughter',
  'Child',
  'Grandchild',
  'Parent',
  'Sibling',
  'Niece/Nephew',
  'Friend',
  'Charity/Organisation',
  'Trust',
  'Other',
];

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function totalSharePercentage(beneficiaries: Beneficiary[]): number {
  return beneficiaries
    .filter((b) => !b.isAlternate)
    .reduce((sum, b) => sum + (b.sharePercentage || 0), 0);
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function WillDraftingFlow({ clientDetails, onComplete, onBack }: WillDraftingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // ── Step 1: Personal Details ─────────────────────────────────────
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: clientDetails.name,
    surname: clientDetails.surname,
    idNumber: '',
    dateOfBirth: '',
    maritalStatus: '',
    spouseName: '',
    address: '',
    email: clientDetails.email,
    cellphone: clientDetails.cellphone,
  });

  // ── Step 2: Executor ─────────────────────────────────────────────
  const [executor, setExecutor] = useState<Executor>({
    fullName: '',
    idNumber: '',
    relationship: '',
    cellphone: '',
    email: '',
  });
  const [alternateExecutor, setAlternateExecutor] = useState<Executor>({
    fullName: '',
    idNumber: '',
    relationship: '',
    cellphone: '',
    email: '',
  });

  // ── Step 3: Beneficiaries ────────────────────────────────────────
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    { id: generateId(), fullName: '', idNumber: '', relationship: '', sharePercentage: 100, isAlternate: false },
  ]);

  // ── Step 4: Guardianship ─────────────────────────────────────────
  const [hasMinorChildren, setHasMinorChildren] = useState<boolean | null>(null);
  const [guardians, setGuardians] = useState<Guardian[]>([]);

  // ── Step 5: Special Bequests ─────────────────────────────────────
  const [specialBequests, setSpecialBequests] = useState<SpecialBequest[]>([]);
  const [residualInstructions, setResidualInstructions] = useState('');
  const [funeralWishes, setFuneralWishes] = useState('');

  // ── Navigation ───────────────────────────────────────────────────
  const goNext = () => setCurrentStep((s) => Math.min(s + 1, 6));
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  // ── Validation ───────────────────────────────────────────────────
  const stepValid = useMemo(() => {
    switch (currentStep) {
      case 1:
        return !!(personalInfo.firstName.trim() && personalInfo.surname.trim() && personalInfo.email.trim());
      case 2:
        return !!(executor.fullName.trim());
      case 3:
        return beneficiaries.filter((b) => !b.isAlternate).length > 0 &&
          beneficiaries.filter((b) => !b.isAlternate).every((b) => b.fullName.trim());
      case 4:
        return hasMinorChildren !== null;
      case 5:
        return true; // optional
      case 6:
        return true;
      default:
        return false;
    }
  }, [currentStep, personalInfo, executor, beneficiaries, hasMinorChildren]);

  const shareTotal = totalSharePercentage(beneficiaries);

  // ── Submit ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

      const willData = {
        personalInfo,
        executor: {
          primary: executor,
          alternate: alternateExecutor.fullName ? alternateExecutor : null,
        },
        beneficiaries,
        guardianship: {
          hasMinorChildren,
          guardians,
        },
        specialBequests,
        residualInstructions,
        funeralWishes,
        generatedAt: new Date().toISOString(),
      };

      // Use a deterministic client ID from the email or generate one
      const clientId = personalInfo.email.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

      const response = await fetch(`${API_BASE}/estate-planning-fna/wills/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          type: 'last_will',
          data: willData,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to save will draft');
      }

      toast.success('Will draft saved successfully', {
        description: 'Your will draft has been securely stored. A financial adviser will review it.',
      });

      setIsComplete(true);
    } catch (error) {
      console.error('Failed to save will draft:', error);
      toast.error('Failed to save will draft', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // COMPLETION VIEW
  // ═══════════════════════════════════════════════════════════════════
  if (isComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full shadow-lg">
          <CardContent className="pt-8 pb-6 px-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Will Draft Saved</h2>
            <p className="text-sm text-gray-600 max-w-sm mx-auto">
              Your Last Will & Testament draft has been securely saved. A Navigate Wealth
              adviser will review the draft and contact you to discuss the next steps,
              including any legal attestation requirements.
            </p>
            <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-left">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-800">
                <strong>Important:</strong> This is a draft only. It is not legally binding until
                signed in the presence of two competent witnesses, as required by the
                Wills Act 7 of 1953 (South Africa).
              </p>
            </div>
            <Separator />
            <Button onClick={onComplete} className="w-full bg-primary hover:bg-primary/90 text-white">
              Return to Estate Planning
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP RENDERERS
  // ═══════════════════════════════════════════════════════════════════

  const updatePersonal = (field: keyof PersonalInfo, value: string) =>
    setPersonalInfo((prev) => ({ ...prev, [field]: value }));

  const updateExecutor = (target: 'primary' | 'alternate', field: keyof Executor, value: string) => {
    if (target === 'primary') {
      setExecutor((prev) => ({ ...prev, [field]: value }));
    } else {
      setAlternateExecutor((prev) => ({ ...prev, [field]: value }));
    }
  };

  const addBeneficiary = (isAlternate = false) => {
    setBeneficiaries((prev) => [
      ...prev,
      { id: generateId(), fullName: '', idNumber: '', relationship: '', sharePercentage: 0, isAlternate },
    ]);
  };

  const updateBeneficiary = (id: string, field: keyof Beneficiary, value: string | number | boolean) => {
    setBeneficiaries((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
  };

  const removeBeneficiary = (id: string) => {
    setBeneficiaries((prev) => prev.filter((b) => b.id !== id));
  };

  const addGuardian = (isAlternate = false) => {
    setGuardians((prev) => [
      ...prev,
      { id: generateId(), fullName: '', relationship: '', cellphone: '', isAlternate },
    ]);
  };

  const updateGuardian = (id: string, field: keyof Guardian, value: string | boolean) => {
    setGuardians((prev) =>
      prev.map((g) => (g.id === id ? { ...g, [field]: value } : g))
    );
  };

  const removeGuardian = (id: string) => {
    setGuardians((prev) => prev.filter((g) => g.id !== id));
  };

  const addBequest = () => {
    setSpecialBequests((prev) => [
      ...prev,
      { id: generateId(), description: '', beneficiaryName: '', conditions: '' },
    ]);
  };

  const updateBequest = (id: string, field: keyof SpecialBequest, value: string) => {
    setSpecialBequests((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
  };

  const removeBequest = (id: string) => {
    setSpecialBequests((prev) => prev.filter((b) => b.id !== id));
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top Bar ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            onClick={currentStep === 1 ? onBack : goBack}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {currentStep === 1 ? 'Back to Estate Planning' : 'Previous Step'}
          </button>
          <Badge variant="outline" className="text-xs px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border-indigo-200">
            Draft Will
          </Badge>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* ── Progress Stepper ──────────────────────────────────── */}
        <div className="hidden sm:block">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = step.id === currentStep;
              const isDone = step.id < currentStep;
              return (
                <div className="contents" key={step.id}>
                  <div className="flex flex-col items-center gap-1.5 min-w-0">
                    <div
                      className={cn(
                        'flex items-center justify-center h-9 w-9 rounded-full border-2 transition-colors',
                        isActive
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : isDone
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 bg-white text-gray-400'
                      )}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-medium text-center leading-tight max-w-[72px]',
                        isActive ? 'text-indigo-700' : isDone ? 'text-green-700' : 'text-gray-400'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2 rounded-full',
                        step.id < currentStep ? 'bg-green-400' : 'bg-gray-200'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile step indicator */}
        <div className="sm:hidden flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">
            Step {currentStep} of {STEPS.length}
          </span>
          <span className="text-sm text-gray-500">{STEPS[currentStep - 1].label}</span>
        </div>

        {/* ── Step Header ──────────────────────────────────────── */}
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
            {STEPS[currentStep - 1].label}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {STEPS[currentStep - 1].description}
          </p>
        </div>

        {/* ── Step Content ─────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardContent className="p-5 sm:p-6 space-y-5">
            {/* ═══ STEP 1: Personal Details ═══ */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={personalInfo.firstName}
                      onChange={(e) => updatePersonal('firstName', e.target.value)}
                      placeholder="e.g. Sarah"
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">
                      Surname <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={personalInfo.surname}
                      onChange={(e) => updatePersonal('surname', e.target.value)}
                      placeholder="e.g. van der Merwe"
                      className="h-10 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">SA ID Number</Label>
                    <Input
                      value={personalInfo.idNumber}
                      onChange={(e) => updatePersonal('idNumber', e.target.value)}
                      placeholder="e.g. 8501015800089"
                      maxLength={13}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Date of Birth</Label>
                    <Input
                      type="date"
                      value={personalInfo.dateOfBirth}
                      onChange={(e) => updatePersonal('dateOfBirth', e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Marital Status</Label>
                    <Select
                      value={personalInfo.maritalStatus}
                      onValueChange={(v) => updatePersonal('maritalStatus', v)}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select marital status" />
                      </SelectTrigger>
                      <SelectContent>
                        {MARITAL_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {personalInfo.maritalStatus && personalInfo.maritalStatus !== 'Single' &&
                    personalInfo.maritalStatus !== 'Divorced' && personalInfo.maritalStatus !== 'Widowed' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700">Spouse Full Name</Label>
                      <Input
                        value={personalInfo.spouseName}
                        onChange={(e) => updatePersonal('spouseName', e.target.value)}
                        placeholder="Spouse's full legal name"
                        className="h-10 text-sm"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Physical Address</Label>
                  <Textarea
                    value={personalInfo.address}
                    onChange={(e) => updatePersonal('address', e.target.value)}
                    placeholder="Full residential address"
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">
                      Email <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="email"
                      value={personalInfo.email}
                      onChange={(e) => updatePersonal('email', e.target.value)}
                      placeholder="email@example.co.za"
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Cellphone</Label>
                    <Input
                      type="tel"
                      value={personalInfo.cellphone}
                      onChange={(e) => updatePersonal('cellphone', e.target.value)}
                      placeholder="+27 82 000 0000"
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ═══ STEP 2: Executor ═══ */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800">
                    Your executor is responsible for administering your estate after death.
                    Consider appointing a trusted individual or professional estate administrator.
                  </p>
                </div>

                {/* Primary executor */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900">Primary Executor</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700">
                        Full Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={executor.fullName}
                        onChange={(e) => updateExecutor('primary', 'fullName', e.target.value)}
                        placeholder="Executor's full legal name"
                        className="h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700">ID Number</Label>
                      <Input
                        value={executor.idNumber}
                        onChange={(e) => updateExecutor('primary', 'idNumber', e.target.value)}
                        placeholder="SA ID number"
                        maxLength={13}
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700">Relationship</Label>
                      <Select
                        value={executor.relationship}
                        onValueChange={(v) => updateExecutor('primary', 'relationship', v)}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Spouse', 'Family Member', 'Friend', 'Attorney', 'Professional Executor', 'Other'].map(
                            (opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700">Cellphone</Label>
                      <Input
                        type="tel"
                        value={executor.cellphone}
                        onChange={(e) => updateExecutor('primary', 'cellphone', e.target.value)}
                        placeholder="+27 82 000 0000"
                        className="h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700">Email</Label>
                      <Input
                        type="email"
                        value={executor.email}
                        onChange={(e) => updateExecutor('primary', 'email', e.target.value)}
                        placeholder="executor@email.co.za"
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Alternate executor */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Alternate Executor{' '}
                    <span className="text-xs font-normal text-gray-400">(Recommended)</span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    If your primary executor is unable or unwilling to act, this person will take over.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700">Full Name</Label>
                      <Input
                        value={alternateExecutor.fullName}
                        onChange={(e) => updateExecutor('alternate', 'fullName', e.target.value)}
                        placeholder="Alternate executor's name"
                        className="h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700">Cellphone</Label>
                      <Input
                        type="tel"
                        value={alternateExecutor.cellphone}
                        onChange={(e) => updateExecutor('alternate', 'cellphone', e.target.value)}
                        placeholder="+27 82 000 0000"
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ STEP 3: Beneficiaries ═══ */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-800">
                    Specify who should inherit your estate and in what proportion. Share percentages
                    for primary beneficiaries should total 100%.
                  </p>
                </div>

                {/* Share percentage indicator */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border">
                  <span className="text-xs font-medium text-gray-700">Total Share Allocation</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      shareTotal === 100
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : shareTotal > 100
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    )}
                  >
                    {shareTotal}% of 100%
                  </Badge>
                </div>

                {/* Primary beneficiaries */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Primary Beneficiaries</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 gap-1"
                      onClick={() => addBeneficiary(false)}
                    >
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </div>

                  {beneficiaries
                    .filter((b) => !b.isAlternate)
                    .map((ben, idx) => (
                      <div key={ben.id} className="p-3 border rounded-lg space-y-3 bg-white">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">
                            Beneficiary {idx + 1}
                          </span>
                          {beneficiaries.filter((b) => !b.isAlternate).length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                              onClick={() => removeBeneficiary(ben.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="sm:col-span-2 space-y-1.5">
                            <Label className="text-xs font-medium text-gray-700">
                              Full Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              value={ben.fullName}
                              onChange={(e) => updateBeneficiary(ben.id, 'fullName', e.target.value)}
                              placeholder="Beneficiary's full name"
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-700">Relationship</Label>
                            <Select
                              value={ben.relationship}
                              onValueChange={(v) => updateBeneficiary(ben.id, 'relationship', v)}
                            >
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {RELATIONSHIP_OPTIONS.map((opt) => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-700">Share %</Label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={ben.sharePercentage}
                              onChange={(e) =>
                                updateBeneficiary(ben.id, 'sharePercentage', Number(e.target.value))
                              }
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-700">ID Number</Label>
                          <Input
                            value={ben.idNumber}
                            onChange={(e) => updateBeneficiary(ben.id, 'idNumber', e.target.value)}
                            placeholder="SA ID number (optional)"
                            maxLength={13}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                    ))}
                </div>

                <Separator />

                {/* Alternate beneficiaries */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Alternate Beneficiaries</h3>
                      <p className="text-xs text-gray-500">
                        If a primary beneficiary predeceases you, their share goes to the alternate.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 gap-1"
                      onClick={() => addBeneficiary(true)}
                    >
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </div>

                  {beneficiaries.filter((b) => b.isAlternate).length === 0 ? (
                    <p className="text-xs text-gray-400 italic px-3 py-2 bg-gray-50 rounded-lg">
                      No alternate beneficiaries added yet. This is optional but recommended.
                    </p>
                  ) : (
                    beneficiaries
                      .filter((b) => b.isAlternate)
                      .map((ben, idx) => (
                        <div key={ben.id} className="p-3 border rounded-lg space-y-3 bg-white border-dashed">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500">
                              Alternate {idx + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                              onClick={() => removeBeneficiary(ben.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-700">Full Name</Label>
                              <Input
                                value={ben.fullName}
                                onChange={(e) => updateBeneficiary(ben.id, 'fullName', e.target.value)}
                                placeholder="Alternate's full name"
                                className="h-9 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-700">Relationship</Label>
                              <Select
                                value={ben.relationship}
                                onValueChange={(v) => updateBeneficiary(ben.id, 'relationship', v)}
                              >
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {RELATIONSHIP_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-700">ID Number</Label>
                              <Input
                                value={ben.idNumber}
                                onChange={(e) => updateBeneficiary(ben.id, 'idNumber', e.target.value)}
                                placeholder="Optional"
                                maxLength={13}
                                className="h-9 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* ═══ STEP 4: Guardianship ═══ */}
            {currentStep === 4 && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-900">
                    Do you have minor children (under 18)?{' '}
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={hasMinorChildren === true ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setHasMinorChildren(true);
                        if (guardians.length === 0) addGuardian(false);
                      }}
                      className={cn(
                        'min-w-[80px]',
                        hasMinorChildren === true && 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      )}
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      variant={hasMinorChildren === false ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setHasMinorChildren(false);
                        setGuardians([]);
                      }}
                      className={cn(
                        'min-w-[80px]',
                        hasMinorChildren === false && 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      )}
                    >
                      No
                    </Button>
                  </div>
                </div>

                {hasMinorChildren && (
                  <div className="space-y-4">
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-800">
                        Under South African law, guardianship nominations in a will are not automatically
                        binding. The High Court (Upper Guardian) has the final say but will give strong
                        weight to your documented wishes.
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">Nominated Guardians</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => addGuardian(false)}
                      >
                        <Plus className="h-3 w-3" /> Add Guardian
                      </Button>
                    </div>

                    {guardians
                      .filter((g) => !g.isAlternate)
                      .map((guard, idx) => (
                        <div key={guard.id} className="p-3 border rounded-lg space-y-3 bg-white">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500">
                              Guardian {idx + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                              onClick={() => removeGuardian(guard.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-700">Full Name</Label>
                              <Input
                                value={guard.fullName}
                                onChange={(e) => updateGuardian(guard.id, 'fullName', e.target.value)}
                                placeholder="Guardian's full name"
                                className="h-9 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-700">Relationship</Label>
                              <Select
                                value={guard.relationship}
                                onValueChange={(v) => updateGuardian(guard.id, 'relationship', v)}
                              >
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {RELATIONSHIP_OPTIONS.filter((r) => r !== 'Charity/Organisation' && r !== 'Trust').map(
                                    (opt) => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-700">Cellphone</Label>
                              <Input
                                type="tel"
                                value={guard.cellphone}
                                onChange={(e) => updateGuardian(guard.id, 'cellphone', e.target.value)}
                                placeholder="+27 82 000 0000"
                                className="h-9 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Alternate Guardian</h3>
                        <p className="text-xs text-gray-500">If your primary guardian is unable to act.</p>
                      </div>
                      {guardians.filter((g) => g.isAlternate).length === 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 gap-1"
                          onClick={() => addGuardian(true)}
                        >
                          <Plus className="h-3 w-3" /> Add
                        </Button>
                      )}
                    </div>

                    {guardians
                      .filter((g) => g.isAlternate)
                      .map((guard) => (
                        <div key={guard.id} className="p-3 border border-dashed rounded-lg space-y-3 bg-white">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-700">Full Name</Label>
                              <Input
                                value={guard.fullName}
                                onChange={(e) => updateGuardian(guard.id, 'fullName', e.target.value)}
                                placeholder="Alternate guardian's name"
                                className="h-9 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-700">Cellphone</Label>
                              <Input
                                type="tel"
                                value={guard.cellphone}
                                onChange={(e) => updateGuardian(guard.id, 'cellphone', e.target.value)}
                                placeholder="+27 82 000 0000"
                                className="h-9 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {hasMinorChildren === false && (
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-green-800">
                      No guardianship clause is needed. You can proceed to the next step.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ═══ STEP 5: Special Bequests ═══ */}
            {currentStep === 5 && (
              <div className="space-y-5">
                <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-800">
                    Special bequests are specific items or amounts you wish to leave to
                    specific people (e.g., a family heirloom, a cash gift, property).
                    These are distributed before the residual estate.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Specific Bequests</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 gap-1"
                    onClick={addBequest}
                  >
                    <Plus className="h-3 w-3" /> Add Bequest
                  </Button>
                </div>

                {specialBequests.length === 0 ? (
                  <p className="text-xs text-gray-400 italic px-3 py-2 bg-gray-50 rounded-lg">
                    No specific bequests added. This section is optional.
                  </p>
                ) : (
                  specialBequests.map((bequest, idx) => (
                    <div key={bequest.id} className="p-3 border rounded-lg space-y-3 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">
                          Bequest {idx + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                          onClick={() => removeBequest(bequest.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-700">
                            Item / Amount Description
                          </Label>
                          <Input
                            value={bequest.description}
                            onChange={(e) => updateBequest(bequest.id, 'description', e.target.value)}
                            placeholder="e.g. My diamond ring, R50,000 cash"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-700">Beneficiary Name</Label>
                          <Input
                            value={bequest.beneficiaryName}
                            onChange={(e) =>
                              updateBequest(bequest.id, 'beneficiaryName', e.target.value)
                            }
                            placeholder="Who receives this bequest"
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-700">
                          Conditions <span className="text-xs font-normal text-gray-400">(optional)</span>
                        </Label>
                        <Textarea
                          value={bequest.conditions}
                          onChange={(e) => updateBequest(bequest.id, 'conditions', e.target.value)}
                          placeholder="e.g. Only upon reaching age 25"
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </div>
                    </div>
                  ))
                )}

                <Separator />

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">Residual Estate Instructions</h3>
                  <p className="text-xs text-gray-500">
                    Instructions for whatever remains after debts, taxes, and special bequests are settled.
                    If left blank, the residual estate will be distributed to your beneficiaries per the
                    percentages specified in Step 3.
                  </p>
                  <Textarea
                    value={residualInstructions}
                    onChange={(e) => setResidualInstructions(e.target.value)}
                    placeholder="e.g. My residual estate should be divided equally among my children."
                    rows={3}
                    className="text-sm resize-none"
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Funeral Wishes{' '}
                    <span className="text-xs font-normal text-gray-400">(optional)</span>
                  </h3>
                  <Textarea
                    value={funeralWishes}
                    onChange={(e) => setFuneralWishes(e.target.value)}
                    placeholder="e.g. I wish to be cremated / I prefer a burial at..."
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              </div>
            )}

            {/* ═══ STEP 6: Review & Submit ═══ */}
            {currentStep === 6 && (
              <div className="space-y-5">
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800">
                    Please review all details below before submitting. This will be saved as a
                    <strong> draft</strong> for professional review by a Navigate Wealth adviser.
                  </p>
                </div>

                {/* Personal details summary */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <User className="h-4 w-4 text-indigo-500" />
                    Personal Details
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                    <p className="text-gray-900 font-medium">
                      {personalInfo.firstName} {personalInfo.surname}
                    </p>
                    {personalInfo.idNumber && (
                      <p className="text-gray-600 text-xs">ID: {personalInfo.idNumber}</p>
                    )}
                    <p className="text-gray-600 text-xs">{personalInfo.email}</p>
                    {personalInfo.maritalStatus && (
                      <p className="text-gray-600 text-xs">
                        {personalInfo.maritalStatus}
                        {personalInfo.spouseName && ` - Spouse: ${personalInfo.spouseName}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Executor summary */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-indigo-500" />
                    Executor
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                    <p className="text-gray-900 font-medium">{executor.fullName || 'Not specified'}</p>
                    {executor.relationship && (
                      <p className="text-gray-600 text-xs">{executor.relationship}</p>
                    )}
                    {alternateExecutor.fullName && (
                      <p className="text-gray-500 text-xs">
                        Alternate: {alternateExecutor.fullName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Beneficiaries summary */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-500" />
                    Beneficiaries
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                    {beneficiaries
                      .filter((b) => !b.isAlternate)
                      .map((b) => (
                        <div key={b.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-900">
                            {b.fullName || 'Unnamed'}
                            {b.relationship && (
                              <span className="text-gray-500 text-xs ml-1">({b.relationship})</span>
                            )}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200"
                          >
                            {b.sharePercentage}%
                          </Badge>
                        </div>
                      ))}
                    {beneficiaries.filter((b) => b.isAlternate).length > 0 && (
                      <div className="pt-1 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Alternates:</p>
                        {beneficiaries
                          .filter((b) => b.isAlternate)
                          .map((b) => (
                            <p key={b.id} className="text-xs text-gray-600">
                              {b.fullName || 'Unnamed'}
                            </p>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Guardianship summary */}
                {hasMinorChildren && guardians.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Heart className="h-4 w-4 text-indigo-500" />
                      Guardianship
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                      {guardians.map((g) => (
                        <p key={g.id} className="text-sm text-gray-900">
                          {g.fullName}
                          {g.isAlternate && (
                            <span className="text-xs text-gray-500 ml-1">(alternate)</span>
                          )}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Special bequests summary */}
                {specialBequests.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Gift className="h-4 w-4 text-indigo-500" />
                      Special Bequests
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                      {specialBequests.map((b) => (
                        <div key={b.id} className="text-sm">
                          <span className="text-gray-900">{b.description}</span>
                          <span className="text-gray-500 text-xs ml-1">
                            &rarr; {b.beneficiaryName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Residual estate / funeral */}
                {(residualInstructions || funeralWishes) && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-500" />
                      Additional Instructions
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                      {residualInstructions && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-0.5">Residual Estate</p>
                          <p className="text-gray-800">{residualInstructions}</p>
                        </div>
                      )}
                      {funeralWishes && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-0.5">Funeral Wishes</p>
                          <p className="text-gray-800">{funeralWishes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Legal disclaimer */}
                <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg">
                  <FileText className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>
                      By submitting this draft, I acknowledge that it is a <strong>preliminary document</strong>{' '}
                      and does not constitute a legally binding will until:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Reviewed and finalised by a qualified professional</li>
                      <li>Signed by the testator in the presence of two competent witnesses</li>
                      <li>
                        All parties have signed in compliance with the Wills Act 7 of 1953 (South Africa)
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Navigation Footer ────────────────────────────────── */}
        <div className="flex items-center justify-between pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={currentStep === 1 ? onBack : goBack}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>

          {currentStep < 6 ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={!stepValid}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white min-w-[160px]"
            >
              {isSubmitting ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving Draft...
                </div>
              ) : (
                <div className="contents">
                  <FileText className="h-4 w-4" />
                  Save Will Draft
                </div>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
