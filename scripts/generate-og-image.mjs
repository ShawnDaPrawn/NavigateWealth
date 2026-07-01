/**
 * Generates the Open Graph / social-share image at the exact 1200x630 size
 * social platforms expect (the older navigate-wealth-social.png is a 1780px
 * square kept for logo/sitemap use). Run once and commit the artifact:
 *
 *   node ./scripts/generate-og-image.mjs
 *
 * Composition: white reversed logo + tagline centered on the brand navy
 * (#0B1220, matching the site's theme-color) with comfortable margins.
 */
import path from 'node:path';
import sharp from 'sharp';

const assetsDir = path.resolve('public/brand-assets');
const SOURCE = path.join(assetsDir, 'navigate-wealth-reversed-tagline.png');
const OUTPUT = path.join(assetsDir, 'navigate-wealth-og.png');

const WIDTH = 1200;
const HEIGHT = 630;
const BRAND_NAVY = { r: 11, g: 18, b: 32, alpha: 1 }; // #0B1220
const LOGO_MAX_WIDTH = 960;
const LOGO_MAX_HEIGHT = 300;

async function main() {
  const logo = await sharp(SOURCE)
    .resize(LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: BRAND_NAVY },
  })
    .composite([{ input: logo, gravity: 'center' }])
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
