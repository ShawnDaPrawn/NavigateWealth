/**
 * AuthShowcasePanel — shared right-column feature showcase for Login & Signup pages.
 * Displays value propositions and trust stats with consistent branding.
 */

import React from 'react';
import { TrendingUp, Shield, Users, Target, Headphones } from 'lucide-react';
import { AUTH_STATS } from './authConstants';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  Shield,
  Users,
  Target,
  Headphones,
};

interface FeatureItem {
  readonly iconSlug: string;
  readonly title: string;
  readonly description: string;
}

interface AuthShowcasePanelProps {
  headline: string;
  subheadline: string;
  features: readonly FeatureItem[];
}

export function AuthShowcasePanel({ headline, subheadline, features }: AuthShowcasePanelProps) {
  return (
    <div className="hidden lg:flex lg:flex-1 bg-[#313653] relative overflow-hidden">
      {/* Subtle gradient accent */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-purple-500 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-400 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white h-full w-full">
        <h1 className="text-3xl font-bold text-white mb-3 leading-tight">{headline}</h1>
        <p className="text-lg text-gray-300 mb-12 leading-relaxed">{subheadline}</p>

        <div className="space-y-7">
          {features.map((feature) => {
            const Icon = ICON_MAP[feature.iconSlug] ?? Shield;
            return (
              <div key={feature.title} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-11 h-11 bg-white/10 rounded-lg flex items-center justify-center border border-white/10">
                  <Icon className="h-5 w-5 text-purple-300" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-[13px] text-gray-400 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 grid grid-cols-3 gap-8 pt-8 border-t border-white/10">
          {AUTH_STATS.map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
