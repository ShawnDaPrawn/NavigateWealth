/**
 * The honeycomb service's export surface, derived from its callers.
 * =================================================================
 *
 * All five honeycomb route files reach the service the same way —
 * `import * as service from './honeycomb-service.ts'` — and then call
 * `service.runIdvNoPhoto(...)` and friends. A namespace import resolves at
 * runtime, so a name that stops being exported is not a compile error at the
 * call site in the way a named import would be: it is `undefined`, and the
 * failure arrives as "service.runX is not a function" on a live request.
 *
 * `honeycomb-routes.contract.test.ts` is thorough about the routes, but it
 * mocks this module wholesale — its stub defines all twenty-three names itself,
 * so it stays green no matter what the real file exports. That is the right
 * design for a route test and the exact reason it cannot be the net for a
 * service split.
 *
 * This file closes that gap. The list of names is read out of the route files
 * rather than typed here, so a route calling something new is covered without
 * anyone remembering to add it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Route files that reach the service through a namespace import. */
const ROUTE_FILES = readdirSync(SERVER_DIR).filter(
  (f) =>
    /^honeycomb-.*routes\.ts$/.test(f) &&
    /import \* as service from '\.\/honeycomb-service\.ts'/.test(
      readFileSync(join(SERVER_DIR, f), 'utf8'),
    ),
);

const CALLED = [
  ...new Set(
    ROUTE_FILES.flatMap((f) =>
      [
        ...readFileSync(join(SERVER_DIR, f), 'utf8').matchAll(/\bservice\.([A-Za-z_]\w*)\s*[(<]/g),
      ].map((m) => m[1]),
    ),
  ),
].sort();

describe('every name the routes call is exported', () => {
  it('found the route files and the calls in them (analysis sanity check)', () => {
    // Without this, a broken scan would produce an empty list and the check
    // below would pass by measuring nothing — the vacuous-gate shape.
    expect(ROUTE_FILES.length, 'no route file uses the namespace import').toBeGreaterThanOrEqual(4);
    expect(CALLED.length, 'no service calls found in the route files').toBeGreaterThan(15);
  });

  it('exports each one as a function', async () => {
    const service = (await import('../honeycomb-service.ts')) as unknown as Record<string, unknown>;

    const missing = CALLED.filter((name) => typeof service[name] !== 'function');

    expect(
      missing,
      `these are called as service.<name>(...) by ${ROUTE_FILES.join(', ')} but are not exported functions`,
    ).toEqual([]);
  });
});
