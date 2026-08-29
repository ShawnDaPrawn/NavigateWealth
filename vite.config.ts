import fs from 'fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

/**
 * Resolves `figma:asset/<hash>.png` imports to files under `src/assets`,
 * preferring an optimized sibling when one exists. This replaces the previous
 * ~240 hand-maintained static aliases with a single dynamic resolver, so new
 * exported assets work without editing this config.
 *
 * THE CANDIDATE ORDER IS LOad-BEARING, and getting it wrong is silent.
 * This looked only for `.webp`. There are no `.webp` files in src/assets and
 * never have been — the optimized exports are `.jpg` — so the candidate never
 * matched and every import fell through to the original. Those originals are
 * raw Figma exports at up to 8256x5504: 62 of the 84 imported assets were
 * being served at 25-31 MB each when a 2200x1467 sibling of ~300 KB sat next
 * to them unused. The home page alone shipped ~125 MB of images.
 *
 * A miss here costs nothing visible in development, where everything is local
 * and fast. It costs the user their data bundle. `figma-asset-weight.test.ts`
 * now fails the build if any import resolves to something oversized, so this
 * cannot silently come back.
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
      // Best format first, original last. `.webp` stays ahead of `.jpg` so that
      // converting an asset later is a drop-in improvement with no code change.
      const candidates = [
        `${parsed.name}.webp`,
        `${parsed.name}.avif`,
        `${parsed.name}.jpg`,
        `${parsed.name}.jpeg`,
        filename,
      ];
      const match = candidates.find((candidate) =>
        fs.existsSync(path.join(assetDirectory, candidate)),
      );
      return path.join(assetDirectory, match ?? filename);
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

  // Split, not grouped. `sonner`'s toast() is imported by Footer.tsx and
  // DashboardNavigation.tsx — both eager dependencies of MainLayout — so
  // whatever chunk holds it is modulepreloaded on every route. `motion` is
  // reachable only from eleven leaf components (the e-sign signer, two admin
  // dialogs, ConsultationModal, ProductsServicesPage), none of them on the
  // first-paint path. Sharing one chunk pulled the larger of the two into the
  // critical path of every page to serve the smaller.
  if (id.includes('/sonner/')) {
    return 'vendor-toast';
  }

  if (id.includes('/motion/')) {
    return 'vendor-motion';
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
