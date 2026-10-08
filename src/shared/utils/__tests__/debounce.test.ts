/**
 * The shared debounce used by article search and the document library.
 *
 * A burst of keystrokes must become one call, and that call must see the
 * last query. Firing the first query, or firing once per keystroke, searches
 * for text the visitor has already replaced.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { debounce } from '../debounce';

afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  it('waits out the quiet period and calls with the last arguments only', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('a');
    vi.advanceTimersByTime(299);
    debounced('ab');
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('ab');
  });

  it('fires again for a later burst once the first one has settled', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('first');
    vi.advanceTimersByTime(300);
    debounced('second');
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenNthCalledWith(1, 'first');
    expect(fn).toHaveBeenNthCalledWith(2, 'second');
  });
});
