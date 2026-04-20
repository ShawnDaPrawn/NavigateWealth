/**
 * Centralised Query Key Factory
 *
 * ALL React Query keys MUST be defined here. This ensures:
 *   - Deterministic, reconstructable keys (per Guidelines §11.2)
 *   - Safe, targeted cache invalidation
 *   - Single source of truth for key shapes
 *   - Cross-module invalidation without import cycles
 *
 * Convention (§5.4 aligned):
 *   keys.all            -> root prefix (invalidates everything in the domain)
 *   keys.lists()        -> all list variants
 *   keys.list(filters)  -> specific filtered list
 *   keys.details()      -> all detail variants
 *   keys.detail(id)     -> specific entity
 *
 * ─── IMPORTANT ───────────────────────────────────────────────────────────
 * Module-level `hooks/queryKeys.ts` files re-export from here. Do NOT
 * create new query key objects in module code — add them here instead.
 * ──────────────────────────────────────────────────────────────────────────
 */

// ============================================================================
// ADMIN — DASHBOARD & SHARED
// ============================================================================

export const adminStatsKeys = {
  all: ['admin-stats'] as const,
} as const;

export const pendingCountsKeys = {
  all: ['pendingCounts'] as const,
} as const;

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => ['dashboard-stats'] as const,
  metrics: () => ['dashboard-metrics'] as const,
  tasksToday: () => ['dashboard-tasks-today'] as const,
  recentRequests: () => ['dashboard-recent-requests'] as const,
  systemActivity: () => ['dashboard-system-activity'] as const,
} as const;

// ============================================================================
// AI MANAGEMENT
// ============================================================================

export const aiManagementKeys = {
  all: ['ai-management'] as const,
  agents: () => [...aiManagementKeys.all, 'agents'] as const,
  agent: (id: string) => [...aiManagementKeys.all, 'agent', id] as const,
  vascoConfig: () => [...aiManagementKeys.all, 'vasco-config'] as const,
  analytics: () => [...aiManagementKeys.all, 'analytics'] as const,
  feedback: () => [...aiManagementKeys.all, 'feedback'] as const,
  handoffs: (status?: string) => [...aiManagementKeys.all, 'handoffs', status ?? 'all'] as const,
  ragIndex: () => [...aiManagementKeys.all, 'rag-index'] as const,
  // Knowledge Base (Phase 2)
  kbEntries: () => [...aiManagementKeys.all, 'kb-entries'] as const,
  kbEntry: (id: string) => [...aiManagementKeys.all, 'kb-entry', id] as const,
  kbStats: () => [...aiManagementKeys.all, 'kb-stats'] as const,
} as const;

// ============================================================================
// CLIENTS
// ============================================================================

export const clientDataKeys = {
  all: ['client-keys'] as const,
  byClient: (clientId: string) => [...clientDataKeys.all, clientId] as const,
} as const;

export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...clientKeys.lists(), filters ?? {}] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
  profile: (id: string) => [...clientKeys.all, 'profile', id] as const,
  keys: (id: string) => [...clientKeys.all, 'keys', id] as const,

  // Client Key management (product data keys)
  clientKeys: {
    all: (clientId: string) => ['client-keys', clientId] as const,
    history: (clientId: string, keyId: string) => ['client-key-history', clientId, keyId] as const,
  },

  // Communication logs (cross-module, per-client)
  communicationLogs: (clientId: string) => ['client-logs', clientId] as const,
} as const;

// ============================================================================
// TASKS
// ============================================================================

export const tasksKeys = {
  all: ['tasks'] as const,
  lists: () => [...tasksKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...tasksKeys.lists(), filters] as const,
  dueToday: () => ['tasksDueToday'] as const,
  detail: (id: string) => [...tasksKeys.all, 'detail', id] as const,
} as const;

// ============================================================================
// SUBMISSIONS MANAGER
// ============================================================================

export const submissionsKeys = {
  all: ['submissions'] as const,
  lists: () => [...submissionsKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...submissionsKeys.lists(), filters ?? {}] as const,
  details: () => [...submissionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...submissionsKeys.details(), id] as const,
  countNew: () => [...submissionsKeys.all, 'count', 'new'] as const,
} as const;

// ============================================================================
// COMMUNICATIONS
// ============================================================================

export const communicationKeys = {
  all: ['communications'] as const,
  byUser: (userId: string | undefined) => [...communicationKeys.all, userId] as const,
  preferences: (userId: string | undefined) => [...communicationKeys.all, 'preferences', userId] as const,
} as const;

