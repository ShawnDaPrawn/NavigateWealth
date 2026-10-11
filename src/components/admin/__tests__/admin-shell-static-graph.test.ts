/**
 * The admin frame must not statically import any module barrel.
 *
 * `AdminDashboardPage` lazy-loads every admin module through its barrel
 * (`modules/<m>/index.ts`). Rollup cannot split out a module that is ALSO
 * imported statically somewhere in the page's graph, so a single static barrel
 * import — a skeleton, a hook, a helper — silently moves that whole module into
 * the page's chunk. Until 2026-10 that had happened to every module: opening
 * `/admin` downloaded 3.8 MB of JavaScript before the sidebar could paint.
 *
 * The frame imports from each module's `shell.ts` instead (see the "Shell
 * entries" note in `moduleLoaders.ts`). This test walks the frame's static
 * import graph — `import type` and `import()` excluded, exactly the edges the
 * bundler treats as eager — and fails with the offending chain if a barrel is
 * reachable.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../../..');
const ENTRY = join(ROOT, 'src/components/pages/AdminDashboardPage.tsx');
const BARREL = /\/components\/admin\/modules\/[^/]+\/index\.tsx?$/;
const SHELL = /\/components\/admin\/modules\/([^/]+)\/shell\.ts$/;

const IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = join(ROOT, 'src', specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
  else return null; // package import

  for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Static (runtime) imports of one file, resolved to paths inside the repo. */
function staticImports(file: string): string[] {
  const source = stripComments(readFileSync(file, 'utf8'));
  const found: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const [, typeKeyword, clause, fromSpecifier, bareSpecifier] = match;
    if (typeKeyword) continue;
    // `import { type X } from` with a single type-only binding is erased too.
    if (clause && /^\{\s*type\s[^,]*\}$/.test(clause.trim())) continue;
    const target = resolveSpecifier(file, fromSpecifier ?? bareSpecifier);
    if (target) found.push(target);
  }
  return found;
}

/** Breadth-first walk; each reached file maps to the file that first imported it. */
function walk(entry: string): Map<string, string | null> {
  const parent = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    for (const target of staticImports(file)) {
      if (!parent.has(target)) {
        parent.set(target, file);
        queue.push(target);
      }
    }
  }
  return parent;
}

function chainTo(file: string, parent: Map<string, string | null>): string {
  const chain: string[] = [];
  for (let current: string | null = file; current; current = parent.get(current) ?? null) {
    chain.unshift(relative(ROOT, current));
  }
  return chain.join('\n  -> ');
}

describe('admin frame static import graph', () => {
  const graph = walk(ENTRY);

  it('reaches no admin module barrel', () => {
    const barrels = [...graph.keys()].filter((file) => BARREL.test(file));
    expect(barrels.map((barrel) => chainTo(barrel, graph))).toEqual([]);
  });

  it('actually walks the frame (guards against a resolver that finds nothing)', () => {
    // The layout, sidebar and at least one shell entry must be reachable, or
    // the assertion above is passing vacuously.
    const files = [...graph.keys()].map((file) => relative(ROOT, file));
    expect(files).toContain('src/components/admin/AdminLayout.tsx');
    expect(files).toContain('src/components/admin/layout/Sidebar.tsx');
    expect(files.some((file) => SHELL.test(`/${file}`))).toBe(true);
  });

  it('keeps every shell entry off its own barrel', () => {
    const offenders = [...graph.keys()]
      .filter((file) => SHELL.test(file))
      .filter((shell) => staticImports(shell).some((target) => BARREL.test(target)))
      .map((shell) => relative(ROOT, shell));
    expect(offenders).toEqual([]);
  });
});
