/**
 * Policy Extraction Prompt Templates
 *
 * Provider-specific and generic prompt templates for AI-powered
 * policy document data extraction. Each template instructs the model
 * to return structured JSON matching the canonical ExtractedPolicyData shape.
 *
 * @module policy-extraction-prompts
 */

// ---------------------------------------------------------------------------
// Prompt Version Registry
// ---------------------------------------------------------------------------

/** Semantic version for the generic prompt template */
export const GENERIC_PROMPT_VERSION = '1.0.0';

/** Per-provider prompt versions — increment when a provider prompt is modified */
export const PROVIDER_PROMPT_VERSIONS: Record<string, string> = {
  liberty: '1.0.0',
  discovery: '1.0.0',
  sanlam: '1.0.0',
  momentum: '1.0.0',
  old_mutual: '1.0.0',
  fmi: '1.0.0',
  hollard: '1.0.0',
};

// ---------------------------------------------------------------------------
// JSON output schema description (shared across all prompts)
// ---------------------------------------------------------------------------

const OUTPUT_SCHEMA_DESCRIPTION = `
You MUST respond with valid JSON matching this exact structure. Do NOT include markdown fences or commentary.

{
  "policyNumber": { "value": "string", "confidence": 0.0-1.0, "source": "page/section hint" },
  "providerName": { "value": "string", "confidence": 0.0-1.0 },
  "productName": { "value": "string", "confidence": 0.0-1.0 },
  "policyOwner": { "value": "string", "confidence": 0.0-1.0 },
  "insuredLife": { "value": "string", "confidence": 0.0-1.0 },
  "policyStartDate": { "value": "YYYY-MM-DD", "confidence": 0.0-1.0 },
  "policyStatus": { "value": "string", "confidence": 0.0-1.0 },
  "premiumAmount": { "value": number, "confidence": 0.0-1.0 },
  "premiumFrequency": { "value": "monthly|annual|quarterly", "confidence": 0.0-1.0 },
  "benefits": [
    {
      "canonicalType": { "value": "canonical_key_id", "confidence": 0.0-1.0 },
      "providerTermName": { "value": "term as on document", "confidence": 0.0-1.0 },
      "coverAmount": { "value": number, "confidence": 0.0-1.0 },
      "waitingPeriod": { "value": "string", "confidence": 0.0-1.0 },
      "expiryAge": { "value": number, "confidence": 0.0-1.0 }
    }
  ],
  "overallConfidence": 0.0-1.0,
  "aiSummary": "Brief 1-2 sentence summary of what this policy covers"
}

Confidence scoring rules:
- 1.0: Exact match found, clearly labelled in the document
- 0.8-0.9: High confidence, value found but minor ambiguity
- 0.5-0.7: Moderate confidence, inferred from context
- 0.1-0.4: Low confidence, best guess from partial data
- 0.0: Field not found in document at all (omit the field entirely)

If a field is not present in the document, omit it from the response (do not include it with confidence 0).
All monetary values must be numeric (no currency symbols, no commas).
Dates must be in YYYY-MM-DD format.
`.trim();

// ---------------------------------------------------------------------------
// Canonical benefit key reference
// ---------------------------------------------------------------------------

const CANONICAL_KEYS_REFERENCE = `
When mapping benefits to canonical types, use these canonical key IDs:

RISK PLANNING:
- risk_life_cover: Life cover / death benefit amount
- risk_severe_illness: Severe illness / critical illness / dread disease cover
- risk_disability: Lump sum disability cover / capital disability
- risk_temporary_icb: Income continuation benefit (temporary) / income protection (temporary)
- risk_permanent_icb: Income continuation benefit (permanent) / income protection (permanent)
- risk_monthly_premium: Monthly premium for the risk policy

MEDICAL AID:
- medical_aid_plan_type: Plan name or option (e.g. "Executive", "Comprehensive")
- medical_aid_monthly_premium: Monthly medical aid contribution
- medical_aid_dependents: Number of dependents on the plan

RETIREMENT (PRE):
- retirement_fund_type: Fund type (RA, Pension, Provident, Preservation)
- retirement_fund_value: Current fund value
- retirement_monthly_contribution: Monthly contribution / premium

RETIREMENT (POST):
- post_retirement_capital_value: Living annuity capital value
- post_retirement_drawdown_amount: Monthly income / drawdown

INVESTMENTS:
- invest_product_type: Product type (Unit Trust, TFSA, Endowment, etc.)
- invest_current_value: Current investment value
- invest_monthly_contribution: Monthly contribution

EMPLOYEE BENEFITS:
- eb_group_life_cover: Group life cover amount
- eb_group_disability: Group disability cover amount
- eb_group_ip_monthly: Group income protection monthly benefit
- eb_monthly_premium: Employee benefits monthly premium

If the benefit does not match any canonical key, use a descriptive key like "other_benefit_name".
`.trim();

