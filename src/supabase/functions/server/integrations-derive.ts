/**
 * Integration derived-data helpers (Phase 5 decomposition).
 * =========================================================
 *
 * Extracted verbatim from integrations.tsx (these lived after `export default
 * app`). recalculateClientTotals re-aggregates a client's policy totals into the
 * client profile; autoGenerateCustomKeysForSchema derives custom-key definitions
 * for a category schema. Shared by the sync-run engine (publishSyncRun) and the
 * policy/schema/recalculate routes. Deps: kv + logger + SchemaField type only.
 */
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { DEFAULT_SCHEMAS } from './default-schemas.ts';
import type { SchemaField, KvPolicy, KvSchema, CustomKey } from './integrations-types.ts';

const log = createModuleLogger('integrations-derive');

// Helper function to recalculate client totals
export async function recalculateClientTotals(clientId: string) {
  try {
    log.info('Recalculating client totals', { clientId });

    const policiesKey = `policies:client:${clientId}`;
    const allPolicies = (await kv.get(policiesKey)) || [];

    log.info(`Found ${allPolicies.length} total policies for client`, { clientId });

    const totals: Record<string, number> = {};

    const totalKeyMappings: Record<string, string[]> = {
      risk_life_cover_total: ['risk_life_cover'],
      risk_severe_illness_total: ['risk_severe_illness'],
      risk_disability_total: ['risk_disability'],
      risk_temporary_icb_total: ['risk_temporary_icb'],
      risk_permanent_icb_total: ['risk_permanent_icb'],
      risk_total_premium: ['risk_monthly_premium'],
      medical_aid_total_premium: ['medical_aid_monthly_premium'],
      retirement_total_contribution: ['retirement_monthly_contribution'],
      retirement_fund_value_total: ['retirement_fund_value'],
      post_retirement_capital_total: ['post_retirement_capital_value'],
      post_retirement_income_total: ['post_retirement_drawdown_amount'],
      invest_total_contribution: ['invest_monthly_contribution'],
      eb_total_premium: [
        'eb_monthly_premium',
        'eb_risk_monthly_premium',
        'eb_retirement_contribution_employee',
        'eb_retirement_contribution_employer',
      ],
      estate_total_annual_fee: ['estate_annual_fee'],
      tax_total_annual_fee: ['tax_annual_fee'],
    };

    const totalKeyToCategoryIds: Record<string, string[]> = {
      risk_life_cover_total: ['risk_planning'],
      risk_severe_illness_total: ['risk_planning'],
      risk_disability_total: ['risk_planning'],
      risk_temporary_icb_total: ['risk_planning'],
      risk_permanent_icb_total: ['risk_planning'],
      risk_total_premium: ['risk_planning'],
      medical_aid_total_premium: ['medical_aid'],
      retirement_total_contribution: ['retirement_planning', 'retirement_pre'],
      retirement_fund_value_total: ['retirement_planning', 'retirement_pre'],
      post_retirement_capital_total: ['retirement_post'],
      post_retirement_income_total: ['retirement_post'],
      invest_total_contribution: ['investments', 'investments_voluntary', 'investments_guaranteed'],
      eb_total_premium: [
        'employee_benefits',
        'employee_benefits_risk',
        'employee_benefits_retirement',
      ],
      estate_total_annual_fee: ['estate_planning'],
      tax_total_annual_fee: ['tax_planning'],
    };

    for (const [totalKey, individualKeys] of Object.entries(totalKeyMappings)) {
      let total = 0;

      const categoryIds = totalKeyToCategoryIds[totalKey] || [];

      const categoryPolicies = allPolicies.filter(
        (p: KvPolicy) => categoryIds.includes(p.categoryId) && !p.archived,
      );

      for (const policy of categoryPolicies) {
        if (!policy.data) continue;

        const schemaKey = `config:schema:${policy.categoryId}`;
        let schema = await kv.get(schemaKey);

        if (!schema) {
          schema = DEFAULT_SCHEMAS[policy.categoryId];
        }

        const schemaRecord = schema as KvSchema | null;
        if (!schemaRecord?.fields) continue;

        const fields = schemaRecord.fields;

        for (const [fieldId, value] of Object.entries(policy.data)) {
          const fieldDef = fields.find((f: SchemaField) => f.id === fieldId);

          if (!fieldDef || !fieldDef.keyId) continue;

          if (individualKeys.includes(fieldDef.keyId)) {
            const numValue = Number(value) || 0;
            if (numValue > 0) {
              total += numValue;
            }
          }
        }
      }

      totals[totalKey] = total;
    }

    const clientKeysKey = `user_profile:${clientId}:client_keys`;
    await kv.set(clientKeysKey, totals);

    log.info('Client key totals saved to ' + clientKeysKey, { totals });
  } catch (e) {
    log.error('Error recalculating client totals:', e);
  }
}

// Helper function to auto-generate custom keys for unmapped fields in a schema
export async function autoGenerateCustomKeysForSchema(categoryId: string, fields: SchemaField[]) {
  try {
    log.info('Auto-generating custom keys for unmapped fields', {
      categoryId,
      fieldCount: fields.length,
    });

    const customKeysKey = `config:custom_keys:${categoryId}`;
    const existingCustomKeys = (await kv.get(customKeysKey)) || [];

    const categoryMap: Record<string, string> = {
      risk_planning: 'risk',
      medical_aid: 'medical_aid',
      retirement_planning: 'retirement',
      investments: 'invest',
      employee_benefits: 'employee_benefits',
      estate_planning: 'estate_planning',
      tax_planning: 'tax',
    };

    const keyCategory = categoryMap[categoryId];
    if (!keyCategory) return;

    const newCustomKeys: CustomKey[] = [];
    let keysAdded = 0;

    for (const field of fields) {
      if (!field.name || field.name.trim() === '') continue;

      if (!field.keyId || field.keyId === '') {
        const sanitizedName = field.name
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 50);

        const customKeyId = `custom_${keyCategory}_${sanitizedName}`;

        const keyExists = (existingCustomKeys as CustomKey[]).some((k) => k.id === customKeyId);

        if (!keyExists) {
          const newKey = {
            id: customKeyId,
            category: keyCategory,
            name: field.name,
            description: `Custom key for ${field.name} (auto-generated from product structure)`,
            dataType:
              field.type === 'currency'
                ? 'currency'
                : field.type === 'number'
                  ? 'number'
                  : field.type === 'date'
                    ? 'date'
                    : 'text',
            isCalculated: false,
            isCustom: true,
            createdAt: new Date().toISOString(),
            sourceField: field.id,
          };

          newCustomKeys.push(newKey);
          keysAdded++;
        }
      }
    }

    if (newCustomKeys.length > 0) {
      const updatedCustomKeys = [...existingCustomKeys, ...newCustomKeys];
      await kv.set(customKeysKey, updatedCustomKeys);
      log.info(`Added ${keysAdded} new custom keys to ${customKeysKey}`);
    }
  } catch (e) {
    log.error('Error auto-generating custom keys:', e);
  }
}
