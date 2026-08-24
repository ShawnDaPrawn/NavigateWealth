/**
 * Formatting, reading-time estimation, email-tracking tokens and session flags.
 *
 * Split out of `ArticleDetailPage.tsx` (1,486 lines), which held the page, its
 * loading and error states, the share menu, the fallback article set and every
 * helper in one file. Each was already a self-contained function; only its
 * address changed.
 */
import { publicAnonKey } from '../../../utils/supabase/info';
import { API_CONFIG } from '../../../utils/api/config';

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Invalid date';
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options,
    };
    return dateObj.toLocaleDateString('en-US', defaultOptions);
  } catch {
    return 'Invalid date';
  }
}

export function estimateReadingTime(html: string): number {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = text.split(' ').length;
  return Math.max(1, Math.ceil(words / 200));
}

// ---------------------------------------------------------------------------
// Local article type
// ---------------------------------------------------------------------------

export const EMAIL_TRACKING_PARAM = 'nt';

export function getEmailTrackingTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get(EMAIL_TRACKING_PARAM)?.trim();
  return token || null;
}

export function stripEmailTrackingTokenFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(EMAIL_TRACKING_PARAM)) return;

  url.searchParams.delete(EMAIL_TRACKING_PARAM);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', nextUrl);
}

export async function postArticleEmailEngagementEvent(
  event: 'open' | 'read',
  token: string,
): Promise<void> {
  await fetch(`${API_CONFIG.BASE_URL}/publications/email-engagement/${event}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });
}

export function getSessionFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function setSessionFlag(key: string): void {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Ignore sessionStorage failures in private browsing / hardened environments.
  }
}

// ---------------------------------------------------------------------------
// Self-contained hook — fetches a single article by slug
// ---------------------------------------------------------------------------

export function enhanceArticleHtml(rawHtml: string): string {
  const container = document.createElement('div');
  container.innerHTML = rawHtml;

  // --- Drop cap on the first <p> with substantial text ---
  const paragraphs = container.querySelectorAll('p');
  for (const p of paragraphs) {
    const text = p.textContent?.trim() || '';
    if (text.length > 40 && !p.querySelector('img') && !p.closest('blockquote')) {
      p.classList.add('article-drop-cap');
      break;
    }
  }

  // --- Callout / key takeaway detection ---
  const calloutPrefixes = [
    { prefix: 'Key Takeaway:', className: 'article-callout article-callout-takeaway' },
    { prefix: 'Important:', className: 'article-callout article-callout-important' },
    { prefix: 'Note:', className: 'article-callout article-callout-note' },
    { prefix: 'Tip:', className: 'article-callout article-callout-tip' },
    { prefix: 'Risk Warning:', className: 'article-callout article-callout-warning' },
    { prefix: "Adviser's Note:", className: 'article-callout article-callout-note' },
  ];

  paragraphs.forEach((p) => {
    const text = p.textContent?.trim() || '';
    for (const { prefix, className } of calloutPrefixes) {
      if (text.startsWith(prefix)) {
        // Wrap in a callout div
        const wrapper = document.createElement('div');
        wrapper.className = className;
        wrapper.innerHTML = p.innerHTML;
        p.replaceWith(wrapper);
        break;
      }
    }
  });

  // --- Style blockquotes as pull quotes ---
  const blockquotes = container.querySelectorAll('blockquote');
  blockquotes.forEach((bq) => {
    bq.classList.add('article-pull-quote');
  });

  return container.innerHTML;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
