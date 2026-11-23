/**
 * The Navigate Wealth email layout — the wrapper every platform email is sent
 * in: transactional mail, client communication, digests and the newsletter's
 * cover email. Drawn in the Navigator design (src/site/styles/navigator.css):
 * warm paper canvas, an ink-topped white card, a serif headline, violet kept
 * for the one action, and the ink footer band the public website ends on.
 *
 * WHO LOADS IT
 * - The Edge Function sends it: `createEmailTemplate` in `email-core.ts`.
 * - The admin Communication module previews it: the template editor, and the
 *   compose and review steps of a campaign.
 * Both call `renderEmailLayout`, so a preview is the email, not a lookalike.
 * No imports: this file is loaded by both Vite and Deno. Changes here deploy
 * the Edge Function, because `src/shared/email/**` is in the deploy
 * workflow's paths.
 *
 * HOW IT IS BUILT, AND WHY
 * - Tables and inline styles carry the whole design. The <style> blocks only
 *   add to it (phones, dark mode), so a client that strips them — or a
 *   forwarded copy — still shows a complete, on-brand email.
 * - No images. The wordmark is live text in the logo's own face (Calibri on
 *   Windows and Outlook, the system sans elsewhere), so the email is whole with
 *   images blocked, and it re-colours itself in dark mode, which a transparent
 *   PNG logo cannot.
 * - No web fonts. Newsreader and Inter are named first for the few readers who
 *   have them installed, then Georgia and the system sans. Loading them from a
 *   font CDN would tell a third party every time a client opens their mail.
 * - Three style blocks, by what each client can parse. Gmail discards a whole
 *   block when it meets a selector it does not support, so the block it must
 *   keep (phone layout) holds nothing but class selectors and a width query;
 *   attribute selectors and the dark-mode query sit in a block of their own.
 *   Outlook for Windows (Word) reads only the `[if mso]` block.
 *
 * DARK MODE, CLIENT BY CLIENT
 * - Apple Mail, iOS Mail, Outlook for Mac, Thunderbird: the email declares
 *   `color-scheme: light dark`, so they do not invert it; they apply the
 *   `prefers-color-scheme: dark` block below instead — the layout's own dark
 *   palette, plus a remap of the inline colours body content commonly uses
 *   (#111827 text, #f3f4f6 panels, amber and green notices…), so authored
 *   content follows the theme too.
 * - Outlook.com and the Outlook apps rewrite colours themselves and mark what
 *   they touched with `data-ogsc` / `data-ogsb`; the rules keyed on those put
 *   the layout's own dark palette back.
 * - Gmail's apps invert light colours and leave dark ones alone. Nothing in the
 *   layout depends on an image or a colour pairing that inversion would break,
 *   and the ink footer, being dark already, is left exactly as designed.
 */

/** The firm's details printed in the footer. The admin edits these (Global Footer). */
export interface EmailLayoutFooter {
  companyName: string;
  /** Address lines, separated by `<br />` (how the Global Footer editor saves them) or newlines. */
  address: string;
  contactEmail: string;
  contactPhone: string;
  socialLinks: {
    linkedin?: string;
    instagram?: string;
    youtube?: string;
    facebook?: string;
    twitter?: string;
  };
  /** `{{Year}}` is replaced with the current year. */
  copyrightText: string;
}

/** Defaults, from src/config/companyFacts.ts. Used until an admin saves their own. */
export const EMAIL_LAYOUT_FOOTER_DEFAULTS: EmailLayoutFooter = {
  companyName: 'Navigate Wealth',
  address:
    'First Floor, Milestone Place Block A<br />25 Sovereign Drive, Route 21 Business Park<br />Pretoria, 0157',
  contactEmail: 'info@navigatewealth.co',
  contactPhone: '+27 12 667 2505',
  socialLinks: {
    linkedin: 'https://www.linkedin.com/company/navigatewealth/',
    instagram: 'https://www.instagram.com/navigate_wealth?igsh=MTh6bTc2emszbXU0MA==',
    twitter: 'https://x.com/Navigate_ZA',
  },
  copyrightText: '© {{Year}} Navigate Wealth. All rights reserved.',
};

