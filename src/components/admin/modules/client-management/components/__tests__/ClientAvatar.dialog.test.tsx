import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, renderWithQueryClient, screen, waitFor } from '@/test/utils';

const api = vi.hoisted(() => ({
  getClientAvatarUrl: vi.fn(),
  uploadClientAvatar: vi.fn(),
  deleteClientAvatar: vi.fn(),
}));
vi.mock('../../api', () => ({ clientApi: api }));
vi.mock('../../resizeAvatarImage', () => ({ resizeAvatarImage: async (f: File) => f }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ClientAvatar } from '../ClientAvatar';

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => cleanup());

describe('Client avatar photo dialog', () => {
  it('adds a photo through the dialog: pick, preview, Save photo', async () => {
    api.getClientAvatarUrl.mockResolvedValue(null);
    api.uploadClientAvatar.mockResolvedValue('https://img/new.png');
    renderWithQueryClient(
      <ClientAvatar clientId="c1" firstName="Elsa" lastName="van Wyk" editable />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add profile photo' }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('heading', { name: 'Add profile photo' })).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Save photo' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    const file = new File(['x'], 'elsa.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload profile photo'), { target: { files: [file] } });
    expect(await screen.findByText('elsa.png')).toBeTruthy();
    expect(api.uploadClientAvatar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Save photo' }));
    await waitFor(() => expect(api.uploadClientAvatar).toHaveBeenCalled());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Profile photo updated'));
  });

  it('rejects a file that is not an image', async () => {
    api.getClientAvatarUrl.mockResolvedValue(null);
    renderWithQueryClient(
      <ClientAvatar clientId="c1" firstName="Elsa" lastName="van Wyk" editable />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add profile photo' }));
    await screen.findByRole('dialog');
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Upload profile photo'), { target: { files: [file] } });
    expect(toast.error).toHaveBeenCalledWith('Please choose an image file');
  });
});
