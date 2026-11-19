/**
 * The newsletter's email-engagement tracking, for the Navigator article page.
 *
 * The same logic as the live page (ArticleDetailPage.tsx), copied line for
 * line so the redesign reports what the live page reports: a newsletter link
 * carries `?nt=<token>`, the token is taken out of the address at once, and
 * the page posts `open` after an interaction or four seconds in focus, then
 * `read` after 45 seconds in focus with at least 65% of the article seen —
 * each once per session, through the live page's own helpers.
 *
 * The live page keeps its own inline copy; when the legacy design is retired
 * this hook is the one that remains.
 */
import { useEffect, useState, type RefObject } from 'react';
import {
  getEmailTrackingTokenFromUrl,
  getSessionFlag,
  postArticleEmailEngagementEvent,
  setSessionFlag,
  stripEmailTrackingTokenFromUrl,
} from '../../components/pages/articleDetail/articleHelpers';

export function useArticleEmailTracking(
  slug: string | undefined,
  articleId: string | undefined,
  articleContentRef: RefObject<HTMLElement | null>,
): void {
  const [emailTrackingToken, setEmailTrackingToken] = useState<string | null>(null);

  useEffect(() => {
    const token = getEmailTrackingTokenFromUrl();
    setEmailTrackingToken(token);
    if (token) {
      stripEmailTrackingTokenFromUrl();
    }
  }, [slug]);

  useEffect(() => {
    if (!articleId || !emailTrackingToken) return;

    const sessionKey = `nw:article-email-open:${emailTrackingToken}`;
    if (getSessionFlag(sessionKey)) return;

    let cancelled = false;
    let hasInteracted = false;
    let focusedVisibleMs = 0;
    let lastTick = Date.now();
    let intervalId: number | null = null;

    const maybeTrackOpen = async () => {
      if (cancelled || getSessionFlag(sessionKey)) return;
      if (!hasInteracted && focusedVisibleMs < 4000) return;

      setSessionFlag(sessionKey);
      try {
        await postArticleEmailEngagementEvent('open', emailTrackingToken);
      } catch {
        // Best effort only. We do not block article reading on analytics delivery.
      }

      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const tick = () => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      if (document.visibilityState === 'visible' && document.hasFocus()) {
        focusedVisibleMs += delta;
      }

      void maybeTrackOpen();
    };

    const markInteraction = () => {
      hasInteracted = true;
      void maybeTrackOpen();
    };

    intervalId = window.setInterval(tick, 1000);
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, markInteraction, { passive: true });
    });
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      events.forEach((eventName) => {
        window.removeEventListener(eventName, markInteraction);
      });
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [articleId, emailTrackingToken]);

  useEffect(() => {
    if (!articleId || !emailTrackingToken) return;

    const sessionKey = `nw:article-email-read:${emailTrackingToken}`;
    if (getSessionFlag(sessionKey)) return;

    let cancelled = false;
    let focusedVisibleMs = 0;
    let maxScrollProgress = 0;
    let lastTick = Date.now();
    let intervalId: number | null = null;

    const getScrollProgress = () => {
      const element = articleContentRef.current;
      if (!element) return 0;

      const rect = element.getBoundingClientRect();
      const seenHeight = window.innerHeight - rect.top;
      const totalTrackableHeight = rect.height + window.innerHeight;
      if (totalTrackableHeight <= 0) return 0;

      return Math.max(0, Math.min(1, seenHeight / totalTrackableHeight));
    };

    const maybeTrackRead = async () => {
      if (cancelled || getSessionFlag(sessionKey)) return;
      if (focusedVisibleMs < 45000 || maxScrollProgress < 0.65) return;

      setSessionFlag(sessionKey);
      try {
        await postArticleEmailEngagementEvent('read', emailTrackingToken);
      } catch {
        // Best effort only.
      }

      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const refreshProgress = () => {
      maxScrollProgress = Math.max(maxScrollProgress, getScrollProgress());
      void maybeTrackRead();
    };

    const tick = () => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      if (document.visibilityState === 'visible' && document.hasFocus()) {
        focusedVisibleMs += delta;
      }

      refreshProgress();
    };

    intervalId = window.setInterval(tick, 1000);
    window.addEventListener('scroll', refreshProgress, { passive: true });
    window.addEventListener('resize', refreshProgress);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('scroll', refreshProgress);
      window.removeEventListener('resize', refreshProgress);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [articleId, emailTrackingToken, articleContentRef]);
}