/**
 * The regulatory line is not admin-editable: it states the firm's licence, and
 * the FSCA register and CIPC record are what it has to match
 * (src/config/companyFacts.ts — COMPANY).
 */
const FIRM = {
  legalName: 'Wealthfront (Pty) Ltd',
  registrationNumber: '2024/071953/07',
  fspNumber: '54606',
  /** www, not the apex: the apex 301s everything but articles to www (vercel.json). */
  website: 'https://www.navigatewealth.co',
  websiteLabel: 'navigatewealth.co',
  privacyUrl: 'https://www.navigatewealth.co/legal/privacy-notice',
} as const;

/** Navigator tokens (navigator.css), and the dark palette the layout switches to. */
const LIGHT = {
  paper: '#f6f4ef',
  paper2: '#efebe3',
  paper3: '#fbfaf7',
  white: '#ffffff',
  ink: '#0d1626',
  line: '#e2ddd3',
  lineSoft: '#ece7de',
  text: '#3d4556',
  muted: '#5e6676',
  violet: '#6d28d9',
  onDark: '#c5cad3',
  onDarkMuted: '#9aa3b2',
  cream: '#e3d9c3',
  /** Violet lifted for ink backgrounds: #6d28d9 on ink is under 3:1. */
  violetOnDark: '#a78bfa',
  footRule: '#263044',
} as const;

const DARK = {
  canvas: '#0a0f1a',
  card: '#111a2b',
  line: '#243049',
  heading: '#f6f4ef',
  text: '#c5cad3',
  muted: '#9aa3b2',
  link: '#c4b5fd',
  button: '#7c3aed',
  panel: '#0d1626',
  bar: '#e3d9c3',
} as const;

const SERIF = "'Newsreader',Georgia,'Times New Roman',serif";
const SANS =
  "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
/** The logo is set in Calibri Bold; Carlito is its metric twin on Linux. */
const WORDMARK = "Calibri,Carlito,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";

/* ── Dark-mode remap for authored body content ───────────────────────────────
 * Body HTML arrives with inline colours written for a white card. In dark mode
 * these rules map the ones the platform's senders actually use (surveyed
 * across the server's email bodies, November 2026) onto the dark palette.
 * Matching is on the inline style text, case-insensitively, inside the content
 * cell only — the layout's own chrome is styled by class and is never hit.
 */
type Remap = readonly [readonly string[], string];

/** Text colours. A hex here is only ever a text colour in the senders' markup. */
const DARK_CONTENT_TEXT: readonly Remap[] = [
  [['#000', '#111827', '#1f2937', '#0d1626', '#333'], DARK.heading],
  [['#374151', '#3d4556', '#4b5563'], DARK.text],
  [['#6b7280', '#5e6676', '#9ca3af'], DARK.muted],
  [['#15803d', '#166534', '#16a34a'], '#4ade80'],
  [['#d97706', '#b45309', '#92400e'], '#fbbf24'],
  [['#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'], '#f87171'],
  [['#ea580c', '#c2410c'], '#fb923c'],
];

/**
 * Accent text colours that are also used as solid button fills. An element
 * that declares any background is left alone, so a violet button's white label
 * is never repainted violet.
 */
const DARK_CONTENT_ACCENT: readonly Remap[] = [
  [['#6d28d9', '#7c3aed', '#5b21b6'], DARK.link],
  [['#1e3a8a', '#1e40af', '#2563eb'], '#93c5fd'],
];

/**
 * Panel fills. `#fff` is matched only as a background declaration — it is also
 * a common text colour — and comes first so the tints that share its prefix
 * (#fff7ed, #fffbeb) win by order.
 */
const DARK_CONTENT_BG: readonly Remap[] = [
  [
    [
      'background:#fff',
      'background: #fff',
      'background-color:#fff',
      'background-color: #fff',
      '#f8f9fa',
      '#f9fafb',
      '#f3f4f6',
      '#fbfaf7',
      '#f6f4ef',
    ],
    DARK.panel,
  ],
  [['#fffbeb', '#fef3c7', '#fff7ed'], '#2a2214'],
  [['#f0fdf4', '#dcfce7'], '#0f2a1b'],
  [['#fef2f2', '#fee2e2'], '#2d1518'],
  [['#eff6ff', '#dbeafe'], '#13233f'],
];

