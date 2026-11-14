import { useBreadcrumbTrail } from '../../../layout/page';

import type { Crumb } from '../../../layout/page';

/**
 * Sets the top-bar breadcrumb for the screen it is rendered in. Rendered by
 * exactly one place per screen (the list, an editor page, the client page),
 * so two screens never fight over the trail.
 */
export function Crumbs({ trail }: { trail: Crumb[] }) {
  useBreadcrumbTrail(trail);
  return null;
}
