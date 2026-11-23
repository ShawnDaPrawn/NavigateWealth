import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

// Every page reports that something overflows it, as a block taller than a
// page that cannot be broken would.
vi.mock('../legalPdfNavigatorModel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../legalPdfNavigatorModel')>()),
  legalPdfPageFits: () => false,
}));

import { LegalPdfNavigatorLayout } from '../LegalPdfNavigatorLayout';

describe('LegalPdfNavigatorLayout when a page still overflows', () => {
  it('reports an error on the legacy renderer instead of offering clipped pages', async () => {
    const onRenderStateChange = vi.fn();
    render(
      <LegalPdfNavigatorLayout
        document={{ title: 'Notice', version: '1.0', html: '<h2>1. One</h2><p>Text.</p>' }}
        onRenderStateChange={onRenderStateChange}
      />,
    );

    await waitFor(() =>
      expect(onRenderStateChange).toHaveBeenLastCalledWith({
        ready: true,
        error: 'Part of the document did not fit on its page.',
        activeRenderer: 'legacy',
      }),
    );
    expect(onRenderStateChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ ready: true, activeRenderer: 'navigator' }),
    );
  });
});
