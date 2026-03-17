import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { 
  Search, 
  Lightbulb, 
  BarChart3, 
  Activity,
  X,
  TrendingUp,
  PiggyBank,
  Target,
  Shield,
  FileText,
  GraduationCap,
  Globe,
  Users,
  LayoutGrid
} from 'lucide-react';

// Module Imports
import { 
  useArticles, 
  useCategories, 
  useMarketNews,
  InsightsTab,
  MarketWatchTab,
  MarketNewsTab,
  CATEGORY_ICON_MAP,
  formatDate
} from '../admin/modules/publications';

// ---------------------------------------------------------------------------
// Treat CATEGORY_ICON_MAP as a flexible Record for runtime lookups.
// The const-assertion in constants.ts makes its keys narrow string literals,
// but we index it with dynamic strings from the API.
// ---------------------------------------------------------------------------
const iconMap = CATEGORY_ICON_MAP as Record<string, string | undefined>;

// Resolve string icon names (from DB or CATEGORY_ICON_MAP) to actual Lucide components
const ICON_COMPONENT_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  PiggyBank,
  Target,
  Shield,
  FileText,
  GraduationCap,
  Globe,
  Users,
  LayoutGrid
};

function resolveIconComponent(icon: unknown): React.ComponentType<{ className?: string }> {
  if (typeof icon === 'function') return icon as React.ComponentType<{ className?: string }>;
  if (typeof icon === 'string' && ICON_COMPONENT_MAP[icon]) return ICON_COMPONENT_MAP[icon];
  return FileText;
}

// Local type for search results across articles and news
interface SearchResult {
  title: string;
  type: 'article' | 'news';
  slug?: string;
  id?: string;
  link?: string;
  excerpt?: string;
  description?: string;
  category_name?: string;
  category?: string;
  author_name?: string;
  author?: string;
}

