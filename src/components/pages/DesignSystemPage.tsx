import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  Palette,
  Component,
  Type,
  Grid,
  Code,
  Copy,
  CheckCircle,
  AlertCircle,
  Info,
  Terminal,
  Layers,
  Box,
  Mail,
  Lock,
  Eye,
  User,
  Shield,
  Bell,
  LogOut,
  ChevronDown,
  MessageSquare,
  Key,
  Building,
  Users as UsersIcon,
  TrendingUp,
  Clock,
  Home,
  PieChart,
  Package,
  CreditCard,
  FileText,
  Target,
  Calculator,
  Grid3X3,
  Settings,
  UserCheck,
  Download,
  FolderArchive,
  Loader2,
  X,
  ArrowRight,
  Briefcase,
  Sparkles,
  Phone,
  Search,
  ArrowUp,
} from 'lucide-react';
import { CodebaseDownload } from '../modules/codebase/CodebaseDownload';
import { DownloadCodebaseTab } from '../modules/codebase/DownloadCodebaseTab';
import { copyToClipboard as copyToClipboardUtil } from '../../utils/clipboard';
import { TypographyTab } from './design-system/TypographyTab';
import { IconsTab } from './design-system/IconsTab';
import { PatternsTab } from './design-system/PatternsTab';

// ─── Tab configuration ───────────────────────────────────────────────
const TABS = [
  { value: 'overview',    label: 'Overview',    icon: Info },
  { value: 'colors',      label: 'Colours',     icon: Palette },
  { value: 'typography',  label: 'Typography',  icon: Type },
  { value: 'components',  label: 'Components',  icon: Component },
  { value: 'patterns',    label: 'Patterns',    icon: Grid3X3 },
  { value: 'icons',       label: 'Icons',       icon: Sparkles },
  { value: 'sections',    label: 'Sections',    icon: Layers },
  { value: 'download',    label: 'Download',    icon: Download },
] as const;

