/**
 * Option lists for the application review dialog's selects.
 *
 * Split out of shared.tsx so that file exports components only: a module that
 * mixes component and non-component exports defeats React Fast Refresh, which
 * is what react-refresh/only-export-components warns about.
 *
 * ApplicationPreviewDialog previously carried its own byte-identical copies of
 * the first five of these; it now reads them from here.
 */
export const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'];
export const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
export const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Life Partner'];
export const MARITAL_REGIMES = [
  'In Community of Property',
  'Out of Community of Property (with accrual)',
  'Out of Community of Property (without accrual)',
];
export const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];
export const EMPLOYMENT_STATUSES = [
  { value: 'employed', label: 'Employed' },
  { value: 'self-employed', label: 'Self-Employed' },
  { value: 'contract', label: 'Contract Worker' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'retired', label: 'Retired' },
  { value: 'student', label: 'Student' },
];
