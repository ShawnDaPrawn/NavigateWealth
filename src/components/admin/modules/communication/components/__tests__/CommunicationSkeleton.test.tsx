import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CommunicationSkeleton } from '../CommunicationSkeleton';

describe('CommunicationSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<CommunicationSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<CommunicationSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
