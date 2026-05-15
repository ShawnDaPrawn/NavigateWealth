const AMBIGUOUS_PORTAL_TEXT = /\b(selected period|since inception|bank details|statement|download)\b/i;

export function normaliseProviderPolicyNumber(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
    .replace(/[-_/]/g, '');
}

export function sampleSemanticText(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export function normaliseFieldSignature(field) {
  return [
    field?.targetFieldId,
    field?.targetFieldName,
    field?.columnName,
    field?.sourceHeader,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function getFieldSemanticKind(field) {
  const signature = normaliseFieldSignature(field);
  if (/(policy\s*(number|no)|account\s*number|investment\s*number|reference)/i.test(signature)) return 'policy_number';
  if (/(date\s*of\s*inception|inception\s*date|start\s*date|investment\s*start\s*date)/i.test(signature)) return 'date_of_inception';
  if (/(date\s*of\s*last\s*signed\s*will|last\s*signed\s*will\s*date)/i.test(signature)) return 'last_signed_will_date';
  if (/(last\s*will(\s*&\s*testament)?|signed\s*copy\s*of\s*will|signed\s*original\s*of\s*will)/i.test(signature)) return 'last_will_testament';
  if (/(risk_monthly_premium|\bpremium\b|monthly\s+premium|current\s+monthly\s+premium)/i.test(signature)) return 'premium';
  if (/(risk_life_cover|life\s+cover|death\s+cover|caused\s+by\s+death)/i.test(signature)) return 'life_cover';
  if (/(risk_severe_illness|severe\s+illness|critical\s+illness|additional\s+expense)/i.test(signature)) return 'severe_illness';
  if (/(risk_disability|capital\s+disability|disability|that's\s+permanent)/i.test(signature)) return 'disability';
  if (/(risk_temporary_icb|temporary\s+icb|income\s+protection|that\s+you\s+can\s+recover\s+from)/i.test(signature)) return 'temporary_icb';
  if (/(ret(_pre|_post)?_3|retirement_fund_value|invest_current_value|fundvalue|currentvalue)/i.test(signature)) return 'current_value';
  if (
    !/(maturity|estimated|projected|guaranteed|premium|contribution)/i.test(signature)
    && /(current\s*value|fund\s*value|market\s*value|closing\s*balance|policy\s*value|account\s*value|retirement\s*annuity\s*value|\bvalue\b)/i.test(signature)
  ) return 'current_value';
  if (/(product\s*type|product\s*name|investment\s*type|retirement\s*annuity\s*fund)/i.test(signature)) return 'product_type';
  return 'generic';
}

export function getFallbackValueForField(field, fallbackValues = {}) {
  const kind = getFieldSemanticKind(field);
  if (kind === 'policy_number') return fallbackValues.policyNumber || '';
  if (kind === 'date_of_inception') return fallbackValues.dateOfInception || '';
  if (kind === 'last_signed_will_date') return fallbackValues.lastSignedWillDate || '';
  if (kind === 'last_will_testament') return fallbackValues.lastWillTestament || '';
  if (kind === 'premium') return fallbackValues.premium || '';
  if (kind === 'life_cover') return fallbackValues.lifeCover || '';
  if (kind === 'severe_illness') return fallbackValues.severeIllness || '';
  if (kind === 'disability') return fallbackValues.disability || '';
  if (kind === 'temporary_icb') return fallbackValues.temporaryIcb || '';
  if (kind === 'current_value') return fallbackValues.currentValue || '';
  if (kind === 'product_type') return fallbackValues.productType || '';
  return '';
}

export function isLikelyDateValue(value) {
  const text = sampleSemanticText(value, 120);
  if (!text) return false;
  if (AMBIGUOUS_PORTAL_TEXT.test(text)) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return true;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text)) return true;
  if (/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}$/.test(text)) return true;
  return !Number.isNaN(Date.parse(text));
}

export function isLikelyCurrencyValue(value) {
  const text = sampleSemanticText(value, 120);
  if (!text) return false;
  if (!/\d/.test(text)) return false;
  if (AMBIGUOUS_PORTAL_TEXT.test(text)) return false;
  return /(?:R\s*)?[-+]?\d[\d\s,.]*$/.test(text);
}

export function isLikelyProductTypeValue(value) {
  const text = sampleSemanticText(value, 160);
  if (!text) return false;
  if (/\b(selected period|since inception|bank details|statement|download|search|filter|details)\b/i.test(text)) return false;
  if (isLikelyDateValue(text)) return false;
  if (isLikelyCurrencyValue(text)) return false;
  if (text.length < 3 || text.length > 120) return false;
  return /[A-Za-z]/.test(text);
}

export function isLikelyBooleanValue(value) {
  const text = sampleSemanticText(value, 40).toLowerCase();
  if (!text) return false;
  return ['true', 'false', 'yes', 'no', 'y', 'n', '1', '0'].includes(text);
}

export function isPlausibleValueForField(field, value, item) {
  const text = sampleSemanticText(value, 160);
  if (!text) return false;

  switch (getFieldSemanticKind(field)) {
    case 'policy_number':
      return normaliseProviderPolicyNumber(text).includes(normaliseProviderPolicyNumber(item?.policyNumber || text));
    case 'date_of_inception':
    case 'last_signed_will_date':
      return isLikelyDateValue(text);
    case 'last_will_testament':
      return isLikelyBooleanValue(text);
    case 'premium':
    case 'life_cover':
    case 'severe_illness':
    case 'disability':
    case 'temporary_icb':
    case 'current_value':
      return isLikelyCurrencyValue(text);
    case 'product_type':
      return isLikelyProductTypeValue(text);
    default:
      return text.length <= 220;
  }
}
