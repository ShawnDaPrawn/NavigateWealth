/**
 * Render the Bearings newsletter template to a print-ready A4 PDF.
 *
 *   npm run newsletter:render                      # sample issue, template flags on
 *   npm run newsletter:render -- --final           # hide the "illustrative" flags
 *   npm run newsletter:render -- path/to/issue.html --out dist/bearings-2026-12.pdf
 *
 * The output is the PDF the admin Newsletters module (or the monthly intake
 * routine) hands to subscribers, so it must stay under the 5 MB limit in
 * docs/runbooks/newsletter-intake.md. The script fails if it does not, and if
 * any page's content runs past the bottom of its sheet.
 *
 * Uses Playwright's own Chromium. Where that is not installed but another
 * Chromium is, point CHROMIUM_PATH at it.
 */
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const MAX_BYTES = 5 * 1024 * 1024;

const args = process.argv.slice(2);
const final = args.includes('--final');
const outIndex = args.indexOf('--out');
const outPath = path.resolve(
  outIndex >= 0 ? args[outIndex + 1] : 'tmp/newsletter/bearings-newsletter.pdf',
);
const input = path.resolve(
  args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out') ??
    'templates/newsletter/monthly-newsletter.html',
);

await mkdir(path.dirname(outPath), { recursive: true });

const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.goto(pathToFileURL(input).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  if (final) {
    await page.evaluate(() => document.documentElement.classList.remove('is-template'));
  }
  await page.emulateMedia({ media: 'print' });

  const overflowing = await page.$$eval('section.page', (sheets) =>
    sheets.flatMap((sheet, i) => {
      const bottom = sheet.getBoundingClientRect().bottom;
      const over = [...sheet.querySelectorAll('*')].some((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.bottom > bottom + 0.5 && !el.closest('svg.rings');
      });
      return over ? [i + 1] : [];
    }),
  );
  if (overflowing.length > 0) {
    throw new Error(
      `Content runs off page ${overflowing.join(', ')}. Cut copy on that page and render again.`,
    );
  }

  await page.pdf({ path: outPath, preferCSSPageSize: true, printBackground: true });
} finally {
  await browser.close();
}

const { size } = await stat(outPath);
const mb = (size / 1024 / 1024).toFixed(2);
if (size > MAX_BYTES) {
  throw new Error(`${outPath} is ${mb} MB; the newsletter limit is 5 MB.`);
}
console.log(`Wrote ${path.relative(process.cwd(), outPath)} (${mb} MB)`);
