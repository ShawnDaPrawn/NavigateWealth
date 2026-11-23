/**
 * Draws the per-page share images: the 1200×630 pictures WhatsApp, LinkedIn,
 * Facebook, X and iMessage show when a page is linked (og:image).
 *
 * The service pages' images and the site default were drawn from the
 * "Share" boards of the Website Redesign canvas (ShareService and ShareBrand).
 * This script draws the remaining public pages in those same two layouts, so
 * every page a visitor is likely to share gets a picture that says which page
 * it is, not the generic brand card:
 *
 *   photo  ShareService: the page's own hero kicker, heading and lead on the
 *          left, the page's photograph on the right behind a navy fade.
 *   brand  ShareBrand: the same text column beside the compass mark.
 *
 * Each card starts from the board it copies (navigate-wealth.png for brand,
 * retirement-planning.png for photo), so the grid, compass, hairline, logo and
 * domain are the board's own pixels; only the page-specific column (and, for
 * photo cards, the photograph) is redrawn, in the site's own fonts
 * (src/site/fonts). That keeps the new cards indistinguishable in style from
 * the canvas ones.
 *
 * MANUAL, like generate-og-image.mjs: run it after changing a card below and
 * commit the PNGs. It is not part of `npm run build`.
 *
 *   node ./scripts/seo/generate-share-images.mjs            # every card
 *   node ./scripts/seo/generate-share-images.mjs about.png  # just one
 *
 * The copy here is each page's own hero copy, word for word, so the picture
 * matches what the visitor lands on. When a page's hero copy changes, change
 * it here and re-run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const ROOT = path.resolve('.');
const SHARE_DIR = path.join(ROOT, 'public/brand-assets/share');
const PHOTO_DIR = path.join(ROOT, 'public/img/optimized');
const FONT_DIR = path.join(ROOT, 'src/site/fonts');

/** The base board each layout starts from. */
const BASES = {
  brand: path.join(SHARE_DIR, 'navigate-wealth.png'),
  photo: path.join(SHARE_DIR, 'retirement-planning.png'),
};

/** WhatsApp drops preview images much over ~300 KB; stay under it. */
const MAX_BYTES = 300 * 1024;

/**
 * Every card this script owns. `file` is the output under
 * public/brand-assets/share/; `photo` is an image key under
 * public/img/optimized/ (photo layout only); `focus` is the photo's
 * object-position.
 */