export default function DesignSystemPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [componentSearch, setComponentSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [sectionSearch, setSectionSearch] = useState('');
  const [selectedSectionType, setSelectedSectionType] = useState('all');
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

  const copyToClipboard = async (code: string, id: string) => {
    try {
      await copyToClipboardUtil(code);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // ─── Color palette data ──────────────────────────────────────────────
  const colorPalette = [
    {
      name: 'Primary Purple',
      value: '#6d28d9',
      tailwind: 'bg-primary text-primary border-primary',
      category: 'Brand',
      description: 'Main brand purple for buttons, accents, and primary actions',
      usage: ['Buttons', 'Links', 'Active states', 'Icons'],
    },
    {
      name: 'White',
      value: '#ffffff',
      tailwind: 'bg-white text-white border-white',
      category: 'Backgrounds',
      description: 'Primary background color for clean sections',
      usage: ['Page backgrounds', 'Cards', 'Modals', 'Content areas'],
    },
    {
      name: 'Black',
      value: '#000000',
      tailwind: 'bg-black text-black border-black',
      category: 'Text',
      description: 'Primary text color and dark sections',
      usage: ['Headings', 'Body text', 'Hero sections', 'Dark backgrounds'],
    },
    {
      name: 'Dark Navy',
      value: '#313653',
      tailwind: 'bg-[#313653] text-[#313653] border-[#313653]',
      category: 'Backgrounds',
      description: 'Primary dark section background — used for all hero areas and dark alternating sections via the section-dark-gray utility class',
      usage: ['Hero sections', 'Dark alternating sections', 'CTA blocks', 'Footer areas'],
    },
    {
      name: 'Light Gray',
      value: '#f8f9fa',
      tailwind: 'bg-gray-50 text-gray-50 border-gray-50',
      category: 'Backgrounds',
      description: 'Subtle light gray for input backgrounds, skeleton loaders, and card interiors',
      usage: ['Input backgrounds', 'Skeleton loaders', 'Subtle card fills'],
    },
    {
      name: 'Muted Gray',
      value: '#64748b',
      tailwind: 'bg-gray-500 text-gray-600 border-gray-500',
      category: 'Text',
      description: 'Muted text color for secondary content',
      usage: ['Secondary text', 'Captions', 'Descriptions', 'Placeholders'],
    },
    {
      name: 'Border Gray',
      value: 'rgba(0, 0, 0, 0.1)',
      tailwind: 'border-gray-200',
      category: 'Borders',
      description: 'Light borders and dividers',
      usage: ['Card borders', 'Dividers', 'Input borders', 'Separators'],
    },
    {
      name: 'Success Green',
      value: '#22c55e',
      tailwind: 'bg-green-500 text-green-500 border-green-500',
      category: 'Status',
      description: 'Success states and positive actions',
      usage: ['Success messages', 'Checkmarks', 'Positive indicators'],
    },
    {
      name: 'Warning Yellow',
      value: '#eab308',
      tailwind: 'bg-yellow-500 text-yellow-500 border-yellow-500',
      category: 'Status',
      description: 'Warning states and attention indicators',
      usage: ['Warning messages', 'Pending states', 'Caution indicators'],
    },
    {
      name: 'Error Red',
      value: '#ef4444',
      tailwind: 'bg-red-500 text-red-500 border-red-500',
      category: 'Status',
      description: 'Error states and destructive actions',
      usage: ['Error messages', 'Delete actions', 'Critical alerts'],
    },
  ];

  // ─── Components data ─────────────────────────────────────────────────
  const components = [
    {
      id: 'button',
      name: 'Button',
      category: 'Form',
      description: 'Interactive elements for actions and navigation with primary purple styling',
      variants: ['Primary', 'Outline', 'Ghost', 'Destructive', 'Loading'],
      code: `import { Button } from './components/ui/button';
import { Loader2 } from 'lucide-react';

<Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
  Primary Button
</Button>

<Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
  Outline Button
</Button>

<Button variant="ghost" className="text-gray-700 hover:text-primary">
  Ghost Button
</Button>

<Button variant="destructive">Delete</Button>

<Button disabled>
  <Loader2 className="h-4 w-4 animate-spin mr-2" />
  Loading...
</Button>`,
      component: (
        <div className="flex flex-wrap items-center gap-3">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Primary</Button>
          <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">Outline</Button>
          <Button variant="ghost" className="text-gray-700 hover:text-primary">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled className="bg-primary text-white">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading...
          </Button>
        </div>
      ),
    },
    {
      id: 'badge-variants',
      name: 'Badge',
      category: 'Display',
      description: 'Small labels for status, categories, and counts. Config-driven status badges use the standard colour vocabulary.',
      variants: ['Default', 'Secondary', 'Outline', 'Status Colours'],
      code: `import { Badge } from './components/ui/badge';

{/* Standard variants */}
<Badge className="bg-primary text-primary-foreground">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="outline">Outline</Badge>

{/* Status colours (config-driven) */}
<Badge className="bg-green-600 text-white">Active</Badge>
<Badge className="bg-amber-500 text-white">Suspended</Badge>
<Badge className="bg-red-600 text-white">Closed</Badge>
<Badge className="bg-blue-600 text-white">Preview</Badge>`,
      component: (
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-primary text-primary-foreground">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge className="bg-green-600 text-white">Active</Badge>
          <Badge className="bg-amber-500 text-white">Suspended</Badge>
          <Badge className="bg-red-600 text-white">Closed</Badge>
          <Badge className="bg-blue-600 text-white">Preview</Badge>
          <Badge className="bg-primary/10 text-primary border-primary/20">Soft</Badge>
        </div>
      ),
    },
    {
      id: 'card-variants',
      name: 'Card',
      category: 'Display',
      description: 'Container component for grouping related content with header, content, and description slots.',
      variants: ['Standard', 'With Header', 'Interactive'],
      code: `import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card';

<Card className="border-gray-200">
  <CardHeader>
    <CardTitle className="text-black">Card Title</CardTitle>
    <CardDescription className="text-gray-600">Description text</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-gray-600">Card body content goes here.</p>
  </CardContent>
</Card>

{/* Interactive card with hover */}
<Card className="border-gray-200 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
  <CardContent className="p-6">
    <h4 className="text-base font-semibold text-black">Clickable Card</h4>
  </CardContent>
</Card>`,
      component: (
        <div className="grid sm:grid-cols-2 gap-4 w-full max-w-lg">
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-black">Standard Card</CardTitle>
              <CardDescription className="text-sm text-gray-600">With header slots</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Card body content.</p>
            </CardContent>
          </Card>
          <Card className="border-gray-200 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="p-5">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <h4 className="text-base font-semibold text-black mb-1">Interactive Card</h4>
              <p className="text-sm text-gray-600">Hover to see effect</p>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'alert-variants',
      name: 'Alert',
      category: 'Feedback',
      description: 'Contextual feedback messages for success, warning, error, and informational states.',
      variants: ['Info', 'Success', 'Warning', 'Error'],
      code: `import { Alert, AlertTitle, AlertDescription } from './components/ui/alert';
import { Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

<Alert className="border-primary/20 bg-primary/5">
  <Info className="h-4 w-4 text-primary" />
  <AlertTitle className="text-black">Information</AlertTitle>
  <AlertDescription className="text-gray-600 text-sm">Helpful context here.</AlertDescription>
</Alert>

<Alert className="border-green-200 bg-green-50">
  <CheckCircle className="h-4 w-4 text-green-600" />
  <AlertTitle className="text-green-800">Success</AlertTitle>
  <AlertDescription className="text-green-700 text-sm">Operation completed.</AlertDescription>
</Alert>`,
      component: (
        <div className="space-y-3 w-full max-w-md">
          <Alert className="border-primary/20 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-black">Information</AlertTitle>
            <AlertDescription className="text-gray-600 text-sm">Helpful context for the user.</AlertDescription>
          </Alert>
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700 text-sm">Changes saved successfully.</AlertDescription>
          </Alert>
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Error</AlertTitle>
            <AlertDescription className="text-red-700 text-sm">Unable to load data. Please retry.</AlertDescription>
          </Alert>
        </div>
      ),
    },
    {
      id: 'dialog-modal',
      name: 'Dialog / Modal',
      category: 'Overlay',
      description: 'Modal dialogs for confirmations, forms, and focused interactions. Always include a clear title and close mechanism.',
      variants: ['Standard', 'With Form'],
      code: `import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';

<Dialog>
  <DialogTrigger asChild>
    <Button className="bg-primary text-white">Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>Are you sure you want to proceed?</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button className="bg-primary text-white">Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`,
      component: (
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-black">Confirm Action</DialogTitle>
              <DialogDescription className="text-gray-600">
                Are you sure you want to proceed with this action? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="border-gray-300">Cancel</Button>
              <Button className="bg-primary hover:bg-primary/90 text-white">Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ),
    },
    {
      id: 'avatar',
      name: 'Avatar with Fallback',
      category: 'Display',
      description: 'User profile avatars with fallback initials using purple styling',
      variants: ['Small', 'Medium', 'Large'],
      code: `import { Avatar, AvatarFallback } from './components/ui/avatar';

<Avatar className="w-12 h-12">
  <AvatarFallback className="bg-purple-600 text-white">JD</AvatarFallback>
</Avatar>

<Avatar className="w-8 h-8">
  <AvatarFallback className="bg-primary/20 text-primary">AB</AvatarFallback>
</Avatar>`,
      component: (
        <div className="flex items-center space-x-4">
          <Avatar className="w-12 h-12">
            <AvatarFallback className="bg-purple-600 text-white font-medium">JD</AvatarFallback>
          </Avatar>
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-primary text-primary-foreground font-medium text-sm">AB</AvatarFallback>
          </Avatar>
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">CD</AvatarFallback>
          </Avatar>
        </div>
      ),
    },
    {
      id: 'form-components',
      name: 'Form Controls',
      category: 'Form',
      description: 'Input, select, textarea, checkbox, switch, and label elements with consistent styling',
      variants: ['Input', 'Select', 'Textarea', 'Checkbox', 'Switch'],
      code: `import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Checkbox } from './components/ui/checkbox';
import { Switch } from './components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';

<div className="space-y-4">
  <div>
    <Label htmlFor="email">Email Address</Label>
    <Input id="email" type="email" placeholder="Enter your email" className="mt-1" />
  </div>

  <div>
    <Label htmlFor="message">Message</Label>
    <Textarea id="message" placeholder="Type your message..." className="mt-1" />
  </div>

  <div className="flex items-center space-x-2">
    <Checkbox id="terms" />
    <Label htmlFor="terms" className="text-sm">I accept the terms and conditions</Label>
  </div>

  <div className="flex items-center space-x-2">
    <Switch id="notifications" />
    <Label htmlFor="notifications" className="text-sm">Enable notifications</Label>
  </div>
</div>`,
      component: (
        <div className="space-y-4 max-w-sm w-full">
          <div>
            <Label htmlFor="ds-email" className="text-sm font-medium text-black">Email Address</Label>
            <Input id="ds-email" type="email" placeholder="Enter your email" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="ds-service" className="text-sm font-medium text-black">Select Service</Label>
            <Select>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="investment">Investment Management</SelectItem>
                <SelectItem value="retirement">Retirement Planning</SelectItem>
                <SelectItem value="risk">Risk Management</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ds-msg" className="text-sm font-medium text-black">Message</Label>
            <Textarea id="ds-msg" placeholder="Type your message..." className="mt-1" rows={2} />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="ds-terms" />
            <Label htmlFor="ds-terms" className="text-sm text-gray-700 cursor-pointer">I accept the terms</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="ds-notif" />
            <Label htmlFor="ds-notif" className="text-sm text-gray-700 cursor-pointer">Enable notifications</Label>
          </div>
        </div>
      ),
    },
    {
      id: 'progress',
      name: 'Progress Indicator',
      category: 'Feedback',
      description: 'Visual progress tracking for multi-step processes and loading operations',
      variants: ['Default', 'With Label'],
      code: `import { Progress } from './components/ui/progress';
import { Badge } from './components/ui/badge';

const progress = (currentStep / totalSteps) * 100;

<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span>Progress</span>
    <span>{Math.round(progress)}% Complete</span>
  </div>
  <Progress value={progress} className="h-2" />
  <Badge className="bg-primary text-primary-foreground">Step 2 of 4</Badge>
</div>`,
      component: (
        <div className="space-y-2 max-w-sm w-full">
          <div className="flex justify-between text-sm text-black">
            <span>Progress</span>
            <span>50% Complete</span>
          </div>
          <Progress value={50} className="h-2" />
          <Badge className="bg-primary text-primary-foreground">Step 2 of 4</Badge>
        </div>
      ),
    },
    {
      id: 'skeleton',
      name: 'Skeleton',
      category: 'Feedback',
      description: 'Placeholder loading states that mirror the shape of the final content to prevent layout shift.',
      variants: ['Text', 'Card', 'Avatar'],
      code: `import { Skeleton } from './components/ui/skeleton';

{/* Text skeleton */}
<div className="space-y-2">
  <Skeleton className="h-4 w-48" />
  <Skeleton className="h-4 w-64" />
  <Skeleton className="h-4 w-40" />
</div>

{/* Card skeleton */}
<div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
  <Skeleton className="h-10 w-10 rounded-full" />
  <div className="flex-1 space-y-2">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-3 w-48" />
  </div>
</div>`,
      component: (
        <div className="space-y-4 max-w-sm w-full">
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'tooltip',
      name: 'Tooltip',
      category: 'Overlay',
      description: 'Contextual help text shown on hover. Used for icon-only buttons, truncated labels, and info hints.',
      variants: ['Default'],
      code: `import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline" size="sm">Hover me</Button>
    </TooltipTrigger>
    <TooltipContent>
      <p className="text-sm">Helpful tooltip text</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>`,
      component: (
        <TooltipProvider>
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="border-gray-300">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">Helpful tooltip text</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <Info className="h-5 w-5 text-gray-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">More information</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      ),
    },
    {
      id: 'dashboard-navigation',
      name: 'Dashboard Navigation',
      category: 'Navigation',
      description: 'Horizontal navigation bar for authenticated dashboard pages with active state indicators using primary purple',
      variants: ['Horizontal'],
      code: `import { Link, useLocation } from 'react-router';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/products-services', label: 'Products', icon: Package },
];

<nav className="border-b border-gray-200 bg-white">
  <div className="flex space-x-8 overflow-x-auto">
    {navItems.map((item) => {
      const Icon = item.icon;
      return (
        <Link key={item.path} to={item.path}
          className={\`flex items-center space-x-2 py-4 px-1 border-b-2 \${
            isActive(item.path)
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }\`}>
          <Icon className="h-4 w-4" />
          <span className="text-sm font-medium">{item.label}</span>
        </Link>
      );
    })}
  </div>
</nav>`,
      component: (
        <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="border-b border-gray-200 bg-white px-4">
            <div className="flex space-x-8 overflow-x-auto">
              {[
                { label: 'Dashboard', icon: Home, active: true },
                { label: 'Products', icon: Package, active: false },
                { label: 'Cashback', icon: CreditCard, active: false },
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={index}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 whitespace-nowrap transition-colors ${
                      item.active
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'user-profile-dropdown',
      name: 'User Profile Dropdown',
      category: 'Navigation',
      description: 'User menu with profile access, security settings, communication preferences, and logout',
      variants: ['Full'],
      code: `import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from './components/ui/avatar';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" className="flex items-center space-x-3 h-auto p-2">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-primary/20 text-primary">JD</AvatarFallback>
      </Avatar>
      <div className="flex flex-col items-start">
        <span className="text-sm font-medium">John Doe</span>
        <span className="text-xs text-muted-foreground">Personal Client</span>
      </div>
      <ChevronDown className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-80" align="end">
    {/* Profile, Security, Communication sections */}
  </DropdownMenuContent>
</DropdownMenu>`,
      component: (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-3 h-auto p-2 hover:bg-gray-50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">JD</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium text-black">John Doe</span>
                  <span className="text-xs text-gray-500">Personal Client</span>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-black">John Doe</p>
                  <p className="text-xs leading-none text-gray-500">john.doe@example.com</p>
                  <p className="text-xs leading-none text-primary">Personal Client</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem><User className="mr-2 h-4 w-4" /><span>View Profile</span></DropdownMenuItem>
              <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /><span>Account Settings</span></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem><Key className="mr-2 h-4 w-4" /><span>Change Password</span></DropdownMenuItem>
              <DropdownMenuItem><Shield className="mr-2 h-4 w-4" /><span>Two-Factor Auth</span></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                <LogOut className="mr-2 h-4 w-4" /><span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
    {
      id: 'navigation-dropdown',
      name: 'Navigation Menu Item',
      category: 'Navigation',
      description: 'Main navigation dropdown menu items for Services, Solutions, and Company sections',
      variants: ['Mega Menu'],
      code: `<div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
  <div className="space-y-3">
    <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
      <TrendingUp className="h-5 w-5 text-primary" />
      <div>
        <div className="font-medium text-black">Investment Management</div>
        <div className="text-sm text-gray-600">Grow your wealth</div>
      </div>
    </div>
  </div>
</div>`,
      component: (
        <div className="flex justify-center">
          <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm w-full max-w-xs">
            <div className="space-y-1">
              {[
                { icon: TrendingUp, label: 'Investment Management', desc: 'Grow your wealth with expert guidance' },
                { icon: Shield, label: 'Risk Management', desc: 'Protect your financial future' },
                { icon: Calculator, label: 'Tax Planning', desc: 'Optimise your tax position' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-black">{item.label}</div>
                      <div className="text-xs text-gray-600">{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ),
    },
  ];

  // ─── Sections data ───────────────────────────────────────────────────
  const sections = [
    {
      id: 'section-white', name: 'White Section', type: 'Background',
      description: 'Clean white background section (default) - perfect for main content areas',
      usage: ['Main content', 'Product pages', 'Information sections'],
      textColor: 'Dark',
      code: `<section className="section-white py-20 px-4">
  <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
    <h2 className="text-black mb-6">Section Title</h2>
    <p className="text-gray-600">Section content goes here...</p>
  </div>
</section>`,
      className: 'section-white',
    },
    {
      id: 'section-dark-gray', name: 'Dark Navy Section (Standard Dark)', type: 'Background',
      description: 'Dark navy (#313653) — the standard dark section used for all heroes and dark alternating sections across every page. Use this as the default choice for any dark background.',
      usage: ['Hero sections', 'Dark alternating sections', 'CTA blocks', 'Testimonial areas'],
      textColor: 'Light',
      code: `<section className="section-dark-gray py-20 px-4">
  <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
    <h2 className="text-white mb-6">Section Title</h2>
    <p className="text-gray-300">Section content goes here...</p>
  </div>
</section>`,
      className: 'section-dark-gray',
    },
    {
      id: 'section-black', name: 'Black Section', type: 'Background',
      description: 'Pure black background for maximum contrast. Prefer section-dark-gray for standard dark sections.',
      usage: ['High-contrast specials', 'Rare emphasis areas'],
      textColor: 'Light',
      code: `<section className="section-black py-20 px-4">
  <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
    <h2 className="text-white mb-6">Section Title</h2>
    <p className="text-gray-300">Section content goes here...</p>
  </div>
</section>`,
      className: 'section-black',
    },
    {
      id: 'gradient-section', name: 'Gradient Section', type: 'Background',
      description: 'Hero gradient background for impactful sections using charcoal tones',
      usage: ['Hero sections', 'Landing pages', 'Call-to-action areas'],
      textColor: 'Light',
      code: `<section className="bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 py-20 px-4">
  <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
    <h2 className="text-white mb-6">Section Title</h2>
  </div>
</section>`,
      className: 'bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800',
    },
    {
      id: 'section-primary', name: 'Primary Purple Section', type: 'Background',
      description: 'Bold primary purple background for strong call-to-action sections',
      usage: ['CTA sections', 'Promotions', 'Highlights'],
      textColor: 'Light',
      code: `<section className="bg-primary py-20 px-4">
  <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
    <h2 className="text-primary-foreground mb-6">Section Title</h2>
  </div>
</section>`,
      className: 'bg-primary',
    },
    {
      id: 'two-column-layout', name: 'Two Column Layout', type: 'Layout',
      description: 'Responsive two-column grid layout for content and imagery',
      usage: ['Service pages', 'About sections', 'Feature descriptions'],
      textColor: 'Flexible',
      code: `<div className="grid md:grid-cols-2 gap-12">
  <div>
    <h2 className="text-black mb-6">Column One</h2>
    <p className="text-gray-600">Content...</p>
  </div>
  <div>
    <h2 className="text-black mb-6">Column Two</h2>
    <p className="text-gray-600">Content...</p>
  </div>
</div>`,
      className: 'section-white',
    },
    {
      id: 'three-column-grid', name: 'Three Column Grid', type: 'Layout',
      description: 'Responsive three-column grid for features, services, or team members',
      usage: ['Features', 'Services grid', 'Team showcase'],
      textColor: 'Flexible',
      code: `<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
  <div className="p-6 bg-gray-50 rounded-lg">
    <h3 className="text-black mb-3">Item One</h3>
    <p className="text-gray-600 text-sm">Description...</p>
  </div>
</div>`,
      className: 'section-white',
    },
    {
      id: 'hero-centered', name: 'Centered Hero', type: 'Hero',
      description: 'Centered hero section with title, description, and CTA buttons — section-dark-gray is the standard for all hero backgrounds',
      usage: ['Landing pages', 'Page headers', 'Service intros'],
      textColor: 'Light',
      code: `<section className="section-dark-gray py-24 px-4 text-center">
  <h1 className="text-white mb-6">
    Your Wealth <span className="text-primary">Journey</span>
  </h1>
  <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
    Expert financial guidance tailored to your unique goals
  </p>
  <div className="flex gap-4 justify-center">
    <Button className="bg-primary text-white">Get Started</Button>
    <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">Learn More</Button>
  </div>
</section>`,
      className: 'section-dark-gray',
    },
    {
      id: 'cta-section', name: 'Call to Action', type: 'CTA',
      description: 'Focused call-to-action section — can use section-dark-gray for a standard dark CTA, or bg-primary for a high-emphasis purple CTA',
      usage: ['Contact prompts', 'Sign up areas', 'Conversion sections'],
      textColor: 'Light',
      code: `{/* Standard dark CTA */}
<section className="section-dark-gray py-16 px-4 text-center">
  <h2 className="text-white mb-4">Ready to Get Started?</h2>
  <p className="text-xl text-gray-300 mb-8">
    Take the first step towards financial success
  </p>
  <Button className="bg-primary text-white hover:bg-primary/90">
    Schedule Consultation
  </Button>
</section>

{/* High-emphasis purple CTA */}
<section className="bg-primary py-16 px-4 text-center">
  <h2 className="text-primary-foreground mb-4">Ready to Get Started?</h2>
  <Button className="bg-white text-primary hover:bg-gray-100">
    Contact Us Today
  </Button>
</section>`,
      className: 'section-dark-gray',
    },
  ];

  // Derived counts
  const componentCategories = ['all', ...Array.from(new Set(components.map((c) => c.category)))];
  const sectionTypes = ['all', ...Array.from(new Set(sections.map((s) => s.type)))];

  const filteredComponents = components.filter(
    (c) =>
      (selectedCategory === 'all' || c.category === selectedCategory) &&
      (componentSearch === '' ||
        c.name.toLowerCase().includes(componentSearch.toLowerCase()) ||
        c.description.toLowerCase().includes(componentSearch.toLowerCase())),
  );

  const filteredSections = sections.filter(
    (s) =>
      (selectedSectionType === 'all' || s.type === selectedSectionType) &&
      (sectionSearch === '' ||
        s.name.toLowerCase().includes(sectionSearch.toLowerCase()) ||
        s.description.toLowerCase().includes(sectionSearch.toLowerCase())),
  );

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
              The authoritative source for UI components, patterns, typography, colour tokens, and section
              layouts powering the Navigate Wealth platform. Built with React, TypeScript, Tailwind CSS v4, and shadcn/ui.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge className="bg-white/10 text-white border-white/20">React + TypeScript</Badge>
              <Badge className="bg-white/10 text-white border-white/20">Tailwind CSS v4</Badge>
              <Badge className="bg-white/10 text-white border-white/20">shadcn/ui</Badge>
              <Badge className="bg-white/10 text-white border-white/20">{components.length} Components</Badge>
              <Badge className="bg-white/10 text-white border-white/20">WCAG AA</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Tab Navigation */}
      <div ref={tabBarRef} className="sticky top-0 z-40">
        <section className={`bg-white border-b border-gray-200 transition-shadow ${isSticky ? 'shadow-md' : ''}`}>
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); window.scrollTo({ top: tabBarRef.current?.offsetTop || 0, behavior: 'smooth' }); }} className="w-full">
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
                <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>

            {/* ═══ OVERVIEW TAB ═══ */}
            <TabsContent value="overview" className="mt-0">
              <div className="space-y-8 md:space-y-12">
                {/* Introduction */}
                <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Info className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl md:text-2xl font-bold text-black mb-2 md:mb-3">Navigate Wealth Design System</h3>
                      <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
                        A comprehensive design system for professional wealth management interfaces, featuring a clean
                        white/light colour scheme with purple accents (#6d28d9), complete authentication flows, and full
                        admin capabilities. This is the single source of truth for all UI decisions.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-primary/10 text-primary border-primary/20">React + TypeScript</Badge>
                        <Badge className="bg-primary/10 text-primary border-primary/20">Tailwind CSS v4</Badge>
                        <Badge className="bg-primary/10 text-primary border-primary/20">shadcn/ui</Badge>
                        <Badge className="bg-primary/10 text-primary border-primary/20">Mobile Responsive</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Navigation */}
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-black mb-4 flex items-center">
                    <Target className="h-5 w-5 md:h-6 md:w-6 text-primary mr-2" />
                    Quick Navigation
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {TABS.filter((t) => t.value !== 'overview').map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.value}
                          onClick={() => { setActiveTab(tab.value); window.scrollTo({ top: tabBarRef.current?.offsetTop || 0, behavior: 'smooth' }); }}
                          className="flex flex-col items-center justify-center p-4 md:p-5 bg-white border-2 border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition-all duration-200 group"
                        >
                          <Icon className="h-6 w-6 md:h-7 md:w-7 text-primary mb-2" />
                          <span className="text-xs md:text-sm font-medium text-gray-700 group-hover:text-primary">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Design Foundations */}
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-black mb-4 flex items-center">
                    <Palette className="h-5 w-5 md:h-6 md:w-6 text-primary mr-2" />
                    Design Foundations
                  </h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {[
                      {
                        icon: Palette, title: 'Colour System', desc: 'White content sections, purple (#6d28d9) brand accents, and dark navy (#313653) hero/dark sections',
                        tab: 'colors', cta: 'View Colours',
                      },
                      {
                        icon: Type, title: 'Typography', desc: 'Scalable type system with 7 scale steps, 4 weights, and section-contextual colours',
                        tab: 'typography', cta: 'View Typography',
                      },
                      {
                        icon: Layers, title: 'Section Styles', desc: 'Predefined section classes for consistent layouts and visual hierarchy',
                        tab: 'sections', cta: 'View Sections',
                      },
                    ].map((card) => {
                      const Icon = card.icon;
                      return (
                        <Card key={card.title} className="border-gray-200 hover:border-primary/50 transition-colors">
                          <CardHeader className="pb-4">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                              <Icon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                            </div>
                            <CardTitle className="text-base md:text-lg text-black">{card.title}</CardTitle>
                            <CardDescription className="text-sm text-gray-600">{card.desc}</CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10 -ml-4" onClick={() => { setActiveTab(card.tab); window.scrollTo({ top: tabBarRef.current?.offsetTop || 0, behavior: 'smooth' }); }}>
                              {card.cta} →
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Key Features */}
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-black mb-4 flex items-center">
                    <Component className="h-5 w-5 md:h-6 md:w-6 text-primary mr-2" />
                    Key Features
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
                    {[
                      { icon: Shield, title: 'Authentication System', desc: 'Complete login/signup flows with account type selection and multi-step application', badges: ['Login/Signup', 'Protected Routes', '4-Step Application'] },
                      { icon: Grid, title: 'Navigation System', desc: 'Multi-level navigation with top bar, main nav with dropdowns, and dashboard navigation', badges: ['Top Bar', 'Mega Menus', 'Dashboard Nav'] },
                      { icon: UserCheck, title: 'User Management', desc: 'Comprehensive profile system with four-section dropdown and admin account switching', badges: ['Profile', 'Settings', 'Security'] },
                      { icon: Building, title: 'Admin Dashboard', desc: 'Full client management system with 11 modules and comprehensive administrative controls', badges: ['11 Modules', 'Client Mgmt', 'Compliance'] },
                    ].map((feature) => {
                      const Icon = feature.icon;
                      return (
                        <Card key={feature.title} className="border-gray-200">
                          <CardContent className="p-4 md:p-6">
                            <div className="flex items-start space-x-3 md:space-x-4">
                              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <h4 className="text-sm md:text-base font-semibold text-black mb-1 md:mb-2">{feature.title}</h4>
                                <p className="text-xs md:text-sm text-gray-600 mb-3">{feature.desc}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {feature.badges.map((b) => (
                                    <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Application Pages */}
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-black mb-4 flex items-center">
                    <FileText className="h-5 w-5 md:h-6 md:w-6 text-primary mr-2" />
                    Application Structure
                  </h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {[
                      { title: 'Public Pages', items: ['Home Page', 'About Us', 'Services (8 pages)', 'Contact & Get Quote', 'Resources & Press'] },
                      { title: 'Client Portal', items: ['Dashboard', 'Products & Services', 'Transactions & Docs', 'Profile & Settings'] },
                      { title: 'Admin System', items: ['Client Management', 'Compliance Tools', 'Communication Hub', 'Advice Engine', 'Social Media Mgmt'] },
                    ].map((group) => (
                      <div key={group.title} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-primary/50 transition-colors">
                        <h4 className="text-sm font-semibold text-black mb-2">{group.title}</h4>
                        <ul className="space-y-1.5 text-xs md:text-sm text-gray-600">
                          {group.items.map((item) => (
                            <li key={item} className="flex items-center">
                              <CheckCircle className="h-3 w-3 text-primary mr-2 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Getting Started */}
                <div className="section-dark-gray rounded-2xl p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg md:text-xl font-bold text-white mb-2">Ready to Get Started?</h3>
                      <p className="text-sm md:text-base text-gray-300">
                        Explore the design system components and download the complete codebase to start building.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button onClick={() => { setActiveTab('components'); window.scrollTo({ top: tabBarRef.current?.offsetTop || 0, behavior: 'smooth' }); }} className="bg-primary hover:bg-primary/90 text-white">
                        <Component className="h-4 w-4 mr-2" />
                        View Components
                      </Button>
                      <Button onClick={() => { setActiveTab('download'); window.scrollTo({ top: tabBarRef.current?.offsetTop || 0, behavior: 'smooth' }); }} variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/50">
                        <Download className="h-4 w-4 mr-2" />
                        Download Code
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ═══ COLOURS TAB ═══ */}
            <TabsContent value="colors" className="mt-0">
              <div className="space-y-8 md:space-y-12">
                {/* Introduction */}
                <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Palette className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl md:text-2xl font-bold text-black mb-2 md:mb-3">Colour System</h3>
                      <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
                        A professional colour palette for wealth management interfaces. Primary purple (#6d28d9) provides brand identity. Dark navy (#313653) is the standard dark section background, applied via the <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">section-dark-gray</code> utility class. White is the default content background.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-primary/10 text-primary border-primary/20">Core Colour Tokens</Badge>
                        <Badge className="bg-primary/10 text-primary border-primary/20">WCAG Compliant</Badge>
                        <Badge className="bg-primary/10 text-primary border-primary/20">section-dark-gray Standard</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Colour Categories */}
                {['Brand', 'Backgrounds', 'Text', 'Borders', 'Status'].map((category) => {
                  const categoryColors = colorPalette.filter((c) => c.category === category);
                  if (categoryColors.length === 0) return null;
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-4 md:mb-6">
                        <h3 className="text-lg md:text-xl font-bold text-black">{category} Colours</h3>
                        <Badge variant="outline" className="border-gray-300 text-gray-600">
                          {categoryColors.length} {categoryColors.length === 1 ? 'Colour' : 'Colours'}
                        </Badge>
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {categoryColors.map((color) => (
                          <Card key={color.name} className="border-gray-200 hover:border-primary/50 transition-all duration-200 group overflow-hidden">
                            <CardContent className="p-0">
                              <div
                                className="w-full h-28 md:h-24 relative cursor-pointer transition-all duration-300 group-hover:h-32 md:group-hover:h-28"
                                style={{ backgroundColor: color.value }}
                                onClick={() => copyToClipboard(color.value, color.name)}
                              >
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200 flex items-center justify-center">
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
                                      {copiedCode === color.name ? (
                                        <div className="flex items-center space-x-2 text-green-600">
                                          <CheckCircle className="h-4 w-4" />
                                          <span className="text-sm font-medium">Copied!</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center space-x-2 text-gray-700">
                                          <Copy className="h-4 w-4" />
                                          <span className="text-sm font-medium">Copy hex</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="p-4 md:p-5 space-y-3">
                                <div>
                                  <h4 className="text-base font-semibold text-black mb-1">{color.name}</h4>
                                  <p className="text-xs md:text-sm text-gray-600 leading-relaxed">{color.description}</p>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 uppercase tracking-wide">HEX</span>
                                    <button
                                      onClick={() => copyToClipboard(color.value, `${color.name}-hex`)}
                                      className="group/btn flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                                    >
                                      <code className="text-xs font-mono text-black">{color.value}</code>
                                      {copiedCode === `${color.name}-hex` ? (
                                        <CheckCircle className="h-3 w-3 text-green-600" />
                                      ) : (
                                        <Copy className="h-3 w-3 text-gray-400 group-hover/btn:text-gray-600" />
                                      )}
                                    </button>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 uppercase tracking-wide">Tailwind</span>
                                    <button
                                      onClick={() => copyToClipboard(color.tailwind, `${color.name}-tw`)}
                                      className="group/btn flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors max-w-[60%]"
                                    >
                                      <code className="text-xs font-mono text-black truncate">{color.tailwind.split(' ')[0]}</code>
                                      {copiedCode === `${color.name}-tw` ? (
                                        <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                                      ) : (
                                        <Copy className="h-3 w-3 text-gray-400 group-hover/btn:text-gray-600 flex-shrink-0" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-gray-100">
                                  <span className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Common Usage</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {color.usage.map((use) => (
                                      <Badge key={use} variant="secondary" className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200">{use}</Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Colour Combinations */}
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-black mb-4 md:mb-6">Colour Combinations</h3>
                  <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
                    <Card className="border-gray-200">
                      <CardContent className="p-5 md:p-6">
                        <h4 className="text-sm md:text-base font-semibold text-black mb-3">Primary Button</h4>
                        <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg mb-3">
                          <Button className="bg-primary hover:bg-primary/90 text-white">Get Started</Button>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Background:</span>
                            <code className="bg-gray-100 px-2 py-1 rounded text-black">#6d28d9</code>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Text:</span>
                            <code className="bg-gray-100 px-2 py-1 rounded text-black">#ffffff</code>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-gray-200">
                      <CardContent className="p-5 md:p-6">
                        <h4 className="text-sm md:text-base font-semibold text-black mb-3">Status Indicators</h4>
                        <div className="p-6 bg-gray-50 rounded-lg space-y-2 mb-3">
                          <div className="flex items-center space-x-2"><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm text-gray-700">Success</span></div>
                          <div className="flex items-center space-x-2"><AlertCircle className="h-4 w-4 text-yellow-500" /><span className="text-sm text-gray-700">Warning</span></div>
                          <div className="flex items-center space-x-2"><X className="h-4 w-4 text-red-500" /><span className="text-sm text-gray-700">Error</span></div>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between items-center"><span className="text-gray-600">Success:</span><code className="bg-gray-100 px-2 py-1 rounded text-black">#22c55e</code></div>
                          <div className="flex justify-between items-center"><span className="text-gray-600">Warning:</span><code className="bg-gray-100 px-2 py-1 rounded text-black">#eab308</code></div>
                          <div className="flex justify-between items-center"><span className="text-gray-600">Error:</span><code className="bg-gray-100 px-2 py-1 rounded text-black">#ef4444</code></div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Alert className="border-primary/20 bg-primary/5">
                  <Shield className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-black">Accessibility Compliance</AlertTitle>
                  <AlertDescription className="text-gray-600 text-sm">
                    All colour combinations meet WCAG 2.1 Level AA standards for contrast ratios. Primary purple on white provides 4.5:1 contrast, and all text colours ensure readability.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            {/* ═══ TYPOGRAPHY TAB ═══ */}
            <TabsContent value="typography" className="mt-0">
              <TypographyTab />
            </TabsContent>

            {/* ═══ COMPONENTS TAB ═══ */}
            <TabsContent value="components" className="mt-0">
              <div className="space-y-8 md:space-y-12">
                <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Component className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl md:text-2xl font-bold text-black mb-2 md:mb-3">UI Components Library</h3>
                      <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
                        A comprehensive collection of React components built with shadcn/ui and styled for the Navigate Wealth platform. All components are fully responsive and follow accessibility best practices.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-primary/10 text-primary border-primary/20">{components.length} Components</Badge>
                        <Badge className="bg-primary/10 text-primary border-primary/20">React + TypeScript</Badge>
                        <Badge className="bg-primary/10 text-primary border-primary/20">shadcn/ui</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search and Filter */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input placeholder="Search components..." value={componentSearch} onChange={(e) => setComponentSearch(e.target.value)} className="pl-10" />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
                      <SelectContent>
                        {componentCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                    {componentCategories.map((cat) => {
                      const count = cat === 'all' ? components.length : components.filter((c) => c.category === cat).length;
                      return (
                        <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                          {cat === 'all' ? 'All' : cat} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Components List */}
                <div className="space-y-6 md:space-y-8">
                  {filteredComponents.map((component) => (
                    <Card key={component.id} className="border-gray-200 hover:border-primary/30 transition-colors overflow-hidden">
                      <CardHeader className="pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <CardTitle className="text-lg md:text-xl text-black">{component.name}</CardTitle>
                              <Badge variant="outline" className="border-primary/30 text-primary text-xs">{component.category}</Badge>
                            </div>
                            <CardDescription className="text-sm md:text-base text-gray-600">{component.description}</CardDescription>
                            {component.variants && component.variants.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {component.variants.map((v) => (
                                  <Badge key={v} variant="secondary" className="text-xs bg-gray-100 text-gray-700">{v}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(component.code, component.id)} className="border-gray-300 hover:border-primary hover:bg-primary/5 self-start sm:self-auto">
                            {copiedCode === component.id ? (
                              <div className="contents"><CheckCircle className="h-4 w-4 mr-2 text-green-600" /><span className="text-green-600">Copied!</span></div>
                            ) : (
                              <div className="contents"><Copy className="h-4 w-4 mr-2" /><span>Copy Code</span></div>
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 md:space-y-6">
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Eye className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold text-black">Preview</span>
                          </div>
                          <div className="p-6 md:p-8 bg-gradient-to-br from-gray-50 to-white rounded-lg border-2 border-gray-200 min-h-[100px] flex items-center justify-center">
                            {component.component}
                          </div>
                        </div>
                        <div>
                          <button onClick={() => setExpandedCode(expandedCode === component.id ? null : component.id)} className="w-full flex items-center justify-between mb-3 group">
                            <span className="text-sm font-semibold text-black flex items-center">
                              <Code className="h-4 w-4 mr-2 text-primary" />Code
                            </span>
                            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expandedCode === component.id ? 'rotate-180' : ''}`} />
                          </button>
                          {expandedCode === component.id && (
                            <div className="relative group/code">
                              <pre className="text-xs md:text-sm bg-gray-900 text-gray-100 p-4 md:p-6 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                                <code>{component.code}</code>
                              </pre>
                              <Button size="sm" variant="secondary" onClick={() => copyToClipboard(component.code, `${component.id}-code`)} className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity bg-gray-800 hover:bg-gray-700 text-white border-gray-600">
                                {copiedCode === `${component.id}-code` ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredComponents.length === 0 && (
                  <div className="text-center py-12 md:py-16">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Component className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-black mb-2">No components found</h3>
                    <p className="text-sm text-gray-600 mb-4">Try adjusting your search or filter.</p>
                    <Button variant="outline" onClick={() => { setComponentSearch(''); setSelectedCategory('all'); }} className="border-primary text-primary hover:bg-primary/10">Clear Filters</Button>
                  </div>
                )}

                <Alert className="border-primary/20 bg-primary/5">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-black">Component Usage</AlertTitle>
                  <AlertDescription className="text-gray-600 text-sm">
                    All components are built with shadcn/ui and can be imported directly into your project. Copy the code snippets and customise them to match your specific needs. Click the chevron to expand code blocks.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            {/* ═══ PATTERNS TAB ═══ */}
            <TabsContent value="patterns" className="mt-0">
              <PatternsTab />
            </TabsContent>

            {/* ═══ ICONS TAB ═══ */}
            <TabsContent value="icons" className="mt-0">
              <IconsTab />
            </TabsContent>

            {/* ═══ SECTIONS TAB ═══ */}
            <TabsContent value="sections" className="mt-0">
              <div className="space-y-8 md:space-y-12">
                <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Layers className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl md:text-2xl font-bold text-black mb-2 md:mb-3">Section Layouts</h3>
                      <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
                        Pre-built section templates with consistent spacing, responsive containers, and colour schemes.
                        These sections form the building blocks of your pages with standardised padding and max-width containers.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-primary/10 text-primary border-primary/20">{sections.length} Section Types</Badge>
                        <Badge className="bg-primary/10 text-primary border-primary/20">Responsive</Badge>
                        <Badge className="bg-primary/10 text-primary border-primary/20">max-w-screen-2xl</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search and Filter */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input placeholder="Search sections..." value={sectionSearch} onChange={(e) => setSectionSearch(e.target.value)} className="pl-10" />
                    </div>
                    <Select value={selectedSectionType} onValueChange={setSelectedSectionType}>
                      <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Types" /></SelectTrigger>
                      <SelectContent>
                        {sectionTypes.map((t) => (
                          <SelectItem key={t} value={t}>{t === 'all' ? 'All Types' : t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                    {sectionTypes.map((type) => {
                      const count = type === 'all' ? sections.length : sections.filter((s) => s.type === type).length;
                      return (
                        <button key={type} onClick={() => setSelectedSectionType(type)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedSectionType === type ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                          {type === 'all' ? 'All' : type} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sections List */}
                <div className="space-y-6 md:space-y-8">
                  {filteredSections.map((section) => (
                    <Card key={section.id} className="border-gray-200 hover:border-primary/30 transition-colors overflow-hidden">
                      <CardHeader className="pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <CardTitle className="text-lg md:text-xl text-black">{section.name}</CardTitle>
                              <Badge variant="outline" className="border-primary/30 text-primary text-xs">{section.type}</Badge>
                              <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">{section.textColor} Text</Badge>
                            </div>
                            <CardDescription className="text-sm md:text-base text-gray-600 mb-3">{section.description}</CardDescription>
                            {section.usage && section.usage.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Common Usage</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {section.usage.map((use) => (
                                    <Badge key={use} variant="secondary" className="text-xs bg-primary/10 text-primary">{use}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(section.code, section.id)} className="border-gray-300 hover:border-primary hover:bg-primary/5 self-start sm:self-auto">
                            {copiedCode === section.id ? (
                              <div className="contents"><CheckCircle className="h-4 w-4 mr-2 text-green-600" /><span className="text-green-600">Copied!</span></div>
                            ) : (
                              <div className="contents"><Copy className="h-4 w-4 mr-2" /><span>Copy Code</span></div>
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 md:space-y-6">
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Eye className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold text-black">Preview</span>
                          </div>
                          <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                            <div className={`${section.className} p-6 md:p-10`}>
                              <h4 className={`text-xl md:text-2xl font-bold mb-2 ${section.textColor === 'Light' ? 'text-white' : 'text-black'}`}>
                                Section Title
                              </h4>
                              <p className={`text-sm md:text-base ${section.textColor === 'Light' ? 'text-gray-300' : 'text-gray-600'}`}>
                                This is how content appears in this section type. Includes proper spacing and responsive containers.
                              </p>
                              {section.type === 'CTA' && (
                                <div className="mt-6">
                                  <Button className={section.className === 'bg-primary' ? 'bg-primary-foreground text-primary hover:bg-gray-100' : 'bg-primary hover:bg-primary/90 text-white'}>
                                    Call to Action
                                  </Button>
                                </div>
                              )}
                              {section.type === 'Hero' && (
                                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                                  <Button className="bg-primary hover:bg-primary/90 text-white">Primary CTA</Button>
                                  <Button variant="outline" className={section.textColor === 'Light' ? 'border-white text-white hover:bg-white hover:text-black' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}>Secondary CTA</Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div>
                          <button onClick={() => setExpandedCode(expandedCode === section.id ? null : section.id)} className="w-full flex items-center justify-between mb-3 group">
                            <span className="text-sm font-semibold text-black flex items-center"><Code className="h-4 w-4 mr-2 text-primary" />Code</span>
                            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expandedCode === section.id ? 'rotate-180' : ''}`} />
                          </button>
                          {expandedCode === section.id && (
                            <div className="relative group/code">
                              <pre className="text-xs md:text-sm bg-gray-900 text-gray-100 p-4 md:p-6 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                                <code>{section.code}</code>
                              </pre>
                              <Button size="sm" variant="secondary" onClick={() => copyToClipboard(section.code, `${section.id}-code`)} className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity bg-gray-800 hover:bg-gray-700 text-white border-gray-600">
                                {copiedCode === `${section.id}-code` ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          )}
                        </div>
                        <Alert className="border-gray-200 bg-gray-50">
                          <Info className="h-4 w-4 text-gray-600" />
                          <AlertDescription className="text-xs md:text-sm text-gray-600">
                            <strong>Container:</strong> max-w-screen-2xl with responsive padding (px-4 sm:px-6 lg:px-8 xl:px-12) &middot; <strong className="ml-2">Spacing:</strong> py-20 (80px) vertical padding
                          </AlertDescription>
                        </Alert>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredSections.length === 0 && (
                  <div className="text-center py-12 md:py-16">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Layers className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-black mb-2">No sections found</h3>
                    <p className="text-sm text-gray-600 mb-4">Try adjusting your search or filter.</p>
                    <Button variant="outline" onClick={() => { setSectionSearch(''); setSelectedSectionType('all'); }} className="border-primary text-primary hover:bg-primary/10">Clear Filters</Button>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
                  <Alert className="border-primary/20 bg-primary/5">
                    <Layers className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-black">Section Structure</AlertTitle>
                    <AlertDescription className="text-gray-600 text-sm">
                      All sections use the max-w-screen-2xl container with consistent responsive padding for uniform layouts across the site.
                    </AlertDescription>
                  </Alert>
                  <Alert className="border-primary/20 bg-primary/5">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-black">Colour Contrast</AlertTitle>
                    <AlertDescription className="text-gray-600 text-sm">
                      Dark sections use white/light text (text-white, text-gray-300). Light sections use dark text (text-black, text-gray-600).
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </TabsContent>

            {/* ═══ DOWNLOAD TAB ═══ */}
            <TabsContent value="download" className="mt-0">
              <DownloadCodebaseTab />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Partnership CTA Section */}
      <section className="section-white py-16 md:py-24 px-4 border-t border-gray-200">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12 md:mb-16">
              <Badge className="bg-primary/10 text-primary border-primary/20 mb-4">
                <Sparkles className="h-3 w-3 mr-1" />
                Partnership Opportunity
              </Badge>
              <h2 className="text-black mb-4 md:mb-6">
                Build the Future of <span className="text-primary">Fintech</span> Together
              </h2>
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
                Partner with Navigate Wealth to develop cutting-edge fintech products in the Independent Financial Advisory space.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-12 md:mb-16">
              {[
                { icon: Code, title: 'Complete Design System', desc: 'Access our comprehensive UI library, components, and patterns built for wealth management platforms.' },
                { icon: Shield, title: 'Regulatory Expertise', desc: 'Benefit from our deep understanding of financial services regulations and compliance requirements.' },
                { icon: Briefcase, title: 'Industry Experience', desc: 'Leverage years of experience in building solutions for independent financial advisers and wealth managers.' },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <Card key={card.title} className="border-gray-200 hover:border-primary/30 transition-colors">
                    <CardContent className="p-6">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-black mb-2">{card.title}</h3>
                      <p className="text-sm text-gray-600">{card.desc}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-white to-primary/5 overflow-hidden">
              <CardContent className="p-8 md:p-12">
                <div className="grid lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold text-black mb-4">Ready to Partner?</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                      Whether you're building a new fintech product, enhancing an existing platform, or exploring opportunities in the IFA space, we'd love to discuss how we can collaborate.
                    </p>
                    <div className="space-y-3 mb-8">
                      <div className="flex items-center space-x-3 text-sm">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Mail className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-gray-500">Email us at</p>
                          <a href="mailto:info@navigatewealth.com" className="text-primary hover:underline font-medium">info@navigatewealth.com</a>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 text-sm">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Phone className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-gray-500">Call us at</p>
                          <a href="tel:+27123456789" className="text-primary hover:underline font-medium">+27 (0)12 345 6789</a>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button className="bg-primary hover:bg-primary/90 text-white px-6 py-3 group" asChild>
                        <Link to="/contact">
                          Get in Touch
                          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                      <Button variant="outline" className="border-gray-300 hover:border-primary hover:bg-primary/5 px-6 py-3" asChild>
                        <Link to="/about">
                          <Building className="mr-2 h-4 w-4" />
                          Learn About Us
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {[
                      { icon: Component, value: `${components.length}+`, label: 'UI Components' },
                      { icon: Layers, value: `${sections.length}+`, label: 'Section Templates' },
                      { icon: Palette, value: `${colorPalette.length}+`, label: 'Colour Tokens' },
                    ].map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div key={stat.label} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-black">{stat.value}</div>
                              <div className="text-sm text-gray-600">{stat.label}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-8 text-center">
              <Alert className="border-primary/20 bg-primary/5 max-w-2xl mx-auto">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm text-gray-600">
                  <strong className="text-black">Exclusive Partnership:</strong> This design system represents Navigate Wealth's commitment to excellence in the Independent Financial Advisory space. Contact us to explore collaboration opportunities.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </section>

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
