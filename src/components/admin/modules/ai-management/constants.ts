/**
 * AI Management Module — Constants
 *
 * Centralised configuration: endpoints, status configs, default values.
 * Guidelines: §5.3
 */

import type { AIAgentConfig, AgentStatus, HandoffStatus, FeedbackRating, KBEntryType, KBEntryStatus } from './types';

// ============================================================================
// API ENDPOINTS (§5.3)
// ============================================================================

export const ENDPOINTS = {
  // Vasco feature flag
  VASCO_CONFIG: '/vasco/config',
  // Agent registry
  AGENTS_LIST: '/ai-management/agents',
  AGENT_DETAIL: (id: string) => `/ai-management/agents/${id}`,
  // Analytics
  ANALYTICS_SUMMARY: '/vasco/analytics',
  // Feedback
  FEEDBACK_LIST: '/vasco/feedback',
  // Handoffs
  HANDOFFS_LIST: '/vasco/handoffs',
  HANDOFF_UPDATE: (id: string) => `/vasco/handoffs/${id}`,
  // RAG Index
  RAG_INDEX: '/vasco/index',
  // Knowledge Base (Phase 2)
  KB_LIST: '/ai-management/kb',
  KB_DETAIL: (id: string) => `/ai-management/kb/${id}`,
  KB_STATS: '/ai-management/kb/stats',
} as const;

// ============================================================================
// AGENT STATUS CONFIG (§8.3 — Status colour vocabulary)
// ============================================================================

export const AGENT_STATUS_CONFIG: Record<AgentStatus, {
  label: string;
  badgeClass: string;
  dotClass: string;
}> = {
  active: {
    label: 'Active',
    badgeClass: 'bg-green-600 hover:bg-green-700 text-white',
    dotClass: 'bg-green-500',
  },
  disabled: {
    label: 'Disabled',
    badgeClass: 'bg-gray-500 hover:bg-gray-600 text-white',
    dotClass: 'bg-gray-400',
  },
  maintenance: {
    label: 'Maintenance',
    badgeClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    dotClass: 'bg-amber-500',
  },
} as const;

// ============================================================================
// HANDOFF STATUS CONFIG (§8.3)
// ============================================================================

export const HANDOFF_STATUS_CONFIG: Record<HandoffStatus, {
  label: string;
  badgeClass: string;
  dotClass: string;
}> = {
  new: {
    label: 'New',
    badgeClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    dotClass: 'bg-blue-500',
  },
  contacted: {
    label: 'Contacted',
    badgeClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    dotClass: 'bg-amber-500',
  },
  converted: {
    label: 'Converted',
    badgeClass: 'bg-green-600 hover:bg-green-700 text-white',
    dotClass: 'bg-green-500',
  },
  closed: {
    label: 'Closed',
    badgeClass: 'bg-gray-500 hover:bg-gray-600 text-white',
    dotClass: 'bg-gray-400',
  },
} as const;

// ============================================================================
// FEEDBACK RATING CONFIG
// ============================================================================

export const FEEDBACK_RATING_CONFIG: Record<FeedbackRating, {
  label: string;
  badgeClass: string;
  icon: string;
}> = {
  positive: {
    label: 'Positive',
    badgeClass: 'bg-green-100 text-green-700',
    icon: 'ThumbsUp',
  },
  negative: {
    label: 'Negative',
    badgeClass: 'bg-red-100 text-red-700',
    icon: 'ThumbsDown',
  },
} as const;

// ============================================================================
// DEFAULT AGENT REGISTRY — Initial seed for Phase 1 (read-only)
// ============================================================================

