import fs from 'fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

/**
 * Resolves `figma:asset/<hash>.png` imports to the smallest usable file,
 * replacing the previous ~240 hand-maintained static aliases with one dynamic
 * resolver so new exported assets work without editing this config.
 *
 * THE CANDIDATE ORDER IS LOAD-BEARING, and getting it wrong is silent.
 * This once looked only for `<hash>.webp` in `src/assets`. There are no `.webp`
 * files there and never have been — the optimized exports are `.jpg` — so the
 * candidate never matched and every import fell through to the original. Those
 * originals are raw Figma exports at up to 8256x5504: 62 of the 84 imported
 * assets were being served at 25-31 MB each when a 2200x1467 sibling of ~300 KB
 * sat next to them unused. The home page alone shipped ~125 MB of images.
 *
 * The ladder now has two halves, and each covers the other's weakness:
 *
 *   1. `node_modules/.cache/figma-webp/<hash>.webp` — built by
 *      `scripts/generate-figma-webp.mjs` as a pre-build step, capped at 500 KB
 *      per image. This is what production actually serves: 811 MB of originals
 *      become 10 MB. It is generated, never committed, and Vercel persists the
 *      directory so the resize is paid once rather than per deploy.
 *
 *   2. The committed siblings in `src/assets` — `.webp`, `.avif`, `.jpg`,
 *      `.jpeg`, then the original. This is the answer to "what if the cache is
 *      cold, or the generator failed, or someone runs `vite build` directly?"
 *      Without it a cache miss silently reinstates the 31 MB PNGs; with it the
 *      worst case for the 62 assets that have a sibling is a 300 KB JPEG.
 *
 * So the cache is the optimization and the siblings are the floor. Neither
 * alone is safe: the cache can vanish, and the siblings do not cover all 84.
 *
 * A miss here costs nothing visible in development, where everything is local
 * and fast. It costs the user their data bundle. `figma-asset-weight.test.ts`
 * mirrors this list and fails on anything oversized — deliberately measuring
 * the cold path, since that is the one no build step is watching.
 */
function figmaAssetResolver(): Plugin {
  const assetDirectory = path.resolve(__dirname, './src/assets');
  const webpCacheDirectory = path.resolve(__dirname, './node_modules/.cache/figma-webp');
  return {
    name: 'figma-asset-resolver',
    enforce: 'pre',
    resolveId(source: string) {
      if (!source.startsWith('figma:asset/')) return null;
      const filename = source.slice('figma:asset/'.length);
      const parsed = path.parse(filename);
      // Generated best-effort first, committed fallbacks next, original last.
      // `.webp` stays ahead of `.jpg` so converting an asset by hand later is a
      // drop-in improvement with no code change.
      const candidates = [
        path.join(webpCacheDirectory, `${parsed.name}.webp`),
        path.join(assetDirectory, `${parsed.name}.webp`),
        path.join(assetDirectory, `${parsed.name}.avif`),
        path.join(assetDirectory, `${parsed.name}.jpg`),
        path.join(assetDirectory, `${parsed.name}.jpeg`),
        path.join(assetDirectory, filename),
      ];
      return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates.at(-1)!;
    },
  };
}

/**
 * Injects connection hints for the origins the app genuinely contacts on boot.
 *
 * These used to be created in a `useEffect` inside `<PerformanceOptimizer/>`,
 * which is far too late to be worth anything: by the time React has mounted,
 * the entry bundle has already downloaded and the auth bootstrap is issuing its
 * first Supabase request, so the handshake the hint was meant to overlap has
 * already started. In the static `<head>` the preconnect is visible to the
 * browser's preload scanner while the bundle is still in flight, so DNS + TCP +
 * TLS to Supabase resolve in parallel with it rather than after it.
 *
 * The origin is resolved at build time by the same rule the browser client
 * resolves it by (see `resolveSupabaseUrl`), so a deployment pointed at another
 * project, a custom domain or a local stack preconnects to what it will
 * actually call rather than to a hardcoded production host.
 */
function connectionHints(): Plugin {
  let supabaseOrigin: string | undefined;

  return {
    name: 'connection-hints',
    configResolved(config) {
      const env = config.env as Record<string, string | undefined>;
      supabaseOrigin = originOf(resolveSupabaseUrl(env));
    },
    transformIndexHtml() {
      if (!supabaseOrigin) return [];
      return [
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: supabaseOrigin, crossorigin: '' },
          injectTo: 'head-prepend' as const,
        },
      ];
    },
  };
}

/**
 * Mirrors the `supabaseUrl` export of `src/utils/supabase/info.tsx` — the exact
 * value `createClient` is handed, and so the origin the browser really opens.
 * That module cannot be imported here: it reads `import.meta.env`, which only
 * exists inside the bundle.
 *
 * Deriving this from `projectId` instead would be subtly wrong, because
 * `projectId` prefers `VITE_SUPABASE_PROJECT_ID` while the client prefers
 * `VITE_SUPABASE_URL`. Wherever the two disagree — a custom domain or a
 * `localhost` stack, neither of which `projectIdFromUrl` can parse, or the two
 * vars simply set inconsistently — the hint would warm a connection to one
 * origin while every request paid full handshake to another: the cost of a
 * preconnect with none of the benefit.
 */
const FALLBACK_PROJECT_ID = 'vpjmdsltwrnpefzcgdmz';

function resolveSupabaseUrl(env: Record<string, string | undefined>): string {
  const projectId =
    env.VITE_SUPABASE_PROJECT_ID || projectIdFromUrl(env.VITE_SUPABASE_URL) || FALLBACK_PROJECT_ID;
  return env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
}

