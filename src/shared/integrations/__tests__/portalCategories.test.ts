/**
 * Portal automation categories — the three copies must agree
 * ==========================================================
 *
 * Which categories portal automation can run for is defined three times: here
 * in `src/shared` (for the client record, which the dependency boundary stops
 * importing admin internals), in the admin module's types (pinned by the
 * golden-flow suite), and on the server (Deno, which cannot import SPA source).
 *
 * The duplication is deliberate and cheap. Silent DRIFT is not: if the client
 * record thinks a category is refreshable and the server does not, the adviser
 * gets a button that always fails; if the server allows one the UI hides, the
 * feature is quietly unreachable. This asserts the three lists are the same set
 * by reading the other two as source, so adding a category in one place and not
 * the others fails here rather than in production.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PORTAL_AUTOMATION_CATEGORIES,
  PORTAL_PARENT_CATEGORIES,
  isPortalAutomationCategoryId,
} from '../portal-categories.ts';

const repoRoot = resolve(__dirname, '../../../..');
const read = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

/** Pull the entries out of a named `[...]` list in a source file. */
function idsFromArrayLiteral(source: string, declaration: string): string[] {
  const start = source.indexOf(declaration);
  if (start === -1) throw new Error(`Could not find ${declaration}`);
  const open = source.indexOf('[', start);
  const close = source.indexOf('];', open);
  return [...source.slice(open, close).matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
}

/** Pull the keys out of a named `Record<string, string>` object literal. */
function keysFromRecordLiteral(source: string, declaration: string): string[] {
  const start = source.indexOf(declaration);
  if (start === -1) throw new Error(`Could not find ${declaration}`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('};', open);
  return [...source.slice(open, close).matchAll(/^\s*([a-z_]+):/gm)].map((match) => match[1]);
}

describe('portal automation categories', () => {
  it('matches the admin module list', () => {
    const adminIds = idsFromArrayLiteral(
      read('src/components/admin/modules/product-management/types.ts'),
      'PORTAL_AUTOMATION_CATEGORY_IDS',
    );
    expect([...adminIds].sort()).toEqual([...PORTAL_AUTOMATION_CATEGORIES].sort());
  });

  it('matches the server list', () => {
    const serverIds = keysFromRecordLiteral(
      read('src/supabase/functions/server/integrations-portal-guards.ts'),
      'PORTAL_AUTOMATION_CATEGORY_LABELS',
    );
    expect([...serverIds].sort()).toEqual([...PORTAL_AUTOMATION_CATEGORIES].sort());
  });

  it('matches the admin module parent-category list', () => {
    const adminParents = idsFromArrayLiteral(
      read('src/components/admin/modules/product-management/types.ts'),
      'PRODUCT_CATEGORY_GROUP_IDS',
    );
    expect([...adminParents].sort()).toEqual([...PORTAL_PARENT_CATEGORIES].sort());
  });

  it('never treats a parent category as runnable', () => {
    PORTAL_PARENT_CATEGORIES.forEach((parent) => {
      expect(isPortalAutomationCategoryId(parent)).toBe(false);
    });
  });

  it('accepts the child categories a legacy parent record is displayed under', () => {
    expect(isPortalAutomationCategoryId('retirement_pre')).toBe(true);
    expect(isPortalAutomationCategoryId('investments_voluntary')).toBe(true);
  });

  it('rejects an unknown category rather than defaulting to runnable', () => {
    expect(isPortalAutomationCategoryId('')).toBe(false);
    expect(isPortalAutomationCategoryId('not_a_category')).toBe(false);
  });

  it('reads a non-empty list, so a broken extractor cannot pass vacuously', () => {
    expect(PORTAL_AUTOMATION_CATEGORIES.length).toBeGreaterThan(5);
  });
});
