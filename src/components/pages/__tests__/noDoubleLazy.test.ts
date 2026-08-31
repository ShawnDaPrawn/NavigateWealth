/**
 * Guard: never wrap a barrel's lazy export in another React.lazy.
 *
 * Several module barrels (esign, issues, social-media, form-prefill, …)
 * export their module component as `lazy(() => import('./XModule'))` so the
 * heavy chunk splits at the barrel. A consumer that then writes
 *
 *   const X = React.lazy(() =>
 *     import('.../modules/x').then((m) => ({ default: m.X })),
 *   );
 *
 * resolves the outer lazy to the inner lazy OBJECT — React error #306
 * ("Lazy element type must resolve to a class or function") — and the route
 * crashes at render. This happened for real: #218 made the esign barrel's
 * `EsignModule` lazy while `AdminDashboardPage` kept the wrapper above, and
 * the standalone E-Signature route rendered a SYSTEM ERROR card from
 * 2026-08-24 until the wrapper was removed. jsdom suites never caught it
 * because module tests mock the dynamic imports.
 *
 * This test scans the source tree: any `import('…').then((m) => ({ default:
 * m.<Name> }))` whose specifier is a module BARREL and whose <Name> is one of
 * that barrel's lazy exports is a violation. Deep imports (e.g.
 * `import('./EsignModule')`) stay allowed — those resolve plain components.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const MODULES_DIR = join(__dirname, '..', '..', 'admin', 'modules');
const SRC_ROOT = join(__dirname, '..', '..', '..');

/** Names exported via `export const X = lazy(` per module directory. */
function lazyBarrelExports(): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const dir of readdirSync(MODULES_DIR)) {
    const barrel = join(MODULES_DIR, dir, 'index.ts');
    let source: string;
    try {
      source = readFileSync(barrel, 'utf8');
    } catch {
      continue; // module without a barrel
    }
    const names = new Set<string>();
    for (const match of source.matchAll(/export const (\w+)(?::\s*[\w<>,.\s]+)? = lazy\(/g)) {
      names.add(match[1]);
    }
    if (names.size > 0) result.set(dir, names);
  }
  return result;
}

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* sourceFiles(full);
    } else if (
      /\.tsx?$/.test(entry) &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.test.tsx')
    ) {
      yield full;
    }
  }
}

describe('no React.lazy around a barrel lazy export', () => {
  it('finds no consumer double-wrapping a lazy barrel export', () => {
    const lazyExports = lazyBarrelExports();
    // Sanity: the esign barrel's lazy EsignModule must be visible to the
    // scan, otherwise this guard is scanning the wrong tree.
    expect(lazyExports.get('esign')).toContain('EsignModule');

    const violations: string[] = [];
    const factoryPattern =
      /import\(\s*['"]([^'"]+)['"]\s*\)\s*\.then\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\(\{\s*default:\s*\2\.(\w+)/g;

    for (const file of sourceFiles(SRC_ROOT)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(factoryPattern)) {
        const [, specifier, , exportName] = match;
        // Only barrel specifiers: ".../modules/<dir>" or ".../modules/<dir>/index"
        const barrelMatch = specifier.match(/modules\/([\w-]+)(?:\/index)?$/);
        if (!barrelMatch) continue;
        const moduleDir = barrelMatch[1];
        if (lazyExports.get(moduleDir)?.has(exportName)) {
          violations.push(
            `${basename(file)}: import('${specifier}') → default: m.${exportName} ` +
              `(already a lazy component — render the barrel export directly)`,
          );
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });
});
