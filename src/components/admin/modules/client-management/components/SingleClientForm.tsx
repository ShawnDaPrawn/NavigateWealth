import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Checkbox } from '../../../../ui/checkbox';
import { Badge } from '../../../../ui/badge';
import { toast } from 'sonner@2.0.3';
import {
  Loader2,
  User,
  MapPin,
  Briefcase,
  Target,
  ShieldCheck,
  Info,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { api } from '../../../../../utils/api/client';

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

const NAME_REGEX = /^[a-zA-ZÀ-ÿ' -]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?\d[\d\s()-]{7,18}$/;
const SA_TAX_REGEX = /^\d{10}$/;
const SA_POSTAL_REGEX = /^\d{4}$/;

// ---------------------------------------------------------------------------
// SA ID Validation — Luhn checksum + structure
// ---------------------------------------------------------------------------
function validateSaIdNumber(id: string): { valid: boolean; error?: string; dob?: string; gender?: string } {
  const clean = id.replace(/\s/g, '');
  if (clean.length !== 13) return { valid: false, error: 'SA ID must be exactly 13 digits' };
  if (!/^\d{13}$/.test(clean)) return { valid: false, error: 'SA ID must contain only digits' };

  // Extract DOB (YYMMDD)
  const yy = parseInt(clean.substring(0, 2), 10);
  const mm = parseInt(clean.substring(2, 4), 10);
  const dd = parseInt(clean.substring(4, 6), 10);
  if (mm < 1 || mm > 12) return { valid: false, error: 'Invalid month in SA ID (positions 3-4)' };
  if (dd < 1 || dd > 31) return { valid: false, error: 'Invalid day in SA ID (positions 5-6)' };

  // Determine century: if yy > current 2-digit year → 1900s, else → 2000s
  const currentYY = new Date().getFullYear() % 100;
  const century = yy > currentYY ? 1900 : 2000;
  const fullYear = century + yy;
  const dateStr = `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime()) || parsed.getMonth() + 1 !== mm || parsed.getDate() !== dd) {
    return { valid: false, error: 'Invalid date of birth encoded in SA ID' };
  }

  // Gender: digit 7 (index 6). 0-4 = Female, 5-9 = Male
  const genderDigit = parseInt(clean[6], 10);
  const gender = genderDigit >= 5 ? 'Male' : 'Female';

  // Luhn checksum
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let digit = parseInt(clean[i], 10);
    if (i % 2 !== 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  if (sum % 10 !== 0) return { valid: false, error: 'SA ID checksum is invalid' };

  return { valid: true, dob: dateStr, gender };
}

function computeAge(dobStr: string): number | null {
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const mDiff = today.getMonth() - dob.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type FormField = string;
type FieldErrors = Record<FormField, string | undefined>;

interface SingleClientFormProps {
  onSuccess: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Field-level validation
// ---------------------------------------------------------------------------
function validateField(
  field: string,
  value: string,
  formData: Record<string, string>,
): string | undefined {
  const v = value.trim();

  switch (field) {
    // ── Required names ──
    case 'firstName':
      if (!v) return 'First name is required';
      if (v.length < 2) return 'Must be at least 2 characters';
      if (!NAME_REGEX.test(v)) return 'Name should contain only letters, hyphens, or apostrophes';
      return undefined;

    case 'lastName':
      if (!v) return 'Last name is required';
      if (v.length < 2) return 'Must be at least 2 characters';
      if (!NAME_REGEX.test(v)) return 'Name should contain only letters, hyphens, or apostrophes';
      return undefined;

    case 'middleName':
      if (v && !NAME_REGEX.test(v)) return 'Name should contain only letters, hyphens, or apostrophes';
      return undefined;

    case 'preferredName':
      if (v && !NAME_REGEX.test(v)) return 'Name should contain only letters, hyphens, or apostrophes';
      return undefined;

    // ── Email ──
    case 'emailAddress':
      if (!v) return 'Email address is required';
      if (!EMAIL_REGEX.test(v)) return 'Please enter a valid email address';
      return undefined;

    case 'alternativeEmail':
      if (!v) return undefined;
      if (!EMAIL_REGEX.test(v)) return 'Please enter a valid email address';
      if (v.toLowerCase() === formData.emailAddress?.trim().toLowerCase())
        return 'Alternative email must be different from the primary email';
      return undefined;

    // ── Phone ──
    case 'cellphoneNumber':
      if (!v) return 'Cellphone number is required';
      if (!PHONE_REGEX.test(v)) return 'Enter a valid phone number (e.g. +27 82 123 4567)';
      return undefined;

    case 'whatsappNumber':
      if (!v) return undefined;
      if (!PHONE_REGEX.test(v)) return 'Enter a valid phone number';
      return undefined;

    // ── Date of birth ──
    case 'dateOfBirth': {
      if (!v) return undefined;
      const dob = new Date(v);
      if (isNaN(dob.getTime())) return 'Invalid date';
      if (dob > new Date()) return 'Date of birth cannot be in the future';
      const age = computeAge(v);
      if (age !== null && age < 18) return 'Client must be at least 18 years old';
      if (age !== null && age > 120) return 'Please verify the date of birth';
      return undefined;
    }

    // ── SA ID / Passport ──
    case 'idNumber': {
      if (!v) return undefined;
      if (formData.idType === 'sa_id') {
        const result = validateSaIdNumber(v);
        if (!result.valid) return result.error;
        // Cross-check DOB if both are provided
        if (result.dob && formData.dateOfBirth) {
          if (result.dob !== formData.dateOfBirth)
            return 'ID number date of birth does not match the Date of Birth field';
        }
        // Cross-check gender
        if (result.gender && formData.gender && formData.gender !== 'Other' && formData.gender !== 'Prefer not to say') {
          if (result.gender !== formData.gender)
            return `ID number indicates ${result.gender}, but Gender is set to ${formData.gender}`;
        }
      } else if (formData.idType === 'passport') {
        if (v.length < 5) return 'Passport number seems too short';
        if (v.length > 20) return 'Passport number seems too long';
      }
      return undefined;
    }

    // ── Tax ──
    case 'taxNumber':
      if (!v) return undefined;
      if (!SA_TAX_REGEX.test(v)) return 'SA tax number must be exactly 10 digits';
      return undefined;

    // ── Marital regime (conditionally required) ──
    case 'maritalRegime': {
      const needsRegime = formData.maritalStatus === 'Married' || formData.maritalStatus === 'Life Partner';
      if (needsRegime && !v) return 'Marital regime is required when married or in a life partnership';
      return undefined;
    }

    // ── Address ──
    case 'residentialPostalCode':
      if (!v) return undefined;
      if (formData.residentialCountry === 'South Africa' && !SA_POSTAL_REGEX.test(v))
        return 'SA postal code must be 4 digits';
      return undefined;

    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FormSection({
  icon: Icon,
  title,
  description,
  badge,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-[#6d28d9]" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900">{title}</h3>
            {description && (
              <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {badge}
      </div>
      <div className="px-5 pb-5 pt-1">{children}</div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
  );
}

/** Inline error message shown below a field — supports aria-describedby via id prop */
function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1 mt-1 text-[11px] text-red-600 leading-tight">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function SingleClientForm({ onSuccess, onClose }: SingleClientFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [idAutofilled, setIdAutofilled] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    firstName: '',
    middleName: '',
    preferredName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    nationality: 'South Africa',
    idType: '' as '' | 'sa_id' | 'passport',
    idNumber: '',
    taxNumber: '',
    maritalStatus: '',
    maritalRegime: '',
    emailAddress: '',
    alternativeEmail: '',
    cellphoneNumber: '',
    alternativeCellphone: '',
    whatsappNumber: '',
    preferredContactMethod: '',
    residentialAddressLine1: '',
    residentialAddressLine2: '',
    residentialSuburb: '',
    residentialCity: '',
    residentialProvince: '',
    residentialPostalCode: '',
    residentialCountry: 'South Africa',
    employmentStatus: '',
    jobTitle: '',
    employerName: '',
    industry: '',
    grossMonthlyIncome: '',
    financialGoals: '',
  });

  // --- helpers ---
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const runValidation = useCallback((field: string, value: string, data?: Record<string, string>) => {
    return validateField(field, value, data ?? formDataRef.current);
  }, []);

  const update = useCallback((field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };

      // Auto-populate DOB + Gender from SA ID when user types a valid ID
      if (field === 'idNumber' && next.idType === 'sa_id') {
        const clean = value.replace(/\s/g, '');
        if (clean.length === 13) {
          const result = validateSaIdNumber(clean);
          if (result.valid) {
            if (result.dob && !prev.dateOfBirth) {
              next.dateOfBirth = result.dob;
              setIdAutofilled(true);
              // Clear any DOB error that may have existed
              setErrors(e => ({ ...e, dateOfBirth: undefined }));
            }
            if (result.gender && !prev.gender) {
              next.gender = result.gender;
            }
          }
        }
      }

      // Clear error for the changed field on input
      setErrors(e => {
        const err = validateField(field, value, next);
        return { ...e, [field]: err };
      });

      return next;
    });
  }, []);

  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setErrors(prev => ({
      ...prev,
      [field]: runValidation(field, formDataRef.current[field as keyof typeof formDataRef.current] || ''),
    }));
  }, [runValidation]);

  const showError = (field: string) => (touched[field] || submitAttempted) ? errors[field] : undefined;

  const showSpouseFields = formData.maritalStatus === 'Married' || formData.maritalStatus === 'Life Partner';

  // Completion tracker
  const completionPct = useMemo(() => {
    const required = [formData.firstName, formData.lastName, formData.emailAddress, formData.cellphoneNumber];
    const optional = [
      formData.title, formData.dateOfBirth, formData.gender, formData.idType,
      formData.idNumber, formData.maritalStatus, formData.employmentStatus,
      formData.residentialCity, formData.residentialProvince, formData.financialGoals,
    ];
    const requiredFilled = required.filter(v => v.trim()).length;
    const optionalFilled = optional.filter(v => v.trim()).length;
    return Math.round((requiredFilled / required.length) * 60 + (optionalFilled / optional.length) * 40);
  }, [formData]);

  // Error count for the submit button area
  const activeErrorCount = useMemo(() => {
    return Object.values(errors).filter(Boolean).length;
  }, [errors]);

  // --- full-form validation on submit ---
  const validateAll = (): boolean => {
    const fieldsToValidate: string[] = [
      'firstName', 'lastName', 'emailAddress', 'cellphoneNumber',
      'middleName', 'preferredName', 'alternativeEmail', 'whatsappNumber',
      'dateOfBirth', 'idNumber', 'taxNumber', 'maritalRegime', 'residentialPostalCode',
    ];

    const newErrors: FieldErrors = {};
    let hasError = false;
    for (const field of fieldsToValidate) {
      const err = runValidation(field, formData[field as keyof typeof formData] || '');
      newErrors[field] = err;
      if (err) hasError = true;
    }

    setErrors(newErrors);
    setSubmitAttempted(true);
    // Mark all validated fields as touched
    const newTouched: Record<string, boolean> = {};
    for (const f of fieldsToValidate) newTouched[f] = true;
    setTouched(prev => ({ ...prev, ...newTouched }));

    return !hasError;
  };

  const handleSubmit = async () => {
    if (!validateAll()) {
      toast.error('Please fix the highlighted errors before submitting');
      return;
    }
    if (!consentConfirmed) {
      toast.error('Please confirm you have obtained consent from this client');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.post<{ success: boolean; applicationNumber?: string; error?: string }>(
        '/admin/onboarding/add',
        { ...formData, adminConsentConfirmed: consentConfirmed },
      );

      if (result.success) {
        toast.success(`Client added successfully. Application: ${result.applicationNumber}`);
        onSuccess();
        onClose();
      } else {
        toast.error(result.error || 'Failed to add client');
      }
    } catch (error: unknown) {
      console.error('Add client error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add client');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- shared classes ---
  const inputBase = 'h-9 text-sm bg-gray-50/60 border-gray-200 focus:bg-white transition-colors';
  const inputError = 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-200';
  const selectBase = 'h-9 text-sm bg-gray-50/60 border-gray-200 focus:bg-white transition-colors';
  const selectError = 'border-red-400 bg-red-50/40';

  const inputCls = (field: string) => `${inputBase} ${showError(field) ? inputError : ''}`;
  const selectTriggerCls = (field: string) => `${selectBase} ${showError(field) ? selectError : ''}`;

  return (
    <div className="space-y-5">
      {/* Completion indicator */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6d28d9] to-purple-400 transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <span className="text-[11px] font-medium text-gray-400 tabular-nums shrink-0">
          {completionPct}% complete
        </span>
      </div>

      {/* ================================================================ */}
      {/* PERSONAL INFORMATION                                             */}
      {/* ================================================================ */}
      <FormSection
        icon={User}
        title="Personal Information"
        description="Legal name as it appears on official documents"
        badge={
          formData.firstName && formData.lastName && !showError('firstName') && !showError('lastName') ? (
            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Name provided
            </Badge>
          ) : undefined
        }
      >
        <div className="space-y-3">
          {/* Row 1: Title, First, Middle, Last */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <FieldLabel>Title</FieldLabel>
              <Select value={formData.title} onValueChange={v => update('title', v)}>
                <SelectTrigger className={selectBase}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {TITLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel required>First Name</FieldLabel>
              <Input
                className={inputCls('firstName')}
                value={formData.firstName}
                onChange={e => update('firstName', e.target.value)}
                onBlur={() => handleBlur('firstName')}
                placeholder="e.g. John"
              />
              <FieldError message={showError('firstName')} />
            </div>
            <div>
              <FieldLabel>Middle Name</FieldLabel>
              <Input
                className={inputCls('middleName')}
                value={formData.middleName}
                onChange={e => update('middleName', e.target.value)}
                onBlur={() => handleBlur('middleName')}
              />
              <FieldError message={showError('middleName')} />
            </div>
            <div>
              <FieldLabel required>Last Name</FieldLabel>
              <Input
                className={inputCls('lastName')}
                value={formData.lastName}
                onChange={e => update('lastName', e.target.value)}
                onBlur={() => handleBlur('lastName')}
                placeholder="e.g. Smith"
              />
              <FieldError message={showError('lastName')} />
            </div>
          </div>

          {/* Row 2: DOB, Gender, Nationality */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <FieldLabel>Date of Birth</FieldLabel>
              <Input
                className={inputCls('dateOfBirth')}
                type="date"
                value={formData.dateOfBirth}
                onChange={e => update('dateOfBirth', e.target.value)}
                onBlur={() => handleBlur('dateOfBirth')}
              />
              <FieldError message={showError('dateOfBirth')} />
            </div>
            <div>
              <FieldLabel>Gender</FieldLabel>
              <Select value={formData.gender} onValueChange={v => { update('gender', v); setTouched(p => ({ ...p, gender: true })); }}>
                <SelectTrigger className={selectBase}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <FieldLabel>Nationality</FieldLabel>
              <Input className={inputBase} value={formData.nationality} onChange={e => update('nationality', e.target.value)} />
            </div>
          </div>

          {/* Autofill hint */}
          {idAutofilled && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#6d28d9] font-medium px-0.5">
              <Sparkles className="h-3 w-3" />
              Date of birth and gender were auto-populated from the SA ID number
            </div>
          )}

          <div className="h-px bg-gray-100 my-1" />

          {/* Row 3: ID Type, ID Number, Tax Number */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <FieldLabel>ID Type</FieldLabel>
              <Select
                value={formData.idType}
                onValueChange={v => {
                  update('idType', v);
                  // Re-validate idNumber when type changes
                  setTimeout(() => {
                    setErrors(prev => ({
                      ...prev,
                      idNumber: validateField('idNumber', formDataRef.current.idNumber, { ...formDataRef.current, idType: v }),
                    }));
                  }, 0);
                }}
              >
                <SelectTrigger className={selectBase}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sa_id">SA ID Number</SelectItem>
                  <SelectItem value="passport">Passport</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>ID / Passport Number</FieldLabel>
              <Input
                className={inputCls('idNumber')}
                value={formData.idNumber}
                onChange={e => update('idNumber', e.target.value)}
                onBlur={() => handleBlur('idNumber')}
                placeholder={formData.idType === 'sa_id' ? '13-digit SA ID' : formData.idType === 'passport' ? 'Passport number' : 'Select ID type first'}
              />
              <FieldError message={showError('idNumber')} />
            </div>
            <div>
              <FieldLabel>Tax Number</FieldLabel>
              <Input
                className={inputCls('taxNumber')}
                value={formData.taxNumber}
                onChange={e => update('taxNumber', e.target.value)}
                onBlur={() => handleBlur('taxNumber')}
                placeholder="10-digit SARS number"
              />
              <FieldError message={showError('taxNumber')} />
            </div>
          </div>

          {/* Row 4: Marital Status, Regime */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <FieldLabel>Marital Status</FieldLabel>
              <Select
                value={formData.maritalStatus}
                onValueChange={v => {
                  update('maritalStatus', v);
                  // Clear regime error if no longer required
                  if (v !== 'Married' && v !== 'Life Partner') {
                    setErrors(e => ({ ...e, maritalRegime: undefined }));
                  }
                }}
              >
                <SelectTrigger className={selectBase}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {MARITAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {showSpouseFields && (
              <div className="col-span-2">
                <FieldLabel required>Marital Regime</FieldLabel>
                <Select
                  value={formData.maritalRegime}
                  onValueChange={v => {
                    update('maritalRegime', v);
                    setTouched(p => ({ ...p, maritalRegime: true }));
                  }}
                >
                  <SelectTrigger className={selectTriggerCls('maritalRegime')}><SelectValue placeholder="Select regime" /></SelectTrigger>
                  <SelectContent>
                    {MARITAL_REGIMES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError message={showError('maritalRegime')} />
              </div>
            )}
          </div>
        </div>
      </FormSection>

      {/* ================================================================ */}
      {/* CONTACT DETAILS                                                  */}
      {/* ================================================================ */}
      <FormSection
        icon={MapPin}
        title="Contact Details"
        description="Primary email and phone are used for account creation"
        badge={
          formData.emailAddress && formData.cellphoneNumber && !showError('emailAddress') && !showError('cellphoneNumber') ? (
            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Contact provided
            </Badge>
          ) : undefined
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Email Address</FieldLabel>
              <Input
                className={inputCls('emailAddress')}
                type="email"
                value={formData.emailAddress}
                onChange={e => update('emailAddress', e.target.value)}
                onBlur={() => handleBlur('emailAddress')}
                placeholder="client@example.com"
              />
              <FieldError message={showError('emailAddress')} />
            </div>
            <div>
              <FieldLabel required>Cellphone Number</FieldLabel>
              <Input
                className={inputCls('cellphoneNumber')}
                value={formData.cellphoneNumber}
                onChange={e => update('cellphoneNumber', e.target.value)}
                onBlur={() => handleBlur('cellphoneNumber')}
                placeholder="+27 82 123 4567"
              />
              <FieldError message={showError('cellphoneNumber')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Alternative Email</FieldLabel>
              <Input
                className={inputCls('alternativeEmail')}
                type="email"
                value={formData.alternativeEmail}
                onChange={e => update('alternativeEmail', e.target.value)}
                onBlur={() => handleBlur('alternativeEmail')}
              />
              <FieldError message={showError('alternativeEmail')} />
            </div>
            <div>
              <FieldLabel>WhatsApp Number</FieldLabel>
              <Input
                className={inputCls('whatsappNumber')}
                value={formData.whatsappNumber}
                onChange={e => update('whatsappNumber', e.target.value)}
                onBlur={() => handleBlur('whatsappNumber')}
              />
              <FieldError message={showError('whatsappNumber')} />
            </div>
          </div>

          <div className="h-px bg-gray-100 my-1" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Address Line 1</FieldLabel>
              <Input className={inputBase} value={formData.residentialAddressLine1} onChange={e => update('residentialAddressLine1', e.target.value)} placeholder="Street address" />
            </div>
            <div>
              <FieldLabel>Address Line 2</FieldLabel>
              <Input className={inputBase} value={formData.residentialAddressLine2} onChange={e => update('residentialAddressLine2', e.target.value)} placeholder="Apartment, suite, etc." />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <FieldLabel>City</FieldLabel>
              <Input className={inputBase} value={formData.residentialCity} onChange={e => update('residentialCity', e.target.value)} />
            </div>
            <div>
              <FieldLabel>Province</FieldLabel>
              <Select value={formData.residentialProvince} onValueChange={v => update('residentialProvince', v)}>
                <SelectTrigger className={selectBase}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Postal Code</FieldLabel>
              <Input
                className={inputCls('residentialPostalCode')}
                value={formData.residentialPostalCode}
                onChange={e => update('residentialPostalCode', e.target.value)}
                onBlur={() => handleBlur('residentialPostalCode')}
              />
              <FieldError message={showError('residentialPostalCode')} />
            </div>
            <div>
              <FieldLabel>Country</FieldLabel>
              <Input className={inputBase} value={formData.residentialCountry} onChange={e => update('residentialCountry', e.target.value)} />
            </div>
          </div>
        </div>
      </FormSection>

      {/* ================================================================ */}
      {/* EMPLOYMENT                                                       */}
      {/* ================================================================ */}
      <FormSection icon={Briefcase} title="Employment" description="Current employment details">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <FieldLabel>Employment Status</FieldLabel>
            <Select value={formData.employmentStatus} onValueChange={v => update('employmentStatus', v)}>
              <SelectTrigger className={selectBase}><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel>Job Title</FieldLabel>
            <Input className={inputBase} value={formData.jobTitle} onChange={e => update('jobTitle', e.target.value)} placeholder="e.g. Financial Manager" />
          </div>
          <div>
            <FieldLabel>Employer Name</FieldLabel>
            <Input className={inputBase} value={formData.employerName} onChange={e => update('employerName', e.target.value)} />
          </div>
        </div>
      </FormSection>

      {/* ================================================================ */}
      {/* SERVICES & GOALS                                                 */}
      {/* ================================================================ */}
      <FormSection icon={Target} title="Services & Goals" description="Financial planning objectives">
        <div>
          <FieldLabel>Financial Goals</FieldLabel>
          <Input className={inputBase} value={formData.financialGoals} onChange={e => update('financialGoals', e.target.value)} placeholder="e.g. Retirement planning, investment growth, estate planning" />
        </div>
      </FormSection>

      {/* ================================================================ */}
      {/* POPIA CONSENT                                                    */}
      {/* ================================================================ */}
      <div className={`rounded-xl border-2 overflow-hidden transition-colors ${
        submitAttempted && !consentConfirmed
          ? 'border-red-300 bg-red-50/30'
          : 'border-amber-200 bg-amber-50/50'
      }`}>
        <div className="flex items-center gap-2.5 px-5 pt-4 pb-2">
          <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
            submitAttempted && !consentConfirmed ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            <ShieldCheck className={`h-3.5 w-3.5 ${submitAttempted && !consentConfirmed ? 'text-red-700' : 'text-amber-700'}`} />
          </div>
          <h3 className={`text-[13px] font-semibold ${submitAttempted && !consentConfirmed ? 'text-red-900' : 'text-amber-900'}`}>
            POPIA Consent Confirmation
          </h3>
          {submitAttempted && !consentConfirmed && (
            <Badge variant="destructive" className="text-[10px] ml-auto">
              Required
            </Badge>
          )}
        </div>
        <div className="px-5 pb-4 pt-1">
          <div className="flex items-start gap-3">
            <Checkbox
              id="admin-consent"
              checked={consentConfirmed}
              onCheckedChange={(checked) => setConsentConfirmed(checked === true)}
              className={`mt-0.5 ${
                submitAttempted && !consentConfirmed
                  ? 'border-red-400'
                  : 'border-amber-400'
              } data-[state=checked]:bg-[#6d28d9] data-[state=checked]:border-[#6d28d9]`}
            />
            <label htmlFor="admin-consent" className={`text-[13px] leading-relaxed cursor-pointer ${
              submitAttempted && !consentConfirmed ? 'text-red-900' : 'text-amber-900'
            }`}>
              I confirm that I have obtained consent from this client to create their account on Navigate Wealth in accordance with <strong>POPIA regulations</strong>. The client will receive a welcome email to set their password and accept Terms &amp; Conditions upon application approval.
            </label>
          </div>
          <div className="flex items-start gap-2 mt-3 ml-9 text-[11px] text-amber-700/80">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>A Supabase Auth user will be created with a temporary password. The client must set their own password via the recovery link sent upon approval.</span>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* ACTIONS                                                          */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between pt-2 pb-1">
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-gray-400">
            <span className="text-red-500">*</span> Required fields
          </p>
          {submitAttempted && activeErrorCount > 0 && (
            <Badge variant="destructive" className="text-[10px] font-medium">
              <AlertCircle className="h-3 w-3 mr-1" />
              {activeErrorCount} validation error{activeErrorCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="px-5">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 bg-[#6d28d9] hover:bg-[#5b21b6]"
          >
            {isSubmitting ? (
              <div className="contents">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </div>
            ) : (
              <div className="contents">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Add Client
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}