/**
 * newsletter-site-routes.ts — the public website surface.
 *
 * This router is deliberately unauthenticated (route-auth-classification.ts
 * lists both paths as intentionally public), so what it hands an anonymous
 * visitor matters more than usual. These tests pin the shape of the payload,
 * the 404, and — the one that would be a real leak — that nothing about
 * delivery ever appears in it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { routeRegistrations } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const publish = vi.hoisted(() => ({
  listPublishedNewsletters: vi.fn(),
  getPublishedNewsletter: vi.fn(),
}));

vi.mock('../newsletter-studio-publish.ts', () => publish);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const app = (await import('../newsletter-site-routes.ts')).default;

const newsletter = {
  slug: '2026-09-september-market-review',
  campaignId: 'c1',
  title: 'September Market Review',
  description: 'What mattered in September.',
  issueMonth: '2026-09',
  year: 2026,
  month: 9,
  pdfUrl: 'https://cdn.test/newsletters/2026/2026-09-september-market-review.pdf',
  pdfFileName: 'september.pdf',
  pdfSizeBytes: 1024,
  publishedAt: '2026-09-30T09:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  publish.listPublishedNewsletters.mockResolvedValue([newsletter]);
  publish.getPublishedNewsletter.mockResolvedValue(newsletter);
});

describe('registration', () => {
  it('exposes exactly the two read routes the website needs', () => {
    const registered = routeRegistrations(app)
      .filter((r) => !['ALL', 'OPTIONS'].includes(r.method))
      .map((r) => `${r.method} ${r.path}`)
      .sort();
    expect(registered).toEqual(['GET /newsletters', 'GET /newsletters/:slug']);
  });
});

describe('GET /newsletters', () => {
  it('serves the published list to a caller with no credentials at all', async () => {
    const res = await app.request('/newsletters');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, newsletters: [newsletter] });
  });

  it('serves an empty list rather than an error when nothing is published', async () => {
    publish.listPublishedNewsletters.mockResolvedValue([]);
    const res = await app.request('/newsletters');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, newsletters: [] });
  });

  it('carries no delivery internals into a public response', async () => {
    const res = await app.request('/newsletters');
    const body = (await res.json()) as { newsletters: Record<string, unknown>[] };
    const keys = Object.keys(body.newsletters[0]);
    for (const leaked of [
      'listIds',
      'listNames',
      'recipientCount',
      'sentCount',
      'failedCount',
      'readCount',
      'createdBy',
      'lastError',
      'lockId',
    ]) {
      expect(keys).not.toContain(leaked);
    }
  });
});

describe('GET /newsletters/:slug', () => {
  it('serves one newsletter by slug', async () => {
    const res = await app.request('/newsletters/2026-09-september-market-review');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, newsletter });
    expect(publish.getPublishedNewsletter).toHaveBeenCalledWith('2026-09-september-market-review');
  });

  it('404s an unknown slug instead of erroring', async () => {
    publish.getPublishedNewsletter.mockResolvedValue(null);
    const res = await app.request('/newsletters/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: 'Newsletter not found' });
  });
});
