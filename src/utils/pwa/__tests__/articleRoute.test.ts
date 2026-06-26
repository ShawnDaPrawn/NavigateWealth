import { describe, expect, it } from 'vitest';
import { ARTICLE_ROUTE_PREFIX, isArticleRoute } from '../articleRoute';

describe('isArticleRoute', () => {
  it('matches an article detail path with a slug', () => {
    expect(isArticleRoute('/resources/article/my-first-insight')).toBe(true);
    expect(isArticleRoute(`${ARTICLE_ROUTE_PREFIX}another-slug`)).toBe(true);
  });

  it('does not match the bare article prefix without a slug', () => {
    expect(isArticleRoute('/resources/article/')).toBe(false);
    expect(isArticleRoute('/resources/article')).toBe(false);
  });

  it('does not match the resources listing or other marketing routes', () => {
    expect(isArticleRoute('/resources')).toBe(false);
    expect(isArticleRoute('/resources/calculators')).toBe(false);
    expect(isArticleRoute('/about')).toBe(false);
    expect(isArticleRoute('/')).toBe(false);
  });
});
