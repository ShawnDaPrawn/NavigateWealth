/**
 * NavigatorLinktreePage — the redesigned link-in-bio page at /links.
 *
 * A bare route, as live: no site header or footer, the page draws its own
 * logo, background and one-line footer. It keeps what the live page
 * (LinktreePage.tsx) does: the same SEO tags (noindex, nofollow); the links,
 * bio, custom title, avatar, social profiles and branding switch from the
 * same public route, every address kept as published (tracking parameters
 * included) after the same normalising; every link opening in a new tab; the
 * same click count posted for each link; and the same loading, unavailable
 * and empty states.
 * The layout is the "Links" board of the Website Redesign canvas. Beyond the
 * live page it adds the board's quick contact row (call, WhatsApp, email) from
 * the firm's own details. Neither request carries the anon key as a bearer:
 * both routes are public (see anon-key-bearer-ratchet.test.ts).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SEO } from '../../components/seo/SEO';
import {
  formatDisplayUrl,
  seoProps,
  SOCIAL_LABEL_MAP,
  type LinktreeLink,
  type LinktreeSettings,
} from '../../components/pages/linktree/linktreeData';
import { COMPANY } from '../../config/companyFacts';
import { projectId } from '../../utils/supabase/info';
import { normalizeNavigateWealthUrl } from '../../utils/siteOrigin';
import { LinksCard, LinksEmpty, type LinksItem, type LinksSocial } from '../sections/LinksCard';
import type { LinksIconName } from '../sections/LinksIcons';
import { LinksLoading, LinksUnavailable } from '../sections/LinksStates';
import '../styles/navigator.css';
import '../styles/links.css';

const LOGO_SRC = '/brand-assets/navigate-wealth-primary.svg';
const FALLBACK_BIO =
  'Independent financial advice, planning resources, and direct ways to connect.';

const SOCIAL_ICONS: Record<string, LinksIconName> = {
  instagram: 'instagram',
  linkedin: 'linkedin',
  facebook: 'facebook',
  twitter: 'x',
  email: 'mail',
};

/** The live page's choice of icon for a link, by its address. */
function linkIcon(url: string): LinksIconName {
  const lower = url.toLowerCase();
  if (lower.includes('instagram.com')) return 'instagram';
  if (lower.includes('linkedin.com')) return 'linkedin';
  if (lower.includes('facebook.com')) return 'facebook';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'x';
  if (lower.startsWith('mailto:')) return 'mail';
  if (lower.startsWith('tel:')) return 'phone';
  if (lower.includes('maps.google') || lower.includes('goo.gl/maps')) return 'mapPin';
  if (lower.includes('/contact') || lower.includes('consultation')) return 'calendar';
  if (lower.includes('/resources') || lower.includes('/blog')) return 'book';
  if (lower.includes('/services')) return 'file';
  return 'web';
}

export function NavigatorLinktreePage() {
  const [links, setLinks] = useState<LinktreeLink[]>([]);
  const [settings, setSettings] = useState<LinktreeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [clickedId, setClickedId] = useState<string | null>(null);

  const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/linktree`;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${BASE}/public`, {
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) throw new Error(`Linktree request failed: ${res.status}`);

        const data = await res.json();
        if (!data.success) throw new Error('Linktree response was unsuccessful');

        if (!cancelled) {
          setLinks(data.data.links || []);
          setSettings(data.data.settings);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [BASE]);

  const visibleLinks = useMemo<LinksItem[]>(
    () =>
      links
        .map((link) => ({ ...link, url: normalizeNavigateWealthUrl(link.url) }))
        .sort((a, b) => a.order - b.order)
        .map((link) => ({
          id: link.id,
          title: link.title,
          description: link.description,
          url: link.url,
          display: formatDisplayUrl(link.url),
          icon: linkIcon(link.url),
        })),
    [links],
  );

  const socialProfiles = useMemo<LinksSocial[]>(
    () =>
      Object.entries(settings?.socialProfiles || {})
        .filter(([, url]) => Boolean(url?.trim()))
        .map(([key, url]) => ({
          key,
          label: SOCIAL_LABEL_MAP[key] || key,
          url: normalizeNavigateWealthUrl(url),
          icon: SOCIAL_ICONS[key] || 'globe',
        })),
    [settings?.socialProfiles],
  );

  const pageTitle = settings?.title?.trim();
  const shouldShowPageTitle = Boolean(pageTitle && pageTitle.toLowerCase() !== 'navigate wealth');

  const handleClick = useCallback(
    (id: string) => {
      setClickedId(id);
      window.setTimeout(() => setClickedId(null), 500);

      fetch(`${BASE}/click/${id}`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    },
    [BASE],
  );

  const unavailable = !loading && (error || !settings);
  const customTitle = !loading && !unavailable && shouldShowPageTitle ? pageTitle : undefined;
  // One H1 in every state: the custom title or "Links unavailable" when the
  // page has one, otherwise the logo.
  const logoIsHeading = !unavailable && !customTitle;
  // The board signs every state; once the settings are in, the admin's
  // branding switch decides, as on the live page.
  const showBranding = settings ? settings.showBranding : true;

  const logo = (
    <img className="nwlk-logo" src={LOGO_SRC} alt="Navigate Wealth" width={1576} height={892} />
  );

  let body;
  if (loading) {
    body = <LinksLoading />;
  } else if (unavailable || !settings) {
    body = <LinksUnavailable />;
  } else if (visibleLinks.length === 0) {
    body = <LinksEmpty title={customTitle} socials={socialProfiles} />;
  } else {
    body = (
      <LinksCard
        title={customTitle}
        bio={settings.bio || FALLBACK_BIO}
        socials={socialProfiles}
        links={visibleLinks}
        clickedId={clickedId}
        onLinkClick={handleClick}
      />
    );
  }

  return (
    <div className="nw-site nwlk">
      <SEO {...seoProps} />
      <div className="nwlk-lines" aria-hidden="true" />
      <div className="nwlk-topbar" aria-hidden="true" />
      <svg
        className="nwlk-rose"
        aria-hidden="true"
        focusable="false"
        width="620"
        height="620"
        viewBox="0 0 480 480"
        fill="none"
      >
        <circle cx="240" cy="240" r="224" stroke="rgba(13, 22, 38, 0.072)" />
        <circle
          cx="240"
          cy="240"
          r="208"
          stroke="rgba(13, 22, 38, 0.06)"
          strokeWidth="8"
          strokeDasharray="1 17.15"
        />
        <circle cx="240" cy="240" r="150" stroke="rgba(49,54,83,0.08)" strokeDasharray="2 6" />
        <polygon
          points="240,112 258.4,221.6 368,240 258.4,258.4 240,368 221.6,258.4 112,240 221.6,221.6"
          stroke="rgba(13, 22, 38, 0.072)"
        />
      </svg>

      <main className="nwlk-main">
        <header className="nwlk-header">
          {logoIsHeading ? <h1 className="nwlk-logo-h">{logo}</h1> : logo}
          <div className="nwlk-bar" aria-hidden="true" />
          {!loading && settings?.avatarUrl ? (
            <img className="nwlk-avatar" src={settings.avatarUrl} alt="" />
          ) : null}
        </header>

        {body}

        {showBranding ? (
          <footer className="nwlk-foot">
            {COMPANY.legalName} | FSP {COMPANY.fspNumber} | FSCA Regulated
          </footer>
        ) : null}
      </main>
    </div>
  );
}

export default NavigatorLinktreePage;
