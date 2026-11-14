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

/** A read-only table in a section card (Family, Banking, KYC, Assets…). */
export type TableSpec = {
  title?: string;
  description?: string;
  columns: string[];
  rows: string[][];
  emptyText: string;
};

/** Keep the last four characters: "•••• 4471". */
export function mask(value: unknown, keep = 4): string {
  const raw = text(value).replace(/\s+/g, '');
  if (!raw) return '';
  if (raw.length <= keep) return raw;
  return `•••• ${raw.slice(-keep)}`;
}

function yesNo(value: unknown): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
}

export function addressGroups(p: Profile): RowGroup[] {
  return [
    {
      title: 'Residential address',
      rows: [
        { label: 'Address line 1', value: text(p.residentialAddressLine1), copy: true },
        { label: 'Address line 2', value: text(p.residentialAddressLine2) },
        { label: 'Suburb', value: text(p.residentialSuburb) },
        { label: 'City', value: text(p.residentialCity) },
        { label: 'Province', value: text(p.residentialProvince) },
        { label: 'Postal code', value: text(p.residentialPostalCode), copy: true },
        { label: 'Country', value: text(p.residentialCountry) },
        {
          label: 'Proof of residence',
          value: p.proofOfResidenceUploaded ? text(p.proofOfResidenceFileName) || 'Uploaded' : '',
        },
      ],
    },
    {
      title: 'Work address',
      rows: [
        { label: 'Address line 1', value: text(p.workAddressLine1), copy: true },
        { label: 'Address line 2', value: text(p.workAddressLine2) },
        { label: 'Suburb', value: text(p.workSuburb) },
        { label: 'City', value: text(p.workCity) },
        { label: 'Province', value: text(p.workProvince) },
        { label: 'Postal code', value: text(p.workPostalCode), copy: true },
        { label: 'Country', value: text(p.workCountry) },
      ],
    },
  ];
}

export function employmentView(p: Profile): { groups: RowGroup[]; tables: TableSpec[] } {
  const selfEmployed = [
    { label: 'Company / business name', value: text(p.selfEmployedCompanyName) },
    { label: 'Industry of operation', value: text(p.selfEmployedIndustry) },
    { label: 'Business description', value: text(p.selfEmployedDescription) },
  ];
  return {
    groups: [
      { rows: [{ label: 'Employment status', value: text(p.employmentStatus) }] },
      ...(selfEmployed.some((r) => r.value)
        ? [{ title: 'Additional income sources', rows: selfEmployed }]
        : []),
    ],
    tables: [
      {
        title: "Client's employers",
        columns: ['Employer name', 'Job title', 'Industry'],
        rows: (p.employers ?? []).map((e) => [
          text(e.employerName),
          text(e.jobTitle),
          text(e.industry),
        ]),
        emptyText: 'No employers recorded.',
      },
    ],
  };
}

export function healthView(p: Profile): { groups: RowGroup[]; tables: TableSpec[] } {
  const height = Number(p.height) > 0 ? `${p.height} ${p.heightUnit || 'cm'}` : '';
  const weight = Number(p.weight) > 0 ? `${p.weight} ${p.weightUnit || 'kg'}` : '';
  return {
    groups: [
      {
        rows: [
          { label: 'Height', value: height },
          { label: 'Weight', value: weight },
          { label: 'Blood type', value: text(p.bloodType) },
          { label: 'Smoker', value: yesNo(p.smokerStatus) },
          { label: 'Health conditions', value: yesNo(p.hasChronicConditions) },
        ],
      },
    ],
    tables: [
      {
        title: 'Health conditions',
        columns: ['Condition', 'Diagnosed', 'Treating doctor', 'Treatment status'],
        rows: (p.chronicConditions ?? []).map((c) => [
          text(c.conditionName),
          [text(c.monthDiagnosed), text(c.yearDiagnosed)].filter(Boolean).join(' '),
          text(c.treatingDoctor),
          c.onTreatment ? 'On treatment' : 'Not on treatment',
        ]),
        emptyText: 'No health conditions recorded.',
      },
    ],
  };
}

