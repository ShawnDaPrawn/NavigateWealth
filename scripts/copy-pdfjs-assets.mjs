/**
 * Copy pdf.js runtime assets out of node_modules into public/.
 *
 * WHY THIS EXISTS
 * ---------------
 * Three components set `pdfjsLib.GlobalWorkerOptions.workerSrc` and
 * `standardFontDataUrl` to `https://cdn.jsdelivr.net/...`. One of them is
 * `src/components/esign-signer/SigningWorkflow.tsx` — the flow a CLIENT uses to
 * read and sign a document. So the critical path of the e-sign product ran
 * through a third-party CDN: if jsdelivr is unreachable, signing stops; if it
 * serves something else, that code runs in the page holding the document and
 * the signature.
 *
 * It also made the Content-Security-Policy unenforceable. `worker-src 'self'
 * blob:` forbids a cross-origin worker, so promoting the report-only policy
 * would have broken signing — and the earlier CSP probe missed it, because it
 * drove 8 public marketing routes and the signer flow was not among them.
 *
 * The worker itself is handled in source by Vite (`?url` import), which emits it
 * as a hashed same-origin asset. The standard fonts cannot be: pdf.js wants a
 * DIRECTORY prefix it appends filenames to at runtime, so the whole folder has
 * to exist at a stable path. Copying it here keeps it version-locked to the
 * installed pdfjs-dist rather than to a hard-coded version string.
 *
 * public/pdfjs/ is generated and gitignored. Run `npm run pdfjs:assets` if a
 * dev server needs it without a full build.
 */
import { cp, mkdir, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'node_modules/pdfjs-dist/standard_fonts');
const dest = resolve(root, 'public/pdfjs/standard_fonts');

if (!existsSync(src)) {
  console.error(
    `[pdfjs-assets] ${src} does not exist. Is pdfjs-dist installed? ` +
      'Run npm ci before building.',
  );
  process.exit(1);
}

const { version } = JSON.parse(
  await readFile(resolve(root, 'node_modules/pdfjs-dist/package.json'), 'utf8'),
);

// Remove first: a stale font from a previous pdfjs version would otherwise sit
// alongside the current set and be served indefinitely.
await rm(resolve(root, 'public/pdfjs'), { recursive: true, force: true });
await mkdir(dirname(dest), { recursive: true });
await cp(src, dest, { recursive: true });

console.log(
  `[pdfjs-assets] copied pdfjs-dist@${version} standard_fonts -> public/pdfjs/standard_fonts`,
);
