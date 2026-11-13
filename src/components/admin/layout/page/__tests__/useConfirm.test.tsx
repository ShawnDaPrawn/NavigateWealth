import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useConfirm } from '../useConfirm';

function Harness() {
  const { confirm, confirmDialog } = useConfirm();
  const [answer, setAnswer] = useState('none');
  return (
    <>
      <button
        onClick={async () => {
          const ok = await confirm({
            title: 'Delete this packet?',
            description: 'Active runs keep going.',
            confirmLabel: 'Delete',
            destructive: true,
          });
          setAnswer(ok ? 'yes' : 'no');
        }}
      >
        Ask
      </button>
      <p>answer: {answer}</p>
      {confirmDialog}
    </>
  );
}

describe('useConfirm', () => {
  it('resolves true when the action is confirmed', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Ask'));
    expect(await screen.findByRole('alertdialog', { name: 'Delete this packet?' })).toBeTruthy();
    expect(screen.getByText('Active runs keep going.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByText('answer: yes')).toBeTruthy());
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('resolves false when cancelled', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Ask'));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByText('answer: no')).toBeTruthy());
  });
});
