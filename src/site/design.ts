/**
 * The public website's design switch.
 *
 * 'legacy'    — the site as it was before the Navigator redesign.
 * 'navigator' — the redesign (src/site/).
 *
 * Chosen at build time by VITE_SITE_DESIGN, set per Vercel environment. Unset
 * or any other value means 'legacy', so production keeps the current site
 * until someone deliberately sets 'navigator'. Reverting after launch is the
 * same move in reverse: set it back (or remove it) and redeploy; Vercel's
 * instant rollback to the previous deployment works too.
 *
 * Only logged-out public pages read this. The client portal and the admin
 * render the same either way.
 */
export type SiteDesign = 'legacy' | 'navigator';

export function resolveSiteDesign(value: unknown): SiteDesign {
  return typeof value === 'string' && value.trim().toLowerCase() === 'navigator'
    ? 'navigator'
    : 'legacy';
}

export const SITE_DESIGN: SiteDesign = resolveSiteDesign(import.meta.env.VITE_SITE_DESIGN);
