import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CalendarSkeleton } from '../CalendarSkeleton';

describe('CalendarSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<CalendarSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<CalendarSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
