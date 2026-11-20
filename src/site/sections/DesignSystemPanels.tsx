/**
 * The Design System page's reference tabs — Overview, Colours and Typography —
 * as the "Design system" board draws them. Every swatch, scale step and class
 * is drawn with the token or class it names, so the page shows the system as
 * the site's stylesheets build it.
 */
import { DsIcon, type DsIconName } from './DesignSystemIcons';
import {
  COLOUR_TOKEN_COUNT,
  DS_COMPONENTS,
  DS_CONTRAST_PAIRS,
  DS_COVERAGE,
  DS_FEATURES,
  DS_PATTERNS,
  DS_PRINCIPLES,
  DS_SECTIONS,
  DS_SWATCH_GROUPS,
  DS_TYPE_ROWS,
  type DsTabId,
} from './designSystemModel';
import { pad2 } from './format';

const OVERVIEW_CARDS: readonly { id: DsTabId; icon: DsIconName; title: string; text: string }[] = [
  {
    id: 'colors',
    icon: 'palette',
    title: 'Colours',
    text: `${COLOUR_TOKEN_COUNT} named tokens — navy and ivory carry the brand, violet acts.`,
  },
  {
    id: 'typography',
    icon: 'type',
    title: 'Typography',
    text: 'Newsreader and Inter on one scale, with its own phone sizes.',
  },
  {
    id: 'components',
    icon: 'component',
    title: 'Components',
    text: `${DS_COMPONENTS.length} components across display, feedback, form, navigation and overlay.`,
  },
  {
    id: 'patterns',
    icon: 'grid',
    title: 'Patterns',
    text: `${DS_PATTERNS.length} tested patterns — empty, loading, error and validation states.`,
  },
  {
    id: 'icons',
    icon: 'compass',
    title: 'Icons',
    text: 'One outline set on a 24 grid at a 1.75 stroke.',
  },
  {
    id: 'sections',
    icon: 'layers',
    title: 'Sections',
    text: `${DS_SECTIONS.length} section templates and the rule for how they alternate.`,
  },
  {
    id: 'download',
    icon: 'download',
    title: 'Download',
    text: 'Tokens, components, templates and the full codebase.',
  },
];

