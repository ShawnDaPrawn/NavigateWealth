/**
 * advice-engine-roa-contract-seed-builders.ts — the private builders behind
 * the seeded RoA module contracts: the schema format, the shared client
 * snapshot sources, default document templates, conversation derivation, and
 * the systemContract() wrapper that stamps status/version/audit fields.
 * The seed data itself lives in the advice-engine-roa-contract-seed-* files;
 * advice-engine-roa-default-contracts.ts assembles them.
 */
import type {
  RoAContractInputSource,
  RoAModuleContract,
  RoAModuleContractSchemaFormat,
  RoAModuleConversation,
} from './advice-engine-roa-contract-types.ts';

const SYSTEM_TIMESTAMP = '2026-05-04T00:00:00.000Z';
export const SYSTEM_USER = 'system:roa-contract-seed';

export const ROA_MODULE_CONTRACT_SCHEMA_FORMAT: RoAModuleContractSchemaFormat = {
  schemaVersion: '1.0',
  allowedFieldTypes: [
    'text',
    'textarea',
    'number',
    'select',
    'chips',
    'checkbox',
    'radio',
    'date',
    'currency',
    'percentage',
    'file',
  ],
  allowedSourceTypes: [
    'clientSnapshot',
    'adviserSnapshot',
    'policyRegister',
    'fna',
    'moduleInput',
    'documentUpload',
    'calculated',
    'manual',
  ],
  allowedGatheringMethods: [
    'typed',
    'upload',
    'clientProfile',
    'policyRegister',
    'fna',
    'calculated',
  ],
  allowedEvidenceTypes: [
    'quote',
    'policy_schedule',
    'comparison',
    'application',
    'fna',
    'client_instruction',
    'other',
  ],
  allowedValidationSeverities: ['blocking', 'warning'],
  allowedAuthoringModes: ['form', 'conversation'],
  allowedCompletionModes: ['ai-signal', 'manual'],
  requiredContractKeys: [
    'id',
    'title',
    'description',
    'category',
    'input',
    'output',
    'documentSections',
  ],
  requiredFieldKeys: ['key', 'label', 'type', 'source'],
};

export const clientSnapshotSources: RoAContractInputSource[] = [
  {
    id: 'client_profile',
    label: 'Client profile and personal details',
    type: 'clientSnapshot',
    required: true,
    sourcePath: 'draft.clientSnapshot',
  },
  {
    id: 'adviser_profile',
    label: 'Adviser profile',
    type: 'adviserSnapshot',
    required: true,
    sourcePath: 'draft.adviserSnapshot',
  },
];

function defaultDocumentTemplate(
  moduleTitle: string,
  sectionTitle: string,
  purpose: string,
): string {
  return [
    `{{client.displayName}} - ${moduleTitle}`,
    '',
    `## ${sectionTitle}`,
    purpose || 'Record the adviser-reviewed content for this section.',
    '',
    'Adviser notes: {{module.rationale}}',
  ].join('\n');
}

/**
 * Derive a conversational authoring block from the legacy contract data so the
 * seeded modules run through the AI-driven flow without bespoke re-authoring.
 * The document sections become the canonical narrative sections, evidence
 * requirements become uploads, and the disclosures + section purposes seed the
 * per-module system instructions.
 */
export function deriveConversationFromContract(
  input: Pick<
    RoAModuleContract,
    'title' | 'description' | 'category' | 'documentSections' | 'evidence' | 'disclosures'
  >,
): RoAModuleConversation {
  const sectionGuidance = input.documentSections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section) => `- ${section.title}: ${section.purpose}`)
    .join('\n');
  const disclosureGuidance = input.disclosures.map((line) => `- ${line}`).join('\n');

  const instructions = [
    `You are a South African financial adviser's assistant helping to compile the "${input.title}" section of a Record of Advice (${input.category}).`,
    input.description,
    '',
    'Work conversationally with the adviser to gather everything needed for this module. Ask focused questions one or two at a time, request any documents or images listed below when relevant, and reference the client and policy information already provided in your context. Never invent facts — if something is missing, ask for it.',
    '',
    'You must ultimately produce a complete, client-ready narrative for each of these sections:',
    sectionGuidance,
    '',
    'Mandatory disclosures to weave into the narrative where appropriate:',
    disclosureGuidance,
    '',
    'Follow the FAIS Act and South African regulatory expectations. Use ZAR for currency. Write in a clear, professional, brand-aligned tone.',
    'When you have gathered enough information and the adviser confirms, signal completion and return the final narrative for every required section.',
  ].join('\n');

  const narrativeSections = input.documentSections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({
      id: section.id,
      title: section.title,
      description: section.purpose,
      required: section.required !== false,
      order: typeof section.order === 'number' ? section.order : (index + 1) * 10,
    }));

  const uploads = input.evidence.requirements.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    required: requirement.required === true,
    acceptedMimeTypes: requirement.acceptedMimeTypes,
    guidance: requirement.guidance,
    visionEligible: (requirement.acceptedMimeTypes || []).some(
      (mime) => mime.includes('image') || mime.includes('pdf'),
    ),
  }));

  return {
    instructions,
    openingMessage: `Let's work through the "${input.title}" module together. I have the client's personal and policy information on hand. To start, tell me what you'd like to recommend or what prompted this advice — and upload any relevant quotes, schedules or documents when you're ready.`,
    narrativeSections,
    uploads,
    completion: { mode: 'ai-signal', minTurns: 2, requireAllUploads: false },
  };
}

export function systemContract(
  input: Omit<
    RoAModuleContract,
    'status' | 'version' | 'schemaVersion' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
  >,
): RoAModuleContract {
  return {
    ...input,
    documentSections: input.documentSections.map((section) => ({
      ...section,
      template:
        section.template || defaultDocumentTemplate(input.title, section.title, section.purpose),
    })),
    authoringMode: input.authoringMode ?? 'conversation',
    conversation: input.conversation ?? deriveConversationFromContract(input),
    status: 'active',
    version: 1,
    schemaVersion: '1.0',
    createdAt: SYSTEM_TIMESTAMP,
    updatedAt: SYSTEM_TIMESTAMP,
    createdBy: SYSTEM_USER,
    updatedBy: SYSTEM_USER,
  };
}
