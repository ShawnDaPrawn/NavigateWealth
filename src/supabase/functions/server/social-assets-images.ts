/**
 * Social automation — image rendering (brand prompt → DALL-E 3 → public bucket).
 *
 * The one thing a text model cannot do for the pipeline. The scheduling
 * routine asks for an image by writing `image_brief` on an asset; the render
 * job in social-assets-service.ts calls this and stores the public URL.
 */

import { createModuleLogger } from './stderr-logger.ts';
import {
  buildBrandedImagePrompt,
  callDALLE,
  dalleSizeForPlatform,
  type GenerateImageInput,
  type ImageStyle,
} from './social-media-ai-images.ts';
import { uploadPublicImage } from './social-assets-storage.ts';
import type { SocialChannel } from './social-assets-types.ts';

const log = createModuleLogger('social-assets-images');

export interface RenderAssetImageInput {
  channel: SocialChannel;
  brief: string;
  style: ImageStyle | null;
  topic: string;
  storagePath: string;
  quality?: 'standard' | 'hd';
}

export interface RenderedAssetImage {
  storagePath: string;
  publicUrl: string;
  revisedPrompt: string;
  dimensions: string;
}

/**
 * The brand rules (palette, "no text in the image", "no clichés") come from
 * the same builder the AI generator uses, so a routine's brief is rendered the
 * way an admin's would be.
 */
export async function renderAssetImage(input: RenderAssetImageInput): Promise<RenderedAssetImage> {
  const generateInput: GenerateImageInput = {
    platform: input.channel,
    subject: input.brief,
    style: input.style ?? 'editorial',
    topic: input.topic,
    quality: input.quality ?? 'standard',
  };
  const prompt = await buildBrandedImagePrompt(generateInput);
  const size = dalleSizeForPlatform(input.channel);
  const { url, revisedPrompt } = await callDALLE(prompt, size, generateInput.quality);
  const publicUrl = await uploadPublicImage(url, input.storagePath);
  log.success('Rendered social asset image', { storagePath: input.storagePath, size });
  return { storagePath: input.storagePath, publicUrl, revisedPrompt, dimensions: size };
}
