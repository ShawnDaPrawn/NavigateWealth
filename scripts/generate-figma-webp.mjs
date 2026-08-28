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
 * than on every deploy. Losing the cache is never a correctness problem — a
 * cold run just regenerates.
 *
 * Note the extensions lie: every file here is named `.png` but 84 of 84 carry
 * JPEG data. Nothing may branch on the extension; sharp sniffs the real format
 * from content, so it is the only thing consulted.
 *
 * Usage:
 *   node ./scripts/generate-figma-webp.mjs           # generate (incremental)
 *   node ./scripts/generate-figma-webp.mjs --force   # ignore the cache
 *   node ./scripts/generate-figma-webp.mjs --check   # verify, generate nothing
 */

import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
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

async function collectSourceFiles(dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'assets') continue;
    const full = path.join(dir, entry.name);
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
 * so bumping MAX_WIDTH or the quality invalidates prior results rather than
 * silently serving stale renders.
 */
function cacheKey(stat) {
  return createHash('sha1')
    .update(`${stat.size}:${stat.mtimeMs}:${JSON.stringify(ENCODE_LADDER)}:${MAX_OUTPUT_BYTES}`)
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
  const key = cacheKey(stat);

  if (manifest[name]?.key === key) {
    try {
      const out = await fs.stat(outPath);
      return { name, status: 'cached', sourceBytes: stat.size, outBytes: out.size, key };
    } catch {
      // Manifest entry survived but the file did not; fall through and rebuild.
    }
  }

  if (CHECK_ONLY) return { name, status: 'stale', sourceBytes: stat.size };

  const { width: sourceWidth } = await sharp(source).metadata();

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

  return { name, status: 'built', sourceBytes: stat.size, outBytes: info.size, key, rung };
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
