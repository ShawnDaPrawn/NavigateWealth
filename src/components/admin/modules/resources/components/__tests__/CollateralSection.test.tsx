import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../brand-api', () => ({
  brandApi: {
    getCollateral: vi.fn().mockResolvedValue([]),
    uploadCollateral: vi.fn().mockResolvedValue({}),
    deleteCollateral: vi.fn().mockResolvedValue({}),
  },
  COLLATERAL_CATEGORIES: [{ value: 'brochures', label: 'Brochures' }],
}));

vi.mock('../CorporateIdentitySkeleton', () => ({
  SectionSkeleton: () => <div data-testid="section-skeleton" />,
}));

import { CollateralSection } from '../CollateralSection';

describe('CollateralSection', () => {
  it('renders without crashing', () => {
    const { container } = render(<CollateralSection onUpdate={vi.fn()} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders skeleton while loading', () => {
    render(<CollateralSection onUpdate={vi.fn()} />);
    expect(screen.getByTestId('section-skeleton')).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(<CollateralSection onUpdate={vi.fn()} />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
