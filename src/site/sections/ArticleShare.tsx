/**
 * Sharing an article, in the board's two forms: the rail's Share menu and
 * Print button (wide screens), and the row of four icon buttons above the
 * article (narrow screens). What each does is ArticleSharing.ts's, the live
 * page's share targets; every target is also a real link.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ArticleIcon } from './ArticleIcons';
import type { ArticleSharing, ShareTarget } from './ArticleSharing';

const MENU: ReadonlyArray<{ target: ShareTarget; label: string }> = [
  { target: 'linkedin', label: 'Share on LinkedIn' },
  { target: 'facebook', label: 'Share on Facebook' },
  { target: 'twitter', label: 'Share on Twitter' },
  { target: 'whatsapp', label: 'Share on WhatsApp' },
  { target: 'email', label: 'Share via Email' },
];

/** The rail's Share and Print buttons, and the menu Share opens. */
export function ArticleShareMenu({ sharing }: { sharing: ArticleSharing }) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const items = (): HTMLElement[] =>
    Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  // Outside presses close it, as on the live page.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: globalThis.MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Opening moves focus into the menu, to its first item.
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => {
      event.preventDefault();
      list[(i + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') go(at + 1);
    else if (event.key === 'ArrowUp') go(at - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') setOpen(false);
  };

  return (
    <div className="nwar-share" ref={root}>
      <p className="nwar-label nwar-rail-label">Share</p>
      <div className="nwar-share-row">
        <button
          ref={button}
          type="button"
          className="nwar-quiet nwar-share-btn"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && !open) {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <ArticleIcon name="share" size={15} />
          Share
        </button>
        <button type="button" className="nwar-quiet nwar-share-btn" onClick={sharing.print}>
          <ArticleIcon name="printer" size={15} />
          Print
        </button>
      </div>
      {open ? (
        <div
          id={menuId}
          ref={menu}
          className="nwar-menu nw-in"
          role="menu"
          aria-label="Share this article"
          onKeyDown={onMenuKey}
        >
          {MENU.map(({ target, label }) => (
            <a
              key={target}
              role="menuitem"
              tabIndex={-1}
              className="nwar-menuitem"
              href={sharing.hrefFor(target)}
              onClick={(event) => {
                sharing.open(target, event);
                setOpen(false);
              }}
            >
              {label}
            </a>
          ))}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="nwar-menuitem"
            onClick={sharing.copyLink}
          >
            {sharing.copied ? 'Link copied' : 'Copy Link'}
          </button>
        </div>
      ) : null}
      <span className="nw-sr-only" role="status">
        {sharing.copied ? 'Link copied' : ''}
      </span>
    </div>
  );
}

const BAR: ReadonlyArray<{
  target: ShareTarget;
  label: string;
  icon: 'whatsapp' | 'linkedin' | 'mail';
}> = [
  { target: 'whatsapp', label: 'Share on WhatsApp', icon: 'whatsapp' },
  { target: 'linkedin', label: 'Share on LinkedIn', icon: 'linkedin' },
  { target: 'email', label: 'Share via Email', icon: 'mail' },
];

/** The narrow screens' row: WhatsApp, LinkedIn, email, copy link. */
export function ArticleShareBar({ sharing }: { sharing: ArticleSharing }) {
  return (
    <>
      <div className="nwar-sharebar">
        {BAR.map(({ target, label, icon }) => (
          <a
            key={target}
            className="nwar-quiet nwar-sharebar-btn"
            href={sharing.hrefFor(target)}
            aria-label={label}
            onClick={(event) => sharing.open(target, event)}
          >
            <ArticleIcon name={icon} size={17} />
          </a>
        ))}
        <button
          type="button"
          className="nwar-quiet nwar-sharebar-btn"
          aria-label="Copy Link"
          onClick={sharing.copyLink}
        >
          <ArticleIcon name="link" size={17} />
        </button>
      </div>
      <p className="nwar-copied" role="status">
        {sharing.copied ? <span className="nw-in">Link copied</span> : null}
      </p>
    </>
  );
}
