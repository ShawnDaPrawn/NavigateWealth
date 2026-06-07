import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import { Switch } from '../../ui/switch';
import { Checkbox } from '../../ui/checkbox';
import { Textarea } from '../../ui/textarea';
import { Skeleton } from '../../ui/skeleton';
import { Progress } from '../../ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../../ui/avatar';
import {
  Component,
  Copy,
  CheckCircle,
  AlertCircle,
  Info,
  Eye,
  User,
  Shield,
  LogOut,
  ChevronDown,
  Key,
  TrendingUp,
  Home,
  Package,
  CreditCard,
  Calculator,
  Settings,
  Loader2,
  Code,
  Search,
} from 'lucide-react';
import { copyToClipboard as copyToClipboardUtil } from '../../../utils/clipboard';

function buildComponents() {
  return [
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
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Primary
          </Button>
          <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
            Outline
          </Button>
          <Button variant="ghost" className="text-gray-700 hover:text-primary">
            Ghost
          </Button>
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
      description:
        'Small labels for status, categories, and counts. Config-driven status badges use the standard colour vocabulary.',
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
      description:
        'Container component for grouping related content with header, content, and description slots.',
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
      description:
        'Contextual feedback messages for success, warning, error, and informational states.',
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
            <AlertDescription className="text-gray-600 text-sm">
              Helpful context for the user.
            </AlertDescription>
          </Alert>
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700 text-sm">
              Changes saved successfully.
            </AlertDescription>
          </Alert>
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Error</AlertTitle>
            <AlertDescription className="text-red-700 text-sm">
              Unable to load data. Please retry.
            </AlertDescription>
          </Alert>
        </div>
      ),
    },
    {
      id: 'dialog-modal',
      name: 'Dialog / Modal',
      category: 'Overlay',
      description:
        'Modal dialogs for confirmations, forms, and focused interactions. Always include a clear title and close mechanism.',
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
              <Button variant="outline" className="border-gray-300">
                Cancel
              </Button>
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
            <AvatarFallback className="bg-primary text-primary-foreground font-medium text-sm">
              AB
            </AvatarFallback>
          </Avatar>
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
              CD
            </AvatarFallback>
          </Avatar>
        </div>
      ),
    },
    {
      id: 'form-components',
      name: 'Form Controls',
      category: 'Form',
      description:
        'Input, select, textarea, checkbox, switch, and label elements with consistent styling',
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
            <Label htmlFor="ds-email" className="text-sm font-medium text-black">
              Email Address
            </Label>
            <Input id="ds-email" type="email" placeholder="Enter your email" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="ds-service" className="text-sm font-medium text-black">
              Select Service
            </Label>
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
            <Label htmlFor="ds-msg" className="text-sm font-medium text-black">
              Message
            </Label>
            <Textarea id="ds-msg" placeholder="Type your message..." className="mt-1" rows={2} />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="ds-terms" />
            <Label htmlFor="ds-terms" className="text-sm text-gray-700 cursor-pointer">
              I accept the terms
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="ds-notif" />
            <Label htmlFor="ds-notif" className="text-sm text-gray-700 cursor-pointer">
              Enable notifications
            </Label>
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
      description:
        'Placeholder loading states that mirror the shape of the final content to prevent layout shift.',
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
      description:
        'Contextual help text shown on hover. Used for icon-only buttons, truncated labels, and info hints.',
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
                <Button variant="outline" size="sm" className="border-gray-300">
                  Hover me
                </Button>
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
      description:
        'Horizontal navigation bar for authenticated dashboard pages with active state indicators using primary purple',
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
      description:
        'User menu with profile access, security settings, communication preferences, and logout',
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
              <Button
                variant="ghost"
                className="flex items-center space-x-3 h-auto p-2 hover:bg-gray-50"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
                    JD
                  </AvatarFallback>
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
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>View Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Account Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Key className="mr-2 h-4 w-4" />
                <span>Change Password</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Shield className="mr-2 h-4 w-4" />
                <span>Two-Factor Auth</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
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
      description:
        'Main navigation dropdown menu items for Services, Solutions, and Company sections',
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
                {
                  icon: TrendingUp,
                  label: 'Investment Management',
                  desc: 'Grow your wealth with expert guidance',
                },
                { icon: Shield, label: 'Risk Management', desc: 'Protect your financial future' },
                { icon: Calculator, label: 'Tax Planning', desc: 'Optimise your tax position' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
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
}

export function ComponentsTab() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [componentSearch, setComponentSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const components = buildComponents();

  const copyToClipboard = async (code: string, id: string) => {
    try {
      await copyToClipboardUtil(code);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const componentCategories = ['all', ...Array.from(new Set(components.map((c) => c.category)))];

  const filteredComponents = components.filter(
    (c) =>
      (selectedCategory === 'all' || c.category === selectedCategory) &&
      (componentSearch === '' ||
        c.name.toLowerCase().includes(componentSearch.toLowerCase()) ||
        c.description.toLowerCase().includes(componentSearch.toLowerCase())),
  );

  return (
    <div className="space-y-8 md:space-y-12">
      <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex items-center justify-center">
            <Component className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl md:text-2xl font-bold text-black mb-2 md:mb-3">
              UI Components Library
            </h3>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
              A comprehensive collection of React components built with shadcn/ui and styled for the
              Navigate Wealth platform. All components are fully responsive and follow accessibility
              best practices.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {components.length} Components
              </Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                React + TypeScript
              </Badge>
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
            <Input
              placeholder="Search components..."
              value={componentSearch}
              onChange={(e) => setComponentSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              {componentCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {componentCategories.map((cat) => {
            const count =
              cat === 'all'
                ? components.length
                : components.filter((c) => c.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {cat === 'all' ? 'All' : cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Components List */}
      <div className="space-y-6 md:space-y-8">
        {filteredComponents.map((component) => (
          <Card
            key={component.id}
            className="border-gray-200 hover:border-primary/30 transition-colors overflow-hidden"
          >
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <CardTitle className="text-lg md:text-xl text-black">
                      {component.name}
                    </CardTitle>
                    <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                      {component.category}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm md:text-base text-gray-600">
                    {component.description}
                  </CardDescription>
                  {component.variants && component.variants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {component.variants.map((v) => (
                        <Badge
                          key={v}
                          variant="secondary"
                          className="text-xs bg-gray-100 text-gray-700"
                        >
                          {v}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(component.code, component.id)}
                  className="border-gray-300 hover:border-primary hover:bg-primary/5 self-start sm:self-auto"
                >
                  {copiedCode === component.id ? (
                    <div className="contents">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      <span className="text-green-600">Copied!</span>
                    </div>
                  ) : (
                    <div className="contents">
                      <Copy className="h-4 w-4 mr-2" />
                      <span>Copy Code</span>
                    </div>
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
                <button
                  onClick={() =>
                    setExpandedCode(expandedCode === component.id ? null : component.id)
                  }
                  className="w-full flex items-center justify-between mb-3 group"
                >
                  <span className="text-sm font-semibold text-black flex items-center">
                    <Code className="h-4 w-4 mr-2 text-primary" />
                    Code
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${expandedCode === component.id ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedCode === component.id && (
                  <div className="relative group/code">
                    <pre className="text-xs md:text-sm bg-gray-900 text-gray-100 p-4 md:p-6 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                      <code>{component.code}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyToClipboard(component.code, `${component.id}-code`)}
                      className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
                    >
                      {copiedCode === `${component.id}-code` ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
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
          <Button
            variant="outline"
            onClick={() => {
              setComponentSearch('');
              setSelectedCategory('all');
            }}
            className="border-primary text-primary hover:bg-primary/10"
          >
            Clear Filters
          </Button>
        </div>
      )}

      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertTitle className="text-black">Component Usage</AlertTitle>
        <AlertDescription className="text-gray-600 text-sm">
          All components are built with shadcn/ui and can be imported directly into your project.
          Copy the code snippets and customise them to match your specific needs. Click the chevron
          to expand code blocks.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export const COMPONENTS_COUNT = 13;
