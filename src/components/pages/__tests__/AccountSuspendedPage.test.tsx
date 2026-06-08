import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountSuspendedPage } from '../AccountSuspendedPage';

describe('AccountSuspendedPage', () => {
  it('renders without crashing', () => {
    const { container } = render(<AccountSuspendedPage />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders account suspended heading', () => {
    render(<AccountSuspendedPage />);
    expect(screen.getByText(/account suspended/i)).toBeDefined();
  });

  it('renders support contact information', () => {
    render(<AccountSuspendedPage />);
    expect(screen.getByText(/Call Our Team/i)).toBeDefined();
  });

  it('renders with custom reason', () => {
    render(<AccountSuspendedPage reason="Suspicious login activity" />);
    expect(screen.getByText(/Suspicious login activity/i)).toBeDefined();
  });

  it('renders with suspendedAt date', () => {
    render(<AccountSuspendedPage suspendedAt="2026-01-01T00:00:00Z" />);
    const { container } = render(<AccountSuspendedPage suspendedAt="2026-01-01T00:00:00Z" />);
    expect(container.firstChild).toBeDefined();
  });
});
