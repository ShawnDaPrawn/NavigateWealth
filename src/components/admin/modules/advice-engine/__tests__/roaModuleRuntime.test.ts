import { describe, expect, it } from 'vitest';
import { FALLBACK_ROA_MODULE_CONTRACTS } from '../roaModuleContractFallbacks';
import {
  getFallbackRuntimeModules,
  getModuleRuntimeStatus,
  moduleContractToRuntimeModule,
  normalizeModuleOutput,
  renderRuntimeTemplate,
} from '../roaModuleRuntime';
import type { RoAEvidenceItem } from '../types';

const comparisonContract = FALLBACK_ROA_MODULE_CONTRACTS.find(
  (contract) => contract.id === 'life_insurance_comparison',
);

function evidence(requirementId: string): RoAEvidenceItem {
  return {
    id: `${requirementId}-evidence`,
    requirementId,
    label: requirementId,
    type: 'comparison',
    fileName: `${requirementId}.pdf`,
    mimeType: 'application/pdf',
    size: 1024,
    storagePath: `pending-upload://life_insurance_comparison/${requirementId}.pdf`,
    source: 'adviser-upload',
    uploadedAt: '2026-05-04T00:00:00.000Z',
  };
}

describe('roaModuleRuntime', () => {
  it('adapts an admin-editable module contract into a runtime module', () => {
    expect(comparisonContract).toBeDefined();
    const runtimeModule = moduleContractToRuntimeModule(comparisonContract!);

    expect(runtimeModule.id).toBe('life_insurance_comparison');
    expect(runtimeModule.formSchema?.sections[0].fields).toHaveLength(6);
    expect(runtimeModule.evidence?.requirements).toHaveLength(2);
    expect(runtimeModule.output?.normalizedKey).toBe('lifeInsuranceComparison');
    expect(runtimeModule.contractVersion).toBe(comparisonContract!.version);
    expect(runtimeModule.schemaVersion).toBe(comparisonContract!.schemaVersion);
    expect(runtimeModule.metadata?.flagshipModule).toBe(true);
  });

  it('uses contract fallback modules instead of the old static schema IDs', () => {
    const modules = getFallbackRuntimeModules();

    expect(modules.map((module) => module.id)).toEqual(FALLBACK_ROA_MODULE_CONTRACTS.map((contract) => contract.id));
    expect(modules.some((module) => module.id === 'life_recosting')).toBe(false);
    expect(modules.every((module) => module.documentSections && module.documentSections.length > 0)).toBe(true);
  });

  it('treats configured evidence requirements as blocking completion checks', () => {
    const runtimeModule = moduleContractToRuntimeModule(comparisonContract!);
    const status = getModuleRuntimeStatus(runtimeModule, {
      current_providers: ['Old Mutual'],
      current_monthly_premium: '1200',
      proposed_provider: 'Discovery Life',
      proposed_monthly_premium: '980',
      benefit_comparison: 'The proposed cover improves disability benefits.',
      replacement_rationale: 'The replacement reduces premium and improves benefits.',
    });

    expect(status.complete).toBe(false);
    expect(status.missingFields).toHaveLength(0);
    expect(status.missingEvidence.map((item) => item.id)).toEqual([
      'current_policy_schedule',
      'comparison_schedule',
    ]);
  });

  it('normalizes module data without hard-coding product-specific fields', () => {
    const runtimeModule = moduleContractToRuntimeModule(comparisonContract!);
    const moduleData = {
      current_providers: ['Old Mutual'],
      current_monthly_premium: '1200',
      proposed_provider: 'Discovery Life',
      proposed_monthly_premium: '980',
      benefit_comparison: 'The proposed cover improves disability benefits.',
      replacement_rationale: 'The replacement reduces premium and improves benefits.',
    };
    const moduleEvidence = {
      current_policy_schedule: evidence('current_policy_schedule'),
      comparison_schedule: evidence('comparison_schedule'),
    };

    const status = getModuleRuntimeStatus(runtimeModule, moduleData, moduleEvidence);
    const output = normalizeModuleOutput(runtimeModule, moduleData, moduleEvidence);

    expect(status.complete).toBe(true);
    expect(output.normalizedKey).toBe('lifeInsuranceComparison');
    expect(output.contractVersion).toBe(comparisonContract!.version);
    expect(output.values.replacement_rationale).toBe(moduleData.replacement_rationale);
    expect(output.evidence.comparison_schedule.fileName).toBe('comparison_schedule.pdf');
  });

  it('treats invalid attached evidence metadata as blocking at runtime', () => {
    const runtimeModule = moduleContractToRuntimeModule(comparisonContract!);
    const moduleData = {
      current_providers: ['Old Mutual'],
      current_monthly_premium: '1200',
      proposed_provider: 'Discovery Life',
      proposed_monthly_premium: '980',
      benefit_comparison: 'The proposed cover improves disability benefits.',
      replacement_rationale: 'The replacement reduces premium and improves benefits.',
    };
    const status = getModuleRuntimeStatus(runtimeModule, moduleData, {
      current_policy_schedule: {
        ...evidence('current_policy_schedule'),
        mimeType: 'text/plain',
      },
      comparison_schedule: evidence('comparison_schedule'),
    });

    expect(status.complete).toBe(false);
    expect(status.blocking.some((issue) => issue.id.includes(':mime_type'))).toBe(true);
  });

  it('renders document-section templates from the generic runtime context', () => {
    const text = renderRuntimeTemplate(
      'Client: {{client.displayName}}\nProvider: {{module.proposed_provider}}\nPremium: {{module.proposed_monthly_premium | currency}}',
      {
        client: { displayName: 'Jane Client' },
        module: { proposed_provider: 'Discovery Life', proposed_monthly_premium: 980 },
      },
    );

    expect(text).toContain('Client: Jane Client');
    expect(text).toContain('Provider: Discovery Life');
    expect(text).toContain('R');
  });
});
