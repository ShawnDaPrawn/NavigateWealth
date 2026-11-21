import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import PasswordManager from './PasswordManager';
import { api } from '../../../utils/api/client';
vi.mock('../../../utils/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
const item = {
  name: 'Portal',
  url: 'https://example.com/login',
  username: 'amy',
  id: 'id',
  revision: 'revision',
  connectionExpiresAt: null,
};
const button = (name: string) => screen.getByRole('button', { name });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue({ items: [item], nextCursor: null });
});
afterEach(cleanup);
describe('password manager dialog', () => {
  it('fetches the password on open, masks it by default and saves changes', async () => {
    vi.mocked(api.post).mockResolvedValue({ ...item, password: 'test pass', notes: 'note' });
    render(<PasswordManager onClose={vi.fn()} />);
    await screen.findByText('Portal');
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(button('Open'));
    const input = (await screen.findByLabelText('Password', { exact: true })) as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(button('Show password'));
    expect(input.type).toBe('text');
    fireEvent.change(input, { target: { value: 'new pass' } });
    fireEvent.click(button('Save credential'));
    await screen.findByText('Credential saved.');
    expect(api.put).toHaveBeenCalledWith(
      '/password-vault/id',
      expect.objectContaining({
        revision: item.revision,
        credential: expect.objectContaining({ password: 'new pass' }),
      }),
      expect.anything(),
    );
    expect(screen.queryByDisplayValue('new pass')).toBeNull();
  });
  it('shows a newly issued service token once and clears it on return', async () => {
    vi.mocked(api.post).mockResolvedValue({ token: 'test-token', expiresAt: '2027-02-01' });
    render(<PasswordManager onClose={vi.fn()} />);
    await screen.findByText('Portal');
    fireEvent.click(button('MCP'));
    expect((screen.getByLabelText('Streamable HTTP endpoint') as HTMLInputElement).value).toMatch(
      /\/mcp\/password-vault$/,
    );
    fireEvent.click(button('Create token'));
    await screen.findByDisplayValue('test-token');
    fireEvent.click(button('Back to vault'));
    await waitFor(() => expect(screen.queryByDisplayValue('test-token')).toBeNull());
  });
});
