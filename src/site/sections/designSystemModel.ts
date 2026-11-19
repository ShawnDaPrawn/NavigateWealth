/**
 * The Design System page's content, as the "Design system" board lists it:
 * the tabs, the overview, the colour tokens and tested pairs, the type scale,
 * and the catalogues of components, patterns, section templates, icons and
 * downloads. Previews are drawn in DesignSystemCatalogue.tsx; the snippets
 * here are what each "Copy code" button copies, written against the classes
 * and tokens the Navigator stylesheets (navigator.css, sections.css) define.
 */
import type { DsIconName } from './DesignSystemIcons';

export type DsTabId =
  | 'overview'
  | 'colors'
  | 'typography'
  | 'components'
  | 'patterns'
  | 'icons'
  | 'sections'
  | 'download';

/** The live page's tab values, in its order, with the board's labels and icons. */
export const DS_TABS: readonly { id: DsTabId; label: string; icon: DsIconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'info' },
  { id: 'colors', label: 'Colours', icon: 'palette' },
  { id: 'typography', label: 'Typography', icon: 'type' },
  { id: 'components', label: 'Components', icon: 'component' },
  { id: 'patterns', label: 'Patterns', icon: 'grid' },
  { id: 'icons', label: 'Icons', icon: 'compass' },
  { id: 'sections', label: 'Sections', icon: 'layers' },
  { id: 'download', label: 'Download', icon: 'download' },
];

/** Element ids that tie each tab to its panel. */
export const tabId = (id: DsTabId) => `nwds-tab-${id}`;
export const panelId = (id: DsTabId) => `nwds-panel-${id}`;

/* ── Colour ── */

export interface DsSwatch {
  token: string;
  hex: string;
}

/**
 * The colour tokens of the design system (nw-system.css): 38 in all. The
 * swatches show the ones the board picks out; the rest are the -dark and
 * -line companions of the status colours.
 */
export const COLOUR_TOKEN_COUNT = 38;

export const DS_SWATCH_GROUPS: readonly { label: string; swatches: DsSwatch[] }[] = [
  {
    label: 'Navy',
    swatches: [
      { token: '--nw-ink', hex: '#0D1626' },
      { token: '--nw-ink-2', hex: '#12203A' },
      { token: '--nw-ink-3', hex: '#1C2638' },
      { token: '--nw-ink-deep', hex: '#0A0F1A' },
    ],
  },
  {
    label: 'Ivory and surfaces',
    swatches: [
      { token: '--nw-paper', hex: '#F6F4EF' },
      { token: '--nw-paper-2', hex: '#EFEBE3' },
      { token: '--nw-paper-3', hex: '#FBFAF7' },
      { token: '--nw-white', hex: '#FFFFFF' },
    ],
  },
  {
    label: 'Hairlines',
    swatches: [
      { token: '--nw-line-soft', hex: '#ECE7DE' },
      { token: '--nw-line', hex: '#E2DDD3' },
      { token: '--nw-line-strong', hex: '#D3CCBF' },
      { token: '--nw-line-heavy', hex: '#B9B2A4' },
    ],
  },
  {
    label: 'Text',
    swatches: [
      { token: '--nw-text-strong', hex: '#2F3747' },
      { token: '--nw-text', hex: '#3D4556' },
      { token: '--nw-muted', hex: '#5E6676' },
      { token: '--nw-on-dark', hex: '#C5CAD3' },
      { token: '--nw-on-dark-muted', hex: '#9AA3B2' },
      { token: '--nw-cream', hex: '#E3D9C3' },
    ],
  },
  {
    label: 'Action',
    swatches: [
      { token: '--nw-violet', hex: '#6D28D9' },
      { token: '--nw-violet-hover', hex: '#5B21B6' },
      { token: '--nw-violet-tint', hex: '#F4F1FB' },
      { token: '--nw-disabled', hex: '#B9BFCA' },
    ],
  },
  {
    label: 'Status',
    swatches: [
      { token: '--nw-success', hex: '#15803D' },
      { token: '--nw-success-bright', hex: '#4ADE80' },
      { token: '--nw-success-bg', hex: '#F0FDF4' },
      { token: '--nw-danger', hex: '#B91C1C' },
      { token: '--nw-danger-bg', hex: '#FEF2F2' },
      { token: '--nw-warn', hex: '#B45309' },
      { token: '--nw-warn-bg', hex: '#FFFBEB' },
      { token: '--nw-info', hex: '#1D4ED8' },
      { token: '--nw-info-bg', hex: '#EFF6FF' },
    ],
  },
];

