import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { SubmissionsSkeleton } from '../SubmissionsSkeleton';

describe('SubmissionsSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<SubmissionsSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<SubmissionsSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
