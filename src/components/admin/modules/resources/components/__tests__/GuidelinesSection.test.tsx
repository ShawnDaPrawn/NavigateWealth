import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../brand-api', () => ({
  brandApi: {
    getGuidelines: vi.fn().mockResolvedValue({ guidelines: null, pdfUrl: null }),
    saveGuidelineRules: vi.fn().mockResolvedValue({}),
    saveVoiceGuidelines: vi.fn().mockResolvedValue({}),
    uploadGuidelinesPdf: vi.fn().mockResolvedValue({ url: null }),
    deleteGuidelinesPdf: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../CorporateIdentitySkeleton', () => ({
  SectionSkeleton: () => <div data-testid="section-skeleton" />,
}));

import { GuidelinesSection } from '../GuidelinesSection';

describe('GuidelinesSection', () => {
  it('renders without crashing', () => {
    const { container } = render(<GuidelinesSection onUpdate={vi.fn()} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders skeleton while loading', () => {
    render(<GuidelinesSection onUpdate={vi.fn()} />);
    expect(screen.getByTestId('section-skeleton')).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(<GuidelinesSection onUpdate={vi.fn()} />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
