/**
 * The public website's design switch.
 *
 * 'legacy'    — the site as it was before the Navigator redesign.
 * 'navigator' — the redesign (src/site/).
 *
 * Chosen at build time by VITE_SITE_DESIGN, set per Vercel environment. Since
 * the November 2026 launch the redesign is the default: unset, empty or any
 * value other than 'legacy' builds the Navigator site. To revert the public
 * site, set VITE_SITE_DESIGN=legacy for the environment and redeploy (or use
 * Vercel's instant rollback to the last pre-launch deployment). The code for
 * the old site also lives on the `legacy-website-2026-11` branch and the
 * `legacy-website-final` branch. docs/runbooks/site-design.md has the steps.
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