const DARK_CONTENT_BORDER: readonly Remap[] = [
  [['#e5e7eb', '#d1d5db', '#e2ddd3', '#ece7de'], DARK.line],
  [['#fde68a', '#fcd34d'], '#5c4a1f'],
  [['#bbf7d0', '#86efac'], '#1f4d33'],
  [['#fecaca', '#fca5a5'], '#5c2a2e'],
  [['#bfdbfe'], '#26406b'],
];

function remapRules(map: readonly Remap[], property: string, suffix = ''): string {
  return map
    .map(([needles, to]) => {
      const selectors = needles.map((n) => `.nw-content [style*="${n}" i]${suffix}`).join(',');
      return `${selectors}{${property}:${to} !important;}`;
    })
    .join('\n');
}

/** Gmail-safe: class selectors and a width query only. */
const CORE_CSS = `
body{margin:0;padding:0;}
table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
.nw-content p{margin:0 0 16px;}
.nw-content h1,.nw-content h2,.nw-content h3{margin:0 0 12px;font-family:${SERIF};font-weight:500;color:${LIGHT.ink};}
.nw-content h1{font-size:24px;line-height:31px;}
.nw-content h2{font-size:21px;line-height:28px;}
.nw-content h3{font-size:18px;line-height:25px;}
.nw-content ul,.nw-content ol{margin:0 0 16px;padding:0 0 0 22px;}
.nw-content li{margin:0 0 6px;}
.nw-content a{color:${LIGHT.violet};text-decoration:underline;}
.nw-content blockquote{margin:0 0 16px;padding:2px 0 2px 16px;border-left:2px solid ${LIGHT.cream};color:${LIGHT.muted};}
.nw-content hr{border:0;border-top:1px solid ${LIGHT.lineSoft};margin:24px 0;}
.nw-content img{max-width:100%;height:auto;}
.nw-content .ql-align-center{text-align:center;}
.nw-content .ql-align-right{text-align:right;}
.nw-content .ql-align-justify{text-align:justify;}
@media only screen and (max-width:620px){
.nw-shell{padding:24px 12px 40px !important;}
.nw-shell-foot{padding:40px 12px 48px !important;}
.nw-px{padding-left:24px !important;padding-right:24px !important;}
.nw-pt{padding-top:32px !important;}
.nw-pb{height:32px !important;}
.nw-h1{font-size:26px !important;line-height:32px !important;}
.nw-lead{font-size:16px !important;line-height:24px !important;}
.nw-btn-wrap{width:100% !important;}
.nw-btn{display:block !important;text-align:center !important;}
}
@media only screen and (max-width:420px){
.nw-fsp{display:none !important;}
}
`;

