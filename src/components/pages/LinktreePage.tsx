/**
 * Public Linktree Page — /links
 *
 * A standalone link-in-bio page styled to match the Navigate Wealth platform
 * design language:
 *   - Deep navy layered gradients with radial glows & dot-grid pattern
 *   - Official logo & branding
 *   - Glassmorphism link cards
 *   - Purple accent system consistent with homepage hero
 *
 * No app chrome (no nav, no footer). Accessible from social media profiles.
 * Tracks clicks back to the server for analytics.
 *
 * @module pages/LinktreePage
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ExternalLink,
  Loader2,
  Shield,
  Globe,
  ArrowUpRight,
  Link as LinkIcon,
  Instagram,
  Linkedin,
  Youtube,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { SEO } from '../seo/SEO';
import navigateWealthLogo from 'figma:asset/8dc2892f50ecc4c5f692fd5ad52639699e2e4656.png';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Constants
// ============================================================================

const BRAND = {
  navy: '#1B2A4A',
  gold: '#C9A84C',
  heroBg: '#1a1e36',
  heroMid: '#252a47',
} as const;

/** Map common URL patterns to icons for visual interest */
function getLinkIcon(url: string): React.ComponentType<{ className?: string }> {
  const lower = url.toLowerCase();
  if (lower.includes('instagram.com')) return Instagram;
  if (lower.includes('linkedin.com')) return Linkedin;
  if (lower.includes('youtube.com')) return Youtube;
  if (lower.includes('facebook.com')) return Facebook;
  if (lower.includes('twitter.com') || lower.includes('x.com')) return Twitter;
  if (lower.includes('mailto:')) return Mail;
  if (lower.includes('tel:')) return Phone;
  if (lower.includes('maps.google') || lower.includes('goo.gl/maps')) return MapPin;
  return ExternalLink;
}

/** Social profile icon lookup */
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
  twitter: 'X (Twitter)',
  email: 'Email',
};

// ============================================================================
// Component
// ============================================================================

