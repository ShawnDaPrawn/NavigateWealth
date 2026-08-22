import { useState, useEffect, useRef } from 'react';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Palette,
  Component,
  Type,
  Grid3X3,
  Info,
  Layers,
  Download,
  Code,
  ArrowUp,
  Sparkles,
} from 'lucide-react';
import { DownloadCodebaseTab } from '../modules/codebase/DownloadCodebaseTab';
import { TypographyTab } from './design-system/TypographyTab';
import { IconsTab } from './design-system/IconsTab';
import { PatternsTab } from './design-system/PatternsTab';
import { OverviewTab } from './design-system/OverviewTab';
import { ColorsTab } from './design-system/ColorsTab';
import { ComponentsTab } from './design-system/ComponentsTab';
import { SectionsTab } from './design-system/SectionsTab';
import { PartnershipSection } from './design-system/PartnershipSection';

// ─── Tab configuration ───────────────────────────────────────────────
const TABS = [
  { value: 'overview', label: 'Overview', icon: Info },
  { value: 'colors', label: 'Colours', icon: Palette },
  { value: 'typography', label: 'Typography', icon: Type },
  { value: 'components', label: 'Components', icon: Component },
  { value: 'patterns', label: 'Patterns', icon: Grid3X3 },
  { value: 'icons', label: 'Icons', icon: Sparkles },
  { value: 'sections', label: 'Sections', icon: Layers },
  { value: 'download', label: 'Download', icon: Download },
] as const;

export default function DesignSystemPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Sticky tab detection
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 600);
      if (tabBarRef.current) {
        const rect = tabBarRef.current.getBoundingClientRect();
        setIsSticky(rect.top <= 0);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToTab = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: tabBarRef.current?.offsetTop || 0, behavior: 'smooth' });
  };

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="section-dark-gray py-16 md:py-20 px-4">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 text-center">
          <div className="space-y-6 max-w-4xl mx-auto">
            <Badge className="bg-primary/20 text-white border-primary/30 backdrop-blur-sm">
              <Code className="h-4 w-4 mr-1" />
              Design System v5
            </Badge>
            <h1 className="text-white font-bold leading-tight text-[36px] text-[40px]">
              Navigate Wealth <span className="text-primary">Design System</span>
            </h1>
            <p className="text-base md:text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto">
              The authoritative source for UI components, patterns, typography, colour tokens, and
              section layouts powering the Navigate Wealth platform. Built with React, TypeScript,
              Tailwind CSS v4, and shadcn/ui.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge className="bg-white/10 text-white border-white/20">React + TypeScript</Badge>
              <Badge className="bg-white/10 text-white border-white/20">Tailwind CSS v4</Badge>
              <Badge className="bg-white/10 text-white border-white/20">shadcn/ui</Badge>
              <Badge className="bg-white/10 text-white border-white/20">WCAG AA</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Tab Navigation */}
      <div ref={tabBarRef} className="sticky top-0 z-40">
        <section
          className={`bg-white border-b border-gray-200 transition-shadow ${isSticky ? 'shadow-md' : ''}`}
        >
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <Tabs value={activeTab} onValueChange={(v) => navigateToTab(v)} className="w-full">
              {/* Platform-standard pill tabs — horizontally scrollable to handle 8 items */}
              <div className="overflow-x-auto scrollbar-hide py-3 flex justify-center">
                <TabsList className="bg-white border border-gray-200 shadow-sm rounded-full p-1.5 h-auto inline-flex gap-1.5 min-w-max">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="rounded-full px-4 py-2 text-sm font-medium data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all whitespace-nowrap flex items-center gap-1.5"
                      >
                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                        {tab.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
            </Tabs>
          </div>
        </section>
      </div>

      {/* Tab Content */}
      <section className="py-8 md:py-12 px-4">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Hidden TabsList for Tabs context */}
            <TabsList className="hidden">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="mt-0">
              <OverviewTab onNavigateToTab={navigateToTab} />
            </TabsContent>

            <TabsContent value="colors" className="mt-0">
              <ColorsTab />
            </TabsContent>

            <TabsContent value="typography" className="mt-0">
              <TypographyTab />
            </TabsContent>

            <TabsContent value="components" className="mt-0">
              <ComponentsTab />
            </TabsContent>

            <TabsContent value="patterns" className="mt-0">
              <PatternsTab />
            </TabsContent>

            <TabsContent value="icons" className="mt-0">
              <IconsTab />
            </TabsContent>

            <TabsContent value="sections" className="mt-0">
              <SectionsTab />
            </TabsContent>

            <TabsContent value="download" className="mt-0">
              <DownloadCodebaseTab />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <PartnershipSection />

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

// Re-export as named export for compatibility
export { DesignSystemPage };