/** Apple Mail, iOS Mail, Outlook (Mac, .com, apps), Thunderbird. */
const ENHANCED_CSS = `
:root{color-scheme:light dark;supported-color-schemes:light dark;}
a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;font-size:inherit !important;font-family:inherit !important;font-weight:inherit !important;line-height:inherit !important;}
@media (prefers-color-scheme: dark){
.nw-bg-canvas{background-color:${DARK.canvas} !important;}
.nw-bg-card{background-color:${DARK.card} !important;}
.nw-ring{border-color:${DARK.line} !important;box-shadow:none !important;}
.nw-bar{background-color:${DARK.bar} !important;}
.nw-rule{background-color:${DARK.line} !important;}
.nw-rule-mark{background-color:${DARK.muted} !important;}
.nw-ink{color:${DARK.heading} !important;}
.nw-text{color:${DARK.text} !important;}
.nw-muted{color:${DARK.muted} !important;}
.nw-wm-b{color:${LIGHT.violetOnDark} !important;}
.nw-link{color:${DARK.link} !important;}
.nw-btn-bg{background-color:${DARK.button} !important;}
.nw-note{background-color:${DARK.panel} !important;border-color:${DARK.line} !important;}
.nw-foot{border-top:1px solid #1c2638 !important;}
.nw-content h1,.nw-content h2,.nw-content h3{color:${DARK.heading} !important;}
.nw-content a{color:${DARK.link} !important;}
.nw-content blockquote{border-left-color:#4a4335 !important;color:${DARK.muted} !important;}
.nw-content hr{border-top-color:${DARK.line} !important;}
${remapRules(DARK_CONTENT_TEXT, 'color')}
${remapRules(DARK_CONTENT_ACCENT, 'color', ':not([style*="background" i])')}
${remapRules(DARK_CONTENT_BG, 'background-color')}
${remapRules(DARK_CONTENT_BORDER, 'border-color')}
}
[data-ogsb] .nw-bg-canvas{background-color:${DARK.canvas} !important;}
[data-ogsb] .nw-bg-card{background-color:${DARK.card} !important;}
[data-ogsb] .nw-bar{background-color:${DARK.bar} !important;}
[data-ogsb] .nw-note{background-color:${DARK.panel} !important;}
[data-ogsb] .nw-btn-bg{background-color:${DARK.button} !important;}
[data-ogsc] .nw-ink{color:${DARK.heading} !important;}
[data-ogsc] .nw-text{color:${DARK.text} !important;}
[data-ogsc] .nw-muted{color:${DARK.muted} !important;}
[data-ogsc] .nw-wm-b{color:${LIGHT.violetOnDark} !important;}
[data-ogsc] .nw-link{color:${DARK.link} !important;}
`;

/** Outlook for Windows renders with Word, which falls back to Times for any font it lacks. */
const MSO_CSS = `
table,td,div,p,a,span,h1,li{font-family:Arial,Helvetica,sans-serif !important;}
.nw-serif{font-family:Georgia,'Times New Roman',serif !important;}
.nw-wm{font-family:Calibri,Arial,sans-serif !important;}
`;

/** The marker `forceEmailColorScheme` rewrites; keep the two in step. */
const DARK_QUERY = '@media (prefers-color-scheme: dark)';

/**
 * Spacer after the preheader, so the inbox preview stops at the preheader
 * instead of running on into the masthead.
 */
const PREHEADER_FILLER = '&#8199;&#65279;&#847; '.repeat(40);

/* Shorthands for the markup below. */
const PRESENTATION = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';
const PX = 'padding-left:48px;padding-right:48px;';

/**
 * The layout. `{{ .Key }}` is replaced with a value; `{{ if .Key }}…{{ end }}`
 * keeps its block only when the value is non-empty. Blocks do not nest.
 */
