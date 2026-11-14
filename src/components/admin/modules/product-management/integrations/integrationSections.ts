/** The five sections of an integration page, as they appear in the address (?section=). */
export const INTEGRATION_SECTIONS = ['review', 'portfolio', 'setup', 'mapping', 'portal'] as const;
export type IntegrationSection = (typeof INTEGRATION_SECTIONS)[number];

export const INTEGRATION_SECTION_LABELS: Record<IntegrationSection, string> = {
  review: 'Review',
  portfolio: 'Portfolio',
  setup: 'Provider setup',
  mapping: 'Mapping configuration',
  portal: 'Portal automation',
};
