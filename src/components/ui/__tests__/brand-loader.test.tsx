import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  BrandInlineLoader,
  BrandLoaderPanel,
  BrandPageLoader,
  BrandSectionLoader,
  SLOW_AFTER_MS,
  SLOW_MESSAGE,
} from '../brand-loader';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BrandPageLoader', () => {
  it('announces itself and shows the default title, message and FSP line', () => {
    render(<BrandPageLoader />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Plotting your course');
    expect(status.textContent).toContain('Bringing the next page into view.');
    expect(screen.getByText('FSP 54606')).toBeTruthy();
  });

  it('shows the caller’s title and message', () => {
    render(<BrandPageLoader title="Loading your profile" message="Fetching your details." />);
    expect(screen.getByText('Loading your profile')).toBeTruthy();
    expect(screen.getByText('Fetching your details.')).toBeTruthy();
  });
});

describe('slow-load message', () => {
  it('swaps the message for the slow-load one after SLOW_AFTER_MS', () => {
    vi.useFakeTimers();
    render(<BrandLoaderPanel message="Fetching your details." />);
    const first = screen.getByText('Fetching your details.');
    const slow = screen.getByText(SLOW_MESSAGE);
    expect(first.getAttribute('aria-hidden')).toBe('false');
    expect(slow.getAttribute('aria-hidden')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(SLOW_AFTER_MS - 1);
    });
    expect(slow.getAttribute('aria-hidden')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(first.getAttribute('aria-hidden')).toBe('true');
    expect(slow.getAttribute('aria-hidden')).toBe('false');
    expect(first.parentElement?.classList.contains('is-slow')).toBe(true);
  });

  it('stops its timer when it unmounts', () => {
    vi.useFakeTimers();
    const { unmount } = render(<BrandLoaderPanel />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves the message out entirely when the caller passes an empty one', () => {
    render(<BrandLoaderPanel message="" />);
    expect(screen.queryByText(SLOW_MESSAGE)).toBeNull();
  });
});

describe('heading tape', () => {
  it('labels the full tape with cardinals and three-digit bearings', () => {
    const { container } = render(<BrandLoaderPanel />);
    const labels = Array.from(container.querySelectorAll('.nwl-strip text')).map(
      (t) => t.textContent,
    );
    expect(labels).toEqual(expect.arrayContaining(['N', 'E', 'S', 'W', '030', '120', '330']));
    expect(container.querySelectorAll('.nwl-strip text.nwl-cardinal').length).toBeGreaterThan(0);
  });

  it('draws the mini tape without labels', () => {
    const { container } = render(<BrandInlineLoader label="Loading documents..." />);
    expect(container.querySelector('.nwl-tape-mini')).not.toBeNull();
    expect(container.querySelectorAll('.nwl-strip text')).toHaveLength(0);
  });
});

describe('sail mark', () => {
  it('gives every instance its own gradient ids', () => {
    const { container } = render(
      <>
        <BrandLoaderPanel />
        <BrandSectionLoader />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('.nwl-mark [id]')).map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it('draws smaller in a section than on a page', () => {
    const { container } = render(
      <>
        <BrandPageLoader />
        <BrandSectionLoader />
      </>,
    );
    const heights = Array.from(container.querySelectorAll('svg.nwl-mark')).map((svg) =>
      Number(svg.getAttribute('height')),
    );
    expect(heights).toEqual([92, 52]);
  });
});

describe('BrandSectionLoader', () => {
  it('lets the caller override its padding', () => {
    const { container } = render(<BrandSectionLoader containerClassName="py-4" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.classList.contains('py-4')).toBe(true);
    expect(wrapper.classList.contains('py-12')).toBe(false);
  });
});

describe('BrandInlineLoader', () => {
  it('renders as spans so it can sit inside a paragraph', () => {
    const { container } = render(
      <p>
        <BrandInlineLoader label="Loading messages..." />
      </p>,
    );
    expect(screen.getByRole('status').textContent).toContain('Loading messages...');
    expect(container.querySelector('p div')).toBeNull();
  });
});
