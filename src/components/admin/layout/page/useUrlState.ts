import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * One piece of page state kept in the address bar, so reload, Back and a
 * pasted link land where you were (design system: "The address bar").
 *
 * Values outside `allowed` fall back to `fallback`; the fallback itself is
 * left out of the URL to keep addresses short. Other parameters, including
 * `module`, are preserved. Changes replace the history entry so switching
 * tabs does not fill the Back button.
 */
export function useUrlState<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): [T, (next: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(key);
  const value =
    raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;

  const setValue = useCallback(
    (next: T) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next === fallback) params.delete(key);
          else params.set(key, next);
          return params;
        },
        { replace: true },
      );
    },
    [key, fallback, setSearchParams],
  );

  return [value, setValue];
}
