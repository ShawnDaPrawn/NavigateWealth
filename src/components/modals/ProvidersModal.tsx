/**
 * ProvidersModal — Our Trusted Partners
 *
 * Displays all financial product providers grouped by category.
 * Provider-to-category assignments mirror the service page partnerLogos arrays
 * (§5.3 — centralised constants).
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { OptimizedImage } from '../shared/OptimizedImage';
import { Badge } from '../ui/badge';
import {
  Shield,
  CheckCircle,
  Stethoscope,
  Users,
  FileText,
  TrendingUp,
} from 'lucide-react';

import {
  allanGrayLogo,
  brightRockLogo,
  capitalLegacyLogo,
  discoveryLogo,
  ewSerfonteinLogo,
  hollardLogo,
  inn8Logo,
  justLogo,
  libertyLogo,
  momentumLogo,
  oldMutualLogo,
  sanlamLogo,
  stanlibLogo,
  sygniaLogo,
} from '../shared/assets/provider-logos';

interface ProvidersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProviderEntry {
  name: string;
  logo: string | null;
}

/**
 * Provider lists per category — sourced from each service page's partnerLogos array.
 * Each provider appears only in the categories where they actually operate.
 */
const riskProviders: ProviderEntry[] = [
  { name: 'Discovery', logo: discoveryLogo },
  { name: 'Sanlam', logo: sanlamLogo },
  { name: 'Momentum', logo: momentumLogo },
  { name: 'Liberty', logo: libertyLogo },
  { name: 'Old Mutual', logo: oldMutualLogo },
  { name: 'BrightRock', logo: brightRockLogo },
  { name: 'Hollard', logo: hollardLogo },
];

const medicalAidProviders: ProviderEntry[] = [
  { name: 'Discovery Health', logo: discoveryLogo },
  { name: 'Momentum Health', logo: momentumLogo },
];

const investmentProviders: ProviderEntry[] = [
  { name: 'Allan Gray', logo: allanGrayLogo },
  { name: 'Sygnia', logo: sygniaLogo },
  { name: 'Discovery', logo: discoveryLogo },
  { name: 'Liberty', logo: libertyLogo },
  { name: 'Stanlib', logo: stanlibLogo },
  { name: 'INN8', logo: inn8Logo },
  { name: 'Old Mutual', logo: oldMutualLogo },
  { name: 'Sanlam', logo: sanlamLogo },
  { name: 'Momentum', logo: momentumLogo },
  { name: 'JUST', logo: justLogo },
];

const groupBenefitsProviders: ProviderEntry[] = [
  { name: 'Discovery', logo: discoveryLogo },
  { name: 'Momentum', logo: momentumLogo },
  { name: 'Liberty', logo: libertyLogo },
  { name: 'BrightRock', logo: brightRockLogo },
  { name: 'Sanlam', logo: sanlamLogo },
  { name: 'Old Mutual', logo: oldMutualLogo },
  { name: 'Allan Gray', logo: allanGrayLogo },
  { name: 'Sygnia', logo: sygniaLogo },
  { name: 'Hollard', logo: hollardLogo },
  { name: 'Stanlib', logo: stanlibLogo },
  { name: 'INN8', logo: inn8Logo },
  { name: 'JUST', logo: justLogo },
  { name: 'Capital Legacy', logo: capitalLegacyLogo },
];

const estatePlanningProviders: ProviderEntry[] = [
  { name: 'Capital Legacy', logo: capitalLegacyLogo },
  { name: 'EW Serfontein & Associates', logo: ewSerfonteinLogo },
];

// ── Shared provider card ──────────────────────────────────────────────────────

function ProviderLogo({ provider }: { provider: ProviderEntry }) {
  return (
    <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl hover:shadow-md hover:bg-white border border-gray-100 transition-all duration-200 group">
      <div className="w-full h-16 flex items-center justify-center">
        {provider.logo ? (
          <OptimizedImage
            src={provider.logo}
            alt={provider.name}
            width={160}
            height={80}
            className="max-h-14 max-w-[140px] w-auto object-contain group-hover:scale-105 transition-transform duration-200 high-quality-image"
            loading="lazy"
          />
        ) : (
          <div className="w-14 h-14 bg-gradient-to-br from-primary/15 to-primary/25 rounded-lg flex items-center justify-center">
            <span className="text-primary font-bold text-base">
              {provider.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <span className="text-xs font-medium text-gray-600 mt-2 text-center">{provider.name}</span>
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function CategorySection({
  icon: Icon,
  title,
  providers,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  providers: ProviderEntry[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <h3 className="!text-base !font-semibold text-gray-900">{title}</h3>
        <Badge variant="secondary" className="text-[11px] text-gray-500 bg-gray-100">
          {providers.length} {providers.length === 1 ? 'partner' : 'partners'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {providers.map((provider) => (
          <ProviderLogo key={provider.name} provider={provider} />
        ))}
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function ProvidersModal({ isOpen, onClose }: ProvidersModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-w-none max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-xl font-bold text-gray-900">
              Our Trusted Partners
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Navigate Wealth partners with South Africa's leading financial product providers to
              ensure you have access to the best solutions in the market.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          <CategorySection
            icon={Shield}
            title="Risk Management"
            providers={riskProviders}
          />

          <CategorySection
            icon={Stethoscope}
            title="Medical Aid"
            providers={medicalAidProviders}
          />

          <CategorySection
            icon={TrendingUp}
            title="Investment Management"
            providers={investmentProviders}
          />

          <CategorySection
            icon={Users}
            title="Group Benefits"
            providers={groupBenefitsProviders}
          />

          <CategorySection
            icon={FileText}
            title="Estate Planning"
            providers={estatePlanningProviders}
          />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Independent. Unbiased. Best-in-Class.</p>
              <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                Our independence means we evaluate solutions from all partners to recommend what's truly best for you.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-2.5 py-1">
                <CheckCircle className="h-3 w-3" />
                Free consultation
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-2.5 py-1">
                <CheckCircle className="h-3 w-3" />
                No obligation
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
