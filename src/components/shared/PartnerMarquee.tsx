/**
 * PartnerMarquee — Auto-scrolling partner/insurer logo strip.
 *
 * Shared across service pages (RiskManagement, MedicalAid, etc.)
 * to display trusted partner logos in a continuous horizontal marquee.
 *
 * When there are 3 or fewer partners, logos are displayed centered and
 * static (no animation) since a marquee is unnecessary for so few items.
 *
 * The marquee animation is defined globally in `/styles/globals.css`
 * as `@keyframes marquee-scroll`.
 */

import React from 'react';
import { Shield, Award, CheckCircle } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

export interface PartnerLogo {
  id: string;
  name: string;
  logo: string;
  est: string;
}

export interface PartnerMarqueeProps {
  partners: PartnerLogo[];
  /** Optional heading override */
  heading?: string;
  /** Optional sub-heading override */
  subHeading?: string;
  /** Trust badges displayed below the marquee */
  trustBadges?: { icon: React.ComponentType<{ className?: string }>; text: string }[];
}

const DEFAULT_TRUST_BADGES = [
  { icon: Shield, text: 'Financial Sector Conduct Authority regulated' },
  { icon: Award, text: 'Industry-leading partner network' },
  { icon: CheckCircle, text: 'Market-wide comparison on your behalf' },
];

/** Threshold: if partners count is at or below this, display static centered layout */
const STATIC_THRESHOLD = 3;

export function PartnerMarquee({
  partners,
  heading = "We work with South Africa's leading insurers",
  subHeading = 'Trusted Partners',
  trustBadges = DEFAULT_TRUST_BADGES,
}: PartnerMarqueeProps) {
  const isStatic = partners.length <= STATIC_THRESHOLD;
  const doubled = isStatic ? partners : [...partners, ...partners];

  return (
    <section className="py-20 bg-[#313653]" aria-label="Trusted insurance partners">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12">
          <div>
            <p className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-1.5">
              {subHeading}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white">{heading}</h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60 shrink-0">
            <Shield className="h-4 w-4 text-primary" />
            <span>All FSCA regulated</span>
          </div>
        </div>

        {isStatic ? (
          /* ── Static centered layout for 3 or fewer partners ── */
          <div className="flex items-center justify-center gap-8 flex-wrap py-3">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="flex-shrink-0 flex flex-col items-center justify-center gap-3 w-72 h-[10.5rem] bg-white border border-gray-200 rounded-2xl shadow-sm px-8 hover:border-primary/30 hover:shadow-md transition-all duration-200"
              >
                <ImageWithFallback
                  src={partner.logo}
                  alt={partner.name}
                  className="max-h-[5.25rem] max-w-full object-contain"
                />
                <span className="text-xs text-white/50 font-medium">Est. {partner.est}</span>
              </div>
            ))}
          </div>
        ) : (
          /* ── Marquee layout for 4+ partners ── */
          <div className="relative py-3 -my-3" style={{ overflowX: 'clip' }}>
            <div className="absolute inset-y-3 left-0 w-20 z-10 bg-gradient-to-r from-[#313653] to-transparent pointer-events-none" />
            <div className="absolute inset-y-3 right-0 w-20 z-10 bg-gradient-to-l from-[#313653] to-transparent pointer-events-none" />
            <div
              className="flex items-center gap-8"
              style={{ animation: 'marquee-scroll 45s linear infinite', width: 'max-content' }}
            >
              {doubled.map((partner, i) => (
                <div
                  key={`${partner.id}-${i}`}
                  className="flex-shrink-0 flex flex-col items-center justify-center gap-3 w-72 h-[10.5rem] bg-white border border-gray-200 rounded-2xl shadow-sm px-8 hover:border-primary/30 hover:shadow-md transition-all duration-200"
                >
                  <ImageWithFallback
                    src={partner.logo}
                    alt={partner.name}
                    className="max-h-[5.25rem] max-w-full object-contain"
                  />
                  <span className="text-xs text-white/50 font-medium">Est. {partner.est}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {trustBadges.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-sm text-white/60">
              <Icon className="h-4 w-4 text-primary flex-shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}