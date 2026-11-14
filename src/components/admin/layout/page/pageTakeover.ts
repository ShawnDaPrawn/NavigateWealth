import { createContext, useContext, useEffect } from 'react';

/**
 * How much of a record page a descendant takes over while it is open:
 * - 'page': the whole record area (FNA wizards, a published FNA report, will
 *   wizards). The record header, its tabs and any rails hide.
 * - 'section': the tab's content area. Rails inside the tab hide; the record
 *   header and tabs stay (e.g. the add / edit policy page).
 */
export type TakeoverLevel = 'page' | 'section';

export interface PageTakeoverValue {
  /** Starts a takeover; returns the function that ends it. */
  acquire: (level: TakeoverLevel) => () => void;
  /** The widest takeover currently open, or null. */
  active: TakeoverLevel | null;
}

export const PageTakeoverContext = createContext<PageTakeoverValue | null>(null);

/** Asks the enclosing record page to make room while `open` is true. No-op outside one. */
export function usePageTakeover(open: boolean, level: TakeoverLevel = 'page') {
  const context = useContext(PageTakeoverContext);
  const acquire = context?.acquire;
  useEffect(() => {
    if (!open || !acquire) return;
    return acquire(level);
  }, [open, level, acquire]);
}

/** The takeover currently open on the enclosing record page, if any. */
export function usePageTakeoverActive(): TakeoverLevel | null {
  return useContext(PageTakeoverContext)?.active ?? null;
}
