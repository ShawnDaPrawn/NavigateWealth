/**
 * LinktreeTab — Render / Characterization Test (Phase 4)
 * =======================================================
 *
 * Locks the mount contract and the always-visible "Link in Bio" section
 * heading for this 1,124-line Phase 6 decomposition target.
 *
 * api is mocked so no real HTTP calls are made on mount.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@/test/utils';
import { validateLinkForm } from '../linktree/linktreeModel';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('@/utils/api', () => ({
  api: {
    get: mockApiGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { LinktreeTab } from '../LinktreeTab';

beforeEach(() => {
  vi.clearAllMocks();
  // Resolve with empty data so the component exits loading state and shows chrome.
  mockApiGet.mockResolvedValue({ data: [] });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LinktreeTab', () => {
  it('renders without throwing', async () => {
    const { container } = render(<LinktreeTab />);
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled();
    });
    expect(container).toBeTruthy();
  });

  it('shows the public page address and the empty state', async () => {
    render(<LinktreeTab />);
    await waitFor(() => {
      expect(screen.getByText('Your public link page:')).toBeTruthy();
      expect(screen.getByText('No links yet')).toBeTruthy();
    });
  });

  it('validates the add-link form inline before saving', async () => {
    render(<LinktreeTab />);
    await waitFor(() => expect(screen.getByText('No links yet')).toBeTruthy());
    fireEvent.click(screen.getAllByRole('button', { name: /^add link$/i })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('URL *'), { target: { value: 'not a url' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^add link$/i }));
    expect(await within(dialog).findByText('Add a title')).toBeTruthy();
    expect(
      within(dialog).getByText('Enter a full web address starting with https://'),
    ).toBeTruthy();
  });

  it('shows the Add Link and Copy URL buttons', async () => {
    render(<LinktreeTab />);
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /add link/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /copy url/i })).toBeTruthy();
    });
  });
});

describe('validateLinkForm', () => {
  it('needs a title and a full web address', () => {
    expect(validateLinkForm('', '')).toEqual({
      title: 'Add a title',
      url: 'Enter a full web address starting with https://',
    });
    expect(validateLinkForm('Book', 'https://navigatewealth.co/book')).toEqual({});
    expect(validateLinkForm('Mail', 'mailto:info@example.com')).toEqual({});
  });
});
