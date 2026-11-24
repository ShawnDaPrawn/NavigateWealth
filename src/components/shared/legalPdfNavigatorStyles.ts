/**
 * The Navigator legal PDF's stylesheet.
 *
 * Every rule is the public site's, scaled for paper: the cover is the legal
 * hub's ink hero, the facts and contents are the document page's fact cards
 * and contents card, and the text is `.nwld-prose` (src/site/styles/legal.css)
 * taken from 17px on screen to 10pt. The fonts are the site's own files, so
 * the PDF uses exactly the faces the website does, wherever it is opened from
 * (the public site, the admin preview or a sign-up dialog).
 *
 * All selectors sit under `.nwlp`, the preview root, so nothing here reaches
 * the page around it and nothing outside reaches in. The print rules at the end
 * run in the print window, which copies this stylesheet with the markup.
 */
import interFontUrl from '../../site/fonts/inter-latin-wght-normal.woff2?url';
import newsreaderFontUrl from '../../site/fonts/newsreader-latin-standard-normal.woff2?url';

export const LEGAL_PDF_NAVIGATOR_FONTS = {
  sans: "'NWLP Inter', 'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
  serif: "'NWLP Newsreader', 'Newsreader Variable', Georgia, 'Times New Roman', serif",
} as const;

/** The faces the layout waits for before it measures anything. */
export const LEGAL_PDF_NAVIGATOR_FONT_LOADS = [
  "400 12px 'NWLP Inter'",
  "500 12px 'NWLP Inter'",
  "600 12px 'NWLP Inter'",
  "500 12px 'NWLP Newsreader'",
] as const;

const LIST_MARKER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><rect x="4" y="4" width="14" height="14" rx="4" transform="rotate(45 11 11)" fill="#c5cad3"/></svg>',
)}`;

export const LEGAL_PDF_NAVIGATOR_CSS = `
@font-face {
  font-family: 'NWLP Inter';
  font-style: normal;
  font-display: block;
  font-weight: 100 900;
  src: url('${interFontUrl}') format('woff2-variations'), url('${interFontUrl}') format('woff2');
}
@font-face {
  font-family: 'NWLP Newsreader';
  font-style: normal;
  font-display: block;
  font-weight: 200 800;
  src: url('${newsreaderFontUrl}') format('woff2-variations'), url('${newsreaderFontUrl}') format('woff2');
}

.nwlp {
  --nwlp-ink: #0d1626;
  --nwlp-ink-2: #12203a;
  --nwlp-text: #3d4556;
  --nwlp-text-strong: #2f3747;
  --nwlp-muted: #5e6676;
  --nwlp-line: #e2ddd3;
  --nwlp-line-soft: #ece7de;
  --nwlp-paper: #f6f4ef;
  --nwlp-on-dark: #c5cad3;
  --nwlp-on-dark-muted: #9aa3b2;
  --nwlp-sans: ${LEGAL_PDF_NAVIGATOR_FONTS.sans};
  --nwlp-serif: ${LEGAL_PDF_NAVIGATOR_FONTS.serif};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}
.nwlp *, .nwlp *::before, .nwlp *::after { box-sizing: border-box; }

/* ── A page ── */
.nwlp .nwlp-page {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 210mm;
  height: 297mm;
  flex: none;
  overflow: hidden;
  padding: 14mm 20mm 11mm;
  background: #ffffff;
  color: var(--nwlp-text-strong);
  font-family: var(--nwlp-sans);
  font-size: 10pt;
  line-height: 1.74;
  font-feature-settings: 'kern' 1, 'liga' 1;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  box-shadow: 0 1px 2px rgba(13, 22, 38, 0.06), 0 8px 24px rgba(13, 22, 38, 0.08);
}
.nwlp .nwlp-page.nwlp-a3 { width: 297mm; height: 420mm; }
.nwlp .nwlp-page.nwlp-landscape { width: 297mm; height: 210mm; }
.nwlp .nwlp-page.nwlp-a3.nwlp-landscape { width: 420mm; height: 297mm; }

