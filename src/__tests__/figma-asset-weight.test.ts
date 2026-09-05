/**
 * No `figma:asset` import may resolve to a multi-megabyte original.
 * =================================================================
 *
 * The resolver in vite.config.ts prefers an optimized file over the raw Figma
 * export. It was written to do that and it silently did not: it looked only for
 * `<hash>.webp`, there are no `.webp` files in `src/assets`, so every one of the
 * 84 imports fell through to the original. Those originals are camera-scale
 * exports — up to 8256x5504 — and 62 of them had a 2200x1467 `.jpg` sibling of
 * roughly 300 KB sitting unused beside them. The home page shipped about 125 MB
 * of images.
 *
 * Nothing caught it, and nothing would have. It is invisible in development,
 * where assets are local; the bundle-size baseline tracks `imageBytes` but was
 * itself baselined AFTER the regression, so the wrong number was the floor. The
 * only place it shows up is a real user's data bundle.
 *
 * ── What this file measures, and why it is the cold path ────────────────────
 *
 * Production does not serve those siblings. `scripts/generate-figma-webp.mjs`
 * runs before `vite build` and emits a ≤500 KB WebP per asset into
 * `node_modules/.cache/figma-webp/`, which the resolver checks first — 811 MB
 * of originals become 10 MB. The script owns that half: it enforces its own
 * size ceiling and transparency check, and fails the build on either.
 *
 * So the interesting question here is the other half. **What gets served when
 * the cache is not there** — a fresh clone, a cleared Vercel cache, someone
 * running `vite build` directly, a generator that failed. That path has no
 * build step watching it, so it is the one this file measures: every
 * assertion below deliberately resolves through `src/assets` alone.
 *
 * The two are checked against each other at the end, so the mirror cannot
 * drift from the real resolver without failing.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, parse, resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');
const assetDir = join(repoRoot, 'src/assets');
const webpCacheDir = join(repoRoot, 'node_modules/.cache/figma-webp');

/**
 * No single asset a browser fetches should exceed this.
 *
 * 1.5 MB is deliberately loose: it is far above the ~300 KB the optimized
 * exports weigh, so ordinary asset churn will not trip it, and far below the
 * 25-31 MB originals this exists to keep out. A file over this is not a
 * judgement call about quality — it is an un-optimized export that escaped.
 *
 * The generated cache is held to a much tighter 500 KB, by the generator.
 */
const MAX_ASSET_BYTES = 1_536_000;

/** The whole imported set must stay within a budget a person could download. */
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;

/** Mirrors MAX_OUTPUT_BYTES in scripts/generate-figma-webp.mjs. */
const MAX_GENERATED_BYTES = 500 * 1024;

/**
 * Assets that exceed the cap on the COLD path and have no optimized sibling.
 *
 * The generator converts all three to under 500 KB, so nothing ships oversized
 * in a normal build. What this list records is the degraded case: if the cache
 * is missing, these three are what a visitor downloads. Each is a JPEG that was
 * exported without being resized, and each needs a 2200px-wide sibling
 * committed beside it — at which point the resolver picks it up with no code
 * change and the entry comes out of this list.
 *
 * They are listed rather than tolerated by raising the cap, because a raised
 * cap silently permits the next one too.
 *
 * Recorded in docs/archive/production-readiness-ledger-2026.md so it is a task, not a footnote.
 */
const KNOWN_UNOPTIMIZED = new Set([
  // RiskManagementPage
  '00f21f624e8160ae5a1793de40e7c0e7ba1ee60d.png', // 3.4 MB
  '47655f7ea49b8154455dbaefe83366869b59cabb.png', // 2.2 MB
  // InvestmentManagementPage
  '76fc906be4d2c342ff5272cc2c0d901ad65ff7f6.png', // 3.9 MB
]);

/** Extensions the resolver tries inside `src/assets`, best first. */
const SIBLING_EXTENSIONS = ['.webp', '.avif', '.jpg', '.jpeg'] as const;

/**
 * The resolver's committed half: `src/assets` only, cache deliberately ignored.
 *
 * This is what a build with no generated cache resolves to, which is the thing
 * these assertions are about.
 */
function resolveCold(filename: string): string {
  const { name } = parse(filename);
  const candidates = [...SIBLING_EXTENSIONS.map((ext) => `${name}${ext}`), filename];
  const match = candidates.find((c) => existsSync(join(assetDir, c)));
  return join(assetDir, match ?? filename);
}

