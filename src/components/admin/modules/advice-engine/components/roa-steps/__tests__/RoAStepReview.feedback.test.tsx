/**
 * The review step's actions report their outcome: a failed call shows an
 * error toast instead of failing silently.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));
vi.mock('../../../hooks/useClient', () => ({ useClient: () => ({ data: undefined }) }));
vi.mock('../ModuleNarrativesEditor', () => ({ ModuleNarrativesEditor: () => null }));

const roaApi = vi.hoisted(() => ({
  validateDraft: vi.fn(),
  compileDraft: vi.fn(),
  generateDraftDocuments: vi.fn(),
  finaliseDraft: vi.fn(),
  downloadGeneratedDocument: vi.fn(),
  cloneDraftFromFinal: vi.fn(),
}));
vi.mock('../../../api', () => ({ roaApi }));

import { RoAStepReview } from '../RoAStepReview';
import type { RoADraft } from '../../DraftRoAInterface';

const draft = {
  id: 'draft-1',
  status: 'draft',
  version: 1,
  selectedModules: [],
  moduleData: {},
  clientSnapshot: { displayName: 'Elsa Venter' },
} as unknown as RoADraft;

beforeEach(() => vi.clearAllMocks());

describe('RoAStepReview feedback', () => {
  it('shows an error when Validate & Compile fails', async () => {
    roaApi.validateDraft.mockRejectedValue(new Error('Server unavailable'));
    render(<RoAStepReview draft={draft} onUpdate={vi.fn()} modules={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Validate & Compile/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Server unavailable'));
    expect(
      (screen.getByRole('button', { name: /Validate & Compile/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('confirms a successful compile', async () => {
    roaApi.validateDraft.mockResolvedValue({ draft: {}, validation: { valid: true } });
    roaApi.compileDraft.mockResolvedValue({ draft: {} });
    render(<RoAStepReview draft={draft} onUpdate={vi.fn()} modules={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Validate & Compile/ }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('RoA validated and compiled'));
  });

  it('says so when validation finds items to fix', async () => {
    roaApi.validateDraft.mockResolvedValue({ draft: {}, validation: { valid: false } });
    render(<RoAStepReview draft={draft} onUpdate={vi.fn()} modules={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Validate & Compile/ }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'The RoA has items to fix before it can be compiled.',
      ),
    );
    expect(roaApi.compileDraft).not.toHaveBeenCalled();
  });
});
