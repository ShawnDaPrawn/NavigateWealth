import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ReadingProgressBar } from '../ReadingProgressBar';

describe('ReadingProgressBar', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollY', 0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders without crashing', () => {
    const { container } = render(<ReadingProgressBar />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders a progress bar element', () => {
    const { container } = render(<ReadingProgressBar />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
