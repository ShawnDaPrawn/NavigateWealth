/** The five sections of an integration page, as they appear in the address (?section=). */
export const INTEGRATION_SECTIONS = ['review', 'portfolio', 'setup', 'mapping', 'portal'] as const;
export type IntegrationSection = (typeof INTEGRATION_SECTIONS)[number];
