import React, { useState } from 'react';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { 
  PlusCircle, 
  Users, 
  Link2, 
  TrendingUp, 
  DollarSign,
  Eye,
  UserPlus,
  MoreVertical,
  ExternalLink,
  Copy,
  BarChart3,
  Calendar,
  Search
} from 'lucide-react';
import { cn } from '../../../ui/utils';
import { toast } from 'sonner@2.0.3';

interface Partner {
  id: string;
  name: string;
  company: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  referralLink: string;
  signups: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  joinDate: Date;
  lastActivity?: Date;
}

// TODO: Replace with backend endpoint when partner/referral management API is implemented
// Currently using placeholder data — no backend exists for this feature yet
const PLACEHOLDER_PARTNERS: Partner[] = [
  {
    id: '1',
    name: 'John Smith',
    company: 'Smith Financial Advisors',
    email: 'john@smithfinancial.com',
    status: 'active',
    referralLink: 'https://navigatewealth.com/ref/smithfinancial',
    signups: 47,
    conversions: 23,
    revenue: 115000,
    conversionRate: 48.9,
    joinDate: new Date('2024-09-15'),
    lastActivity: new Date('2025-01-02')
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    company: 'Johnson Wealth Management',
    email: 'sarah@johnsonwealth.com',
    status: 'active',
    referralLink: 'https://navigatewealth.com/ref/johnsonwealth',
    signups: 32,
    conversions: 18,
    revenue: 89000,
    conversionRate: 56.3,
    joinDate: new Date('2024-10-20'),
    lastActivity: new Date('2025-01-01')
  },
  {
    id: '3',
    name: 'Michael Chen',
    company: 'Chen Investment Group',
    email: 'michael@cheninvestments.com',
    status: 'pending',
    referralLink: 'https://navigatewealth.com/ref/cheninvestments',
    signups: 0,
    conversions: 0,
    revenue: 0,
    conversionRate: 0,
    joinDate: new Date('2025-01-01')
  },
  {
    id: '4',
    name: 'Emily Rodriguez',
    company: 'Rodriguez Financial Partners',
    email: 'emily@rodriguezfp.com',
    status: 'inactive',
    referralLink: 'https://navigatewealth.com/ref/rodriguezfp',
    signups: 15,
    conversions: 7,
    revenue: 34500,
    conversionRate: 46.7,
    joinDate: new Date('2024-08-10'),
    lastActivity: new Date('2024-11-20')
  }
];

export function PartnersTab() {
  const [partners] = useState<Partner[]>(PLACEHOLDER_PARTNERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const activePartners = partners.filter(p => p.status === 'active').length;
  const totalSignups = partners.reduce((sum, p) => sum + p.signups, 0);
  const totalConversions = partners.reduce((sum, p) => sum + p.conversions, 0);
  const totalRevenue = partners.reduce((sum, p) => sum + p.revenue, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const copyReferralLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Referral link copied to clipboard');
  };

  const filteredPartners = partners.filter(partner => {
    const matchesSearch = searchQuery === '' || 
      partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !selectedStatus || partner.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Partners</p>
                <p className="text-2xl font-medium">{activePartners}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Signups</p>
                <p className="text-2xl font-medium">{totalSignups}</p>
              </div>
              <UserPlus className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversions</p>
                <p className="text-2xl font-medium">{totalConversions}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-medium">
                  ${totalRevenue >= 1000 ? `${(totalRevenue / 1000).toFixed(0)}K` : totalRevenue}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partners Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Partner Advertisers</CardTitle>
              <CardDescription>
                Manage partner relationships and track referral performance
              </CardDescription>
            </div>
            <Button className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Add Partner
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search partners..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus(e.target.value || null)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Partners List */}
          <div className="space-y-3">
            {filteredPartners.map((partner) => (
              <div
                key={partner.id}
                className="border border-gray-200 rounded-lg p-5 hover:border-purple-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{partner.name}</h3>
                          <Badge className={cn("text-xs", getStatusColor(partner.status))}>
                            {partner.status.charAt(0).toUpperCase() + partner.status.slice(1)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{partner.company}</p>
                        <p className="text-xs text-gray-500">{partner.email}</p>
                      </div>
                    </div>

                    {/* Referral Link */}
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <Link2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <code className="text-xs text-gray-700 flex-1 truncate">{partner.referralLink}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyReferralLink(partner.referralLink)}
                        className="flex-shrink-0"
                        aria-label="Copy referral link"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0"
                        aria-label="Open referral link"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Signups</p>
                        <p className="text-lg font-semibold text-gray-900">{partner.signups}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Conversions</p>
                        <p className="text-lg font-semibold text-gray-900">{partner.conversions}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Conv. Rate</p>
                        <p className="text-lg font-semibold text-gray-900">{partner.conversionRate.toFixed(1)}%</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Revenue</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ${partner.revenue >= 1000 ? `${(partner.revenue / 1000).toFixed(0)}K` : partner.revenue}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Last Activity</p>
                        <p className="text-sm text-gray-700">
                          {partner.lastActivity 
                            ? partner.lastActivity.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : 'Never'
                          }
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <Button variant="outline" size="sm" className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        View Analytics
                      </Button>
                      <Button variant="outline" size="sm" className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Activity Log
                      </Button>
                      <div className="ml-auto">
                        <Button variant="ghost" size="sm" aria-label="More partner options">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredPartners.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No partners found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}