/** The origin to preconnect to, or undefined if the URL will not parse. */
function originOf(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function projectIdFromUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Maps a module id to the npm package that owns it.
 *
 * Chunk assignment used to be a series of `id.includes('/react/')`-style
 * substring tests, which is not the same question as "which package is this?".
 * `/react/` matches `node_modules/@tiptap/react/…` and
 * `node_modules/@vercel/analytics/dist/react/…`; `/react-dom/` matches
 * `node_modules/@floating-ui/react-dom/…`. Pinning `@tiptap/react` into
 * `vendor-react` pulled its exclusive dependency graph — prosemirror-view,
 * prosemirror-model, @tiptap/core, the lot — into the one chunk that every
 * visitor must download, because React lives there too. That put a 795 KB
 * rich-text editor, used only by the admin publications module, on the
 * critical path of the marketing homepage.
 *
 * Matching the package name instead makes each rule mean what it says.
 */
function packageNameFromId(id: string): string | undefined {
  const match = /[\\/]node_modules[\\/](?!\.)((?:@[^\\/]+[\\/])?[^\\/]+)/.exec(id);
  return match?.[1]?.replace(/\\/g, '/');
}

/** Exact package name -> chunk. */
const PACKAGE_CHUNKS = new Map<string, string>([
  ['react', 'vendor-react'],
  ['react-dom', 'vendor-react'],
  ['scheduler', 'vendor-react'],

  ['react-router', 'vendor-router'],

  ['@supabase/supabase-js', 'vendor-supabase'],
  ['@jsr/supabase__supabase-js', 'vendor-supabase'],

  ['react-hook-form', 'vendor-forms'],
  ['@hookform/resolvers', 'vendor-forms'],
  ['zod', 'vendor-forms'],

  ['@tanstack/react-query', 'vendor-data'],
  ['@tanstack/react-virtual', 'vendor-data'],

  // sonner only. `motion` is deliberately NOT here — see vendor-motion below.
  ['sonner', 'vendor-feedback'],

  // Animation. Kept out of vendor-feedback because `sonner` renders the app-wide
  // <Toaster/> in AppProviders and is therefore eager, whereas every `motion`
  // import in this repo sits behind a lazy route (esign signer, admin modules,
  // one product page). Grouped together, the eager toast dragged 383 KB of
  // animation library onto first paint.
  ['motion', 'vendor-motion'],
  ['framer-motion', 'vendor-motion'],
  ['motion-dom', 'vendor-motion'],
  ['motion-utils', 'vendor-motion'],

  ['@hello-pangea/dnd', 'vendor-dnd'],

  ['react-quill-new', 'vendor-quill'],
  ['quill', 'vendor-quill'],

  ['pdf-lib', 'vendor-pdf-lib'],
  ['node-forge', 'vendor-signpdf'],
  ['pdfjs-dist', 'vendor-pdf-viewer'],

  ['docx', 'vendor-docx'],
  ['@zip.js/zip.js', 'vendor-docx'],

  ['xlsx', 'vendor-xlsx'],
  ['@e965/xlsx', 'vendor-xlsx'],

  ['recharts', 'vendor-charts'],

  ['vaul', 'vendor-ui'],
  ['cmdk', 'vendor-ui'],
  ['input-otp', 'vendor-ui'],
  ['embla-carousel-react', 'vendor-ui'],
  ['react-resizable-panels', 'vendor-ui'],

  ['lucide-react', 'vendor-foundation'],
  ['class-variance-authority', 'vendor-foundation'],
  ['clsx', 'vendor-foundation'],
  ['tailwind-merge', 'vendor-foundation'],

  ['date-fns', 'vendor-date'],
]);

/** Scope/prefix -> chunk, for families published as many small packages. */
const SCOPE_CHUNKS: ReadonlyArray<readonly [string, string]> = [
  ['@signpdf/', 'vendor-signpdf'],
  // Radix stays ONE chunk on purpose. Leaving these packages unassigned so
  // Rollup could place each one by usage looks like the tidier answer — the
  // entry would pull only the primitives it needs — but it measures far worse:
  // the eager graph goes 369 KB -> 554 KB gzipped across 13 preloads instead of
  // 9, because the automatic algorithm splits primitives shared between the
  // eager shell and lazy routes into several chunks the entry must then preload
  // in full. Measured 2026-08-29; do not "fix" this without re-measuring.
  ['@radix-ui/', 'vendor-ui'],
  // Radix's popper primitives are the main consumer, so floating-ui rides with
  // the UI chunk rather than forming a third chunk both of them would pull in.
  ['@floating-ui/', 'vendor-ui'],
  // The rich-text editor: admin publications only, and lazily routed.
  ['@tiptap/', 'vendor-editor'],
  ['prosemirror-', 'vendor-editor'],
];

function getManualChunk(id: string): string | undefined {
  const packageName = packageNameFromId(id);
  if (!packageName) {
    return undefined;
  }

  const exact = PACKAGE_CHUNKS.get(packageName);
  if (exact) {
    return exact;
  }

  for (const [prefix, chunk] of SCOPE_CHUNKS) {
    if (packageName.startsWith(prefix)) {
      return chunk;
    }
  }

  return undefined;
}

export default defineConfig({
  plugins: [react(), tailwindcss(), figmaAssetResolver(), connectionHints()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    // Explicit URL helps the default browser open reliably on Windows; app is NOT on :300
    open: 'http://localhost:3000/',
  },
});