export interface DsContrastPair {
  fg: string;
  bg: string;
  ratio: string;
  grade: 'AA' | 'AAA';
}

export const DS_CONTRAST_PAIRS: readonly DsContrastPair[] = [
  { fg: '--nw-ink', bg: '--nw-white', ratio: '18.1 : 1', grade: 'AAA' },
  { fg: '--nw-text', bg: '--nw-white', ratio: '9.6 : 1', grade: 'AAA' },
  { fg: '--nw-muted', bg: '--nw-paper', ratio: '5.3 : 1', grade: 'AA' },
  { fg: '--nw-white', bg: '--nw-violet', ratio: '7.1 : 1', grade: 'AAA' },
  { fg: '--nw-on-dark', bg: '--nw-ink', ratio: '11.0 : 1', grade: 'AAA' },
  { fg: '--nw-on-dark-muted', bg: '--nw-ink', ratio: '7.1 : 1', grade: 'AAA' },
  { fg: '--nw-cream', bg: '--nw-ink', ratio: '12.9 : 1', grade: 'AAA' },
  { fg: '--nw-danger', bg: '--nw-danger-bg', ratio: '5.9 : 1', grade: 'AA' },
];

/* ── Typography ── */

export interface DsTypeRow {
  token: string;
  sizes: string;
  /** A scale step drawn with the token itself, or a class shown as it renders. */
  kind: 'serif' | 'sans' | 'eyebrow' | 'mono';
  lineHeight?: number;
  sample: string;
  /** Italic serif tail of the display sample. */
  accent?: string;
}

export const DS_TYPE_ROWS: readonly DsTypeRow[] = [
  {
    token: '--nw-fs-display',
    sizes: '60 → 30',
    kind: 'serif',
    lineHeight: 1.05,
    sample: 'Secure your ',
    accent: 'future',
  },
  {
    token: '--nw-fs-h1s',
    sizes: '52 → 30',
    kind: 'serif',
    lineHeight: 1.08,
    sample: 'Legal notices',
  },
  {
    token: '--nw-fs-h2',
    sizes: '44 → 24',
    kind: 'serif',
    lineHeight: 1.1,
    sample: 'Retirement planning for individuals',
  },
  {
    token: '--nw-fs-h2s',
    sizes: '36 → 24',
    kind: 'serif',
    lineHeight: 1.15,
    sample: 'Frequently asked questions',
  },
  {
    token: '--nw-fs-h3',
    sizes: '30 → 21',
    kind: 'serif',
    lineHeight: 1.2,
    sample: 'Preservation funds',
  },
  {
    token: '--nw-fs-h4',
    sizes: '22 → 19',
    kind: 'serif',
    lineHeight: 1.25,
    sample: 'Send us a message',
  },
  {
    token: '--nw-fs-h5',
    sizes: '19 → 17.5',
    kind: 'serif',
    lineHeight: 1.3,
    sample: 'Tax-free growth',
  },
  {
    token: '--nw-fs-lead',
    sizes: '18 → 15.5',
    kind: 'sans',
    lineHeight: 1.65,
    sample: 'Comprehensive retirement planning, tailored to your goals.',
  },
  {
    token: '--nw-fs-body',
    sizes: '16 → 15',
    kind: 'sans',
    lineHeight: 1.65,
    sample: 'Preservation funds protect your benefits when you leave employment.',
  },
  { token: '.nw-eyebrow', sizes: '11.5', kind: 'eyebrow', sample: '01 — For individuals' },
  { token: '.nw-mono', sizes: 'tabular', kind: 'mono', sample: 'R1 250 000 · 7.25%' },
];

/* ── Overview ── */

export const DS_PRINCIPLES: readonly { title: string; text: string }[] = [
  {
    title: 'Two actions',
    text: 'Book a Free Consultation everywhere; Get a Quote on service pages and pop-ups. Never two consultation buttons side by side.',
  },
  {
    title: 'Navy and ivory carry the brand',
    text: 'Violet is reserved for actions, active states and the focus ring.',
  },
  {
    title: 'One rhythm',
    text: 'Sections alternate white, ivory and navy. Two navy bands never touch — the footer counts.',
  },
  {
    title: 'One weight',
    text: 'Every icon uses a 1.75 stroke; every button is 40, 48 or 56 tall.',
  },
  {
    title: 'Phones are designed, not shrunk',
    text: 'Their own type scale, product pop-ups, and decorative photos step aside.',
  },
];