export function familyTable(p: Profile): TableSpec {
  return {
    columns: [
      'Full name',
      'Relationship',
      'Date of birth',
      'Gender',
      'ID / passport number',
      'Dependency status',
    ],
    rows: (p.familyMembers ?? []).map((m) => [
      text(m.fullName),
      text(m.relationship),
      date(m.dateOfBirth),
      text(m.gender),
      mask(m.idPassportNumber),
      m.isFinanciallyDependent ? 'Financially dependent' : 'Not dependent',
    ]),
    emptyText: 'No family members recorded.',
  };
}

export function bankingTable(p: Profile): TableSpec {
  return {
    columns: ['Bank', 'Account holder', 'Account type', 'Account number', 'Branch code', 'Status'],
    rows: (p.bankAccounts ?? []).map((a) => [
      text(a.customBankName) || text(a.bankName),
      text(a.accountHolderName),
      text(a.accountType),
      mask(a.accountNumber),
      text(a.customBranchCode) || text(a.branchCode),
      [a.isPrimary ? 'Primary' : '', a.proofOfBankDocument ? 'Proof uploaded' : 'No proof']
        .filter(Boolean)
        .join(' · '),
    ]),
    emptyText: 'No bank accounts recorded.',
  };
}

const KYC_LABELS: Record<string, string> = {
  'national-id': 'Identity',
  passport: 'Passport',
  'drivers-license': "Driver's licence",
  'proof-of-residence': 'Proof of residence',
  'proof-primary-bank-account': 'Proof of primary bank account',
  'utility-bill': 'Utility bill',
};

export function kycTable(p: Profile): TableSpec {
  return {
    description: "KYC documents support the client's compliance record.",
    columns: ['Document', 'Country of issue', 'Expiry', 'Uploaded', 'Status'],
    rows: (p.identityDocuments ?? []).map((d) => [
      KYC_LABELS[d.type] ?? text(d.type),
      text(d.countryOfIssue) || '—',
      date(d.expiryDate) || '—',
      date(d.uploadDate) || '—',
      d.isVerified ? 'Verified' : d.fileName ? 'Uploaded' : 'Missing',
    ]),
    emptyText: 'No KYC documents yet.',
  };
}

export function assetsView(p: Profile): { groups: RowGroup[]; tables: TableSpec[] } {
  const assets = p.assets ?? [];
  const liabilities = p.liabilities ?? [];
  const totalAssets = assets.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
  const totalLiabilities = liabilities.reduce(
    (sum, l) => sum + (Number(l.outstandingBalance) || 0),
    0,
  );
  const rand = (n: number) => `R ${formatCurrencyDisplay(n)}`;
  return {
    groups: [
      {
        rows: [
          { label: 'Manual assets', value: rand(totalAssets) },
          { label: 'Total liabilities', value: rand(totalLiabilities) },
          { label: 'Net worth', value: rand(totalAssets - totalLiabilities) },
        ],
      },
    ],
    tables: [
      {
        title: 'Assets',
        columns: ['Asset type', 'Name / description', 'Value', 'Ownership', 'Provider'],
        rows: assets.map((a) => [
          text(a.customType) || text(a.type),
          text(a.name) || text(a.description),
          money(a.value) || 'R 0',
          text(a.ownershipType),
          text(a.provider),
        ]),
        emptyText: 'No assets recorded.',
      },
      {
        title: 'Liabilities',
        columns: [
          'Liability type',
          'Name / description',
          'Provider / bank',
          'Outstanding',
          'Monthly',
          'Interest',
        ],
        rows: liabilities.map((l) => [
          text(l.customType) || text(l.type),
          text(l.name) || text(l.description),
          text(l.provider),
          money(l.outstandingBalance) || 'R 0',
          money(l.monthlyPayment) || 'R 0',
          Number(l.interestRate) > 0 ? `${l.interestRate}%` : '—',
        ]),
        emptyText: 'No liabilities recorded.',
      },
    ],
  };
}
