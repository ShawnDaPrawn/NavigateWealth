import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROA_MODULE_CONTRACTS,
  validateRoAModuleContract,
} from '../advice-engine-roa-contract-types.ts';
import {
  AdviceEngineRoAService,
  buildCanonicalRoACompilation,
  type RoADraftRecord,
} from '../advice-engine-roa-service.ts';

const conversationContract = DEFAULT_ROA_MODULE_CONTRACTS.find(
  (c) => c.id === 'new_life_assurance_proposal',
)!;

function buildConversationDraft(overrides: Partial<RoADraftRecord> = {}): RoADraftRecord {
  return {
    id: 'draft-conv-1',
    clientId: 'client-1',
    selectedModules: [conversationContract.id],
    moduleData: {},
    authoringMode: 'conversation',
    moduleConversationStatus: { [conversationContract.id]: 'complete' },
    moduleNarratives: {
      [conversationContract.id]: {
        moduleId: conversationContract.id,
        sections: [
          {
            id: 'need',
            title: 'Identified Need',
            markdown: 'The client has a R2m cover shortfall.',
          },
          {
            id: 'recommendation',
            title: 'Recommendation',
            markdown: 'We recommend R2m life cover with Discovery Life at R450/month.',
          },
          { id: 'risks', title: 'Risks and Underwriting', markdown: 'Subject to underwriting.' },
        ],
        generatedAt: '2026-06-19T00:00:00.000Z',
      },
    },
    moduleEvidence: {
      [conversationContract.id]: {
        provider_quote: {
          id: 'ev-quote',
          requirementId: 'provider_quote',
          label: 'Provider quote',
          type: 'quote',
          fileName: 'quote.pdf',
          mimeType: 'application/pdf',
          size: 2048,
          sha256: 'hash',
          source: 'adviser-upload',
          uploadedAt: '2026-06-19T00:00:00.000Z',
        },
      },
    },
    status: 'draft',
    createdAt: '2026-06-19T00:00:00.000Z',
    updatedAt: '2026-06-19T00:00:00.000Z',
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
      capturedAt: '2026-06-19T00:00:00.000Z',
    },
    adviserSnapshot: {
      adviserId: 'user-1',
      displayName: 'Alex Adviser',
      email: 'alex@example.com',
      role: 'adviser',
      capturedAt: '2026-06-19T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('RoA conversational module contracts', () => {
  it('ships default contracts in conversation mode with derived narrative sections + uploads', () => {
    for (const contract of DEFAULT_ROA_MODULE_CONTRACTS) {
      expect(contract.authoringMode).toBe('conversation');
      expect(contract.conversation).toBeTruthy();
      expect(contract.conversation!.instructions.length).toBeGreaterThan(0);
      expect(contract.conversation!.narrativeSections.length).toBeGreaterThan(0);
      // Narrative section ids mirror the document section ids.
      const docIds = new Set(contract.documentSections.map((s) => s.id));
      for (const section of contract.conversation!.narrativeSections) {
        expect(docIds.has(section.id)).toBe(true);
      }
    }
  });

  it('validates a conversation contract and mirrors uploads into evidence requirements', () => {
    const validated = validateRoAModuleContract({
      id: 'conversational_module',
      title: 'Conversational Module',
      description: 'A purely conversational module.',
      category: 'Advice',
      authoringMode: 'conversation',
      conversation: {
        instructions: 'Gather the advice details conversationally.',
        narrativeSections: [
          {
            id: 'summary',
            title: 'Summary',
            description: 'Summarise the advice.',
            required: true,
            order: 10,
          },
        ],
        uploads: [
          {
            id: 'supporting_quote',
            label: 'Supporting quote',
            required: true,
            acceptedMimeTypes: ['application/pdf'],
          },
        ],
        completion: { mode: 'ai-signal', minTurns: 2 },
      },
      output: { normalizedKey: 'conversationalModule', fields: [] },
      documentSections: [],
    });

    expect(validated.authoringMode).toBe('conversation');
    // documentSections are derived from narrative sections when omitted.
    expect(validated.documentSections.map((s) => s.id)).toContain('summary');
    // uploads are mirrored into evidence requirements so the upload pipeline works.
    expect(validated.evidence.requirements.some((r) => r.id === 'supporting_quote')).toBe(true);
  });

  it('rejects a conversation contract with no narrative sections', () => {
    expect(() =>
      validateRoAModuleContract({
        id: 'broken_conversation',
        title: 'Broken',
        description: 'No sections.',
        category: 'Advice',
        authoringMode: 'conversation',
        conversation: {
          instructions: 'Hi',
          narrativeSections: [],
          uploads: [],
          completion: { mode: 'ai-signal' },
        },
        output: { normalizedKey: 'broken', fields: [] },
        documentSections: [],
      }),
    ).toThrow(/narrativeSections must include at least one section/);
  });

  it('passes validation when the conversation is complete with a full narrative', () => {
    const service = new AdviceEngineRoAService();
    const result = service.validateDraftWithContracts(buildConversationDraft(), [
      conversationContract,
    ]);
    expect(result.valid).toBe(true);
  });

  it('blocks compilation while the module conversation is incomplete', () => {
    const service = new AdviceEngineRoAService();
    const draft = buildConversationDraft({
      moduleConversationStatus: { [conversationContract.id]: 'in_progress' },
      moduleNarratives: {},
    });
    const result = service.validateDraftWithContracts(draft, [conversationContract]);
    expect(result.valid).toBe(false);
    expect(result.blocking.some((issue) => issue.id.includes('conversation_incomplete'))).toBe(
      true,
    );
  });

  it('compiles the AI-authored narrative into module sections', () => {
    const compilation = buildCanonicalRoACompilation({
      draft: buildConversationDraft(),
      contracts: [conversationContract],
      now: '2026-06-19T12:00:00.000Z',
      compilationId: 'compilation-conv',
    });

    const module = compilation.modules[0];
    expect(module.sections.map((s) => s.id)).toEqual(['need', 'recommendation', 'risks']);
    expect(module.sections[1].content).toContain('Discovery Life');
    expect(module.outputValues).toHaveLength(0);
    expect(compilation.recommendationSummary[0].summary).toContain('shortfall');
  });
});