export const DEFAULT_AGENTS: AIAgentConfig[] = [
  {
    id: 'vasco-public',
    name: 'Vasco (Public)',
    description: 'Public-facing AI financial navigator on the Navigate Wealth website. Provides general financial education, product info, and lead qualification.',
    icon: 'Compass',
    status: 'active',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 1000,
    maxContextMessages: 20,
    presencePenalty: 0.1,
    frequencyPenalty: 0.1,
    contexts: ['public'],
    features: {
      ragEnabled: true,
      feedbackEnabled: true,
      handoffEnabled: true,
      streamingEnabled: true,
      citationsEnabled: true,
    },
    rateLimit: {
      perSession: 30,
      perDay: 100,
    },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'vasco-authenticated',
    name: 'Vasco (Portal)',
    description: 'Authenticated AI advisor in the client portal. Has access to user portfolio context, risk profiles, and personalised financial guidance.',
    icon: 'Compass',
    status: 'active',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 1500,
    maxContextMessages: 20,
    presencePenalty: 0.1,
    frequencyPenalty: 0.1,
    contexts: ['authenticated'],
    features: {
      ragEnabled: true,
      feedbackEnabled: false,
      handoffEnabled: false,
      streamingEnabled: true,
      citationsEnabled: true,
    },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'advice-engine',
    name: 'AI Intelligence',
    description: 'Admin-side AI assistant for the Advice Engine. Helps advisers draft Records of Advice and analyse client data.',
    icon: 'Brain',
    status: 'active',
    model: 'gpt-4o',
    temperature: 0.5,
    maxTokens: 2000,
    maxContextMessages: 30,
    presencePenalty: 0.0,
    frequencyPenalty: 0.0,
    contexts: ['admin'],
    features: {
      ragEnabled: false,
      feedbackEnabled: false,
      handoffEnabled: false,
      streamingEnabled: true,
      citationsEnabled: false,
    },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'will-planner',
    name: 'Will Planner',
    description: 'Estate planning assistant that guides users through will creation and estate duty considerations.',
    icon: 'ScrollText',
    status: 'active',
    model: 'gpt-4o',
    temperature: 0.6,
    maxTokens: 1500,
    maxContextMessages: 20,
    presencePenalty: 0.1,
    frequencyPenalty: 0.1,
    contexts: ['authenticated', 'admin'],
    features: {
      ragEnabled: false,
      feedbackEnabled: false,
      handoffEnabled: false,
      streamingEnabled: true,
      citationsEnabled: false,
    },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'tax-advisor',
    name: 'Tax Advisor',
    description: 'Tax planning assistant specialising in South African tax legislation, deductions, and optimisation strategies.',
    icon: 'Calculator',
    status: 'active',
    model: 'gpt-4o',
    temperature: 0.5,
    maxTokens: 1500,
    maxContextMessages: 20,
    presencePenalty: 0.0,
    frequencyPenalty: 0.0,
    contexts: ['authenticated', 'admin'],
    features: {
      ragEnabled: false,
      feedbackEnabled: false,
      handoffEnabled: false,
      streamingEnabled: true,
      citationsEnabled: false,
    },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

// ============================================================================
// QUERY CONFIG
// ============================================================================

export const QUERY_STALE_TIME = 2 * 60 * 1000; // 2 minutes
export const ANALYTICS_STALE_TIME = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// TAB CONFIG
// ============================================================================

export const TAB_CONFIG = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: 'agents' as const, label: 'Agents', icon: 'Bot' },
  { id: 'knowledge-base' as const, label: 'Knowledge Base', icon: 'BookOpen' },
  { id: 'analytics' as const, label: 'Analytics', icon: 'BarChart3' },
  { id: 'feedback' as const, label: 'Feedback', icon: 'MessageSquare' },
  { id: 'handoffs' as const, label: 'Handoffs', icon: 'PhoneForwarded' },
] as const;

// ============================================================================
// KNOWLEDGE BASE CONFIG (Phase 2)
// ============================================================================

export const KB_ENTRY_TYPE_CONFIG: Record<KBEntryType, {
  label: string;
  icon: string;
  badgeClass: string;
  description: string;
}> = {
  qa: {
    label: 'Q&A',
    icon: 'HelpCircle',
    badgeClass: 'bg-blue-100 text-blue-700',
    description: 'Question and answer pair — ideal for structured FAQ content',
  },
  article: {
    label: 'Article',
    icon: 'FileText',
    badgeClass: 'bg-purple-100 text-purple-700',
    description: 'Long-form content — guides, explanations, and educational material',
  },
  snippet: {
    label: 'Snippet',
    icon: 'Code',
    badgeClass: 'bg-gray-100 text-gray-700',
    description: 'Short text snippet — key facts, definitions, or quick references',
  },
  faq: {
    label: 'FAQ',
    icon: 'MessageCircleQuestion',
    badgeClass: 'bg-green-100 text-green-700',
    description: 'Frequently asked question — common client queries',
  },
  policy: {
    label: 'Policy',
    icon: 'Shield',
    badgeClass: 'bg-amber-100 text-amber-700',
    description: 'Policy or compliance content — regulatory information',
  },
} as const;

export const KB_STATUS_CONFIG: Record<KBEntryStatus, {
  label: string;
  badgeClass: string;
  dotClass: string;
}> = {
  draft: {
    label: 'Draft',
    badgeClass: 'bg-gray-500 hover:bg-gray-600 text-white',
    dotClass: 'bg-gray-400',
  },
  active: {
    label: 'Active',
    badgeClass: 'bg-green-600 hover:bg-green-700 text-white',
    dotClass: 'bg-green-500',
  },
  archived: {
    label: 'Archived',
    badgeClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    dotClass: 'bg-amber-500',
  },
} as const;

/** Default categories for KB entries */
export const KB_DEFAULT_CATEGORIES = [
  'Financial Planning',
  'Risk Management',
  'Retirement',
  'Investments',
  'Tax Planning',
  'Estate Planning',
  'Medical Aid',
  'Employee Benefits',
  'Insurance',
  'Company Info',
  'Compliance',
  'General',
] as const;