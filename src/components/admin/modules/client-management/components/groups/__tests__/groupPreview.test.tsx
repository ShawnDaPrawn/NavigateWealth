/**
 * Group editor: the live count of who the rules match, and Preview list.
 * (Own file: the shared groups.test.tsx mocks the communication barrel
 * without FilterBuilder / ManualSelection.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ClientGroup } from '../../../../communication/types';

const api = vi.hoisted(() => ({
  getClients: vi.fn(async () => []),
  getProviders: vi.fn(async () => []),
  previewGroup: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../../communication', () => ({
  communicationApi: api,
  FilterBuilder: () => <div>filter rules</div>,
  ManualSelection: () => <div>manual selection</div>,
}));

import { GroupEditorPage } from '../GroupEditorPage';
import { matchCountLabel } from '../groupModel';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const dynamicGroup = {
  id: 'g-hnw',
  name: 'High net worth',
  type: 'custom',
  clientIds: [],
  filterConfig: { netWorthFilters: [{ min: 10_000_000 }] },
  clientCount: 14,
} as unknown as ClientGroup;

function renderEditor(group: ClientGroup | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin?module=clients&tab=groups']}>
        <GroupEditorPage group={group} onClose={vi.fn()} onChanged={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('group editor live count', () => {
  it('counts who the rules match and lists them under Preview list', async () => {
    api.previewGroup.mockResolvedValue({
      count: 2,
      clients: [
        { id: 'c1', name: 'Elsa van Wyk', email: 'elsa@example.com' },
        { id: 'c2', name: 'Faizel Khan', email: 'faizel@example.com' },
      ],
    });
    renderEditor(dynamicGroup);
    expect(await screen.findByText(/2 clients match the rules/)).toBeDefined();
    expect(api.previewGroup).toHaveBeenCalledWith({ netWorthFilters: [{ min: 10_000_000 }] });

    fireEvent.click(screen.getByRole('button', { name: 'Preview list' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Elsa van Wyk');
    expect(dialog.textContent).toContain('faizel@example.com');
  });

  it('offers Try again when the count fails', async () => {
    api.previewGroup.mockRejectedValueOnce(new Error('down'));
    api.previewGroup.mockResolvedValueOnce({ count: 1, clients: [] });
    renderEditor(dynamicGroup);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => screen.getByText(/1 client matches the rules/));
  });

  it('does not ask while there are no rules', async () => {
    renderEditor(null);
    expect(screen.getByText(/No dynamic rules set/)).toBeDefined();
    expect(
      (screen.getByRole('button', { name: 'Preview list' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await new Promise((r) => setTimeout(r, 450));
    expect(api.previewGroup).not.toHaveBeenCalled();
  });
});

describe('matchCountLabel', () => {
  it('reads naturally', () => {
    expect(matchCountLabel(1)).toBe('1 client matches the rules');
    expect(matchCountLabel(0)).toBe('0 clients match the rules');
  });
});
