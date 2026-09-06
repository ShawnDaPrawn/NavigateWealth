/**
 * Admin module chunk warming — the registry, and its alignment with the page.
 *
 * Warming a chunk only helps if the specifier resolves to the SAME chunk the
 * page lazy-loads: the bundler keys chunks by specifier, so a near-miss
 * downloads a second copy and saves nothing — silently, because the module
 * still renders and every other test still passes. The drift test below is the
 * only thing that would notice, which is why it reads both files rather than
 * trusting them to stay in step.
 *
 * Run: npx vitest run src/components/admin/__tests__/moduleLoaders.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADMIN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN_PAGE = join(ADMIN_DIR, '../pages/AdminDashboardPage.tsx');
const LOADERS_FILE = join(ADMIN_DIR, 'moduleLoaders.ts');
const TYPES_FILE = join(ADMIN_DIR, 'layout/types.ts');

/** Module ids in the `AdminModule` union, read from the type itself. */
function adminModuleIds(): string[] {
  const src = readFileSync(TYPES_FILE, 'utf8');
  const union = src.slice(src.indexOf('export type AdminModule ='));
  return [...union.slice(0, union.indexOf(';')).matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Every `import('…/modules/x')` specifier in a file, as the bare module dir. */
function moduleSpecifiers(file: string): Set<string> {
  const src = readFileSync(file, 'utf8');
  return new Set([...src.matchAll(/import\(\s*'[^']*modules\/([a-z-]+)'\s*\)/g)].map((m) => m[1]));
}

describe('MODULE_LOADERS — coverage', () => {
  it('has a loader for every module in the AdminModule union', async () => {
    const { MODULE_LOADERS } = await import('../moduleLoaders');
    const ids = adminModuleIds();

    expect(ids.length).toBeGreaterThan(15);
    expect(Object.keys(MODULE_LOADERS).sort()).toEqual([...ids].sort());
  });

  it('reads its module ids from a real union, not an empty match', () => {
    // Guards the regex above: a parse that found nothing would make the
    // coverage test vacuous rather than failing.
    expect(adminModuleIds()).toContain('dashboard');
    expect(adminModuleIds()).toContain('clients');
  });
});

describe('MODULE_LOADERS — alignment with AdminDashboardPage', () => {
  it('warms the same chunks the page lazy-loads', () => {
    const pageSpecifiers = moduleSpecifiers(ADMIN_PAGE);
    const loaderSpecifiers = moduleSpecifiers(LOADERS_FILE);

    // Sanity: both sides parsed to something real.
    expect(pageSpecifiers.size).toBeGreaterThan(15);

    const missing = [...pageSpecifiers].filter((s) => !loaderSpecifiers.has(s));
    expect(
      missing,
      `AdminDashboardPage lazy-loads modules the warmer does not know about, so a ` +
        `hover on them downloads nothing: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('warms the three modules whose barrels lazy-split internally', async () => {
    // These are absent from the page's React.lazy list on purpose (their
    // barrels already export a lazy component; wrapping it again is React
    // error #306), so the drift check above cannot see them.
    const loaders = readFileSync(LOADERS_FILE, 'utf8');

    expect(loaders).toContain('preloadEsignModule');
    expect(loaders).toContain('preloadSocialMediaModule');
    expect(loaders).toContain('preloadIssuesModule');
  });
});

describe('preloadAdminModule', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('starts the module chunk downloading', async () => {
    const { MODULE_LOADERS, preloadAdminModule } = await import('../moduleLoaders');
    const spy = vi.spyOn(MODULE_LOADERS, 'clients').mockResolvedValue(undefined);

    preloadAdminModule('clients');

    expect(spy).toHaveBeenCalledOnce();
  });

  it('loads a given module only once, however often intent is signalled', async () => {
    const { MODULE_LOADERS, preloadAdminModule } = await import('../moduleLoaders');
    const spy = vi.spyOn(MODULE_LOADERS, 'clients').mockResolvedValue(undefined);

    // A pointer crossing a sidebar item fires this repeatedly.
    preloadAdminModule('clients');
    preloadAdminModule('clients');
    preloadAdminModule('clients');

    expect(spy).toHaveBeenCalledOnce();
  });

  it('returns without waiting for the chunk', async () => {
    const { MODULE_LOADERS, preloadAdminModule } = await import('../moduleLoaders');
    let resolveLoad: (() => void) | undefined;
    vi.spyOn(MODULE_LOADERS, 'clients').mockReturnValue(
      new Promise<void>((r) => {
        resolveLoad = () => r();
      }),
    );

    // Hover must never block the UI on a network fetch.
    expect(preloadAdminModule('clients')).toBeUndefined();
    resolveLoad?.();
  });

  it('swallows a failed chunk fetch and allows a later retry', async () => {
    const { MODULE_LOADERS, preloadAdminModule } = await import('../moduleLoaders');
    const spy = vi
      .spyOn(MODULE_LOADERS, 'clients')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);

    expect(() => preloadAdminModule('clients')).not.toThrow();
    // Let the rejection settle so the module id is released.
    await Promise.resolve();
    await Promise.resolve();

    preloadAdminModule('clients');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
