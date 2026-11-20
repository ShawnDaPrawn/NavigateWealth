/**
 * The Design System page's catalogue tabs — Components, Patterns, Icons,
 * Sections and Download — as the "Design system" board draws them. Each
 * preview is built from the site's own classes and tokens; "Copy code" copies
 * the snippet from designSystemModel.ts, "Copy CLI" the live page's install
 * command, and an icon tile its name.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { DsIcon } from './DesignSystemIcons';
import {
  DS_COMPONENT_CATEGORIES,
  DS_COMPONENTS,
  DS_DOWNLOADS,
  DS_ICON_LIST,
  DS_PATTERNS,
  DS_SECTION_CATEGORIES,
  DS_SECTIONS,
  cliCommand,
  type DsCatalogueItem,
  type DsComponentCategory,
  type DsSectionCategory,
} from './designSystemModel';

export interface CopyControl {
  /** The key of the item whose copy button reads "Copied", if any. */
  copied: string | null;
  copy: (key: string, text: string, what: string) => void;
}

/* ── Cards ── */

function CopyButton({
  label,
  itemKey,
  text,
  what,
  control,
}: {
  label: string;
  itemKey: string;
  text: string;
  what: string;
  control: CopyControl;
}) {
  return (
    <button
      type="button"
      className="nwds-copy"
      aria-label={`Copy code: ${label}`}
      onClick={() => control.copy(itemKey, text, what)}
    >
      <DsIcon name="copy" size={14} />
      <span>{control.copied === itemKey ? 'Copied' : 'Copy code'}</span>
    </button>
  );
}

function ItemCard({
  item,
  control,
  preview,
  thumb = false,
  children,
}: {
  item: DsCatalogueItem;
  control: CopyControl;
  preview: ReactNode;
  thumb?: boolean;
  children?: ReactNode;
}) {
  const prevClass = thumb
    ? 'nwds-prev nwds-prev--thumb'
    : item.key === 'c_button'
      ? 'nwds-prev nwds-prev--actions'
      : 'nwds-prev';
  return (
    <article className="nwds-item">
      <header className="nwds-item-h">
        <div>
          <h3 className="nwds-item-t">{item.title}</h3>
          <span className="nwds-tag">{item.tag}</span>
        </div>
        <CopyButton
          label={item.title}
          itemKey={item.key}
          text={item.code}
          what={`${item.title} code`}
          control={control}
        />
      </header>
      <div className={prevClass}>{preview}</div>
      <p className="nwds-item-d">
        {item.text}
        {children}
      </p>
    </article>
  );
}

/* ── Components ── */