// ============================================================================
// AI ADVISOR
// ============================================================================

export const advisorKeys = {
  all: ['advisor'] as const,
  status: () => [...advisorKeys.all, 'status'] as const,
  history: (userId: string | undefined) => [...advisorKeys.all, 'history', userId] as const,
} as const;

// ============================================================================
// VASCO (Public AI Financial Navigator)
// ============================================================================

export const vascoKeys = {
  all: ['vasco'] as const,
  status: () => [...vascoKeys.all, 'status'] as const,
  config: () => [...vascoKeys.all, 'config'] as const,
  analytics: () => [...vascoKeys.all, 'analytics'] as const,
  feedback: () => [...vascoKeys.all, 'feedback'] as const,
  handoffs: () => [...vascoKeys.all, 'handoffs'] as const,
  indexStatus: () => [...vascoKeys.all, 'index-status'] as const,
} as const;

// ============================================================================
// ADVICE ENGINE (AI Intelligence + RoA)
// ============================================================================

export const adviceEngineKeys = {
  ai: {
    all: ['ai-intelligence'] as const,
    status: () => [...adviceEngineKeys.ai.all, 'status'] as const,
    history: () => [...adviceEngineKeys.ai.all, 'history'] as const,
    searchClients: (term: string) => [...adviceEngineKeys.ai.all, 'search-clients', term] as const,
  },
  roa: {
    all: ['roa'] as const,
    drafts: () => [...adviceEngineKeys.roa.all, 'drafts'] as const,
    draft: (id: string) => [...adviceEngineKeys.roa.all, 'draft', id] as const,
    modules: () => [...adviceEngineKeys.roa.all, 'modules'] as const,
  },
  client: (clientId: string) => ['client', clientId] as const,
  personnel: () => ['personnel'] as const,
} as const;

// ============================================================================
// WILL CHAT (AI-Driven Will Drafting)
// ============================================================================

export const willChatKeys = {
  all: ['will-chat'] as const,
  status: () => [...willChatKeys.all, 'status'] as const,
  sessions: (clientId: string) => [...willChatKeys.all, 'sessions', clientId] as const,
  session: (sessionId: string) => [...willChatKeys.all, 'session', sessionId] as const,
} as const;

// ============================================================================
// INTEGRATIONS (Product Management)
// ============================================================================

export const integrationsKeys = {
  all: ['integrations'] as const,
  providers: () => [...integrationsKeys.all, 'providers'] as const,
  history: (providerId: string | null, categoryId: string | null) =>
    [...integrationsKeys.all, 'history', providerId, categoryId] as const,
  config: (providerId: string | null, categoryId: string | null) =>
    [...integrationsKeys.all, 'config', providerId, categoryId] as const,
  portalFlow: (providerId: string | null) =>
    [...integrationsKeys.all, 'portal-flow', providerId] as const,
  portalBrainMemory: (providerId: string | null, categoryId: string | null) =>
    [...integrationsKeys.all, 'portal-brain-memory', providerId, categoryId] as const,
  portalCredentialStatus: (providerId: string | null, profileId: string | null) =>
    [...integrationsKeys.all, 'portal-credential-status', providerId, profileId] as const,
  portalJob: (jobId: string | null) =>
    [...integrationsKeys.all, 'portal-job', jobId] as const,
  portalJobItems: (jobId: string | null) =>
    [...integrationsKeys.all, 'portal-job-items', jobId] as const,
  latestPortalJob: (providerId: string | null, categoryId: string | null) =>
    [...integrationsKeys.all, 'portal-job-latest', providerId, categoryId] as const,
  portalDiscoveryReport: (jobId: string | null) =>
    [...integrationsKeys.all, 'portal-discovery-report', jobId] as const,
  syncRun: (runId: string | null) =>
    [...integrationsKeys.all, 'sync-run', runId] as const,
} as const;

// ============================================================================
// PRODUCT MANAGEMENT
// ============================================================================

export const productKeys = {
  all: ['product-management'] as const,
  providers: () => [...productKeys.all, 'providers'] as const,
  provider: (id: string) => [...productKeys.providers(), id] as const,
  schemas: () => [...productKeys.all, 'schemas'] as const,
  schema: (categoryId: string) => [...productKeys.schemas(), categoryId] as const,
} as const;

// ============================================================================
// PUBLICATIONS
// ============================================================================

