/* eslint-disable react-refresh/only-export-components */
import { useState, useMemo, useCallback, useRef } from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Checkbox } from '../../../../ui/checkbox';
import { Badge } from '../../../../ui/badge';
import { toast } from 'sonner';
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
  Users,
} from 'lucide-react';
import { api, APIError } from '../../../../../utils/api/client';
import {
  TITLES,
  GENDERS,
  MARITAL_STATUSES,
  MARITAL_REGIMES,
  PROVINCES,
  EMPLOYMENT_STATUSES,
  validateField,
  validateSaIdNumber,
  type FieldErrors,
} from './singleClientFormModel';
import { FormSection, FieldLabel, FieldError } from './SingleClientFormAtoms';

export { validateSaIdNumber, computeAge } from './singleClientFormModel';

interface SingleClientFormProps {
  onSuccess: () => void;
  onClose: () => void;
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

  /**
   * Set when the address is already a client's login identity.
   *
   * Two very different situations produce the same 409, and only the admin can
   * tell them apart: the person is already onboarded (stop), or a household
   * shares one inbox — a minor on a parent's address (link them). So the form
   * asks rather than guessing.
   */
  const [emailConflict, setEmailConflict] = useState<{
    email: string;
    holderName?: string;
    holderId?: string;
  } | null>(null);
  const [relationshipToOwner, setRelationshipToOwner] = useState('');

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

  const runValidation = useCallback(
    (field: string, value: string, data?: Record<string, string>) => {
      return validateField(field, value, data ?? formDataRef.current);
    },
    [],
  );

  const update = useCallback((field: string, value: string) => {
    setFormData((prev) => {
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
              setErrors((e) => ({ ...e, dateOfBirth: undefined }));
            }
            if (result.gender && !prev.gender) {
              next.gender = result.gender;
            }
          }
        }
      }

      // Clear error for the changed field on input
      setErrors((e) => {
        const err = validateField(field, value, next);
        return { ...e, [field]: err };
      });