export const SHARE_CARDS = [
  {
    file: 'about.png',
    layout: 'photo',
    photo: '61c60b4a45c33d3564e85aaf184ff3f3b9db37f8',
    focus: '60% 50%',
    kicker: 'About Navigate Wealth',
    title: 'Your Trusted',
    accent: 'Financial Partner',
    lead: 'An independent, founder-led practice that helps individuals and families build, protect, and transfer wealth.',
  },
  {
    file: 'team.png',
    layout: 'photo',
    photo: 'founder-shawn-francisco',
    focus: '40% 30%',
    kicker: 'Founder-led practice',
    title: 'Meet Our',
    accent: 'Founder',
    lead: 'Shawn Francisco founded Navigate Wealth in 2024 and works with clients directly.',
  },
  {
    file: 'why-us.png',
    layout: 'photo',
    photo: 'investment-consultation',
    focus: '45% 50%',
    kicker: 'Independent Financial Advice',
    title: 'Why Choose',
    accent: 'Navigate Wealth?',
    lead: 'A truly independent practice: we work for you — not product providers, banks, or shareholders.',
  },
  {
    file: 'services.png',
    layout: 'photo',
    photo: 'services-menu',
    focus: '30% 50%',
    kicker: 'Comprehensive Wealth Management',
    title: 'Financial Solutions for',
    // Non-breaking space: keeps "of Life" together instead of orphaning "Life".
    accent: 'Every Stage of\u00a0Life',
    lead: 'Independent, unbiased advice — from investment management to estate planning — compared across the providers we work with.',
  },
  {
    file: 'individuals.png',
    layout: 'photo',
    photo: 'solutions-menu',
    focus: '50% 40%',
    kicker: 'Independent Financial Advice',
    title: 'Financial Planning',
    accent: 'for Individuals',
    lead: "Smart, confident financial decisions — whether you're starting out, protecting your family, or planning for retirement.",
  },
  {
    file: 'businesses.png',
    layout: 'photo',
    photo: 'employee-benefits-hero',
    focus: '50% 50%',
    kicker: 'Corporate Financial Solutions',
    title: 'Financial Solutions',
    accent: 'for Businesses',
    lead: 'Employee benefits, risk protection, cash management and tax optimisation for businesses of all sizes.',
  },
  {
    file: 'advisers.png',
    layout: 'photo',
    photo: 'company-menu',
    focus: '55% 50%',
    kicker: 'Succession & Practice Management',
    title: 'Succession Planning',
    accent: 'for Advisers',
    lead: "Secure the future of your practice, with smooth transitions that preserve the client relationships you've built.",
  },
  {
    file: 'contact.png',
    layout: 'brand',
    kicker: 'Get in touch · Pretoria',
    title: 'Contact',
    accent: 'Us',
    lead: 'Book a complimentary consultation — in person at our Pretoria office or online, in English or Afrikaans.',
  },
  {
    file: 'consultation.png',
    layout: 'brand',
    kicker: 'Free consultation',
    title: 'Schedule Your',
    accent: 'Free Consultation',
    lead: 'Book a complimentary session, in person or online. Choose a time that works for you — no obligation.',
  },
  {
    file: 'resources.png',
    layout: 'brand',
    kicker: 'Resource Center',
    title: 'Financial Insights &',
    accent: 'Market Intelligence',
    lead: 'Articles, market news and monthly newsletters on investing, retirement, tax and protecting your wealth.',
  },
  {
    file: 'newsletter.png',
    layout: 'brand',
    kicker: 'Monthly newsletter',
    title: 'The Wealth',
    accent: 'Compass',
    lead: 'Our monthly read on markets, retirement, tax and protecting what matters — for South African households.',
  },
  {
    file: 'get-quote.png',
    layout: 'brand',
    kicker: 'Free, no-obligation quote',
    title: 'Get Your',
    accent: 'Personalised Quote',
    lead: 'Insurance, investments, retirement or medical aid — compared across the providers we work with.',
  },
  {
    file: 'ask-vasco.png',
    layout: 'brand',
    kicker: 'AI financial navigator',
    title: 'Ask',
    accent: 'Vasco',
    lead: 'Your AI-powered financial navigator — explore South African finance with no login required.',
  },
  {
    file: 'careers.png',
    layout: 'brand',
    kicker: 'Careers at Navigate Wealth',
    title: 'Build Your Career\u00a0in',
    accent: 'Financial\u00a0Advisory',
    lead: 'Join an independent, founder-led practice that combines modern technology with personalised service.',
  },
  {
    file: 'press.png',
    layout: 'brand',
    kicker: 'Press Centre',
    title: 'News &',
    accent: 'Announcements',
    lead: 'The latest announcements and company news from Navigate Wealth. Media kit available on request.',
  },
  {
    file: 'legal.png',
    layout: 'brand',
    kicker: 'Legal information',
    title: 'Legal &',
    accent: 'Compliance',
    lead: 'Our legal documents, privacy policies and regulatory disclosures, in one place.',
  },
];

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fileUrl = (file) => pathToFileURL(file).href;

/**
 * The page-specific column, positioned where the boards put it: 72px margin,
 * kicker rule at y≈79, the column ending above the footer hairline (y 523).
 */
