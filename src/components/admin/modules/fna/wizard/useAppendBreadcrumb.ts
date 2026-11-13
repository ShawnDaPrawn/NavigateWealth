import { useContext, useEffect, useRef } from 'react';
import { BreadcrumbContext, type Crumb } from '../../../layout/page';

/**
 * Adds steps to the END of the breadcrumb the client page already shows
 * ("Clients / Elsa van Wyk / Policies / Risk planning") while an FNA or will
 * page is open, and puts the client page's own trail back when it closes.
 * The FNA pages live inside Client Management, which owns the start of the
 * trail, so they extend it instead of replacing it.
 */
export function useAppendBreadcrumb(steps: Crumb[], enabled = true) {
  const context = useContext(BreadcrumbContext);
  const setTrail = context?.setTrail;
  const base = useRef<Crumb[] | null>(null);
  if (base.current === null && context) base.current = context.trail;
  const key = steps.map((c) => c.label).join('\u0000');
  const latest = useRef(steps);
  latest.current = steps;

  useEffect(() => {
    if (!setTrail || !enabled) return;
    setTrail([...(base.current ?? []), ...latest.current]);
  }, [setTrail, key, enabled]);

  useEffect(() => {
    if (!setTrail) return;
    return () => setTrail(base.current ?? []);
  }, [setTrail]);
}
