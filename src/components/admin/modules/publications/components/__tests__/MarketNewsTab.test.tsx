/**
 * Market News thumbnails must never fall back to a remote URL.
 * ===========================================================
 *
 * These images come from whatever URL a third-party RSS feed supplies, which no
 * Content-Security-Policy allowlist can express. The accepted decision
 * (docs/archive/production-readiness-ledger-2026.md § CSP) is to let them be blocked rather than
 * widen `img-src` to all of `https:` for the whole site — this is an internal
 * admin widget and the cost is a missing picture.
 *
 * That decision only holds if the FALLBACK is local. The previous one pointed at
 * `i-invdn-com.investing.com`, which fails twice over: under the policy it is
 * blocked in turn, and reassigning `src` to a URL that also fails re-fires
 * `onError` against the same element. It was also the one image that WOULD have
 * rendered had the origin stayed allowlisted, so every card would have shown the
 * same stock picture instead of an honest "no preview".
 *
 * The guard is here rather than in the CSP because reinstating a remote fallback
 * is a one-line change in a component, and nothing else would catch it.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarketNewsTab } from '../MarketNewsTab';

const newsItem = {
  title: 'Rand firms against the dollar',
  pubDate: '2026-08-27T09:00:00Z',
  author: 'Reuters',
  link: 'https://example.test/article',
  image: 'https://feed-supplied.example/thumb.jpg',
  description: 'Currency markets moved on the latest inflation print.',
  source: 'Market News',
};

function renderTab(overrides: Partial<typeof newsItem> = {}) {
  return render(
    <MarketNewsTab
      activeSection="economic-news"
      onSectionChange={vi.fn()}
      newsData={{
        economicNews: [{ ...newsItem, ...overrides }],
        forexNews: [],
        stockMarket: [],
        investingIdeas: [],
      }}
      isLoading={false}
      formatDate={(d: string) => d}
      onRefresh={vi.fn()}
      lastRefreshTime={null}
    />,
  );
}

/** Every `src` currently in the document that points off-origin. */
function remoteImageSources(): string[] {
  return Array.from(document.querySelectorAll('img'))
    .map((img) => img.getAttribute('src') ?? '')
    .filter((src) => /^https?:\/\//.test(src));
}

describe('Market News thumbnails', () => {
  it('shows the feed image while it loads successfully', () => {
    renderTab();

    expect(remoteImageSources()).toContain('https://feed-supplied.example/thumb.jpg');
  });

  it('falls back to a LOCAL placeholder when the image fails', () => {
    renderTab();
    fireEvent.error(screen.getByAltText(newsItem.title));

    expect(screen.getByLabelText('No preview image available')).toBeDefined();
  });

  it('issues no remote request at all after a failure', () => {
    // The property that makes the CSP decision safe: a blocked image must not
    // reach for another blocked image.
    renderTab();
    fireEvent.error(screen.getByAltText(newsItem.title));

    expect(remoteImageSources()).toEqual([]);
  });

  it('never reinstates the investing.com fallback', () => {
    renderTab();
    fireEvent.error(screen.getByAltText(newsItem.title));

    expect(document.body.innerHTML).not.toContain('i-invdn-com');
    expect(document.body.innerHTML).not.toContain('investing.com');
  });

  it('shows the placeholder when the feed supplied no image at all', () => {
    // getRSSImage returns '' now rather than a remote URL, so this is the
    // common case, not an edge case.
    renderTab({ image: '' });

    expect(screen.getByLabelText('No preview image available')).toBeDefined();
    expect(remoteImageSources()).toEqual([]);
  });
});
