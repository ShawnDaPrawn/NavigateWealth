/**
 * "In this article" — the table of contents, in the board's two forms: a list
 * in the rail on wide screens, and a fold-out above the article on narrow
 * ones. Its entries are the article's own h2 and h3 headings (an h3 sits one
 * step in), and it shows only when there are two or more, as on the live page.
 *
 * Each entry is a real link to its heading. Following one scrolls there (at
 * once when reduced motion is asked for), marks it current and moves focus to
 * the heading, so the next Tab continues from there.
 */
import { useId, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { ArticleIcon } from './ArticleIcons';
import type { TocEntry } from './ArticleModel';

/** Scrolls to a heading and hands it focus. */
function goToHeading(id: string): boolean {
  const heading = document.getElementById(id);
  if (!heading) return false;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  heading.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
  return true;
}

interface TocProps {
  entries: readonly TocEntry[];
  activeId: string;
  onPick: (id: string) => void;
}

function follow(event: MouseEvent<HTMLAnchorElement>, id: string, onPick: (id: string) => void) {
  if (goToHeading(id)) event.preventDefault();
  onPick(id);
}

/**
 * The fold-out sits above the article, so it must close BEFORE the scroll is
 * measured: scrolling first and collapsing after would shift the heading up
 * by the list's height and leave the reader past it.
 */
function followFromFold(
  event: MouseEvent<HTMLAnchorElement>,
  id: string,
  onPick: (id: string) => void,
) {
  if (!document.getElementById(id)) {
    onPick(id);
    return;
  }
  event.preventDefault();
  flushSync(() => onPick(id));
  goToHeading(id);
}

/** The rail's list. */
export function ArticleTocRail({ entries, activeId, onPick }: TocProps) {
  return (
    <nav aria-label="Table of contents">
      <p className="nwar-label nwar-toc-label">In this article</p>
      <ul className="nwar-toc-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              className={[
                'nwar-toc',
                entry.level === 3 ? 'nwar-toc--sub' : '',
                entry.id === activeId ? 'nwar-toc-on' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              href={`#${entry.id}`}
              aria-current={entry.id === activeId ? 'location' : undefined}
              onClick={(event) => follow(event, entry.id, onPick)}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface FoldProps extends TocProps {
  open: boolean;
  onToggle: () => void;
}

/** The narrow screens' fold-out; choosing an entry folds it away again. */
export function ArticleTocFold({ entries, activeId, onPick, open, onToggle }: FoldProps) {
  const listId = useId();
  return (
    <nav className="nwar-fold" aria-label="Table of contents">
      <button
        type="button"
        className="nwar-fold-btn"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={onToggle}
      >
        <span>In this article</span>
        <ArticleIcon
          name="chevronDown"
          size={16}
          className={open ? 'nwar-chev nwar-chev--open' : 'nwar-chev'}
        />
      </button>
      {open ? (
        <ul id={listId} className="nwar-fold-list nw-in">
          {entries.map((entry) => (
            <li key={entry.id}>
              <a
                className={entry.level === 3 ? 'nwar-toc nwar-fold-item--sub' : 'nwar-toc'}
                href={`#${entry.id}`}
                aria-current={entry.id === activeId ? 'location' : undefined}
                onClick={(event) => followFromFold(event, entry.id, onPick)}
              >
                {entry.text}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}
