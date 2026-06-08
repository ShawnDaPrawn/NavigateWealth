import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { IssuesSkeleton } from '../IssuesSkeleton';

describe('IssuesSkeleton', () => {
  it('renders without throwing', () => {
    const { container } = render(<IssuesSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a container with spacing', () => {
    const { container } = render(<IssuesSkeleton />);
    expect(container.querySelector('.p-6')).toBeDefined();
  });
});
