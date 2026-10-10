import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { FNAManagementView } from '../FNAManagementView';

const ROWS = [
  {
    id: 'old',
    status: 'published',
    version: 1,
    createdAt: '2026-01-01T08:00:00Z',
    updatedAt: '2026-01-01T08:00:00Z',
  },
  {
    id: 'new',
    status: 'published',
    version: 2,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
];

function renderList(props: Partial<React.ComponentProps<typeof FNAManagementView>> = {}) {
  const loadFNAs = vi.fn(async () => ROWS);
  const view = render(
    <FNAManagementView
      clientName="Thandi Nkosi"
      title="Retirement Planning FNAs"
      fnaName="Retirement FNA"
      loadFNAs={loadFNAs}
      onCreateNew={vi.fn()}
      onViewFNA={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );
  return { loadFNAs, ...view };
}

describe('FNAManagementView', () => {
  it('lists the FNAs it is given, newest first', async () => {
    renderList();
    const rows = await screen.findAllByRole('row');
    // header row, then newest (v2) before oldest (v1)
    expect(rows[1].textContent).toContain('2');
    expect(rows[2].textContent).toContain('1');
  });

  it('highlights the FNA that was just published', async () => {
    renderList({ highlightFnaId: 'new' });
    await screen.findByText('New');
    const highlighted = document.querySelectorAll('[data-highlighted]');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].textContent).toContain('New');
  });

  it('loads once, even when the parent passes a new loader each render', async () => {
    const { loadFNAs, rerender } = renderList();
    await waitFor(() => expect(loadFNAs).toHaveBeenCalledTimes(1));
    const next = vi.fn(async () => ROWS);
    rerender(
      <FNAManagementView
        clientName="Thandi Nkosi"
        title="Retirement Planning FNAs"
        fnaName="Retirement FNA"
        loadFNAs={next}
        onCreateNew={vi.fn()}
        onViewFNA={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await screen.findAllByRole('row');
    expect(loadFNAs).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('names the FNA type in the empty state', async () => {
    renderList({ loadFNAs: vi.fn(async () => []) });
    expect(
      await screen.findByText(/running your first Retirement FNA for this client/),
    ).toBeTruthy();
  });
});
