/**
 * A7 — Figma asset WebP pre-build step.
 *
 * The problem this closes: `src/assets` holds 811 MB of raw Figma exports that
 * are reachable from `figma:asset/<name>` imports, so Vite emits every one of
 * them into `dist/`. They are camera-resolution files — the largest is
 * 8256x5504 (45 megapixels, 31 MB) — rendered into cards and heroes that are
 * never wider than about 1440 CSS px. Users on South African mobile data were
 * downloading tens of megabytes per page.
 *
 * `vite.config.ts`'s `figmaAssetResolver` has always preferred a `.webp`
 * sibling over the original. Nothing ever generated one, so that branch was
 * dead code and every import fell through to the raw file. This script is the
 * missing half: it emits exactly the `<name>.webp` the resolver looks for.
 *
 * Where the output goes: `node_modules/.cache/figma-webp/`. That keeps
 * generated binaries out of a `.git` that is already ~892 MB (the roadmap is
 * explicit about not committing more), and it is one of the few directories
 * Vercel persists between builds, so the expensive resize is paid once rather
 * than on every deploy.
 *
 * A COLD OR FAILED CACHE IS NOT A CORRECTNESS PROBLEM, and it is not a 31 MB
 * one either. The resolver falls through this cache to the optimized siblings
 * already committed beside the originals (`<hash>.jpg`, ~300 KB) and only then
 * to the original itself, so the worst case for the 62 assets that have a
 * sibling is a 300 KB JPEG rather than a camera-scale PNG. That ladder is
 * asserted by `src/__tests__/figma-asset-weight.test.ts`, which deliberately
 * measures the cold path.
 *
 * Note the extensions lie: every file here is named `.png`, but 65 of the 84
 * carry JPEG data. The remaining 19 are genuine PNGs — the provider logos,
 * 16 of which have real transparency that must survive the encode. Nothing may
 * branch on the extension; sharp sniffs the real format from content, so that
 * is the only thing consulted, and alpha is verified below rather than assumed.
 *
 * Usage:
 *   node ./scripts/build/generate-figma-webp.mjs           # generate (incremental)
 *   node ./scripts/build/generate-figma-webp.mjs --force   # ignore the cache
 *   node ./scripts/build/generate-figma-webp.mjs --check   # verify, generate nothing
 */

import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const PROJECT_ROOT = process.cwd();
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const ASSET_DIR = path.join(SRC_DIR, 'assets');
export const CACHE_DIR = path.join(PROJECT_ROOT, 'node_modules', '.cache', 'figma-webp');
const MANIFEST_PATH = path.join(CACHE_DIR, 'manifest.json');

/**
 * The widest these assets are ever painted is a full-bleed hero on a large
 * desktop; 1920 covers that with headroom for a 2x phone and 1.5x laptop,
 * which is where the real traffic is. Anything already narrower is left at its
 * own width rather than upscaled.
 */
const MAX_WIDTH = 1920;
const WEBP_QUALITY = 82;

/**
 * Hard ceiling for any single emitted image, matching the A7 gate. One asset
 * (a dense, high-frequency photograph) lands at 764 KB from the default pass,
 * so quality alone is not enough to hold a budget across arbitrary future
 * exports. The ladder below is walked until an attempt fits, which makes the
 * ceiling a property of the pipeline rather than of the current 68 files.
 */
const MAX_OUTPUT_BYTES = 500 * 1024;

/**
 * Tried in order, first result under budget wins. Quality is spent before
 * resolution: at these sizes WebP artefacts are far less visible than a soft
 * downscale, and the last rung still renders sharply on a 1x desktop hero.
 */
const ENCODE_LADDER = [
  { width: MAX_WIDTH, quality: WEBP_QUALITY },
  { width: MAX_WIDTH, quality: 72 },
  { width: 1600, quality: 68 },
  { width: 1440, quality: 62 },
];

const FORCE = process.argv.includes('--force');
const CHECK_ONLY = process.argv.includes('--check');

/** Source extensions we will read. The names lie about format; sharp decides. */
const SOURCE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

