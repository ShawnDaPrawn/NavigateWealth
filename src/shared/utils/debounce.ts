/**
 * Delay calling `func` until `wait` ms have passed without another call.
 * Each call restarts the timer; only the last call's arguments are used.
 *
 * @example
 * const debouncedSearch = debounce((query: string) => searchArticles(query), 300);
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  };
}
