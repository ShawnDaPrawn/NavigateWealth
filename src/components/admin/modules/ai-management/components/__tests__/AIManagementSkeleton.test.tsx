import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AIManagementSkeleton } from '../AIManagementSkeleton';

describe('AIManagementSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<AIManagementSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<AIManagementSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
