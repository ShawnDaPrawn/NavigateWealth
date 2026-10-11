/**
 * Publishing from an accepted intake finishes that intake: the draft the accept
 * made from the client's answers is removed, then the adviser lands on the FNA
 * list. Before, the draft stayed and showed beside the published FNA.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@/test/utils';
import type { FNAWizardProps } from '../../../fna';

const deleteFNA = vi.fn();

function FakeWizard({ onFNAComplete, clientId, intakePrefill }: FNAWizardProps) {
  return (
    <button type="button" onClick={() => onFNAComplete?.('published-1')}>
      Publish for {clientId} ({Object.keys(intakePrefill ?? {}).join(',')})
    </button>
  );
}

vi.mock('../../../../profile-sections/fna-config', () => ({
  getFNAConfig: (category: string) =>
    category === 'retirement' ? { Wizard: FakeWizard, deleteFNA } : null,
}));
vi.mock('../../../../../../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { IntakeWizardHandoff } = await import('../IntakeWizardHandoff');

const HANDOFF = {
  clientId: 'client-1',
  domain: 'retirement' as const,
  linkedFnaId: 'intake-draft-1',
  initialStep: 2,
  inputs: { currentAge: 45 },
};

beforeEach(() => {
  deleteFNA.mockReset();
});

describe('IntakeWizardHandoff', () => {
  it('opens the registry wizard for the intake domain with the client answers', () => {
    render(<IntakeWizardHandoff handoff={HANDOFF} onClose={vi.fn()} />);
    expect(screen.getByRole('button').textContent).toBe('Publish for client-1 (currentAge)');
  });

  it('removes the intake draft, then lands on the published FNA', async () => {
    const order: string[] = [];
    deleteFNA.mockImplementation(async () => {
      order.push('delete');
    });
    const onFNAComplete = vi.fn(() => order.push('land'));

    render(
      <IntakeWizardHandoff handoff={HANDOFF} onClose={vi.fn()} onFNAComplete={onFNAComplete} />,
    );
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(onFNAComplete).toHaveBeenCalledWith('published-1', HANDOFF));
    expect(deleteFNA).toHaveBeenCalledWith('intake-draft-1', 'client-1');
    expect(order).toEqual(['delete', 'land']);
  });

  it('still lands when the draft cannot be removed', async () => {
    deleteFNA.mockRejectedValue(new Error('gone'));
    const onFNAComplete = vi.fn();

    render(
      <IntakeWizardHandoff handoff={HANDOFF} onClose={vi.fn()} onFNAComplete={onFNAComplete} />,
    );
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(onFNAComplete).toHaveBeenCalledWith('published-1', HANDOFF));
  });

  it('leaves things alone when the intake has no draft', async () => {
    const onFNAComplete = vi.fn();
    render(
      <IntakeWizardHandoff
        handoff={{ ...HANDOFF, linkedFnaId: '' }}
        onClose={vi.fn()}
        onFNAComplete={onFNAComplete}
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(onFNAComplete).toHaveBeenCalled());
    expect(deleteFNA).not.toHaveBeenCalled();
  });
});