/**
 * Walks the app's TypeScript sources looking for import specifiers.
 *
 * `src/assets` is skipped because it holds the binaries, not code. It is
 * skipped BY PATH, not by directory name: `src/components/shared/assets/`
 * exists too, and it is where `provider-logos.ts` imports all sixteen provider
 * logos. A name-based skip swallows that file, the sixteen logos never get a
 * WebP, and they fall through to raw PNG with nothing reporting a problem —
 * the run just says "68 built" instead of "84" and looks perfectly healthy.
 */
async function collectSourceFiles(dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (full === ASSET_DIR) continue;
    if (entry.isDirectory()) await collectSourceFiles(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/**
 * Collects the `figma:asset/<name>` specifiers the app actually imports.
 * Generating for anything else would put weight back into `dist/` that this
 * script exists to remove.
 */
async function discoverReferencedAssets() {
  const files = await collectSourceFiles(SRC_DIR);
  const referenced = new Set();
  const re = /figma:asset\/([A-Za-z0-9._-]+)/g;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    let match;
    while ((match = re.exec(content))) referenced.add(match[1]);
  }
  return referenced;
}

async function readManifest() {
  if (FORCE) return {};
  try {
    return JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Cache key covers the source bytes and every setting that changes the output,
 * so bumping the ladder or the ceiling invalidates prior results rather than
 * silently serving stale renders.
 *
 * Keyed on file *contents*, deliberately, not mtime: git does not preserve
 * mtimes, so every CI and Vercel build starts from a fresh checkout where all
 * timestamps are new. An mtime-based key would miss on all 68 assets on every
 * deploy and regenerate them, which is exactly the cost the persistent cache
 * exists to avoid. Hashing all 852 MB streams through in ~1.7 s, against ~27 s
 * to re-encode, so contents are both the correct key and the cheaper one.
 */
async function cacheKey(source, stat) {
  const hash = createHash('sha1');
  await pipeline(createReadStream(source), hash);
  return createHash('sha1')
    .update(
      `${hash.digest('hex')}:${stat.size}:${JSON.stringify(ENCODE_LADDER)}:${MAX_OUTPUT_BYTES}`,
    )
    .digest('hex');
}

async function processOne(name, manifest) {
  const source = path.join(ASSET_DIR, name);
  let stat;
  try {
    stat = await fs.stat(source);
  } catch {
    // A specifier with no file behind it: a placeholder in a doc comment, or an
    // asset deleted while its import lingered. The resolver falls back to the
    // original path and Vite reports it far better than we could.
    return { name, status: 'missing' };
  }

  const outPath = path.join(CACHE_DIR, `${path.parse(name).name}.webp`);
  const key = await cacheKey(source, stat);

  if (manifest[name]?.key === key) {
    try {
      const out = await fs.stat(outPath);
      return { name, status: 'cached', sourceBytes: stat.size, outBytes: out.size, key };
    } catch {
      // Manifest entry survived but the file did not; fall through and rebuild.
    }
  }

  if (CHECK_ONLY) return { name, status: 'stale', sourceBytes: stat.size };

  const { width: sourceWidth, hasAlpha } = await sharp(source).metadata();

  /**
   * Whether the source has transparency that MATTERS.
   *
   * `hasAlpha` alone is the wrong question: two of the PNGs here carry a
   * channel in which every pixel is 255, and libwebp correctly drops a
   * redundant channel to save bytes. Asserting on `hasAlpha` would fail those
   * two for a change with no visual effect, and the usual response to a
   * false alarm is to delete the check. `stats().isOpaque` asks the question
   * that matters — is any pixel actually see-through — so what is verified
   * below is the thing a user would notice: a logo that used to sit on the
   * card losing its background and turning into a white box.
   */
  const needsAlpha = hasAlpha ? !(await sharp(source).stats()).isOpaque : false;

  let info;
  let rung = 0;
  for (const [index, step] of ENCODE_LADDER.entries()) {
    rung = index;
    info = await sharp(source, { failOn: 'none' })
      .rotate() // honour EXIF orientation before resizing
      .resize({
        width: Math.min(sourceWidth ?? step.width, step.width),
        withoutEnlargement: true,
      })
      .webp({ quality: step.quality })
      .toFile(outPath);
    if (info.size <= MAX_OUTPUT_BYTES) break;
  }

  const lostAlpha = needsAlpha && !(await sharp(outPath).metadata()).hasAlpha;

  return {
    name,
    status: 'built',
    sourceBytes: stat.size,
    outBytes: info.size,
    key,
    rung,
    lostAlpha,
  };
}

/** Bounded pool: sharp is native and parallel, but 84 concurrent 45MP decodes would thrash. */
async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await worker(items[i]);
      }
    }),
  );
  return results;
}

