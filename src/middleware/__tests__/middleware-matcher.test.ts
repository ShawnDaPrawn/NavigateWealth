import { describe, it, expect } from 'vitest';
import middleware, { config, isMcpOrOAuthPath } from '../../../middleware';
import manifest from '../../../seo-route-manifest.json';
import vercelConfig from '../../../vercel.json';
import { shouldReturnNotFound, type SeoRouteManifest } from '../route-policy';

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
    expect(runsOn('/llms.txt')).toBe(false);
    expect(runsOn('/_vercel/insights/script.js')).toBe(false);
  });

  it('skips the embedded component library, a static folder the /design-system page loads', () => {
    expect(runsOn('/design-system-library/')).toBe(false);
    expect(runsOn('/design-system-library')).toBe(false);
    expect(runsOn('/design-system-library/assets/showcase-abc.js')).toBe(false);
  });

  it('still runs on paths that only start with the library name', () => {
    expect(runsOn('/design-system-library-old')).toBe(true);
    expect(runsOn('/design-system-libraryish/nested')).toBe(true);
  });
});

describe('MCP servers and OAuth discovery', () => {
  // Every MCP or OAuth path vercel.json rewrites; a new server added there is
  // covered here without editing this test.
  const rewritten = (vercelConfig as { rewrites: { source: string }[] }).rewrites
    .map((r) => r.source)
    .filter((s) => s.startsWith('/mcp/') || s.startsWith('/.well-known/oauth-'));

  it('finds the password-vault and broker-operations rewrites', () => {
    expect(rewritten).toEqual(
      expect.arrayContaining([
        '/mcp/password-vault',
        '/.well-known/oauth-protected-resource/mcp/password-vault',
        '/mcp/broker-operations',
        '/.well-known/oauth-authorization-server',
      ]),
    );
  });

  it.each(rewritten)('lets GET %s through to the rewrite instead of the 404 page', async (path) => {
    // The page manifest does not know these paths, so without the guard the
    // middleware answers them with the 404 page (the 2026-11-25 failure).
    expect(shouldReturnNotFound(path, manifest as SeoRouteManifest)).toBe(true);
    for (const method of ['GET', 'HEAD'])
      expect(
        await middleware(new Request('https://www.navigatewealth.co' + path, { method })),
      ).toBeUndefined();
  });

  it('matches by prefix only', () => {
    expect(isMcpOrOAuthPath('/mcp/some-future-server')).toBe(true);
    expect(isMcpOrOAuthPath('/mcp')).toBe(false);
    expect(isMcpOrOAuthPath('/mcp-guide')).toBe(false);
  });
});
