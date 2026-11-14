import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormErrorBanner, Notice } from '../Notice';

describe('Notice', () => {
  it('shows a bold lead and one sentence', () => {
    render(
      <Notice kind="attention" title="3 intake requests">
        are waiting for you.
      </Notice>,
    );
    expect(screen.getByRole('status').textContent).toBe('3 intake requests are waiting for you.');
  });

  it('form error banner counts the fields and says what they block', () => {
    const { rerender } = render(<FormErrorBanner count={2} action="add the client" />);
    expect(screen.getByRole('alert').textContent).toBe('Fix 2 fields to add the client.');
    rerender(<FormErrorBanner count={1} action="save the task" />);
    expect(screen.getByRole('alert').textContent).toBe('Fix 1 field to save the task.');
    rerender(<FormErrorBanner count={0} action="save the task" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
