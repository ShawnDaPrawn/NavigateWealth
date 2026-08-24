/**
 * Social-media AI bundles, custom brand templates, and analytics: the
 * text+image single-flow generation plus the template CRUD and usage
 * analytics. One slice of social-media-ai-service.ts.
 */
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import {
  generatePostText,
  type GeneratePostTextInput,
  type GeneratePostTextResult,
  type AIGenerationRecord,
} from './social-media-ai-text.ts';
import {
  generateImage,
  type GenerateImageInput,
  type GenerateImageResult,
  type AIImageRecord,
} from './social-media-ai-images.ts';

const log = createModuleLogger('social-media-ai');

export interface GenerateBundleInput {
  /** Text generation params */
  text: GeneratePostTextInput;
  /** Image generation params */
  image: GenerateImageInput;
}

export interface GenerateBundleResult {
  text: GeneratePostTextResult;
  image: GenerateImageResult;
  bundleId: string;
}

export interface AIBundleRecord {
  id: string;
  input: GenerateBundleInput;
  result: GenerateBundleResult;
  createdBy: string;
  createdAt: string;
}

/**
 * Generate a full content bundle: post text + branded image in parallel.
 */
export async function generateBundle(
  input: GenerateBundleInput,
  userId: string,
): Promise<GenerateBundleResult> {
  log.info('Generating content bundle (text + image)', {
    platforms: input.text.platforms,
    imagePlatform: input.image.platform,
    imageStyle: input.image.style,
  });

  // Run text and image generation in parallel
  const [textResult, imageResult] = await Promise.all([
    generatePostText(input.text, userId),
    generateImage(input.image, userId),
  ]);

  const bundleId = crypto.randomUUID();

  const result: GenerateBundleResult = {
    text: textResult,
    image: imageResult,
    bundleId,
  };

  // Persist bundle record
  const record: AIBundleRecord = {
    id: bundleId,
    input,
    result,
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };

  try {
    await kv.set(`social_ai_bundle:${bundleId}`, record);
    log.info('AI bundle record saved', { bundleId });
  } catch (kvErr: unknown) {
    log.warn('Failed to save AI bundle record', {
      bundleId,
      error: kvErr instanceof Error ? kvErr.message : String(kvErr),
    });
  }

  log.success('Content bundle generated', {
    bundleId,
    textPlatforms: textResult.posts.length,
    imageCount: imageResult.images.length,
  });

  return result;
}

// ===========================================================================
// CUSTOM BRAND TEMPLATES (Phase 3+)
// ===========================================================================

export interface CustomBrandTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  platforms: string[];
  tone: string;
  goal: string;
  topicPrompt: string;
  includeHashtags: boolean;
  includeCTA: boolean;
  additionalInstructions: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export async function createCustomTemplate(
  input: Omit<CustomBrandTemplate, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
  userId: string,
): Promise<CustomBrandTemplate> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const template: CustomBrandTemplate = {
    ...input,
    id,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
  await kv.set(`social_ai_template:${id}`, template);
  log.info('Custom brand template created', { id, name: template.name });
  return template;
}

export async function updateCustomTemplate(
  id: string,
  updates: Partial<Omit<CustomBrandTemplate, 'id' | 'createdBy' | 'createdAt'>>,
  userId: string,
): Promise<CustomBrandTemplate | null> {
  const existing = (await kv.get(`social_ai_template:${id}`)) as CustomBrandTemplate | null;
  if (!existing) return null;
  if (existing.createdBy !== userId) throw new Error('You can only edit templates you created');
  const updated: CustomBrandTemplate = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(`social_ai_template:${id}`, updated);
  log.info('Custom brand template updated', { id, name: updated.name });
  return updated;
}

export async function deleteCustomTemplate(id: string, userId: string): Promise<boolean> {
  const existing = (await kv.get(`social_ai_template:${id}`)) as CustomBrandTemplate | null;
  if (!existing) return false;
  if (existing.createdBy !== userId) throw new Error('You can only delete templates you created');
  await kv.del(`social_ai_template:${id}`);
  log.info('Custom brand template deleted', { id, name: existing.name });
  return true;
}

