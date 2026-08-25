/**
 * The setup SQL must not undo the function hardening.
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * Migration `20260825004011` pinned `SET search_path = public` on nine
 * functions to clear Supabase advisor `0011_function_search_path_mutable`.
 * Two places in this repository ALSO create those same functions:
 *
 *   - `src/supabase/functions/server/setup.ts` (the bootstrap routes)
 *   - `src/components/admin/modules/tasks/components/TaskSetup.tsx`
 *     (SQL an administrator is told to run from the task-setup wizard)
 *
 * `CREATE OR REPLACE FUNCTION` assigns the properties implied by the command,
 * so replacing a function WITHOUT the clause silently clears the pin and
 * restores the advisor finding. The hardening would therefore survive right up
 * until someone used a supported setup flow, and then quietly stop being true —
 * with nothing failing.
 *
 * This is the "capabilities get wired the day they're written" rule applied to a
 * database property: a migration that any documented flow can undo is not a fix.
 *
 * Caught in review on PR #226.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

const SQL_SOURCES = [
  'src/supabase/functions/server/setup.ts',
  'src/components/admin/modules/tasks/components/TaskSetup.tsx',
];

describe('setup SQL keeps the function hardening', () => {
  it.each(SQL_SOURCES)('%s pins search_path on every function it creates', (relPath) => {
    const src = readFileSync(resolve(REPO_ROOT, relPath), 'utf8');

    const creations = [...src.matchAll(/CREATE OR REPLACE FUNCTION\s+(\w+)/gi)].map((m) => m[1]);
    // Guard against the regex silently matching nothing, which would make the
    // assertion below vacuously true.
    expect(creations.length, `${relPath}: found no function definitions to check`).toBeGreaterThan(
      0,
    );

    // Every plpgsql body terminator must carry the clause.
    const unpinned = [...src.matchAll(/\$\$\s*LANGUAGE\s+plpgsql\s*;/gi)];
    expect(
      unpinned.map((m) => m[0]),
      `${relPath} creates ${creations.join(', ')} without SET search_path. ` +
        'CREATE OR REPLACE clears the pinned config, which would restore advisor ' +
        '0011_function_search_path_mutable the next time this setup flow runs.',
    ).toEqual([]);
  });

  it('the migration that pinned them is still present', () => {
    // If the migration were reverted, these assertions would be enforcing a
    // property nothing else establishes.
    const migration = readFileSync(
      resolve(
        REPO_ROOT,
        'supabase/migrations/20260825004011_harden_function_search_path_and_grants.sql',
      ),
      'utf8',
    );
    expect(migration).toContain('SET search_path = public');
  });
});
