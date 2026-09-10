/**
 * The apex host must SERVE article pages, not redirect them to www.
 * =================================================================
 *
 * Article notification emails link to the apex (`navigatewealth.co`) on purpose:
 * it is the one Navigate Wealth host outside the installed PWA's scope, so
 * Android opens those links in a browser instead of handing them to the app.
 *
 * That only holds if the apex answers the article URL itself. Android applies
 * installed-app link capture to server redirects as well as to the tapped URL,
 * so an apex link that 301s to `www` — every path of which is inside the PWA's
 * scope — is handed to the app anyway. When that happened, the interstitial
 * fired its escape back at the apex, the apex redirected into scope again, and
 * the client watched the browser and the app trade the link back and forth.
 *
 * These tests pin the exclusion that stops it. They read `vercel.json` and check
 * which apex paths are redirected, so deleting or loosening the article carve-out
 * fails here rather than in someone's inbox.
 *
 * NOTE ON FIDELITY: `toMatcher` implements the small path-to-regexp subset these
 * sources actually use (a literal, optionally ending in one `:name(<pattern>)`
 * parameter). It models Vercel's matching, it does not execute it — this suite
 * proves the config still says what it is meant to say, not that Vercel's router
 * agrees. The deploy check for that is in `docs/runbooks/deployment.md`.
 */
import { describe, it, expect } from 'vitest';
import vercelConfig from '../../vercel.json';

const APEX_HOST = 'navigatewealth.co';
const WWW_ORIGIN = 'https://www.navigatewealth.co';

interface VercelRedirect {
  source: string;
  destination: string;
  statusCode?: number;
  has?: { type: string; value: string }[];
}

function escapeLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toMatcher(source: string): RegExp {
  const parameterised = source.match(/^(.*?):[A-Za-z0-9_]+\((.*)\)$/);
  if (!parameterised) return new RegExp(`^${escapeLiteral(source)}$`);
  const [, prefix, pattern] = parameterised;
  return new RegExp(`^${escapeLiteral(prefix)}(?:${pattern})$`);
}

const apexRedirects = (vercelConfig.redirects as VercelRedirect[]).filter((redirect) =>
  redirect.has?.some((condition) => condition.type === 'host' && condition.value === APEX_HOST),
);

function isRedirectedFromApex(path: string): boolean {
  return apexRedirects.some((redirect) => toMatcher(redirect.source).test(path));
}

describe('apex host redirects', () => {
  it('leaves article pages on the apex so the PWA can never capture them', () => {
    expect(isRedirectedFromApex('/resources/article/some-insight')).toBe(false);
    expect(isRedirectedFromApex('/resources/article/two-percent-rule')).toBe(false);
  });

  it('still sends every other apex path to the canonical www host', () => {
    for (const path of [
      '/',
      '/about',
      '/contact',
      '/login',
      '/resources',
      '/resources/article', // the bare prefix is not an article
      '/resources/articles-roundup',
      '/legal/privacy',
    ]) {
      expect(isRedirectedFromApex(path), `${path} should redirect to www`).toBe(true);
    }
  });

  it('redirects permanently to the www origin', () => {
    expect(apexRedirects.length).toBeGreaterThan(0);
    for (const redirect of apexRedirects) {
      expect(redirect.destination.startsWith(WWW_ORIGIN)).toBe(true);
      expect(redirect.statusCode).toBe(301);
    }
  });

  it('carves the exclusion out by path rather than by listing slugs', () => {
    // A slug allowlist would silently strand every article published after it.
    const catchAll = apexRedirects.find((redirect) =>
      redirect.source.includes('resources/article'),
    );
    expect(catchAll?.source).toContain('(?!resources/article/)');
  });
});