/* Running head (pages after the cover) */
.nwlp .nwlp-run {
  flex: none;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8mm;
  padding-bottom: 2.4mm;
  border-bottom: 0.3mm solid var(--nwlp-line);
}
.nwlp .nwlp-run-title {
  font-family: var(--nwlp-serif);
  font-size: 11pt;
  font-weight: 500;
  letter-spacing: -0.012em;
  line-height: 1.2;
  color: var(--nwlp-ink);
  min-width: 0;
}
.nwlp .nwlp-run-meta { flex: none; font-size: 7.2pt; line-height: 1.2; color: var(--nwlp-muted); white-space: nowrap; }

.nwlp .nwlp-body { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; padding-top: 7.5mm; }

.nwlp .nwlp-foot {
  flex: none;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8mm;
  margin-top: 4mm;
  padding-top: 2.6mm;
  border-top: 0.3mm solid var(--nwlp-line);
  font-size: 6.6pt;
  line-height: 1.5;
  color: var(--nwlp-muted);
}
.nwlp .nwlp-foot b { color: var(--nwlp-ink); font-weight: 600; }
.nwlp .nwlp-folio { flex: none; white-space: nowrap; font-size: 7.4pt; color: var(--nwlp-ink); font-variant-numeric: tabular-nums; }

/* ── Cover ── */
.nwlp .nwlp-cover { padding-top: 0; }
.nwlp .nwlp-band {
  flex: none;
  position: relative;
  overflow: hidden;
  margin: 0 -20mm;
  padding: 12mm 20mm 13mm;
  height: 104mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--nwlp-ink);
  color: #ffffff;
}
.nwlp .nwlp-band-bg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.nwlp .nwlp-band > :not(.nwlp-band-bg) { position: relative; }
.nwlp .nwlp-band-top { display: flex; justify-content: space-between; align-items: center; gap: 8mm; }
.nwlp .nwlp-logo { display: block; height: 19mm; width: auto; margin: -2mm 0 -2mm -1.4mm; }
.nwlp .nwlp-band-cat {
  font-size: 6.8pt;
  line-height: 1.5;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-align: right;
  color: var(--nwlp-on-dark-muted);
}
.nwlp .nwlp-band-cat b { display: block; color: #ffffff; font-weight: 600; }
/* .nw-eyebrow on dark: capitals with a short rule in front */
.nwlp .nwlp-kicker {
  display: flex;
  align-items: center;
  gap: 2.6mm;
  font-size: 6.8pt;
  line-height: 1.4;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--nwlp-on-dark);
}
.nwlp .nwlp-kicker::before { content: ''; width: 5mm; height: 0.25mm; background: currentColor; opacity: 0.7; }
/* .nw-site h1: Newsreader 500, -0.012em */
.nwlp .nwlp-title {
  margin: 3.4mm 0 0;
  font-family: var(--nwlp-serif);
  font-size: 40pt;
  font-weight: 500;
  /* 1.04 on the site; the PDF export draws big text low in a line box tighter
     than about 1.1, onto the description below it. */
  line-height: 1.12;
  letter-spacing: -0.012em;
  color: #ffffff;
  text-wrap: balance;
}
.nwlp .nwlp-desc { margin: 2.6mm 0 0; max-width: 125mm; font-size: 10.6pt; line-height: 1.65; color: var(--nwlp-on-dark); }

