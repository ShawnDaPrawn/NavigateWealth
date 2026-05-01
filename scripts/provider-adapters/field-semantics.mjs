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

export function isPlausibleValueForField(field, value, item) {
  const text = sampleSemanticText(value, 160);
  if (!text) return false;

  switch (getFieldSemanticKind(field)) {
    case 'policy_number':
      return normaliseProviderPolicyNumber(text).includes(normaliseProviderPolicyNumber(item?.policyNumber || text));
    case 'date_of_inception':
      return isLikelyDateValue(text);
    case 'current_value':
      return isLikelyCurrencyValue(text);
    case 'product_type':
      return isLikelyProductTypeValue(text);
    default:
      return text.length <= 220;
  }
}
