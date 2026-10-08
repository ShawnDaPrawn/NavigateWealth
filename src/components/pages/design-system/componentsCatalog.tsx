/** The component catalogue the Components tab lists: each entry's metadata, code sample and live preview. */
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
  CheckCircle,
  AlertCircle,
  Info,
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
} from 'lucide-react';

export function buildComponents() {
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
