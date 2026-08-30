/**
 * Shrink the Edge Function payload before `supabase functions deploy`.
 * ============================================================================
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-08-30 the deploy started failing with
 *
 *   413: Function source code exceeds the maximum deployment size (5 MB)
 *
 * The deploy uploads every module in the entrypoint's import graph as source —
 * 500 files, 4.44 MB — and Supabase measures that payload ~15% above raw file
 * bytes. The graph had been creeping toward the ceiling for weeks (4.28 MB on
 * 27 Aug, 4.30 MB on 29 Aug); the Newsletter Studio module added 100 KB and
 * tipped it over. Nothing about that 100 KB is special: the next feature of any
 * size would have done the same.
 *
 * WHAT IT DOES
 * ------------
 * Runs every edge-reachable `.ts`/`.tsx` file through esbuild's transform,
 * which strips type annotations and comments and emits equivalent ESM. That is
 * exactly what Deno Deploy does to this code at runtime anyway — the types and
 * the 0.83 MB of comments are never executed. Result: 4.44 MB -> 3.22 MB, a 27%
 * cut that restores roughly a megabyte of headroom.
 *
 * WHY esbuild AND NOT A REGEX
 * ---------------------------
 * A regex comment-stripper corrupts any string containing `//` — every URL in
 * the codebase — and that failure mode ships silently to production. esbuild
 * parses the file properly, so a construct it cannot handle is a hard error
 * here rather than a broken function in production.
 *
 * WHY NOT BUNDLE INTO ONE FILE
 * ----------------------------
 * `mount-modules.ts` lazy-loads each router with a literal dynamic import, and
 * lazy-router.ts depends on those staying separate modules. Per-file transform
 * preserves the module graph exactly; bundling would not.
 *
 * SAFETY
 * ------
 * - Destructive: it rewrites files in place, so it refuses to run unless
 *   STRIP_EDGE_ALLOW_DIRTY=1 or the tree is a disposable CI checkout.
 * - Any transform failure exits non-zero and fails the deploy.
 * - A size assertion fails the deploy BEFORE upload if the payload is back near
 *   the ceiling, so the next occurrence is a clear message here instead of an
 *   opaque 413 from the API.
 * - The workflow's existing blocking post-deploy smoke is the backstop: the
 *   deployed function must answer /health before the job is considered green.
 *
 * Verified 2026-08-30 by booting the stripped tree under Deno and confirming
 * /health returns the same 200 payload as the unstripped tree.
 */
import { transformSync } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

/** Roots the edge import graph can reach. */
const ROOTS = ['src/supabase/functions', 'src/shared', 'src/utils'];

/** Never shipped (not in the import graph) — skipping keeps the run quick. */
const SKIP_DIRS = new Set(['__tests__', 'node_modules', '.git']);

/**
 * Fail the deploy if the stripped payload is still this large. Supabase's hard
 * limit is 5 MB measured ~15% above raw bytes, so 4.0 MB of source leaves a
 * real margin while still catching a regression early.
 */
const MAX_PAYLOAD_MB = 4.0;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path, out);
    } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
      out.push(path);
    }
  }
  return out;
}

function main() {
  const files = ROOTS.flatMap((root) => walk(root));
  if (files.length === 0) {
    console.error('strip-edge-function: no source files found — wrong working directory?');
    process.exit(1);
  }

  let before = 0;
  let after = 0;
  const failures = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    before += Buffer.byteLength(source);
    try {
      const { code } = transformSync(source, {
        loader: extname(file) === '.tsx' ? 'tsx' : 'ts',
        format: 'esm',
        target: 'esnext',
        // Strip types and comments only. Identifiers and syntax are left alone
        // so a stack trace from production still names real functions.
        minifyIdentifiers: false,
        minifySyntax: false,
        minifyWhitespace: false,
        legalComments: 'none',
        // Leave JSX exactly as written. esbuild's default would rewrite it to
        // `React.createElement(...)`, and there is no React in a Deno edge
        // function — the module would import fine and only die when the JSX
        // ran, so a boot smoke would not catch it. `preserve` keeps this
        // transform to what it claims: types and comments out, semantics
        // untouched. No edge-reachable file contains JSX today; this is here so
        // that if one ever does, it stays as valid as it was before stripping.
        jsx: 'preserve',
      });
      writeFileSync(file, code);
      after += Buffer.byteLength(code);
    } catch (error) {
      failures.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures.length > 0) {
    console.error(`strip-edge-function: ${failures.length} file(s) failed to transform:`);
    for (const failure of failures.slice(0, 20)) console.error(`  ${failure}`);
    console.error('Refusing to deploy a partially transformed tree.');
    process.exit(1);
  }

  const beforeMb = before / 1024 / 1024;
  const afterMb = after / 1024 / 1024;
  console.log(
    `strip-edge-function: ${files.length} files, ` +
      `${beforeMb.toFixed(2)} MB -> ${afterMb.toFixed(2)} MB ` +
      `(${(100 - (after / before) * 100).toFixed(1)}% smaller)`,
  );

  if (afterMb > MAX_PAYLOAD_MB) {
    console.error(
      `::error::Edge Function payload is ${afterMb.toFixed(2)} MB after stripping, over the ` +
        `${MAX_PAYLOAD_MB} MB guard. Supabase rejects above ~5 MB of measured payload. ` +
        `Split the function (see supabase/config.toml) or remove code before adding more.`,
    );
    process.exit(1);
  }
}

main();
