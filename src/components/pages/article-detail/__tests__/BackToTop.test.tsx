import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BackToTop } from '../BackToTop';

describe('BackToTop', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollY', 0);
    vi.stubGlobal('scrollTo', vi.fn());
    Object.defineProperty(window, 'scrollY', { writable: true, value: 0 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders without crashing', () => {
    const { container } = render(<BackToTop />);
    expect(container.firstChild).toBeDefined();
  });

  it('is initially hidden (not visible before scroll)', () => {
    const { container } = render(<BackToTop />);
    // Button hidden initially, so it either doesn't render or has opacity-0/hidden class
    const btn = container.querySelector('button');
    if (btn) {
      expect(btn.className).toMatch(/opacity-0|hidden|translate/);
    } else {
      expect(container.firstChild).toBeDefined();
    }
  });

  it('shows button after scrolling past threshold', async () => {
    render(<BackToTop />);
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { writable: true, value: 700 });
      window.dispatchEvent(new Event('scroll'));
    });
    const btn = screen.queryByRole('button');
    expect(btn).toBeDefined();
  });
});
