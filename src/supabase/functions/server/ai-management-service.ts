/**
 * AI Management Service
 *
 * Business logic for the AI Agent Management admin module.
 * Phase 1: Agent registry (KV-backed with defaults fallback),
 * proxying existing Vasco analytics/feedback/handoff services.
 *
 * KV Key Conventions (§5.4):
 *   ai:agent:{agentId}:config   — Agent configuration
 *   ai:agent:registry            — Agent registry index
 *
 * Guidelines: §4.2, §5.4
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('ai-management');

// ============================================================================
// TYPES
// ============================================================================

export interface AIAgentConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'active' | 'disabled' | 'maintenance';
  model: string;
  temperature: number;
  maxTokens: number;
  maxContextMessages: number;
  presencePenalty: number;
  frequencyPenalty: number;
  contexts: string[];
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

interface AgentRegistry {
  agentIds: string[];
  updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REGISTRY_KEY = 'ai:agent:registry';
const AGENT_PREFIX = 'ai:agent:';

// ============================================================================
// DEFAULT AGENTS — Seeded on first access
// ============================================================================

const DEFAULT_AGENTS: AIAgentConfig[] = [
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
    rateLimit: { perSession: 30, perDay: 100 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vasco-authenticated',
    name: 'Vasco (Portal)',
    description: 'Authenticated AI advisor in the client portal. Has access to client profile information, policy data, portfolio overview, FNA/INA context, communication history, and document history for personalised guidance.',
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * Ensure the agent registry is seeded with defaults.
 * Idempotent — only writes if registry doesn't exist.
 */
async function ensureRegistry(): Promise<void> {
  const existing = await kv.get(REGISTRY_KEY) as AgentRegistry | null;
  if (existing) return;

  log.info('Seeding agent registry with defaults');

  // Write all default agents to KV
  for (const agent of DEFAULT_AGENTS) {
    await kv.set(`${AGENT_PREFIX}${agent.id}:config`, agent);
  }

  // Write registry index
  await kv.set(REGISTRY_KEY, {
    agentIds: DEFAULT_AGENTS.map(a => a.id),
    updatedAt: new Date().toISOString(),
  } satisfies AgentRegistry);
}

/**
 * Get all registered agents.
 */
export async function getAllAgents(): Promise<AIAgentConfig[]> {
  await ensureRegistry();

  const registry = await kv.get(REGISTRY_KEY) as AgentRegistry | null;
  if (!registry || registry.agentIds.length === 0) {
    return DEFAULT_AGENTS;
  }

  const keys = registry.agentIds.map(id => `${AGENT_PREFIX}${id}:config`);
  const agents = await kv.mget(keys) as (AIAgentConfig | null)[];

  // Filter nulls and return; fall back to defaults for missing entries
  const result: AIAgentConfig[] = [];
  for (let i = 0; i < registry.agentIds.length; i++) {
    const agent = agents[i];
    if (agent) {
      result.push(agent);
    } else {
      const fallback = DEFAULT_AGENTS.find(d => d.id === registry.agentIds[i]);
      if (fallback) result.push(fallback);
    }
  }

  return result;
}

/**
 * Get a single agent by ID.
 */
export async function getAgent(id: string): Promise<AIAgentConfig | null> {
  await ensureRegistry();

  const agent = await kv.get(`${AGENT_PREFIX}${id}:config`) as AIAgentConfig | null;
  if (agent) return agent;

  return DEFAULT_AGENTS.find(a => a.id === id) || null;
}
