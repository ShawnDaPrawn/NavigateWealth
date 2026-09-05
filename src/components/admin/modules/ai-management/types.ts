/**
 * AI Management Module — Types
 *
 * Centralised type definitions for the AI Agent Management module.
 * Public types are exported for cross-module use; internal types stay private.
 *
 * Guidelines: §5.2, §9.2
 */

// ============================================================================
// AGENT REGISTRY
// ============================================================================

/** Agent contexts — where an agent operates */
export type AgentContext = 'public' | 'authenticated' | 'admin';

/** Agent operational status */
export type AgentStatus = 'active' | 'disabled' | 'maintenance';

/** Registered AI agent configuration */
export interface AIAgentConfig {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon slug
  status: AgentStatus;
  model: string;
  temperature: number;
  maxTokens: number;
  maxContextMessages: number;
  presencePenalty: number;
  frequencyPenalty: number;
  contexts: AgentContext[];
  features: {
    ragEnabled: boolean;
    feedbackEnabled: boolean;
    handoffEnabled: boolean;
    streamingEnabled: boolean;
    citationsEnabled: boolean;
  };
  rateLimit?: {
    perSession: number;
    perDay: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// VASCO CONFIG (existing feature flag)
// ============================================================================

export interface VascoConfig {
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

// ============================================================================
// ANALYTICS
// ============================================================================

export interface DailyMetrics {
  date: string;
  sessions: number;
  messages: number;
  uniqueIps: string[];
  feedbackPositive: number;
  feedbackNegative: number;
  handoffs: number;
  ragHits: number;
  rateLimited: number;
  topicBlocked: number;
  circuitBreakerBlocked: number;
  guardrailFailures: number;
  estimatedPublicTokens: number;
}

export interface AnalyticsSummary {
  totalSessions: number;
  totalMessages: number;
  totalFeedbackPositive: number;
  totalFeedbackNegative: number;
  totalHandoffs: number;
  totalRagHits: number;
  totalRateLimited: number;
  totalTopicBlocked: number;
  totalCircuitBreakerBlocked: number;
  totalGuardrailFailures: number;
  totalEstimatedPublicTokens: number;
  last7Days: DailyMetrics[];
  topTopics: Array<{ topic: string; count: number }>;
  lastUpdated: string;
}

// ============================================================================
// FEEDBACK
// ============================================================================

export type FeedbackRating = 'positive' | 'negative';

export interface FeedbackEntry {
  id: string;
  sessionId: string;
  messageContent: string;
  rating: FeedbackRating;
  comment?: string;
  createdAt: string;
}

// ============================================================================
// HANDOFF / LEAD CAPTURE
// ============================================================================

export type HandoffStatus = 'new' | 'contacted' | 'converted' | 'closed';

export interface HandoffRequest {
  id: string;
  sessionId: string;
  name: string;
  email: string;
  phone?: string;
  topic: string;
  conversationSummary: string;
  status: HandoffStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// KNOWLEDGE INDEX (what Vasco can actually retrieve)
// ============================================================================

export interface IndexedArticleMeta {
  articleId: string;
  title: string;
  slug: string;
  chunkCount: number;
  indexedAt: string;
}

export interface IndexedKnowledgeMeta {
  entryId: string;
  title: string;
  type: KBEntryType;
  category: string;
  chunkCount: number;
  indexedAt: string;
  agentScope: KBAgentScope;
  priority: number;
}

/**
 * Index status as reported by GET /vasco/index. Compares what is indexed with
 * what is published / live right now so the UI can say "out of date".
 */
export interface KnowledgeIndexStatus {
  /** False when no index document exists at all (never built, or cleared). */
  indexed: boolean;
  articles: IndexedArticleMeta[];
  kbEntries: IndexedKnowledgeMeta[];
  totalChunks: number;
  /** Last full rebuild; null when only incremental syncs have run. */
  lastFullIndex: string | null;
  /** Last change of any kind (rebuild or single-source sync). */
  lastUpdated: string | null;
  publishedArticleCount: number;
  activeKbCount: number;
  /** Published articles not in the index yet. */
  pendingArticles: number;
  /** Live KB entries not in the index yet. */
  pendingKbEntries: number;
  /** Indexed sources that are no longer published / live. */
  staleSources: number;
}

export interface IndexResult {
  articlesIndexed: number;
  kbEntriesIndexed: number;
  totalChunks: number;
  errors: string[];
  durationMs: number;
}

/** Outcome of syncing one KB entry into the index, returned on every KB write. */
export interface KBIndexOutcome {
  indexed: boolean;
  chunkCount: number;
  error?: string;
}

// ============================================================================
// MODULE TAB STATE
// ============================================================================

export type AIManagementTab = 'overview' | 'knowledge' | 'prompts' | 'feedback' | 'leads';

// ============================================================================
// PROMPT STUDIO (Phase 3)
// ============================================================================

export type PromptContext = 'public' | 'authenticated' | 'admin';

export interface PromptVersion {
  id: string;
  agentId: string;
  context: PromptContext;
  prompt: string;
  publishedAt: string;
  publishedBy: string;
}

// ============================================================================
// FILTERS
// ============================================================================

export interface FeedbackFilters {
  rating?: FeedbackRating | 'all';
  search?: string;
}

export interface HandoffFilters {
  status?: HandoffStatus | 'all';
  search?: string;
}

// ============================================================================
// KNOWLEDGE BASE (Phase 2)
// ============================================================================

/** Content entry type — what kind of content is stored */
export type KBEntryType = 'qa' | 'article' | 'snippet' | 'faq' | 'policy';

/** Content lifecycle status */
export type KBEntryStatus = 'draft' | 'active' | 'archived';

/** Which agents have access to this content */
export type KBAgentScope = 'all' | string[]; // 'all' or specific agent IDs

/** A single knowledge base content entry */
export interface KBEntry {
  id: string;
  title: string;
  type: KBEntryType;
  status: KBEntryStatus;
  /** The main content body (markdown supported) */
  content: string;
  /** For Q&A type: the question */
  question?: string;
  /** For Q&A type: the answer */
  answer?: string;
  /** Category/topic for organisation */
  category: string;
  /** Tags for filtering and search */
  tags: string[];
  /** Which agents can access this content ('all' or array of agent IDs) */
  agentScope: KBAgentScope;
  /** Priority weighting for RAG retrieval (higher = more likely to surface) */
  priority: number;
  /** Metadata for display */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Input for creating a new KB entry */
export interface CreateKBEntryInput {
  title: string;
  type: KBEntryType;
  content: string;
  question?: string;
  answer?: string;
  category: string;
  tags: string[];
  agentScope: KBAgentScope;
  priority: number;
  status?: KBEntryStatus;
}

/** What the server returns after creating or updating an entry. */
export interface KBSaveResult {
  entry: KBEntry;
  /** Absent only from servers that predate index syncing. */
  index?: KBIndexOutcome;
}

/** Input for updating an existing KB entry */
export interface UpdateKBEntryInput {
  title?: string;
  type?: KBEntryType;
  content?: string;
  question?: string;
  answer?: string;
  category?: string;
  tags?: string[];
  agentScope?: KBAgentScope;
  priority?: number;
  status?: KBEntryStatus;
}

/** Filters for knowledge base listing */
export interface KBFilters {
  type?: KBEntryType | 'all';
  status?: KBEntryStatus | 'all';
  category?: string | 'all';
  agentId?: string | 'all';
  search?: string;
}

/** Knowledge base summary stats */
export interface KBStats {
  total: number;
  active: number;
  draft: number;
  archived: number;
  byType: Record<KBEntryType, number>;
  categories: string[];
}
