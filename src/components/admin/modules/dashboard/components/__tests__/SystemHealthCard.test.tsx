import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../api', () => ({
  systemHealthApi: {
    getLastCleanupRun: vi.fn().mockResolvedValue(null),
    runCleanup: vi.fn().mockResolvedValue({ purged: 0, dryRun: true }),
  },
}));

import { SystemHealthCard } from '../SystemHealthCard';

describe('SystemHealthCard', () => {
  it('renders without crashing', () => {
    const { container } = render(<SystemHealthCard />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders System Health heading', () => {
    render(<SystemHealthCard />);
    expect(screen.getAllByText(/System Health/i).length).toBeGreaterThan(0);
  });

  it('renders Run Cleanup button', () => {
    render(<SystemHealthCard />);
    expect(screen.getAllByText(/Run Cleanup/i).length).toBeGreaterThan(0);
  });

  it('renders non-empty container', () => {
    const { container } = render(<SystemHealthCard />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
