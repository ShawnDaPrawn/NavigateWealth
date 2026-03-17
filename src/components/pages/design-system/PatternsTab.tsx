import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import { Skeleton } from '../../ui/skeleton';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { Progress } from '../../ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import {
  Users,
  TrendingUp,
  DollarSign,
  FileText,
  Copy,
  CheckCircle,
  Info,
  Eye,
  Code,
  ChevronDown,
  Inbox,
  Search,
  AlertCircle,
  Loader2,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { copyToClipboard as copyToClipboardUtil } from '../../../utils/clipboard';

interface PatternEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  preview: React.ReactNode;
  code: string;
}

export function PatternsTab() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const copyCode = async (code: string, id: string) => {
    try {
      await copyToClipboardUtil(code);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const patterns: PatternEntry[] = [
    {
      id: 'stat-card',
      name: 'Stat Card',
      category: 'Data Display',
      description: 'Summary metric cards used at the top of admin module pages. White background with bg-gray-50 icon container, large bold number, and muted description.',
      preview: (
        <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
          {[
            { label: 'Total Clients', value: '1,247', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Revenue', value: 'R2.4M', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Growth', value: '+12.5%', icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Documents', value: '843', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-black">{stat.value}</div>
                      <div className="text-xs text-gray-500">{stat.label}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ),
      code: `<Card className="border-gray-200">
  <CardContent className="p-4">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <Users className="h-5 w-5 text-primary" />
      </div>
      <div>
        <div className="text-xl font-bold text-black">1,247</div>
        <div className="text-xs text-gray-500">Total Clients</div>
      </div>
    </div>
  </CardContent>
</Card>`,
    },
    {
      id: 'status-badge',
      name: 'Status Badges',
      category: 'Data Display',
      description: 'Config-driven status indicators using the standard colour vocabulary: green (active/success), amber (warning/suspended), red (closed/error), blue (informational), purple (brand/system).',
      preview: (
        <div className="flex flex-wrap gap-3">
          <Badge className="bg-green-600 hover:bg-green-700 text-white">Active</Badge>
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Suspended</Badge>
          <Badge className="bg-red-600 hover:bg-red-700 text-white">Closed</Badge>
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white">Preview</Badge>
          <Badge className="bg-primary hover:bg-primary/90 text-white">System</Badge>
          <Badge variant="outline" className="border-green-300 text-green-700">Approved</Badge>
          <Badge variant="outline" className="border-amber-300 text-amber-700">Pending</Badge>
          <Badge variant="outline" className="border-red-300 text-red-700">Rejected</Badge>
        </div>
      ),
      code: `// Config-driven pattern (recommended):
const STATUS_CONFIG = {
  active: {
    label: 'Active',
    badgeClass: 'bg-green-600 hover:bg-green-700 text-white',
    dotClass: 'bg-green-500',
  },
  suspended: {
    label: 'Suspended',
    badgeClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    dotClass: 'bg-amber-500',
  },
  closed: {
    label: 'Closed',
    badgeClass: 'bg-red-600 hover:bg-red-700 text-white',
    dotClass: 'bg-red-500',
  },
} as const;

// Usage:
const cfg = STATUS_CONFIG[status];
<Badge className={cfg.badgeClass}>{cfg.label}</Badge>`,
    },
    {
      id: 'empty-state',
      name: 'Empty State',
      category: 'Feedback',
      description: 'Displayed when a list, table, or section has no data. Provides clear guidance on next actions with an icon, title, description, and optional CTA button.',
      preview: (
        <div className="text-center py-10 px-6 max-w-sm mx-auto">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Inbox className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-black mb-2">No clients yet</h3>
          <p className="text-sm text-gray-600 mb-6">
            Get started by adding your first client or importing from a spreadsheet.
          </p>
          <Button className="bg-primary hover:bg-primary/90 text-white">
            Add Client
          </Button>
        </div>
      ),
      code: `<div className="text-center py-16 px-6">
  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
    <Inbox className="h-8 w-8 text-gray-400" />
  </div>
  <h3 className="text-lg font-semibold text-black mb-2">No clients yet</h3>
  <p className="text-sm text-gray-600 mb-6">
    Get started by adding your first client or importing from a spreadsheet.
  </p>
  <Button className="bg-primary hover:bg-primary/90 text-white">
    Add Client
  </Button>
</div>`,
    },
    {
      id: 'loading-skeleton',
      name: 'Loading Skeleton',
      category: 'Feedback',
      description: 'Skeleton screens shown while data is loading. Mirrors the shape of the final content to prevent layout shift and reduce perceived wait time.',
      preview: (
        <div className="space-y-4 w-full max-w-md">
          {/* Stat card skeleton */}
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
          {/* List item skeleton */}
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ),
      code: `import { Skeleton } from './components/ui/skeleton';

{/* Stat card skeleton */}
<Card className="border-gray-200">
  <CardContent className="p-4">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  </CardContent>
</Card>

{/* List item skeleton */}
<div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
  <Skeleton className="h-8 w-8 rounded-full" />
  <div className="flex-1 space-y-1.5">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-3 w-48" />
  </div>
  <Skeleton className="h-6 w-16 rounded-full" />
</div>`,
    },
    {
      id: 'error-state',
      name: 'Error State',
      category: 'Feedback',
      description: 'Displayed when an operation fails. Provides a clear, actionable message appropriate for financial professionals without exposing implementation details.',
      preview: (
        <Alert className="border-red-200 bg-red-50 max-w-md">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Unable to Load Client Data</AlertTitle>
          <AlertDescription className="text-red-700 text-sm">
            There was a problem retrieving client information. Please check your connection and try again.
            <div className="mt-3">
              <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ),
      code: `<Alert className="border-red-200 bg-red-50">
  <AlertCircle className="h-4 w-4 text-red-600" />
  <AlertTitle className="text-red-800">Unable to Load Client Data</AlertTitle>
  <AlertDescription className="text-red-700 text-sm">
    There was a problem retrieving client information.
    Please check your connection and try again.
    <div className="mt-3">
      <Button size="sm" variant="outline"
        className="border-red-300 text-red-700 hover:bg-red-100"
        onClick={refetch}>
        Retry
      </Button>
    </div>
  </AlertDescription>
</Alert>`,
    },
    {
      id: 'loading-spinner',
      name: 'Loading Spinner',
      category: 'Feedback',
      description: 'Inline and full-page loading indicators using the Loader2 icon with spin animation.',
      preview: (
        <div className="flex items-center gap-8">
          {/* Inline */}
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-gray-600">Loading...</span>
          </div>
          {/* Button */}
          <Button className="bg-primary text-white" disabled>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Saving...
          </Button>
          {/* Centered */}
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs text-gray-500">Please wait</span>
          </div>
        </div>
      ),
      code: `{/* Inline loader */}
<div className="flex items-center gap-2">
  <Loader2 className="h-4 w-4 animate-spin text-primary" />
  <span className="text-sm text-gray-600">Loading...</span>
</div>

{/* Button loading state */}
<Button className="bg-primary text-white" disabled>
  <Loader2 className="h-4 w-4 animate-spin mr-2" />
  Saving...
</Button>

{/* Full-page centered loader */}
<div className="flex flex-col items-center justify-center py-16">
  <Loader2 className="h-8 w-8 animate-spin text-primary" />
  <span className="text-sm text-gray-500 mt-3">Loading data...</span>
</div>`,
    },
    {
      id: 'form-validation',
      name: 'Form Validation',
      category: 'Forms',
      description: 'Inline validation feedback for form fields with error, success, and helper text states.',
      preview: (
        <div className="space-y-5 max-w-sm">
          {/* Error state */}
          <div>
            <Label htmlFor="email-err" className="text-sm font-medium text-black">Email Address</Label>
            <Input
              id="email-err"
              type="email"
              defaultValue="invalid-email"
              readOnly
              className="mt-1 border-red-300 focus-visible:ring-red-400"
            />
            <p className="text-xs text-red-600 mt-1">Please enter a valid email address</p>
          </div>
          {/* Success state */}
          <div>
            <Label htmlFor="name-ok" className="text-sm font-medium text-black">Full Name</Label>
            <Input
              id="name-ok"
              type="text"
              defaultValue="John Doe"
              readOnly
              className="mt-1 border-green-300 focus-visible:ring-green-400"
            />
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Looks good
            </p>
          </div>
          {/* Helper text */}
          <div>
            <Label htmlFor="id-num" className="text-sm font-medium text-black">
              ID Number <span className="text-red-500">*</span>
            </Label>
            <Input id="id-num" type="text" placeholder="13 digit SA ID number" className="mt-1" />
            <p className="text-xs text-gray-500 mt-1">Required for FICA compliance</p>
          </div>
        </div>
      ),
      code: `{/* Error state */}
<div>
  <Label htmlFor="email">Email Address</Label>
  <Input
    id="email"
    className="mt-1 border-red-300 focus-visible:ring-red-400"
  />
  <p className="text-xs text-red-600 mt-1">Please enter a valid email address</p>
</div>

{/* Success state */}
<div>
  <Label htmlFor="name">Full Name</Label>
  <Input
    id="name"
    className="mt-1 border-green-300 focus-visible:ring-green-400"
  />
  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
    <CheckCircle className="h-3 w-3" /> Looks good
  </p>
</div>

{/* Required field with helper */}
<div>
  <Label htmlFor="id">ID Number <span className="text-red-500">*</span></Label>
  <Input id="id" placeholder="13 digit SA ID number" className="mt-1" />
  <p className="text-xs text-gray-500 mt-1">Required for FICA compliance</p>
</div>`,
    },
    {
      id: 'toggle-switch',
      name: 'Toggle / Switch',
      category: 'Forms',
      description: 'Used for binary settings like enabling notifications, two-factor auth, or feature flags.',
      preview: (
        <div className="space-y-4 max-w-sm">
          {[
            { id: 'notifications', label: 'Email Notifications', desc: 'Receive updates about your portfolio', checked: true },
            { id: '2fa', label: 'Two-Factor Authentication', desc: 'Add an extra layer of security', checked: false },
            { id: 'marketing', label: 'Marketing Communications', desc: 'Newsletters and promotional content', checked: true },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
              <div className="space-y-0.5">
                <Label htmlFor={item.id} className="text-sm font-medium text-black cursor-pointer">{item.label}</Label>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <Switch id={item.id} defaultChecked={item.checked} />
            </div>
          ))}
        </div>
      ),
      code: `<div className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
  <div className="space-y-0.5">
    <Label htmlFor="notifications" className="text-sm font-medium text-black cursor-pointer">
      Email Notifications
    </Label>
    <p className="text-xs text-gray-500">
      Receive updates about your portfolio
    </p>
  </div>
  <Switch id="notifications" checked={enabled} onCheckedChange={setEnabled} />
</div>`,
    },
    {
      id: 'tooltip-pattern',
      name: 'Tooltips',
      category: 'Interaction',
      description: 'Contextual hints shown on hover for icons, truncated text, or information buttons.',
      preview: (
        <TooltipProvider>
          <div className="flex items-center gap-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="border-gray-300">
                  <Info className="h-4 w-4 mr-2" />
                  Hover me
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">This is a helpful tooltip</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <Info className="h-5 w-5 text-gray-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">FSP-compliant risk assessment required</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      ),
      code: `import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <button className="p-2 rounded-lg hover:bg-gray-100">
        <Info className="h-5 w-5 text-gray-400" />
      </button>
    </TooltipTrigger>
    <TooltipContent>
      <p className="text-sm">FSP-compliant risk assessment required</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>`,
    },
    {
      id: 'data-table-row',
      name: 'Data Table Row',
      category: 'Data Display',
      description: 'Standard table row pattern used across admin modules. Includes avatar, name, status badge, and action buttons.',
      preview: (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'John Doe', email: 'john@example.com', status: 'Active', initials: 'JD', color: 'bg-primary' },
                { name: 'Sarah van der Merwe', email: 'sarah@example.com', status: 'Pending', initials: 'SM', color: 'bg-blue-600' },
                { name: 'Mike Johnson', email: 'mike@example.com', status: 'Suspended', initials: 'MJ', color: 'bg-amber-600' },
              ].map((row) => (
                <tr key={row.name} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${row.color} rounded-full flex items-center justify-center text-white text-xs font-medium`}>
                        {row.initials}
                      </div>
                      <span className="font-medium text-black">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.email}</td>
                  <td className="px-4 py-3">
                    <Badge className={
                      row.status === 'Active' ? 'bg-green-600 text-white' :
                      row.status === 'Pending' ? 'bg-blue-600 text-white' :
                      'bg-amber-500 text-white'
                    }>{row.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="text-gray-500 hover:text-primary">View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
      code: `<table className="w-full text-sm">
  <thead>
    <tr className="bg-gray-50 border-b border-gray-200">
      <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
      <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
    </tr>
  </thead>
  <tbody>
    {clients.map((client) => (
      <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-white">{initials}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-black">{client.name}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge className={STATUS_CONFIG[status].badgeClass}>
            {STATUS_CONFIG[status].label}
          </Badge>
        </td>
        <td className="px-4 py-3 text-right">
          <Button variant="ghost" size="sm">View</Button>
        </td>
      </tr>
    ))}
  </tbody>
</table>`,
    },
    {
      id: 'search-filter-bar',
      name: 'Search & Filter Bar',
      category: 'Interaction',
      description: 'Standard search and filter pattern used across admin module list views. Search input with icon, category filter pills, and optional action button.',
      preview: (
        <div className="space-y-3 w-full">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search clients..." className="pl-10" />
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-white">
              Add Client
            </Button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {['All (128)', 'Active (94)', 'Pending (22)', 'Suspended (8)', 'Closed (4)'].map((label, i) => (
              <button
                key={label}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  i === 0 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ),
      code: `<div className="space-y-3">
  <div className="flex flex-col sm:flex-row gap-3">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        placeholder="Search clients..."
        className="pl-10"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
    <Button className="bg-primary hover:bg-primary/90 text-white">
      Add Client
    </Button>
  </div>

  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
    {filters.map((filter) => (
      <button
        key={filter.value}
        onClick={() => setActiveFilter(filter.value)}
        className={\`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors \${
          activeFilter === filter.value
            ? 'bg-primary text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }\`}
      >
        {filter.label} ({filter.count})
      </button>
    ))}
  </div>
</div>`,
    },
    {
      id: 'confirmation-dialog',
      name: 'Destructive Action Confirmation',
      category: 'Interaction',
      description: 'Confirmation pattern for destructive actions like deletion or account closure. Uses warning colours and requires explicit confirmation.',
      preview: (
        <Card className="border-red-200 max-w-sm mx-auto">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-semibold text-black mb-1">Close Client Account</h4>
                <p className="text-sm text-gray-600 mb-4">
                  This will permanently close the account for <strong>John Doe</strong>. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" className="border-gray-300">
                    Cancel
                  </Button>
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                    Close Account
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ),
      code: `<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="outline" className="text-red-600 border-red-300">
      Close Account
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Close Client Account</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently close the account for <strong>{clientName}</strong>.
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white">
        Close Account
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`,
    },
  ];

  const categories = ['all', ...Array.from(new Set(patterns.map((p) => p.category)))];

  const filteredPatterns = patterns.filter(
    (p) => selectedCategory === 'all' || p.category === selectedCategory,
  );

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Introduction */}
      <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex items-center justify-center">
            <Layers className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl md:text-2xl font-bold text-black mb-2 md:mb-3">UI Patterns</h3>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
              Established UI patterns used throughout the Navigate Wealth platform. These are composed from
              Design System primitives and represent the standard way to build common interface elements.
              Use these patterns to maintain consistency across all modules.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20">{patterns.length} Patterns</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">Production Proven</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">Copy &amp; Paste</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {categories.map((cat) => {
          const count = cat === 'all' ? patterns.length : patterns.filter((p) => p.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat === 'all' ? 'All' : cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Patterns List */}
      <div className="space-y-6 md:space-y-8">
        {filteredPatterns.map((pattern) => (
          <Card key={pattern.id} className="border-gray-200 hover:border-primary/30 transition-colors overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <CardTitle className="text-lg md:text-xl text-black">{pattern.name}</CardTitle>
                    <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                      {pattern.category}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm md:text-base text-gray-600">
                    {pattern.description}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyCode(pattern.code, pattern.id)}
                  className="border-gray-300 hover:border-primary hover:bg-primary/5 self-start sm:self-auto"
                >
                  {copiedCode === pattern.id ? (
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
              {/* Preview */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-black">Preview</span>
                </div>
                <div className="p-6 md:p-8 bg-gradient-to-br from-gray-50 to-white rounded-lg border-2 border-gray-200 flex items-center justify-center">
                  {pattern.preview}
                </div>
              </div>

              {/* Code (Collapsible) */}
              <div>
                <button
                  onClick={() => setExpandedCode(expandedCode === pattern.id ? null : pattern.id)}
                  className="w-full flex items-center justify-between mb-3 group"
                >
                  <span className="text-sm font-semibold text-black flex items-center">
                    <Code className="h-4 w-4 mr-2 text-primary" />
                    Code
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${
                      expandedCode === pattern.id ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedCode === pattern.id && (
                  <div className="relative group/code">
                    <pre className="text-xs md:text-sm bg-gray-900 text-gray-100 p-4 md:p-6 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                      <code>{pattern.code}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyCode(pattern.code, `${pattern.id}-code`)}
                      className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
                    >
                      {copiedCode === `${pattern.id}-code` ? (
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

      {/* Best Practices */}
      <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
        <Alert className="border-primary/20 bg-primary/5">
          <Layers className="h-4 w-4 text-primary" />
          <AlertTitle className="text-black">Survey Before Creating</AlertTitle>
          <AlertDescription className="text-gray-600 text-sm">
            Before building a new UI pattern, check existing modules for established implementations. Match existing spacing, sizing, and interaction patterns.
          </AlertDescription>
        </Alert>

        <Alert className="border-primary/20 bg-primary/5">
          <Shield className="h-4 w-4 text-primary" />
          <AlertTitle className="text-black">Config-Driven UI</AlertTitle>
          <AlertDescription className="text-gray-600 text-sm">
            Status indicators, badges, and labels should always be driven by typed configuration objects (constants.ts), never hard-coded inline in JSX.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}