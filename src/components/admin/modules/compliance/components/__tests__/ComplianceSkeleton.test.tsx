import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComplianceSkeleton } from '../ComplianceSkeleton';

describe('ComplianceSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<ComplianceSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('has role=status for accessibility', () => {
    render(<ComplianceSkeleton />);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('has accessible label for screen readers', () => {
    render(<ComplianceSkeleton />);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Loading compliance');
  });

  it('renders sr-only loading text', () => {
    render(<ComplianceSkeleton />);
    expect(screen.getByText(/loading compliance module/i)).toBeDefined();
  });
});
