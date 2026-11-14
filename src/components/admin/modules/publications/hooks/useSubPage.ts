import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/** The address key for a form page inside a Publications tab (`?page=team-new`). */
export const SUB_PAGE_KEY = 'page';

/**
 * A long form inside a Publications tab (template, team member, career
 * listing) opens as a page of its own: `?page=<prefix>-new` or
 * `?page=<prefix>-<id>`. The module hides its header and tabs while a page is
 * open, so the form gets the whole content area (design system: long forms are
 * pages with "‹ Back to …").
 *
 * Returns the id named in the address for this prefix ('new' for a new
 * record, null when no page of this prefix is open) and a setter.
 */
export function useSubPage(prefix: string): [string | null, (id: string | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(SUB_PAGE_KEY);
  const value = raw && raw.startsWith(`${prefix}-`) ? raw.slice(prefix.length + 1) : null;

  const set = useCallback(
    (id: string | null) =>
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        if (id) params.set(SUB_PAGE_KEY, `${prefix}-${id}`);
        else params.delete(SUB_PAGE_KEY);
        return params;
      }),
    [prefix, setSearchParams],
  );

  return [value || null, set];
}
