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
 *
 * The `.webp` preference used to be dead code: nothing generated a sibling, so
 * every import fell through to a raw Figma export and Vite emitted 811 MB of
 * camera-resolution originals into `dist/` (A7). `scripts/generate-figma-webp.mjs`
 * now produces those variants into `node_modules/.cache/figma-webp/`, which is
 * checked first here. Generated binaries stay out of git, and a cold cache is
 * only a size regression, never a broken build — the original remains the last
 * candidate, so the app renders either way.
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
      const candidates = [
        path.join(webpCacheDirectory, `${parsed.name}.webp`),
        path.join(assetDirectory, `${parsed.name}.webp`),
        path.join(assetDirectory, filename),
      ];
      return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates.at(-1)!;
    },
  };
}

function getManualChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  if (id.includes('/react/') || id.includes('/react-dom/')) {
    return 'vendor-react';
  }

  if (id.includes('/react-router/')) {
    return 'vendor-router';
  }

  if (id.includes('/@supabase/supabase-js/') || id.includes('/@jsr/supabase__supabase-js/')) {
    return 'vendor-supabase';
  }

  if (
    id.includes('/react-hook-form/') ||
    id.includes('/@hookform/resolvers/') ||
    id.includes('/zod/')
  ) {
    return 'vendor-forms';
  }

  if (id.includes('/@tanstack/react-query/') || id.includes('/@tanstack/react-virtual/')) {
    return 'vendor-data';
  }

  if (id.includes('/motion/') || id.includes('/sonner/')) {
    return 'vendor-feedback';
  }

  if (id.includes('/@hello-pangea/dnd/')) {
    return 'vendor-dnd';
  }

  if (id.includes('/react-quill-new/') || id.includes('/quill/')) {
    return 'vendor-quill';
  }

  if (id.includes('/pdf-lib/')) {
    return 'vendor-pdf-lib';
  }

  if (id.includes('/node-forge/') || id.includes('/@signpdf/')) {
    return 'vendor-signpdf';
  }

  if (id.includes('/pdfjs-dist/')) {
    return 'vendor-pdf-viewer';
  }

  if (id.includes('/docx/') || id.includes('/@zip.js/zip.js/')) {
    return 'vendor-docx';
  }

  if (id.includes('/xlsx/') || id.includes('/@e965/xlsx/')) {
    return 'vendor-xlsx';
  }

  if (id.includes('/recharts/')) {
    return 'vendor-charts';
  }

  if (
    id.includes('/@radix-ui/') ||
    id.includes('/vaul/') ||
    id.includes('/cmdk/') ||
    id.includes('/input-otp/') ||
    id.includes('/embla-carousel-react/') ||
    id.includes('/react-resizable-panels/')
  ) {
    return 'vendor-ui';
  }

  if (
    id.includes('/lucide-react/') ||
    id.includes('/class-variance-authority/') ||
    id.includes('/clsx/') ||
    id.includes('/tailwind-merge/')
  ) {
    return 'vendor-foundation';
  }

  if (id.includes('/date-fns/')) {
    return 'vendor-date';
  }

  return undefined;
}

export default defineConfig({
  plugins: [react(), tailwindcss(), figmaAssetResolver()],
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
