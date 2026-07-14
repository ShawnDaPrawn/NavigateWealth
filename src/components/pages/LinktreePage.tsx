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
import navigateWealthLogo from 'figma:asset/8dc2892f50ecc4c5f692fd5ad52639699e2e4656.png';

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
  { surface: 'bg-[#C9A84C]/[0.14] border-[#C9A84C]/[0.28]', icon: 'text-[#E4C766]' },
  { surface: 'bg-[#78D6C6]/[0.12] border-[#78D6C6]/25', icon: 'text-[#78D6C6]' },
  { surface: 'bg-[#A9B7FF]/[0.12] border-[#A9B7FF]/25', icon: 'text-[#A9B7FF]' },
  { surface: 'bg-[#F2A65A]/[0.12] border-[#F2A65A]/25', icon: 'text-[#F2A65A]' },
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
          background: 'linear-gradient(145deg, #07111e 0%, #10233d 44%, #13261f 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-55"
        style={{
          backgroundImage:
            'linear-gradient(120deg, rgba(201,168,76,0.16) 0 1px, transparent 1px), linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px)',
          backgroundSize: '100% 128px, 30px 30px',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-[#C9A84C]/70" />
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
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07111e] px-6 text-white">
          <PageBackground />
          <div className="relative z-10 flex flex-col items-center text-center">
            <img
              src={navigateWealthLogo}
              alt="Navigate Wealth"
              className="mb-6 h-9 w-auto"
              style={{ imageRendering: 'auto' }}
            />
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.08]">
              <Loader2 className="h-5 w-5 animate-spin text-[#C9A84C]" />
            </div>
            <p className="text-sm text-white/[0.62]">Loading Navigate Wealth links</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !settings) {
    return (
      <>
        <SEO {...seoProps} />
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07111e] px-6 text-white">
          <PageBackground />
          <div className="relative z-10 flex max-w-sm flex-col items-center text-center">
            <img
              src={navigateWealthLogo}
              alt="Navigate Wealth"
              className="mb-7 h-9 w-auto"
              style={{ imageRendering: 'auto' }}
            />
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-[#C9A84C]/25 bg-[#C9A84C]/[0.12]">
              <LinkIcon className="h-5 w-5 text-[#E4C766]" />
            </div>
            <h1 className="text-2xl font-semibold text-white">Links unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-white/[0.64]">
              This page is currently unavailable. The main Navigate Wealth website is still
              available.
            </p>
            <a
              href={SITE_ORIGIN}
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/[0.14] bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[#C9A84C]/[0.45] hover:bg-white/[0.12]"
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
      <div className="relative min-h-screen overflow-hidden bg-[#07111e] text-white">
        <PageBackground />

        <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <img
              src={navigateWealthLogo}
              alt="Navigate Wealth"
              className="h-8 w-auto sm:h-9"
              style={{ imageRendering: 'auto' }}
            />
            <a
              href={SITE_ORIGIN}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-2 text-sm font-medium text-white/[0.72] transition hover:border-[#C9A84C]/40 hover:text-white sm:inline-flex"
            >
              www.navigatewealth.co
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </header>

          <section className="grid flex-1 items-start gap-8 pb-10 pt-12 sm:pt-16 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14 lg:pt-24">
            <div className="max-w-xl">
              {settings.avatarUrl && (
                <img
                  src={settings.avatarUrl}
                  alt={settings.title}
                  className="mb-5 h-16 w-16 rounded-lg border border-white/[0.12] object-cover shadow-[0_16px_34px_rgba(0,0,0,0.22)]"
                />
              )}
              <p className="text-sm font-semibold text-[#E4C766]">Official links</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl">
                {settings.title || 'Navigate Wealth'}
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-white/[0.68]">
                {settings.bio ||
                  'Independent financial advice, planning resources, and direct ways to connect.'}
              </p>

              <div className="mt-7 flex flex-wrap gap-2 text-xs font-medium text-white/[0.72]">
                <span className="inline-flex items-center gap-2 rounded-lg border border-[#C9A84C]/[0.24] bg-[#C9A84C]/10 px-3 py-2">
                  <Shield className="h-4 w-4 text-[#E4C766]" />
                  FSCA Regulated
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-2">
                  <Globe className="h-4 w-4 text-[#78D6C6]" />
                  FSP 54606
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-2">
                  <ExternalLink className="h-4 w-4 text-[#A9B7FF]" />
                  South Africa
                </span>
              </div>

              {socialProfiles.length > 0 && (
                <div className="mt-7 flex items-center gap-2">
                  {socialProfiles.map(({ key, label, url, Icon }) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      title={label}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.07] text-white/[0.66] transition hover:border-[#C9A84C]/40 hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full max-w-xl lg:ml-auto">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white/[0.82]">Featured links</p>
                <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-white/[0.52]">
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
                        className={`group flex min-h-[82px] w-full items-center gap-4 rounded-lg border border-white/[0.12] bg-white/[0.075] px-4 py-4 text-left shadow-[0_16px_36px_rgba(0,0,0,0.24)] outline-none transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.24] hover:bg-white/[0.11] focus-visible:ring-2 focus-visible:ring-[#C9A84C] ${
                          isClicked ? 'border-[#C9A84C]/50 bg-white/[0.13]' : ''
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border ${accent.surface}`}
                        >
                          <Icon className={`h-5 w-5 ${accent.icon}`} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold text-white">
                            {link.title}
                          </span>
                          {link.description && (
                            <span className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-white/[0.58]">
                              {link.description}
                            </span>
                          )}
                          <span className="mt-1.5 block overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-[#E4C766]/[0.85]">
                            {formatDisplayUrl(link.url)}
                          </span>
                        </span>

                        <span className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.05] text-white/[0.48] transition group-hover:border-[#C9A84C]/35 group-hover:text-[#E4C766] sm:flex">
                          <ArrowUpRight className="h-4 w-4" />
                        </span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-white/[0.12] bg-white/[0.07] px-5 py-12 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.06]">
                    <LinkIcon className="h-5 w-5 text-white/[0.48]" />
                  </div>
                  <p className="text-sm font-medium text-white/[0.78]">No links available yet.</p>
                  <p className="mt-1 text-sm text-white/[0.48]">Check back soon.</p>
                </div>
              )}
            </div>
          </section>

          {settings.showBranding && (
            <footer className="pb-2 text-xs leading-5 text-white/[0.44]">
              Wealthfront (Pty) Ltd t/a Navigate Wealth | FSP 54606 | FSCA Regulated
            </footer>
          )}
        </main>
      </div>
    </>
  );
}

export default LinktreePage;
