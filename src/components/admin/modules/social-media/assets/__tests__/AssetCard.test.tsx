import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AssetCard } from '../AssetCard';
import type { SocialAsset } from '../assetsTypes';

const base: SocialAsset = {
  id: 'a1',
  batch_id: 'b1',
  week_key: '2026-W38',
  channel: 'instagram',
  title: 'Two-pot: what the second withdrawal means',
  body: 'Body text of the post. '.repeat(20),
  first_comment: '#TwoPot #Retirement',
  hashtags: ['TwoPot', 'Retirement'],
  link_url: 'https://www.navigatewealth.co/resources/article/two-pot',
  link_title: 'Two-pot explained',
  source_article_ids: ['x'],
  source_summary: 'Based on: Two-pot explained',
  image_brief: 'calm coastal scene',
  image_style: 'editorial',
  image_status: 'failed',
  image_url: null,
  image_storage_path: null,
  image_alt_text: null,
  image_error: 'content policy',
  state: 'generated',
  selection_rank: null,
  selection_rationale: null,
  scheduled_for: null,
  buffer_post_id: null,
  buffer_status: null,
  buffer_error: null,
  published_at: null,
  created_by: 'claude-routine',
  updated_by: null,
  created_at: '2026-09-12T04:00:00Z',
  updated_at: '2026-09-12T04:00:00Z',
};

function setup(asset: SocialAsset) {
  const handlers = { onReject: vi.fn(), onRestore: vi.fn(), onRetryImage: vi.fn() };
  render(<AssetCard asset={asset} timeZone="Africa/Johannesburg" {...handlers} />);
  return handlers;
}

describe('AssetCard', () => {
  it('shows a candidate with a failed image and offers remove + retry', () => {
    const h = setup(base);
    expect(screen.getByText('Candidate')).toBeDefined();
    expect(screen.getByText('Image failed')).toBeDefined();
    expect(screen.getByText('content policy')).toBeDefined();
    expect(screen.getByText('Two-pot explained')).toBeDefined();
    fireEvent.click(screen.getByText('Remove'));
    expect(h.onReject).toHaveBeenCalledWith('a1');
    fireEvent.click(screen.getByText('Retry image'));
    expect(h.onRetryImage).toHaveBeenCalledWith('a1');
    fireEvent.click(screen.getByText('Show more'));
    expect(screen.getByText('Show less')).toBeDefined();
  });

  it('shows a scheduled pick with its rank, slot, rationale and Buffer status, and no remove button', () => {
    setup({
      ...base,
      state: 'scheduled',
      selection_rank: 1,
      selection_rationale: 'Most timely given the budget speech.',
      scheduled_for: '2026-09-15T05:30:00Z',
      image_status: 'ready',
      image_url: 'https://cdn/a.png',
      image_error: null,
      buffer_post_id: 'bp',
      buffer_status: 'scheduled',
    });
    expect(screen.getByText('Scheduled')).toBeDefined();
    expect(screen.getByText('#1')).toBeDefined();
    expect(screen.getByText(/Tue, 15 Sept?, 07:30/)).toBeDefined();
    expect(screen.getByText('Most timely given the budget speech.')).toBeDefined();
    expect(screen.getByText('Buffer: scheduled')).toBeDefined();
    expect(screen.getByRole('img')).toBeDefined();
    expect(screen.queryByText('Remove')).toBeNull();
  });

  it('offers restore for a removed asset', () => {
    const h = setup({
      ...base,
      state: 'rejected',
      image_status: 'none',
      image_brief: null,
      image_error: null,
    });
    fireEvent.click(screen.getByText('Restore'));
    expect(h.onRestore).toHaveBeenCalledWith('a1');
  });
});
