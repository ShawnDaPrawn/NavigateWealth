#!/usr/bin/env node
/**
 * Bundle-size budget checker (Stage A / F6).
 *
 * Measures the production build in `dist/` and compares each metric against the
 * committed floor in `.bundle-size-baseline.json`. Run after `npm run build`:
 *
 *   npm run build && npm run bundle:check
 *
 * Why this exists: nothing measured build output, so weight could grow
 * invisibly. The first honest run found a 2.0 MB eager entry graph that
 * includes a rich-text editor (`vendor-tiptap`) and a PDF generator
 * (`vendor-jspdf`) — admin-only tooling every marketing-page visitor
 * downloads — plus 812 MB of raw PNGs emitted from `src/assets`.
 *
 * Metrics, most user-visible first:
 *
 *   entryBytes      Entry script + its modulepreload graph + entry CSS. This is
 *                   what EVERY visitor downloads before the app renders, so it
 *                   is the metric that matters most.
 *   entryGzipBytes  The same set, gzipped — closer to real transfer cost.
 *   totalJsBytes    All JS in dist/assets (lazy chunks included).
 *   largestChunk    Biggest single JS chunk.
 *   imageBytes      All images in dist. Dominated by the raw-PNG problem (A7).
 *   totalDistBytes  Everything shipped.
 *
 * Comparison uses TOLERANCE_PCT headroom rather than exact bytes: content
 * hashes and ordinary feature work move these numbers by a few KB, and a
 * zero-tolerance gate would fail on noise and get disabled. The headroom is
 * small enough that a newly-eager vendor chunk (hundreds of KB) still trips it.
 *
 * Exit codes: 0 = within budget, 1 = a metric exceeded its floor, 2 = the
 * build output or baseline could not be read (fails CLOSED — a missing dist/
 * must never look like a pass).
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const BASELINE_FILE = path.join(ROOT, '.bundle-size-baseline.json');

/** Headroom before a rise is treated as a regression. */
const TOLERANCE_PCT = 5;
/** Suggest re-baselining once a metric falls this far below its floor. */
const TIGHTEN_PCT = 5;

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg']);

function fail(message) {
  console.error(`[bundle-size] ${message}`);
  process.exit(2);
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function sizeOf(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/**
 * The eager entry graph: the entry <script>, every <link rel="modulepreload">,
 * and every entry stylesheet. These are the requests a first-time visitor makes
 * before anything renders.
 */
function collectEntryAssets(html) {
  const hrefs = new Set();

  const script = html.match(/<script[^>]+src="(\/assets\/[^"]+)"/);
  if (script) hrefs.add(script[1]);

  for (const m of html.matchAll(/rel="modulepreload"[^>]*href="(\/assets\/[^"]+)"/g)) {
    hrefs.add(m[1]);
  }
  // Attribute order is not guaranteed — also match href-before-rel.
  for (const m of html.matchAll(/href="(\/assets\/[^"]+)"[^>]*rel="modulepreload"/g)) {
    hrefs.add(m[1]);
  }
  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="(\/assets\/[^"]+)"/g)) {
    hrefs.add(m[1]);
  }
  for (const m of html.matchAll(/<link[^>]+href="(\/assets\/[^"]+\.css)"/g)) {
    hrefs.add(m[1]);
  }

  return [...hrefs];
}

