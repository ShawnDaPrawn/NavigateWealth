import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { TasksSkeleton } from '../TasksSkeleton';

describe('TasksSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<TasksSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<TasksSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