export const DS_FEATURES: readonly {
  icon: DsIconName;
  title: string;
  text: string;
  tags: string[];
}[] = [
  {
    icon: 'shield-check',
    title: 'Authentication System',
    text: 'Complete login and sign-up flows with account type selection and a multi-step application.',
    tags: ['Login / Sign-up', 'Protected routes', '4-step application'],
  },
  {
    icon: 'grid',
    title: 'Navigation System',
    text: 'Multi-level navigation: top bar, main navigation with mega menus, and dashboard navigation.',
    tags: ['Top bar', 'Mega menus', 'Dashboard nav'],
  },
  {
    icon: 'user',
    title: 'User Management',
    text: 'Profile system with a four-section dropdown and admin account switching.',
    tags: ['Profile', 'Settings', 'Security'],
  },
  {
    icon: 'briefcase',
    title: 'Admin Dashboard',
    text: 'Full client management with 11 modules and administrative controls.',
    tags: ['11 modules', 'Client management', 'Compliance'],
  },
];

export const DS_COVERAGE: readonly { title: string; items: string[] }[] = [
  {
    title: 'Public Pages',
    items: [
      'Home Page',
      'About Us',
      'Services (8 pages)',
      'Contact & Get Quote',
      'Resources & Press',
    ],
  },
  {
    title: 'Client Portal',
    items: ['Dashboard', 'Products & Services', 'Transactions & Docs', 'Profile & Settings'],
  },
  {
    title: 'Admin System',
    items: [
      'Client Management',
      'Compliance Tools',
      'Communication Hub',
      'Advice Engine',
      'Social Media Mgmt',
    ],
  },
];

/* ── Components ── */

export type DsComponentCategory = 'display' | 'feedback' | 'form' | 'navigation' | 'overlay';

export interface DsCatalogueItem<C extends string = string> {
  key: string;
  title: string;
  category: C;
  tag: string;
  text: string;
  code: string;
}

export const DS_COMPONENT_CATEGORIES: readonly {
  id: 'all' | DsComponentCategory;
  label: string;
}[] = [
  { id: 'all', label: 'All' },
  { id: 'display', label: 'Display' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'form', label: 'Form' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'overlay', label: 'Overlay' },
];

const BADGE = (tone: string, text: string, fg = `--nw-${tone}`) =>
  `<span style="display:inline-flex;align-items:center;height:26px;padding:0 10px;border:1px solid var(--nw-${tone}-line);border-radius:var(--nw-r-sm);background:var(--nw-${tone}-bg);color:var(${fg});font-size:12.5px;font-weight:600">${text}</span>`;

