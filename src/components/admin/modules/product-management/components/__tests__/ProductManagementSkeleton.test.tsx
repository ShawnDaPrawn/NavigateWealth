import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ProductManagementSkeleton } from '../ProductManagementSkeleton';

describe('ProductManagementSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<ProductManagementSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<ProductManagementSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
