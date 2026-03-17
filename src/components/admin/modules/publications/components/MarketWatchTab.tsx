import React, { memo, useState, useEffect, Suspense } from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { 
  BarChart3, 
  TrendingUp, 
  Building, 
  PiggyBank, 
  Activity, 
  Calendar,
  Loader2
} from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { TradingViewWidgetWrapper } from '../../../../tradingview/TradingViewWidgetWrapper';

// Lazy-load individual TradingView widgets — only the active one is ever rendered
const TradingViewMarketOverviewWidget = React.lazy(() => import('../../../../tradingview/TradingViewMarketOverviewWidget'));
const TradingViewForexWidget = React.lazy(() => import('../../../../tradingview/TradingViewForexWidget'));
const TradingViewStockHeatmapWidget = React.lazy(() => import('../../../../tradingview/TradingViewStockHeatmapWidget'));
const TradingViewETFHeatmapWidget = React.lazy(() => import('../../../../tradingview/TradingViewETFHeatmapWidget'));
const TradingViewCryptoHeatmapWidget = React.lazy(() => import('../../../../tradingview/TradingViewCryptoHeatmapWidget'));
const TradingViewEconomicCalendarWidget = React.lazy(() => import('../../../../tradingview/TradingViewEconomicCalendarWidget'));

interface MarketWatchTabProps {
  activeSection: string;
  onSectionChange: (id: string) => void;
}

// Loading component for transitions
const WidgetLoader = () => (
  <div className="flex items-center justify-center min-h-[600px]">
    <div className="text-center">
      <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
      <p className="text-gray-500">Loading market data...</p>
    </div>
  </div>
);

export const MarketWatchTab = memo(function MarketWatchTab({ 
  activeSection, 
  onSectionChange 
}: MarketWatchTabProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mountedSection, setMountedSection] = useState(activeSection);
  const [renderKey, setRenderKey] = useState(0);

  const sections = [
    { id: 'overview', label: 'Market Overview', icon: BarChart3, description: 'Global market summary and key indices' },
    { id: 'forex', label: 'Forex Rates', icon: TrendingUp, description: 'Real-time currency exchange rates' },
    { id: 'stocks', label: 'Stocks Heatmap', icon: Building, description: 'S&P 500 sector performance' },
    { id: 'etfs', label: 'ETFs Heatmap', icon: PiggyBank, description: 'US Exchange Traded Funds performance' },
    { id: 'crypto', label: 'Crypto Heatmap', icon: Activity, description: 'Cryptocurrency market visualization' },
    { id: 'economic-calendar', label: 'Economic Calendar', icon: Calendar, description: 'Upcoming economic events' }
  ];

  // Handle section changes with transition to ensure proper cleanup
  useEffect(() => {
    if (activeSection !== mountedSection) {
      setIsTransitioning(true);
      
      // Wait for previous widget to fully unmount
      const timer = setTimeout(() => {
        setMountedSection(activeSection);
        setRenderKey(prev => prev + 1); // Force complete remount
        
        // Short delay before showing new widget
        setTimeout(() => {
          setIsTransitioning(false);
        }, 150);
      }, 350);
      
      return () => clearTimeout(timer);
    }
  }, [activeSection, mountedSection]);

  const handleSectionChange = (id: string) => {
    if (id !== activeSection && !isTransitioning) {
      onSectionChange(id);
    }
  };

  const renderWidget = () => {
    if (isTransitioning) {
      return <WidgetLoader />;
    }

    const widgetKey = `${mountedSection}-${renderKey}`;

    // Wrap each widget with proper cleanup wrapper
    switch (mountedSection) {
      case 'overview':
        return (
          <TradingViewWidgetWrapper widgetKey={widgetKey}>
            <Suspense fallback={<WidgetLoader />}>
              <TradingViewMarketOverviewWidget />
            </Suspense>
          </TradingViewWidgetWrapper>
        );
      case 'forex':
        return (
          <TradingViewWidgetWrapper widgetKey={widgetKey}>
            <Suspense fallback={<WidgetLoader />}>
              <TradingViewForexWidget />
            </Suspense>
          </TradingViewWidgetWrapper>
        );
      case 'stocks':
        return (
          <TradingViewWidgetWrapper widgetKey={widgetKey}>
            <Suspense fallback={<WidgetLoader />}>
              <TradingViewStockHeatmapWidget />
            </Suspense>
          </TradingViewWidgetWrapper>
        );
      case 'etfs':
        return (
          <TradingViewWidgetWrapper widgetKey={widgetKey}>
            <Suspense fallback={<WidgetLoader />}>
              <TradingViewETFHeatmapWidget />
            </Suspense>
          </TradingViewWidgetWrapper>
        );
      case 'crypto':
        return (
          <TradingViewWidgetWrapper widgetKey={widgetKey}>
            <Suspense fallback={<WidgetLoader />}>
              <TradingViewCryptoHeatmapWidget />
            </Suspense>
          </TradingViewWidgetWrapper>
        );
      case 'economic-calendar':
        return (
          <TradingViewWidgetWrapper widgetKey={widgetKey}>
            <Suspense fallback={<WidgetLoader />}>
              <TradingViewEconomicCalendarWidget />
            </Suspense>
          </TradingViewWidgetWrapper>
        );
      default:
        return <WidgetLoader />;
    }
  };

  const currentSection = sections.find(s => s.id === activeSection);

  return (
    <div className="space-y-6">
      {/* Navigation Pills */}
      <div className="flex flex-wrap gap-2 p-1 bg-white rounded-xl border border-gray-200 shadow-sm w-fit">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          
          return (
            <button
              key={section.id}
              onClick={() => handleSectionChange(section.id)}
              disabled={isTransitioning}
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-purple-600 text-white shadow-md transform scale-105"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                isTransitioning && "opacity-50 cursor-not-allowed"
              )}
              aria-pressed={isActive}
              aria-label={`View ${section.label}`}
              aria-disabled={isTransitioning}
            >
              <Icon className="h-4 w-4" />
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Section Header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <div className="flex-1">
              {currentSection && (
                <div className="contents">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <currentSection.icon className="h-5 w-5 text-purple-600" />
                    {currentSection.label}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{currentSection.description}</p>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2 bg-green-50 px-3 py-1 rounded-full border border-green-100">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs font-medium text-green-700">Live Data</span>
            </div>
          </div>

          {/* Widget Container */}
          <div className="p-6 min-h-[600px]">
            <div className="w-full h-full overflow-hidden rounded-lg border border-gray-200 shadow-inner bg-gray-50">
              {renderWidget()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});