export const DS_COMPONENTS: readonly DsCatalogueItem<DsComponentCategory>[] = [
  {
    key: 'c_button',
    title: 'Button',
    category: 'form',
    tag: 'Form',
    text: 'Three styles in three sizes (40, 48, 56). Violet is only ever an action.',
    code: [
      '<a class="nw-btn" href="/schedule-consultation">Book a Free Consultation</a>',
      '<a class="nw-outline" href="/get-quote">Get a Quote</a>',
      '<button type="button" class="nw-btn nw-btn--sm" disabled>Disabled</button>',
    ].join('\n'),
  },
  {
    key: 'c_badge',
    title: 'Badge',
    category: 'display',
    tag: 'Display',
    text: 'Status only — never decoration.',
    code: [
      BADGE('success', 'Active'),
      BADGE('warn', 'Pending', '--nw-warn-dark'),
      BADGE('danger', 'Declined'),
    ].join('\n'),
  },
  {
    key: 'c_card',
    title: 'Card',
    category: 'display',
    tag: 'Display',
    text: 'White surface, 8px radius, hairline border, shadow only on hover.',
    code: [
      '<article style="padding:18px;border:1px solid var(--nw-line);border-radius:var(--nw-r-md);background:var(--nw-white)">',
      '  <span class="nw-eyebrow" style="color:var(--nw-muted)">Retirement</span>',
      '  <h3 class="nw-h" style="margin:10px 0 0;font-size:21px;color:var(--nw-ink)">Preservation Funds</h3>',
      '  <p style="margin:6px 0 0;font-size:14px;line-height:1.55">Keep your benefits growing tax-efficiently when you change jobs.</p>',
      '</article>',
    ].join('\n'),
  },
  {
    key: 'c_avatar',
    title: 'Avatar with fallback',
    category: 'display',
    tag: 'Display',
    text: 'Initials on navy when there is no photo.',
    code: '<span style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:var(--nw-ink);color:var(--nw-cream);font:600 14px var(--nw-font-sans)">TM</span>',
  },
  {
    key: 'c_alert',
    title: 'Alert',
    category: 'feedback',
    tag: 'Feedback',
    text: 'Says what happened and what to do next.',
    code: '<div class="nw-form-alert" role="alert"><strong>Upload failed.</strong> The file is over 10 MB — try a smaller PDF.</div>',
  },
  {
    key: 'c_progress',
    title: 'Progress indicator',
    category: 'feedback',
    tag: 'Feedback',
    text: 'Steps for flows, a bar for uploads.',
    code: [
      '<ol aria-label="Progress">',
      '  <li>Service</li>',
      '  <li aria-current="step">Details</li>',
      '  <li>Quote</li>',
      '</ol>',
      '<div role="progressbar" aria-valuenow="66" aria-valuemin="0" aria-valuemax="100" style="height:6px;border-radius:3px;background:var(--nw-paper-2)"><i style="display:block;width:66%;height:100%;background:var(--nw-ink)"></i></div>',
    ].join('\n'),
  },
  {
    key: 'c_skeleton',
    title: 'Skeleton',
    category: 'feedback',
    tag: 'Feedback',
    text: 'Matches the shape of the content it stands in for.',
    code: '<span aria-hidden="true" style="display:block;height:14px;border-radius:var(--nw-r-sm);background:linear-gradient(90deg,var(--nw-paper-2) 0,var(--nw-paper) 160px,var(--nw-paper-2) 320px);background-size:800px 100%"></span>',
  },
  {
    key: 'c_form',
    title: 'Form controls',
    category: 'form',
    tag: 'Form',
    text: '16px text so phones never zoom; required fields marked.',
    code: [
      '<label for="name">Full name</label>',
      '<input id="name" type="text" autocomplete="name" required style="height:44px;padding:0 12px;border:1px solid var(--nw-line-strong);border-radius:var(--nw-r-sm);font:16px var(--nw-font-sans)">',
    ].join('\n'),
  },
  {
    key: 'c_dashnav',
    title: 'Dashboard navigation',
    category: 'navigation',
    tag: 'Navigation',
    text: 'Active item marked with a violet rule, not a filled block.',
    code: [
      '<nav aria-label="Dashboard">',
      '  <a href="/dashboard" aria-current="page" style="box-shadow:inset 2px 0 0 var(--nw-violet);background:var(--nw-paper);font-weight:600">Overview</a>',
      '  <a href="/products-services-dashboard">Policies</a>',
      '</nav>',
    ].join('\n'),
  },
  {
    key: 'c_profile',
    title: 'User profile dropdown',
    category: 'navigation',
    tag: 'Navigation',
    text: 'Profile, settings, security and sign out — in that order.',
    code: [
      '<div role="menu" aria-label="Account">',
      '  <a role="menuitem" href="/profile">Profile</a>',
      '  <a role="menuitem" href="/profile">Settings</a>',
      '  <a role="menuitem" href="/security">Security</a>',
      '  <button type="button" role="menuitem" style="color:var(--nw-danger)">Sign out</button>',
      '</div>',
    ].join('\n'),
  },
  {
    key: 'c_navitem',
    title: 'Navigation menu item',
    category: 'navigation',
    tag: 'Navigation',
    text: 'Underline in violet for the current page.',
    code: '<a class="nwh-link" href="/services" aria-current="page">Services</a>',
  },
  {
    key: 'c_dialog',
    title: 'Dialog / modal',
    category: 'overlay',
    tag: 'Overlay',
    text: 'One question, two clear answers; the destructive one is red.',
    code: [
      '<div role="alertdialog" aria-modal="true" aria-labelledby="clear-title">',
      '  <h2 id="clear-title" class="nw-h">Clear conversation?</h2>',
      "  <p>This removes the messages on this device. It can't be undone.</p>",
      '  <button type="button" class="nw-outline nw-btn--sm">Cancel</button>',
      '  <button type="button" class="nw-btn--sm" style="background:var(--nw-danger);color:#fff">Clear</button>',
      '</div>',
    ].join('\n'),
  },
  {
    key: 'c_tooltip',
    title: 'Tooltip',
    category: 'overlay',
    tag: 'Overlay',
    text: 'Short, factual, never the only place information lives.',
    code: [
      '<button type="button" aria-label="What is Regulation 28?" aria-describedby="reg28-tip">…</button>',
      '<span id="reg28-tip" role="tooltip">Regulation 28 limits offshore exposure to 45%</span>',
    ].join('\n'),
  },
];

