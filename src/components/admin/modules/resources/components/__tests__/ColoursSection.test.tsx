import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../brand-api', () => ({
  brandApi: {
    getColourPalette: vi.fn().mockResolvedValue(null),
    saveColourPalette: vi.fn().mockResolvedValue({}),
  },
  COLLATERAL_CATEGORIES: [],
}));

vi.mock('../corporateIdentityUtils', () => ({
  hexToRgb: vi.fn().mockReturnValue({ r: 0, g: 0, b: 0 }),
  getContrastRatio: vi.fn().mockReturnValue(4.5),
}));

vi.mock('../CorporateIdentitySkeleton', () => ({
  SectionSkeleton: () => <div data-testid="section-skeleton" />,
}));

import { ColoursSection } from '../ColoursSection';

describe('ColoursSection', () => {
  it('renders without crashing', () => {
    const { container } = render(<ColoursSection onUpdate={vi.fn()} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders skeleton while loading', () => {
    render(<ColoursSection onUpdate={vi.fn()} />);
    expect(screen.getByTestId('section-skeleton')).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(<ColoursSection onUpdate={vi.fn()} />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