export async function listCustomTemplates(userId: string): Promise<CustomBrandTemplate[]> {
  const allRecords = await kv.getByPrefix('social_ai_template:');
  if (!allRecords || allRecords.length === 0) return [];
  return (allRecords as CustomBrandTemplate[])
    .filter((t) => t.createdBy === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

// ===========================================================================
// AI ANALYTICS (Phase 3+)
// ===========================================================================

export async function getAIAnalytics(userId: string) {
  const [textRecords, imageRecords, bundleRecords] = await Promise.all([
    kv.getByPrefix('social_ai_generation:'),
    kv.getByPrefix('social_ai_image:'),
    kv.getByPrefix('social_ai_bundle:'),
  ]);

  const userText = ((textRecords || []) as AIGenerationRecord[]).filter(
    (r) => r.createdBy === userId,
  );
  const userImages = ((imageRecords || []) as AIImageRecord[]).filter(
    (r) => r.createdBy === userId,
  );
  const userBundles = ((bundleRecords || []) as AIBundleRecord[]).filter(
    (r) => r.createdBy === userId,
  );

  const platformBreakdown: Record<string, number> = {};
  const toneBreakdown: Record<string, number> = {};
  const goalBreakdown: Record<string, number> = {};
  const styleBreakdown: Record<string, number> = {};

  for (const rec of userText) {
    for (const p of rec.input.platforms) platformBreakdown[p] = (platformBreakdown[p] || 0) + 1;
    toneBreakdown[rec.input.tone] = (toneBreakdown[rec.input.tone] || 0) + 1;
    goalBreakdown[rec.input.goal] = (goalBreakdown[rec.input.goal] || 0) + 1;
  }
  for (const rec of userImages) {
    platformBreakdown[rec.input.platform] = (platformBreakdown[rec.input.platform] || 0) + 1;
    styleBreakdown[rec.input.style] = (styleBreakdown[rec.input.style] || 0) + 1;
  }
  for (const rec of userBundles) {
    for (const p of rec.input.text.platforms)
      platformBreakdown[p] = (platformBreakdown[p] || 0) + 1;
    toneBreakdown[rec.input.text.tone] = (toneBreakdown[rec.input.text.tone] || 0) + 1;
    goalBreakdown[rec.input.text.goal] = (goalBreakdown[rec.input.text.goal] || 0) + 1;
    styleBreakdown[rec.input.image.style] = (styleBreakdown[rec.input.image.style] || 0) + 1;
  }

  // Daily activity (last 30 days)
  const now = Date.now();
  const dailyMap: Record<string, { text: number; image: number; bundle: number }> = {};
  for (let d = 0; d < 30; d++) {
    const date = new Date(now - d * 86400000).toISOString().slice(0, 10);
    dailyMap[date] = { text: 0, image: 0, bundle: 0 };
  }
  for (const r of userText) {
    const d = r.createdAt.slice(0, 10);
    if (dailyMap[d]) dailyMap[d].text++;
  }
  for (const r of userImages) {
    const d = r.createdAt.slice(0, 10);
    if (dailyMap[d]) dailyMap[d].image++;
  }
  for (const r of userBundles) {
    const d = r.createdAt.slice(0, 10);
    if (dailyMap[d]) dailyMap[d].bundle++;
  }

  const dailyActivity = Object.entries(dailyMap)
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Recent generations (last 20)
  const allRecent: Array<{
    id: string;
    type: string;
    topic?: string;
    platforms?: string[];
    createdAt: string;
  }> = [];
  for (const r of userText)
    allRecent.push({
      id: r.id,
      type: 'text',
      topic: r.input.topic,
      platforms: r.input.platforms,
      createdAt: r.createdAt,
    });
  for (const r of userImages)
    allRecent.push({
      id: r.id,
      type: 'image',
      topic: r.input.topic || r.input.subject,
      platforms: [r.input.platform],
      createdAt: r.createdAt,
    });
  for (const r of userBundles)
    allRecent.push({
      id: r.id,
      type: 'bundle',
      topic: r.input.text.topic,
      platforms: r.input.text.platforms,
      createdAt: r.createdAt,
    });
  allRecent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    totalTextGenerations: userText.length,
    totalImageGenerations: userImages.length,
    totalBundleGenerations: userBundles.length,
    totalGenerations: userText.length + userImages.length + userBundles.length,
    platformBreakdown,
    toneBreakdown,
    goalBreakdown,
    styleBreakdown,
    dailyActivity,
    recentGenerations: allRecent.slice(0, 20),
  };
}
