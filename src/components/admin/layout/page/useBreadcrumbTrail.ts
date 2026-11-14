import { useContext, useEffect, useRef } from 'react';
import { BreadcrumbContext, type Crumb } from './breadcrumbContext';

/**
 * Sets the steps after the module in the top-bar breadcrumb, e.g.
 * `useBreadcrumbTrail([{ label: 'Integrations', onClick: backToList }, { label: 'Allan Gray' }])`
 * gives "Advice / Product Management / Integrations / Allan Gray". The deepest
 * mounted caller wins; the trail clears when it unmounts.
 */
export function useBreadcrumbTrail(trail: Crumb[]) {
  const context = useContext(BreadcrumbContext);
  const setTrail = context?.setTrail;
  const key = trail.map((c) => c.label).join('\u0000');
  const latest = useRef(trail);
  latest.current = trail;

  useEffect(() => {
    if (!setTrail) return;
    setTrail(latest.current);
  }, [setTrail, key]);

  useEffect(() => {
    if (!setTrail) return;
    return () => setTrail([]);
  }, [setTrail]);
}
