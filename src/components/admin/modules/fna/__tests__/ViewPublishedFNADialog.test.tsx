/**
 * "View" on any FNA in a client's list. A draft made from a client intake has
 * no calculated results yet; the results views are not built for that (Tax's
 * threw), so the dialog says so instead of rendering one.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { ViewPublishedFNADialog } from '../ViewPublishedFNADialog';

function ResultsView({ fna }: { fna?: { id?: string } }) {
  return <div>Results for {fna?.id}</div>;
}

function open(record: Record<string, unknown>) {
  return render(
    <ViewPublishedFNADialog
      open
      onOpenChange={vi.fn()}
      fnaType="tax"
      fnaTypeName="Tax Planning FNA"
      fnaId={String(record.id)}
      loadFn={async () => record}
      ResultsView={ResultsView as never}
    />,
  );
}

describe('ViewPublishedFNADialog', () => {
  it.each([
    ['results', { results: { total: 1 } }],
    ['calculations', { calculations: { lifeCover: 1 } }],
    ['finalResults', { finalResults: { taxSaving: 1 } }],
  ])('shows the results view when the FNA has %s', async (_field, extra) => {
    open({ id: 'fna-1', status: 'published', ...extra });
    expect(await screen.findByText('Results for fna-1')).toBeTruthy();
  });

  it('says a draft with no results is not calculated yet, instead of rendering results', async () => {
    open({ id: 'intake-1', status: 'draft', results: null, intakeSource: 'client' });
    expect(await screen.findByText('Not calculated yet')).toBeTruthy();
    expect(screen.queryByText(/Results for/)).toBeNull();
  });
});