export const EMAIL_LAYOUT_HTML = `<!DOCTYPE html>
<html lang="en" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{{ .TitleText }}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<style>${MSO_CSS}</style>
<![endif]-->
<style>${CORE_CSS}</style>
<style>${ENHANCED_CSS}</style>
</head>
<body class="nw-bg-foot" style="margin:0;padding:0;width:100%;background-color:${LIGHT.ink};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
{{ if .Preheader }}<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${LIGHT.paper};">{{ .Preheader }}${PREHEADER_FILLER}</div>{{ end }}
<div role="article" aria-roledescription="email" aria-label="{{ .TitleAttr }}" lang="en" dir="ltr">
<table ${PRESENTATION} width="100%" style="width:100%;">
<tr>
<td align="center" class="nw-bg-canvas nw-shell" style="background-color:${LIGHT.paper};padding:40px 16px 56px;">
<!--[if mso]><table ${PRESENTATION} width="600" align="center"><tr><td><![endif]-->
<table ${PRESENTATION} width="100%" style="width:100%;max-width:600px;margin:0 auto;">
<tr>
<td style="padding:0 2px 20px;">
<table ${PRESENTATION} width="100%" style="width:100%;">
<tr>
<td valign="middle" style="font-family:${WORDMARK};font-size:24px;line-height:28px;font-weight:700;letter-spacing:-0.005em;mso-line-height-rule:exactly;">
<a href="${FIRM.website}" target="_blank" rel="noopener" style="text-decoration:none;"><span class="nw-wm nw-ink" style="color:${LIGHT.ink};">Navigate</span> <span class="nw-wm nw-wm-b" style="color:${LIGHT.violet};">Wealth</span></a>
</td>
<td valign="middle" align="right" class="nw-fsp nw-muted" style="font-family:${SANS};font-size:10.5px;line-height:14px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${LIGHT.muted};white-space:nowrap;">Authorised FSP ${FIRM.fspNumber}</td>
</tr>
</table>
</td>
</tr>
<tr>
<td>
<table ${PRESENTATION} width="100%" class="nw-bg-card nw-ring" style="width:100%;background-color:${LIGHT.white};border:1px solid ${LIGHT.line};border-radius:4px;border-collapse:separate;box-shadow:0 24px 44px -32px rgba(13,22,38,0.55);">
<tr>
<td class="nw-bar" height="4" style="height:4px;font-size:4px;line-height:4px;background-color:${LIGHT.ink};border-radius:3px 3px 0 0;mso-line-height-rule:exactly;">&nbsp;</td>
</tr>
<tr>
<td class="nw-px nw-pt" style="${PX}padding-top:44px;">
<p class="nw-muted" style="margin:0 0 16px;font-family:${SANS};font-size:11.5px;line-height:16px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${LIGHT.muted};"><span class="nw-rule-mark" style="display:inline-block;width:24px;height:1px;background-color:${LIGHT.muted};vertical-align:middle;margin:0 12px 2px 0;mso-hide:all;"></span>{{ .Eyebrow }}</p>
<h1 class="nw-serif nw-ink nw-h1" style="margin:0;font-family:${SERIF};font-size:30px;line-height:38px;font-weight:500;letter-spacing:-0.012em;color:${LIGHT.ink};mso-line-height-rule:exactly;">{{ .Title }}</h1>
{{ if .Subtitle }}<p class="nw-muted nw-lead" style="margin:12px 0 0;font-family:${SANS};font-size:17px;line-height:26px;color:${LIGHT.muted};">{{ .Subtitle }}</p>{{ end }}
</td>
</tr>
<tr>
<td class="nw-px" style="${PX}padding-top:28px;padding-bottom:28px;">
<table ${PRESENTATION} width="100%" style="width:100%;"><tr><td class="nw-rule" height="1" style="height:1px;font-size:1px;line-height:1px;background-color:${LIGHT.lineSoft};mso-line-height-rule:exactly;">&nbsp;</td></tr></table>
</td>
</tr>
<tr>
<td class="nw-px nw-text nw-content" style="${PX}font-family:${SANS};font-size:16px;line-height:26px;color:${LIGHT.text};">
{{ if .Greeting }}<p class="nw-ink" style="margin:0 0 16px;color:${LIGHT.ink};">{{ .Greeting }}</p>{{ end }}
{{ .BodyHtml }}
</td>
</tr>
{{ if .ButtonURL }}<tr>
<td class="nw-px" style="${PX}padding-top:12px;">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{ .ButtonURL }}" style="height:48px;v-text-anchor:middle;width:300px;" arcsize="9%" stroke="f" fillcolor="${LIGHT.violet}">
<w:anchorlock/>
<center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">{{ .ButtonLabel }}&nbsp;&nbsp;&rarr;</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<table ${PRESENTATION} class="nw-btn-wrap" style="border-collapse:separate;">
<tr>
<td align="center" class="nw-btn-bg" style="background-color:${LIGHT.violet};border-radius:4px;">
<a href="{{ .ButtonURL }}" class="nw-btn" target="_blank" rel="noopener" style="display:inline-block;padding:15px 28px;font-family:${SANS};font-size:15px;line-height:18px;font-weight:600;letter-spacing:0.01em;color:#ffffff;text-decoration:none;border-radius:4px;">{{ .ButtonLabel }}&nbsp;&nbsp;&rarr;</a>
</td>
</tr>
</table>
<!--<![endif]-->
</td>
</tr>{{ end }}
{{ if .ButtonFallbackURL }}<!--[if !mso]><!--><tr>
<td class="nw-px nw-muted" style="${PX}padding-top:16px;font-family:${SANS};font-size:13px;line-height:20px;color:${LIGHT.muted};">
Button not working? Copy this link into your browser:<br>
<a href="{{ .ButtonFallbackURL }}" class="nw-link" target="_blank" rel="noopener" style="color:${LIGHT.violet};text-decoration:underline;word-break:break-all;">{{ .ButtonFallbackURL }}</a>
</td>
</tr><!--<![endif]-->{{ end }}
{{ if .FooterNote }}<tr>
<td class="nw-px" style="${PX}padding-top:28px;">
<table ${PRESENTATION} width="100%" style="width:100%;border-collapse:separate;">
<tr><td class="nw-note nw-text" style="padding:16px 20px;background-color:${LIGHT.paper3};border:1px solid ${LIGHT.paper2};border-radius:4px;font-family:${SANS};font-size:14px;line-height:22px;color:${LIGHT.text};">{{ .FooterNote }}</td></tr>
</table>
</td>
</tr>{{ end }}
<tr><td class="nw-pb" height="44" style="height:44px;font-size:0;line-height:0;">&nbsp;</td></tr>
</table>
</td>
</tr>
{{ if .HelpLine }}<tr>
<td class="nw-muted" style="padding:24px 2px 0;font-family:${SANS};font-size:13px;line-height:20px;color:${LIGHT.muted};">{{ .HelpLine }}</td>
</tr>{{ end }}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td>
</tr>
<tr>
<td align="center" class="nw-foot nw-shell-foot" style="background-color:${LIGHT.ink};padding:48px 16px 56px;">
<!--[if mso]><table ${PRESENTATION} width="600" align="center"><tr><td><![endif]-->
<table ${PRESENTATION} width="100%" style="width:100%;max-width:600px;margin:0 auto;">
<tr>
<td style="padding:0 2px 4px;font-family:${WORDMARK};font-size:20px;line-height:24px;font-weight:700;mso-line-height-rule:exactly;"><span class="nw-wm" style="color:${LIGHT.paper};">Navigate</span> <span class="nw-wm" style="color:${LIGHT.violetOnDark};">Wealth</span></td>
</tr>
<tr>
<td style="padding:0 2px 24px;font-family:${SANS};font-size:13px;line-height:20px;color:${LIGHT.onDarkMuted};">Independent Financial Advisory Services</td>
</tr>
<tr>
<td style="padding:0 2px 16px;font-family:${SANS};font-size:13px;line-height:21px;color:${LIGHT.onDark};">{{ .FooterAddress }}</td>
</tr>
<tr>
<td style="padding:0 2px;font-family:${SANS};font-size:13px;line-height:21px;color:${LIGHT.onDarkMuted};">{{ .FooterLinks }}</td>
</tr>
<tr>
<td style="padding:28px 2px;">
<table ${PRESENTATION} width="100%" style="width:100%;"><tr><td height="1" style="height:1px;font-size:1px;line-height:1px;background-color:${LIGHT.footRule};mso-line-height-rule:exactly;">&nbsp;</td></tr></table>
</td>
</tr>
<tr>
<td style="padding:0 2px 12px;font-family:${SANS};font-size:12px;line-height:19px;color:${LIGHT.onDarkMuted};">${FIRM.legalName} (Reg. No. ${FIRM.registrationNumber}), trading as Navigate Wealth, is an authorised Financial Services Provider (FSP No. ${FIRM.fspNumber}).</td>
</tr>
<tr>
<td style="padding:0 2px 12px;font-family:${SANS};font-size:12px;line-height:19px;color:${LIGHT.onDarkMuted};">For your security, Navigate Wealth will never ask you for your password or a one-time PIN by email.</td>
</tr>
<tr>
<td style="padding:0 2px;font-family:${SANS};font-size:12px;line-height:19px;color:${LIGHT.onDarkMuted};">This email and any attachments are confidential and intended only for the person to whom it is addressed. If you received it in error, please let us know and delete it.</td>
</tr>
<tr>
<td style="padding:24px 2px 0;font-family:${SANS};font-size:12px;line-height:19px;color:${LIGHT.onDarkMuted};">{{ .Copyright }}&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="${FIRM.privacyUrl}" target="_blank" rel="noopener" style="color:${LIGHT.cream};text-decoration:underline;white-space:nowrap;">Privacy notice</a>{{ if .UnsubscribeURL }}&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="{{ .UnsubscribeURL }}" target="_blank" rel="noopener" style="color:${LIGHT.cream};text-decoration:underline;white-space:nowrap;">Unsubscribe</a>{{ end }}</td>
</tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td>
</tr>
</table>
</div>
</body>
</html>`;

