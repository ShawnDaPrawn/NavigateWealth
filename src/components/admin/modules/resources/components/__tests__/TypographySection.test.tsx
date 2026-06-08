import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../brand-api', () => ({
  brandApi: {
    getTypography: vi.fn().mockResolvedValue(null),
    saveTypography: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../CorporateIdentitySkeleton', () => ({
  SectionSkeleton: () => <div data-testid="section-skeleton" />,
}));

import { TypographySection } from '../TypographySection';

describe('TypographySection', () => {
  it('renders without crashing', () => {
    const { container } = render(<TypographySection onUpdate={vi.fn()} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders skeleton while loading', () => {
    render(<TypographySection onUpdate={vi.fn()} />);
    expect(screen.getByTestId('section-skeleton')).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(<TypographySection onUpdate={vi.fn()} />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
