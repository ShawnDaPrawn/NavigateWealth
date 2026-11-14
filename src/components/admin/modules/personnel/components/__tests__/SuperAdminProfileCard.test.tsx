import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SuperAdminProfileCard } from '../SuperAdminProfileCard';
import type { SuperAdminProfile } from '../../types';

afterEach(cleanup);

const profile = {
  id: 'sa',
  firstName: 'Shawn',
  lastName: 'Francisco',
  email: 'shawn@example.com',
  phone: '0721234567',
  role: 'super_admin',
  status: 'active',
} as unknown as SuperAdminProfile;

describe('SuperAdminProfileCard', () => {
  it('edits in a dialog and saves trimmed values', async () => {
    const onUpdate = vi.fn().mockResolvedValue(true);
    render(<SuperAdminProfileCard profile={profile} loading={false} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    expect(screen.getByRole('dialog')).toBeDefined();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: ' Shaun ' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        firstName: 'Shaun',
        lastName: 'Francisco',
        phone: '0721234567',
      }),
    );
  });

  it('shows the form error banner, marks the fields and focuses the first', async () => {
    const onUpdate = vi.fn();
    render(<SuperAdminProfileCard profile={profile} loading={false} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(await screen.findByText('Fix 2 fields to save the profile.')).toBeDefined();
    expect(screen.getByLabelText('First name').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('First name'));
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
