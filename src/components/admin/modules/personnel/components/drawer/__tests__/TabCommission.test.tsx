import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Personnel } from '../../../types';
import { TabCommission } from '../TabCommission';

afterEach(cleanup);

const person = {
  id: 'p-1',
  firstName: 'Naledi',
  lastName: 'Khumalo',
  commissionSplit: 0.7,
  commissionEntity: 'personal',
} as Personnel;

describe('TabCommission', () => {
  it('saves the split and entity through the page header Save', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const saveRef = { current: null as null | (() => void) };
    const states: { dirty: boolean }[] = [];
    render(
      <TabCommission
        selectedPersonnel={person}
        onSave={onSave}
        saveRef={saveRef}
        onFormStateChange={(s) => states.push(s)}
      />,
    );
    expect((screen.getByLabelText('Standard split (%)') as HTMLInputElement).value).toBe('70');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Registered company (Pty) Ltd' }));
    expect(states.at(-1)?.dirty).toBe(true);
    await act(async () => saveRef.current?.());
    expect(onSave).toHaveBeenCalledWith('p-1', {
      commissionSplit: 0.7,
      commissionEntity: 'company',
    });
  });

  it('refuses a split over 100%', async () => {
    const onSave = vi.fn();
    const saveRef = { current: null as null | (() => void) };
    render(<TabCommission selectedPersonnel={person} onSave={onSave} saveRef={saveRef} />);
    fireEvent.change(screen.getByLabelText('Standard split (%)'), { target: { value: '150' } });
    await act(async () => saveRef.current?.());
    expect(screen.getByText('Enter a split between 0 and 100%')).toBeDefined();
    expect(onSave).not.toHaveBeenCalled();
  });
});
