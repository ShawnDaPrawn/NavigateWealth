import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState, InlineError } from '../ErrorState';

describe('ErrorState', () => {
  it('renders the message', () => {
    render(<ErrorState message="Could not load articles." />);
    expect(screen.getByText('Could not load articles.')).toBeDefined();
  });

  it('renders default title', () => {
    render(<ErrorState message="Oops" />);
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('renders custom title', () => {
    render(<ErrorState title="Network Error" message="No connection." />);
    expect(screen.getByText('Network Error')).toBeDefined();
  });

  it('renders retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Failed" onRetry={onRetry} />);
    expect(screen.getByText('Try Again')).toBeDefined();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Failed" onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not render retry button when onRetry is absent', () => {
    render(<ErrorState message="Failed" />);
    expect(screen.queryByText('Try Again')).toBeNull();
  });

  it('applies fullPage container class when fullPage=true', () => {
    const { container } = render(<ErrorState message="Error" fullPage />);
    expect(container.innerHTML).toContain('min-h-[400px]');
  });
});

describe('InlineError', () => {
  it('renders the error message', () => {
    render(<InlineError message="Field is required." />);
    expect(screen.getByText('Field is required.')).toBeDefined();
  });
});
