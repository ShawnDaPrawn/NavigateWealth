import { useBreadcrumbTrail } from '../../../layout/page';

type Crumb = Parameters<typeof useBreadcrumbTrail>[0][number];

/**
 * Sets the top-bar breadcrumb steps after the module name. Render exactly one
 * per screen (inside the tab or page that is showing), so the trail always
 * belongs to what is on screen.
 */
export function BreadcrumbTrail({ trail }: { trail: Crumb[] }) {
  useBreadcrumbTrail(trail);
  return null;
}