/* ── Patterns ── */

export const DS_PATTERNS: readonly DsCatalogueItem<'pattern'>[] = [
  {
    key: 'p_stat',
    title: 'Stat card',
    category: 'pattern',
    tag: 'Pattern',
    text: 'Tabular figures, a label beneath, change in context.',
    code: [
      '<div style="display:flex;flex-direction:column;gap:6px;padding:18px;border:1px solid var(--nw-line);border-radius:var(--nw-r-md)">',
      '  <span class="nw-label" style="color:var(--nw-muted)">Assets under advice</span>',
      '  <span class="nw-mono" style="font-size:30px;color:var(--nw-ink)">R1 250 000</span>',
      '  <span style="font-size:13px;color:var(--nw-success)">6.2% this year</span>',
      '</div>',
    ].join('\n'),
  },
  {
    key: 'p_badges',
    title: 'Status badges',
    category: 'pattern',
    tag: 'Pattern',
    text: 'Colour plus words, never colour alone.',
    code: [
      BADGE('success', 'In force'),
      BADGE('warn', 'Awaiting signature', '--nw-warn-dark'),
      BADGE('info', 'Under review', '--nw-info-dark'),
    ].join('\n'),
  },
  {
    key: 'p_empty',
    title: 'Empty state',
    category: 'pattern',
    tag: 'Pattern',
    text: 'Explain why it is empty and offer the next step.',
    code: [
      '<div style="display:flex;flex-direction:column;align-items:center;text-align:center">',
      '  <p class="nw-h" style="font-size:19px;color:var(--nw-ink)">No documents yet</p>',
      '  <p style="font-size:14px">Your adviser will share policy documents here.</p>',
      '  <a class="nw-outline nw-btn--sm" href="/get-quote">Get a Quote</a>',
      '</div>',
    ].join('\n'),
  },
  {
    key: 'p_skel',
    title: 'Loading skeleton',
    category: 'pattern',
    tag: 'Pattern',
    text: 'Holds layout so nothing jumps when data arrives.',
    code: [
      '<div aria-busy="true" aria-label="Loading" style="display:grid;gap:10px">',
      '  <span style="height:120px;border-radius:var(--nw-r-md);background:var(--nw-paper-2)"></span>',
      '  <span style="width:30%;height:10px;border-radius:var(--nw-r-sm);background:var(--nw-paper-2)"></span>',
      '  <span style="width:85%;height:16px;border-radius:var(--nw-r-sm);background:var(--nw-paper-2)"></span>',
      '</div>',
    ].join('\n'),
  },
  {
    key: 'p_error',
    title: 'Error state',
    category: 'pattern',
    tag: 'Pattern',
    text: 'Plain words, no blame, a way forward.',
    code: '<div class="nw-form-alert" role="alert"><strong>We couldn\'t load your policies.</strong> Check your connection and <button type="button">try again</button>.</div>',
  },
  {
    key: 'p_spinner',
    title: 'Loading spinner',
    category: 'pattern',
    tag: 'Pattern',
    text: 'Only for waits under two seconds; otherwise use a skeleton.',
    code: [
      '<span role="status">',
      '  <span aria-hidden="true" style="display:inline-block;width:22px;height:22px;border-radius:50%;border:2px solid var(--nw-line);border-top-color:var(--nw-ink)"></span>',
      '  Sending…',
      '</span>',
    ].join('\n'),
  },
  {
    key: 'p_validation',
    title: 'Form validation',
    category: 'pattern',
    tag: 'Pattern',
    text: 'Errors appear under the field and say how to fix it.',
    code: [
      '<input id="email" type="email" aria-invalid="true" aria-describedby="email-error" style="border-color:var(--nw-danger);box-shadow:0 0 0 3px rgba(185,28,28,.12)">',
      '<p id="email-error" style="margin:6px 0 0;font-size:13px;color:var(--nw-danger)">That email address looks incomplete — check the part after the @.</p>',
    ].join('\n'),
  },
  {
    key: 'p_toggle',
    title: 'Toggle / switch',
    category: 'pattern',
    tag: 'Pattern',
    text: 'For settings that apply immediately.',
    code: '<button type="button" role="switch" aria-checked="true" aria-label="Monthly briefing" style="width:40px;height:24px;border-radius:12px;background:var(--nw-violet)"></button>',
  },
  {
    key: 'p_tooltip',
    title: 'Tooltips',
    category: 'pattern',
    tag: 'Pattern',
    text: 'On an icon button with an accessible name.',
    code: [
      '<button type="button" aria-label="Copy reference" aria-describedby="copy-tip">…</button>',
      '<span id="copy-tip" role="tooltip">Copy reference</span>',
    ].join('\n'),
  },
  {
    key: 'p_table',
    title: 'Data table row',
    category: 'pattern',
    tag: 'Pattern',
    text: 'Names left, figures right-aligned in tabular numerals.',
    code: [
      '<tr>',
      '  <td>John Doe</td>',
      `  <td>${BADGE('success', 'Active')}</td>`,
      '  <td class="nw-mono" style="text-align:right">R 842 000</td>',
      '</tr>',
    ].join('\n'),
  },
  {
    key: 'p_search',
    title: 'Search & filter bar',
    category: 'pattern',
    tag: 'Pattern',
    text: 'Search first, filters second, results count always visible.',
    code: [
      '<input type="search" aria-label="Search clients" placeholder="Search clients">',
      '<button type="button" aria-pressed="true">All</button>',
      '<button type="button" aria-pressed="false">Active</button>',
      '<span role="status">24 results</span>',
    ].join('\n'),
  },
  {
    key: 'p_destructive',
    title: 'Destructive action confirmation',
    category: 'pattern',
    tag: 'Pattern',
    text: 'Name the thing being removed; make cancel the easy option.',
    code: [
      '<div role="alertdialog" aria-modal="true" aria-labelledby="remove-title">',
      '  <h2 id="remove-title" class="nw-h">Remove Sarah van der Merwe?</h2>',
      '  <p>Her documents stay archived for five years, as the FAIS Act requires.</p>',
      '  <button type="button" class="nw-outline nw-btn--sm">Keep client</button>',
      '  <button type="button" class="nw-btn--sm" style="background:var(--nw-danger);color:#fff">Remove</button>',
      '</div>',
    ].join('\n'),
  },
];

