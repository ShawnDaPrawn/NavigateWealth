import { createContext, useContext, useEffect } from 'react';
import type { Crumb } from '../../../layout/page';

/**
 * Lets a tab of the client page add its own steps after the tab label
 * (e.g. Personal details / Address). The client page owns the trail.
 */
export const ClientSubCrumbContext = createContext<((steps: Crumb[]) => void) | null>(null);

/** Called by a client-page tab with the section or sub-page it shows. */
export function useClientSubCrumbs(steps: Crumb[]) {
  const setSteps = useContext(ClientSubCrumbContext);
  const key = steps.map((s) => s.label).join('\u0000');
  useEffect(() => {
    setSteps?.(steps);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on labels
  }, [setSteps, key]);
  useEffect(() => {
    if (!setSteps) return;
    return () => setSteps([]);
  }, [setSteps]);
}
