/**
 * dependency-cruiser boundary rules (Phase 7 hardening; resolver fixed 2026-08-21).
 *
 * Run locally:  npx dependency-cruiser@16 'src/**\/*.{ts,tsx}' --config quality/dependency-cruiser.cjs
 * CI gate:      see .github/workflows/quality-check.yml "Run dependency-cruiser"
 *
 * ---------------------------------------------------------------------------
 * RESOLVER FIX (2026-08-21) — why this gate reported "no violations" for months
 * ---------------------------------------------------------------------------
 * Before this change the cruise resolved almost NO first-party TypeScript: on a
 * representative file, 49 of 52 imports came back `couldNotResolve` with
 * `dependencyTypes: ['unknown']`, and the whole run reported 0 violations
 * (4683 "modules", most of them phantom unresolved-specifier entries). The
 * three boundary rules therefore never fired — the green was vacuous, not clean.
 *
 * Root cause: dependency-cruiser's enhanced-resolve needs an explicit
 * `extensions` list to probe `.ts`/`.tsx`; without `enhancedResolveOptions`
 * below, extension-less relative imports (`../admin/AdminLayout`) never resolved.
 * With the fix, resolution is correct (2492 real modules) and the rules fire.
 *
 * FIRST HONEST RUN after the fix surfaced the hidden backlog:
 *   no-cross-feature-internals   109
 *   no-outsider-admin-internals  100
 *   no-spa-edge-source             1   (a false positive — see caveat)
 *   ------------------------------------
 *   total                        210
 *
 * That backlog is now cleared: the count is 0 and all three rules are back to
 * `error`, so any new violation fails CI rather than accumulating. Getting
 * there was mostly not a matter of rerouting imports through barrels — a
 * barrel that also exports its module component transitively reaches most of
 * the app, so routing through one usually closes a cycle instead. What worked
 * was moving things to where they belong: shared data and contracts into
 * src/shared (the product key registry, the goals domain, the client
 * directory, the PDF page shell), a feature's UI into the module that renders
 * it, and a cross-cutting domain into its own module (client-keys). Each such
 * move was checked for cycle safety by reachability on the resolved graph
 * before being applied.
 *
 * TYPE-ONLY CAVEAT: `npx dependency-cruiser@16` runs from its own install and
 * cannot load the project's `typescript`, so it uses a JS-only extractor that
 * does not tag `import type` edges as `type-only` (0 such tags across the graph).
 * That makes `no-spa-edge-source`'s `dependencyTypesNot: ['type-only']` a no-op,
 * so a legitimate `import type` from edge source still counts as a violation.
 * The one that did (useDashboardStats.ts → server/types.ts) has been fixed the
 * way this note suggested — ApplicationStats now lives in src/shared/types —
 * which also turned up that the type had been defined twice and had drifted.
 * The caveat still applies to any FUTURE `import type` from edge source: move
 * the type into src/shared rather than reaching across. The runtime guard is
 * the ESLint `no-restricted-imports` rule (`allowTypeImports: true`).
 *
 * Boundaries enforced (all `error`):
 *   1. no-cross-feature-internals   — module A may not import module B's internals
 *   2. no-outsider-admin-internals  — outsiders may not import admin module internals
 *   3. no-spa-edge-source           — SPA must not import edge (Deno) source at runtime
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-feature-internals',
      comment:
        'Feature modules communicate through their index barrel (index.ts/tsx). ' +
        "Any code inside module A reaching into module B's hooks/, components/, " +
        'api.ts, types.ts, constants.ts etc. creates hidden coupling. ' +
        "Import from B's public barrel instead.",
      severity: 'error',
      from: {
        // Any file inside any one named feature module (group $1 = module name).
        // `from` paths are always fully-resolved disk paths so only `src/` form needed.
        path: '^src/components/admin/modules/([^/]+)/',
        // Test files may use absolute @/ imports into their own module's internals.
        pathNot: ['(\\.test\\.tsx?$|__tests__/)'],
      },
      to: {
        // Match both the resolved `src/` form AND the unresolved `@/` alias form
        // (dep-cruiser leaves unresolvable specifiers as-is in `resolved`).
        path: '^(src|@)/components/admin/modules/',
        pathNot: [
          // Allow importing anything within the SAME module (backreference $1 = module name).
          '^src/components/admin/modules/$1/',
          '^@/components/admin/modules/$1/',
          // Allow importing any other module's public barrel index.
          '^src/components/admin/modules/[^/]+/index\\.tsx?$',
          '^@/components/admin/modules/[^/]+/index\\.tsx?$',
          // index.ts (without x) is also a valid barrel
          '^src/components/admin/modules/[^/]+/index\\.ts$',
          '^@/components/admin/modules/[^/]+/index\\.ts$',
        ],
      },
    },

    {
      name: 'no-outsider-admin-internals',
      comment:
        'Code outside src/components/admin/modules/ must not import admin feature ' +
        "module internals — only through the module's public barrel (index.ts/tsx). " +
        'Examples of forbidden imports: /hooks/useX, /components/X, /api, /types, /constants. ' +
        'If a type or constant is needed outside the module, it should either be ' +
        're-exported from the barrel or moved to src/shared/.',
      severity: 'error',
      from: {
        // Any src/ file that is NOT inside an admin feature module
        path: '^src/',
        pathNot: [
          '^src/components/admin/modules/',
          // Test files are excluded (same rationale as no-cross-feature-internals)
          '\\.test\\.tsx?$',
          '__tests__/',
        ],
      },
      to: {
        // Targeting any admin feature module path …
        path: '^(src|@)/components/admin/modules/[^/]+/',
        // … that is NOT the barrel index
        pathNot: [
          '^src/components/admin/modules/[^/]+/index\\.tsx?$',
          '^@/components/admin/modules/[^/]+/index\\.tsx?$',
          '^src/components/admin/modules/[^/]+/index\\.ts$',
          '^@/components/admin/modules/[^/]+/index\\.ts$',
        ],
      },
    },

    {
      name: 'no-spa-edge-source',
      comment:
        'SPA source must not import Supabase Edge Function (Deno) source at runtime. ' +
        'Call those routes over HTTP; share types via `import type` only. ' +
        'Belt-and-suspenders guard on top of the ESLint no-restricted-imports error.',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: [
          // Edge source itself is allowed to import from edge source
          '^src/supabase/functions/',
          // Test files may import edge types for mocking
          '\\.test\\.(ts|tsx)$',
          '__tests__/',
        ],
      },
      to: {
        path: '^src/supabase/functions/',
        // Allow type-only imports (TypeScript strips these; they don't create
        // runtime coupling even though dep-cruiser sees them statically)
        dependencyTypesNot: ['type-only'],
      },
    },
  ],

  options: {
    /* Resolves the `@/` → `src/` path alias (tsconfig baseUrl + paths). */
    tsConfig: {
      fileName: 'tsconfig.json',
    },

    /* THE RESOLVER FIX (see header). enhanced-resolve must be told which
       extensions to probe, or extension-less relative imports
       (`../admin/AdminLayout`) never resolve and every boundary rule silently
       passes. `.ts`/`.tsx` first so first-party source resolves ahead of any
       stray `.js`. Without this block the gate is vacuous. */
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.d.ts'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },

    /* Follow npm package imports for resolution, but don't recurse into node_modules */
    doNotFollow: {
      path: 'node_modules',
    },

    /* Include TypeScript type-import edges in the graph. NOTE: under
       `npx dependency-cruiser` these are not tagged `type-only` (the JS-only
       extractor cannot see the `type` keyword) — see the TYPE-ONLY CAVEAT in
       the header. Kept on so the edges are at least visible. */
    tsPreCompilationDeps: true,

    moduleSystems: ['es6', 'cjs'],
  },
};
