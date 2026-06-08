import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { SectionSkeleton } from '../CorporateIdentitySkeleton';

describe('SectionSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<SectionSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders with custom rows count', () => {
    const { container } = render(<SectionSkeleton rows={5} />);
    expect(container.firstChild).toBeDefined();
  });
});
