export const ENDPOINTS = {
  // AI Intelligence
  AI_STATUS: '/ai-intelligence/status',
  AI_CHAT: '/ai-intelligence/chat',
  AI_HISTORY: '/ai-intelligence/history',
  AI_SEARCH_CLIENTS: '/ai-intelligence/search-clients',

  // RoA
  ROA_DRAFT: '/advice-engine/roa/drafts',
  ROA_MODULES: '/advice-engine/roa/modules',
  ROA_MODULE_CONTRACTS: '/advice-engine/roa/module-contracts',
  ROA_MODULE_CONTRACT_SCHEMA: '/advice-engine/roa/module-contracts/schema',
  ROA_CLIENT_CONTEXT: '/advice-engine/roa/client',

  // Shared Resources
  CLIENT_DETAILS: '/clients',
  PERSONNEL_LIST: '/personnel/list',
} as const;

/**
 * Path builders for the RoA module-conversation (AI authoring) endpoints.
 * These mirror the backend contract and live under the same RoA draft prefix.
 */
export const ROA_CONVERSATION_ENDPOINTS = {
  start: (draftId: string) => `${ENDPOINTS.ROA_DRAFT}/${draftId}/conversation/start`,
  progress: (draftId: string) => `${ENDPOINTS.ROA_DRAFT}/${draftId}/conversation/progress`,
  moduleConversation: (draftId: string, moduleId: string) =>
    `${ENDPOINTS.ROA_DRAFT}/${draftId}/modules/${moduleId}/conversation`,
  moduleChat: (draftId: string, moduleId: string) =>
    `${ENDPOINTS.ROA_DRAFT}/${draftId}/modules/${moduleId}/chat`,
  moduleComplete: (draftId: string, moduleId: string) =>
    `${ENDPOINTS.ROA_DRAFT}/${draftId}/modules/${moduleId}/complete`,
  moduleUpload: (draftId: string, moduleId: string) =>
    `${ENDPOINTS.ROA_DRAFT}/${draftId}/modules/${moduleId}/upload`,
  moduleNarrative: (draftId: string, moduleId: string) =>
    `${ENDPOINTS.ROA_DRAFT}/${draftId}/modules/${moduleId}/narrative`,
} as const;
