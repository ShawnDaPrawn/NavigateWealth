import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { OverviewSkeleton } from '../OverviewSkeleton';

describe('OverviewSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<OverviewSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<OverviewSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
