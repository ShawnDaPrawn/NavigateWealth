import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { PublicationsSkeleton } from '../PublicationsSkeleton';

describe('PublicationsSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<PublicationsSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<PublicationsSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
