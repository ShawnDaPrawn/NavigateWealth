/**
 * The public website's design switch.
 *
 * 'navigator' — the redesign (src/site/). The default since launch.
 * 'legacy'    — the site as it was before the redesign.
 *
 * Chosen at build time by VITE_SITE_DESIGN. Unset (the normal case, including
 * production) means 'navigator'. Only an explicit 'legacy' brings the old
 * design back: set VITE_SITE_DESIGN=legacy on the Vercel environment and
 * redeploy, or use Vercel's instant rollback to the last pre-launch
 * deployment. Any other value is treated as unset, so a typo cannot quietly
 * switch the live site back.
 *
 * Only logged-out public pages read this. The client portal and the admin
 * render the same either way.
 */
export type SiteDesign = 'legacy' | 'navigator';

export function resolveSiteDesign(value: unknown): SiteDesign {
  return typeof value === 'string' && value.trim().toLowerCase() === 'legacy'
    ? 'legacy'
    : 'navigator';
}

export const SITE_DESIGN: SiteDesign = resolveSiteDesign(import.meta.env.VITE_SITE_DESIGN);
