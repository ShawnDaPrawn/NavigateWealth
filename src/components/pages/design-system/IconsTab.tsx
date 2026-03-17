import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import {
  Copy,
  CheckCircle,
  Info,
  Search,
  Home,
  User,
  Users,
  Mail,
  Phone,
  Shield,
  Lock,
  Key,
  Eye,
  EyeOff,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  X,
  Check,
  Plus,
  Minus,
  Edit,
  Trash2,
  Download,
  Upload,
  FileText,
  File,
  Folder,
  Image,
  Calendar,
  Clock,
  MapPin,
  Globe,
  Link,
  ExternalLink,
  Star,
  Heart,
  Bookmark,
  Share2,
  Filter,
  ArrowUpDown,
  MoreHorizontal,
  MoreVertical,
  Loader2,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  MessageSquare,
  Send,
  Building,
  Briefcase,
  TrendingUp,
  TrendingDown,
  BarChart2,
  PieChart,
  DollarSign,
  CreditCard,
  Wallet,
  Target,
  Zap,
  Award,
  Package,
  Layers,
  Grid,
  List,
  Table,
  Clipboard,
  ClipboardCheck,
  Printer,
  Save,
  Undo,
  Redo,
  Maximize2,
  Minimize2,
  Move,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { copyToClipboard as copyToClipboardUtil } from '../../../utils/clipboard';

interface IconEntry {
  name: string;
  component: LucideIcon;
  category: string;
}

const ICON_DATA: IconEntry[] = [
  // Navigation
  { name: 'Home', component: Home, category: 'Navigation' },
  { name: 'ChevronDown', component: ChevronDown, category: 'Navigation' },
  { name: 'ChevronRight', component: ChevronRight, category: 'Navigation' },
  { name: 'ChevronLeft', component: ChevronLeft, category: 'Navigation' },
  { name: 'ChevronUp', component: ChevronUp, category: 'Navigation' },
  { name: 'ArrowRight', component: ArrowRight, category: 'Navigation' },
  { name: 'ArrowLeft', component: ArrowLeft, category: 'Navigation' },
  { name: 'ArrowUp', component: ArrowUp, category: 'Navigation' },
  { name: 'ArrowDown', component: ArrowDown, category: 'Navigation' },
  { name: 'ExternalLink', component: ExternalLink, category: 'Navigation' },
  { name: 'Link', component: Link, category: 'Navigation' },

  // Actions
  { name: 'Plus', component: Plus, category: 'Actions' },
  { name: 'Minus', component: Minus, category: 'Actions' },
  { name: 'X', component: X, category: 'Actions' },
  { name: 'Check', component: Check, category: 'Actions' },
  { name: 'Edit', component: Edit, category: 'Actions' },
  { name: 'Trash2', component: Trash2, category: 'Actions' },
  { name: 'Copy', component: Copy, category: 'Actions' },
  { name: 'Download', component: Download, category: 'Actions' },
  { name: 'Upload', component: Upload, category: 'Actions' },
  { name: 'Save', component: Save, category: 'Actions' },
  { name: 'Undo', component: Undo, category: 'Actions' },
  { name: 'Redo', component: Redo, category: 'Actions' },
  { name: 'RefreshCw', component: RefreshCw, category: 'Actions' },
  { name: 'Send', component: Send, category: 'Actions' },
  { name: 'Printer', component: Printer, category: 'Actions' },
  { name: 'Search', component: Search, category: 'Actions' },
  { name: 'Filter', component: Filter, category: 'Actions' },
  { name: 'ArrowUpDown', component: ArrowUpDown, category: 'Actions' },
  { name: 'Share2', component: Share2, category: 'Actions' },

  // Users & Auth
  { name: 'User', component: User, category: 'Users & Auth' },
  { name: 'Users', component: Users, category: 'Users & Auth' },
  { name: 'Shield', component: Shield, category: 'Users & Auth' },
  { name: 'Lock', component: Lock, category: 'Users & Auth' },
  { name: 'Key', component: Key, category: 'Users & Auth' },
  { name: 'Eye', component: Eye, category: 'Users & Auth' },
  { name: 'EyeOff', component: EyeOff, category: 'Users & Auth' },
  { name: 'LogOut', component: LogOut, category: 'Users & Auth' },

  // Communication
  { name: 'Mail', component: Mail, category: 'Communication' },
  { name: 'Phone', component: Phone, category: 'Communication' },
  { name: 'MessageSquare', component: MessageSquare, category: 'Communication' },
  { name: 'Bell', component: Bell, category: 'Communication' },

  // Business & Finance
  { name: 'Building', component: Building, category: 'Business' },
  { name: 'Briefcase', component: Briefcase, category: 'Business' },
  { name: 'TrendingUp', component: TrendingUp, category: 'Business' },
  { name: 'TrendingDown', component: TrendingDown, category: 'Business' },
  { name: 'BarChart2', component: BarChart2, category: 'Business' },
  { name: 'PieChart', component: PieChart, category: 'Business' },
  { name: 'DollarSign', component: DollarSign, category: 'Business' },
  { name: 'CreditCard', component: CreditCard, category: 'Business' },
  { name: 'Wallet', component: Wallet, category: 'Business' },
  { name: 'Target', component: Target, category: 'Business' },
  { name: 'Award', component: Award, category: 'Business' },

  // Files & Data
  { name: 'FileText', component: FileText, category: 'Files' },
  { name: 'File', component: File, category: 'Files' },
  { name: 'Folder', component: Folder, category: 'Files' },
  { name: 'Image', component: Image, category: 'Files' },
  { name: 'Clipboard', component: Clipboard, category: 'Files' },
  { name: 'ClipboardCheck', component: ClipboardCheck, category: 'Files' },
  { name: 'Table', component: Table, category: 'Files' },

  // Status & Feedback
  { name: 'CheckCircle', component: CheckCircle, category: 'Status' },
  { name: 'AlertCircle', component: AlertCircle, category: 'Status' },
  { name: 'AlertTriangle', component: AlertTriangle, category: 'Status' },
  { name: 'Info', component: Info, category: 'Status' },
  { name: 'Loader2', component: Loader2, category: 'Status' },

  // Layout & UI
  { name: 'Settings', component: Settings, category: 'Layout' },
  { name: 'MoreHorizontal', component: MoreHorizontal, category: 'Layout' },
  { name: 'MoreVertical', component: MoreVertical, category: 'Layout' },
  { name: 'Maximize2', component: Maximize2, category: 'Layout' },
  { name: 'Minimize2', component: Minimize2, category: 'Layout' },
  { name: 'Move', component: Move, category: 'Layout' },
  { name: 'Grid', component: Grid, category: 'Layout' },
  { name: 'List', component: List, category: 'Layout' },
  { name: 'Layers', component: Layers, category: 'Layout' },
  { name: 'Package', component: Package, category: 'Layout' },
  { name: 'ToggleLeft', component: ToggleLeft, category: 'Layout' },
  { name: 'ToggleRight', component: ToggleRight, category: 'Layout' },

  // Misc
  { name: 'Calendar', component: Calendar, category: 'Misc' },
  { name: 'Clock', component: Clock, category: 'Misc' },
  { name: 'MapPin', component: MapPin, category: 'Misc' },
  { name: 'Globe', component: Globe, category: 'Misc' },
  { name: 'Star', component: Star, category: 'Misc' },
  { name: 'Heart', component: Heart, category: 'Misc' },
  { name: 'Bookmark', component: Bookmark, category: 'Misc' },
  { name: 'Zap', component: Zap, category: 'Misc' },
  { name: 'Sparkles', component: Sparkles, category: 'Misc' },
];

const CATEGORIES = ['All', 'Navigation', 'Actions', 'Users & Auth', 'Communication', 'Business', 'Files', 'Status', 'Layout', 'Misc'];

export function IconsTab() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = async (code: string, id: string) => {
    try {
      await copyToClipboardUtil(code);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const filteredIcons = useMemo(() => {
    return ICON_DATA.filter((icon) => {
      if (!icon.component) return false; // Guard against undefined icons
      const matchesSearch = search === '' || icon.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || icon.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: ICON_DATA.length };
    ICON_DATA.forEach((icon) => {
      counts[icon.category] = (counts[icon.category] || 0) + 1;
    });
    return counts;
  }, []);

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Introduction */}
      <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex items-center justify-center">
            <Sparkles className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl md:text-2xl font-bold text-black mb-2 md:mb-3">Icon Library</h3>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
              Navigate Wealth uses <strong>Lucide React</strong> as its icon library. Icons are used at consistent sizes
              across the platform: <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-primary">h-4 w-4</code> for
              inline, <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-primary">h-5 w-5</code> for
              standard, and <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-primary">h-6 w-6</code> for
              prominent placement. Click any icon to copy its import statement.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20">{ICON_DATA.length} Icons</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">Lucide React</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">{CATEGORIES.length - 1} Categories</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat} ({categoryCounts[cat] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Icon Size Reference */}
      <Card className="border-gray-200">
        <CardContent className="p-5 md:p-6">
          <h4 className="text-base font-semibold text-black mb-4">Standard Sizes</h4>
          <div className="flex flex-wrap items-end gap-8">
            {[
              { size: 'h-3 w-3', label: '12px', desc: 'Badges, tags' },
              { size: 'h-4 w-4', label: '16px', desc: 'Inline, buttons' },
              { size: 'h-5 w-5', label: '20px', desc: 'Navigation, menus' },
              { size: 'h-6 w-6', label: '24px', desc: 'Feature cards' },
              { size: 'h-8 w-8', label: '32px', desc: 'Empty states' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-2">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <Shield className={`${s.size} text-primary`} />
                </div>
                <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-black">{s.size}</code>
                <span className="text-xs text-gray-500">{s.label}</span>
                <span className="text-xs text-gray-400">{s.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Icon Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg md:text-xl font-bold text-black">
            {selectedCategory === 'All' ? 'All Icons' : selectedCategory}
          </h3>
          <Badge variant="outline" className="border-gray-300 text-gray-600">
            {filteredIcons.length} {filteredIcons.length === 1 ? 'icon' : 'icons'}
          </Badge>
        </div>

        {filteredIcons.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {filteredIcons.map((icon) => {
              const Icon = icon.component;
              const importCode = `import { ${icon.name} } from 'lucide-react';`;
              const isCopied = copiedCode === icon.name;
              return (
                <button
                  key={icon.name}
                  onClick={() => copyCode(importCode, icon.name)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 group ${
                    isCopied
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-200 hover:border-primary hover:bg-primary/5'
                  }`}
                  title={`Click to copy: ${importCode}`}
                >
                  {isCopied ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Icon className="h-5 w-5 text-gray-700 group-hover:text-primary transition-colors" />
                  )}
                  <span className={`text-xs truncate w-full text-center ${
                    isCopied ? 'text-green-600 font-medium' : 'text-gray-600 group-hover:text-primary'
                  }`}>
                    {isCopied ? 'Copied!' : icon.name}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-black mb-2">No icons found</h3>
            <p className="text-sm text-gray-600 mb-4">
              Try adjusting your search or category filter.
            </p>
            <Button
              variant="outline"
              onClick={() => { setSearch(''); setSelectedCategory('All'); }}
              className="border-primary text-primary hover:bg-primary/10"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Usage Guidelines */}
      <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
        <Alert className="border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-black">Import Pattern</AlertTitle>
          <AlertDescription className="text-gray-600 text-sm">
            <code className="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">
              {"import { IconName } from 'lucide-react';"}
            </code>
            <br />
            Always use named imports for tree-shaking. Never import the entire library.
          </AlertDescription>
        </Alert>

        <Alert className="border-primary/20 bg-primary/5">
          <Shield className="h-4 w-4 text-primary" />
          <AlertTitle className="text-black">Colour Convention</AlertTitle>
          <AlertDescription className="text-gray-600 text-sm">
            Use <code className="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">text-primary</code> for
            brand icons, <code className="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">text-gray-500</code> for
            muted, and semantic colours for status (green/amber/red).
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}