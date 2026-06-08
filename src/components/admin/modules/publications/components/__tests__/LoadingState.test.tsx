import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingState, LoadingSpinner, SkeletonLoader } from '../LoadingState';

describe('LoadingState', () => {
  it('renders default loading message', () => {
    render(<LoadingState />);
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('renders custom message', () => {
    render(<LoadingState message="Fetching articles..." />);
    expect(screen.getByText('Fetching articles...')).toBeDefined();
  });

  it('applies fullPage container class when fullPage=true', () => {
    const { container } = render(<LoadingState fullPage />);
    expect(container.innerHTML).toContain('min-h-[400px]');
  });

  it('accepts size prop without crashing', () => {
    const { container } = render(<LoadingState size="lg" />);
    expect(container.firstChild).toBeDefined();
  });
});

describe('LoadingSpinner', () => {
  it('renders without crashing', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toBeDefined();
  });

  it('accepts size md without crashing', () => {
    const { container } = render(<LoadingSpinner size="md" />);
    expect(container.firstChild).toBeDefined();
  });
});

describe('SkeletonLoader', () => {
  it('renders default skeleton rows', () => {
    const { container } = render(<SkeletonLoader />);
    // Default count = 3, each row has two skeleton divs
    const rows = container.querySelectorAll('.animate-pulse');
    expect(rows.length).toBe(3);
  });

  it('renders custom count rows', () => {
    const { container } = render(<SkeletonLoader count={5} />);
    const rows = container.querySelectorAll('.animate-pulse');
    expect(rows.length).toBe(5);
  });

  it('applies custom className to skeleton rows', () => {
    const { container } = render(<SkeletonLoader className="test-skeleton" />);
    expect(container.innerHTML).toContain('test-skeleton');
  });
});