// ---------------------------------------------------------------------------
// Generic / Default Prompt
// ---------------------------------------------------------------------------

export const GENERIC_EXTRACTION_PROMPT = `
You are an expert South African insurance policy document analyst.
Your task is to extract structured data from the provided policy document text.

${CANONICAL_KEYS_REFERENCE}

${OUTPUT_SCHEMA_DESCRIPTION}
`.trim();

// ---------------------------------------------------------------------------
// Provider-Specific Prompts
// ---------------------------------------------------------------------------

export const PROVIDER_PROMPTS: Record<string, string> = {
  // Liberty
  liberty: `
You are an expert analyst specialising in Liberty Life policy documents from South Africa.

Liberty-specific terminology mappings:
- "Lifestyle Protector" → risk_severe_illness (Severe Illness Cover)
- "Capital Disability Benefit" → risk_disability
- "Income Continuation Benefit" / "ICB" → risk_temporary_icb or risk_permanent_icb (check if temporary or permanent)
- "Lifestyle Protection Plan" → the umbrella product name, not a benefit
- "Death Benefit" / "Life Cover" → risk_life_cover
- "Fund Value" → retirement_fund_value
- "Evolve" → is a product platform, not a benefit type
- "Monthly Risk Premium" → risk_monthly_premium

Liberty policies often have a "BENEFIT SCHEDULE" section listing all benefits, cover amounts, and waiting periods.
The policy number typically appears near "Policy Number" or "Contract Number" at the top.

${CANONICAL_KEYS_REFERENCE}

${OUTPUT_SCHEMA_DESCRIPTION}
`.trim(),

  // Discovery
  discovery: `
You are an expert analyst specialising in Discovery Life and Discovery Health policy documents from South Africa.

Discovery-specific terminology mappings:
- "Severe Illness Cover" → risk_severe_illness
- "Capital Disability Benefit" → risk_disability
- "Income Continuation Benefit" → risk_temporary_icb or risk_permanent_icb
- "PaySmart Premium" / "Smoothed Premium" / "Total Premium" → look for the actual monthly debit amount
- "Life Cover" → risk_life_cover
- "Vitality" → is a wellness programme, not a benefit (ignore for extraction)
- "Discovery Invest" → investment product (invest_product_type)
- "KeyCare" / "Classic" / "Executive" / "Comprehensive" → medical_aid_plan_type
- "Fund Value" → retirement_fund_value or invest_current_value depending on context

Discovery policy schedules typically have a clear tabular "BENEFIT DETAILS" section.
The policy number format is usually numeric (e.g., 12345678).

${CANONICAL_KEYS_REFERENCE}

${OUTPUT_SCHEMA_DESCRIPTION}
`.trim(),

  // Sanlam
  sanlam: `
You are an expert analyst specialising in Sanlam policy documents from South Africa.

Sanlam-specific terminology mappings:
- "Dread Disease" → risk_severe_illness
- "Disability Cover" / "Capital Disability" → risk_disability
- "Income Disability" / "Income Protector" → risk_temporary_icb or risk_permanent_icb
- "Life Cover" / "Death Cover" → risk_life_cover
- "Glacier" → is an investment platform brand (invest_product_type)
- "BrightRock" → rebranded but still Sanlam group
- "Monthly Premium" / "Total Monthly Cost" → risk_monthly_premium
- "Retirement Annuity" → retirement_fund_type
- "Cumulus Echo" / "Personal Umbrella Fund" → retirement product names

Sanlam policies typically list benefits in a "SCHEDULE OF BENEFITS" or "BENEFIT SUMMARY".

${CANONICAL_KEYS_REFERENCE}

${OUTPUT_SCHEMA_DESCRIPTION}
`.trim(),

  // Momentum / Metropolitan
  momentum: `
You are an expert analyst specialising in Momentum and Metropolitan policy documents from South Africa.

Momentum-specific terminology mappings:
- "Dreaded Disease" / "Critical Illness" → risk_severe_illness
- "Disability Lump Sum" → risk_disability
- "Income Protection" → risk_temporary_icb or risk_permanent_icb
- "Life Protector" → risk_life_cover
- "Myriad" → product platform name (not a benefit)
- "Investo" → investment product platform
- "FundsAtWork" → employee benefits umbrella (eb_*)

Metropolitan policies may use simpler terminology. Both brands share the same format.

${CANONICAL_KEYS_REFERENCE}

${OUTPUT_SCHEMA_DESCRIPTION}
`.trim(),

  // Old Mutual
  old_mutual: `
You are an expert analyst specialising in Old Mutual policy documents from South Africa.

Old Mutual-specific terminology mappings:
- "Dreaded Disease Benefit" → risk_severe_illness
- "Disability Benefit" → risk_disability
- "Income Protection Benefit" → risk_temporary_icb or risk_permanent_icb
- "Death Benefit" / "Life Cover" → risk_life_cover
- "Greenlight" → investment product (invest_product_type)
- "Max Investments" → investment platform
- "SuperFund" / "Superfund" → retirement product (retirement_fund_type)
- "Monthly Premium" → risk_monthly_premium

Old Mutual policy schedules often have "SUMMARY OF BENEFITS" near the start.

${CANONICAL_KEYS_REFERENCE}

${OUTPUT_SCHEMA_DESCRIPTION}
`.trim(),

  // FMI (First Mutual Insurance)
  fmi: `
You are an expert analyst specialising in FMI (formerly First Mutual Insurance) policy documents from South Africa.
FMI primarily offers income protection products.

FMI-specific terminology mappings:
- "Income Protector" → risk_temporary_icb or risk_permanent_icb (check waiting period)
- "Lump Sum Disability" → risk_disability
- "Critical Illness" → risk_severe_illness
- "Total Monthly Premium" → risk_monthly_premium
- FMI typically has waiting periods of 7, 14, 30, 60, or 90 days

FMI documents are typically concise with a clear benefit schedule.

${CANONICAL_KEYS_REFERENCE}

${OUTPUT_SCHEMA_DESCRIPTION}
`.trim(),

  // Hollard
  hollard: `
You are an expert analyst specialising in Hollard policy documents from South Africa.

Hollard-specific terminology mappings:
- "Life Cover" → risk_life_cover
- "Dread Disease" / "Critical Illness" → risk_severe_illness
- "Disability" → risk_disability
- "Income Protection" → risk_temporary_icb
- "Monthly Premium" → risk_monthly_premium
- Hollard often underwrites through intermediaries (e.g. BrightRock, Guardrisk)

${CANONICAL_KEYS_REFERENCE}

${OUTPUT_SCHEMA_DESCRIPTION}
`.trim(),
};