export function ResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Tab States
  const [activeTab, setActiveTab] = useState(() => {
    const section = searchParams.get('section');
    return (section && ['insights', 'market-watch', 'market-updates'].includes(section)) 
      ? section 
      : 'insights';
  });
  
  const [activeInsightsCategory, setActiveInsightsCategory] = useState('');
  const [activeMarketWatchSection, setActiveMarketWatchSection] = useState('overview');
  const [activeMarketNewsSection, setActiveMarketNewsSection] = useState('economic-news');
  
  // Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Data Hooks
  const { categories: apiCategories = [], isLoading: categoriesLoading } = useCategories({ activeOnly: true });
  const { articles: articlesList = [], isLoading: articlesLoading } = useArticles({ status: 'published' });
  const { data: newsData, isLoading: newsLoading, refetch: refetchNews, dataUpdatedAt } = useMarketNews(activeTab === 'market-updates');

  // Constants
  const defaultNewsData = {
    economicNews: [],
    forexNews: [],
    stockMarket: [],
    investingIdeas: []
  };

  // Build insights categories from API data (no hardcoded fallback — API is the
  // single source of truth, eliminating ID-mismatch bugs between fallback slugs
  // and real UUIDs).
  const insightsCategories = useMemo(() => {
    if (!apiCategories || apiCategories.length === 0) return [];

    // Prepend a synthetic "All" category that shows every article
    const allCategory = {
      id: '__all__',
      name: 'All',
      slug: 'all',
      description: 'Browse all articles across every category.',
      icon: LayoutGrid,
    };

    // apiCategories come from useCategories() which returns Category[] (types.ts),
    // already sorted by sort_order from the backend.
    const realCategories = apiCategories.map((cat) => {
      // Resolve icon: try DB icon field, then slug map, then name map, then fallback
      const rawIcon = cat.icon || iconMap[cat.slug] || iconMap[cat.name];

      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description ?? '',
        icon: resolveIconComponent(rawIcon)
      };
    });

    return [allCategory, ...realCategories];
  }, [apiCategories]);

  // Default the active insights category to "All" once loaded
  useEffect(() => {
    if (insightsCategories.length > 0 && !activeInsightsCategory) {
      setActiveInsightsCategory('__all__');
    }
  }, [insightsCategories, activeInsightsCategory]);

  // Group articles by category — uses a dynamic name→id lookup built from the
  // current insightsCategories instead of a hardcoded slug map.
  const groupedArticles = useMemo(() => {
    const map: Record<string, Array<{ category_id?: string; category_slug?: string; category_name?: string; [key: string]: unknown }>> = {};

    // Build a dynamic name → category-id map from live API categories
    const categoryNameToId: Record<string, string> = {};
    insightsCategories.forEach((cat) => {
      map[cat.id] = [];
      if (cat.slug) map[cat.slug] = [];
      categoryNameToId[cat.name] = cat.id;
    });

    articlesList.forEach((article: { category_id?: string; category_slug?: string; category_name?: string; [key: string]: unknown }) => {
      // Always add to the synthetic "All" bucket
      if (map['__all__']) {
        map['__all__'].push(article);
      }

      // Try to find matching bucket by ID first, then slug, then name
      let catKey = article.category_id;

      if (!map[catKey]) {
        catKey = article.category_slug || '';
      }

      if (!map[catKey] && article.category_name) {
        catKey = categoryNameToId[article.category_name];
      }

      if (catKey && map[catKey] !== undefined) {
        map[catKey].push(article);
      } else {
        // Last resort — push into every matching category bucket
        insightsCategories.forEach((cat) => {
          if (
            cat.id === article.category_id ||
            cat.slug === article.category_slug ||
            cat.name === article.category_name
          ) {
            map[cat.id].push(article);
          }
        });
      }
    });

    return map;
  }, [articlesList, insightsCategories]);

  // --- Handlers ---

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    setSearchParams({ section: value }, { replace: true });
    
    // Clear search when switching tabs
    if (searchQuery) {
      setSearchQuery('');
      setSearchResults([]);
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        setSearchDebounceTimer(null);
      }
    }
  }, [searchQuery, searchDebounceTimer, setSearchParams]);

  // Search Logic
  const performSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    
    const results: SearchResult[] = [];
    const q = query.toLowerCase();

    // Search articles
    articlesList.forEach((article: { category_id?: string; category_slug?: string; category_name?: string; [key: string]: unknown }) => {
      const categoryName = article.category_name || article.category?.name || '';
      if (
        article.title.toLowerCase().includes(q) || 
        (article.excerpt && article.excerpt.toLowerCase().includes(q)) ||
        categoryName.toLowerCase().includes(q)
      ) {
        results.push({
          title: article.title,
          type: 'article',
          slug: article.slug,
          id: article.id,
          link: article.link,
          excerpt: article.excerpt,
          category_name: categoryName,
          author_name: article.author_name,
        });
      }
    });

    // Search fetched news
    const currentNews = newsData || defaultNewsData;
    Object.values(currentNews).flat().forEach((news) => {
      if (news.title?.toLowerCase().includes(q)) {
        results.push({ ...news, type: 'news', category: 'Market News' });
      }
    });

    setSearchResults(results.slice(0, 15));
    setIsSearching(false);
  }, [articlesList, newsData]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    const timer = setTimeout(() => performSearch(val), 300);
    setSearchDebounceTimer(timer);
  }, [searchDebounceTimer, performSearch]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      setSearchDebounceTimer(null);
    }
  }, [searchDebounceTimer]);

  // --- Render ---

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans">
      {/* Hero Section */}
      <section className="relative z-20 bg-[#111827]" aria-label="Hero">
        {/* Background — single subtle gradient (overflow-hidden scoped to decorations only) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-[#111827] via-[#161b33] to-[#111827]" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.25) 0%, transparent 70%)' }} />
        </div>

        <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center py-20 lg:py-28">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
              <Lightbulb className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-[12px] font-medium text-gray-400 tracking-wide">Resource Center</span>
            </div>

            {/* Heading */}
            <div className="max-w-3xl space-y-5">
              <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                <span className="hidden sm:inline">Financial Insights &{' '}</span>
                <span className="sm:hidden">Insights &{' '}</span>
                <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">
                  <span className="hidden sm:inline">Market Intelligence</span>
                  <span className="sm:hidden">Education</span>
                </span>
              </h1>
              <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                <span className="hidden sm:inline">Stay ahead with real-time market data, expert analysis, and comprehensive educational resources for your financial journey.</span>
                <span className="sm:hidden">Expert articles and educational resources to help you make informed financial decisions.</span>
              </p>
            </div>
            
            {/* Search Bar */}
            <div className="relative max-w-2xl mx-auto pt-8 w-full" style={{ zIndex: 60 }}>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg opacity-20 group-hover:opacity-35 transition duration-200 blur"></div>
                <div className="relative bg-white/[0.07] backdrop-blur-sm rounded-lg flex items-center px-4 py-2 border border-white/[0.1]">
                  <Search className="h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    className="flex-1 px-3 py-1.5 outline-none text-white placeholder-gray-500 bg-transparent"
                    placeholder="Search articles..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                  />
                  {searchQuery && (
                    <button 
                      onClick={clearSearch} 
                      className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Search Dropdown */}
              {searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden" style={{ zIndex: 60 }}>
                  {isSearching ? (
                    <div className="p-4 text-center text-gray-500">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    <div className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto py-2">
                      {searchResults.map((result, idx) => {
                        // Build the correct destination for each result type
                        const href = result.type === 'article'
                          ? `/resources/article/${result.slug || result.id || ''}`
                          : result.link || '#';
                        const isExternal = result.type === 'news' && !!result.link;

                        const content = (
                          <div className="contents">
                            <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{result.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] px-1.5 h-5 flex-shrink-0">
                                {result.category_name || result.category || result.type}
                              </Badge>
                              <span className="text-xs text-gray-400 truncate">
                                {result.excerpt || result.description || result.author_name || result.author || 'Result'}
                              </span>
                            </div>
                          </div>
                        );

                        return isExternal ? (
                          <a
                            key={`${result.type}-${idx}`}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors active:bg-gray-100"
                            onClick={clearSearch}
                          >
                            {content}
                          </a>
                        ) : (
                          <Link
                            key={`${result.type}-${idx}`}
                            to={href}
                            className="block px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors active:bg-gray-100"
                            onClick={clearSearch}
                          >
                            {content}
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">No results found</div>
                  )}
                </div>
              )}
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-10 pt-8 border-t border-white/[0.06] w-full max-w-2xl">
              {[
                { icon: BarChart3, text: 'Real-Time Market Data' },
                { icon: Lightbulb, text: 'Expert Analysis' },
                { icon: GraduationCap, text: 'Educational Resources' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5 text-gray-500">
                  <Icon className="h-3.5 w-3.5 text-purple-400/70 flex-shrink-0" />
                  <span className="text-xs font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-8 -mt-4">
        {/* Mobile: Show Insights & Education directly (no confusing tab navigation) */}
        <div className="sm:hidden mt-5 mb-4">
          {categoriesLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
                <p className="text-sm text-gray-500 font-medium">Loading articles…</p>
              </div>
            </div>
          ) : (
            <InsightsTab
              categories={insightsCategories}
              activeCategory={activeInsightsCategory}
              onCategoryChange={setActiveInsightsCategory}
              articles={groupedArticles}
            />
          )}
        </div>

        {/* Desktop: Full tabbed experience with Insights, Market Watch & Market News */}
        <div className="hidden sm:block">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-8">
          {/* Tab Navigation */}
          <div className="flex justify-center mt-[20px] mr-[0px] mb-[30px] ml-[0px]">
            <TabsList className="bg-white border border-gray-200 shadow-sm rounded-2xl sm:rounded-full p-1.5 h-auto flex flex-col sm:flex-row w-full sm:w-auto sm:inline-flex gap-1.5 sm:gap-2">
              <TabsTrigger
                value="insights"
                className="rounded-xl sm:rounded-full px-4 sm:px-6 py-2.5 text-sm font-medium data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all w-full sm:w-auto justify-center"
              >
                <Lightbulb className="h-4 w-4 mr-2 flex-shrink-0" />
                Insights & Education
              </TabsTrigger>
              <TabsTrigger
                value="market-watch"
                className="rounded-xl sm:rounded-full px-4 sm:px-6 py-2.5 text-sm font-medium data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all w-full sm:w-auto justify-center"
              >
                <BarChart3 className="h-4 w-4 mr-2 flex-shrink-0" />
                Market Watch
              </TabsTrigger>
              <TabsTrigger
                value="market-updates"
                className="rounded-xl sm:rounded-full px-4 sm:px-6 py-2.5 text-sm font-medium data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all w-full sm:w-auto justify-center"
              >
                <Activity className="h-4 w-4 mr-2 flex-shrink-0" />
                Market News
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content - Only render active tab */}
          <TabsContent value="insights" className="focus:outline-none">
            {activeTab === 'insights' && (
              categoriesLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
                    <p className="text-sm text-gray-500 font-medium">Loading categories…</p>
                  </div>
                </div>
              ) : (
                <InsightsTab 
                  categories={insightsCategories}
                  activeCategory={activeInsightsCategory}
                  onCategoryChange={setActiveInsightsCategory}
                  articles={groupedArticles}
                />
              )
            )}
          </TabsContent>

          <TabsContent value="market-watch" className="focus:outline-none">
            {activeTab === 'market-watch' && (
              <MarketWatchTab 
                activeSection={activeMarketWatchSection}
                onSectionChange={setActiveMarketWatchSection}
              />
            )}
          </TabsContent>

          <TabsContent value="market-updates" className="focus:outline-none">
            {activeTab === 'market-updates' && (
              <MarketNewsTab 
                activeSection={activeMarketNewsSection}
                onSectionChange={setActiveMarketNewsSection}
                newsData={newsData || defaultNewsData}
                isLoading={newsLoading}
                formatDate={(d) => formatDate(d)}
                onRefresh={() => refetchNews()}
                lastRefreshTime={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
              />
            )}
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}