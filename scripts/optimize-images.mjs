import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PROJECT_ROOT = path.resolve(process.cwd());
const SRC_DIR = path.join(PROJECT_ROOT, 'src', 'assets');
const OUT_DIR = path.join(PROJECT_ROOT, 'public', 'img', 'optimized');

/**
 * Keep this list small and intentional: only images used on public pages that
 * materially affect LCP/scrolling.
 */
const TARGETS = [
  // Navbar mega-menu panel images (portrait cards on the left of each dropdown)
  { hash: 'Services', label: 'services-menu', key: 'services-menu' },
  { hash: 'Solutions', label: 'solutions-menu', key: 'solutions-menu' },
  { hash: 'Company', label: 'company-menu', key: 'company-menu' },

  // Home / Services cards (very large Figma exports)
  { hash: 'fc6a85769d1248cdde73b1d2252674e730f0655a', label: 'investment-consultation' },
  { hash: '482a45127e501f4b3cecd244241cff6024f47011', label: 'estate-planning' },
  { hash: 'dc2935371f93dc2f6da2f85cfa093001ca172d63', label: 'employee-benefits' },
  { hash: '0e2b917f64eba502a24068ea5244bd25b0dfc9d5', label: 'medical-aid' },
  { hash: '8a93f2fa219696290136738d0dc439f43b6c6235', label: 'risk-management-family' },

  // Services cards that also act as hero images
  { hash: 'b0b37f186d8c48117bede379a79e329626b6ac95', label: 'retirement-planning' },
  { hash: '7f33deddff0f6240cb18dcef045f830436c30355', label: 'tax-planning' },
  { hash: '1f32a99aadd795f3c7f5c530f916c758d6ccb6f0', label: 'financial-planning' },

  // Service page hero images (LCP)
  { hash: '7f39ab25c8d51c8647ca73dc5c9126b4df46a0c6', label: 'investment-hero' },
  { hash: 'b6c49e3128a8d7c0869121962a0c8a9836a4fef6', label: 'retirement-hero' },
  { hash: '5c0f670827aa0d401dd409a6c603459c23b5c4a3', label: 'estate-hero' },
  { hash: 'f9768bc43fd98373704bc54f70b3ea6ec0c8f020', label: 'risk-hero' },
  { hash: 'd0fa22ed135e395dabc605d8378a0fbcd5642ed7', label: 'medical-hero' },
  { hash: 'e687c01861aee919fa24cf06bfbd5e069af5249c', label: 'employee-benefits-hero' },
];

// Responsive widths to generate. Should cover mobile → desktop cards/hero.
const WIDTHS = [480, 768, 1024, 1440];

/**
 * Discover extra variants to build FROM THE `imageKey` REFERENCES in the app,
 * not from figma imports.
 *
 * Three iterations, and the middle one is the instructive failure:
 *
 *  1. Originally this scanned only `src/components/pages/*Page.tsx`. Six of the
 *     seventeen files importing `figma:asset` are not named `*Page.tsx` --
 *     including `homePageData.tsx`, which carries the home page service cards.
 *  2. So it was widened to walk all of `src/`. That over-corrected: the walk
 *     finds every figma import, and 16 of them (the provider logos) are
 *     rendered through the ordinary <img> path and never referenced by an
 *     `imageKey`. Building them would have emitted 128 unreferenced files into
 *     `public/` and the manifest -- inflating exactly the deployed weight this
 *     work exists to reduce.
 *  3. What actually determines whether a variant is ever fetched is an
 *     `imageKey`, because `ResponsiveImage` is only reachable through one. So
 *     that is what is scanned for.
 *
 * This pairs with `src/utils/__tests__/optimized-image-coverage.test.ts`: the
 * test asserts every referenced key has its variants on disk, and this builds
 * variants for exactly the referenced keys. Adding an `imageKey` is what asks
 * for generation; nothing else does.
 *
 * Non-hash keys (`tax-planning`, `services-menu`) are curated in TARGETS above,
 * which maps them to a source hash. Only 40-char hex keys are resolvable
 * directly, so only those are discovered here.
 */
async function collectSourceFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      out.push(...(await collectSourceFiles(full)));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }

  return out;
}

async function discoverFigmaAssetPngHashes() {
  const files = await collectSourceFiles(path.join(PROJECT_ROOT, 'src'));

  const curated = new Set(TARGETS.map((t) => t.key ?? t.label));
  const hashes = new Set();
  const re = /imageKey:\s*['"]([a-f0-9]{40})['"]/gi;

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    let m;

    while ((m = re.exec(content))) {
      const key = m[1].toLowerCase();
      if (!curated.has(key)) hashes.add(key);
    }
  }

  return Array.from(hashes);
}

function srcPathForHash(hash) {
  // Figma assets appear to exist as .png and .jpg variants; prioritize .png.
  return path.join(SRC_DIR, `${hash}.png`);
}

function outBase(label) {
  return label.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function buildOne({ hash, label, key }) {
  const input = srcPathForHash(hash);
  if (!(await fileExists(input))) {
    throw new Error(`Missing source image: ${path.relative(PROJECT_ROOT, input)}`);
  }

  const base = outBase(key ?? label);
  const outManifest = {
    key: base,
    source: path.relative(PROJECT_ROOT, input).replaceAll('\\', '/'),
    outputs: [],
  };

  const image = sharp(input, { failOn: 'none' }).rotate();

  for (const width of WIDTHS) {
    const avifOut = path.join(OUT_DIR, `${base}-${width}.avif`);
    const webpOut = path.join(OUT_DIR, `${base}-${width}.webp`);

    // AVIF: visually-lossless-ish, still much smaller than PNG.
    await image
      .clone()
      .resize({ width, withoutEnlargement: true })
      .avif({ quality: 65, effort: 6 })
      .toFile(avifOut);

    // WebP fallback for browsers without AVIF.
    await image
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(webpOut);

    outManifest.outputs.push(
      { format: 'avif', width, path: path.relative(PROJECT_ROOT, avifOut).replaceAll('\\', '/') },
      { format: 'webp', width, path: path.relative(PROJECT_ROOT, webpOut).replaceAll('\\', '/') },
    );
  }

  return outManifest;
}

async function main() {
  await ensureDir(OUT_DIR);

  const discovered = await discoverFigmaAssetPngHashes();
  const discoveredTargets = discovered.map((hash) => ({ hash, label: `figma-${hash}`, key: hash }));

  // De-duplicate by output key.
  const allTargets = [...TARGETS, ...discoveredTargets];
  const seenKeys = new Set();
  const manifests = [];

  for (const t of allTargets) {
    const outKey = outBase(t.key ?? t.label);
    if (seenKeys.has(outKey)) continue;
    seenKeys.add(outKey);

    console.log(`Optimizing ${t.label} (${t.hash})...`);
    manifests.push(await buildOne(t));
  }

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify({ widths: WIDTHS, images: manifests }, null, 2));

  console.log(`Wrote ${path.relative(PROJECT_ROOT, manifestPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
