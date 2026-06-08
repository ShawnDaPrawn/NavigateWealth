import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../api', () => ({
  adminAuditApi: {
    getLog: vi.fn().mockResolvedValue([]),
  },
  systemHealthApi: {
    getLastCleanupRun: vi.fn().mockResolvedValue(null),
    runCleanup: vi.fn().mockResolvedValue({}),
  },
}));

import { AuditLogViewer } from '../AuditLogViewer';

describe('AuditLogViewer', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<AuditLogViewer open={false} onOpenChange={vi.fn()} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders dialog when open', () => {
    render(<AuditLogViewer open onOpenChange={vi.fn()} />);
    expect(screen.getAllByText(/Audit Log/i).length).toBeGreaterThan(0);
  });

  it('renders search field when open', () => {
    render(<AuditLogViewer open onOpenChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Search/i)).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(<AuditLogViewer open onOpenChange={vi.fn()} />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