/* .nwld-facts */
.nwlp .nwlp-facts { flex: none; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2.5mm; margin: 6mm 0 0; }
.nwlp .nwlp-fact { padding: 2.9mm 3.3mm; border: 0.25mm solid var(--nwlp-line); border-radius: 1.1mm; background: #ffffff; }
.nwlp .nwlp-fact dt { font-size: 6.2pt; line-height: 1.4; letter-spacing: 0.12em; text-transform: uppercase; color: var(--nwlp-muted); }
.nwlp .nwlp-fact dd { margin: 1.2mm 0 0; font-size: 9.4pt; font-weight: 600; line-height: 1.3; color: var(--nwlp-ink); font-variant-numeric: tabular-nums; }

/* .nwld-toc-card */
.nwlp .nwlp-contents { flex: none; margin-top: 5mm; border: 0.25mm solid var(--nwlp-line); border-radius: 2.1mm; overflow: hidden; }
.nwlp .nwlp-contents-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 3.6mm 4.2mm 2.6mm;
  border-bottom: 0.25mm solid var(--nwlp-line-soft);
  line-height: 1.3;
}
.nwlp .nwlp-contents-head b { font-size: 9pt; font-weight: 600; color: var(--nwlp-ink); }
.nwlp .nwlp-contents-head span { font-size: 7.6pt; color: var(--nwlp-muted); }
.nwlp .nwlp-contents ol { list-style: none; margin: 0; padding: 2.2mm 4.2mm 2.8mm; columns: 2; column-gap: 8mm; }
.nwlp .nwlp-contents li {
  break-inside: avoid;
  display: flex;
  align-items: baseline;
  gap: 1.6mm;
  padding: 0.85mm 0;
  font-size: 7.9pt;
  line-height: 1.4;
  color: var(--nwlp-text);
}
/* No tabular figures here: the export spaces them apart from the full stop. */
.nwlp .nwlp-contents .nwlp-n { flex: none; width: 5.4mm; color: var(--nwlp-muted); }
.nwlp .nwlp-contents .nwlp-t { flex: 1 1 auto; min-width: 0; }
.nwlp .nwlp-contents .nwlp-p { flex: none; color: var(--nwlp-ink); font-weight: 600; font-variant-numeric: tabular-nums; }

/* .nwld-details */
.nwlp .nwlp-note {
  flex: none;
  margin-top: auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6mm;
  align-items: center;
  padding: 4mm 5mm;
  border-radius: 2.1mm;
  background: var(--nwlp-paper);
}
.nwlp .nwlp-note b { display: block; font-size: 8.4pt; line-height: 1.4; font-weight: 600; color: var(--nwlp-ink); }
.nwlp .nwlp-note p { margin: 1mm 0 0; font-size: 7.6pt; line-height: 1.55; color: var(--nwlp-text); }
.nwlp .nwlp-note .nwlp-url { color: var(--nwlp-ink); font-weight: 500; text-decoration: underline; text-underline-offset: 0.6mm; }
.nwlp .nwlp-stamp { text-align: right; font-size: 6.2pt; line-height: 1.6; letter-spacing: 0.12em; text-transform: uppercase; color: var(--nwlp-muted); }
.nwlp .nwlp-stamp b { font-size: 9.4pt; letter-spacing: 0; text-transform: none; font-weight: 600; color: var(--nwlp-ink); font-variant-numeric: tabular-nums; }
.nwlp .nwlp-cover .nwlp-foot { margin-top: 5mm; }

/* ── The document's text: .nwld-prose at 10pt ── */
.nwlp .nwlp-body > * { margin-top: 0; }
.nwlp .nwlp-body :not(h1, h2, h3, h4) { font-family: inherit !important; }
.nwlp .nwlp-body :is([style*='color'], font[color]) { color: inherit !important; }
.nwlp .nwlp-body p { margin: 0 0 3.6mm; font-size: inherit; line-height: inherit; text-wrap: pretty; }
.nwlp .nwlp-body p:empty { display: none; }
.nwlp .nwlp-body :is(h1, h2) {
  margin: 9mm 0 3.3mm;
  padding-top: 5mm;
  border-top: 0.25mm solid var(--nwlp-line-soft);
  font-family: var(--nwlp-serif) !important;
  font-size: 15.3pt;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -0.012em;
  color: var(--nwlp-ink);
  text-wrap: balance;
}
.nwlp .nwlp-body h3 {
  margin: 6mm 0 2mm;
  font-family: var(--nwlp-serif) !important;
  font-size: 11.2pt;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: var(--nwlp-ink);
}
.nwlp .nwlp-body h4 { margin: 4.5mm 0 1.6mm; font-size: 10pt; font-weight: 600; line-height: 1.4; color: var(--nwlp-ink); }
.nwlp .nwlp-body > :is(h1, h2):first-child { margin-top: 0; padding-top: 0; border-top: 0; }
.nwlp .nwlp-body > :is(h3, h4):first-child { margin-top: 0; }
.nwlp .nwlp-body ul { list-style: none; margin: 0 0 4.2mm; padding: 0; }
/* The site's marker, a small rounded square turned 45°, drawn as a background
   image: the export places backgrounds exactly but draws ::before shapes
   unrotated and a little high. */