export interface EmailLayoutInput {
  /** The email's own content. Trusted HTML from the platform's senders. */
  bodyHtml: string;
  /** The serif headline (HTML). Defaults to "Navigate Wealth". */
  title?: string;
  /** A lead line under the headline (HTML). */
  subtitle?: string;
  /** "Dear …," — set as its own paragraph above the body (HTML). */
  greeting?: string;
  buttonUrl?: string;
  buttonLabel?: string;
  /**
   * Print the button's link as text under it, for readers whose client or
   * mail gateway breaks the button. On by default; campaign mail with long
   * tracked links turns it off. Only http(s) links are ever printed.
   */
  buttonFallback?: boolean;
  /** A closing note, set in a quiet panel (HTML). */
  footerNote?: string;
  /**
   * The inbox preview line. Defaults to the subtitle, else the opening words of
   * the greeting and body.
   */
  preheader?: string;
  /** The small label over the headline. Defaults to today's date. */
  eyebrow?: string;
  unsubscribeUrl?: string;
  /** The admin's Global Footer settings. Missing fields fall back to the defaults. */
  footer?: Partial<EmailLayoutFooter> | null;
  /** The moment the email is dated. Defaults to now. */
  now?: Date;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** For a URL going into an href: quotes and angle brackets only, so query strings stay byte-identical. */
function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;').replace(/</g, '%3C').replace(/>/g, '%3E');
}

