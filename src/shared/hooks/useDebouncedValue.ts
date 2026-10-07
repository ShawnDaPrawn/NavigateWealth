import { useEffect, useState } from 'react';

/**
 * `value`, but only once it has stopped changing for `delayMs`.
 *
 * For search boxes and filters that should not fire a request on every
 * keystroke: the returned value lags the input and settles `delayMs` after
 * the last change.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
