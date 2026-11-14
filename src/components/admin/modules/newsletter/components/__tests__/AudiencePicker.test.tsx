import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AudiencePicker } from '../AudiencePicker';

describe('AudiencePicker', () => {
  it('shows the shared error, not "No audiences yet", when the groups fail to load', () => {
    const onRetry = vi.fn();
    render(
      <AudiencePicker
        lists={[]}
        value={[]}
        onChange={vi.fn()}
        error={new Error('400')}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('Unable to load audiences')).toBeTruthy();
    expect(screen.queryByText(/No audiences yet/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('says "No audiences yet" only on a successful empty response', () => {
    render(<AudiencePicker lists={[]} value={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/No audiences yet/)).toBeTruthy();
  });
});
