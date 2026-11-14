/**
 * Corporate Identity Tab
 *
 * Central management of brand assets: logos, colours, typography,
 * collateral files, and brand guidelines.
 *
 * Guidelines:
 *   SS7    — Presentation layer (no business logic in UI)
 *   SS8.3  — Status colour vocabulary, stat card standards
 *   SS8.4  — Platform constraints (sonner version, contents wrapper)
 */

import React, { useState, useEffect, useCallback } from 'react';

import { Tabs, TabsContent } from '../../../../ui/tabs';
import {
  SegmentedList,
  SegmentedTrigger,
  StatCard,
  useBreadcrumbTrail,
  useUrlState,
} from '../../../layout/page';
import { Image, Palette, FolderOpen, Clock, Loader2 } from 'lucide-react';
import { brandApi } from './brand-api';
import type { BrandSummary } from './brand-api';
import { formatDate } from './corporateIdentityUtils';
import { ColoursSection } from './ColoursSection';
import { TypographySection } from './TypographySection';
import { CollateralSection } from './CollateralSection';
import { GuidelinesSection } from './GuidelinesSection';
import { LogosSection } from './LogosSection';

const EmailSignatureGenerator = React.lazy(() =>
  import('./EmailSignatureGenerator').then((m) => ({ default: m.EmailSignatureGenerator })),
);

// ============================================================================
// STAT CARD CONFIG (SS8.3)
// ============================================================================

const STAT_CONFIG = {
  logoCount: {
    label: 'Logo assets',
    icon: Image,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  colourCount: {
    label: 'Brand colours',
    icon: Palette,
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  collateralCount: {
    label: 'Collateral',
    icon: FolderOpen,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  lastUpdated: {
    label: 'Last updated',
    icon: Clock,
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
} as const;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const BRAND_SECTIONS = [
  'logos',
  'colours',
  'typography',
  'collateral',
  'signatures',
  'guidelines',
] as const;
type BrandSection = (typeof BRAND_SECTIONS)[number];

export function CorporateIdentityTab() {
  // The open section is in the address (?brandSection=colours).
  const [section, setSection] = useUrlState<BrandSection>('brandSection', 'logos', BRAND_SECTIONS);
  useBreadcrumbTrail([
    { label: 'Corporate identity' },
    { label: section.charAt(0).toUpperCase() + section.slice(1) },
  ]);
  const [summary, setSummary] = useState<BrandSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    try {
      const data = await brandApi.getSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load brand summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(Object.keys(STAT_CONFIG) as Array<keyof typeof STAT_CONFIG>).map((key) => {
          const cfg = STAT_CONFIG[key];
          // A failed summary shows "—", never a misleading 0.
          const value = loading
            ? '…'
            : !summary
              ? '—'
              : key === 'lastUpdated'
                ? formatDate(summary.lastUpdated ?? null)
                : (summary[key as keyof BrandSummary] ?? 0);
          return <StatCard key={key} label={cfg.label} value={String(value)} />;
        })}
      </div>

      {/* Section Tabs */}
      <Tabs
        value={section}
        onValueChange={(v) => setSection(v as BrandSection)}
        className="space-y-6"
      >
        <SegmentedList aria-label="Corporate identity sections">
          <SegmentedTrigger value="logos">Logos</SegmentedTrigger>
          <SegmentedTrigger value="colours">Colours</SegmentedTrigger>
          <SegmentedTrigger value="typography">Typography</SegmentedTrigger>
          <SegmentedTrigger value="collateral">Collateral</SegmentedTrigger>
          <SegmentedTrigger value="signatures">Signatures</SegmentedTrigger>
          <SegmentedTrigger value="guidelines">Guidelines</SegmentedTrigger>
        </SegmentedList>

        <TabsContent value="logos">
          <LogosSection onUpdate={loadSummary} />
        </TabsContent>
        <TabsContent value="colours">
          <ColoursSection onUpdate={loadSummary} />
        </TabsContent>
        <TabsContent value="typography">
          <TypographySection onUpdate={loadSummary} />
        </TabsContent>
        <TabsContent value="collateral">
          <CollateralSection onUpdate={loadSummary} />
        </TabsContent>
        <TabsContent value="signatures">
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
              </div>
            }
          >
            <EmailSignatureGenerator />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="guidelines">
          <GuidelinesSection onUpdate={loadSummary} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
