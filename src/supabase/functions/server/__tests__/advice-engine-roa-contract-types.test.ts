import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROA_MODULE_CONTRACTS,
  ROA_MODULE_CONTRACT_SCHEMA_FORMAT,
  contractToLegacyModule,
  validateRoAModuleContract,
} from '../advice-engine-roa-contract-types.ts';
import {
  AdviceEngineRoAService,
  buildCanonicalRoACompilation,
  createCanonicalRoADocx,
  createCanonicalRoAPdf,
  type RoADraftRecord,
} from '../advice-engine-roa-service.ts';

describe('RoA module contract definitions', () => {
  it('ships valid default contracts for the first editable RoA module set', () => {
    expect(DEFAULT_ROA_MODULE_CONTRACTS.map((contract) => contract.id)).toEqual([
      'new_life_assurance_proposal',
      'life_insurance_comparison',
      'new_investment_proposal',
      'investment_replacement_proposal',
      'new_retirement_proposal',
      'section_14_transfer_proposal',
    ]);

    for (const contract of DEFAULT_ROA_MODULE_CONTRACTS) {
      const validated = validateRoAModuleContract(contract);
      expect(validated.status).toBe('active');
      expect(validated.formSchema.sections.length).toBeGreaterThan(0);
      expect(validated.documentSections.length).toBeGreaterThan(0);
      expect(validated.validation.requiredFields.length).toBeGreaterThan(0);
    }
  });

  it('adapts contracts to the current wizard module shape', () => {
    const legacyModule = contractToLegacyModule(DEFAULT_ROA_MODULE_CONTRACTS[0]);

    expect(legacyModule.id).toBe('new_life_assurance_proposal');
    expect(legacyModule.fields.some((field) => field.key === 'cover_amount' && field.type === 'number')).toBe(true);
    expect(legacyModule.compileOrder).toContain('recommendation');
    expect(legacyModule.disclosures.length).toBeGreaterThan(0);
    expect(legacyModule.documentSections?.[0].template).toContain('{{');
    expect(legacyModule.evidence?.requirements.length).toBeGreaterThan(0);
  });

  it('exposes a controlled schema format for future super-admin editing', () => {
    expect(ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedFieldTypes).toContain('currency');
    expect(ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedSourceTypes).toContain('clientSnapshot');
    expect(ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedEvidenceTypes).toContain('comparison');
    expect(ROA_MODULE_CONTRACT_SCHEMA_FORMAT.requiredContractKeys).toContain('documentSections');
  });

  it('rejects malformed editable contracts', () => {
    expect(() => validateRoAModuleContract({
      id: 'Bad Id',
      title: '',
      formSchema: { sections: [] },
      output: {},
      documentSections: [],
    })).toThrow(/id must use lowercase/);
  });

  it('requires editable output templates before publishing active contracts', () => {
    const contract = {
      ...DEFAULT_ROA_MODULE_CONTRACTS[0],
      documentSections: DEFAULT_ROA_MODULE_CONTRACTS[0].documentSections.map((section) => ({
        ...section,
        template: '',
      })),
    };

    expect(() => validateRoAModuleContract(contract)).toThrow(/template is required/);
  });

  it('rejects unknown output template tokens before publishing active contracts', () => {
    const contract = {
      ...DEFAULT_ROA_MODULE_CONTRACTS[0],
      documentSections: DEFAULT_ROA_MODULE_CONTRACTS[0].documentSections.map((section, index) => ({
        ...section,
        template: index === 0 ? '{{module.not_a_real_field}}' : section.template,
      })),
    };

    expect(() => validateRoAModuleContract(contract)).toThrow(/unknown module token/);
  });

  it('rejects compile order entries that do not map to document sections', () => {
    const contract = {
      ...DEFAULT_ROA_MODULE_CONTRACTS[0],
      compileOrder: ['recommendation', 'missing_section'],
    };

    expect(() => validateRoAModuleContract(contract)).toThrow(/compileOrder references unknown document section/);
  });

  it('rejects unsupported compilerHints keys', () => {
    const contract = {
      ...DEFAULT_ROA_MODULE_CONTRACTS[0],
      compilerHints: { includeReplacementAnalysis: true, extraFlag: true },
    };

    expect(() => validateRoAModuleContract(contract)).toThrow(/compilerHints\.extraFlag/);
  });

  it('does not emit canonical replacement analysis without compilerHints.includeReplacementAnalysis', () => {
    const baseline = DEFAULT_ROA_MODULE_CONTRACTS.find((item) => item.id === 'life_insurance_comparison')!;
    const contract = { ...baseline, compilerHints: undefined };

    const draft: RoADraftRecord = {
      id: 'draft-no-replacement-shell',
      clientId: 'client-1',
      selectedModules: [contract.id],
      moduleData: {
        [contract.id]: {
          current_providers: ['Provider A'],
          current_monthly_premium: 1000,
          proposed_provider: 'Provider B',
          proposed_monthly_premium: 900,
          benefit_comparison: 'Better benefits',
          replacement_rationale: 'Improved suitability',
          rationale: 'Notes',
        },
      },
      moduleOutputs: {},
      moduleEvidence: {
        [contract.id]: {
          current_policy_schedule: {
            id: 'ev-1',
            requirementId: 'current_policy_schedule',
            label: 'Current policy schedule',
            type: 'policy_schedule',
            fileName: 'current.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            sha256: 'abc123',
            source: 'adviser-upload',
            uploadedAt: '2026-05-04T00:00:00.000Z',
          },
          comparison_schedule: {
            id: 'ev-2',
            requirementId: 'comparison_schedule',
            label: 'Comparison schedule',
            type: 'comparison',
            fileName: 'comparison.pdf',
            mimeType: 'application/pdf',
            size: 2048,
            sha256: 'def456',
            source: 'adviser-upload',
            uploadedAt: '2026-05-04T00:00:00.000Z',
          },
        },
      },
      status: 'draft',
      createdAt: '2026-05-04T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z',
      version: 1,
      createdBy: 'user-1',
      updatedBy: 'user-1',
      adviserId: 'user-1',
      clientSnapshot: {
        clientId: 'client-1',
        displayName: 'Jane Client',
        personalInformation: {},
        contactInformation: {},
        employmentInformation: {},
        financialInformation: {},
        familyMembers: [],
        assets: [],
        liabilities: [],
        riskProfile: null,
        clientKeys: null,
        policies: [],
        profile: null,
        capturedAt: '2026-05-04T00:00:00.000Z',
      },
      adviserSnapshot: {
        adviserId: 'user-1',
        displayName: 'Alex Adviser',
        email: 'alex@example.com',
        role: 'adviser',
        capturedAt: '2026-05-04T00:00:00.000Z',
      },
    };

    const compilation = buildCanonicalRoACompilation({
      draft,
      contracts: [contract],
      now: '2026-05-04T12:00:00.000Z',
      compilationId: 'compilation-no-flag',
    });

    expect(compilation.replacementAnalysis).toHaveLength(0);
    const dc = compilation.documentControl as Record<string, unknown>;
    expect(dc.moduleContractSchemaVersions).toEqual({
      life_insurance_comparison: '1.0',
    });
  });

  it('validates required fields and evidence without module-specific code', () => {
    const service = new AdviceEngineRoAService();
    const contract = DEFAULT_ROA_MODULE_CONTRACTS.find((item) => item.id === 'life_insurance_comparison')!;
    const baseDraft: RoADraftRecord = {
      id: 'draft-1',
      clientId: 'client-1',
      selectedModules: [contract.id],
      moduleData: {
        [contract.id]: {
          current_providers: ['Provider A'],
          current_monthly_premium: 1000,
          proposed_provider: 'Provider B',
          proposed_monthly_premium: 900,
          benefit_comparison: 'Better benefits',
          replacement_rationale: 'Improved suitability',
        },
      },
      moduleEvidence: {
        [contract.id]: {
          current_policy_schedule: {
            id: 'ev-1',
            requirementId: 'current_policy_schedule',
            label: 'Current policy schedule',
            type: 'policy_schedule',
            fileName: 'current.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            sha256: 'abc123',
            source: 'adviser-upload',
            uploadedAt: '2026-05-04T00:00:00.000Z',
          },
          comparison_schedule: {
            id: 'ev-2',
            requirementId: 'comparison_schedule',
            label: 'Comparison schedule',
            type: 'comparison',
            fileName: 'comparison.pdf',
            mimeType: 'application/pdf',
            size: 2048,
            sha256: 'def456',
            source: 'adviser-upload',
            uploadedAt: '2026-05-04T00:00:00.000Z',
          },
        },
      },
      status: 'draft',
      createdAt: '2026-05-04T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z',
      version: 1,
      createdBy: 'user-1',
      updatedBy: 'user-1',
      adviserId: 'user-1',
    };

    expect(service.validateDraftWithContracts(baseDraft, [contract]).valid).toBe(true);

    const missingEvidence = {
      ...baseDraft,
      moduleEvidence: { [contract.id]: {} },
    };

    const result = service.validateDraftWithContracts(missingEvidence, [contract]);
    expect(result.valid).toBe(false);
    expect(result.blocking.some((issue) => issue.requirementId === 'current_policy_schedule')).toBe(true);
  });

  it('validates attached evidence metadata against contract requirements', () => {
    const service = new AdviceEngineRoAService();
    const contract = DEFAULT_ROA_MODULE_CONTRACTS.find((item) => item.id === 'life_insurance_comparison')!;
    const draft: RoADraftRecord = {
      id: 'draft-bad-evidence',
      clientId: 'client-1',
      selectedModules: [contract.id],
      moduleData: {
        [contract.id]: {
          current_providers: ['Provider A'],
          current_monthly_premium: 1000,
          proposed_provider: 'Provider B',
          proposed_monthly_premium: 900,
          benefit_comparison: 'Better benefits',
          replacement_rationale: 'Improved suitability',
        },
      },
      moduleEvidence: {
        [contract.id]: {
          current_policy_schedule: {
            id: 'ev-1',
            requirementId: 'current_policy_schedule',
            label: 'Current policy schedule',
            type: 'policy_schedule',
            fileName: 'current.txt',
            mimeType: 'text/plain',
            size: 100,
            uploadedAt: '2026-05-04T00:00:00.000Z',
          },
          comparison_schedule: {
            id: 'ev-2',
            requirementId: 'comparison_schedule',
            label: 'Comparison schedule',
            type: 'comparison',
            fileName: 'comparison.pdf',
            mimeType: 'application/pdf',
            size: 100,
            uploadedAt: '2026-05-04T00:00:00.000Z',
          },
        },
      },
      status: 'draft',
      createdAt: '2026-05-04T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z',
      version: 1,
      createdBy: 'user-1',
      updatedBy: 'user-1',
      adviserId: 'user-1',
    };

    const result = service.validateDraftWithContracts(draft, [contract]);

    expect(result.valid).toBe(false);
    expect(result.blocking.some((issue) => issue.id.includes(':mime_type'))).toBe(true);
    expect(result.warnings.some((issue) => issue.id.includes(':source_missing'))).toBe(true);
    expect(result.warnings.some((issue) => issue.id.includes(':hash_missing'))).toBe(true);
  });

  it('builds a regulatory RoA wrapper around contract-driven module sections', async () => {
    const contract = DEFAULT_ROA_MODULE_CONTRACTS.find((item) => item.id === 'life_insurance_comparison')!;
    const draft: RoADraftRecord = {
      id: 'draft-compile-1',
      clientId: 'client-1',
      selectedModules: [contract.id],
      moduleData: {
        [contract.id]: {
          current_providers: ['Provider A'],
          current_monthly_premium: 1000,
          proposed_provider: 'Provider B',
          proposed_monthly_premium: 900,
          benefit_comparison: 'Better benefits',
          replacement_rationale: 'Improved suitability',
          rationale: 'The proposed policy better matches the client need.',
        },
      },
      moduleOutputs: {
        [contract.id]: {
          normalizedKey: 'lifeInsuranceComparison',
          values: {
            current_providers: ['Provider A'],
            proposed_provider: 'Provider B',
            replacement_rationale: 'Improved suitability',
          },
        },
      },
      moduleEvidence: {
        [contract.id]: {
          current_policy_schedule: {
            id: 'ev-1',
            requirementId: 'current_policy_schedule',
            label: 'Current policy schedule',
            type: 'policy_schedule',
            fileName: 'current.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            sha256: 'abc123',
            source: 'adviser-upload',
            uploadedAt: '2026-05-04T00:00:00.000Z',
          },
          comparison_schedule: {
            id: 'ev-2',
            requirementId: 'comparison_schedule',
            label: 'Comparison schedule',
            type: 'comparison',
            fileName: 'comparison.pdf',
            mimeType: 'application/pdf',
            size: 2048,
            sha256: 'def456',
            source: 'adviser-upload',
            uploadedAt: '2026-05-04T00:00:00.000Z',
          },
        },
      },
      status: 'draft',
      createdAt: '2026-05-04T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z',
      version: 1,
      createdBy: 'user-1',
      updatedBy: 'user-1',
      adviserId: 'user-1',
      clientSnapshot: {
        clientId: 'client-1',
        displayName: 'Jane Client',
        personalInformation: { idNumber: '9001010000000', dateOfBirth: '1990-01-01' },
        contactInformation: { email: 'jane@example.com', cellphone: '0820000000' },
        employmentInformation: { employmentStatus: 'Employed', netMonthlyIncome: 50000 },
        financialInformation: { goals: ['Improve life cover suitability'] },
        familyMembers: [],
        assets: [],
        liabilities: [],
        riskProfile: { riskCategory: 'Moderate' },
        clientKeys: {},
        policies: [{ provider: 'Provider A' }],
        profile: {},
        capturedAt: '2026-05-04T00:00:00.000Z',
      },
      adviserSnapshot: {
        adviserId: 'user-1',
        displayName: 'Alex Adviser',
        email: 'alex@example.com',
        role: 'adviser',
        fspReference: 'FSP 54606',
        capturedAt: '2026-05-04T00:00:00.000Z',
      },
    };

    const compilation = buildCanonicalRoACompilation({
      draft,
      contracts: [contract],
      now: '2026-05-04T12:00:00.000Z',
      compilationId: 'compilation-1',
    });

    expect(compilation.documentSections.map((section) => section.id)).toContain('scope_and_purpose');
    expect(compilation.recommendationSummary[0].summary).toContain('Life Insurance Comparison');
    expect(compilation.replacementAnalysis).toHaveLength(1);
    const dc = compilation.documentControl as Record<string, unknown>;
    expect(dc.moduleContractSchemaVersions).toEqual({
      life_insurance_comparison: '1.0',
    });
    expect(compilation.modules[0].compilerHints?.includeReplacementAnalysis).toBe(true);
    const currentPolicyEvidence = compilation.modules[0].evidence.find((item) => item.id === 'ev-1');
    expect(currentPolicyEvidence?.sha256).toBe('abc123');
    expect(currentPolicyEvidence?.source).toBe('adviser-upload');
    expect(compilation.html).toContain('pdf-preview-container');
    expect(compilation.html).toContain('Recommendation Summary Table');

    const pdfBytes = await createCanonicalRoAPdf(compilation);
    const docxBytes = await createCanonicalRoADocx(compilation);

    expect(new TextDecoder().decode(pdfBytes.slice(0, 4))).toBe('%PDF');
    expect(new TextDecoder().decode(docxBytes.slice(0, 2))).toBe('PK');
  });
});
