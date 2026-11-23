import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import MySavedLogins from './MySavedLogins';
import { api } from '../../../utils/api/client';
vi.mock('../../../utils/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const login = {
  id: 'l1',
  name: 'Bank',
  url: 'https://bank.example',
  username: 'amy',
  passwordChangedAt: null,
  due: true,
};
beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(cleanup);

describe('my saved logins', () => {
  it('stays hidden for someone who owns nothing', async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [] });
    const { container } = render(<MySavedLogins />);
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/password-vault-mine', expect.anything()),
    );
    expect(container.textContent).toBe('');
  });

  it('replaces a password without ever showing one', async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [login] });
    vi.mocked(api.put).mockResolvedValue({});
    render(<MySavedLogins />);
    fireEvent.click(await screen.findByRole('button', { name: 'Replace password' }));
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'n3w-secret' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'different' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Replace password' }).at(-1)!);
    await screen.findByText('The two passwords do not match.');
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'n3w-secret' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Replace password' }).at(-1)!);
    await screen.findByText('Password replaced.');
    expect(api.put).toHaveBeenCalledWith(
      '/password-vault-mine/l1/password',
      { password: 'n3w-secret' },
      expect.anything(),
    );
  });
});
