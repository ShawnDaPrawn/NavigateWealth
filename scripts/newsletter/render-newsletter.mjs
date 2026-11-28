/**
 * Render The Wealth Compass, the monthly newsletter template, to a print-ready A4 PDF.
 *
 *   npm run newsletter:render                      # the sample issue, template flags on
 *   npm run newsletter:render -- --final           # the sample, flags hidden
 *   npm run newsletter:render -- --content tmp/newsletter/2026-12.json --final \
 *     --out tmp/newsletter/the-wealth-compass-2026-12.pdf --preview tmp/newsletter/preview-2026-12
 *
 * An issue is a content file, not a copy of the template. The file names every
 * data-field slot in templates/newsletter/monthly-newsletter.html and gives
 * its HTML (or null to drop the slot), plus the markets chart as data; see
 * templates/newsletter/issue.sample.json for the shape and the markup each
 * slot expects. The script fills the template in the browser, so the fonts
 * and logos always resolve, and then checks the result before printing.
 *
 * It fails, and writes no PDF, when:
 *   - the content file names a slot the template does not have (a typo);
 *   - with --final, the content file leaves a slot out, or is still the sample;
 *   - any page's content runs off its sheet, below or to the right;
 *   - the PDF is over the 5 MB newsletter limit (docs/runbooks/newsletter-intake.md).
 *
 * --preview <dir> also saves each page as a PNG, for proofreading the layout.
 *
 * Uses Playwright's own Chromium. Where that is not installed but another
 * Chromium is, point CHROMIUM_PATH at it.
 */
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { buildChart } from './newsletter-chart.mjs';

const MAX_BYTES = 5 * 1024 * 1024;
const TEMPLATE = 'templates/newsletter/monthly-newsletter.html';

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const VALUE_FLAGS = new Set(['--out', '--content', '--preview']);
const final = args.includes('--final');
const outPath = path.resolve(valueOf('--out') ?? 'tmp/newsletter/the-wealth-compass.pdf');
const contentPath = valueOf('--content');
const previewDir = valueOf('--preview');
const input = path.resolve(
  args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1])) ?? TEMPLATE,
);

let content = null;
if (contentPath) {
  content = JSON.parse(await readFile(path.resolve(contentPath), 'utf8'));
  if (!content || typeof content !== 'object' || typeof content.fields !== 'object') {
    throw new Error(`${contentPath} must be an object with a "fields" object`);
  }
  if (final && content.meta?.sample === true) {
    throw new Error(
      `${contentPath} is still marked as the sample issue (meta.sample). Write the issue's own content, then set meta.sample to false.`,
    );
  }
}

let chartMarkup = null;
if (content && content.chart) chartMarkup = buildChart(content.chart);

await mkdir(path.dirname(outPath), { recursive: true });

const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.goto(pathToFileURL(input).href, { waitUntil: 'networkidle' });

  if (content) {
    const problems = await page.evaluate(
      ({ fields, chart, chartMarkup: markup, requireAll }) => {
        const errors = [];
        const slots = new Set(
          [...document.querySelectorAll('[data-field]')].map((el) => el.dataset.field),
        );
        const given = { ...fields };
        if (markup) {
          if ('chart.svg' in given || 'chart.legend' in given) {
            errors.push(
              'give the chart either as "chart" data or as chart.svg/chart.legend, not both',
            );
          }
          given['chart.svg'] = markup.svg;
          given['chart.legend'] = markup.legend;
        }
        if (chart === null) {
          document.querySelectorAll('.card.chart').forEach((el) => el.remove());
          for (const name of ['chart.title', 'chart.sub', 'chart.svg', 'chart.legend']) {
            slots.delete(name);
            delete given[name];
          }
        }
        for (const name of Object.keys(given)) {
          if (!slots.has(name)) errors.push(`unknown slot "${name}"`);
        }
        if (requireAll) {
          for (const name of slots) {
            if (!(name in given)) errors.push(`missing slot "${name}"`);
          }
        }
        if (errors.length) return errors;
        for (const [name, html] of Object.entries(given)) {
          document.querySelectorAll(`[data-field="${CSS.escape(name)}"]`).forEach((el) => {
            if (html === null) el.remove();
            else el.innerHTML = String(html);
          });
        }
        return [];
      },
      {
        fields: content.fields,
        chart: content.chart,
        chartMarkup,
        requireAll: final,
      },
    );
    if (problems.length > 0) {
      throw new Error(`Content file ${contentPath}:\n  - ${problems.join('\n  - ')}`);
    }
    if (content.meta?.title) {
      await page.evaluate((title) => {
        document.title = title;
      }, String(content.meta.title));
    }
  }

  await page.evaluate(() => document.fonts.ready);
  if (final) {
    await page.evaluate(() => document.documentElement.classList.remove('is-template'));
  }
  await page.emulateMedia({ media: 'print' });

  const overflowing = await page.$$eval('section.page', (sheets) =>
    sheets.flatMap((sheet, i) => {
      // Text that does not fit a column layout spills into new columns to the
      // right, not below, so check both edges, fragment by fragment.
      const box = sheet.getBoundingClientRect();
      const over = [...sheet.querySelectorAll('*')].some((el) => {
        if (el.closest('svg.rings')) return false; // the cover art bleeds on purpose
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).columnCount !== 'auto') {
          return true;
        }
        return [...el.getClientRects()].some(
          (r) =>
            r.width > 0 &&
            r.height > 0 &&
            (r.bottom > box.bottom + 0.5 || r.right > box.right + 0.5),
        );
      });
      return over ? [i + 1] : [];
    }),
  );

  if (previewDir) {
    const dir = path.resolve(previewDir);
    await mkdir(dir, { recursive: true });
    const sheets = await page.$$('section.page');
    for (let i = 0; i < sheets.length; i += 1) {
      await sheets[i].screenshot({
        path: path.join(dir, `page-${String(i + 1).padStart(2, '0')}.png`),
      });
    }
  }

  if (overflowing.length > 0) {
    await rm(outPath, { force: true });
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
