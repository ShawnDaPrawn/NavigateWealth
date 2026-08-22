/**
 * Pure helpers for the RoA module contract editor.
 *
 * Extracted verbatim from RoAModuleContractManager.tsx, which was 2,125 lines.
 * Nothing here renders — no JSX, no React, no hooks — so it can be read, reused
 * and tested without mounting the editor. `getStatusBadge` stayed behind in the
 * component tree because it returns markup.
 */
import type { RoAModuleContract, RoAModuleConversationConfig } from '../types';

export type ContractSection = RoAModuleContract['formSchema']['sections'][number];
export type ContractField = ContractSection['fields'][number];
export type EvidenceRequirement = RoAModuleContract['evidence']['requirements'][number];
export type DocumentSection = RoAModuleContract['documentSections'][number];

export const DEFAULT_CONVERSATION_CONFIG: RoAModuleConversationConfig = {
  instructions:
    'You are helping an adviser gather the information needed to write this section of the Record of Advice. Ask focused questions one at a time and confirm details before moving on.',
  openingMessage:
    "Let's complete this module. Tell me about the advice you are giving the client here.",
  narrativeSections: [
    {
      id: 'recommendation',
      title: 'Recommendation',
      description: 'Summarise the recommendation and why it suits the client.',
      required: true,
      order: 10,
    },
  ],
  uploads: [],
  completion: {
    mode: 'ai-signal',
    minTurns: 2,
    requireAllUploads: false,
  },
};

export function getConversationConfig(contract: RoAModuleContract): RoAModuleConversationConfig {
  return contract.conversation ?? DEFAULT_CONVERSATION_CONFIG;
}

/**
 * Conversation is the default authoring mode; only 'form' uses the legacy
 * form-schema/evidence builders.
 */
export function isConversationContract(contract: RoAModuleContract): boolean {
  return (contract.authoringMode ?? 'conversation') !== 'form';
}

export const EMPTY_CONTRACT: RoAModuleContract = {
  id: 'new_roa_module',
  title: 'New RoA Module',
  description: '',
  category: 'Risk Management',
  status: 'draft',
  version: 1,
  schemaVersion: '1.0',
  input: {
    sources: [
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
    ],
    gatheringMethods: ['clientProfile', 'typed'],
  },
  formSchema: {
    sections: [
      {
        id: 'details',
        title: 'Details',
        fields: [
          {
            key: 'rationale',
            label: 'Rationale',
            type: 'textarea',
            required: true,
            source: 'moduleInput',
          },
        ],
      },
    ],
  },
  output: {
    normalizedKey: 'newRoAModule',
    fields: [
      {
        key: 'rationale',
        label: 'Rationale',
        type: 'string',
        required: true,
      },
    ],
  },
  validation: {
    requiredFields: ['rationale'],
    rules: [
      {
        id: 'rationale_required',
        severity: 'blocking',
        message: 'A rationale is required before this module can be compiled.',
      },
    ],
  },
  evidence: {
    requirements: [],
  },
  documentSections: [
    {
      id: 'recommendation',
      title: 'Recommendation',
      purpose: 'Explain the recommendation and why it is suitable for the client.',
      order: 10,
      required: true,
      template: [
        '## Recommendation',
        'Client: {{client.displayName}}',
        '',
        '{{module.rationale}}',
        '',
        'Adviser: {{adviser.displayName}}',
      ].join('\n'),
    },
  ],
  disclosures: [],
  compileOrder: ['recommendation'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'system',
  updatedBy: 'system',
};

export function cloneContract(contract: RoAModuleContract): RoAModuleContract {
  return JSON.parse(JSON.stringify(contract)) as RoAModuleContract;
}

export function toId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export function linesToArray(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function arrayToLines(value: string[]): string {
  return value.join('\n');
}

export const TOKEN_EXAMPLES = [
  '{{client.displayName}}',
  '{{adviser.displayName}}',
  '{{module.rationale}}',
  '{{module.monthly_premium | currency}}',
  '{{evidence.provider_quote.fileName}}',
];

export const TOKEN_FILTERS = ['currency', 'percentage', 'date'];
export const TEMPLATE_ROOTS = ['client', 'adviser', 'module', 'evidence', 'draft'];
export const EVIDENCE_TOKEN_PROPERTIES = [
  'fileName',
  'label',
  'type',
  'source',
  'sha256',
  'uploadedAt',
];

export interface TemplateTokenOption {
  group: string;
  label: string;
  token: string;
  description: string;
}

export function getRequiredFieldCount(contract: RoAModuleContract): number {
  return contract.formSchema.sections.reduce(
    (count, section) => count + section.fields.filter((field) => field.required).length,
    0,
  );
}

export function getEvidenceCount(contract: RoAModuleContract): number {
  return contract.evidence.requirements.filter((item) => item.required).length;
}

export function isFlagshipContract(contract: RoAModuleContract): boolean {
  const flag = contract.metadata?.flagshipModule;
  return flag === true || flag === 'true';
}

export function getContractFieldTokens(contract: RoAModuleContract): TemplateTokenOption[] {
  const fieldTokens = contract.formSchema.sections.flatMap((section) =>
    section.fields.map((field) => ({
      group: 'Module fields',
      label: field.label,
      token: `{{module.${field.key}${field.type === 'currency' ? ' | currency' : field.type === 'percentage' ? ' | percentage' : field.type === 'date' ? ' | date' : ''}}}`,
      description: `${section.title} field`,
    })),
  );

  const outputTokens = contract.output.fields.map((field) => ({
    group: 'Normalized output',
    label: field.label,
    token: `{{module.${field.key}}}`,
    description: 'Published output field',
  }));

  return [...fieldTokens, ...outputTokens];
}

export function getTemplateTokenOptions(contract: RoAModuleContract): TemplateTokenOption[] {
  return [
    {
      group: 'Client',
      label: 'Client name',
      token: '{{client.displayName}}',
      description: 'Client display name from the RoA snapshot',
    },
    {
      group: 'Adviser',
      label: 'Adviser name',
      token: '{{adviser.displayName}}',
      description: 'Adviser display name from the RoA snapshot',
    },
    {
      group: 'Adviser',
      label: 'Adviser email',
      token: '{{adviser.email}}',
      description: 'Adviser email from the RoA snapshot',
    },
    ...getContractFieldTokens(contract),
    ...contract.evidence.requirements.map((requirement) => ({
      group: 'Evidence',
      label: `${requirement.label} file`,
      token: `{{evidence.${requirement.id}.fileName}}`,
      description: requirement.required ? 'Required evidence upload' : 'Optional evidence upload',
    })),
  ];
}

export function extractTemplateTokens(
  template: string,
): Array<{ expression: string; path: string; filter?: string }> {
  const tokens: Array<{ expression: string; path: string; filter?: string }> = [];
  const tokenPattern = /{{\s*([a-zA-Z0-9_.-]+)(?:\s*\|\s*([a-zA-Z]+))?\s*}}/g;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(template)) !== null) {
    tokens.push({ expression: match[0], path: match[1], filter: match[2] });
  }
  return tokens;
}