      return next;
    });
  }, []);

  const handleBlur = useCallback(
    (field: string) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      setErrors((prev) => ({
        ...prev,
        [field]: runValidation(
          field,
          formDataRef.current[field as keyof typeof formDataRef.current] || '',
        ),
      }));
    },
    [runValidation],
  );

  const showError = (field: string) =>
    touched[field] || submitAttempted ? errors[field] : undefined;

  const showSpouseFields =
    formData.maritalStatus === 'Married' || formData.maritalStatus === 'Life Partner';

  // Completion tracker
  const completionPct = useMemo(() => {
    const required = [
      formData.firstName,
      formData.lastName,
      formData.emailAddress,
      formData.cellphoneNumber,
    ];
    const optional = [
      formData.title,
      formData.dateOfBirth,
      formData.gender,
      formData.idType,
      formData.idNumber,
      formData.maritalStatus,
      formData.employmentStatus,
      formData.residentialCity,
      formData.residentialProvince,
      formData.financialGoals,
    ];
    const requiredFilled = required.filter((v) => v.trim()).length;
    const optionalFilled = optional.filter((v) => v.trim()).length;
    return Math.round(
      (requiredFilled / required.length) * 60 + (optionalFilled / optional.length) * 40,
    );
  }, [formData]);

  // Error count for the submit button area
  const activeErrorCount = useMemo(() => {
    return Object.values(errors).filter(Boolean).length;
  }, [errors]);

  // --- full-form validation on submit ---
  const validateAll = (): boolean => {
    const fieldsToValidate: string[] = [
      'firstName',
      'lastName',
      'emailAddress',
      'cellphoneNumber',
      'middleName',
      'preferredName',
      'alternativeEmail',
      'whatsappNumber',
      'dateOfBirth',
      'idNumber',
      'taxNumber',
      'maritalRegime',
      'residentialPostalCode',
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
    setTouched((prev) => ({ ...prev, ...newTouched }));

    return !hasError;
  };

  /**
   * Submit the form.
   *
   * `shareMailbox` re-sends the same payload with the admin's confirmation that
   * the address belongs to another household member, which makes the server
   * derive a unique sign-in alias instead of rejecting the duplicate.
   */
  const handleSubmit = async (shareMailbox = false) => {
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
      const result = await api.post<{
        success: boolean;
        applicationNumber?: string;
        signInEmail?: string;
        contactEmail?: string;
        error?: string;
      }>('/admin/onboarding/add', {
        ...formData,
        adminConsentConfirmed: consentConfirmed,
        ...(shareMailbox
          ? {
              emailIsShared: true,
              sharedEmailOwnerUserId: emailConflict?.holderId,
              relationshipToEmailOwner: relationshipToOwner.trim() || undefined,
            }
          : {}),
      });

      if (result.success) {
        const linked = result.signInEmail && result.signInEmail !== result.contactEmail;
        toast.success(
          linked
            ? `Client added. Application: ${result.applicationNumber}. They sign in as ${result.signInEmail}; mail goes to ${result.contactEmail}.`
            : `Client added successfully. Application: ${result.applicationNumber}`,
        );
        onSuccess();
        onClose();
      } else {
        toast.error(result.error || 'Failed to add client');
      }
    } catch (error: unknown) {
      // A 409 is the shared-mailbox case and is answerable in place, so it
      // opens the prompt below instead of surfacing as a dead-end toast.
      const conflict =
        error instanceof APIError && error.statusCode === 409
          ? (error.details as {
              errorCode?: string;
              conflictingClient?: { id: string; name: string };
            } | null)
          : null;

      if (conflict?.errorCode === 'EMAIL_EXISTS' && !shareMailbox) {
        setEmailConflict({
          email: formData.emailAddress.trim(),
          holderName: conflict.conflictingClient?.name,
          holderId: conflict.conflictingClient?.id,
        });
        return;
      }

      console.error('Add client error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add client');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Free the address by moving its current holder onto an alias, then create
   * this client on it.
   *
   * The mirror image of linking the new client: it is the RIGHT way round when
   * the person already in the system is the dependant — a minor enrolled on a
   * parent's inbox before the parent himself. The adult who owns the mailbox
   * should hold it as his login identity, not be pushed onto an alias because
   * his daughter was captured first.
   */
  const handleReleaseFromHolder = async () => {
    if (!emailConflict?.holderId) return;

    setIsSubmitting(true);
    try {
      await api.post<{ success: boolean; freedEmail?: string; signInEmail?: string }>(
        '/admin/onboarding/link-shared-mailbox',
        {
          userId: emailConflict.holderId,
          relationship: relationshipToOwner.trim() || undefined,
        },
      );
    } catch (error: unknown) {
      console.error('Release shared mailbox error:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not free the address from its current owner',
      );
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);

    // The address is free now, so this is an ordinary create.
    setEmailConflict(null);
    await handleSubmit();
  };

  // --- shared classes ---
  const inputBase = 'h-9 text-sm bg-gray-50/60 border-gray-200 focus:bg-white transition-colors';
  const inputError = 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-200';
  const selectBase = 'h-9 text-sm bg-gray-50/60 border-gray-200 focus:bg-white transition-colors';
  const selectError = 'border-red-400 bg-red-50/40';

  const inputCls = (field: string) => `${inputBase} ${showError(field) ? inputError : ''}`;
  const selectTriggerCls = (field: string) =>
    `${selectBase} ${showError(field) ? selectError : ''}`;

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
          formData.firstName &&
          formData.lastName &&
          !showError('firstName') &&
          !showError('lastName') ? (
            <Badge
              variant="outline"
              className="text-[10px] bg-green-50 text-green-700 border-green-200"
            >
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
              <Select value={formData.title} onValueChange={(v) => update('title', v)}>
                <SelectTrigger className={selectBase}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {TITLES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel required>First Name</FieldLabel>
              <Input
                className={inputCls('firstName')}
                value={formData.firstName}
                onChange={(e) => update('firstName', e.target.value)}
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
                onChange={(e) => update('middleName', e.target.value)}
                onBlur={() => handleBlur('middleName')}
              />
              <FieldError message={showError('middleName')} />
            </div>
            <div>
              <FieldLabel required>Last Name</FieldLabel>
              <Input
                className={inputCls('lastName')}
                value={formData.lastName}
                onChange={(e) => update('lastName', e.target.value)}
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
                onChange={(e) => update('dateOfBirth', e.target.value)}
                onBlur={() => handleBlur('dateOfBirth')}
              />
              <FieldError message={showError('dateOfBirth')} />
            </div>
            <div>
              <FieldLabel>Gender</FieldLabel>
              <Select
                value={formData.gender}
                onValueChange={(v) => {
                  update('gender', v);
                  setTouched((p) => ({ ...p, gender: true }));
                }}
              >
                <SelectTrigger className={selectBase}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <FieldLabel>Nationality</FieldLabel>
              <Input
                className={inputBase}
                value={formData.nationality}
                onChange={(e) => update('nationality', e.target.value)}
              />
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
                onValueChange={(v) => {
                  update('idType', v);
                  // Re-validate idNumber when type changes
                  setTimeout(() => {
                    setErrors((prev) => ({
                      ...prev,
                      idNumber: validateField('idNumber', formDataRef.current.idNumber, {
                        ...formDataRef.current,
                        idType: v,
                      }),
                    }));
                  }, 0);
                }}
              >
                <SelectTrigger className={selectBase}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
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
                onChange={(e) => update('idNumber', e.target.value)}
                onBlur={() => handleBlur('idNumber')}
                placeholder={
                  formData.idType === 'sa_id'
                    ? '13-digit SA ID'
                    : formData.idType === 'passport'
                      ? 'Passport number'
                      : 'Select ID type first'
                }
              />
              <FieldError message={showError('idNumber')} />
            </div>
            <div>
              <FieldLabel>Tax Number</FieldLabel>
              <Input
                className={inputCls('taxNumber')}
                value={formData.taxNumber}
                onChange={(e) => update('taxNumber', e.target.value)}
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
                onValueChange={(v) => {
                  update('maritalStatus', v);
                  // Clear regime error if no longer required
                  if (v !== 'Married' && v !== 'Life Partner') {
                    setErrors((e) => ({ ...e, maritalRegime: undefined }));
                  }
                }}
              >
                <SelectTrigger className={selectBase}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {MARITAL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showSpouseFields && (
              <div className="col-span-2">
                <FieldLabel required>Marital Regime</FieldLabel>
                <Select
                  value={formData.maritalRegime}
                  onValueChange={(v) => {
                    update('maritalRegime', v);
                    setTouched((p) => ({ ...p, maritalRegime: true }));
                  }}
                >
                  <SelectTrigger className={selectTriggerCls('maritalRegime')}>
                    <SelectValue placeholder="Select regime" />
                  </SelectTrigger>
                  <SelectContent>
                    {MARITAL_REGIMES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
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
          formData.emailAddress &&
          formData.cellphoneNumber &&
          !showError('emailAddress') &&
          !showError('cellphoneNumber') ? (
            <Badge
              variant="outline"
              className="text-[10px] bg-green-50 text-green-700 border-green-200"
            >
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
                onChange={(e) => update('emailAddress', e.target.value)}
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
                onChange={(e) => update('cellphoneNumber', e.target.value)}
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
                onChange={(e) => update('alternativeEmail', e.target.value)}
                onBlur={() => handleBlur('alternativeEmail')}
              />
              <FieldError message={showError('alternativeEmail')} />
            </div>
            <div>
              <FieldLabel>WhatsApp Number</FieldLabel>
              <Input
                className={inputCls('whatsappNumber')}
                value={formData.whatsappNumber}
                onChange={(e) => update('whatsappNumber', e.target.value)}
                onBlur={() => handleBlur('whatsappNumber')}
              />
              <FieldError message={showError('whatsappNumber')} />
            </div>
          </div>

          <div className="h-px bg-gray-100 my-1" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Address Line 1</FieldLabel>
              <Input
                className={inputBase}
                value={formData.residentialAddressLine1}
                onChange={(e) => update('residentialAddressLine1', e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div>
              <FieldLabel>Address Line 2</FieldLabel>
              <Input
                className={inputBase}
                value={formData.residentialAddressLine2}
                onChange={(e) => update('residentialAddressLine2', e.target.value)}
                placeholder="Apartment, suite, etc."
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <FieldLabel>City</FieldLabel>
              <Input
                className={inputBase}
                value={formData.residentialCity}
                onChange={(e) => update('residentialCity', e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Province</FieldLabel>
              <Select
                value={formData.residentialProvince}
                onValueChange={(v) => update('residentialProvince', v)}
              >
                <SelectTrigger className={selectBase}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {PROVINCES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Postal Code</FieldLabel>
              <Input
                className={inputCls('residentialPostalCode')}
                value={formData.residentialPostalCode}
                onChange={(e) => update('residentialPostalCode', e.target.value)}
                onBlur={() => handleBlur('residentialPostalCode')}
              />
              <FieldError message={showError('residentialPostalCode')} />
            </div>
            <div>
              <FieldLabel>Country</FieldLabel>
              <Input
                className={inputBase}
                value={formData.residentialCountry}
                onChange={(e) => update('residentialCountry', e.target.value)}
              />
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
            <Select
              value={formData.employmentStatus}
              onValueChange={(v) => update('employmentStatus', v)}
            >
              <SelectTrigger className={selectBase}>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel>Job Title</FieldLabel>
            <Input
              className={inputBase}
              value={formData.jobTitle}
              onChange={(e) => update('jobTitle', e.target.value)}
              placeholder="e.g. Financial Manager"
            />
          </div>
          <div>
            <FieldLabel>Employer Name</FieldLabel>
            <Input
              className={inputBase}
              value={formData.employerName}
              onChange={(e) => update('employerName', e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      {/* ================================================================ */}
      {/* SERVICES & GOALS                                                 */}
      {/* ================================================================ */}
      <FormSection
        icon={Target}
        title="Services & Goals"
        description="Financial planning objectives"
      >
        <div>
          <FieldLabel>Financial Goals</FieldLabel>
          <Input
            className={inputBase}
            value={formData.financialGoals}
            onChange={(e) => update('financialGoals', e.target.value)}
            placeholder="e.g. Retirement planning, investment growth, estate planning"
          />
        </div>
      </FormSection>

      {/* ================================================================ */}
      {/* POPIA CONSENT                                                    */}
      {/* ================================================================ */}
      <div
        className={`rounded-xl border-2 overflow-hidden transition-colors ${
          submitAttempted && !consentConfirmed
            ? 'border-red-300 bg-red-50/30'
            : 'border-amber-200 bg-amber-50/50'
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 pt-4 pb-2">
          <div
            className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
              submitAttempted && !consentConfirmed ? 'bg-red-100' : 'bg-amber-100'
            }`}
          >
            <ShieldCheck
              className={`h-3.5 w-3.5 ${submitAttempted && !consentConfirmed ? 'text-red-700' : 'text-amber-700'}`}
            />
          </div>
          <h3
            className={`text-[13px] font-semibold ${submitAttempted && !consentConfirmed ? 'text-red-900' : 'text-amber-900'}`}
          >
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
                submitAttempted && !consentConfirmed ? 'border-red-400' : 'border-amber-400'
              } data-[state=checked]:bg-[#6d28d9] data-[state=checked]:border-[#6d28d9]`}
            />
            <label
              htmlFor="admin-consent"
              className={`text-[13px] leading-relaxed cursor-pointer ${
                submitAttempted && !consentConfirmed ? 'text-red-900' : 'text-amber-900'
              }`}
            >
              I confirm that I have obtained consent from this client to create their account on
              Navigate Wealth in accordance with <strong>POPIA regulations</strong>. The client will
              receive a welcome email to set their password and accept Terms &amp; Conditions upon
              application approval.
            </label>
          </div>
          <div className="flex items-start gap-2 mt-3 ml-9 text-[11px] text-amber-700/80">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              A Supabase Auth user will be created with a temporary password. The client must set
              their own password via the recovery link sent upon approval.
            </span>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* SHARED MAILBOX PROMPT                                            */}
      {/* ================================================================ */}
      {emailConflict && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-700" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  {emailConflict.email} is already a sign-in address
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-blue-800">
                  {emailConflict.holderName
                    ? `It belongs to ${emailConflict.holderName}. `
                    : 'Another client already signs in with it. '}
                  If this is the same person, cancel — they are already onboarded. If a household
                  shares one inbox (a minor on a parent&apos;s address, a spouse without their own),
                  keep both records: one of them signs in with a unique alias, and mail for both
                  still goes to {emailConflict.email}. Choose whichever of them actually owns the
                  mailbox — that person keeps the plain address.
                </p>
              </div>

              <div className="max-w-xs">
                <FieldLabel>Relationship to the mailbox owner</FieldLabel>
                <Input
                  id="relationshipToOwner"
                  value={relationshipToOwner}
                  onChange={(e) => setRelationshipToOwner(e.target.value)}
                  placeholder="e.g. Daughter (minor)"
                  className={inputBase}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting}
                  className="bg-blue-700 hover:bg-blue-800"
                  size="sm"
                >
                  {isSubmitting ? (
                    <div className="contents">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Working...
                    </div>
                  ) : (
                    <div className="contents">
                      <Users className="mr-2 h-4 w-4" />
                      {emailConflict.holderName
                        ? `${emailConflict.holderName} owns it`
                        : 'The existing client owns it'}
                    </div>
                  )}
                </Button>
                {emailConflict.holderId && (
                  <Button
                    onClick={handleReleaseFromHolder}
                    disabled={isSubmitting}
                    variant="outline"
                    size="sm"
                    className="border-blue-300 text-blue-800 hover:bg-blue-100"
                  >
                    {formData.firstName || 'This client'} owns it
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => setEmailConflict(null)}
                >
                  Use a different email
                </Button>
              </div>

              <p className="text-[11px] leading-relaxed text-blue-700/80">
                {emailConflict.holderName || 'The existing client'} owns it →{' '}
                {formData.firstName || 'the new client'} gets the alias.{' '}
                {emailConflict.holderId && (
                  <>
                    {formData.firstName || 'The new client'} owns it →{' '}
                    {emailConflict.holderName || 'the existing client'} moves to an alias and the
                    plain address is freed.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

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
            onClick={() => handleSubmit()}
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
