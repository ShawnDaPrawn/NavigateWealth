import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table';
import { SVGLineChart, SVGBarChart, SVGPieChart } from '../../../ui/svg-charts';
import { 
  Download, 
  TrendingUp, 
  TrendingDown,
  Eye,
  MousePointer,
  Heart,
  MessageCircle,
  Share,
  Users,
  Calendar,
  Filter,
  BarChart3,
  FileText,
  Mail
} from 'lucide-react';
import { SocialPost, SocialPlatform, Campaign } from './types';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6'];

const MOCK_ENGAGEMENT = [
  { month: 'Oct', linkedin: 420, instagram: 380, facebook: 210, x: 150 },
  { month: 'Nov', linkedin: 510, instagram: 430, facebook: 240, x: 170 },
  { month: 'Dec', linkedin: 480, instagram: 460, facebook: 220, x: 190 },
  { month: 'Jan', linkedin: 560, instagram: 510, facebook: 260, x: 200 },
  { month: 'Feb', linkedin: 610, instagram: 550, facebook: 290, x: 230 },
  { month: 'Mar', linkedin: 680, instagram: 600, facebook: 310, x: 260 },
];

const MOCK_PLATFORM_SHARE = [
  { name: 'LinkedIn', value: 42, color: '#6366f1' },
  { name: 'Instagram', value: 28, color: '#ec4899' },
  { name: 'Facebook', value: 18, color: '#3b82f6' },
  { name: 'X', value: 12, color: '#14b8a6' },
];

const MOCK_TOP_POSTS = [
  { id: '1', platform: 'linkedin' as SocialPlatform, content: 'Navigate Wealth quarterly market update…', impressions: 4820, engagement: 312, clicks: 89 },
  { id: '2', platform: 'instagram' as SocialPlatform, content: 'Financial planning tips for the new year…', impressions: 3910, engagement: 278, clicks: 54 },
  { id: '3', platform: 'facebook' as SocialPlatform, content: 'Understanding estate duty in South Africa…', impressions: 2640, engagement: 196, clicks: 67 },
  { id: '4', platform: 'x' as SocialPlatform, content: 'Market volatility: what it means for your…', impressions: 1890, engagement: 143, clicks: 41 },
];

export function SocialAnalytics() {
  const [period, setPeriod] = useState<string>('6m');
  const [activeTab, setActiveTab] = useState<string>('overview');

  const totalImpressions = 84200;
  const totalEngagement = 5310;
  const totalClicks = 1840;
  const totalFollowers = 12480;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Social Analytics</h2>
          <p className="text-sm text-muted-foreground">Performance across all connected platforms</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">Last month</SelectItem>
              <SelectItem value="3m">Last 3 months</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Impressions', value: totalImpressions.toLocaleString(), icon: Eye, trend: '+12%', up: true },
          { label: 'Engagements', value: totalEngagement.toLocaleString(), icon: Heart, trend: '+8%', up: true },
          { label: 'Link Clicks', value: totalClicks.toLocaleString(), icon: MousePointer, trend: '-3%', up: false },
          { label: 'Total Followers', value: totalFollowers.toLocaleString(), icon: Users, trend: '+5%', up: true },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg">
                  <stat.icon className="h-4 w-4 text-gray-500" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                {stat.up
                  ? <TrendingUp className="h-3 w-3 text-green-600" />
                  : <TrendingDown className="h-3 w-3 text-red-500" />}
                <span className={`text-xs font-medium ${stat.up ? 'text-green-600' : 'text-red-500'}`}>{stat.trend}</span>
                <span className="text-xs text-muted-foreground">vs prev period</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="posts">
            <FileText className="h-4 w-4 mr-1" />
            Top Posts
          </TabsTrigger>
          <TabsTrigger value="platforms">
            <Share className="h-4 w-4 mr-1" />
            Platforms
          </TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Engagement by Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <SVGLineChart
                data={MOCK_ENGAGEMENT}
                categoryKey="month"
                series={[
                  { key: 'linkedin', label: 'LinkedIn', color: '#6366f1' },
                  { key: 'instagram', label: 'Instagram', color: '#ec4899' },
                  { key: 'facebook', label: 'Facebook', color: '#3b82f6' },
                  { key: 'x', label: 'X', color: '#14b8a6' },
                ]}
                height={260}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Posts tab */}
        <TabsContent value="posts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Top Performing Posts</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Engagements</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_TOP_POSTS.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{post.platform}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-gray-700">{post.content}</TableCell>
                      <TableCell className="text-right text-sm">{post.impressions.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm">{post.engagement.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm">{post.clicks.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platforms tab */}
        <TabsContent value="platforms" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Impression Share by Platform</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <SVGPieChart
                  data={MOCK_PLATFORM_SHARE}
                  height={220}
                  showLabels
                  tooltipFormatter={(value) => `${value}%`}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Post Volume by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <SVGBarChart
                  data={MOCK_ENGAGEMENT.slice(-3)}
                  categoryKey="month"
                  series={[
                    { key: 'linkedin', label: 'LinkedIn', color: '#6366f1' },
                    { key: 'instagram', label: 'Instagram', color: '#ec4899' },
                    { key: 'facebook', label: 'Facebook', color: '#3b82f6' },
                    { key: 'x', label: 'X', color: '#14b8a6' },
                  ]}
                  height={220}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
