import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { SocialMediaSkeleton } from '../SocialMediaSkeleton';

describe('SocialMediaSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<SocialMediaSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<SocialMediaSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
