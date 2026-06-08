import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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

  it('renders settings heading', () => {
    render(<PublicationsSettings />);
    expect(screen.getByText('Publications Settings')).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(<PublicationsSettings />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