export const publicationsKeys = {
  all: ['publications'] as const,
  initialization: () => [...publicationsKeys.all, 'initialization'] as const,
} as const;

export const publicationKeys = {
  all: ['publications'] as const,
  articles: () => [...publicationKeys.all, 'articles'] as const,
  articleList: (filters?: Record<string, unknown>) => [...publicationKeys.articles(), filters ?? {}] as const,
  article: (id: string) => [...publicationKeys.articles(), id] as const,
  categories: () => [...publicationKeys.all, 'categories'] as const,
  types: () => [...publicationKeys.all, 'types'] as const,
  marketNews: () => [...publicationKeys.all, 'market-news'] as const,
  templates: () => [...publicationKeys.all, 'templates'] as const,
  versions: (articleId: string) => [...publicationKeys.all, 'versions', articleId] as const,
} as const;

// ============================================================================
// NEWSLETTER
// ============================================================================

export const newsletterKeys = {
  all: ['newsletter'] as const,
  subscribers: () => [...newsletterKeys.all, 'subscribers'] as const,
  stats: () => [...newsletterKeys.all, 'stats'] as const,
} as const;

// ============================================================================
// APPLICATIONS
// ============================================================================

export const applicationKeys = {
  all: ['applications'] as const,
  lists: () => [...applicationKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...applicationKeys.lists(), filters] as const,
  detail: (id: string) => [...applicationKeys.all, 'detail', id] as const,
  steps: (applicationId: string) => [...applicationKeys.all, 'steps', applicationId] as const,
  step: (applicationId: string, step: number) => [...applicationKeys.all, 'step', applicationId, step] as const,
  byUser: (userId: string) => [...applicationKeys.all, 'user', userId] as const,
} as const;

// ============================================================================
// SOCIAL MEDIA
// ============================================================================

export const socialMediaKeys = {
  profiles: {
    all: ['social-media', 'profiles'] as const,
    lists: () => [...socialMediaKeys.profiles.all, 'list'] as const,
    detail: (id: string) => [...socialMediaKeys.profiles.all, 'detail', id] as const,
  },
  posts: {
    all: ['social-media', 'posts'] as const,
    lists: () => [...socialMediaKeys.posts.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...socialMediaKeys.posts.lists(), filters ?? {}] as const,
    detail: (id: string) => [...socialMediaKeys.posts.all, 'detail', id] as const,
    analytics: (id: string) => [...socialMediaKeys.posts.all, 'analytics', id] as const,
    dateRange: (start: string, end: string) =>
      [...socialMediaKeys.posts.all, 'date-range', start, end] as const,
  },
  campaigns: {
    all: ['social-media', 'campaigns'] as const,
    lists: () => [...socialMediaKeys.campaigns.all, 'list'] as const,
    detail: (id: string) => [...socialMediaKeys.campaigns.all, 'detail', id] as const,
    posts: (id: string) => [...socialMediaKeys.campaigns.all, 'posts', id] as const,
    analytics: (id: string) => [...socialMediaKeys.campaigns.all, 'analytics', id] as const,
  },
  analytics: {
    all: ['social-media', 'analytics'] as const,
    overview: () => [...socialMediaKeys.analytics.all, 'overview'] as const,
    topPosts: (limit?: number) => [...socialMediaKeys.analytics.all, 'top-posts', limit ?? 10] as const,
  },
  ai: {
    all: ['social-media', 'ai'] as const,
    history: (limit?: number) => ['social-media', 'ai', 'history', limit ?? 20] as const,
    generation: (id: string) => ['social-media', 'ai', 'generation', id] as const,
    status: () => ['social-media', 'ai', 'status'] as const,
    imageHistory: (limit?: number) => ['social-media', 'ai', 'image-history', limit ?? 20] as const,
    imageGeneration: (id: string) => ['social-media', 'ai', 'image-generation', id] as const,
    templates: () => ['social-media', 'ai', 'templates'] as const,
    template: (id: string) => ['social-media', 'ai', 'template', id] as const,
    analytics: () => ['social-media', 'ai', 'analytics'] as const,
  },
} as const;

// ============================================================================
// CALENDAR
// ============================================================================

export const calendarKeys = {
  all: ['calendar'] as const,
  birthdays: (year: number) => ['client-birthdays', year] as const,
  renewals: (year: number) => ['policy-renewals', year] as const,
  events: {
    all: ['calendar', 'events'] as const,
    list: (filters?: Record<string, unknown>) => [...calendarKeys.events.all, 'list', filters ?? {}] as const,
    detail: (id: string) => [...calendarKeys.events.all, 'detail', id] as const,
  },
} as const;