const COMPONENT_PREVIEWS: Record<string, ReactNode> = {
  c_button: (
    <>
      <Link className="nw-btn nwds-b nwds-b48" to="/schedule-consultation">
        Book a Free Consultation
      </Link>
      <Link className="nw-outline nwds-b nwds-b48" to="/get-quote">
        Get a Quote
      </Link>
      <button type="button" className="nw-btn nwds-b nwds-b40" disabled>
        Disabled
      </button>
    </>
  ),
  c_badge: (
    <>
      <span className="nwds-badge nwds-badge--success">Active</span>
      <span className="nwds-badge nwds-badge--warn">Pending</span>
      <span className="nwds-badge nwds-badge--danger">Declined</span>
      <span className="nwds-badge nwds-badge--neutral">Draft</span>
    </>
  ),
  c_card: (
    <div className="nwds-mini-card">
      <span className="nw-eyebrow">Retirement</span>
      <p className="nw-h nwds-mini-t">Preservation Funds</p>
      <p className="nwds-mini-d">
        Keep your benefits growing tax-efficiently when you change jobs.
      </p>
      <span className="nwds-mini-go">
        Read more <DsIcon name="arrow-right" size={14} />
      </span>
    </div>
  ),
  c_avatar: (
    <>
      <span className="nwds-av">TM</span>
      <span className="nwds-av nwds-av--paper">SV</span>
      <span className="nwds-av nwds-av--violet">MJ</span>
      <span className="nwds-av nwds-av--icon">
        <DsIcon name="user" size={18} />
      </span>
    </>
  ),
  c_alert: (
    <>
      <div className="nwds-alert nwds-alert--info">
        <DsIcon name="info" size={16} />
        <span>
          <strong>Heads up.</strong> Tax year-end is 28 February.
        </span>
      </div>
      <div className="nwds-alert nwds-alert--danger">
        <DsIcon name="alert-circle" size={16} />
        <span>
          <strong>Upload failed.</strong> The file is over 10 MB — try a smaller PDF.
        </span>
      </div>
    </>
  ),
  c_progress: (
    <div className="nwds-fill">
      <ol className="nwds-steps">
        <li className="nwds-st-done">
          <span>
            <DsIcon name="check" size={13} />
          </span>
          Service
        </li>
        <li className="nwds-st-on" aria-current="step">
          <span>2</span>Details
        </li>
        <li>
          <span>3</span>Quote
        </li>
      </ol>
      <div className="nwds-bar">
        <i style={{ width: '66%' }} />
      </div>
    </div>
  ),
  c_skeleton: (
    <div className="nwds-skel-row" aria-hidden="true">
      <span className="nwds-skel" style={{ width: 64, height: 48 }} />
      <span className="nwds-skel-col">
        <span className="nwds-skel" style={{ width: '40%', height: 10 }} />
        <span className="nwds-skel" style={{ width: '90%', height: 14 }} />
        <span className="nwds-skel" style={{ width: '70%', height: 14 }} />
      </span>
    </div>
  ),
  c_form: (
    <div className="nwds-stack">
      <input className="nwds-in" type="text" aria-label="Full name" placeholder="Full name" />
      <select className="nwds-in" aria-label="Service">
        <option>Retirement Planning</option>
      </select>
      <span className="nwds-check">
        <span className="nwds-cb">
          <DsIcon name="check" size={12} />
        </span>
        Email me the monthly briefing
      </span>
    </div>
  ),
  c_dashnav: (
    <nav className="nwds-dnav" aria-label="Example dashboard navigation">
      <a className="nwds-dnav-on" aria-current="page">
        <DsIcon name="home" size={16} />
        Overview
      </a>
      <a>
        <DsIcon name="briefcase" size={16} />
        Policies
      </a>
      <a>
        <DsIcon name="file-text" size={16} />
        Documents
      </a>
      <a>
        <DsIcon name="users" size={16} />
        Beneficiaries
      </a>
    </nav>
  ),
  c_profile: (
    <div className="nwds-menu">
      <div className="nwds-menu-h">
        <span className="nwds-av nwds-av--sm">TM</span>
        <span>
          <strong className="nwds-menu-name">Thabo Mokoena</strong>
          <span className="nwds-menu-mail">thabo@example.co.za</span>
        </span>
      </div>
      <a>
        <DsIcon name="user" size={15} />
        Profile
      </a>
      <a>
        <DsIcon name="pencil" size={15} />
        Settings
      </a>
      <a>
        <DsIcon name="lock" size={15} />
        Security
      </a>
      <a className="nwds-menu-out">
        <DsIcon name="arrow-left" size={15} />
        Sign out
      </a>
    </div>
  ),
  c_navitem: (
    <nav className="nwds-topnav" aria-label="Example top navigation">
      <Link to="/">Home</Link>
      <Link to="/services" className="nwds-topnav-on">
        Services <DsIcon name="chevron-down" size={14} />
      </Link>
      <Link to="/resources">Resources</Link>
      <Link to="/contact">Contact</Link>
    </nav>
  ),
  c_dialog: (
    <div className="nwds-dialog" role="presentation">
      <p className="nw-h nwds-dialog-t">Clear conversation?</p>
      <p className="nwds-dialog-d">
        This removes the messages on this device. It can&apos;t be undone.
      </p>
      <div className="nwds-dialog-a">
        <button type="button" className="nw-outline nwds-b nwds-b40">
          Cancel
        </button>
        <button type="button" className="nwds-b nwds-danger nwds-b40">
          Clear
        </button>
      </div>
    </div>
  ),
  c_tooltip: (
    <span className="nwds-tipwrap">
      <span className="nwds-tip" id="nwds-tip-reg28">
        Regulation 28 limits offshore exposure to 45%
      </span>
      <button
        type="button"
        className="nwds-iconbtn"
        aria-label="What is Regulation 28?"
        aria-describedby="nwds-tip-reg28"
      >
        <DsIcon name="info" size={18} />
      </button>
    </span>
  ),
};

