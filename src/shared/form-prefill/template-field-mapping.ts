import type { FormTemplateField } from './types.ts';

export interface TemplateMappingOption {
  canonicalKey: string;
  label: string;
  aliases: string[];
}

export const TEMPLATE_MAPPING_OPTIONS: TemplateMappingOption[] = [
  {
    canonicalKey: 'profile_first_name',
    label: 'First name',
    aliases: ['first name', 'firstname', 'given name', 'forename', 'client first name'],
  },
  {
    canonicalKey: 'profile_last_name',
    label: 'Last name',
    aliases: ['last name', 'lastname', 'surname', 'family name', 'client surname'],
  },
  {
    canonicalKey: 'derived:full_name',
    label: 'Full name (derived)',
    aliases: ['full name', 'fullname', 'client full name', 'name and surname'],
  },
  {
    canonicalKey: 'profile_email',
    label: 'Email',
    aliases: ['email', 'email address', 'e mail'],
  },
  {
    canonicalKey: 'profile_phone_number',
    label: 'Phone',
    aliases: ['phone', 'phone number', 'mobile', 'mobile number', 'cellphone', 'cell phone', 'cell number', 'telephone', 'tel'],
  },
  {
    canonicalKey: 'profile_id_number',
    label: 'ID number',
    aliases: ['id number', 'id no', 'identity number', 'sa id', 'passport number', 'id passport'],
  },
  {
    canonicalKey: 'profile_tax_number',
    label: 'Tax number',
    aliases: ['tax number', 'tax no', 'income tax number', 'tax reference number'],
  },
  {
    canonicalKey: 'profile_date_of_birth',
    label: 'Date of birth',
    aliases: ['date of birth', 'birth date', 'dob'],
  },
  {
    canonicalKey: 'profile_marital_status',
    label: 'Marital status',
    aliases: ['marital status', 'marriage status'],
  },
  {
    canonicalKey: 'derived:age_from_dob',
    label: 'Age (derived)',
    aliases: ['current age', 'client age', 'age'],
  },
  {
    canonicalKey: 'profile_gross_monthly_income',
    label: 'Gross monthly income',
    aliases: ['gross monthly income', 'gross income', 'gross salary', 'monthly gross income'],
  },
  {
    canonicalKey: 'profile_net_monthly_income',
    label: 'Net monthly income',
    aliases: ['net monthly income', 'net income', 'take home pay', 'monthly net income'],
  },
  {
    canonicalKey: 'profile_retirement_age',
    label: 'Retirement age',
    aliases: ['retirement age', 'planned retirement age', 'intended retirement age'],
  },
  {
    canonicalKey: 'profile_spouse_name',
    label: 'Spouse name',
    aliases: ['spouse name', 'spouse full name', 'partner name'],
  },
  {
    canonicalKey: 'derived:dependant_count',
    label: 'Number of dependants',
    aliases: ['dependant count', 'dependent count', 'number of dependants', 'number of dependents'],
  },
  {
    canonicalKey: 'retirement_monthly_contribution',
    label: 'Retirement monthly contribution',
    aliases: ['retirement contribution', 'monthly retirement contribution', 'retirement monthly contribution'],
  },
  {
    canonicalKey: 'retirement_fund_value_total',
    label: 'Retirement fund value',
    aliases: ['retirement capital', 'current retirement capital', 'retirement fund value', 'current retirement savings'],
  },
  {
    canonicalKey: 'risk_life_cover_total',
    label: 'Life cover total',
    aliases: ['existing life cover', 'life cover total', 'life cover', 'sum assured life'],
  },
];

const MIN_AUTOMAP_SCORE = 70;
const MIN_AUTOMAP_MARGIN = 8;

function normalizePhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function compactPhrase(value: string): string {
  return normalizePhrase(value).replace(/\s+/g, '');
}

function scoreAlias(
  normalizedText: string,
  compactText: string,
  tokenSet: Set<string>,
  alias: string,
): number {
  const normalizedAlias = normalizePhrase(alias);
  if (!normalizedAlias) return 0;

  const compactAlias = compactPhrase(alias);
  if (!compactAlias) return 0;

  if (normalizedText === normalizedAlias) return 100;
  if (compactText === compactAlias) return 96;
  if (normalizedText.includes(normalizedAlias) && normalizedAlias.length >= 4) return 90;
  if (compactText.includes(compactAlias) && compactAlias.length >= 4) return 88;

  const aliasTokens = normalizedAlias.split(' ').filter(Boolean);
  if (aliasTokens.length === 1 && aliasTokens[0].length >= 3 && tokenSet.has(aliasTokens[0])) return 86;
  if (aliasTokens.length > 1 && aliasTokens.every((token) => tokenSet.has(token))) return 82;

  return 0;
}

export function suggestTemplateFieldMapping(
  field: Pick<FormTemplateField, 'name' | 'label'>,
): string | undefined {
  const combinedText = [field.label, field.name]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');

  const normalizedText = normalizePhrase(combinedText);
  const compactText = compactPhrase(combinedText);
  const tokenSet = new Set(normalizedText.split(' ').filter(Boolean));

  let best: { canonicalKey: string; score: number } | null = null;
  let secondBestScore = 0;

  for (const option of TEMPLATE_MAPPING_OPTIONS) {
    const score = [option.label, ...option.aliases].reduce(
      (currentBest, alias) => Math.max(currentBest, scoreAlias(normalizedText, compactText, tokenSet, alias)),
      0,
    );

    if (!best || score > best.score) {
      secondBestScore = best?.score ?? 0;
      best = { canonicalKey: option.canonicalKey, score };
    } else if (score > secondBestScore) {
      secondBestScore = score;
    }
  }

  if (!best) return undefined;
  if (best.score < MIN_AUTOMAP_SCORE) return undefined;
  if (best.score - secondBestScore < MIN_AUTOMAP_MARGIN) return undefined;
  return best.canonicalKey;
}

export function autoMapTemplateFields<T extends Pick<FormTemplateField, 'name' | 'label' | 'canonicalKey'>>(
  fields: T[],
  options: { onlyUnmapped?: boolean } = {},
): { fields: Array<T & { canonicalKey?: string }>; assignedCount: number } {
  const onlyUnmapped = options.onlyUnmapped ?? false;
  let assignedCount = 0;

  const mappedFields = fields.map((field) => {
    if (onlyUnmapped && field.canonicalKey) return field;

    const canonicalKey = suggestTemplateFieldMapping(field);
    if (!canonicalKey || canonicalKey === field.canonicalKey) return field;

    assignedCount += 1;
    return { ...field, canonicalKey };
  });

  return { fields: mappedFields, assignedCount };
}