.nwlp .nwlp-body ul > li {
  position: relative;
  margin: 0 0 2mm;
  padding-left: 5.5mm;
  background: url("${LIST_MARKER}") no-repeat 0.9mm 2.15mm / 2.2mm 2.2mm;
}
.nwlp .nwlp-body ol { margin: 0 0 4.2mm; padding-left: 6.3mm; list-style: decimal; }
.nwlp .nwlp-body ol > li { margin: 0 0 2mm; padding-left: 1.6mm; }
.nwlp .nwlp-body li > p { margin: 0; }
.nwlp .nwlp-body li > p + p { margin-top: 2.1mm; }
.nwlp .nwlp-body li > :is(ul, ol) { margin: 2mm 0 0; }
.nwlp .nwlp-body hr { display: none; }
.nwlp .nwlp-body :is(strong, b) { color: var(--nwlp-ink); font-weight: 600; }
.nwlp .nwlp-body a { color: var(--nwlp-ink); font-weight: 500; text-decoration: underline; text-underline-offset: 0.7mm; }
.nwlp .nwlp-body blockquote { margin: 0 0 4mm; padding: 3mm 4mm; border-radius: 1.1mm; background: var(--nwlp-paper); color: var(--nwlp-text); }
.nwlp .nwlp-body table { width: 100%; margin: 0 0 4.2mm; border-collapse: collapse; font-size: 8.6pt; line-height: 1.5; }
.nwlp .nwlp-body :is(th, td) { padding: 2mm 2.4mm; border: 0.25mm solid var(--nwlp-line); text-align: left; vertical-align: top; }
.nwlp .nwlp-body th { background: var(--nwlp-paper); color: var(--nwlp-ink); font-weight: 600; }
.nwlp .nwlp-body :is(th, td) p { margin: 0; }
.nwlp .nwlp-body .legal-table-wrap { margin: 0 0 4.2mm; }
.nwlp .nwlp-body .legal-table-wrap > table { margin: 0; }
.nwlp .nwlp-body :is(.legal-signatures, .legal-pdf-signatures) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6mm; margin: 4mm 0; }
.nwlp .nwlp-body :is(.legal-signature-line, .legal-pdf-signature-line) .line { height: 11mm; border-bottom: 0.3mm solid var(--nwlp-muted); margin-bottom: 1.6mm; }
.nwlp .nwlp-body :is(.legal-signature-line, .legal-pdf-signature-line) span { display: block; font-size: 8pt; font-weight: 600; color: var(--nwlp-muted); }
.nwlp .nwlp-body .legal-page-break { display: none; }

.nwlp .nwlp-end { margin: 9mm 0 0; padding-top: 4mm; border-top: 0.25mm solid var(--nwlp-line-soft); font-size: 7.6pt; line-height: 1.5; color: var(--nwlp-muted); }
.nwlp .nwlp-end b { color: var(--nwlp-ink); font-weight: 600; }

/* While the first layout is being measured: kept in the layout but unseen. */
.nwlp.nwlp-measuring { visibility: hidden; }

@media print {
  .nwlp { display: block; gap: 0; }
  .nwlp .nwlp-page {
    margin: 0 !important;
    box-shadow: none !important;
    break-after: page;
    page-break-after: always;
  }
  .nwlp .nwlp-page:last-child { break-after: auto; page-break-after: auto; }
}
`;
