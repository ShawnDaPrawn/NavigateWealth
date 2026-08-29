/**
 * Every page image must resolve to an optimised variant.
 * =====================================================
 *
 * WHY THIS EXISTS. `ResponsiveImage` is only used when a card carries an
 * `imageKey`; without one the consumer falls back to `<img src={image}>`, which
 * fetches the raw Figma export. On 2026-08-25 three home page entries had no
 * key, and a real browser measurement showed the home page pulling
 * **29.04 MB of images, 28.71 MB of it PNG** — 27 MB from those three alone.
 * Adding the keys took it to 2.29 MB.
 *
 * Nothing failed. No error, no warning, no budget breach: `imageBytes` in the
 * bundle baseline counts what is EMITTED, and the originals are emitted either
 * way. A dropped key is a silent 14 MB regression, which is the same shape of
 * bug as the scheduled jobs that reported success while doing nothing.
 *
 * So this asserts the two things that make the pipeline actually take effect:
 *   1. every local page image is keyed, and
 *   2. every key referenced anywhere in src/ has its variants on disk.
 *
 * (2) is the load-bearing half. A key that points at ungenerated variants 404s
 * every <source>, and the browser silently falls back to the PNG — the exact
 * failure this file exists to prevent, wearing a correct-looking key.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogoWidths, getOptimizedWidths } from '../optimizedImages';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SRC = join(REPO_ROOT, 'src');
const OPTIMIZED_DIR = join(REPO_ROOT, 'public', 'img', 'optimized');
const FORMATS = ['avif', 'webp'] as const;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const ALL_SOURCES = walk(SRC);

/** Identifiers assigned a remote URL rather than a bundled asset. */
function remoteImageIdentifiers(source: string): Set<string> {
  const names = new Set<string>();
  const re = /const\s+(\w+)\s*=\s*\n?\s*['"`]https?:\/\//g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) names.add(m[1]);
  return names;
}

describe('every local page image carries an imageKey', () => {
  // Only page-level data files declare the service-card shape that
  // ResponsiveImage consumes; component-local <img> tags are out of scope.
  const pageFiles = ALL_SOURCES.filter((f) => f.includes(join('components', 'pages')));

  it('finds page files to check (guards against the glob silently going empty)', () => {
    expect(pageFiles.length).toBeGreaterThan(5);
  });

  it.each(pageFiles.map((f) => [relative(REPO_ROOT, f), f] as const))('%s', (_label, filePath) => {
    const source = readFileSync(filePath, 'utf8');
    const remote = remoteImageIdentifiers(source);
    const lines = source.split('\n');
    const missing: string[] = [];

    lines.forEach((line, i) => {
      // `image: someBinding,` inside an object literal. A trailing comma
      // excludes type declarations like `image: string;`.
      const m = /^\s*image:\s*([\w.]+),\s*$/.exec(line);
      if (!m) return;
      const identifier = m[1];
      if (remote.has(identifier)) return; // cannot be optimised locally
      const window = lines.slice(i + 1, i + 4).join('\n');
      if (!window.includes('imageKey')) {
        missing.push(`line ${i + 1}: image: ${identifier}`);
      }
    });

    expect(
      missing,
      `These entries fall back to the raw full-size asset because they have no ` +
        `imageKey. Add one that matches a key in public/img/optimized/:\n  ` +
        missing.join('\n  '),
    ).toEqual([]);
  });
});

function keysReferencedVia(marker: string): Map<string, string[]> {
  const referenced = new Map<string, string[]>();

  for (const file of ALL_SOURCES) {
    const source = readFileSync(file, 'utf8');
    const re = new RegExp(`${marker}:\\s*['"]([a-z0-9-]+)['"]`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
      const key = m[1];
      const list = referenced.get(key) ?? [];
      list.push(relative(REPO_ROOT, file));
      referenced.set(key, list);
    }
  }

  return referenced;
}

describe('every referenced imageKey has its variants on disk', () => {
  const referenced = keysReferencedVia('imageKey');

  it('finds referenced keys at all', () => {
    expect(referenced.size).toBeGreaterThan(0);
  });

  it.each([...referenced.keys()].sort().map((k) => [k] as const))(
    'key "%s" has every width and format, non-empty',
    (key) => {
      const widths = getOptimizedWidths();
      const problems: string[] = [];

      for (const width of widths) {
        for (const format of FORMATS) {
          const file = join(OPTIMIZED_DIR, `${key}-${width}.${format}`);
          if (!existsSync(file)) {
            problems.push(`missing ${key}-${width}.${format}`);
          } else if (statSync(file).size === 0) {
            // A zero-byte variant is worse than a missing one: <source> matches,
            // the browser gets nothing, and there is no fallback.
            problems.push(`empty ${key}-${width}.${format}`);
          }
        }
      }

      expect(
        problems,
        `Referenced by ${referenced.get(key)?.join(', ')}. ` +
          `Run \`npm run optimize:images\`. Until these exist the <source> tags ` +
          `404 and the browser silently falls back to the full-size original.\n  ` +
          problems.join('\n  '),
      ).toEqual([]);
    },
  );
});

/**
 * `logoKey` is the same contract at a different width set. It exists because a
 * provider logo renders in a ~200 CSS px slot: asking for the page widths would
 * put roughly 2.5 MB of 1024/1440 variants into `public/` that no `sizes`
 * attribute can select — deployed, and never fetched.
 *
 * Splitting the width sets creates a new way for the pipeline to look correct
 * and do nothing: a key built at the wrong widths still reads like a key. This
 * checks the narrow set specifically, and the assertion that LOGO_WIDTHS has
 * not silently become the page widths is what keeps the two from converging
 * back by accident.
 */
describe('every referenced logoKey has its narrow variants on disk', () => {
  const referenced = keysReferencedVia('logoKey');

  it('finds referenced logo keys at all', () => {
    expect(referenced.size).toBeGreaterThan(0);
  });

  it('logo widths stay narrower than the page widths', () => {
    const logoWidths = getLogoWidths();
    const pageWidths = getOptimizedWidths();
    expect(logoWidths.length).toBeGreaterThan(0);
    expect(Math.max(...logoWidths)).toBeLessThan(Math.max(...pageWidths));
  });

  it.each([...referenced.keys()].sort().map((k) => [k] as const))(
    'logo key "%s" has every width and format, non-empty',
    (key) => {
      const problems: string[] = [];

      for (const width of getLogoWidths()) {
        for (const format of FORMATS) {
          const file = join(OPTIMIZED_DIR, `${key}-${width}.${format}`);
          if (!existsSync(file)) {
            problems.push(`missing ${key}-${width}.${format}`);
          } else if (statSync(file).size === 0) {
            problems.push(`empty ${key}-${width}.${format}`);
          }
        }
      }

      expect(
        problems,
        `Referenced by ${referenced.get(key)?.join(', ')}. ` +
          `Run \`npm run optimize:images\`. Until these exist the <source> tags ` +
          `404 and the browser silently falls back to the full-size original.\n  ` +
          problems.join('\n  '),
      ).toEqual([]);
    },
  );

  it('does not generate the page widths for logo keys', () => {
    const stray: string[] = [];
    const pageOnlyWidths = getOptimizedWidths().filter(
      (w) => !getLogoWidths().includes(w as never),
    );

    for (const key of referenced.keys()) {
      for (const width of pageOnlyWidths) {
        for (const format of FORMATS) {
          const file = join(OPTIMIZED_DIR, `${key}-${width}.${format}`);
          if (existsSync(file)) stray.push(`${key}-${width}.${format}`);
        }
      }
    }

    expect(
      stray,
      'These logo variants are deployed but no `sizes` attribute can ever ' +
        'select them — the waste this width split exists to avoid:\n  ' +
        stray.join('\n  '),
    ).toEqual([]);
  });
});

/**
 * The logo registry pairs an import with a hash by hand, and vitest cannot
 * check that pairing at runtime: `vitest.config.ts` aliases every
 * `figma:asset/*` specifier to one stub that exports `''`, so all sixteen
 * bindings are the same empty string in this environment. `logoKeyForSrc`
 * degrades safely there — an empty src returns undefined and the caller keeps
 * its plain <img> — but it means a transposed hash would render the wrong
 * brand's logo in production with every test still green.
 *
 * So the pairing is checked as source text, where the two halves are distinct.
 */
describe('provider logo keys match their imports', () => {
  const REGISTRY = join(SRC, 'components', 'shared', 'assets', 'provider-logos.ts');
  const source = readFileSync(REGISTRY, 'utf8');

  const imports = new Map(
    [...source.matchAll(/import (\w+) from 'figma:asset\/([0-9a-f]{40})\.png';/g)].map(
      (m) => [m[1], m[2]] as const,
    ),
  );
  const keys = new Map(
    [...source.matchAll(/(\w+): \{ logoKey: '([0-9a-f]{40})' \}/g)].map(
      (m) => [m[1], m[2]] as const,
    ),
  );

  it('finds both halves (guards against a regex silently going empty)', () => {
    expect(imports.size).toBeGreaterThan(10);
    expect(keys.size).toBe(imports.size);
  });

  it("every import has a logoKey, and it is that import's own hash", () => {
    const wrong: string[] = [];
    for (const [binding, hash] of imports) {
      const declared = keys.get(binding);
      if (declared === undefined) {
        wrong.push(`${binding}: imported but has no logoKey`);
      } else if (declared !== hash) {
        wrong.push(`${binding}: imports ${hash} but declares ${declared}`);
      }
    }
    for (const binding of keys.keys()) {
      if (!imports.has(binding)) wrong.push(`${binding}: has a logoKey but no import`);
    }

    expect(
      wrong,
      "A mismatch here renders another provider's logo — the kind of wrong " +
        'that looks right:\n  ' +
        wrong.join('\n  '),
    ).toEqual([]);
  });

  it('no two logos share a hash (the src-to-key map would collapse them)', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const [binding, hash] of imports) {
      const first = seen.get(hash);
      if (first) dupes.push(`${first} and ${binding} both import ${hash}`);
      else seen.set(hash, binding);
    }
    expect(dupes).toEqual([]);
  });
});
