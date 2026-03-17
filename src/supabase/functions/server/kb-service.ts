/**
 * Knowledge Base Service
 *
 * CRUD operations for AI knowledge base entries stored in KV.
 *
 * KV Key Conventions (§5.4):
 *   ai:kb:{entryId}         — Individual KB entry
 *   ai:kb:index              — Index of all KB entry IDs
 *
 * Guidelines: §4.2, §5.4
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('kb-service');

// ============================================================================
// TYPES
// ============================================================================

export type KBEntryType = 'qa' | 'article' | 'snippet' | 'faq' | 'policy';
export type KBEntryStatus = 'draft' | 'active' | 'archived';

export interface KBEntry {
  id: string;
  title: string;
  type: KBEntryType;
  status: KBEntryStatus;
  content: string;
  question?: string;
  answer?: string;
  category: string;
  tags: string[];
  agentScope: 'all' | string[];
  priority: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKBInput {
  title: string;
  type: KBEntryType;
  content: string;
  question?: string;
  answer?: string;
  category: string;
  tags: string[];
  agentScope: 'all' | string[];
  priority: number;
  status?: KBEntryStatus;
}

export interface UpdateKBInput {
  title?: string;
  type?: KBEntryType;
  content?: string;
  question?: string;
  answer?: string;
  category?: string;
  tags?: string[];
  agentScope?: 'all' | string[];
  priority?: number;
  status?: KBEntryStatus;
}

interface KBIndex {
  entryIds: string[];
  updatedAt: string;
}

export interface KBStats {
  total: number;
  active: number;
  draft: number;
  archived: number;
  byType: Record<KBEntryType, number>;
  categories: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const INDEX_KEY = 'ai:kb:index';
const ENTRY_PREFIX = 'ai:kb:';

function entryKey(id: string): string {
  return `${ENTRY_PREFIX}${id}`;
}

function generateId(): string {
  return `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// INDEX MANAGEMENT
// ============================================================================

async function getIndex(): Promise<KBIndex> {
  const index = await kv.get(INDEX_KEY) as KBIndex | null;
  return index || { entryIds: [], updatedAt: new Date().toISOString() };
}

async function saveIndex(index: KBIndex): Promise<void> {
  await kv.set(INDEX_KEY, { ...index, updatedAt: new Date().toISOString() });
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get all KB entries.
 */
export async function getAllEntries(): Promise<KBEntry[]> {
  const index = await getIndex();
  if (index.entryIds.length === 0) return [];

  const keys = index.entryIds.map(entryKey);
  const entries = await kv.mget(keys) as (KBEntry | null)[];

  // Filter out nulls (orphaned index entries)
  return entries.filter((e): e is KBEntry => e !== null);
}

/**
 * Get KB stats summary.
 */
export async function getStats(): Promise<KBStats> {
  const entries = await getAllEntries();

  const stats: KBStats = {
    total: entries.length,
    active: 0,
    draft: 0,
    archived: 0,
    byType: { qa: 0, article: 0, snippet: 0, faq: 0, policy: 0 },
    categories: [],
  };

  const categorySet = new Set<string>();

  for (const entry of entries) {
    // Count by status
    if (entry.status === 'active') stats.active++;
    else if (entry.status === 'draft') stats.draft++;
    else if (entry.status === 'archived') stats.archived++;

    // Count by type
    if (entry.type in stats.byType) {
      stats.byType[entry.type]++;
    }

    // Collect categories
    if (entry.category) categorySet.add(entry.category);
  }

  stats.categories = Array.from(categorySet).sort();
  return stats;
}

/**
 * Get a single KB entry by ID.
 */
export async function getEntry(id: string): Promise<KBEntry | null> {
  return await kv.get(entryKey(id)) as KBEntry | null;
}

/**
 * Create a new KB entry.
 */
export async function createEntry(input: CreateKBInput, userId: string): Promise<KBEntry> {
  const id = generateId();
  const now = new Date().toISOString();

  const entry: KBEntry = {
    id,
    title: input.title,
    type: input.type,
    status: input.status || 'draft',
    content: input.content,
    question: input.question,
    answer: input.answer,
    category: input.category,
    tags: input.tags || [],
    agentScope: input.agentScope || 'all',
    priority: input.priority ?? 5,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  // Write entry and update index together (§5.4 — multi-entry consistency)
  const index = await getIndex();
  index.entryIds.push(id);

  await Promise.all([
    kv.set(entryKey(id), entry),
    saveIndex(index),
  ]);

  log.info('KB entry created', { id, type: input.type, title: input.title });
  return entry;
}

/**
 * Update an existing KB entry.
 */
export async function updateEntry(id: string, input: UpdateKBInput): Promise<KBEntry | null> {
  const existing = await getEntry(id);
  if (!existing) return null;

  const updated: KBEntry = {
    ...existing,
    ...Object.fromEntries(
      Object.entries(input).filter(([_, v]) => v !== undefined)
    ),
    id: existing.id, // Ensure ID cannot be changed
    createdBy: existing.createdBy,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(entryKey(id), updated);
  log.info('KB entry updated', { id, title: updated.title });
  return updated;
}

/**
 * Delete a KB entry (hard delete).
 */
export async function deleteEntry(id: string): Promise<boolean> {
  const existing = await getEntry(id);
  if (!existing) return false;

  // Remove from index and delete entry (§5.4 — multi-entry consistency)
  const index = await getIndex();
  index.entryIds = index.entryIds.filter(eid => eid !== id);

  await Promise.all([
    kv.del(entryKey(id)),
    saveIndex(index),
  ]);

  log.info('KB entry deleted', { id, title: existing.title });
  return true;
}
