/**
 * ArticleEmailEngagementPanel — the Status chip.
 *
 * An article published to the website without "Notify newsletter subscribers"
 * has no publish campaign. Its chip used to fall back to "queued", which read
 * as if an email were about to go out; it must say the article was not emailed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ArticleEmailEngagementSummary } from '../../types';

const { getEmailEngagementSummary } = vi.hoisted(() => ({
  getEmailEngagementSummary: vi.fn(),
}));

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Articles: {
      getEmailEngagementSummary,
      getNotificationProcessorStatus: vi.fn().mockResolvedValue(null),
      getArticleEmailEngagement: vi.fn(),
      retryUndeliveredArticleNotifications: vi.fn(),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { ArticleEmailEngagementPanel } from '../ArticleEmailEngagementPanel';

function summary(
  overrides: Partial<ArticleEmailEngagementSummary> & { articleId: string; articleTitle: string },
): ArticleEmailEngagementSummary {
  return {
    articleSlug: overrides.articleId,
    publishedAt: '2026-09-20T08:00:00.000Z',
    campaignId: null,
    campaignStatus: null,
    pending: 0,
    sent: 0,
    failed: 0,
    undelivered: 0,
    publishPending: 0,
    publishFailed: 0,
    publishUndelivered: 0,
    resharePending: 0,
    reshareFailed: 0,
    reshareUndelivered: 0,
    opened: 0,
    read: 0,
    openRate: 0,
    readRate: 0,
    latestSentAt: null,
    latestOpenedAt: null,
    latestReadAt: null,
    ...overrides,
  };
}

async function statusChipFor(title: string): Promise<HTMLElement> {
  const row = (await screen.findByText(title)).closest('tr');
  if (!row) throw new Error(`No table row for ${title}`);
  // Article, then Status.
  return within(row).getAllByRole('cell')[1];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ArticleEmailEngagementPanel status chip', () => {
  it('says "not emailed" for an article published to the website only', async () => {
    getEmailEngagementSummary.mockResolvedValue([
      summary({ articleId: 'web-only', articleTitle: 'Website only article' }),
    ]);

    render(<ArticleEmailEngagementPanel />);

    const cell = await statusChipFor('Website only article');
    expect(within(cell).getByText('not emailed')).toBeDefined();
    expect(within(cell).queryByText('queued')).toBeNull();
  });

  it('still shows the campaign status when an email is genuinely queued', async () => {
    getEmailEngagementSummary.mockResolvedValue([
      summary({
        articleId: 'queued',
        articleTitle: 'Queued article',
        campaignId: 'campaign-1',
        campaignStatus: 'queued',
        intendedRecipientCount: 40,
        pending: 40,
      }),
    ]);

    render(<ArticleEmailEngagementPanel />);

    const cell = await statusChipFor('Queued article');
    expect(within(cell).getByText('queued')).toBeDefined();
  });

  it('says "emailed" when sends were tracked without a publish campaign', async () => {
    getEmailEngagementSummary.mockResolvedValue([
      summary({ articleId: 'reshared', articleTitle: 'Reshared article', sent: 12 }),
    ]);

    render(<ArticleEmailEngagementPanel />);

    const cell = await statusChipFor('Reshared article');
    expect(within(cell).getByText('emailed')).toBeDefined();
  });
});