function cardHtml(card) {
  const isPhoto = card.layout === 'photo';
  const photoFile = isPhoto ? path.join(PHOTO_DIR, `${card.photo}-1440.webp`) : null;
  if (photoFile && !fs.existsSync(photoFile)) {
    throw new Error(`${card.file}: photo ${photoFile} does not exist`);
  }

  // Photo cards: heading 586 wide (the board's hairline, 72→658), lead to
  // ~670; the photo fills x 730→1200 on plain navy. Brand cards: the lead may
  // run to ~760, beside the compass, over the board's 96px grid.
  const columnWidth = isPhoto ? 600 : 690;
  const clipRight = isPhoto ? 730 : 790;
  const grid = isPhoto
    ? 'none'
    : 'linear-gradient(to right, #141c2c 1px, transparent 1px), linear-gradient(to bottom, #141c2c 1px, transparent 1px)';

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  @font-face { font-family: 'Inter NW'; src: url('${fileUrl(path.join(FONT_DIR, 'inter-latin-wght-normal.woff2'))}') format('woff2'); font-weight: 100 900; }
  @font-face { font-family: 'Newsreader NW'; src: url('${fileUrl(path.join(FONT_DIR, 'newsreader-latin-standard-normal.woff2'))}') format('woff2'); font-weight: 200 800; font-style: normal; }
  @font-face { font-family: 'Newsreader NW'; src: url('${fileUrl(path.join(FONT_DIR, 'newsreader-latin-standard-italic.woff2'))}') format('woff2'); font-weight: 200 800; font-style: italic; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; background: #0d1626; }
  .base { position: absolute; inset: 0; width: 1200px; height: 630px; }
  /* Paint the board's background back over the column being redrawn. */
  .wipe {
    position: absolute; inset: 0;
    background-color: #0d1626;
    background-image: ${grid};
    background-size: 96px 96px;
    clip-path: inset(36px ${1200 - clipRight}px 114px 0);
  }
  .photo { position: absolute; top: 0; left: 730px; width: 470px; height: 630px; overflow: hidden; }
  .photo img { width: 100%; height: 100%; object-fit: cover; object-position: ${escapeHtml(card.focus || '50% 50%')}; display: block; }
  .photo::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(90deg, #0d1626 0%, rgba(13,22,38,0.92) 6%, rgba(13,22,38,0.55) 20%, rgba(13,22,38,0.18) 32%, rgba(13,22,38,0) 40%);
  }
  .col { position: absolute; left: 72px; top: 68px; width: ${columnWidth}px; }
  .kicker {
    display: flex; align-items: center; gap: 12px;
    font: 500 11.5px/20px 'Inter NW', sans-serif; letter-spacing: 0.14em; text-transform: uppercase;
    color: #9aa3b2;
  }
  .kicker::before { content: ''; width: 24px; height: 1px; background: #707887; flex: none; }
  h1 {
    margin-top: 24px; max-width: 586px;
    font: 400 68px/67px 'Newsreader NW', serif; letter-spacing: -0.012em;
    color: #f6f4ef;
  }
  h1 em { font-style: italic; color: #e3d9c3; }
  .lead {
    margin-top: 26px;
    font: 400 22px/33px 'Inter NW', sans-serif;
    color: #c5cad3;
  }
  .marks { margin-top: 26px; display: flex; gap: 22px; font: 400 16px/20px 'Inter NW', sans-serif; color: #9aa2af; }
  .marks span { display: inline-flex; align-items: center; gap: 8px; }
  .marks svg { flex: none; }
</style></head>
<body>
  <img class="base" src="${fileUrl(BASES[card.layout])}" alt="" />
  <div class="wipe"></div>
  ${photoFile ? `<div class="photo"><img src="${fileUrl(photoFile)}" alt="" /></div>` : ''}
  <div class="col">
    <p class="kicker">${escapeHtml(card.kicker)}</p>
    <h1>${escapeHtml(card.title)} <em>${escapeHtml(card.accent)}</em></h1>
    <p class="lead">${escapeHtml(card.lead)}</p>
    ${
      isPhoto
        ? `<p class="marks">
      <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#47d67c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>FSP 54606</span>
      <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#47d67c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Independent advice</span>
    </p>`
        : ''
    }
  </div>
</body></html>`;
}

async function launch() {
  try {
    return await chromium.launch();
  } catch {
    // The Claude Code sandbox ships its own Chromium build.
    return chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }
}

/** Render `cards` into `outDir` (public/brand-assets/share/ by default). */
export async function renderCards(cards, outDir = SHARE_DIR) {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const tmpDir = fs.mkdtempSync(path.join(outDir, '.tmp-'));
  try {
    for (const card of cards) {
      const htmlFile = path.join(tmpDir, `${card.file}.html`);
      fs.writeFileSync(htmlFile, cardHtml(card), 'utf8');
      await page.goto(fileUrl(htmlFile));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() =>
        [...document.images].every((image) => image.complete && image.naturalWidth > 0),
      );

      // The heading must stay above the footer hairline (y 523).
      const bottom = await page.evaluate(() => {
        const col = document.querySelector('.col');
        return col ? col.getBoundingClientRect().bottom : 0;
      });
      if (bottom > 505) {
        throw new Error(`${card.file}: the text column runs into the footer (bottom ${bottom}px)`);
      }

      // The canvas boards ship as 256-colour palette PNGs (that is how a photo
      // card stays under 300 KB); quantise the same way.
      const out = path.join(outDir, card.file);
      const shot = await page.screenshot({ type: 'png' });
      await sharp(shot)
        .withMetadata({ density: 72 })
        .png({
          palette: true,
          colours: 256,
          quality: 100,
          dither: 1,
          effort: 10,
          compressionLevel: 9,
        })
        .toFile(out);
      const size = fs.statSync(out).size;
      if (size > MAX_BYTES) {
        throw new Error(`${card.file}: ${Math.round(size / 1024)} KB is over the 300 KB budget`);
      }
      console.log(`${card.file}  ${Math.round(size / 1024)} KB`);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await browser.close();
  }
}

async function main() {
  const only = new Set(process.argv.slice(2));
  const cards = only.size ? SHARE_CARDS.filter((card) => only.has(card.file)) : SHARE_CARDS;
  if (!cards.length) throw new Error(`No card matches ${[...only].join(', ')}`);
  await renderCards(cards);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
