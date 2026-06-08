import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryBadge, CategoryFilterButton } from '../CategoryBadge';

describe('CategoryBadge', () => {
  it('renders the category name', () => {
    render(<CategoryBadge name="Finance" />);
    expect(screen.getByText('Finance')).toBeDefined();
  });

  it('renders without iconKey without crashing', () => {
    const { container } = render(<CategoryBadge name="Markets" />);
    expect(container.firstChild).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(<CategoryBadge name="Tech" className="my-badge" />);
    expect(container.innerHTML).toContain('my-badge');
  });

  it('renders sm size badge', () => {
    render(<CategoryBadge name="Economy" size="sm" />);
    expect(screen.getByText('Economy')).toBeDefined();
  });
});

describe('CategoryFilterButton', () => {
  it('renders the name', () => {
    render(<CategoryFilterButton name="All" isActive={false} onClick={() => {}} />);
    expect(screen.getByText('All')).toBeDefined();
  });

  it('renders count when provided', () => {
    render(<CategoryFilterButton name="News" count={5} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('(5)')).toBeDefined();
  });

  it('applies active styling when isActive=true', () => {
    const { container } = render(
      <CategoryFilterButton name="Active" isActive={true} onClick={() => {}} />,
    );
    expect(container.innerHTML).toContain('bg-blue-600');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<CategoryFilterButton name="Click me" isActive={false} onClick={onClick} />);
    fireEvent.click(screen.getByText('Click me'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
