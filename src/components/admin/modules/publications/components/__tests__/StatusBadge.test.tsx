import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders draft status', () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText(/draft/i)).toBeDefined();
  });

  it('renders published status', () => {
    render(<StatusBadge status="published" />);
    expect(screen.getByText(/published/i)).toBeDefined();
  });

  it('applies optional className', () => {
    const { container } = render(<StatusBadge status="draft" className="my-class" />);
    expect(container.innerHTML).toContain('my-class');
  });
});
