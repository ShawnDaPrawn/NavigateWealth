/** The tabs of a client page, in the address as ?ctab= (overview is the default). */
export const CLIENT_TABS = [
  'overview',
  'personal',
  'policies',
  'security',
  'documents',
  'vasco',
  'esign',
  'compliance',
  'communication',
  'notes',
] as const;
export type ClientTab = (typeof CLIENT_TABS)[number];

/**
 * Address parameters that belong to an open client page (its tab and the
 * section, category or view open inside a tab). Closing the client drops them.
 */
export const CLIENT_PAGE_PARAMS = [
  'ctab',
  'psec',
  'pcat',
  'policy',
  'ksec',
  'dview',
  'cview',
  'note',
] as const;
