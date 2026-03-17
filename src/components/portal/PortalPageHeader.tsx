/**
 * PortalPageHeader
 * 
 * Branded hero-style header for client portal pages.
 * Mirrors the website's dark gradient hero aesthetic while keeping
 * the content functional and dashboard-appropriate.
 * 
 * When ACTIVE_THEME is 'classic', renders a simple white/gray header.
 * 
 * Guidelines refs: §8.1, §8.3, §8.4
 */

import React from 'react';
import { ACTIVE_THEME, BRAND } from './portal-theme';

interface PortalPageHeaderProps {
  /** Greeting line, e.g. "Good morning, Chris" */
  greeting?: string;
  /** Main title */
  title: string;
  /** Subtitle / description */
  subtitle?: string;
  /** Icon component to display */
  icon?: React.ElementType;
  /** Optional right-side content (actions, badges, etc.) */
  actions?: React.ReactNode;
  /** Compact mode for sub-pages (shorter height) */
  compact?: boolean;
  children?: React.ReactNode;
}

export function PortalPageHeader({
  greeting,
  title,
  subtitle,
  icon: Icon,
  actions,
  compact = false,
  children,
}: PortalPageHeaderProps) {
  if (ACTIVE_THEME === 'classic') {
    return (
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {Icon && (
                <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-purple-600" />
                </div>
              )}
              <div>
                {greeting && <p className="text-sm text-gray-500">{greeting}</p>}
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                {subtitle && <p className="text-gray-600 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
          {children}
        </div>
      </div>
    );
  }

  // ── Branded theme ──────────────────────────────────────────────────────────

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#1a1e36] via-[#252a47] to-[#1a1e36]">
      {/* Glow effects */}
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-purple-600/[0.07] blur-[100px]" />
      <div className="absolute -bottom-40 -left-32 w-[400px] h-[400px] rounded-full bg-indigo-600/[0.05] blur-[80px]" />

      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Content */}
      <div className={`relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 ${compact ? 'py-6 lg:py-8' : 'py-8 lg:py-12'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            {Icon && (
              <div className="h-12 w-12 lg:h-14 lg:w-14 rounded-xl bg-white/[0.08] backdrop-blur-sm border border-white/10 flex items-center justify-center">
                <Icon className="h-6 w-6 lg:h-7 lg:w-7 text-purple-300" />
              </div>
            )}
            <div>
              {greeting && (
                <p className="text-sm text-white/50 font-medium">{greeting}</p>
              )}
              <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-white/60 mt-0.5 text-sm lg:text-base max-w-xl">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
