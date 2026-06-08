import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthorCard } from '../AuthorCard';

describe('AuthorCard', () => {
  it('renders author name', () => {
    render(<AuthorCard name="Jane Smith" />);
    expect(screen.getByText('Jane Smith')).toBeDefined();
  });

  it('renders custom bio when provided', () => {
    render(<AuthorCard name="Jane Smith" bio="Expert in finance." />);
    expect(screen.getByText('Expert in finance.')).toBeDefined();
  });

  it('renders default bio when no bio provided', () => {
    render(<AuthorCard name="Jane Smith" />);
    expect(screen.getByText(/Navigate Wealth/i)).toBeDefined();
  });

  it('renders without crashing when imageUrl is provided', () => {
    const { container } = render(
      <AuthorCard name="Jane Smith" imageUrl="https://example.com/photo.jpg" />,
    );
    expect(container.firstChild).toBeDefined();
  });
});