function measure() {
  const indexHtml = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    fail(`dist/index.html not found — run \`npm run build\` first. Looked in ${DIST}`);
  }

  const html = fs.readFileSync(indexHtml, 'utf8');
  const entryHrefs = collectEntryAssets(html);
  if (entryHrefs.length === 0) {
    fail(
      'Could not identify any entry assets in dist/index.html — the markup shape may have changed.',
    );
  }

  let entryBytes = 0;
  let entryGzipBytes = 0;
  const entryDetail = [];
  for (const href of entryHrefs) {
    const file = path.join(DIST, href.replace(/^\//, ''));
    const size = sizeOf(file);
    entryBytes += size;
    try {
      entryGzipBytes += zlib.gzipSync(fs.readFileSync(file)).length;
    } catch {
      /* unreadable file already counted as 0 */
    }
    entryDetail.push({ href, size });
  }

  const allFiles = walk(DIST);
  const jsFiles = allFiles.filter((f) => f.endsWith('.js'));
  const totalJsBytes = jsFiles.reduce((sum, f) => sum + sizeOf(f), 0);
  const largestChunkBytes = jsFiles.reduce((max, f) => Math.max(max, sizeOf(f)), 0);
  const imageBytes = allFiles
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .reduce((sum, f) => sum + sizeOf(f), 0);
  const totalDistBytes = allFiles.reduce((sum, f) => sum + sizeOf(f), 0);

  entryDetail.sort((a, b) => b.size - a.size);

  return {
    metrics: {
      entryBytes,
      entryGzipBytes,
      totalJsBytes,
      largestChunkBytes,
      imageBytes,
      totalDistBytes,
    },
    entryDetail,
  };
}

const { metrics, entryDetail } = measure();

if (process.argv.includes('--write-baseline')) {
  const payload = {
    _comment:
      'Bundle-size floors for scripts/check-bundle-size.mjs (Stage A / F6). ' +
      'Regenerate with `npm run bundle:check -- --write-baseline` after an ' +
      'intentional size change, and say why in the commit message.',
    _tolerancePct: TOLERANCE_PCT,
    ...metrics,
  };
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`[bundle-size] baseline written to ${path.relative(ROOT, BASELINE_FILE)}`);
  for (const [key, value] of Object.entries(metrics)) {
    console.log(`  ${key.padEnd(18)} ${formatBytes(value)}`);
  }
  process.exit(0);
}

if (!fs.existsSync(BASELINE_FILE)) {
  fail(
    `${path.relative(ROOT, BASELINE_FILE)} not found — create it with ` +
      '`npm run bundle:check -- --write-baseline`',
  );
}

let baseline;
try {
  baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
} catch (error) {
  fail(`Could not parse ${path.relative(ROOT, BASELINE_FILE)}: ${error.message}`);
}

console.log('Top eager entry assets (downloaded by every visitor):');
for (const { href, size } of entryDetail.slice(0, 6)) {
  console.log(`  ${formatBytes(size).padStart(10)}  ${href}`);
}
console.log('');

let failed = false;
for (const [key, actual] of Object.entries(metrics)) {
  const floor = baseline[key];
  if (typeof floor !== 'number') {
    console.log(`  ${key.padEnd(18)} ${formatBytes(actual).padStart(10)}  (no floor recorded)`);
    continue;
  }
  const ceiling = Math.round(floor * (1 + TOLERANCE_PCT / 100));
  const delta = actual - floor;
  const pct = floor === 0 ? 0 : (delta / floor) * 100;
  const sign = delta >= 0 ? '+' : '';
  const status = actual > ceiling ? 'OVER' : 'ok';

  console.log(
    `  ${key.padEnd(18)} ${formatBytes(actual).padStart(10)}  floor ${formatBytes(floor).padStart(10)}  ` +
      `(${sign}${pct.toFixed(1)}%)  ${status}`,
  );

  if (actual > ceiling) {
    console.error(
      `::error::Bundle metric "${key}" grew to ${formatBytes(actual)}, over its ` +
        `${formatBytes(ceiling)} ceiling (floor ${formatBytes(floor)} + ${TOLERANCE_PCT}% headroom). ` +
        'A large dependency was probably pulled into an eagerly-loaded chunk — check whether it can be ' +
        'lazy-loaded via React.lazy or a dynamic import(). If the growth is intentional, re-baseline with ' +
        '`npm run bundle:check -- --write-baseline` and justify it in the commit message.',
    );
    failed = true;
  } else if (floor > 0 && actual < floor * (1 - TIGHTEN_PCT / 100)) {
    console.log(
      `::notice::Bundle metric "${key}" dropped to ${formatBytes(actual)} (floor ${formatBytes(floor)}) — ` +
        'tighten the ratchet with `npm run bundle:check -- --write-baseline`.',
    );
  }
}

process.exit(failed ? 1 : 0);
