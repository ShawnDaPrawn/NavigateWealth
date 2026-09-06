/**
 * Documentation links resolve, and every document is findable.
 *
 * WHY THIS EXISTS. Reorganising the documentation moved eighteen files. Nine
 * relative links broke in the process, and two of those had been broken for
 * months before anyone noticed — `e2e/README.md` pointed at a spec that had been
 * renamed, and the status ledger cited an FNA migration by a filename that never
 * existed. A broken link in a runbook is discovered by the person following it
 * at the moment they can least afford to.
 *
 * The index assertion exists because the convention in `docs/README.md` — every
 * document is linked from that index — was broken twice within days of being
 * written, by the same reorganisation that wrote it: `scripts/README.md` and
 * `src/components/features/README.md` were both created and neither was indexed.
 * A rule nothing enforces is a preference.
 *
 * This is a test rather than a workflow step on purpose. It then runs in
 * `npm test` exactly as it runs in CI, so the failure is found before the push
 * rather than after it — the same reason the other repository-shape checks in
 * this directory are tests.
 *
 * TWO THINGS THIS DELIBERATELY DOES THE HARD WAY, because the first draft did
 * them the easy way and was wrong both times:
 *
 * 1. **The index is parsed for real link targets, not searched as text.** A
 *    substring check counts a path mentioned in backticks as "indexed", so a
 *    document could be named in the index and still not be reachable from it.
 *    `.github/pull_request_template.md` was in exactly that state.
 * 2. **Fragments are checked against the target's headings.** Splitting `#…`
 *    off and verifying only the file passes a link whose heading has since been
 *    renamed, which sends the reader to the top of a long document and reports
 *    success. Same-document `#…` links are checked too rather than skipped.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');

/** `[text](target)`, tolerating a title and surrounding whitespace. */
const LINK = /\[[^\]]*\]\(\s*([^)\s]+?)\s*(?:"[^"]*")?\)/g;

/** Targets that are not repository paths. */
const EXTERNAL = /^(https?:|mailto:|tel:|data:)/;

function markdownFiles(): string[] {
  return execFileSync('git', ['ls-files', '*.md'], { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024 })
    .toString('utf8')
    .split('\n')
    .filter(Boolean);
}

const read = (relativePath: string) => readFile(join(repoRoot, relativePath), 'utf8');

/** Every link target in a document, in source order, with its line number. */
function linkTargets(body: string): { target: string; line: number }[] {
  const out: { target: string; line: number }[] = [];
  body.split('\n').forEach((text, index) => {
    for (const [, target] of text.matchAll(LINK)) out.push({ target, line: index + 1 });
  });
  return out;
}

/**
 * GitHub's heading slug: lowercase, drop anything that is not a word character,
 * space or hyphen, then spaces to hyphens. Repeats get `-1`, `-2`, … in order.
 */
function headingSlugs(markdown: string): Set<string> {
  const seen = new Map<string, number>();
  const slugs = new Set<string>();
  let inFence = false;

  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!heading) continue;

    const base = heading[1]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links keep their text
      .replace(/[`*_~]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s/g, '-');

    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    slugs.add(n === 0 ? base : `${base}-${n}`);
  }

  // Explicit anchors, which the slug rule above cannot see.
  for (const [, id] of markdown.matchAll(/<a\s+(?:id|name)=["']([^"']+)["']/g)) slugs.add(id);
  return slugs;
}

describe('documentation links', () => {
  it('finds markdown files (guards against the listing silently failing)', () => {
    expect(markdownFiles().length).toBeGreaterThan(20);
  });

  it('has no relative link that does not resolve', async () => {
    const broken: string[] = [];

    for (const file of markdownFiles()) {
      for (const { target, line } of linkTargets(await read(file))) {
        if (EXTERNAL.test(target)) continue;
        const [path] = target.split('#');
        if (!path) continue; // same-document fragment; checked below
        if (!existsSync(resolve(repoRoot, dirname(file), path))) {
          broken.push(`${file}:${line} -> ${target}`);
        }
      }
    }

    expect(
      broken.sort(),
      'A relative link points at something that is not there. Fix the link, or restore what it pointed at.',
    ).toEqual([]);
  });

  it('has no link to a heading that does not exist', async () => {
    const stale: string[] = [];
    const slugCache = new Map<string, Set<string>>();

    const slugsFor = async (absolute: string): Promise<Set<string>> => {
      let slugs = slugCache.get(absolute);
      if (!slugs) {
        slugs = headingSlugs(await readFile(absolute, 'utf8'));
        slugCache.set(absolute, slugs);
      }
      return slugs;
    };

    for (const file of markdownFiles()) {
      for (const { target, line } of linkTargets(await read(file))) {
        if (EXTERNAL.test(target)) continue;
        const hash = target.indexOf('#');
        if (hash === -1) continue;

        const path = target.slice(0, hash);
        const fragment = decodeURIComponent(target.slice(hash + 1));
        if (!fragment) continue;

        const absolute = path ? resolve(repoRoot, dirname(file), path) : join(repoRoot, file); // same document

        // Only Markdown has headings this rule can reason about.
        if (!existsSync(absolute) || statSync(absolute).isDirectory()) continue;
        if (!absolute.endsWith('.md')) continue;

        if (!(await slugsFor(absolute)).has(fragment)) {
          stale.push(`${file}:${line} -> ${target}`);
        }
      }
    }

    expect(
      stale.sort(),
      'A link points at a heading that no longer exists. The reader lands at the top of the document and does not know why.',
    ).toEqual([]);
  });
});

describe('documentation index', () => {
  /**
   * Files the index covers by a pattern rather than one row each. Listing seven
   * near-identical module READMEs individually would bury the entries that
   * matter, and the archived launch records are reached through their folder.
   */
  const COVERED_BY_PATTERN = [
    /^src\/components\/admin\/modules\/[^/]+\/README\.md$/,
    /^docs\/archive\/[^/]+\/[^/]+\.md$/,
  ];

  it('links every markdown file in the repository', async () => {
    const index = await read('docs/README.md');

    // Resolve what the index actually links to, not what it merely mentions.
    const linked = new Set<string>();
    for (const { target } of linkTargets(index)) {
      if (EXTERNAL.test(target)) continue;
      const [path] = target.split('#');
      if (!path) continue;
      linked.add(relative(repoRoot, resolve(repoRoot, 'docs', path)));
    }

    const unlisted = markdownFiles().filter((file) => {
      if (file === 'docs/README.md') return false;
      if (COVERED_BY_PATTERN.some((pattern) => pattern.test(file))) return false;
      if (linked.has(file)) return false;
      // A folder link covers the documents inside it.
      return !linked.has(dirname(file));
    });

    expect(
      unlisted.sort(),
      'Every document is linked from docs/README.md. A document nobody can find is a document nobody maintains — add a row, or delete the file. Note that a path in backticks is not a link.',
    ).toEqual([]);
  });
});
