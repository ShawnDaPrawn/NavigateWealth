import { createContext } from 'react';

/** One step after the module in the top-bar breadcrumb: a tab, a record or a sub-page. */
export interface Crumb {
  label: string;
  /** Makes the step a link back to that level (e.g. the tab from inside a record). */
  onClick?: () => void;
}

export interface BreadcrumbContextValue {
  trail: Crumb[];
  setTrail: (trail: Crumb[]) => void;
}

export const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);
