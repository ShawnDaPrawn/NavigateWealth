import React, { memo } from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { 
  Activity, 
  DollarSign, 
  TrendingUp, 
  Lightbulb,
  Rss,
  ExternalLink,
  User,
  Clock,
  RefreshCw
} from 'lucide-react';
import { cn } from '../../../../ui/utils';

// ---------------------------------------------------------------------------
// Local types – avoids broken ../../types path resolution.
// ---------------------------------------------------------------------------

interface NewsItem {
  title: string;
  pubDate: string;
  author: string;
  link: string;
  image: string;
  description?: string;
  source?: string;
}

interface NewsData {
  economicNews: NewsItem[];
  forexNews: NewsItem[];
  stockMarket: NewsItem[];
  investingIdeas: NewsItem[];
}

interface MarketNewsTabProps {
  activeSection: string;
  onSectionChange: (id: string) => void;
  newsData: NewsData;
  isLoading: boolean;
  formatDate: (date: string) => string;
  onRefresh?: () => void;
  lastRefreshTime?: Date | null;
}

const NewsCard = memo(({ news, formatDate }: { news: NewsItem; formatDate: (date: string) => string }) => {
  return (
    <Card className="group flex flex-col h-full border-gray-200 hover:border-purple-200 hover:shadow-lg transition-all duration-300 overflow-hidden">
      {/* Image */}
      <div className="relative aspect-video overflow-hidden bg-gray-100">
        <img 
          src={news.image} 
          alt={news.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://i-invdn-com.investing.com/news/news_headline_open_108x81.jpg';
          }}
        />
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
          <Rss className="h-3 w-3" />
          <span>RSS</span>
        </div>
      </div>

      <CardContent className="flex-1 flex flex-col p-5">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 flex-shrink-0" />
              {formatDate(news.pubDate)}
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="flex items-center gap-1 truncate flex-1 min-w-0">
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{news.author}</span>
            </span>
          </div>

          <h3 className="font-bold text-gray-900 mb-2 line-clamp-3 group-hover:text-purple-700 transition-colors">
            {news.title}
          </h3>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <a 
            href={news.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between text-sm font-medium text-gray-600 hover:text-purple-700 transition-colors group/link"
            aria-label={`Read article: ${news.title}`}
          >
            <span>Read Article</span>
            <ExternalLink className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-1" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
});

NewsCard.displayName = 'NewsCard';

export const MarketNewsTab = memo(function MarketNewsTab({ 
  activeSection, 
  onSectionChange, 
  newsData, 
  isLoading,
  formatDate,
  onRefresh,
  lastRefreshTime
}: MarketNewsTabProps) {
  const sections = [
    { id: 'economic-news', label: 'Economic News', icon: Activity },
    { id: 'forex-news', label: 'Forex News', icon: DollarSign },
    { id: 'stock-market', label: 'Stock Market', icon: TrendingUp },
    { id: 'investing-ideas', label: 'Investing Ideas', icon: Lightbulb }
  ];

  const getNewsItems = () => {
    switch (activeSection) {
      case 'economic-news': return newsData.economicNews || [];
      case 'forex-news': return newsData.forexNews || [];
      case 'stock-market': return newsData.stockMarket || [];
      case 'investing-ideas': return newsData.investingIdeas || [];
      default: return [];
    }
  };

  const items = getNewsItems();

  return (
    <div className="space-y-6">
      {/* Category Navigation */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            
            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                  isActive
                    ? "bg-[#313653] text-white border-[#313653] shadow-sm"
                    : "bg-[#313653] text-white border-[#313653] hover:bg-[#3d4264] hover:border-[#3d4264] opacity-60 hover:opacity-80"
                )}
                aria-pressed={isActive}
                aria-label={`View ${section.label}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </div>
        
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              onClick={onRefresh}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              Refresh
            </Button>
          )}
          <div className="flex items-center space-x-2 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>
              {lastRefreshTime 
                ? `Updated ${formatDate(lastRefreshTime.toISOString())}` 
                : 'Live Updates'
              }
            </span>
          </div>
        </div>
      </div>

      {/* News Grid */}
      <div className="min-h-[400px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4"></div>
            <p>Fetching latest market updates...</p>
          </div>
        ) : items.length > 0 ? (
          <div className="contents">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {items.slice(0, 12).map((news, index) => (
                <NewsCard 
                  key={`${activeSection}-${news.link}-${index}`}
                  news={news}
                  formatDate={formatDate}
                />
              ))}
            </div>
            {items.length > 12 && (
              <div className="mt-6 text-center text-sm text-gray-500">
                Showing 12 of {items.length} articles
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No updates available</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-4">
              Unable to fetch news for this section at the moment.
            </p>
            {onRefresh && (
              <Button
                onClick={onRefresh}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});