const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

async function main() {
  const referenced = [...(await discoverReferencedAssets())]
    .filter((name) => SOURCE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort();

  if (referenced.length === 0) {
    console.log('figma-webp: no figma:asset imports found — nothing to do.');
    return;
  }

  await fs.mkdir(CACHE_DIR, { recursive: true });
  const manifest = await readManifest();

  const concurrency = Math.max(2, Math.min(8, os.cpus().length));
  const results = await runPool(referenced, concurrency, (name) => processOne(name, manifest));

  const built = results.filter((r) => r.status === 'built');
  const cached = results.filter((r) => r.status === 'cached');
  const missing = results.filter((r) => r.status === 'missing');
  const stale = results.filter((r) => r.status === 'stale');

  if (CHECK_ONLY) {
    console.log(
      `figma-webp --check: ${cached.length} current, ${stale.length} stale, ${missing.length} missing source.`,
    );
    if (stale.length > 0) {
      console.error('::error::WebP variants are stale. Run `npm run figma:webp`.');
      process.exitCode = 1;
    }
    return;
  }

  const nextManifest = {};
  for (const r of results) if (r.key) nextManifest[r.name] = { key: r.key };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(nextManifest, null, 2));

  const converted = [...built, ...cached];
  const sourceTotal = converted.reduce((s, r) => s + (r.sourceBytes ?? 0), 0);
  const outTotal = converted.reduce((s, r) => s + (r.outBytes ?? 0), 0);
  const largest = converted.reduce((m, r) => Math.max(m, r.outBytes ?? 0), 0);

  console.log(
    `figma-webp: ${built.length} built, ${cached.length} cached${
      missing.length ? `, ${missing.length} missing source` : ''
    }`,
  );
  console.log(
    `figma-webp: ${mb(sourceTotal)} of originals -> ${mb(outTotal)} of WebP ` +
      `(${sourceTotal > 0 ? (100 - (outTotal / sourceTotal) * 100).toFixed(1) : '0'}% smaller); ` +
      `largest ${(largest / 1024).toFixed(0)} KB`,
  );

  const recompressed = built.filter((r) => (r.rung ?? 0) > 0);
  if (recompressed.length > 0) {
    console.log(
      `figma-webp: ${recompressed.length} needed extra compression to fit the ` +
        `${MAX_OUTPUT_BYTES / 1024} KB ceiling: ` +
        recompressed.map((r) => `${r.name} (rung ${r.rung})`).join(', '),
    );
  }

  // Transparency is a correctness property, not a size one, so it fails the
  // run rather than warning. The provider logos sit on coloured cards; one that
  // loses its alpha renders as a white rectangle, which is the kind of breakage
  // that ships because everything else about the build looked fine.
  const flattened = built.filter((r) => r.lostAlpha);
  if (flattened.length > 0) {
    console.error(
      `::error::${flattened.length} image(s) lost transparency in conversion: ` +
        flattened.map((r) => r.name).join(', '),
    );
    process.exitCode = 1;
  }

  // The ladder's last rung is a floor, not a guarantee — an adversarial source
  // could still exceed the budget. Say so loudly rather than letting it slip
  // into dist and quietly bust the A7 gate downstream.
  const over = converted.filter((r) => (r.outBytes ?? 0) > MAX_OUTPUT_BYTES);
  if (over.length > 0) {
    console.error(
      `::error::${over.length} image(s) exceed the ${MAX_OUTPUT_BYTES / 1024} KB ceiling: ` +
        over.map((r) => `${r.name} (${(r.outBytes / 1024).toFixed(0)} KB)`).join(', '),
    );
    process.exitCode = 1;
  }

  if (missing.length > 0) {
    console.log(`figma-webp: no source for ${missing.map((r) => r.name).join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
