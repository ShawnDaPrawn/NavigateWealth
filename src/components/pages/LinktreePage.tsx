/**
 * Public link-in-bio page for /links.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  ExternalLink,
  Facebook,
  FileText,
  Globe,
  Instagram,
  Link as LinkIcon,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Shield,
  Twitter,
  Youtube,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { normalizeNavigateWealthUrl, SITE_ORIGIN } from '../../utils/siteOrigin';
import { SEO } from '../seo/SEO';
import navigateWealthLogo from '/brand-assets/navigate-wealth-logo-black-purple.png';

interface LinktreeLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  enabled: boolean;
  order: number;
  clicks: number;
}

interface LinktreeSettings {
  title: string;
  bio: string;
  avatarUrl?: string;
  theme: 'navy' | 'gold' | 'light' | 'dark';
  showBranding: boolean;
  socialProfiles?: Record<string, string>;
}

const seoProps = {
  title: 'Navigate Wealth Links',
  description: 'Official Navigate Wealth links, resources, services, and contact details.',
  canonicalUrl: `${SITE_ORIGIN}/links`,
  robotsContent: 'noindex, nofollow',
};

const LINK_ACCENTS = [
  { surface: 'bg-[#6d28d9]/10 border-[#6d28d9]/20', icon: 'text-[#6d28d9]' },
  { surface: 'bg-[#313653]/[0.08] border-[#313653]/15', icon: 'text-[#313653]' },
  { surface: 'bg-[#7c3aed]/10 border-[#7c3aed]/20', icon: 'text-[#7c3aed]' },
  { surface: 'bg-[#5b21b6]/10 border-[#5b21b6]/20', icon: 'text-[#5b21b6]' },
];

const SOCIAL_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  linkedin: Linkedin,
  facebook: Facebook,
  youtube: Youtube,
  twitter: Twitter,
  email: Mail,
};

const SOCIAL_LABEL_MAP: Record<string, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  youtube: 'YouTube',
  twitter: 'X',
  email: 'Email',
};

function getLinkIcon(url: string): React.ComponentType<{ className?: string }> {
  const lower = url.toLowerCase();
  if (lower.includes('instagram.com')) return Instagram;
  if (lower.includes('linkedin.com')) return Linkedin;
  if (lower.includes('youtube.com')) return Youtube;
  if (lower.includes('facebook.com')) return Facebook;
  if (lower.includes('twitter.com') || lower.includes('x.com')) return Twitter;
  if (lower.startsWith('mailto:')) return Mail;
  if (lower.startsWith('tel:')) return Phone;
  if (lower.includes('maps.google') || lower.includes('goo.gl/maps')) return MapPin;
  if (lower.includes('/contact') || lower.includes('consultation')) return CalendarCheck;
  if (lower.includes('/resources') || lower.includes('/blog')) return BookOpen;
  if (lower.includes('/services')) return FileText;
  return ExternalLink;
}

function formatDisplayUrl(url: string): string {
  if (url.startsWith('mailto:')) return url.replace(/^mailto:/, '');
  if (url.startsWith('tel:')) return url.replace(/^tel:/, '');

  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.hostname}${path}`;
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
}

function PageBackground() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #f8f7fc 0%, #ffffff 42%, #f4f1fb 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            'linear-gradient(120deg, rgba(109,40,217,0.08) 0 1px, transparent 1px), linear-gradient(0deg, rgba(49,54,83,0.05) 0 1px, transparent 1px)',
          backgroundSize: '100% 136px, 32px 32px',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#6d28d9] via-[#7c3aed] to-[#313653]" />
    </>
  );
}

export function LinktreePage() {
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
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
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

  const visibleLinks = useMemo(
    () =>
      links
        .map((link) => ({ ...link, url: normalizeNavigateWealthUrl(link.url) }))
        .sort((a, b) => a.order - b.order),
    [links],
  );

  const socialProfiles = useMemo(
    () =>
      Object.entries(settings?.socialProfiles || {})
        .filter(([, url]) => Boolean(url?.trim()))
        .map(([key, url]) => ({
          key,
          label: SOCIAL_LABEL_MAP[key] || key,
          url: normalizeNavigateWealthUrl(url),
          Icon: SOCIAL_ICON_MAP[key] || Globe,
        })),
    [settings?.socialProfiles],
  );

  const pageTitle = settings?.title?.trim();
  const shouldShowPageTitle = Boolean(pageTitle && pageTitle.toLowerCase() !== 'navigate wealth');

  const handleClick = useCallback(
    (link: LinktreeLink) => {
      setClickedId(link.id);
      window.setTimeout(() => setClickedId(null), 500);

      fetch(`${BASE}/click/${link.id}`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
      }).catch(() => {});
    },
    [BASE],
  );

  if (loading) {
    return (
      <>
        <SEO {...seoProps} />
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8f7fc] px-6 text-[#313653]">
          <PageBackground />
          <div className="relative z-10 flex flex-col items-center text-center">
            <img
              src={navigateWealthLogo}
              alt="Navigate Wealth"
              className="mb-6 h-auto w-[260px] max-w-[78vw]"
              style={{ imageRendering: 'auto' }}
            />
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[#6d28d9]/15 bg-white shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin text-[#6d28d9]" />
            </div>
            <p className="text-sm text-[#313653]/70">Loading links</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !settings) {
    return (
      <>
        <SEO {...seoProps} />
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8f7fc] px-6 text-[#313653]">
          <PageBackground />
          <div className="relative z-10 flex max-w-sm flex-col items-center text-center">
            <img
              src={navigateWealthLogo}
              alt="Navigate Wealth"
              className="mb-7 h-auto w-[260px] max-w-[78vw]"
              style={{ imageRendering: 'auto' }}
            />
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-[#6d28d9]/15 bg-white shadow-sm">
              <LinkIcon className="h-5 w-5 text-[#6d28d9]" />
            </div>
            <h1 className="text-2xl font-semibold text-[#111827]">Links unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-[#4b5563]">
              This page is currently unavailable. The main Navigate Wealth website is still
              available.
            </p>
            <a
              href={SITE_ORIGIN}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-purple-200 transition hover:bg-[#5b21b6]"
            >
              Visit website
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO {...seoProps} />
      <div className="relative min-h-screen overflow-hidden bg-[#f8f7fc] text-[#313653]">
        <PageBackground />

        <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[640px] flex-col px-5 py-7 sm:px-8 sm:py-9">
          <header className="flex flex-col items-center text-center">
            <img
              src={navigateWealthLogo}
              alt="Navigate Wealth"
              className="h-auto w-[300px] max-w-[82vw] sm:w-[340px]"
              style={{ imageRendering: 'auto' }}
            />
            <div className="mt-5 h-1 w-16 rounded-full bg-gradient-to-r from-[#6d28d9] to-[#7c3aed]" />
            {settings.avatarUrl && (
              <img
                src={settings.avatarUrl}
                alt=""
                className="mt-6 h-14 w-14 rounded-lg border border-[#6d28d9]/10 object-cover shadow-sm"
              />
            )}
          </header>

          <section className="flex-1 pb-9 pt-7 sm:pt-9">
            <div className="rounded-lg border border-[#e5e7eb] bg-white/95 p-5 shadow-[0_24px_60px_rgba(49,54,83,0.10)] sm:p-7">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6d28d9]">
                  Official links
                </p>
                {shouldShowPageTitle && (
                  <h1 className="mt-3 text-2xl font-semibold leading-tight text-[#111827]">
                    {pageTitle}
                  </h1>
                )}
                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#4b5563] sm:text-base sm:leading-7">
                  {settings.bio ||
                    'Independent financial advice, planning resources, and direct ways to connect.'}
                </p>

                <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-medium text-[#4b5563]">
                  <span className="inline-flex items-center gap-2 rounded-lg border border-[#6d28d9]/15 bg-[#6d28d9]/5 px-3 py-2">
                    <Shield className="h-4 w-4 text-[#6d28d9]" />
                    FSCA Regulated
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2">
                    <Globe className="h-4 w-4 text-[#313653]" />
                    FSP 54606
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2">
                    <ExternalLink className="h-4 w-4 text-[#313653]" />
                    South Africa
                  </span>
                </div>

                {socialProfiles.length > 0 && (
                  <div className="mt-5 flex items-center justify-center gap-2">
                    {socialProfiles.map(({ key, label, url, Icon }) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        title={label}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6b7280] transition hover:border-[#6d28d9]/30 hover:bg-[#6d28d9]/5 hover:text-[#6d28d9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d28d9]"
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="my-6 h-px bg-gradient-to-r from-transparent via-[#e5e7eb] to-transparent" />

              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#111827]">Links</p>
                <span className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-1 text-xs text-[#6b7280]">
                  {visibleLinks.length} destinations
                </span>
              </div>

              {visibleLinks.length > 0 ? (
                <div className="space-y-3">
                  {visibleLinks.map((link, index) => {
                    const Icon = getLinkIcon(link.url);
                    const accent = LINK_ACCENTS[index % LINK_ACCENTS.length];
                    const isClicked = clickedId === link.id;

                    return (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleClick(link)}
                        className={`group flex min-h-[82px] w-full items-center gap-4 rounded-lg border border-[#e5e7eb] bg-white px-4 py-4 text-left shadow-sm outline-none transition duration-200 hover:-translate-y-0.5 hover:border-[#6d28d9]/30 hover:bg-[#fbfaff] hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#6d28d9] ${
                          isClicked ? 'border-[#6d28d9]/50 bg-[#f5f3ff]' : ''
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border ${accent.surface}`}
                        >
                          <Icon className={`h-5 w-5 ${accent.icon}`} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold text-[#111827]">
                            {link.title}
                          </span>
                          {link.description && (
                            <span className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#6b7280]">
                              {link.description}
                            </span>
                          )}
                          <span className="mt-1.5 block overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-[#6d28d9]">
                            {formatDisplayUrl(link.url)}
                          </span>
                        </span>

                        <span className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-[#e5e7eb] bg-[#f9fafb] text-[#9ca3af] transition group-hover:border-[#6d28d9]/25 group-hover:text-[#6d28d9] sm:flex">
                          <ArrowUpRight className="h-4 w-4" />
                        </span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-5 py-12 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white">
                    <LinkIcon className="h-5 w-5 text-[#9ca3af]" />
                  </div>
                  <p className="text-sm font-medium text-[#4b5563]">No links available yet.</p>
                  <p className="mt-1 text-sm text-[#6b7280]">Check back soon.</p>
                </div>
              )}
            </div>
          </section>

          {settings.showBranding && (
            <footer className="pb-2 text-center text-xs leading-5 text-[#6b7280]">
              Wealthfront (Pty) Ltd | FSP 54606 | FSCA Regulated
            </footer>
          )}
        </main>
      </div>
    </>
  );
}

export default LinktreePage;
