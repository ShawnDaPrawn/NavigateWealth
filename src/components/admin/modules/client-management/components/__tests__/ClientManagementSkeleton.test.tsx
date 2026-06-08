import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ClientManagementSkeleton } from '../ClientManagementSkeleton';

describe('ClientManagementSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<ClientManagementSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<ClientManagementSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
