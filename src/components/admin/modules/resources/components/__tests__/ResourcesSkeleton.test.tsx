import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ResourcesSkeleton } from '../ResourcesSkeleton';

describe('ResourcesSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<ResourcesSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<ResourcesSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
