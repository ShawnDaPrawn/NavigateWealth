/**
 * FNA intake queue — client names come from the list the module already holds.
 *
 * Opening the queue used to fetch the whole client directory a second time and
 * then read a field that endpoint does not return, so every row showed the raw
 * client id. The queue now reads the cached list and only falls back to the id
 * when that client is not on it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, makeTestQueryClient, render, screen } from '@/test/utils';
import { clientKeys } from '@/utils/queryKeys';

const { listSubmittedIntakes, getClients } = vi.hoisted(() => ({
  listSubmittedIntakes: vi.fn(),
  getClients: vi.fn(),
}));

vi.mock('../../../../../../services/fna-intake-api', () => ({
  listSubmittedIntakes: (...args: unknown[]) => listSubmittedIntakes(...args),
  acceptIntakeSession: vi.fn(),
  requestIntakeMoreInfo: vi.fn(),
}));

vi.mock('../../api', () => ({
  clientApi: { getClients: (...args: unknown[]) => getClients(...args) },
}));

import { FNAIntakeQueue } from '../FNAIntakeQueue';

function session(id: string, clientId: string) {
  return {
    id,
    clientId,
    domain: 'risk' as const,
    status: 'submitted' as const,
    inputs: {},
    progressPercent: 40,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    intakeSource: 'client' as const,
  };
}

beforeEach(() => {
  listSubmittedIntakes.mockReset();
  getClients.mockReset();
  listSubmittedIntakes.mockResolvedValue([
    session('s-named', 'c-alice'),
    session('s-email', 'c-email'),
    session('s-blank', 'c-blank'),
    session('s-unknown', 'c-missing'),
  ]);
});

describe('FNAIntakeQueue client names', () => {
  it('shows the cached name, then email, then the id, and does not fetch the directory', async () => {
    const onOpenClient = vi.fn();
    const queryClient = makeTestQueryClient();
    queryClient.setQueryData(clientKeys.lists(), [
      { id: 'c-alice', firstName: 'Alice', lastName: 'Nkosi', email: 'alice@example.com' },
      { id: 'c-email', firstName: '', lastName: '', email: 'only@example.com' },
      { id: 'c-blank', firstName: '  ', lastName: ' ', email: 'spaced@example.com' },
    ]);
    render(
      <QueryClientProvider client={queryClient}>
        <FNAIntakeQueue onOpenClient={onOpenClient} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('button', { name: 'Alice Nkosi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'only@example.com' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'spaced@example.com' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'c-missing' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'c-alice' })).toBeNull();
    expect(getClients).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Alice Nkosi' }));
    expect(onOpenClient).toHaveBeenCalledWith('c-alice');
  });
});
