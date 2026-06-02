/**
 * dependency-cruiser boundary rules (Phase 7 hardening).
 *
 * Run locally:  npx dependency-cruiser@16 'src/**\/*.{ts,tsx}' --config .dependency-cruiser.cjs
 * CI gate:      see .github/workflows/quality-check.yml "Run dependency-cruiser"
 *
 * Two hard boundaries are enforced:
 *
 *   1. no-cross-feature-internals
 *      Feature modules (src/components/admin/modules/<name>/) may only expose
 *      themselves through their barrel index.  Any code importing a non-index
 *      file from a *different* feature module will fail CI.
 *
 *   2. no-spa-edge-source
 *      The SPA bundle must never import Supabase Edge Function (Deno) source
 *      at runtime — those routes are called over HTTP.  Type-only imports are
 *      permitted (allowTypeImports: true in eslint.config.mjs mirrors this).
 *      This rule provides a build-graph–level double-guard on top of the
 *      existing ESLint no-restricted-imports error.
 *
 * Path-alias note: the project uses `@/` → `src/` (tsconfig baseUrl + paths).
 * dep-cruiser resolves these via tsConfig but when resolution fails (e.g. the
 * target doesn't exist on disk), the `resolved` field is left as the original
 * specifier.  Both `src/...` (resolved) and `@/...` (unresolved alias) forms
 * are therefore matched in every pattern below.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-feature-internals',
      comment:
        'Feature modules communicate through their index barrel (index.tsx). ' +
        "Reaching into another module's internal files creates hidden coupling. " +
        "Import from the module's public index instead of its hooks/, components/, api.ts, etc.",
      severity: 'error',
      from: {
        // Any file inside any one named feature module (group $1 = module name).
        // `from` paths are always fully-resolved disk paths so only `src/` form needed.
        path: '^src/components/admin/modules/([^/]+)/',
        // Exclude test files — they use absolute `@/` imports into their own module's
        // internals for subject imports and that is acceptable.
        pathNot: ['(\\.test\\.tsx?$|__tests__/)'],
      },
      to: {
        // Match both the resolved `src/` form AND the unresolved `@/` alias form
        // (dep-cruiser leaves unresolvable specifiers as-is in `resolved`).
        path: '^(src|@)/components/admin/modules/',
        pathNot: [
          // Allow importing anything within the SAME module (backreference $1 = module name).
          // Covers both src/ and @/ forms.
          '^src/components/admin/modules/$1/',
          '^@/components/admin/modules/$1/',
          // Allow importing any other module's public barrel index.
          '^src/components/admin/modules/[^/]+/index\\.tsx?$',
          '^@/components/admin/modules/[^/]+/index\\.tsx?$',
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
    /* dep-cruiser uses the TypeScript compiler API for path resolution when
       tsConfig.fileName is set. This resolves @/ → src/ for most imports.
       See the path-alias note in the file header for the fallback strategy. */
    tsConfig: {
      fileName: 'tsconfig.json',
    },

    /* Follow npm package imports for resolution, but don't recurse into node_modules */
    doNotFollow: {
      path: 'node_modules',
    },

    /* Include TypeScript type-import edges so `import type` is visible to the
       no-spa-edge-source rule's dependencyTypesNot filter */
    tsPreCompilationDeps: true,

    moduleSystems: ['es6', 'cjs'],
  },
};
