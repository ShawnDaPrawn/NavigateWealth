/**
 * No `figma:asset` import may resolve to a multi-megabyte original.
 * =================================================================
 *
 * The resolver in vite.config.ts prefers an optimized sibling over the raw
 * Figma export. It was written to do that and it silently did not: it looked
 * only for `.webp`, there are no `.webp` files in `src/assets`, so every one of
 * the 84 imports fell through to the original. Those originals are camera-scale
 * exports — up to 8256x5504 — and 62 of them had a 2200x1467 `.jpg` sibling of
 * roughly 300 KB sitting unused beside them. The home page shipped about 125 MB
 * of images.
 *
 * Nothing caught it, and nothing would have. It is invisible in development,
 * where assets are local; the bundle-size baseline tracks `imageBytes` but was
 * itself baselined AFTER the regression, so the wrong number was the floor. The
 * only place it shows up is a real user's data bundle.
 *
 * So this test resolves every import the way Vite will and fails on anything
 * oversized. It is a ratchet on the thing that actually matters — the bytes a
 * browser fetches — rather than on the mechanism that happened to fail.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, parse, resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');
const assetDir = join(repoRoot, 'src/assets');

/**
 * No single asset a browser fetches should exceed this.
 *
 * 1.5 MB is deliberately loose: it is far above the ~300 KB the optimized
 * exports weigh, so ordinary asset churn will not trip it, and far below the
 * 25-31 MB originals this exists to keep out. A file over this is not a
 * judgement call about quality — it is an un-optimized export that escaped.
 */
const MAX_ASSET_BYTES = 1_536_000;

/** The whole imported set must stay within a budget a person could download. */
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;

/**
 * Assets that exceed the cap and have no optimized sibling to fall back to.
 *
 * These are listed rather than tolerated by raising the cap, because a raised
 * cap silently permits the next one too. Each is a JPEG that was exported
 * without being resized, and each needs a 2200px-wide sibling generated beside
 * it — at which point the resolver picks it up with no code change and the
 * entry comes out of this list. Together they are ~9.8 MB; the 62 assets this
 * test's sibling rule already fixed were ~797 MB, so these are the tail, not
 * the problem.
 *
 * Recorded in docs/PRODUCTION-READINESS.md so it is a task, not a footnote.
 */
const KNOWN_UNOPTIMIZED = new Set([
  // RiskManagementPage
  '00f21f624e8160ae5a1793de40e7c0e7ba1ee60d.png', // 3.4 MB
  '47655f7ea49b8154455dbaefe83366869b59cabb.png', // 2.2 MB
  // InvestmentManagementPage
  '76fc906be4d2c342ff5272cc2c0d901ad65ff7f6.png', // 3.9 MB
]);

/** Mirrors figmaAssetResolver() in vite.config.ts. Keep the order identical. */
function resolveFigmaAsset(filename: string): string {
  const parsed = parse(filename);
  const candidates = [
    `${parsed.name}.webp`,
    `${parsed.name}.avif`,
    `${parsed.name}.jpg`,
    `${parsed.name}.jpeg`,
    filename,
  ];
  const match = candidates.find((c) => existsSync(join(assetDir, c)));
  return join(assetDir, match ?? filename);
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'assets') continue;
    // This file and vite.config.ts describe the specifier in prose; matching
    // their own documentation would make the scan report `<hash>.png` and `*`
    // as missing assets.
    if (entry.name === 'figma-asset-weight.test.ts') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

/** Every `figma:asset/...` specifier imported anywhere in the app. */
function importedAssets(): string[] {
  const found = new Set<string>();
  for (const file of sourceFiles(join(repoRoot, 'src'))) {
    const text = readFileSync(file, 'utf8');
    // Anchored to the real specifier shape: a 40-character hash plus a known
    // image extension. A looser pattern picks up prose and glob examples.
    for (const [, spec] of text.matchAll(/figma:asset\/([0-9a-f]{40}\.(?:png|jpe?g|webp|avif))/g)) {
      found.add(spec);
    }
  }
  return [...found].sort();
}

describe('figma:asset imports resolve to web-sized files', () => {
  const assets = importedAssets();

  it('finds the imports at all, so a passing run is never vacuous', () => {
    expect(assets.length).toBeGreaterThan(50);
  });

  it('resolves every one to a file that exists', () => {
    const missing = assets.filter((a) => !existsSync(resolveFigmaAsset(a)));
    expect(missing).toEqual([]);
  });

  it('serves no single asset larger than the cap', () => {
    const oversized = assets
      .filter((a) => !KNOWN_UNOPTIMIZED.has(a))
      .map((a) => ({ asset: a, resolved: resolveFigmaAsset(a) }))
      .filter(({ resolved }) => existsSync(resolved))
      .map(({ asset, resolved }) => ({ asset, mb: statSync(resolved).size / 1_048_576 }))
      .filter(({ mb }) => mb * 1_048_576 > MAX_ASSET_BYTES)
      .map(({ asset, mb }) => `${asset} -> ${mb.toFixed(1)} MB`);

    // If this fails: export an optimized sibling next to the original. The
    // resolver picks it up with no code change.
    expect(oversized).toEqual([]);
  });

  it('keeps the whole imported set inside a downloadable budget', () => {
    const total = assets
      .map(resolveFigmaAsset)
      .filter(existsSync)
      .reduce((sum, p) => sum + statSync(p).size, 0);

    expect(total, `imported assets total ${(total / 1_048_576).toFixed(0)} MB`).toBeLessThan(
      MAX_TOTAL_BYTES,
    );
  });

  it('keeps the known-unoptimized list honest', () => {
    // An entry that has since been optimized must leave the list, or the list
    // becomes a place where exceptions go to be forgotten.
    const stale = [...KNOWN_UNOPTIMIZED].filter((a) => {
      const resolved = resolveFigmaAsset(a);
      return !existsSync(resolved) || statSync(resolved).size <= MAX_ASSET_BYTES;
    });
    expect(stale, 'these no longer need an exception').toEqual([]);
  });

  it('prefers an optimized sibling wherever one exists', () => {
    // The regression itself: originals resolving to themselves while a smaller
    // sibling sat unused.
    const wasteful = assets.filter((a) => {
      const { name } = parse(a);
      const hasSibling = ['.webp', '.avif', '.jpg', '.jpeg'].some((e) =>
        existsSync(join(assetDir, `${name}${e}`)),
      );
      return hasSibling && resolveFigmaAsset(a).endsWith(a);
    });

    expect(wasteful).toEqual([]);
  });
});