// ---------------------------------------------------------------------------
// Prompt Selection Helper
// ---------------------------------------------------------------------------

/**
 * Select the best prompt template for a given provider name.
 * Falls back to the generic prompt if no provider-specific match exists.
 * Returns both the prompt text and its version.
 */
export function getExtractionPrompt(providerName: string): string {
  const normalised = providerName.toLowerCase().trim();

  // Direct key match
  if (PROVIDER_PROMPTS[normalised]) {
    return PROVIDER_PROMPTS[normalised];
  }

  // Substring match against known providers
  const providerKeywords: Record<string, string> = {
    liberty: 'liberty',
    discovery: 'discovery',
    sanlam: 'sanlam',
    momentum: 'momentum',
    metropolitan: 'momentum', // Same group
    'old mutual': 'old_mutual',
    oldmutual: 'old_mutual',
    fmi: 'fmi',
    'first mutual': 'fmi',
    hollard: 'hollard',
    brightr: 'sanlam', // BrightRock is Sanlam group
  };

  for (const [keyword, key] of Object.entries(providerKeywords)) {
    if (normalised.includes(keyword)) {
      return PROVIDER_PROMPTS[key];
    }
  }

  // Fall back to generic
  return GENERIC_EXTRACTION_PROMPT;
}

/**
 * Resolve the prompt version for a given provider name.
 * Matches the same resolution logic as getExtractionPrompt.
 */
export function getPromptVersion(providerName: string): string {
  const normalised = providerName.toLowerCase().trim();

  // Direct key match
  if (PROVIDER_PROMPT_VERSIONS[normalised]) {
    return PROVIDER_PROMPT_VERSIONS[normalised];
  }

  // Substring match against known providers
  const providerKeywords: Record<string, string> = {
    liberty: 'liberty',
    discovery: 'discovery',
    sanlam: 'sanlam',
    momentum: 'momentum',
    metropolitan: 'momentum',
    'old mutual': 'old_mutual',
    oldmutual: 'old_mutual',
    fmi: 'fmi',
    'first mutual': 'fmi',
    hollard: 'hollard',
    brightr: 'sanlam',
  };

  for (const [keyword, key] of Object.entries(providerKeywords)) {
    if (normalised.includes(keyword) && PROVIDER_PROMPT_VERSIONS[key]) {
      return PROVIDER_PROMPT_VERSIONS[key];
    }
  }

  return GENERIC_PROMPT_VERSION;
}