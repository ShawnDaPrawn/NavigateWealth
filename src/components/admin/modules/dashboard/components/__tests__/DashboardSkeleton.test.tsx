import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardSkeleton } from '../DashboardSkeleton';

describe('DashboardSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
