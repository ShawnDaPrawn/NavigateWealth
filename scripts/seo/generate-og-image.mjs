/**
 * Generates the Open Graph / social-share image at the exact 1200x630 size
 * social platforms expect (the older navigate-wealth-social.png is a 1780px
 * square kept for logo/sitemap use). Run once and commit the artifact:
 *
 *   node ./scripts/seo/generate-og-image.mjs
 *
 * Composition: the clean white horizontal lockup (boat icon + wordmark)
 * centered on the brand navy (#0B1220, matching the site's theme-color) with
 * comfortable margins.
 *
 * NOTE: the source is the correctly-aligned horizontal lockup, NOT the
 * `-reversed-tagline` art. That tagline lockup has the boat icon overlapping
 * the "IN" of "INDEPENDENT" and sits off-centre in a wide canvas, which
 * produced a broken, shifted preview on WhatsApp/social shares.
 */
import path from 'node:path';
import sharp from 'sharp';

const assetsDir = path.resolve('public/brand-assets');
const SOURCE = path.join(assetsDir, 'navigate-wealth-lockup-horizontal-white.png');
const OUTPUT = path.join(assetsDir, 'navigate-wealth-og.png');

const WIDTH = 1200;
const HEIGHT = 630;
const BRAND_NAVY = { r: 11, g: 18, b: 32, alpha: 1 }; // #0B1220
const LOGO_WIDTH = 760; // centered with generous horizontal margins

async function main() {
  // The lockup ships as white art on a black background (no alpha). Trim the
  // surrounding black, scale to the target width, then composite with a
  // "lighten" blend so the remaining black drops out and only the white
  // artwork shows on the navy canvas.
  const logo = await sharp(SOURCE)
    .trim()
    .resize({
      width: LOGO_WIDTH,
      fit: 'inside',
      kernel: sharp.kernel.lanczos3,
    })
    .toBuffer();

  await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: BRAND_NAVY },
  })
    .composite([{ input: logo, gravity: 'center', blend: 'lighten' }])
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true })
    .toFile(OUTPUT);

  const { size } = await sharp(OUTPUT)
    .metadata()
    .then(async (m) => ({
      size: (await import('node:fs')).statSync(OUTPUT).size,
      ...m,
    }));
  console.log(`Wrote ${OUTPUT} (${WIDTH}x${HEIGHT}, ${(size / 1024).toFixed(0)} KB)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