// ============================================================================
// PERSONNEL
// ============================================================================

export const personnelKeys = {
  all: ['personnel'] as const,
  lists: () => [...personnelKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...personnelKeys.lists(), filters] as const,
  details: () => [...personnelKeys.all, 'detail'] as const,
  detail: (id: string) => [...personnelKeys.details(), id] as const,
  clients: (personnelId: string) => [...personnelKeys.detail(personnelId), 'clients'] as const,
  superAdmin: () => [...personnelKeys.all, 'super-admin'] as const,
} as const;

export const permissionKeys = {
  all: [...personnelKeys.all, 'permissions'] as const,
  detail: (personnelId: string) => [...permissionKeys.all, personnelId] as const,
  me: () => [...permissionKeys.all, 'me'] as const,
} as const;

// ============================================================================
// REQUESTS
// ============================================================================

export const requestKeys = {
  all: ['requests'] as const,
  lists: () => [...requestKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...requestKeys.lists(), filters ?? {}] as const,
  detail: (id: string) => [...requestKeys.all, 'detail', id] as const,
  templates: () => [...requestKeys.all, 'templates'] as const,
  templateList: (filters?: Record<string, unknown>) => [...requestKeys.templates(), filters ?? {}] as const,
  template: (id: string) => [...requestKeys.templates(), id] as const,
} as const;

// ============================================================================
// RESOURCES
// ============================================================================

export const resourceKeys = {
  all: ['resources'] as const,
  lists: () => [...resourceKeys.all, 'list'] as const,
  detail: (id: string) => [...resourceKeys.all, 'detail', id] as const,
  legalDocuments: () => [...resourceKeys.all, 'legal-documents'] as const,
  legalDocument: (slug: string) => [...resourceKeys.legalDocuments(), slug] as const,
  legalDocumentVersions: (slug: string) => [...resourceKeys.legalDocument(slug), 'versions'] as const,
} as const;

// ============================================================================
// FNA — FINANCIAL NEEDS ANALYSIS (all sub-types)
// ============================================================================

export const fnaKeys = {
  all: ['fna'] as const,
  clientSessions: (clientId: string) => ['fna', 'sessions', clientId] as const,
  latestPublished: (clientId: string) => ['fna', 'latest-published', clientId] as const,
  session: (fnaId: string) => ['fna', 'session', fnaId] as const,
  batchStatus: (clientId: string) => ['fna', 'batch-status', clientId] as const,
} as const;

export const riskFnaKeys = {
  all: ['risk-fna'] as const,
  lists: () => [...riskFnaKeys.all, 'list'] as const,
  list: (clientId: string) => [...riskFnaKeys.lists(), clientId] as const,
  details: () => [...riskFnaKeys.all, 'detail'] as const,
  detail: (id: string) => [...riskFnaKeys.details(), id] as const,
  clientProfile: (clientId: string) => [...riskFnaKeys.all, 'client-profile', clientId] as const,
} as const;

export const medicalFnaKeys = {
  all: ['medical-fna'] as const,
  clientProfile: (clientId: string) => [...medicalFnaKeys.all, 'client-profile', clientId] as const,
  policies: (clientId: string) => ['medical-aid-policies', clientId] as const,
} as const;

// ============================================================================
// COMPLIANCE
// ============================================================================

export const complianceKeys = {
  all: ['compliance'] as const,
  overview: () => [...complianceKeys.all, 'overview'] as const,
  records: (tab: string) => [...complianceKeys.all, 'records', tab] as const,
} as const;

// ============================================================================
// ESIGN
// ============================================================================

export const esignKeys = {
  all: ['esign'] as const,
  envelopes: () => [...esignKeys.all, 'envelopes'] as const,
  envelope: (id: string) => [...esignKeys.envelopes(), id] as const,
  templates: () => [...esignKeys.all, 'templates'] as const,
  dashboard: () => [...esignKeys.all, 'dashboard'] as const,
} as const;

// ============================================================================
// NOTES
// ============================================================================

export const noteKeys = {
  all: ['notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  list: (personnelId: string) => [...noteKeys.lists(), personnelId] as const,
  details: () => [...noteKeys.all, 'detail'] as const,
  detail: (id: string) => [...noteKeys.details(), id] as const,
  clientNotes: (clientId: string) => [...noteKeys.all, 'client', clientId] as const,
} as const;
