/**
 * DraftRoAInterface — new-draft creation regression test
 * ======================================================
 *
 * Guards the fix for "RoA not found": the wizard must CREATE a new draft on the
 * server (POST, null id) before advancing. The previous behaviour generated a
 * client-side id (`roa-${Date.now()}`) and only ever PUT it — but the PUT route
 * requires the draft to already exist, so the first save 404'd with
 * "RoA draft not found" and the whole RoA flow (including the AI conversation,
 * whose endpoints all load the draft) was dead.
 *
 * The later wizard steps are stubbed so the test stays focused on the start
 * step's create action and needs no client-search / contract wiring.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('../roa-steps/RoAStepClient', () => ({
  RoAStepClient: () => <div>client-step</div>,
}));
vi.mock('../roa-steps/RoAStepModules', () => ({
  RoAStepModules: () => <div>modules-step</div>,
}));
vi.mock('../roa-steps/RoAStepModuleConversation', () => ({
  RoAStepModuleConversation: () => <div>conversation-step</div>,
}));
vi.mock('../roa-steps/RoAStepReview', () => ({
  RoAStepReview: () => <div>review-step</div>,
}));

vi.mock('../../api', () => ({
  roaApi: {
    getModuleContracts: vi.fn().mockResolvedValue([]),
    listDrafts: vi.fn().mockResolvedValue([]),
    saveDraft: vi.fn(),
    startConversation: vi.fn().mockResolvedValue({ progress: { modules: [], allComplete: false } }),
    deleteDraft: vi.fn().mockResolvedValue(undefined),
  },
}));

import { DraftRoAInterface } from '../DraftRoAInterface';
import { roaApi } from '../../api';

const mockedSaveDraft = vi.mocked(roaApi.saveDraft);

function renderInterface() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DraftRoAInterface />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DraftRoAInterface — new draft creation', () => {
  it('creates the draft on the server via POST (null id) before advancing', async () => {
    mockedSaveDraft.mockResolvedValue({
      id: 'server-draft-1',
      selectedModules: [],
      moduleData: {},
      status: 'draft',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    renderInterface();

    const beginButton = await screen.findByRole('button', { name: /Begin RoA Draft/i });
    fireEvent.click(beginButton);

    await waitFor(() => {
      expect(mockedSaveDraft).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ status: 'draft' }),
      );
    });

    // The first save must use a null id (POST/create), never a client-generated
    // id that the server has never seen.
    expect(mockedSaveDraft.mock.calls[0][0]).toBeNull();
    // Once created, the wizard advances to the (stubbed) client step.
    expect(await screen.findByText('client-step')).toBeTruthy();
  });
});
