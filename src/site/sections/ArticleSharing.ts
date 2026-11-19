/**
 * What sharing an article does, behind both of the board's share controls
 * (ArticleShare.tsx).
 *
 * The targets are the live page's (ShareActions.tsx): LinkedIn, Facebook and
 * Twitter open in a 600×400 window, WhatsApp in a new tab, email through a
 * mailto: address, each built from the page address at the moment of the
 * click. Copying the link writes the page address to the clipboard; where the
 * live page confirms that in a toast, the board says "Link copied" in place
 * for two seconds, so success is reported here and only a failure goes to a
 * toast. Print opens the live page's print view (articlePrint.ts).
 */
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { toast } from 'sonner';

const COPIED_MS = 2000;
const POPUP = 'width=600,height=400';

export type ShareTarget = 'linkedin' | 'facebook' | 'twitter' | 'whatsapp' | 'email';

/** A target's address for a page address, as ShareActions builds it. */
function targetUrl(target: ShareTarget, href: string, title: string, excerpt?: string): string {
  const url = encodeURIComponent(href);
  switch (target) {
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    case 'twitter':
      return `https://twitter.com/intent/tweet?url=${url}&text=${encodeURIComponent(title)}`;
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(`${title} — ${href}`)}`;
    case 'email':
      return `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(
        `${excerpt || title}\n\nRead more: ${href}`,
      )}`;
  }
}

export interface ArticleSharing {
  /** The address a target's link carries, so it can be opened in a new tab. */
  hrefFor: (target: ShareTarget) => string;
  /** Opens a target as the live page does, from the address at the moment of the click. */
  open: (target: ShareTarget, event: MouseEvent<HTMLAnchorElement>) => void;
  copied: boolean;
  copyLink: () => void;
  print: () => void;
}

export function useArticleSharing(
  title: string,
  excerpt: string | undefined,
  print: () => void,
): ArticleSharing {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // The address without its query, so a link copied by right-click never
  // carries a newsletter's tracking token; a click reads the live address.
  const pageHref =
    typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`;

  const hrefFor = (target: ShareTarget) => targetUrl(target, pageHref, title, excerpt);

  const open = (target: ShareTarget, event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const url = targetUrl(target, window.location.href, title, excerpt);
    if (target === 'email') window.location.href = url;
    else if (target === 'whatsapp') window.open(url, '_blank');
    else window.open(url, '_blank', POPUP);
  };

  const copyLink = useCallback(() => {
    const done = () => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    };
    const fail = () => toast.error('Failed to copy link');
    try {
      navigator.clipboard.writeText(window.location.href).then(done).catch(fail);
    } catch {
      fail();
    }
  }, []);

  return { hrefFor, open, copied, copyLink, print };
}
