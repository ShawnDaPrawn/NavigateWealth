import { describe, it, expect, beforeEach } from 'vitest';
import {
  claimEscapeAttempt,
  resetEscapeAttempt,
  ESCAPE_ATTEMPT_TTL_MS,
} from '../articleEscapeAttempt';

const ARTICLE = 'https://navigatewealth.co/resources/article/some-insight?nt=abc';
const OTHER = 'https://navigatewealth.co/resources/article/another-insight?nt=def';

describe('claimEscapeAttempt', () => {
  beforeEach(() => {
    resetEscapeAttempt();
  });

  it('allows the first hand-off for an article', () => {
    expect(claimEscapeAttempt(ARTICLE, 1_000)).toBe(true);
  });

  it('refuses a second hand-off for the same article — this is the loop breaker', () => {
    expect(claimEscapeAttempt(ARTICLE, 1_000)).toBe(true);
    expect(claimEscapeAttempt(ARTICLE, 1_200)).toBe(false);
  });

  it('survives a relaunch, because the record outlives the page', () => {
    claimEscapeAttempt(ARTICLE, 1_000);
    // A relaunched PWA is a brand new page: module state is gone, and only the
    // persisted record can tell us the hand-off already bounced back.
    expect(localStorage.getItem('nw-article-escape-attempt')).toContain(ARTICLE);
    expect(claimEscapeAttempt(ARTICLE, 1_050)).toBe(false);
  });

  it('still hands off a different article opened straight afterwards', () => {
    claimEscapeAttempt(ARTICLE, 1_000);
    expect(claimEscapeAttempt(OTHER, 1_100)).toBe(true);
  });

  it('hands off the same article again once the record has expired', () => {
    claimEscapeAttempt(ARTICLE, 1_000);
    expect(claimEscapeAttempt(ARTICLE, 1_000 + ESCAPE_ATTEMPT_TTL_MS)).toBe(true);
  });

  it('does not throw when storage is unavailable, and still guards the page', () => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new Error('storage blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('storage blocked');
    };

    try {
      expect(claimEscapeAttempt(ARTICLE, 1_000)).toBe(true);
      expect(claimEscapeAttempt(ARTICLE, 1_100)).toBe(false);
    } finally {
      Storage.prototype.getItem = getItem;
      Storage.prototype.setItem = setItem;
    }
  });

  it('ignores a corrupt stored record rather than blocking the hand-off', () => {
    localStorage.setItem('nw-article-escape-attempt', 'not json');
    expect(claimEscapeAttempt(ARTICLE, 1_000)).toBe(true);
  });
});
