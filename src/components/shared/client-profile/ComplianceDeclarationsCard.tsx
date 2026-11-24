/**
 * What the client declares for KYC / FICA / FATCA-CRS / POPIA. Rendered in the
 * client portal (the client fills it in) and in the admin profile viewer (staff
 * complete or correct it). The data shape and its rules live in
 * `src/shared/compliance/clientCompliance.ts`.
 */
import { CheckCircle2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Separator } from '../../ui/separator';
import { Textarea } from '../../ui/textarea';
import {
  CONSENT_DEFINITIONS,
  NO_TAX_NUMBER_REASON_OPTIONS,
  PEP_CATEGORY_OPTIONS,
  PEP_RELATIONSHIP_OPTIONS,
  SOURCE_OF_FUNDS_OPTIONS,
  SOURCE_OF_WEALTH_OPTIONS,
  outstandingDeclarations,
  type ComplianceDeclarations,
  type ConsentKey,
  type ConsentStatus,
  type LegacyConsentEvidence,
  type NoTaxNumberReason,
  type PepCategory,
  type PepRelationship,
  type TaxResidency,
} from '../../../shared/compliance';
import { CheckboxGroup, SectionHeader, SubHeading, YesNoQuestion } from './fields';
import { type Audience, newRowId, says } from './fieldHelpers';