export function OverviewPanel({ onNavigate }: { onNavigate: (id: DsTabId) => void }) {
  return (
    <>
      <h2 className="nwds-h2">One system, every page</h2>
      <p className="nwds-lead">
        A single source of truth for every interface decision on Navigate Wealth — public site,
        client portal and admin. Navy and ivory carry the brand, violet acts, and every page loads
        the same stylesheet.
      </p>
      <div className="nwds-ovgrid">
        {OVERVIEW_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            className="nwds-ovc"
            onClick={() => onNavigate(card.id)}
          >
            <span className="nwds-ovc-ic">
              <DsIcon name={card.icon} size={20} />
            </span>
            <span className="nwds-ovc-t">{card.title}</span>
            <span className="nwds-ovc-d">{card.text}</span>
            <span className="nwds-ovc-go">
              Open {card.title.toLowerCase()} <DsIcon name="arrow-right" size={14} />
            </span>
          </button>
        ))}
      </div>

      <div className="nwds-block">
        <h3 className="nwds-cap">Principles</h3>
        <ol className="nwds-principles">
          {DS_PRINCIPLES.map((p, i) => (
            <li key={p.title}>
              <span className="nw-mono">{pad2(i + 1)}</span>
              <div>
                <strong>{p.title}</strong>
                <p>{p.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="nwds-block">
        <h3 className="nwds-cap">Key features</h3>
        <div className="nwds-grid nwds-grid--420">
          {DS_FEATURES.map((f) => (
            <div key={f.title} className="nwds-feat">
              <span className="nwds-ovc-ic">
                <DsIcon name={f.icon} size={20} />
              </span>
              <div>
                <h4 className="nwds-feat-t">{f.title}</h4>
                <p className="nwds-feat-d">{f.text}</p>
                <div className="nwds-feat-b">
                  {f.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="nwds-block">
        <h3 className="nwds-cap">Coverage</h3>
        <div className="nwds-grid nwds-grid--280">
          {DS_COVERAGE.map((c) => (
            <div key={c.title} className="nwds-cover">
              <h4 className="nwds-feat-t">{c.title}</h4>
              <ul>
                {c.items.map((item) => (
                  <li key={item}>
                    <DsIcon name="check" size={14} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="nwds-block nwds-ready">
        <div>
          <h3 className="nw-h nwds-ready-t">Ready to get started?</h3>
          <p className="nwds-ready-d">
            Download the tokens and components, or browse the patterns first.
          </p>
        </div>
        <div className="nwds-ready-actions">
          <button
            type="button"
            className="nw-btn nwds-b nwds-b48"
            onClick={() => onNavigate('download')}
          >
            <DsIcon name="download" size={16} />
            Go to downloads
          </button>
          <button
            type="button"
            className="nw-outline nwds-b nwds-b48"
            onClick={() => onNavigate('patterns')}
          >
            Browse patterns
          </button>
        </div>
      </div>
    </>
  );
}

export function ColoursPanel() {
  return (
    <>
      <h2 className="nwds-h2">Colour</h2>
      <p className="nwds-lead">
        {COLOUR_TOKEN_COUNT} named tokens. Navy and ivory carry the brand; violet is reserved for
        actions, active states and the focus ring; status colours only ever describe state.
      </p>
      {DS_SWATCH_GROUPS.map((group) => (
        <div key={group.label}>
          <h3 className="nwds-cap nwds-cap--group">{group.label}</h3>
          <ul className="nwds-grid nwds-sw-grid" aria-label={`${group.label} colour tokens`}>
            {group.swatches.map((s) => (
              <li key={s.token} className="nwds-sw">
                <div className="nwds-chip" style={{ background: `var(${s.token})` }} />
                <p>{s.token}</p>
                <code>{s.hex}</code>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="nwds-block">
        <h3 className="nwds-cap">Tested text pairs</h3>
        <div className="nwds-tablewrap">
          <table className="nwds-table">
            <thead>
              <tr>
                <th scope="col">Sample</th>
                <th scope="col">Pair</th>
                <th scope="col" className="nwds-num">
                  Contrast
                </th>
                <th scope="col">WCAG</th>
              </tr>
            </thead>
            <tbody>
              {DS_CONTRAST_PAIRS.map((pair) => (
                <tr key={`${pair.fg}-${pair.bg}`}>
                  <td>
                    <span
                      className="nwds-pair"
                      style={{ background: `var(${pair.bg})`, color: `var(${pair.fg})` }}
                      aria-hidden="true"
                    >
                      Aa
                    </span>
                  </td>
                  <td>
                    <code>
                      {pair.fg} on {pair.bg}
                    </code>
                  </td>
                  <td className="nw-mono nwds-num">{pair.ratio}</td>
                  <td>
                    <span className="nwds-badge nwds-badge--success">{pair.grade}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function TypographyPanel() {
  return (
    <>
      <h2 className="nwds-h2">Typography</h2>
      <p className="nwds-lead">
        Newsreader for headings and moments of voice, Inter for everything you read or tap. Sizes
        are tokens, so phones get their own calmer scale automatically. Body copy stays under 65
        characters a line.
      </p>
      <div className="nwds-trows">
        {DS_TYPE_ROWS.map((row) => (
          <div key={row.token} className="nwds-trow">
            <code>
              {row.token}
              <span>{row.sizes}</span>
            </code>
            <div>
              {row.kind === 'serif' ? (
                <span
                  className="nw-h nwds-tserif"
                  style={{
                    fontSize: `var(${row.token})`,
                    lineHeight: row.lineHeight,
                  }}
                >
                  {row.sample}
                  {row.accent ? <span className="nwds-accent-l">{row.accent}</span> : null}
                </span>
              ) : row.kind === 'sans' ? (
                <span style={{ fontSize: `var(${row.token})`, lineHeight: row.lineHeight }}>
                  {row.sample}
                </span>
              ) : row.kind === 'eyebrow' ? (
                <span className="nw-eyebrow nwds-teyebrow">{row.sample}</span>
              ) : (
                <span className="nw-mono nwds-tmono">{row.sample}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="nwds-guide">
        <div>
          <h3 className="nwds-cap">Newsreader</h3>
          <p className="nw-h nwds-guide-serif">
            Aa · Regular 400 · Medium 500 · <em>Italic</em>
          </p>
          <p>Headings, pull quotes and the italic accent.</p>
        </div>
        <div>
          <h3 className="nwds-cap">Inter</h3>
          <p className="nwds-guide-sans">Aa · 400 · 500 · 600 · 700</p>
          <p>Body, labels, buttons, forms and figures.</p>
        </div>
      </div>
    </>
  );
}
