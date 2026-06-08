import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { NotesSkeleton } from '../NotesSkeleton';

describe('NotesSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<NotesSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty container', () => {
    const { container } = render(<NotesSkeleton />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