interface ComplianceDeclarationsCardProps {
  value: ComplianceDeclarations;
  onChange: (next: ComplianceDeclarations) => void;
  audience: Audience;
  /** Consent already on record from the application or first sign-in. */
  legacyConsent?: LegacyConsentEvidence[];
  /** The application's answer to "Are you a South African tax resident?". */
  applicationSaysSaTaxResident?: boolean;
  /** The profile's SA tax number, to prefill a South African residency. */
  saTaxNumber?: string;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ComplianceDeclarationsCard({
  value,
  onChange,
  audience,
  legacyConsent = [],
  applicationSaysSaTaxResident,
  saTaxNumber = '',
}: ComplianceDeclarationsCardProps) {
  const update = (patch: Partial<ComplianceDeclarations>) => onChange({ ...value, ...patch });
  const missing = outstandingDeclarations(value);
  const you = (client: string, adviser: string) => says(audience, client, adviser);

  const updateResidency = (id: string, patch: Partial<TaxResidency>) =>
    update({
      taxResidencies: value.taxResidencies.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  const addResidency = (country = '', taxNumber = '') =>
    update({
      taxResidencies: [
        ...value.taxResidencies,
        { id: newRowId('tax'), country, taxNumber, noTaxNumberReason: '' },
      ],
    });

  const setConsent = (key: ConsentKey, status: Exclude<ConsentStatus, ''>) =>
    update({
      consents: {
        ...value.consents,
        [key]: { status, recordedAt: new Date().toISOString() },
      },
    });

  return (
    <Card>
      <SectionHeader
        icon={ShieldCheck}
        title={you('Compliance & Consent', 'Compliance declarations')}
        description={you(
          'Information the law requires us to hold before we can advise you',
          "The client's own declarations for FICA, FATCA/CRS and POPIA",
        )}
        actions={
          missing.length === 0 ? (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Complete</Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              {missing.length} outstanding
            </Badge>
          )
        }
      />
      <CardContent className="space-y-6">
        {/* ── Politically exposed person ─────────────────────────────── */}
        <div className="space-y-4">
          <SubHeading
            hint={you(
              'A politically exposed person holds, or held in the last 12 months, a prominent public position — for example a minister, senior official, judge, military leader, head of a state-owned company or of an international organisation.',
              'FICA s21F–21H. A "yes" to either question requires enhanced due diligence and senior management approval.',
            )}
          >
            Politically exposed person (PEP)
          </SubHeading>
          <YesNoQuestion
            id="isPep"
            question={you(
              'Are you a politically exposed person?',
              'Is the client a politically exposed person?',
            )}
            value={value.isPep}
            onChange={(v) =>
              update(v === 'yes' ? { isPep: v } : { isPep: v, pepCategory: '', pepPosition: '' })
            }
          />
          {value.isPep === 'yes' && (
            <div className="grid grid-cols-1 gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pepCategory">Category</Label>
                <Select
                  value={value.pepCategory}
                  onValueChange={(v) => update({ pepCategory: v as PepCategory })}
                >
                  <SelectTrigger id="pepCategory" className="mt-1.5">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PEP_CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="pepPosition">Position held</Label>
                <Input
                  id="pepPosition"
                  value={value.pepPosition}
                  onChange={(e) => update({ pepPosition: e.target.value })}
                  placeholder="e.g. Member of Parliament, 2019–2024"
                  className="mt-1.5"
                />
              </div>
            </div>
          )}
          <YesNoQuestion
            id="isPepRelated"
            question={you(
              'Is a member of your immediate family, or a close associate, a politically exposed person?',
              'Is an immediate family member or known close associate of the client a PEP?',
            )}
            value={value.isPepRelated}
            onChange={(v) =>
              update(
                v === 'yes'
                  ? { isPepRelated: v }
                  : {
                      isPepRelated: v,
                      pepRelationship: '',
                      pepRelatedName: '',
                      pepRelatedPosition: '',
                    },
              )
            }
          />
          {value.isPepRelated === 'yes' && (
            <div className="grid grid-cols-1 gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="pepRelatedName">Their name</Label>
                <Input
                  id="pepRelatedName"
                  value={value.pepRelatedName}
                  onChange={(e) => update({ pepRelatedName: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="pepRelationship">Relationship</Label>
                <Select
                  value={value.pepRelationship}
                  onValueChange={(v) => update({ pepRelationship: v as PepRelationship })}
                >
                  <SelectTrigger id="pepRelationship" className="mt-1.5">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {PEP_RELATIONSHIP_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="pepRelatedPosition">Their position</Label>
                <Input
                  id="pepRelatedPosition"
                  value={value.pepRelatedPosition}
                  onChange={(e) => update({ pepRelatedPosition: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* ── Source of funds and wealth ─────────────────────────────── */}
        <div className="space-y-4">
          <SubHeading
            hint={you(
              'Where the money you will invest or pay premiums with comes from.',
              'Where the money the client invests or pays with comes from.',
            )}
          >
            Source of funds
          </SubHeading>
          <CheckboxGroup
            id="sourceOfFunds"
            options={SOURCE_OF_FUNDS_OPTIONS}
            value={value.sourceOfFunds}
            onChange={(sourceOfFunds) => update({ sourceOfFunds })}
          />
          <div>
            <Label htmlFor="sourceOfFundsDetails">Details (optional)</Label>
            <Textarea
              id="sourceOfFundsDetails"
              value={value.sourceOfFundsDetails}
              onChange={(e) => update({ sourceOfFundsDetails: e.target.value })}
              placeholder="e.g. Monthly salary; R500 000 from the sale of a property in 2025"
              className="mt-1.5"
              rows={2}
            />
          </div>
        </div>

        <div className="space-y-4">
          <SubHeading
            hint={you(
              'How you built up your overall wealth over time.',
              'How the client built up their overall wealth.',
            )}
          >
            Source of wealth
          </SubHeading>
          <CheckboxGroup
            id="sourceOfWealth"
            options={SOURCE_OF_WEALTH_OPTIONS}
            value={value.sourceOfWealth}
            onChange={(sourceOfWealth) => update({ sourceOfWealth })}
          />
          <div>
            <Label htmlFor="sourceOfWealthDetails">Details (optional)</Label>
            <Textarea
              id="sourceOfWealthDetails"
              value={value.sourceOfWealthDetails}
              onChange={(e) => update({ sourceOfWealthDetails: e.target.value })}
              className="mt-1.5"
              rows={2}
            />
          </div>
        </div>

        <Separator />

        {/* ── Tax residency and FATCA ────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SubHeading
              hint={you(
                'Every country where you are resident for tax purposes, including South Africa.',
                'Every country of tax residence (CRS), including South Africa.',
              )}
            >
              Tax residency
            </SubHeading>
            <Button variant="outline" size="sm" onClick={() => addResidency()}>
              <Plus className="mr-1 h-4 w-4" />
              Add country
            </Button>
          </div>

          {value.taxResidencies.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
              No tax residency recorded.
              {applicationSaysSaTaxResident && (
                <span>
                  {' '}
                  {you(
                    'On your application you said you are a South African tax resident.',
                    'On the application the client said they are a South African tax resident.',
                  )}{' '}
                  <button
                    type="button"
                    className="font-medium text-[#6d28d9] underline-offset-2 hover:underline"
                    onClick={() => addResidency('South Africa', saTaxNumber)}
                  >
                    Add South Africa
                  </button>
                </span>
              )}
            </div>
          )}

          {value.taxResidencies.map((t, index) => (
            <div
              key={t.id}
              className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-[1fr_1fr_auto]"
            >
              <div>
                <Label htmlFor={`tax-country-${t.id}`}>Country {index + 1}</Label>
                <Input
                  id={`tax-country-${t.id}`}
                  value={t.country}
                  onChange={(e) => updateResidency(t.id, { country: e.target.value })}
                  placeholder="e.g. South Africa"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor={`tax-number-${t.id}`}>Tax number</Label>
                <Input
                  id={`tax-number-${t.id}`}
                  value={t.taxNumber}
                  onChange={(e) =>
                    updateResidency(t.id, {
                      taxNumber: e.target.value,
                      ...(e.target.value ? { noTaxNumberReason: '' as const } : {}),
                    })
                  }
                  className="mt-1.5"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Remove tax residency ${t.country || index + 1}`}
                  onClick={() =>
                    update({ taxResidencies: value.taxResidencies.filter((r) => r.id !== t.id) })
                  }
                  className="border-red-600 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {!t.taxNumber && (
                <div className="sm:col-span-2">
                  <Label htmlFor={`tax-reason-${t.id}`}>Reason there is no tax number</Label>
                  <Select
                    value={t.noTaxNumberReason}
                    onValueChange={(v) =>
                      updateResidency(t.id, { noTaxNumberReason: v as NoTaxNumberReason })
                    }
                  >
                    <SelectTrigger id={`tax-reason-${t.id}`} className="mt-1.5">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {NO_TAX_NUMBER_REASON_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ))}

          <YesNoQuestion
            id="isUsPerson"
            question={you(
              'Are you a US citizen or US tax resident?',
              'Is the client a US person (citizen or tax resident)?',
            )}
            hint="Includes holding a US passport or green card. Required for FATCA."
            value={value.isUsPerson}
            onChange={(v) => update(v === 'yes' ? { isUsPerson: v } : { isUsPerson: v, usTin: '' })}
          />
          {value.isUsPerson === 'yes' && (
            <div className="max-w-sm">
              <Label htmlFor="usTin">US tax identification number (TIN/SSN)</Label>
              <Input
                id="usTin"
                value={value.usTin}
                onChange={(e) => update({ usTin: e.target.value })}
                className="mt-1.5"
              />
            </div>
          )}
        </div>

        <Separator />

        {/* ── Consents ───────────────────────────────────────────────── */}
        <div className="space-y-4">
          <SubHeading
            hint={you(
              'You can change any of these at any time.',
              'Each change is time-stamped. Record what the client chose; do not choose for them.',
            )}
          >
            Consents
          </SubHeading>
          {CONSENT_DEFINITIONS.map((def) => {
            const record = value.consents[def.key];
            const evidence = legacyConsent.find((e) => e.key === def.key);
            return (
              <div key={def.key} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p id={`consent-${def.key}-label`} className="text-sm text-gray-900">
                      {def.label}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{def.description}</p>
                    {record.status && record.recordedAt && (
                      <p className="mt-1 text-xs text-gray-500">
                        Recorded {formatDate(record.recordedAt)}
                      </p>
                    )}
                    {!record.status && evidence && (
                      <p className="mt-1 text-xs text-gray-600">
                        Given on the {evidence.source}
                        {evidence.recordedAt ? ` (${formatDate(evidence.recordedAt)})` : ''}.{' '}
                        {you('Please confirm it here.', 'Ask the client to confirm it here.')}
                      </p>
                    )}
                  </div>
                  <RadioGroup
                    aria-labelledby={`consent-${def.key}-label`}
                    value={record.status}
                    onValueChange={(v) => setConsent(def.key, v as Exclude<ConsentStatus, ''>)}
                    className="flex shrink-0 gap-4"
                  >
                    {(['granted', 'declined'] as const).map((status) => (
                      <div key={status} className="flex items-center gap-2">
                        <RadioGroupItem id={`consent-${def.key}-${status}`} value={status} />
                        <Label
                          htmlFor={`consent-${def.key}-${status}`}
                          className="cursor-pointer font-normal"
                        >
                          {status === 'granted'
                            ? you('I agree', 'Agreed')
                            : you('I do not agree', 'Declined')}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* ── Confirmation ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">
            {value.confirmedAt
              ? `${you('You last confirmed', 'The client last confirmed')} these declarations on ${formatDate(value.confirmedAt)}.`
              : you(
                  'Please confirm these declarations once you have answered them.',
                  'The client has not confirmed these declarations yet.',
                )}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={missing.length > 0}
            onClick={() => update({ confirmedAt: new Date().toISOString() })}
            className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"
          >
            <CheckCircle2 className="mr-1 h-4 w-4" />
            {you('Confirm these are accurate', 'Record client confirmation')}
          </Button>
        </div>
        {missing.length > 0 && (
          <p className="text-xs text-amber-700">Still to answer: {missing.join(', ')}.</p>
        )}
      </CardContent>
    </Card>
  );
}
