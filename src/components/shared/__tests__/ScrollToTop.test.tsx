import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const mockUseLocation = vi.fn(() => ({ pathname: '/' }));

vi.mock('react-router', () => ({
  useLocation: () => mockUseLocation(),
}));

import { ScrollToTop } from '../ScrollToTop';

describe('ScrollToTop', () => {
  it('renders nothing (returns null)', () => {
    const { container } = render(<ScrollToTop />);
    expect(container.firstChild).toBeNull();
  });

  it('calls window.scrollTo on mount', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<ScrollToTop />);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockRestore();
  });

  it('calls window.scrollTo again when pathname changes', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    mockUseLocation.mockReturnValue({ pathname: '/about' });
    const { rerender } = render(<ScrollToTop />);
    mockUseLocation.mockReturnValue({ pathname: '/contact' });
    rerender(<ScrollToTop />);
    expect(scrollTo).toHaveBeenCalledTimes(2);
    scrollTo.mockRestore();
  });
});
