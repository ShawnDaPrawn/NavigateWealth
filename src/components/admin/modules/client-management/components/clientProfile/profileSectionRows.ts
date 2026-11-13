import { formatCurrencyDisplay } from '../../../../../../utils/currencyFormatter';
import type { ClientProfileHook } from './clientProfileHook';

type Profile = ClientProfileHook['state']['profileData'];
export type Row = { label: string; value: string; copy?: boolean };
export type RowGroup = { title?: string; rows: Row[] };

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function date(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function money(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `R ${formatCurrencyDisplay(n)}` : '';
}

export function personalGroups(p: Profile): RowGroup[] {
  return [
    {
      rows: [
        { label: 'Title', value: text(p.title) },
        { label: 'First name', value: text(p.firstName), copy: true },
        { label: 'Middle name', value: text(p.middleName) },
        { label: 'Last name', value: text(p.lastName), copy: true },
        { label: 'Date of birth', value: date(p.dateOfBirth) },
        { label: 'Gender', value: text(p.gender) },
        { label: 'Nationality', value: text(p.nationality) },
        { label: 'Tax number', value: text(p.taxNumber), copy: true },
        { label: 'Marital status', value: text(p.maritalStatus) },
        ...(text(p.maritalRegime)
          ? [{ label: 'Marital regime', value: text(p.maritalRegime) }]
          : []),
      ],
    },
    {
      title: 'Income',
      rows: [
        { label: 'Gross monthly income', value: money(p.grossMonthlyIncome) },
        { label: 'Net monthly income', value: money(p.netMonthlyIncome) },
        { label: 'Gross annual income', value: money(p.grossAnnualIncome) },
        { label: 'Net annual income', value: money(p.netAnnualIncome) },
      ],
    },
    {
      title: 'Identity',
      rows: [
        { label: 'ID country', value: text(p.idCountry) },
        { label: 'ID number', value: text(p.idNumber), copy: true },
        { label: 'Passport country', value: text(p.passportCountry) },
        { label: 'Passport number', value: text(p.passportNumber), copy: true },
        { label: 'Country of employment', value: text(p.employmentCountry) },
        { label: 'Work permit number', value: text(p.workPermitNumber), copy: true },
      ],
    },
  ];
}

export function contactGroups(p: Profile): RowGroup[] {
  return [
    {
      rows: [
        { label: 'Email', value: text(p.email), copy: true },
        { label: 'Secondary email', value: text(p.secondaryEmail), copy: true },
        { label: 'Phone number', value: text(p.phoneNumber), copy: true },
        { label: 'Alternative phone', value: text(p.alternativePhone), copy: true },
        { label: 'Preferred contact method', value: text(p.preferredContactMethod) },
      ],
    },
    {
      title: 'Emergency contact',
      rows: [
        { label: 'Contact name', value: text(p.emergencyContactName) },
        { label: 'Relationship', value: text(p.emergencyContactRelationship) },
        { label: 'Phone number', value: text(p.emergencyContactPhone), copy: true },
        { label: 'Email', value: text(p.emergencyContactEmail), copy: true },
      ],
    },
  ];
}