export function ComponentsPanel({ control }: { control: CopyControl }) {
  const [category, setCategory] = useState<'all' | DsComponentCategory>('all');
  const shown = DS_COMPONENTS.filter((c) => category === 'all' || c.category === category);

  return (
    <>
      <h2 className="nwds-h2">Components</h2>
      <p className="nwds-lead">
        {DS_COMPONENTS.length} components in use today, built on the tokens. Copy a snippet to start
        from the right sizes, colours and states.
      </p>
      <div className="nwds-filters" role="group" aria-label="Filter components by category">
        {DS_COMPONENT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className="nwds-pill"
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
        <span className="nwds-count" role="status">
          {shown.length} {shown.length === 1 ? 'component' : 'components'}
        </span>
      </div>
      <div className="nwds-items">
        {shown.map((item) => (
          <ItemCard
            key={item.key}
            item={item}
            control={control}
            preview={COMPONENT_PREVIEWS[item.key]}
          />
        ))}
      </div>
    </>
  );
}

/* ── Patterns ── */

const PATTERN_PREVIEWS: Record<string, ReactNode> = {
  p_stat: (
    <div className="nwds-stat">
      <span className="nwds-cap">Assets under advice</span>
      <span className="nw-mono nwds-stat-v">R1 250 000</span>
      <span className="nwds-stat-c">
        <DsIcon name="trending-up" size={14} /> 6.2% this year
      </span>
    </div>
  ),
  p_badges: (
    <>
      <span className="nwds-badge nwds-badge--success">In force</span>
      <span className="nwds-badge nwds-badge--warn">Awaiting signature</span>
      <span className="nwds-badge nwds-badge--info">Under review</span>
    </>
  ),
  p_empty: (
    <div className="nwds-empty">
      <span className="nwds-empty-ic">
        <DsIcon name="file-text" size={22} />
      </span>
      <p className="nw-h nwds-empty-t">No documents yet</p>
      <p className="nwds-empty-d">Your adviser will share policy documents here.</p>
      <Link className="nw-outline nwds-b nwds-b40" to="/get-quote">
        Get a Quote
      </Link>
    </div>
  ),
  p_skel: (
    <div className="nwds-stack" aria-hidden="true">
      <span className="nwds-skel" style={{ height: 120, borderRadius: 'var(--nw-r-md)' }} />
      <span className="nwds-skel" style={{ width: '30%', height: 10 }} />
      <span className="nwds-skel" style={{ width: '85%', height: 16 }} />
    </div>
  ),
  p_error: (
    <div className="nwds-alert nwds-alert--danger">
      <DsIcon name="alert-circle" size={16} />
      <span>
        <strong>We couldn&apos;t load your policies.</strong> Check your connection and{' '}
        <u>try again</u>.
      </span>
    </div>
  ),
  p_spinner: (
    <>
      <span className="nwds-spin" aria-hidden="true" />
      <span className="nwds-small">Sending…</span>
    </>
  ),
  p_validation: (
    <div className="nwds-fill">
      <input
        className="nwds-in nwds-invalid"
        type="email"
        defaultValue="thabo@"
        aria-label="Email address"
        aria-invalid="true"
        aria-describedby="nwds-email-error"
      />
      <p className="nwds-field-error" id="nwds-email-error">
        <DsIcon name="alert-circle" size={14} />
        That email address looks incomplete — check the part after the @.
      </p>
    </div>
  ),
  p_toggle: (
    <>
      <span className="nwds-switch">
        <span className="nwds-sw-on">
          <i />
        </span>
        Monthly briefing
      </span>
      <span className="nwds-switch">
        <span>
          <i />
        </span>
        Product news
      </span>
    </>
  ),
  p_tooltip: (
    <span className="nwds-tipwrap">
      <span className="nwds-tip" aria-hidden="true">
        Copy reference
      </span>
      <button type="button" className="nwds-iconbtn" aria-label="Copy reference">
        <DsIcon name="copy" size={17} />
      </button>
    </span>
  ),
  p_table: (
    <table className="nwds-table">
      <thead>
        <tr>
          <th scope="col">Client</th>
          <th scope="col">Status</th>
          <th scope="col" className="nwds-num">
            Value
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <span className="nwds-av nwds-av--xs">JD</span>John Doe
          </td>
          <td>
            <span className="nwds-badge nwds-badge--success">Active</span>
          </td>
          <td className="nw-mono nwds-num">R 842 000</td>
        </tr>
        <tr>
          <td>
            <span className="nwds-av nwds-av--xs nwds-av--paper">SV</span>Sarah van der Merwe
          </td>
          <td>
            <span className="nwds-badge nwds-badge--warn">Review</span>
          </td>
          <td className="nw-mono nwds-num">R 1 205 500</td>
        </tr>
        <tr>
          <td>
            <span className="nwds-av nwds-av--xs nwds-av--violet">MJ</span>Mike Johnson
          </td>
          <td>
            <span className="nwds-badge nwds-badge--neutral">Draft</span>
          </td>
          <td className="nw-mono nwds-num">R 310 750</td>
        </tr>
      </tbody>
    </table>
  ),
  p_search: (
    <div className="nwds-searchrow">
      <span className="nwds-searchbox">
        <DsIcon name="search" size={16} />
        <input type="search" aria-label="Search clients" placeholder="Search clients" />
      </span>
      <button type="button" className="nwds-pill" aria-pressed="true">
        All
      </button>
      <button type="button" className="nwds-pill" aria-pressed="false">
        Active
      </button>
      <button type="button" className="nwds-pill" aria-pressed="false">
        Review
      </button>
      <span className="nwds-count">24 results</span>
    </div>
  ),
  p_destructive: (
    <div className="nwds-dialog nwds-dialog--danger" role="presentation">
      <p className="nw-h nwds-dialog-t">Remove Sarah van der Merwe?</p>
      <p className="nwds-dialog-d">
        Her documents stay archived for five years, as the FAIS Act requires.
      </p>
      <div className="nwds-dialog-a">
        <button type="button" className="nw-outline nwds-b nwds-b40">
          Keep client
        </button>
        <button type="button" className="nwds-b nwds-danger nwds-b40">
          Remove
        </button>
      </div>
    </div>
  ),
};

export function PatternsPanel({ control }: { control: CopyControl }) {
  return (
    <>
      <h2 className="nwds-h2">UI patterns</h2>
      <p className="nwds-lead">
        Compositions we have already solved — use these before inventing new ones.
      </p>
      <div className="nwds-guide nwds-guide--tight">
        <div>
          <h3 className="nwds-feat-t">Survey before creating</h3>
          <p>
            Check this page and the live site for an existing pattern before designing a new one.
            Most new screens are a combination of these twelve.
          </p>
        </div>
        <div>
          <h3 className="nwds-feat-t">Config-driven UI</h3>
          <p>
            Lists, tabs and catalogues are driven by data, so adding a product or a section never
            means copying markup.
          </p>
        </div>
      </div>
      <div className="nwds-items">
        {DS_PATTERNS.map((item) => (
          <ItemCard
            key={item.key}
            item={item}
            control={control}
            preview={PATTERN_PREVIEWS[item.key]}
          />
        ))}
      </div>
    </>
  );
}

/* ── Icons ── */

export function IconsPanel({ control }: { control: CopyControl }) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const shown = DS_ICON_LIST.filter((name) => !term || name.includes(term));

  return (
    <>
      <h2 className="nwds-h2">Icons</h2>
      <p className="nwds-lead">
        One outline set (Lucide) on a 24 grid at a 1.75 stroke, coloured with the text around it.
        16px in buttons and lists, 20px in cards, 24px for features. Select an icon to copy its
        name.
      </p>
      <div className="nwds-filters">
        <span className="nwds-searchbox">
          <DsIcon name="search" size={16} />
          <input
            type="search"
            aria-label="Search icons"
            placeholder="Search icons"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </span>
        <span className="nwds-count nwds-count--inline" role="status">
          {shown.length} of {DS_ICON_LIST.length} icons
        </span>
      </div>
      {shown.length === 0 ? (
        <div className="nwds-empty nwds-empty--box">
          <span className="nwds-empty-ic">
            <DsIcon name="search" size={22} />
          </span>
          <p className="nw-h nwds-empty-t">No icons match “{query.trim()}”</p>
          <p className="nwds-empty-d">Try a broader word, such as arrow, file or user.</p>
        </div>
      ) : null}
      <div className="nwds-icgrid">
        {shown.map((name) => (
          <button
            key={name}
            type="button"
            className="nwds-ictile"
            aria-label={`Copy icon name ${name}`}
            onClick={() => control.copy(`i_${name}`, name, `Icon name ${name}`)}
          >
            <DsIcon name={name} size={24} />
            <span>{control.copied === `i_${name}` ? 'Copied' : name}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ── Sections ── */

const SECTION_THUMBS: Record<string, { bg: string; fg: string; shapes: ReactNode }> = (() => {
  const lines = (
    <>
      <i style={{ left: '8%', top: '30%', width: '40%', height: 12 }} />
      <i className="nwds-thumb-faint" style={{ left: '8%', top: '48%', width: '60%', height: 6 }} />
      <i className="nwds-thumb-faint" style={{ left: '8%', top: '58%', width: '52%', height: 6 }} />
    </>
  );
  return {
    s_white: { bg: 'var(--nw-white)', fg: 'var(--nw-ink)', shapes: lines },
    s_ivory: { bg: 'var(--nw-paper)', fg: 'var(--nw-ink)', shapes: lines },
    s_navy: { bg: 'var(--nw-ink)', fg: 'var(--nw-paper)', shapes: lines },
    s_deep: { bg: 'var(--nw-ink-deep)', fg: 'var(--nw-paper)', shapes: lines },
    s_two: {
      bg: 'var(--nw-white)',
      fg: 'var(--nw-ink)',
      shapes: (
        <>
          <i style={{ left: '8%', top: '28%', width: '36%', height: 10 }} />
          <i
            className="nwds-thumb-faint"
            style={{ left: '8%', top: '44%', width: '30%', height: 6 }}
          />
          <b style={{ left: '54%', top: '22%', width: '38%', height: '56%' }} />
        </>
      ),
    },
    s_three: {
      bg: 'var(--nw-white)',
      fg: 'var(--nw-ink)',
      shapes: (
        <>
          <b style={{ left: '8%', top: '30%', width: '25%', height: '44%' }} />
          <b style={{ left: '37.5%', top: '30%', width: '25%', height: '44%' }} />
          <b style={{ left: '67%', top: '30%', width: '25%', height: '44%' }} />
        </>
      ),
    },
    s_hero: {
      bg: 'var(--nw-ink)',
      fg: 'var(--nw-paper)',
      shapes: (
        <>
          <i style={{ left: '25%', top: '30%', width: '50%', height: 12 }} />
          <i
            className="nwds-thumb-faint"
            style={{ left: '32%', top: '48%', width: '36%', height: 6 }}
          />
          <b
            className="nwds-thumb-violet"
            style={{ left: '36%', top: '62%', width: '13%', height: 12 }}
          />
          <b style={{ left: '51%', top: '62%', width: '13%', height: 12 }} />
        </>
      ),
    },
    s_cta: {
      bg: 'var(--nw-paper-2)',
      fg: 'var(--nw-ink)',
      shapes: (
        <>
          <i style={{ left: '28%', top: '34%', width: '44%', height: 12 }} />
          <b
            className="nwds-thumb-violet"
            style={{ left: '36%', top: '56%', width: '13%', height: 12 }}
          />
          <b style={{ left: '51%', top: '56%', width: '13%', height: 12 }} />
        </>
      ),
    },
  };
})();

export function SectionsPanel({ control }: { control: CopyControl }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | DsSectionCategory>('all');
  const term = query.trim().toLowerCase();
  const shown = DS_SECTIONS.filter(
    (s) =>
      (category === 'all' || s.category === category) &&
      (!term || s.title.toLowerCase().includes(term)),
  );

  return (
    <>
      <h2 className="nwds-h2">Section templates</h2>
      <p className="nwds-lead">
        Eight templates and one rule: backgrounds alternate white, ivory and navy, and two navy
        bands never sit next to each other — the footer counts.
      </p>
      <div className="nwds-filters">
        <span className="nwds-searchbox">
          <DsIcon name="search" size={16} />
          <input
            type="search"
            aria-label="Search sections"
            placeholder="Search sections"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </span>
        {DS_SECTION_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className="nwds-pill"
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div role="status">
        {shown.length === 0 ? (
          <div className="nwds-empty nwds-empty--box">
            <span className="nwds-empty-ic">
              <DsIcon name="layers" size={22} />
            </span>
            <p className="nw-h nwds-empty-t">No sections found</p>
            <p className="nwds-empty-d">Try adjusting your search or filter.</p>
          </div>
        ) : null}
      </div>
      <div className="nwds-items">
        {shown.map((item) => {
          const thumb = SECTION_THUMBS[item.key];
          return (
            <ItemCard
              key={item.key}
              item={item}
              control={control}
              thumb
              preview={
                <div className="nwds-thumb" style={{ background: thumb.bg, color: thumb.fg }}>
                  {thumb.shapes}
                </div>
              }
            >
              <br />
              <code className="nwds-code">{item.css}</code>
            </ItemCard>
          );
        })}
      </div>
      <div className="nwds-guide">
        <div>
          <h3 className="nwds-feat-t">Section structure</h3>
          <p>
            Full-width band → <code className="nwds-code">.nw-wrap</code> container (1320px, 20–48px
            gutters) → content. Vertical padding comes from{' '}
            <code className="nwds-code">--nw-sec-lg / md / sm</code>.
          </p>
        </div>
        <div>
          <h3 className="nwds-feat-t">Colour contrast</h3>
          <p>
            Ink and text tokens on white and ivory; on-dark tokens on navy. Every pair on the
            Colours tab passes WCAG AA.
          </p>
        </div>
      </div>
    </>
  );
}

/* ── Download ── */

export function DownloadPanel({ control }: { control: CopyControl }) {
  return (
    <>
      <h2 className="nwds-h2">Download resources</h2>
      <p className="nwds-lead">
        Design system assets, the component library and project templates for local development.
      </p>
      <div className="nwds-items">
        {DS_DOWNLOADS.map((d) => {
          const key = `d_${d.id}`;
          const command = cliCommand(d.id);
          return (
            <article key={d.id} className="nwds-item">
              <header className="nwds-item-h">
                <div className="nwds-dl-head">
                  <span className="nwds-dl-ic">
                    <DsIcon name={d.icon} size={20} />
                  </span>
                  <div>
                    <h3 className="nwds-item-t">{d.title}</h3>
                    <span className="nwds-tag">{d.tag}</span>
                  </div>
                </div>
              </header>
              <p className="nwds-item-d nwds-item-d--flush">{d.text}</p>
              <div className="nwds-dl-actions">
                <code className="nwds-code">{command}</code>
                <button
                  type="button"
                  className="nw-outline nwds-b nwds-b40n"
                  aria-label={`Copy CLI command: ${d.title}`}
                  onClick={() => control.copy(key, command, `${d.title} CLI command`)}
                >
                  <DsIcon name="copy" size={14} />
                  {control.copied === key ? 'Copied' : 'Copy CLI'}
                </button>
                <button type="button" className="nw-btn nwds-b nwds-b40n" disabled>
                  <DsIcon name="download" size={14} />
                  Download
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="nwds-note">
        <DsIcon name="info" size={16} />
        <span>
          <strong>Note:</strong> direct downloads are not yet available in this environment. Use the
          CLI commands, or contact the development team for access to the full design system
          package.
        </span>
      </div>
    </>
  );
}
