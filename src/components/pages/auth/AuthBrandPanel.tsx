/**
 * AuthBrandPanel — dark, branded left column for the Login & Signup split layout.
 *
 * Shown alongside the auth form on tablet and larger screens (hidden on mobile,
 * where the stacked form takes the full width). Renders a headline, supporting
 * copy and a short list of value props with iconography, plus a compliance line
 * pinned to the bottom. The Navigate Wealth logo is intentionally omitted here —
 * it already lives in the top navigation bar.
 */

import React from 'react';
import { TrendingUp, Shield, Users, Target, Headphones, Compass } from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  Shield,
  Users,
  Target,
  Headphones,
  Compass,
};

interface BrandFeatureItem {
  readonly iconSlug: string;
  readonly title: string;
  readonly description: string;
}

interface AuthBrandPanelProps {
  headline: string;
  subheadline: string;
  features: readonly BrandFeatureItem[];
}

export function AuthBrandPanel({ headline, subheadline, features }: AuthBrandPanelProps) {
  return (
    <div className="relative hidden overflow-hidden bg-[#13122b] p-10 text-white md:flex md:flex-col lg:p-12">
      {/* Soft purple glow accents */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 right-0 h-72 w-72 rounded-full bg-purple-600/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-purple-800/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex flex-1 flex-col justify-center">
          <h2 className="max-w-sm text-3xl font-bold leading-tight lg:text-4xl">{headline}</h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-gray-300/90">{subheadline}</p>

          <div className="mt-10 space-y-6">
            {features.map((feature) => {
              const Icon = ICON_MAP[feature.iconSlug] ?? Shield;
              return (
                <div key={feature.title} className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 ring-1 ring-white/10">
                    <Icon className="h-5 w-5 text-purple-300" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-white">{feature.title}</h3>
                    <p className="mt-0.5 text-sm leading-relaxed text-gray-400">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-10 text-xs text-gray-400">Proudly South African · FSP No. 54606</p>
      </div>
    </div>
  );
}

export default AuthBrandPanel;