/** Visible text of an HTML fragment, entities left as they are (still valid HTML). */
function textOf(html: string): string {
  return html
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cut at a word boundary, never through an entity. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);
  return `${cut.replace(/&[#a-z0-9]*$/i, '').trimEnd()}…`;
}

function isHttpUrl(value: string | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

/** "23 November 2026", in South African time. */
export function formatEmailDate(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  }).format(now);
}

const LINK_STYLE = `color:${LIGHT.cream};text-decoration:none;white-space:nowrap;`;
const DOT = '&nbsp;&nbsp;&middot;&nbsp;&nbsp;';

const SOCIAL_LABELS: ReadonlyArray<readonly [keyof EmailLayoutFooter['socialLinks'], string]> = [
  ['linkedin', 'LinkedIn'],
  ['instagram', 'Instagram'],
  ['twitter', 'X'],
  ['facebook', 'Facebook'],
  ['youtube', 'YouTube'],
];

function footerPieces(footer: EmailLayoutFooter, year: number) {
  const address = footer.address
    .split(/<br\s*\/?>|\n/i)
    .map((line) => escapeHtml(line.replace(/<[^>]*>/g, '').trim()))
    .filter(Boolean)
    .join('<br />');

  const links = [
    `<a href="${FIRM.website}" target="_blank" rel="noopener" style="${LINK_STYLE}">${FIRM.websiteLabel}</a>`,
    ...SOCIAL_LABELS.flatMap(([key, label]) => {
      const url = footer.socialLinks[key];
      return isHttpUrl(url)
        ? [
            `<a href="${escapeAttr(url.trim())}" target="_blank" rel="noopener" style="${LINK_STYLE}">${label}</a>`,
          ]
        : [];
    }),
  ].join(DOT);

  const linkStyle = `color:${LIGHT.violet};text-decoration:underline;`;
  const phone = footer.contactPhone.trim();
  const email = footer.contactEmail.trim();
  const phoneLink = phone
    ? `<a href="tel:${escapeAttr(phone.replace(/[^\d+]/g, ''))}" class="nw-link" style="${linkStyle}">${escapeHtml(phone)}</a>`
    : '';
  const emailLink = email
    ? `<a href="mailto:${escapeAttr(email)}" class="nw-link" style="${linkStyle}">${escapeHtml(email)}</a>`
    : '';
  const helpLine =
    phoneLink && emailLink
      ? `Questions? Call us on ${phoneLink} or write to ${emailLink}.`
      : phoneLink
        ? `Questions? Call us on ${phoneLink}.`
        : emailLink
          ? `Questions? Write to us at ${emailLink}.`
          : '';

  const copyright = escapeHtml(footer.copyrightText.replace(/\{\{\s*Year\s*\}\}/g, String(year)));

  return { address, links, helpLine, copyright };
}