/* ── Section templates ── */

export type DsSectionCategory = 'background' | 'layout';

export const DS_SECTION_CATEGORIES: readonly { id: 'all' | DsSectionCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'background', label: 'Backgrounds' },
  { id: 'layout', label: 'Layouts' },
];

export interface DsSectionTemplate extends DsCatalogueItem<DsSectionCategory> {
  /** The CSS the card prints under its description. */
  css: string;
}

const SECTION = (css: string) =>
  `<section style="${css.replace(/; /g, ';')}">\n  <div class="nw-wrap">…</div>\n</section>`;

export const DS_SECTIONS: readonly DsSectionTemplate[] = [
  {
    key: 's_white',
    title: 'White section',
    category: 'background',
    tag: 'Background',
    text: 'Default content band.',
    css: 'background: var(--nw-white)',
    code: SECTION('background: var(--nw-white); padding: var(--nw-sec-lg) 0'),
  },
  {
    key: 's_ivory',
    title: 'Ivory section',
    category: 'background',
    tag: 'Background',
    text: 'Alternating band; closing calls to action sit here.',
    css: 'background: var(--nw-paper)',
    code: SECTION('background: var(--nw-paper); padding: var(--nw-sec-lg) 0'),
  },
  {
    key: 's_navy',
    title: 'Navy section',
    category: 'background',
    tag: 'Background',
    text: 'Heroes and one feature band per page — never next to another navy band.',
    css: 'background: var(--nw-ink); color: var(--nw-on-dark)',
    code: SECTION(
      'background: var(--nw-ink); color: var(--nw-on-dark); padding: var(--nw-sec-lg) 0',
    ),
  },
  {
    key: 's_deep',
    title: 'Deep navy (footer)',
    category: 'background',
    tag: 'Background',
    text: 'Reserved for the footer.',
    css: 'background: var(--nw-ink-deep); color: var(--nw-on-dark)',
    code: SECTION('background: var(--nw-ink-deep); color: var(--nw-on-dark)'),
  },
  {
    key: 's_two',
    title: 'Two column layout',
    category: 'layout',
    tag: 'Layout',
    text: 'Copy left, visual or form right; stacks on phones.',
    css: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr)); gap: 56px',
    code: '<div class="nw-wrap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:56px">\n  <div>…</div>\n  <div>…</div>\n</div>',
  },
  {
    key: 's_three',
    title: 'Three column grid',
    category: 'layout',
    tag: 'Layout',
    text: 'Cards and articles; two columns on tablets, a list on phones.',
    css: 'display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px',
    code: '<div class="nw-wrap" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px">\n  <article>…</article>\n  <article>…</article>\n  <article>…</article>\n</div>',
  },
  {
    key: 's_hero',
    title: 'Centred hero',
    category: 'layout',
    tag: 'Layout',
    text: 'Eyebrow, headline, one line, two actions, trust line.',
    css: 'text-align: center; padding: var(--nw-sec-lg) 0',
    code: [
      '<section style="background:var(--nw-ink);color:var(--nw-on-dark);text-align:center;padding:var(--nw-sec-lg) 0">',
      '  <div class="nw-wrap">',
      '    <h1 class="nw-h">…</h1>',
      '    <a class="nw-btn" href="/schedule-consultation">Book a Free Consultation</a>',
      '    <a class="nw-ghost-dark" href="/get-quote">Get a Quote</a>',
      '    <ul class="nw-trust nw-trust--dark">…</ul>',
      '  </div>',
      '</section>',
    ].join('\n'),
  },
  {
    key: 's_cta',
    title: 'Call to action band',
    category: 'layout',
    tag: 'Layout',
    text: 'Ivory, centred, the two actions — the last band before the footer.',
    css: 'background: var(--nw-paper-2); padding: var(--nw-sec-lg) 0',
    code: [
      '<section style="background:var(--nw-paper-2);text-align:center;padding:var(--nw-sec-lg) 0">',
      '  <div class="nw-wrap">',
      '    <h2 class="nw-h">…</h2>',
      '    <a class="nw-btn" href="/schedule-consultation">Book a Free Consultation</a>',
      '    <a class="nw-outline" href="/get-quote">Get a Quote</a>',
      '  </div>',
      '</section>',
    ].join('\n'),
  },
];

