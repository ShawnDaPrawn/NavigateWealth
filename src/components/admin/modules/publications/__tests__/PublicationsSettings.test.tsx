import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

vi.mock('../api', () => ({
  PublicationsAPI: {
    Settings: {
      clearDrafts: vi.fn(),
      exportData: vi.fn().mockResolvedValue({ data: null }),
      importData: vi.fn().mockResolvedValue({ success: true }),
    },
  },
}));
vi.mock('../../../../../utils/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ success: false }),
    post: vi.fn().mockResolvedValue({ success: true }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { PublicationsSettings } from '../PublicationsSettings';

describe('PublicationsSettings', () => {
  it('renders without crashing', () => {
    const { container } = render(<PublicationsSettings />);
    expect(container.firstChild).toBeDefined();
  });

  it('lists the sections on the left and shows one at a time', () => {
    render(<PublicationsSettings />);
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(nav.textContent).toContain('Maintenance');
    expect(screen.queryByText('Clear all drafts')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Maintenance' }));
    expect(screen.getByText('Clear all drafts')).toBeDefined();
  });

  it('confirms in a dialog before clearing drafts', async () => {
    render(<PublicationsSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Maintenance' }));
    fireEvent.click(screen.getByRole('button', { name: /clear drafts/i }));
    expect(await screen.findByText('Delete all drafts?')).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(<PublicationsSettings />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