/**
 * Saved settings over the defaults, field by field. Settings come from KV, so
 * a field can be missing or null; only a string replaces a default (an empty
 * one included — that is an admin deliberately clearing it).
 */
function resolveFooter(saved: Partial<EmailLayoutFooter> | null | undefined): EmailLayoutFooter {
  const d = EMAIL_LAYOUT_FOOTER_DEFAULTS;
  const pick = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback);
  const links = saved?.socialLinks;
  return {
    companyName: pick(saved?.companyName, d.companyName),
    address: pick(saved?.address, d.address),
    contactEmail: pick(saved?.contactEmail, d.contactEmail),
    contactPhone: pick(saved?.contactPhone, d.contactPhone),
    socialLinks: links && typeof links === 'object' ? links : d.socialLinks,
    copyrightText: pick(saved?.copyrightText, d.copyrightText),
  };
}

/** Fill the layout. Pure: the same input always gives the same email. */
export function renderEmailLayout(input: EmailLayoutInput): string {
  const now = input.now ?? new Date();
  const title = input.title?.trim() ? input.title : 'Navigate Wealth';
  const titleText = textOf(title) || 'Navigate Wealth';
  const pieces = footerPieces(resolveFooter(input.footer), now.getFullYear());

  const preheader =
    input.preheader?.trim() ||
    (input.subtitle?.trim() ? textOf(input.subtitle) : '') ||
    clip(textOf(`${input.greeting ?? ''} ${input.bodyHtml}`), 140);

  const buttonUrl = input.buttonUrl?.trim() ?? '';
  const data: Record<string, string> = {
    Title: title,
    TitleText: `${titleText} | Navigate Wealth`,
    TitleAttr: escapeHtml(titleText).replace(/&amp;(#?[a-z0-9]+;)/gi, '&$1'),
    Subtitle: input.subtitle ?? '',
    Greeting: input.greeting ?? '',
    BodyHtml: input.bodyHtml,
    ButtonURL: buttonUrl ? escapeAttr(buttonUrl) : '',
    ButtonLabel: input.buttonLabel?.trim() || 'Continue',
    ButtonFallbackURL:
      input.buttonFallback !== false && isHttpUrl(buttonUrl) ? escapeAttr(buttonUrl) : '',
    FooterNote: input.footerNote ?? '',
    Preheader: preheader,
    Eyebrow: input.eyebrow?.trim() || formatEmailDate(now),
    UnsubscribeURL: input.unsubscribeUrl ? escapeAttr(input.unsubscribeUrl) : '',
    HelpLine: pieces.helpLine,
    FooterAddress: pieces.address,
    FooterLinks: pieces.links,
    Copyright: pieces.copyright,
  };

  return EMAIL_LAYOUT_HTML.replace(
    /\{\{ if \.([a-zA-Z0-9_]+) \}\}([\s\S]*?)\{\{ end \}\}/g,
    (_match, key: string, block: string) => (data[key] ? block : ''),
  ).replace(/\{\{ \.([a-zA-Z0-9_]+) \}\}/g, (_match, key: string) => data[key] ?? '');
}

/**
 * Show a rendered email in one theme regardless of the viewer's own setting —
 * for the admin previews' Light / Dark switch. Dark turns the dark-mode block
 * on unconditionally; light turns it off. Not for sending.
 */
export function forceEmailColorScheme(html: string, scheme: 'light' | 'dark'): string {
  return html
    .split(DARK_QUERY)
    .join(scheme === 'dark' ? '@media all' : '@media not all')
    .replace(
      '<meta name="color-scheme" content="light dark">',
      `<meta name="color-scheme" content="${scheme}">`,
    );
}
