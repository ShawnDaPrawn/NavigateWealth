import { describe, it, expect } from 'vitest';
import { config } from '../../../middleware';

/**
 * The matcher decides which requests the 404 middleware sees at all. Anything
 * it skips goes straight to Vercel's static files and SPA rewrite.
 */
function runsOn(pathname: string): boolean {
  return config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(pathname));
}

describe('middleware matcher', () => {
  it('runs on document navigations', () => {
    expect(runsOn('/')).toBe(true);
    expect(runsOn('/design-system')).toBe(true);
    expect(runsOn('/some-unknown-page')).toBe(true);
  });

  it('skips static assets and files with extensions', () => {
    expect(runsOn('/assets/index-abc.js')).toBe(false);
    expect(runsOn('/robots.txt')).toBe(false);
    expect(runsOn('/_vercel/insights/script.js')).toBe(false);
  });

  it('skips the embedded component library, a static folder the /design-system page loads', () => {
    expect(runsOn('/design-system-library/')).toBe(false);
    expect(runsOn('/design-system-library')).toBe(false);
    expect(runsOn('/design-system-library/assets/showcase-abc.js')).toBe(false);
  });
});
