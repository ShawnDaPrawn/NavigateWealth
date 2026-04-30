import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getUserErrorMessage } from '../../utils/errorUtils';
import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  History,
  Search,
  Eye,
  Download,
  Star,
  FileText,
  Calendar,
  Heart,
  Shield,
  TrendingUp,
  Activity,
  Briefcase,
  Home,
  ChevronRight,
  Plus,
  Link as LinkIcon,
  Upload,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { PortalPageHeader } from '../portal/PortalPageHeader';
import { ACTIVE_THEME } from '../portal/portal-theme';

interface HistoryItem {
  id: string;
  type: 'document' | 'link';
  title: string;
  uploadDate: Date;
  productCategory: 'Life' | 'Short-Term' | 'Investment' | 'Medical Aid' | 'Retirement' | 'Estate';
  policyNumber: string;
  status: 'new' | 'viewed';
  isFavourite: boolean;
  // Document specific
  fileName?: string;
  fileSize?: string;
  // Link specific
  url?: string;
  description?: string;
}

// NOTE: mockHistoryItems removed — documents are now fetched from the backend
// via /documents/:userId endpoint (see useEffect below)

export function HistoryPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch documents on mount and when user changes
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      const userId = user.id; // Store userId to avoid null reference issues

      try {
        setIsLoading(true);

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${userId}`,
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch documents');
        }

        const data = await response.json();
        
        // Transform API data to match HistoryItem interface
        const transformedItems: HistoryItem[] = data.documents.map((doc: { id: string; type: string; title: string; uploadDate: string; productCategory: string; policyNumber?: string; status: string; isFavourite: boolean; fileName?: string; fileSize?: number; url?: string; description?: string }) => ({
          id: doc.id,
          type: doc.type,
          title: doc.title,
          uploadDate: new Date(doc.uploadDate),
          productCategory: doc.productCategory as HistoryItem['productCategory'],
          policyNumber: doc.policyNumber || '',
          status: doc.status,
          isFavourite: doc.isFavourite,
          fileName: doc.fileName,
          fileSize: doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(2)} MB` : undefined,
          url: doc.url,
          description: doc.description
        }));
        
        setItems(transformedItems);
      } catch (error: unknown) {
        toast.error(getUserErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [user?.id]);

  // Filter items
  const filteredItems = useMemo(() => {
    let filtered = [...items];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(query) ||
        (item.fileName && item.fileName.toLowerCase().includes(query)) ||
        (item.url && item.url.toLowerCase().includes(query)) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        item.policyNumber.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.productCategory === selectedCategory);
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      const ranges: { [key: string]: number } = {
        'week': 7,
        'month': 30,
        '3months': 90,
        'year': 365
      };
      const days = ranges[dateRange];
      if (days) {
        const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        filtered = filtered.filter(item => item.uploadDate >= cutoffDate);
      }
    }

    return filtered.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
  }, [items, searchQuery, selectedCategory, dateRange]);

  const toggleFavourite = async (id: string) => {
    if (!user?.id) return;
    const userId = user.id; // Store userId to avoid null reference issues

    const item = items.find(i => i.id === id);
    if (!item) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${userId}/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ isFavourite: !item.isFavourite })
        }
      );

      if (response.ok) {
        setItems(prev => 
          prev.map(item => 
            item.id === id ? { ...item, isFavourite: !item.isFavourite } : item
          )
        );
      }
    } catch (error: unknown) {
      // Silent fail for non-critical functionality
    }
  };

  const handleView = async (item: HistoryItem) => {
    if (item.type === 'link' && item.url) {
      window.open(item.url, '_blank');
      await markAsViewed(item);
    } else if (item.type === 'document') {
      await handleDownload(item);
    }
  };

  const handleDownload = async (item: HistoryItem) => {
    if (item.type !== 'document' || !user?.id) return;
    const userId = user.id; // Store userId to avoid null reference issues

    try {

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${userId}/${item.id}/download`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const data = await response.json();
      
      // Open signed URL in new tab
      window.open(data.url, '_blank');
      
      // Mark as viewed
      await markAsViewed(item);
    } catch (error: unknown) {
      toast.error('Failed to download document');
    }
  };

  const markAsViewed = async (item: HistoryItem) => {
    if (item.status === 'viewed' || !user?.id) return;
    const userId = user.id; // Store userId to avoid null reference issues

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${userId}/${item.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'viewed' })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Failed to mark as viewed:', response.status, errorData);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setItems(prev =>
          prev.map(i => i.id === item.id ? { ...i, status: 'viewed' as const } : i)
        );
      }
    } catch (error: unknown) {
      // Silently fail - this is not critical functionality
    }
  };



  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Life':
        return <Heart className="h-4 w-4" />;
      case 'Short-Term':
        return <Shield className="h-4 w-4" />;
      case 'Investment':
        return <TrendingUp className="h-4 w-4" />;
      case 'Medical Aid':
        return <Activity className="h-4 w-4" />;
      case 'Retirement':
        return <Briefcase className="h-4 w-4" />;
      case 'Estate':
        return <Home className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Life':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Short-Term':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Investment':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'Medical Aid':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Retirement':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Estate':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Stats
  const totalItems = items.length;
  const totalDocs = items.filter(i => i.type === 'document').length;
  const totalLinks = items.filter(i => i.type === 'link').length;
  const newItems = items.filter(i => i.status === 'new').length;
  const favouriteItems = items.filter(i => i.isFavourite).length;

  return (
    <div className={`min-h-screen ${ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'}`}>
      <PortalPageHeader
        title="Document History"
        subtitle="Access all your policy documents and links"
        icon={History}
        compact
      />
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Stats Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Items</span>
                  <span className="text-gray-900">{totalItems}</span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Documents</span>
                  <span className="text-gray-900">{totalDocs}</span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Links</span>
                  <span className="text-gray-900">{totalLinks}</span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">New</span>
                  <Badge className="bg-blue-100 text-blue-800">{newItems}</Badge>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Favourites</span>
                  <span className="text-gray-900">{favouriteItems}</span>
                </div>
              </CardContent>
            </Card>

            {/* Category Legend */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'Life Insurance', icon: Heart, color: 'text-red-600' },
                  { name: 'Short-Term', icon: Shield, color: 'text-blue-600' },
                  { name: 'Investment', icon: TrendingUp, color: 'text-green-600' },
                  { name: 'Medical Aid', icon: Activity, color: 'text-purple-600' },
                  { name: 'Retirement', icon: Briefcase, color: 'text-orange-600' },
                  { name: 'Estate', icon: Home, color: 'text-amber-600' }
                ].map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <div key={cat.name} className="flex items-center gap-2 text-sm text-gray-600">
                      <Icon className={`h-4 w-4 ${cat.color}`} />
                      <span>{cat.name}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Search and Filters */}
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      placeholder="Search documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 h-11"
                    />
                  </div>

                  {/* Filter Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Category Filter */}
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="Life">Life Insurance</SelectItem>
                        <SelectItem value="Short-Term">Short-Term Insurance</SelectItem>
                        <SelectItem value="Investment">Investments</SelectItem>
                        <SelectItem value="Medical Aid">Medical Aid</SelectItem>
                        <SelectItem value="Retirement">Retirement</SelectItem>
                        <SelectItem value="Estate">Estate Planning</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Date Range Filter */}
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="All Time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="week">Last 7 Days</SelectItem>
                        <SelectItem value="month">Last 30 Days</SelectItem>
                        <SelectItem value="3months">Last 3 Months</SelectItem>
                        <SelectItem value="year">Last Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {filteredItems.length} of {items.length} items
              </p>
              {(searchQuery || selectedCategory !== 'all' || dateRange !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setDateRange('all');
                  }}
                  className="text-[#6d28d9] hover:text-[#5b21b6]"
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Item List */}
            <div className="space-y-3">
              {isLoading ? (
                <Card className="border-gray-200 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-3 animate-spin" />
                    <p className="text-gray-600">Loading your documents...</p>
                  </CardContent>
                </Card>
              ) : filteredItems.length === 0 ? (
                <Card className="border-gray-200 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">
                      {items.length === 0 ? 'No documents yet' : 'No items found'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {items.length === 0 
                        ? 'Your advisor will upload documents and links for you here' 
                        : 'Try adjusting your search or filters'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredItems.map((item) => (
                  <Card 
                    key={item.id} 
                    className="border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="flex-shrink-0">
                          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                            item.type === 'link' 
                              ? 'bg-purple-50' 
                              : 'bg-red-50'
                          }`}>
                            {item.type === 'link' ? (
                              <LinkIcon className="h-6 w-6 text-purple-600" />
                            ) : (
                              <FileText className="h-6 w-6 text-red-600" />
                            )}
                          </div>
                        </div>

                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-gray-900 truncate">
                                  {item.title}
                                </h3>
                                {item.status === 'new' && (
                                  <Badge className="bg-blue-100 text-blue-800 text-xs">New</Badge>
                                )}
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    item.type === 'link' 
                                      ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                      : 'bg-gray-50 text-gray-700 border-gray-200'
                                  }`}
                                >
                                  {item.type === 'link' ? 'Link' : 'Document'}
                                </Badge>
                              </div>
                              
                              {item.type === 'document' && item.fileName && (
                                <p className="text-sm text-gray-600 mb-2">{item.fileName}</p>
                              )}
                              
                              {item.type === 'link' && item.url && (
                                <p className="text-sm text-purple-600 mb-2 truncate">{item.url}</p>
                              )}
                              
                              {item.type === 'link' && item.description && (
                                <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                              )}
                              
                              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-4 w-4" />
                                  {formatDate(item.uploadDate)}
                                </div>
                                {item.type === 'document' && item.fileSize && (
                                  <div className="contents">
                                    <span>•</span>
                                    <span>{item.fileSize}</span>
                                  </div>
                                )}
                                {item.policyNumber && (
                                  <div className="contents">
                                    <span>•</span>
                                    <span className="text-gray-600">{item.policyNumber}</span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="mt-3">
                                <Badge 
                                  variant="outline" 
                                  className={`${getCategoryColor(item.productCategory)} gap-1.5`}
                                >
                                  {getCategoryIcon(item.productCategory)}
                                  {item.productCategory}
                                </Badge>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleFavourite(item.id)}
                                className={item.isFavourite ? 'text-yellow-600' : 'text-gray-400'}
                              >
                                <Star className={`h-5 w-5 ${item.isFavourite ? 'fill-current' : ''}`} />
                              </Button>
                              {item.type === 'document' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownload(item)}
                                  className="gap-2"
                                >
                                  <Download className="h-4 w-4" />
                                  Download
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleView(item)}
                                className="bg-[#6d28d9] hover:bg-[#5b21b6] gap-2"
                              >
                                {item.type === 'link' ? (
                                  <div className="contents">
                                    <ExternalLink className="h-4 w-4" />
                                    Open
                                  </div>
                                ) : (
                                  <div className="contents">
                                    <Eye className="h-4 w-4" />
                                    View
                                  </div>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HistoryPage;
