/**
 * AI Analytics Dashboard
 *
 * Displays AI generation usage statistics including:
 * - Total generations by type (text, image, bundle)
 * - Platform breakdown
 * - Tone and goal distribution
 * - Daily activity chart (last 30 days)
 * - Recent generation activity feed
 *
 * @module social-media/components/AIAnalyticsDashboard
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import {
  Loader2,
  BarChart3,
  Type,
  Image as ImageIcon,
  Layers,
  Linkedin,
  Instagram,
  Facebook,
  Twitter,
  RefreshCw,
  AlertCircle,
  Activity,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { useAIAnalytics } from '../hooks/useAIAnalytics';
import { BRAND } from '../constants';

// ============================================================================
// Constants
// ============================================================================

const PLATFORM_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  linkedin: { label: 'LinkedIn', icon: <Linkedin className="h-3.5 w-3.5" /> },
  instagram: { label: 'Instagram', icon: <Instagram className="h-3.5 w-3.5" /> },
  facebook: { label: 'Facebook', icon: <Facebook className="h-3.5 w-3.5" /> },
  x: { label: 'X', icon: <Twitter className="h-3.5 w-3.5" /> },
  instagram_story: { label: 'IG Story', icon: <Instagram className="h-3.5 w-3.5" /> },
};

const TONE_LABELS: Record<string, string> = {
  professional: 'Professional',
  conversational: 'Conversational',
  authoritative: 'Authoritative',
  friendly: 'Friendly',
  educational: 'Educational',
};

const GOAL_LABELS: Record<string, string> = {
  engagement: 'Engagement',
  awareness: 'Awareness',
  education: 'Education',
  promotion: 'Promotion',
  thought_leadership: 'Thought Leadership',
};

const STYLE_LABELS: Record<string, string> = {
  editorial: 'Editorial',
  photorealistic: 'Photorealistic',
  abstract: 'Abstract',
  conceptual: 'Conceptual',
  lifestyle: 'Lifestyle',
  data_visualisation: 'Data Viz',
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  text: { label: 'Text', icon: <Type className="h-5 w-5" /> },
  image: { label: 'Image', icon: <ImageIcon className="h-5 w-5" /> },
  bundle: { label: 'Bundle', icon: <Layers className="h-5 w-5" /> },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
}

// ============================================================================
// Sub-components
// ============================================================================

function BreakdownBar({ items, labels }: { items: Record<string, number>; labels: Record<string, string> }) {
  const total = Object.values(items).reduce((s, v) => s + v, 0);
  if (total === 0) return <p className="text-xs text-muted-foreground">No data yet</p>;

  const sorted = Object.entries(items).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2">
      {sorted.map(([key, count]) => {
        const pct = Math.round((count / total) * 100);
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-700 capitalize">{labels[key] || key.replace('_', ' ')}</span>
              <span className="text-muted-foreground">{count} ({pct}%)</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: BRAND.navy }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function AIAnalyticsDashboard() {
  const { analytics, analyticsLoading, analyticsError, refetchAnalytics } = useAIAnalytics();

  if (analyticsLoading) {
    return (
      <Card><CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading analytics...</span>
      </CardContent></Card>
    );
  }

  if (analyticsError) {
    return (
      <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
        <p className="text-sm text-muted-foreground mb-3">{analyticsError}</p>
        <Button variant="outline" size="sm" onClick={() => refetchAnalytics()}>
          <RefreshCw className="h-3 w-3 mr-1.5" /> Retry
        </Button>
      </CardContent></Card>
    );
  }

  if (!analytics) {
    return (
      <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <BarChart3 className="h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Analytics Data</h3>
        <p className="text-muted-foreground max-w-md">Generate some AI content to start seeing usage analytics here.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Generations</p>
                <p className="text-2xl font-medium">{analytics.totalGenerations}</p>
              </div>
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gray-50">
                <TrendingUp className="h-5 w-5 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {(['text', 'image', 'bundle'] as const).map((type) => {
          const cfg = TYPE_CONFIG[type];
          const count = type === 'text'
            ? analytics.totalTextGenerations
            : type === 'image'
              ? analytics.totalImageGenerations
              : analytics.totalBundleGenerations;
          return (
            <Card key={type}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{cfg.label} Generations</p>
                    <p className="text-2xl font-medium">{count}</p>
                  </div>
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg" style={{ backgroundColor: BRAND.navyLight }}>
                    <span style={{ color: BRAND.navy }}>{cfg.icon}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Activity Chart */}
      {analytics.dailyActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: BRAND.navy }} /> Daily Activity (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.dailyActivity} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={30} />
                  <Tooltip
                    labelFormatter={(v) => formatDate(v as string)}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="text" name="Text" fill={BRAND.navy} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="image" name="Image" fill={BRAND.gold} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="bundle" name="Bundle" fill="#8B9CAF" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Platform Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(analytics.platformBreakdown).sort((a, b) => b[1] - a[1]).map(([p, count]) => {
                const cfg = PLATFORM_LABELS[p];
                return (
                  <div key={p} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-gray-700">
                      {cfg?.icon}
                      <span className="capitalize">{cfg?.label || p}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">{count}</Badge>
                  </div>
                );
              })}
              {Object.keys(analytics.platformBreakdown).length === 0 && (
                <p className="text-xs text-muted-foreground">No data yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Tone Distribution</CardTitle></CardHeader>
          <CardContent><BreakdownBar items={analytics.toneBreakdown} labels={TONE_LABELS} /></CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Goal Distribution</CardTitle></CardHeader>
          <CardContent><BreakdownBar items={analytics.goalBreakdown} labels={GOAL_LABELS} /></CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Image Style Usage</CardTitle></CardHeader>
          <CardContent><BreakdownBar items={analytics.styleBreakdown} labels={STYLE_LABELS} /></CardContent>
        </Card>
      </div>

      {/* Recent Activity Feed */}
      {analytics.recentGenerations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent Generations</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => refetchAnalytics()} className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {analytics.recentGenerations.map((gen) => {
                const cfg = TYPE_CONFIG[gen.type];
                return (
                  <div key={gen.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0" style={{ backgroundColor: BRAND.navyLight }}>
                      <span className="[&>svg]:h-4 [&>svg]:w-4" style={{ color: BRAND.navy }}>{cfg?.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{gen.topic || 'Untitled'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{cfg?.label || gen.type}</Badge>
                        {gen.platforms?.map((p) => (
                          <span key={p} className="text-[9px] text-muted-foreground capitalize">{p === 'x' ? 'X' : p}</span>
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatDate(gen.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}