import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ReportingSkeleton } from '../ReportingSkeleton';

describe('ReportingSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<ReportingSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<ReportingSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
