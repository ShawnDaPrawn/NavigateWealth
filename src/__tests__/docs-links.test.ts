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
 * The second assertion exists because the convention in `docs/README.md` — every
 * document is linked from that index — was broken twice within days of being
 * written, by the same reorganisation that wrote it: `scripts/README.md` and
 * `src/components/features/README.md` were both created and neither was indexed.
 * A rule nothing enforces is a preference.
 *
 * This is a test rather than a workflow step on purpose. It then runs in
 * `npm test` exactly as it runs in CI, so the failure is found before the push
 * rather than after it — the same reason the other repository-shape checks in
 * this directory are tests.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');

/** `[text](target)`, tolerating a title and surrounding whitespace. */
const LINK = /\[[^\]]*\]\(\s*([^)\s]+?)\s*(?:"[^"]*")?\)/g;

/** Targets that are not repository paths. */
const NOT_A_PATH = /^(https?:|mailto:|tel:|data:|#)/;

function markdownFiles(): string[] {
  return execFileSync('git', ['ls-files', '*.md'], { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024 })
    .toString('utf8')
    .split('\n')
    .filter(Boolean);
}

async function read(relativePath: string): Promise<string> {
  return readFile(join(repoRoot, relativePath), 'utf8');
}

describe('documentation links', () => {
  it('finds markdown files (guards against the listing silently failing)', () => {
    expect(markdownFiles().length).toBeGreaterThan(20);
  });

  it('has no relative link that does not resolve', async () => {
    const broken: string[] = [];

    for (const file of markdownFiles()) {
      const body = await read(file);
      body.split('\n').forEach((line, index) => {
        for (const [, target] of line.matchAll(LINK)) {
          if (NOT_A_PATH.test(target)) continue;
          const [path] = target.split('#');
          if (!path) continue; // pure anchor, same document
          if (!existsSync(resolve(repoRoot, dirname(file), path))) {
            broken.push(`${file}:${index + 1} -> ${target}`);
          }
        }
      });
    }

    expect(
      broken.sort(),
      'A relative link points at something that is not there. Fix the link, or restore what it pointed at.',
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
    const unlisted: string[] = [];

    for (const file of markdownFiles()) {
      if (file === 'docs/README.md') continue;
      if (COVERED_BY_PATTERN.some((pattern) => pattern.test(file))) continue;

      // The index sits in docs/, so it refers to siblings without the prefix
      // and to everything else through `../`.
      const asWritten = relative('docs', file);
      if (index.includes(file) || index.includes(asWritten)) continue;

      unlisted.push(file);
    }

    expect(
      unlisted.sort(),
      'Every document is linked from docs/README.md. A document nobody can find is a document nobody maintains — add a row, or delete the file.',
    ).toEqual([]);
  });
});
