/**
 * "View" on any FNA in a client's list. A draft made from a client intake has
 * no calculated results yet; the results views are not built for that (Tax's
 * threw), so the report says so instead of rendering one. The report is a
 * full page with a back link, Export PDF and Unpublish in its header, and
 * Delete under ⋯ behind a confirmation.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@/test/utils';
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

  it('is a page: back link, no pop-up, and the report header', async () => {
    const onOpenChange = vi.fn();
    render(
      <ViewPublishedFNADialog
        open
        onOpenChange={onOpenChange}
        fnaType="risk"
        fnaTypeName="Risk Planning FNA"
        fnaId="fna-9"
        backLabel="Risk planning FNAs"
        loadFn={async () => ({
          id: 'fna-9',
          status: 'published',
          version: 3,
          clientName: 'Elsa van Wyk',
          calculations: { life: 1 },
        })}
        unpublishFn={vi.fn()}
        ResultsView={ResultsView as never}
      />,
    );
    expect(await screen.findByText('Results for fna-9')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Risk Planning FNA' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export PDF/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Unpublish/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Risk planning FNAs/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('asks before unpublishing, then unpublishes', async () => {
    const unpublishFn = vi.fn().mockResolvedValue({});
    const onUnpublished = vi.fn();
    render(
      <ViewPublishedFNADialog
        open
        onOpenChange={vi.fn()}
        fnaType="risk"
        fnaTypeName="Risk Planning FNA"
        fnaId="fna-9"
        loadFn={async () => ({ id: 'fna-9', status: 'published', calculations: {} })}
        unpublishFn={unpublishFn}
        onUnpublished={onUnpublished}
        ResultsView={ResultsView as never}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Unpublish/ }));
    expect(await screen.findByText('Unpublish Risk Planning FNA?')).toBeTruthy();
    expect(unpublishFn).not.toHaveBeenCalled();
    const confirmButtons = screen.getAllByRole('button', { name: 'Unpublish' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() => expect(unpublishFn).toHaveBeenCalledWith('fna-9'));
    await waitFor(() => expect(onUnpublished).toHaveBeenCalled());
  });

  it('renders nothing while closed', () => {
    const { container } = render(
      <ViewPublishedFNADialog
        open={false}
        onOpenChange={vi.fn()}
        fnaType="risk"
        fnaTypeName="Risk Planning FNA"
      />,
    );
    expect(container.textContent).toBe('');
  });
});
