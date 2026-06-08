import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState, EmptyList } from '../EmptyState';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No articles found" />);
    expect(screen.getByText('No articles found')).toBeDefined();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Nothing here yet." />);
    expect(screen.getByText('Nothing here yet.')).toBeDefined();
  });

  it('does not render description when omitted', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText('Nothing here yet.')).toBeNull();
  });

  it('renders action button when actionLabel and onAction are provided', () => {
    const onAction = vi.fn();
    render(<EmptyState title="Empty" actionLabel="Create new" onAction={onAction} />);
    const btn = screen.getByText('Create new');
    expect(btn).toBeDefined();
  });

  it('calls onAction when button is clicked', () => {
    const onAction = vi.fn();
    render(<EmptyState title="Empty" actionLabel="Create new" onAction={onAction} />);
    fireEvent.click(screen.getByText('Create new'));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('uses fullPage class when fullPage=true', () => {
    const { container } = render(<EmptyState title="Empty" fullPage />);
    expect(container.innerHTML).toContain('min-h-[400px]');
  });

  it('renders custom icon', () => {
    render(<EmptyState title="Empty" icon={<span data-testid="custom-icon" />} />);
    expect(screen.getByTestId('custom-icon')).toBeDefined();
  });
});

describe('EmptyList', () => {
  it('renders default message', () => {
    render(<EmptyList />);
    expect(screen.getByText('No items found')).toBeDefined();
  });

  it('renders custom message', () => {
    render(<EmptyList message="No results" />);
    expect(screen.getByText('No results')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyList className="my-class" />);
    expect(container.innerHTML).toContain('my-class');
  });
});