/* ── Icons ── */

export const DS_ICON_LIST: readonly DsIconName[] = [
  'home',
  'chevron-down',
  'chevron-right',
  'arrow-right',
  'arrow-left',
  'arrow-up',
  'external-link',
  'link',
  'plus',
  'minus',
  'check',
  'x',
  'menu',
  'pencil',
  'trash',
  'copy',
  'download',
  'upload',
  'send',
  'search',
  'filter',
  'refresh',
  'phone',
  'mail',
  'map-pin',
  'calendar',
  'clock',
  'user',
  'users',
  'shield',
  'shield-check',
  'lock',
  'file-text',
  'briefcase',
  'building',
  'trending-up',
  'pie-chart',
  'compass',
  'info',
  'alert-circle',
];

/* ── Downloads ── */

export interface DsDownload {
  /** The live Download tab's template id: the CLI command copies it. */
  id: string;
  title: string;
  tag: string;
  text: string;
  icon: DsIconName;
}

export const DS_DOWNLOADS: readonly DsDownload[] = [
  {
    id: 'design-tokens',
    title: 'Design Tokens',
    tag: 'CSS',
    text: 'The nw-system.css file: colour, type, spacing, radius, shadow and motion tokens, plus the shared components.',
    icon: 'palette',
  },
  {
    id: 'ui-components',
    title: 'Component Library',
    tag: 'TSX',
    text: 'React components built on Radix UI primitives and Tailwind CSS, mapped to the tokens.',
    icon: 'component',
  },
  {
    id: 'page-templates',
    title: 'Page Templates',
    tag: 'TSX',
    text: 'Pre-built layouts for common views — lists, detail pages, forms and dashboards.',
    icon: 'layers',
  },
  {
    id: 'full-codebase',
    title: 'Full Codebase',
    tag: 'ZIP',
    text: 'The complete Navigate Wealth platform source, including all modules and configuration.',
    icon: 'package',
  },
];

/** The live page's install command (DownloadCodebaseTab.tsx). */
export const cliCommand = (id: string) => `npx navigate-wealth-cli init --template ${id}`;
