import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SchedulingOptions } from '../SchedulingOptions';

afterEach(cleanup);

describe('SchedulingOptions', () => {
  it('is a Send now | Schedule segmented control', () => {
    const onChange = vi.fn();
    render(<SchedulingOptions config={{ type: 'immediate' }} onChange={onChange} />);
    expect(screen.getByRole('tablist', { name: 'When to send' })).toBeDefined();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Schedule' }));
    expect(onChange).toHaveBeenCalledWith({ type: 'scheduled' });
  });

  it('shows date, time and Repeat this email once scheduled', () => {
    const onChange = vi.fn();
    render(<SchedulingOptions config={{ type: 'scheduled' }} onChange={onChange} />);
    expect(screen.getByText('Date')).toBeDefined();
    fireEvent.click(screen.getByRole('switch', { name: /Repeat this email/ }));
    expect(onChange).toHaveBeenCalledWith({ type: 'scheduled', isRecurring: true });
  });
});
