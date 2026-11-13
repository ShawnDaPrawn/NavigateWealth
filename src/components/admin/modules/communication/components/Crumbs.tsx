import { useBreadcrumbTrail } from '../../../layout/page';
import type { Crumb } from '../../../layout/page/breadcrumbContext';

/**
 * Sets the top-bar breadcrumb from wherever it is rendered. Each screen of
 * the Communication module renders one at its own level, so the open screen names
 * itself (a parent setting it as well would override its child).
 */
export function Crumbs({ trail }: { trail: Crumb[] }) {
  useBreadcrumbTrail(trail);
  return null;
}
