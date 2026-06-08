import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ApplicationsSkeleton } from '../ApplicationsSkeleton';

describe('ApplicationsSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<ApplicationsSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<ApplicationsSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
