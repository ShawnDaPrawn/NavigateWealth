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
import { getOptimizedWidths } from '../optimizedImages';

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

describe('every referenced imageKey has its variants on disk', () => {
  const referenced = new Map<string, string[]>();

  for (const file of ALL_SOURCES) {
    const source = readFileSync(file, 'utf8');
    const re = /imageKey:\s*['"]([a-z0-9-]+)['"]/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
      const key = m[1];
      const list = referenced.get(key) ?? [];
      list.push(relative(REPO_ROOT, file));
      referenced.set(key, list);
    }
  }

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
