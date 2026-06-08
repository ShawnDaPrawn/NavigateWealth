import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { PersonnelSkeleton } from '../PersonnelSkeleton';

describe('PersonnelSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<PersonnelSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<PersonnelSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