/** The full ladder, cache first — what `vite build` actually resolves to. */
function resolveFigmaAsset(filename: string): string {
  const generated = join(webpCacheDir, `${parse(filename).name}.webp`);
  return existsSync(generated) ? generated : resolveCold(filename);
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const p = join(dir, entry.name);
    // Skip the binaries, by path. `src/components/shared/assets/` is source and
    // holds the sixteen provider-logo imports; skipping every directory merely
    // NAMED `assets` loses them, which is the bug this rule exists to avoid.
    if (p === assetDir) continue;
    // This file and vite.config.ts describe the specifier in prose; matching
    // their own documentation would make the scan report `<hash>.png` and `*`
    // as missing assets.
    if (entry.name === 'figma-asset-weight.test.ts') continue;
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

const assets = importedAssets();

describe('figma:asset imports resolve to web-sized files', () => {
  it('finds the imports at all, so a passing run is never vacuous', () => {
    expect(assets.length).toBeGreaterThan(50);
  });

  it('resolves every one to a file that exists', () => {
    const missing = assets.filter((a) => !existsSync(resolveCold(a)));
    expect(missing).toEqual([]);
  });

  it('serves no single asset larger than the cap', () => {
    const oversized = assets
      .filter((a) => !KNOWN_UNOPTIMIZED.has(a))
      .map((a) => ({ asset: a, resolved: resolveCold(a) }))
      .filter(({ resolved }) => existsSync(resolved))
      .map(({ asset, resolved }) => ({ asset, mb: statSync(resolved).size / 1_048_576 }))
      .filter(({ mb }) => mb * 1_048_576 > MAX_ASSET_BYTES)
      .map(({ asset, mb }) => `${asset} -> ${mb.toFixed(1)} MB`);

    // If this fails: commit an optimized sibling next to the original. The
    // resolver picks it up with no code change.
    expect(oversized).toEqual([]);
  });

  it('keeps the whole imported set inside a downloadable budget', () => {
    const total = assets
      .map(resolveCold)
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
      const resolved = resolveCold(a);
      return !existsSync(resolved) || statSync(resolved).size <= MAX_ASSET_BYTES;
    });
    expect(stale, 'these no longer need an exception').toEqual([]);
  });

  it('prefers an optimized sibling wherever one exists', () => {
    // The regression itself: originals resolving to themselves while a smaller
    // sibling sat unused.
    const wasteful = assets.filter((a) => {
      const { name } = parse(a);
      const hasSibling = SIBLING_EXTENSIONS.some((e) => existsSync(join(assetDir, `${name}${e}`)));
      return hasSibling && resolveCold(a).endsWith(a);
    });

    expect(wasteful).toEqual([]);
  });
});

/**
 * The mirror above is only worth anything if it still matches the resolver.
 *
 * Two functions that must agree, in different files, with no link between them
 * is exactly how a green suite ends up describing code that no longer exists.
 * So the real candidate list is read out of `vite.config.ts` and compared.
 */
describe('the mirror matches the resolver it claims to mirror', () => {
  const viteConfig = readFileSync(join(repoRoot, 'vite.config.ts'), 'utf8');
  const block = viteConfig
    .slice(viteConfig.indexOf('function figmaAssetResolver'))
    .match(/const candidates = \[([\s\S]*?)\];/);

  it('finds the resolver candidate list to compare against', () => {
    expect(block, 'figmaAssetResolver no longer has a `candidates` array').not.toBeNull();
  });

  it('tries the generated cache first', () => {
    const first = block![1].trim().split('\n')[0];
    expect(first, 'the generated WebP must outrank every committed file').toContain(
      'webpCacheDirectory',
    );
  });

  it('falls back through the same extensions, in the same order', () => {
    const lines = block![1]
      .split('\n')
      .filter((l) => l.includes('assetDirectory'))
      .map((l) => l.trim());

    // Everything but the last entry is `${parsed.name}.<ext>`; the last is the
    // original specifier, which has no fixed extension here.
    const extensions = lines
      .slice(0, -1)
      .map((l) => l.match(/\$\{parsed\.name\}(\.[a-z]+)/)?.[1])
      .filter(Boolean);

    expect(extensions).toEqual([...SIBLING_EXTENSIONS]);
    expect(lines.at(-1), 'the raw original must remain the last resort').toContain('filename');
  });
});

/**
 * The generated half, checked only where it exists.
 *
 * `quality-check` runs `npm run build` before Vitest, so in CI the cache is
 * always warm and these run for real. Locally it may not be, and a developer
 * running `npm test` on a fresh clone should not see a failure for a build step
 * they have not run. The guard is the first test: a cold cache is allowed to
 * skip the rest ONLY outside CI, so "silently skipped in CI" — the way a check
 * like this normally rots — is itself a failure.
 */
describe('the generated WebP cache', () => {
  const warm = existsSync(webpCacheDir);

  it('is present in CI, where the build runs before the tests', () => {
    if (!process.env.CI) {
      expect(true).toBe(true);
      return;
    }
    expect(
      warm,
      'node_modules/.cache/figma-webp is missing after `npm run build`. Either the ' +
        'generator did not run or it failed — dist is about to ship raw Figma exports.',
    ).toBe(true);
  });

  it.runIf(warm)('covers every imported asset', () => {
    const uncovered = assets.filter(
      (a) => !existsSync(join(webpCacheDir, `${parse(a).name}.webp`)),
    );
    // A generator that quietly converts a subset is the failure mode that put
    // sixteen provider logos back into dist as raw PNG.
    expect(uncovered, 'imported but never converted').toEqual([]);
  });

  it.runIf(warm)('holds every generated file under the 500 KB ceiling', () => {
    const over = readdirSync(webpCacheDir)
      .filter((f) => f.endsWith('.webp'))
      .map((f) => ({ f, size: statSync(join(webpCacheDir, f)).size }))
      .filter(({ size }) => size > MAX_GENERATED_BYTES)
      .map(({ f, size }) => `${f} -> ${(size / 1024).toFixed(0)} KB`);

    expect(over).toEqual([]);
  });

  it.runIf(warm)('is what the resolver actually picks', () => {
    const notUsingCache = assets.filter((a) => !resolveFigmaAsset(a).startsWith(webpCacheDir));
    expect(notUsingCache, 'resolved to a committed file despite a warm cache').toEqual([]);
  });
});
