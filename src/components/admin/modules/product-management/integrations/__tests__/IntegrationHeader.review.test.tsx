/**
 * IntegrationHeader — Review Is A Named Destination
 * =================================================
 *
 * The panel that shows proposed policy changes already titled itself
 * "Integration Review" for portal runs, but the tab holding it was called
 * "Upload & Sync". So an adviser who queued a refresh had nowhere obvious to
 * look for the result, and the per-policy refresh toast pointed at a place that
 * did not visibly exist.
 *
 * Pinned here: the tab is named Review, it carries the count of changes waiting
 * for a decision, and the count is absent rather than a zero when there is
 * nothing to do.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { Tabs } from '@/components/ui/tabs';
import { IntegrationHeader } from '@/components/admin/modules/product-management/integrations/IntegrationHeader';
import type { IntegrationProvider } from '@/components/admin/modules/product-management/types';

const provider: IntegrationProvider = {
  id: 'p1',
  name: 'Allan Gray',
  categoryIds: ['retirement_pre'],
};

function renderHeader(pendingReviewCount?: number) {
  return render(
    <Tabs value="upload">
      <IntegrationHeader
        provider={provider}
        selectedCategoryId="retirement_pre"
        onCategoryChange={vi.fn()}
        pendingReviewCount={pendingReviewCount}
      />
    </Tabs>,
  );
}

describe('IntegrationHeader — the Review tab', () => {
  it('names the tab Review rather than describing only the spreadsheet half', () => {
    renderHeader();
    expect(screen.getByText('Review')).toBeDefined();
    expect(screen.queryByText('Upload & Sync')).toBeNull();
  });

  it('shows how many changes are waiting for a decision', () => {
    renderHeader(3);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('shows no count when there is nothing waiting', () => {
    renderHeader(0);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('defaults to no count when the caller omits it', () => {
    renderHeader();
    expect(screen.getByText('Review')).toBeDefined();
  });

  it('keeps the other destinations intact', () => {
    renderHeader();
    expect(screen.getByText('Provider Setup')).toBeDefined();
    expect(screen.getByText('Mapping Configuration')).toBeDefined();
    expect(screen.getByText('Portal Automation')).toBeDefined();
  });

  it('no longer offers the History control that did nothing', () => {
    renderHeader();
    expect(screen.queryByText('History')).toBeNull();
  });
});
