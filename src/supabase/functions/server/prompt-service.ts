/**
 * Prompt Service (Phase 3)
 *
 * KV-backed prompt storage with draft/publish/versioning/rollback.
 *
 * KV keys:
 *   ai:prompt:{agentId}:{context}:active           — live prompt
 *   ai:prompt:{agentId}:{context}:draft            — editable prompt
 *   ai:prompt:{agentId}:{context}:v:{timestamp}    — version snapshot
 *   ai:prompt:{agentId}:{context}:index            — version index
 *   ai:prompt:{agentId}:{context}:meta             — metadata (lastPublishedBy/At etc.)
 */
import * as kv from './kv_store.tsx';

export type PromptContext = 'public' | 'authenticated' | 'admin';

export interface PromptMeta {
  agentId: string;
  context: PromptContext;
  lastPublishedAt?: string;
  lastPublishedBy?: string;
  versionCount: number;
  updatedAt: string;
}

export interface PromptVersion {
  id: string; // timestamp-based id
  agentId: string;
  context: PromptContext;
  prompt: string;
  publishedAt: string;
  publishedBy: string;
}

interface PromptIndex {
  versionIds: string[];
  updatedAt: string;
}

function activeKey(agentId: string, context: PromptContext) {
  return `ai:prompt:${agentId}:${context}:active`;
}
function draftKey(agentId: string, context: PromptContext) {
  return `ai:prompt:${agentId}:${context}:draft`;
}
function versionKey(agentId: string, context: PromptContext, versionId: string) {
  return `ai:prompt:${agentId}:${context}:v:${versionId}`;
}
function indexKey(agentId: string, context: PromptContext) {
  return `ai:prompt:${agentId}:${context}:index`;
}
function metaKey(agentId: string, context: PromptContext) {
  return `ai:prompt:${agentId}:${context}:meta`;
}

async function getIndex(agentId: string, context: PromptContext): Promise<PromptIndex> {
  const existing = await kv.get(indexKey(agentId, context)) as PromptIndex | null;
  return existing ?? { versionIds: [], updatedAt: new Date().toISOString() };
}

async function saveIndex(agentId: string, context: PromptContext, index: PromptIndex) {
  await kv.set(indexKey(agentId, context), { ...index, updatedAt: new Date().toISOString() } satisfies PromptIndex);
}

async function getMeta(agentId: string, context: PromptContext): Promise<PromptMeta> {
  const existing = await kv.get(metaKey(agentId, context)) as PromptMeta | null;
  return (
    existing ?? {
      agentId,
      context,
      versionCount: 0,
      updatedAt: new Date().toISOString(),
    }
  );
}

async function saveMeta(agentId: string, context: PromptContext, meta: PromptMeta) {
  await kv.set(metaKey(agentId, context), { ...meta, updatedAt: new Date().toISOString() } satisfies PromptMeta);
}

export async function getActivePrompt(agentId: string, context: PromptContext): Promise<string | null> {
  return (await kv.get(activeKey(agentId, context))) as string | null;
}

export async function getDraftPrompt(agentId: string, context: PromptContext): Promise<string | null> {
  return (await kv.get(draftKey(agentId, context))) as string | null;
}

export async function setDraftPrompt(agentId: string, context: PromptContext, prompt: string): Promise<void> {
  await kv.set(draftKey(agentId, context), prompt);
}

export async function ensureSeeded(agentId: string, context: PromptContext, seedPrompt: string): Promise<void> {
  const existingActive = await getActivePrompt(agentId, context);
  if (!existingActive) {
    await kv.set(activeKey(agentId, context), seedPrompt);
  }
  const existingDraft = await getDraftPrompt(agentId, context);
  if (!existingDraft) {
    await kv.set(draftKey(agentId, context), seedPrompt);
  }
  // Ensure meta exists
  const meta = await getMeta(agentId, context);
  if (!meta.lastPublishedAt) {
    await saveMeta(agentId, context, meta);
  }
}

export async function publishDraft(agentId: string, context: PromptContext, publishedBy: string): Promise<PromptVersion> {
  const draft = await getDraftPrompt(agentId, context);
  if (!draft) {
    throw new Error('No draft prompt exists to publish');
  }

  const publishedAt = new Date().toISOString();
  const versionId = String(Date.now());

  const version: PromptVersion = {
    id: versionId,
    agentId,
    context,
    prompt: draft,
    publishedAt,
    publishedBy,
  };

  const index = await getIndex(agentId, context);
  index.versionIds.unshift(versionId);

  const meta = await getMeta(agentId, context);
  const updatedMeta: PromptMeta = {
    ...meta,
    agentId,
    context,
    lastPublishedAt: publishedAt,
    lastPublishedBy: publishedBy,
    versionCount: (meta.versionCount ?? 0) + 1,
    updatedAt: publishedAt,
  };

  await Promise.all([
    kv.set(activeKey(agentId, context), draft),
    kv.set(versionKey(agentId, context, versionId), version),
    saveIndex(agentId, context, index),
    saveMeta(agentId, context, updatedMeta),
  ]);

  return version;
}

export async function listVersions(agentId: string, context: PromptContext): Promise<PromptVersion[]> {
  const index = await getIndex(agentId, context);
  if (index.versionIds.length === 0) return [];

  const keys = index.versionIds.map((id) => versionKey(agentId, context, id));
  const versions = (await kv.mget(keys)) as (PromptVersion | null)[];
  return versions.filter((v): v is PromptVersion => v !== null);
}

export async function rollbackToVersion(agentId: string, context: PromptContext, versionId: string, rolledBackBy: string) {
  const version = (await kv.get(versionKey(agentId, context, versionId))) as PromptVersion | null;
  if (!version) return null;

  // Put the version prompt into both active and draft (so editor matches live)
  await Promise.all([
    kv.set(activeKey(agentId, context), version.prompt),
    kv.set(draftKey(agentId, context), version.prompt),
  ]);

  // Record rollback as a new published version for audit trail
  return await publishDraft(agentId, context, rolledBackBy);
}

