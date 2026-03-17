import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { MediaAccessModal } from '../modals/MediaAccessModal';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import {
  Newspaper,
  Calendar,
  TrendingUp,
  Users,
  ArrowRight,
  Download,
  Building,
  FileText,
  Search,
  Mail,
  Clock,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PressStats {
  aum: string;
  activeClients: number;
  activeClientsLabel: string;
  yearsInBusiness: string;
  combinedExperience: string;
}

interface PressArticle {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  excerpt: string;
  press_category: string;
  hero_image_url?: string;
  thumbnail_image_url?: string;
  published_at?: string;
  author_name?: string;
  reading_time_minutes?: number;
}

// ============================================================================
// Constants
// ============================================================================

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications`;
const AUTH_HEADERS = { 'Authorization': `Bearer ${publicAnonKey}` };

const PRESS_CATEGORY_MAP: Record<string, string> = {
  'Company News': 'company_news',
  'Product Launch': 'product_launch',
  'Awards': 'awards',
  'Team News': 'team_news',
  'Industry Insights': 'industry_insights',
};

const PRESS_CATEGORY_LABEL_MAP: Record<string, string> = {
  company_news: 'Company News',
  product_launch: 'Product Launch',
  awards: 'Awards',
  team_news: 'Team News',
  industry_insights: 'Industry Insights',
};

const CATEGORY_TABS = ['All', 'Company News', 'Product Launch', 'Awards', 'Team News', 'Industry Insights'];

// ============================================================================
// Data fetching
// ============================================================================

async function fetchPressStats(): Promise<PressStats> {
  try {
    const res = await fetch(`${BASE_URL}/press/stats`, { headers: AUTH_HEADERS });
    const json = await res.json();
    if (json.success && json.data) return json.data;
  } catch { /* fall through */ }
  return { aum: 'R500 mil+', activeClients: 0, activeClientsLabel: '—', yearsInBusiness: '15+', combinedExperience: '55+' };
}

async function fetchPressArticles(): Promise<PressArticle[]> {
  try {
    const res = await fetch(`${BASE_URL}/press/articles`, { headers: AUTH_HEADERS });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data;
  } catch { /* fall through */ }
  return [];
}

// ============================================================================
// Component
// ============================================================================

export function PressPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isMediaAccessModalOpen, setIsMediaAccessModalOpen] = useState(false);

  // Real data
  const [stats, setStats] = useState<PressStats | null>(null);
  const [articles, setArticles] = useState<PressArticle[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);

  const seoData = getSEOData('press');

  useEffect(() => {
    fetchPressStats().then(s => { setStats(s); setIsLoadingStats(false); });
    fetchPressArticles().then(a => { setArticles(a); setIsLoadingArticles(false); });
  }, []);

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMediaAccessModalOpen(true);
  };

  // Derive company stats from real data
  const companyStats = useMemo(() => [
    { label: "Assets Under Management", value: stats?.aum || 'R500 mil+', icon: TrendingUp },
    { label: "Active Clients", value: stats?.activeClientsLabel || '—', icon: Users },
    { label: "Years in Business", value: stats?.yearsInBusiness || '15+', icon: Calendar },
    { label: "Combined Years Experience", value: stats?.combinedExperience || '55+', icon: Building },
  ], [stats]);

  // Filter articles by selected category tab + search query
  const filteredArticles = useMemo(() => {
    let result = articles;

    // Category filter
    if (selectedCategory !== 'All') {
      const catKey = PRESS_CATEGORY_MAP[selectedCategory];
      if (catKey) {
        result = result.filter(a => a.press_category === catKey);
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        (a.subtitle || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [articles, selectedCategory, searchQuery]);

  const mediaAssets = [
    { title: "Brand Assets", description: "Logo packages, brand guidelines, and visual identity resources", type: "ZIP", size: "3.2 MB", icon: Building },
    { title: "Executive Photos", description: "High-resolution leadership team photography", type: "ZIP", size: "8.7 MB", icon: Users },
    { title: "Company Fact Sheet", description: "Key statistics, milestones, and company overview", type: "PDF", size: "1.4 MB", icon: FileText },
    { title: "Product Brochures", description: "Comprehensive service and solution overviews", type: "PDF", size: "4.1 MB", icon: Newspaper },
  ];

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="min-h-screen">
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        structuredData={createWebPageSchema(seoData.title, seoData.description, seoData.canonicalUrl)}
      />
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#111827]" aria-label="Hero">
        <div className="absolute inset-0 bg-gradient-to-b from-[#111827] via-[#161b33] to-[#111827] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.25) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center py-20 lg:py-28">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
              <Newspaper className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-[12px] font-medium text-gray-400 tracking-wide">Press Center</span>
            </div>

            <div className="max-w-3xl space-y-5">
              <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                Navigate Wealth{' '}
                <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">in the News</span>
              </h1>
              <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                Stay informed with the latest developments, announcements, and industry recognition from South Africa's leading independent financial advisory firm.
              </p>
            </div>

            <div className="flex justify-center mt-10">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200 px-8 h-12 shadow-lg shadow-purple-600/20"
                onClick={handleDownloadClick}
              >
                Download Media Kit
                <Download className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Company Stats - White Background */}
      <section className="py-12 sm:py-16 section-white border-b border-gray-200">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
            {companyStats.map((stat, index) => (
              <div key={index} className="text-center space-y-2 sm:space-y-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-xl bg-purple-100 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-semibold text-gray-900">
                    {isLoadingStats ? (
                      <span className="inline-block w-16 h-6 bg-gray-200 rounded animate-pulse" />
                    ) : (
                      stat.value
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Search and Filter Section - White Background */}
      <section className="py-8 sm:py-12 section-white border-b border-gray-200">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-stretch sm:items-center justify-between">
            <div className="relative w-full sm:flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search press releases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200 w-full"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              {CATEGORY_TABS.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className={selectedCategory === category 
                    ? "bg-purple-600 hover:bg-purple-700 text-white" 
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* News Section - White Background */}
      <section className="py-16 section-white">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-black text-3xl font-medium mb-4">
              Featured News
            </h2>
            <p className="text-gray-600 text-xl">
              Latest major announcements and company developments.
            </p>
          </div>

          {isLoadingArticles ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
              <span className="ml-3 text-gray-500">Loading press releases...</span>
            </div>
          ) : filteredArticles.length === 0 ? (
            /* No News Available State */
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-8">
                <Newspaper className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-2xl font-medium text-gray-900 mb-4">
                {searchQuery || selectedCategory !== 'All'
                  ? 'No Matching Results'
                  : 'No News Available'}
              </h3>
              <p className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto">
                {searchQuery || selectedCategory !== 'All'
                  ? 'Try adjusting your search or category filter to find press releases.'
                  : "We don't have any press releases or news announcements to share at the moment. Please check back soon for updates on our latest developments and company news."}
              </p>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  For immediate assistance or inquiries, please contact our team directly.
                </p>
                <Button 
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3"
                  asChild
                >
                  <Link to="/contact">
                    Contact Us
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            /* Press Articles Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredArticles.map((article) => (
                <Link
                  key={article.id}
                  to={`/resources/article/${article.slug}`}
                  className="group"
                >
                  <Card className="border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden h-full flex flex-col">
                    {/* Image */}
                    {(article.hero_image_url || article.thumbnail_image_url) && (
                      <div className="aspect-[16/9] overflow-hidden bg-gray-100">
                        <ImageWithFallback
                          src={article.hero_image_url || article.thumbnail_image_url || ''}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}

                    <CardHeader className="p-5 pb-2">
                      {/* Category Badge */}
                      <div className="mb-2">
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                          {PRESS_CATEGORY_LABEL_MAP[article.press_category] || article.press_category}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg text-gray-900 group-hover:text-purple-700 transition-colors line-clamp-2 leading-snug">
                        {article.title}
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="p-5 pt-0 flex-1 flex flex-col">
                      <p className="text-gray-600 text-sm line-clamp-3 mb-4 flex-1">
                        {article.excerpt}
                      </p>

                      <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-3">
                          {article.published_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(article.published_at)}
                            </span>
                          )}
                          {article.reading_time_minutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {article.reading_time_minutes} min
                            </span>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Media Kit Section - Charcoal Background */}
      <section id="media-kit" className="py-12 sm:py-16 section-dark-gray">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-white text-2xl sm:text-3xl font-medium mb-4">
              Media Resources
            </h2>
            <p className="text-white/90 text-base sm:text-xl max-w-2xl mx-auto">
              Access our comprehensive media kit including brand assets, executive materials, and company information.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {mediaAssets.map((asset, index) => (
              <Card key={index} className="bg-white border-gray-200 hover:shadow-xl transition-all duration-300 group text-center">
                <CardHeader className="p-6">
                  <div className="w-16 h-16 mx-auto rounded-xl bg-purple-100 flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                    <asset.icon className="h-8 w-8 text-purple-600" />
                  </div>
                  <CardTitle className="text-lg text-gray-900 mb-2">{asset.title}</CardTitle>
                  <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
                    <Badge variant="outline" className="text-xs border-gray-300">{asset.type}</Badge>
                    <span>{asset.size}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <CardDescription className="text-gray-600 mb-6">
                    {asset.description}
                  </CardDescription>
                  <Button 
                    className="bg-purple-600 hover:bg-purple-700 text-white w-full group"
                    onClick={handleDownloadClick}
                  >
                    Download
                    <Download className="ml-2 h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Media Contact Section - White Background */}
      <section id="contact" className="py-12 sm:py-16 section-white border-t border-gray-200">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10 sm:mb-12">
              <h2 className="text-black text-2xl sm:text-3xl font-medium mb-4">
                Media Contact
              </h2>
              <p className="text-gray-600 text-base sm:text-xl">
                For press inquiries, interviews, and additional information, contact our media relations team.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
              <Card className="border-gray-200 shadow-lg">
                <CardHeader className="p-6">
                  <CardTitle className="text-xl text-gray-900 flex items-center">
                    <Mail className="h-5 w-5 text-purple-600 mr-3" />
                    Media Relations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Email</p>
                    <p className="text-purple-600">info@navigatewealth.co</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Phone</p>
                    <p className="text-gray-600">(+27) 012-667-2505</p>
                  </div>
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-sm text-gray-500">
                      Response time: Within 24 hours during business days
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-lg">
                <CardHeader className="p-6">
                  <CardTitle className="text-xl text-gray-900 flex items-center">
                    <Building className="h-5 w-5 text-purple-600 mr-3" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Founded</span>
                    <span className="font-medium text-gray-900">2009</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Headquarters</span>
                    <span className="font-medium text-gray-900">Pretoria, South Africa</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">FSP License</span>
                    <span className="font-medium text-gray-900">54606</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Website</span>
                    <span className="font-medium text-purple-600">navigatewealth.co</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Media Access Modal */}
      <MediaAccessModal 
        isOpen={isMediaAccessModalOpen} 
        onClose={() => setIsMediaAccessModalOpen(false)} 
      />
    </div>
  );
}