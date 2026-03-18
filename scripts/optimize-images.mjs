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

async function discoverFigmaAssetPngHashes() {
  const pagesDir = path.join(PROJECT_ROOT, 'src', 'components', 'pages');
  const entries = await fs.readdir(pagesDir, { withFileTypes: true });
  const pageFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('Page.tsx'))
    .map((e) => path.join(pagesDir, e.name));

  const hashes = new Set();
  const re = /figma:asset\/([a-f0-9]{40})\.png/g;

  for (const filePath of pageFiles) {
    const content = await fs.readFile(filePath, 'utf8');
    let m;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(content))) {
      hashes.add(m[1]);
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

    // eslint-disable-next-line no-console
    console.log(`Optimizing ${t.label} (${t.hash})...`);
    manifests.push(await buildOne(t));
  }

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify({ widths: WIDTHS, images: manifests }, null, 2));
  // eslint-disable-next-line no-console
  console.log(`Wrote ${path.relative(PROJECT_ROOT, manifestPath)}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