export function buildKnownModuleTokenPaths(contract: RoAModuleContract): Set<string> {
  return new Set([
    'module.rationale',
    ...contract.formSchema.sections.flatMap((section) =>
      section.fields.map((field) => `module.${field.key}`),
    ),
    ...contract.output.fields.map((field) => `module.${field.key}`),
  ]);
}

export function getTemplateIssues(contract: RoAModuleContract): string[] {
  const issues: string[] = [];
  const modulePaths = buildKnownModuleTokenPaths(contract);
  const evidenceIds = new Set(contract.evidence.requirements.map((requirement) => requirement.id));
  const sectionIds = new Set(contract.documentSections.map((section) => section.id));

  contract.documentSections.forEach((section, index) => {
    if (!section.id.trim()) issues.push(`Document section ${index + 1} needs an ID.`);
    if (section.required && !section.template.trim()) {
      issues.push(
        `${section.title || `Section ${index + 1}`} needs an output template before publish.`,
      );
    }

    extractTemplateTokens(section.template).forEach((token) => {
      const [root, evidenceId, property] = token.path.split('.');
      if (!TEMPLATE_ROOTS.includes(root)) {
        issues.push(`${section.title} uses unsupported token ${token.expression}.`);
      }
      if (token.filter && !TOKEN_FILTERS.includes(token.filter.toLowerCase())) {
        issues.push(`${section.title} uses unsupported filter ${token.filter}.`);
      }
      if (root === 'module' && !modulePaths.has(token.path)) {
        issues.push(`${section.title} uses unknown module token ${token.expression}.`);
      }
      if (
        root === 'evidence' &&
        (!evidenceIds.has(evidenceId) || !EVIDENCE_TOKEN_PROPERTIES.includes(property))
      ) {
        issues.push(`${section.title} uses unknown evidence token ${token.expression}.`);
      }
    });
  });

  contract.compileOrder.forEach((sectionId) => {
    if (sectionId !== 'disclosures' && !sectionIds.has(sectionId)) {
      issues.push(`Compile order references unknown section ${sectionId}.`);
    }
  });

  return Array.from(new Set(issues));
}

export function getSampleTemplateContext(contract: RoAModuleContract): Record<string, unknown> {
  const module = Object.fromEntries(
    contract.formSchema.sections.flatMap((section) =>
      section.fields.map((field) => {
        if (field.default !== undefined) return [field.key, field.default];
        if (field.type === 'currency') return [field.key, 1250];
        if (field.type === 'percentage') return [field.key, 2.5];
        if (field.type === 'date') return [field.key, '2026-05-05'];
        if (field.type === 'number') return [field.key, 10];
        if (field.type === 'chips') return [field.key, ['Sample item']];
        if (field.type === 'checkbox') return [field.key, true];
        return [field.key, `Sample ${field.label.toLowerCase()}`];
      }),
    ),
  );

  return {
    client: {
      displayName: 'Jane Client',
      contactInformation: { email: 'jane.client@example.com' },
    },
    adviser: {
      displayName: 'Navigate Adviser',
      email: 'adviser@navigatewealth.co',
    },
    module,
    evidence: Object.fromEntries(
      contract.evidence.requirements.map((requirement) => [
        requirement.id,
        {
          fileName: `${requirement.id}.pdf`,
          label: requirement.label,
          type: requirement.type,
          source: 'adviser-upload',
          uploadedAt: '2026-05-05T08:00:00.000Z',
        },
      ]),
    ),
    draft: { id: 'sample-draft', createdAt: '2026-05-05T08:00:00.000Z' },
  };
}
