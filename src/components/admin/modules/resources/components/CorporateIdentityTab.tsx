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
import { Card, CardContent } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Image, Palette, FolderOpen, Clock, Loader2, Type, BookOpen, Mail } from 'lucide-react';
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
    label: 'Logo Assets',
    icon: Image,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  colourCount: {
    label: 'Brand Colours',
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
    label: 'Last Updated',
    icon: Clock,
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
} as const;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CorporateIdentityTab() {
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
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold leading-none">Corporate Identity</h2>
        <p className="text-sm text-muted-foreground">
          Manage logos, brand colours, typography, collateral, and brand guidelines.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {(Object.keys(STAT_CONFIG) as Array<keyof typeof STAT_CONFIG>).map((key) => {
          const cfg = STAT_CONFIG[key];
          const Icon = cfg.icon;
          const value = loading
            ? null
            : key === 'lastUpdated'
              ? formatDate(summary?.lastUpdated ?? null)
              : (summary?.[key as keyof BrandSummary] ?? 0);
          return (
            <Card key={key}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${cfg.bgColor}`}>
                    <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
                  </div>
                  <div>
                    {loading ? (
                      <div className="space-y-1.5">
                        <Skeleton className="h-5 w-8" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ) : (
                      <div className="contents">
                        <p className="text-xl font-bold leading-none">{value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{cfg.label}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Section Tabs */}
      <Tabs defaultValue="logos" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 h-10">
          <TabsTrigger value="logos" className="flex items-center gap-1.5 text-sm">
            <Image className="h-3.5 w-3.5" />
            Logos
          </TabsTrigger>
          <TabsTrigger value="colours" className="flex items-center gap-1.5 text-sm">
            <Palette className="h-3.5 w-3.5" />
            Colours
          </TabsTrigger>
          <TabsTrigger value="typography" className="flex items-center gap-1.5 text-sm">
            <Type className="h-3.5 w-3.5" />
            Typography
          </TabsTrigger>
          <TabsTrigger value="collateral" className="flex items-center gap-1.5 text-sm">
            <FolderOpen className="h-3.5 w-3.5" />
            Collateral
          </TabsTrigger>
          <TabsTrigger value="signatures" className="flex items-center gap-1.5 text-sm">
            <Mail className="h-3.5 w-3.5" />
            Signatures
          </TabsTrigger>
          <TabsTrigger value="guidelines" className="flex items-center gap-1.5 text-sm">
            <BookOpen className="h-3.5 w-3.5" />
            Guidelines
          </TabsTrigger>
        </TabsList>

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
