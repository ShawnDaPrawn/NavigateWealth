import fs from 'fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

/**
 * Resolves `figma:asset/<hash>.png` imports to files under `src/assets`,
 * preferring an optimized `.webp` when one exists. This replaces the previous
 * ~240 hand-maintained static aliases with a single dynamic resolver, so new
 * exported assets work without editing this config.
 */
function figmaAssetResolver(): Plugin {
  const assetDirectory = path.resolve(__dirname, './src/assets');
  return {
    name: 'figma-asset-resolver',
    enforce: 'pre',
    resolveId(source: string) {
      if (!source.startsWith('figma:asset/')) return null;
      const filename = source.slice('figma:asset/'.length);
      const parsed = path.parse(filename);
      const candidates = [`${parsed.name}.webp`, filename];
      const match = candidates.find((candidate) =>
        fs.existsSync(path.join(assetDirectory, candidate)),
      );
      return path.join(assetDirectory, match ?? filename);
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
 * The Supabase origin is resolved at build time from the same env vars as
 * `src/utils/supabase/info.tsx`, so a deployment pointed at a different project
 * preconnects to that project rather than to a hardcoded one.
 */
function connectionHints(): Plugin {
  let supabaseOrigin: string | undefined;

  return {
    name: 'connection-hints',
    configResolved(config) {
      const env = config.env as Record<string, string | undefined>;
      const projectId =
        env.VITE_SUPABASE_PROJECT_ID ||
        projectIdFromUrl(env.VITE_SUPABASE_URL) ||
        FALLBACK_PROJECT_ID;
      supabaseOrigin = `https://${projectId}.supabase.co`;
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
 * Mirrors `src/utils/supabase/info.tsx`. That module cannot be imported here —
 * it reads `import.meta.env`, which only exists inside the bundle.
 */
const FALLBACK_PROJECT_ID = 'vpjmdsltwrnpefzcgdmz';

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
