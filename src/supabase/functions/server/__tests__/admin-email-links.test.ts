/**
 * Admin links in server-sent emails must use `/admin?module=<id>`.
 *
 * The SPA has no `/admin/<module>` routes: modules are chosen by the `module`
 * query parameter. The daily calendar digest linked to `/admin/calendar` and
 * opened a 404 (2026-11-27); the tasks digest, the birthday digest and the
 * e-sign stuck alert had the same shape. The SPA now redirects the old form
 * for links already sent, but new emails should not depend on that.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '__tests__' || entry.name === 'node_modules') return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('admin links in server emails', () => {
  it('never point at a /admin/<module> path segment', () => {
    const offenders = sourceFiles(SERVER_DIR).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${file.slice(SERVER_DIR.length + 1)}:${i + 1}` }))
        .filter(({ line }) => /navigatewealth\.co\/admin\/[a-z]/.test(line))
        .map(({ at }) => at),
    );
    expect(offenders).toEqual([]);
  });
});