export function LinktreePage() {
  const [links, setLinks] = useState<LinktreeLink[]>([]);
  const [settings, setSettings] = useState<LinktreeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [clickedId, setClickedId] = useState<string | null>(null);

  const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/linktree`;
  const seoProps = {
    title: 'Navigate Wealth Links',
    description: 'Navigate Wealth social and profile links.',
    canonicalUrl: 'https://www.navigatewealth.co/links',
    robotsContent: 'noindex, nofollow',
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE}/public`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
        });
        const data = await res.json();
        if (data.success) {
          setLinks(data.data.links || []);
          setSettings(data.data.settings);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [BASE]);

  const handleClick = useCallback(
    async (link: LinktreeLink) => {
      setClickedId(link.id);

      // Fire-and-forget click tracking
      fetch(`${BASE}/click/${link.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
      }).catch(() => {});

      // Small delay for visual feedback
      setTimeout(() => {
        window.open(link.url, '_blank', 'noopener,noreferrer');
        setClickedId(null);
      }, 150);
    },
    [BASE],
  );

  // --------------------------------------------------------------------------
  // Loading
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <>
        <SEO {...seoProps} />
        <div
          className="min-h-screen flex flex-col items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${BRAND.heroBg}, ${BRAND.heroMid}, ${BRAND.heroBg})` }}
        >
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-400/20 flex items-center justify-center mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
          </div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </>
    );
  }

  // --------------------------------------------------------------------------
  // Error / No settings
  // --------------------------------------------------------------------------

  if (error || !settings) {
    return (
      <>
        <SEO {...seoProps} />
        <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: `linear-gradient(135deg, ${BRAND.heroBg}, ${BRAND.heroMid}, ${BRAND.heroBg})` }}
      >
        {/* Logo */}
        <img
          src={navigateWealthLogo}
          alt="Navigate Wealth"
          className="h-8 w-auto mb-6"
          style={{ imageRendering: 'auto' }}
        />
        <p className="text-gray-400 text-sm text-center max-w-xs">
          This page is currently unavailable. Please try again later.
        </p>
        <div className="flex items-center gap-3 mt-6 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" /> FSCA Regulated
          </span>
          <span>·</span>
          <span>FSP 54606</span>
        </div>
        </div>
      </>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <>
      <SEO {...seoProps} />
      <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* ── Layered Background (matches homepage hero) ───────────────────── */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${BRAND.heroBg}, ${BRAND.heroMid}, ${BRAND.heroBg})` }}
      />
      {/* Purple radial glow — upper-right */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-purple-600/8 blur-[120px]" />
      {/* Secondary glow — lower-left */}
      <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-indigo-600/6 blur-[100px]" />
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col items-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md mx-auto">

          {/* ── Header / Branding ──────────────────────────────────────── */}
          <div className="flex flex-col items-center text-center mb-10">
            {/* Logo */}
            {settings.avatarUrl ? (
              <img
                src={settings.avatarUrl}
                alt={settings.title}
                className="h-16 w-16 rounded-2xl object-cover mb-5 ring-2 ring-white/10 shadow-lg shadow-purple-600/10"
              />
            ) : (
              <div className="mb-5">
                <img
                  src={navigateWealthLogo}
                  alt="Navigate Wealth"
                  className="h-8 w-auto"
                  style={{ imageRendering: 'auto' }}
                />
              </div>
            )}

            {/* Bio */}
            {settings.bio && (
              <p className="text-sm mt-2 max-w-xs leading-relaxed text-gray-400">
                {settings.bio}
              </p>
            )}

            {/* Trust badges */}
            <div className="flex items-center gap-3 mt-4 text-[11px] text-gray-500 font-medium">
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-purple-400/60" />
                FSCA Regulated
              </span>
              <span className="text-gray-700">·</span>
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3 text-purple-400/60" />
                Independent
              </span>
              <span className="text-gray-700">·</span>
              <span>FSP 54606</span>
            </div>

            {/* Social profile icon buttons */}
            {settings.socialProfiles && Object.keys(settings.socialProfiles).length > 0 && (
              <div className="flex items-center gap-2 mt-5">
                {Object.entries(settings.socialProfiles).map(([key, url]) => {
                  if (!url) return null;
                  const Icon = SOCIAL_ICON_MAP[key] || Globe;
                  const label = SOCIAL_LABEL_MAP[key] || key;
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={label}
                      className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.10] hover:bg-white/[0.12] hover:border-purple-400/25 text-gray-400 hover:text-purple-400 transition-all duration-200"
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Links ──────────────────────────────────────────────────── */}
          {links.length > 0 ? (
            <div className="space-y-3">
              {links.map((link) => {
                const Icon = getLinkIcon(link.url);
                const isClicked = clickedId === link.id;

                return (
                  <button
                    key={link.id}
                    onClick={() => handleClick(link)}
                    className={`
                      w-full flex items-center gap-4 px-5 py-4 rounded-xl
                      bg-white/[0.06] border border-white/[0.10]
                      hover:bg-white/[0.10] hover:border-white/[0.18]
                      active:scale-[0.98]
                      transition-all duration-200 cursor-pointer text-left
                      backdrop-blur-sm group
                      ${isClicked ? 'scale-[0.98] bg-white/[0.10] border-purple-400/30' : ''}
                    `}
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-400/10 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/15 group-hover:border-purple-400/20 transition-colors">
                      <Icon className="h-4.5 w-4.5 text-purple-400" />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {link.title}
                      </p>
                      {link.description && (
                        <p className="text-xs mt-0.5 text-gray-500 truncate">
                          {link.description}
                        </p>
                      )}
                    </div>

                    {/* Arrow */}
                    <ArrowUpRight className="h-4 w-4 text-gray-600 flex-shrink-0 group-hover:text-purple-400 transition-colors" />
                  </button>
                );
              })}
            </div>
          ) : (
            /* ── Empty state ───────────────────────────────────────── */
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto rounded-xl bg-white/[0.06] border border-white/[0.10] flex items-center justify-center mb-4">
                <LinkIcon className="h-6 w-6 text-gray-600" />
              </div>
              <p className="text-gray-500 text-sm">No links available yet.</p>
              <p className="text-gray-600 text-xs mt-1">Check back soon.</p>
            </div>
          )}
        </div>

        {/* ── Footer / Branding ──────────────────────────────────────── */}
        <div className="mt-auto pt-12 text-center">
          {settings.showBranding && (
            <div className="flex flex-col items-center gap-3">
              {/* Divider */}
              <div className="w-12 h-px bg-white/[0.08]" />

              <p className="text-[10px] text-white/70 max-w-xs leading-relaxed">
                Wealthfront (Pty) Ltd t/a Navigate Wealth · FSP 54606 · FSCA Regulated
              </p>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
