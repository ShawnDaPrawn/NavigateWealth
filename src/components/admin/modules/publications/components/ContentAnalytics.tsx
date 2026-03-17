/**
 * Content Analytics Dashboard
 *
 * Rich analytics overview for the Publications module showing:
 * - KPI cards with trends
 * - Publishing velocity chart
 * - Content pipeline funnel
 * - Category distribution
 * - Top performing articles
 *
 * @module publications/components/ContentAnalytics
 */

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import {
  FileText,
  Eye,
  TrendingUp,
  TrendingDown,
  Star,
  Send,
  CheckCircle2,
  PenLine,
  Archive,
  CalendarDays,
} from 'lucide-react';
import { cn } from '../../../../ui/utils';
import type { Article, Category } from '../types';

interface ContentAnalyticsProps {
  articles: Article[];
  categories: Category[];
}

// Status colour tokens
const STATUS_CHART_COLORS: Record<string, string> = {
  published: '#16a34a',
  draft: '#6b7280',
  in_review: '#eab308',
  scheduled: '#3b82f6',
  archived: '#ef4444',
};

const CATEGORY_COLORS = [
  '#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#8b5cf6',
];

// ── Helpers ──────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short' });
}

// ── Component ────────────────────────────────────────────────────────────

export function ContentAnalytics({ articles, categories }: ContentAnalyticsProps) {
  // ── KPI computation ──────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = daysAgo(30);
    const sixtyDaysAgo = daysAgo(60);

    const published = articles.filter(a => a.status === 'published');
    const recentPublished = published.filter(a => a.published_at && new Date(a.published_at) >= thirtyDaysAgo);
    const prevPublished = published.filter(a =>
      a.published_at &&
      new Date(a.published_at) >= sixtyDaysAgo &&
      new Date(a.published_at) < thirtyDaysAgo,
    );

    const totalViews = articles.reduce((sum, a) => sum + (a.view_count || 0), 0);
    const avgViews = published.length > 0 ? Math.round(totalViews / published.length) : 0;

    const drafts = articles.filter(a => a.status === 'draft');
    const scheduled = articles.filter(a => a.status === 'scheduled');
    const featured = articles.filter(a => a.is_featured);

    return {
      total: articles.length,
      published: published.length,
      recentPublished: recentPublished.length,
      prevPublished: prevPublished.length,
      drafts: drafts.length,
      scheduled: scheduled.length,
      featured: featured.length,
      totalViews,
      avgViews,
    };
  }, [articles]);

  // ── Publishing velocity (last 6 months) ──────────────────────────────

  const velocityData = useMemo(() => {
    const months: { label: string; published: number; drafts: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const publishedInMonth = articles.filter(a => {
        const d = a.published_at ? new Date(a.published_at) : null;
        return d && d >= monthStart && d <= monthEnd;
      }).length;

      const createdInMonth = articles.filter(a => {
        const d = new Date(a.created_at);
        return d >= monthStart && d <= monthEnd;
      }).length;

      months.push({
        label: monthLabel(monthStart),
        published: publishedInMonth,
        drafts: createdInMonth,
      });
    }

    return months;
  }, [articles]);

  // ── Pipeline funnel ──────────────────────────────────────────────────

  const pipelineData = useMemo(() => {
    const statusCounts = {
      draft: 0,
      in_review: 0,
      scheduled: 0,
      published: 0,
      archived: 0,
    };

    articles.forEach(a => {
      if (a.status in statusCounts) {
        statusCounts[a.status as keyof typeof statusCounts]++;
      }
    });

    return [
      { name: 'Drafts', value: statusCounts.draft, color: STATUS_CHART_COLORS.draft, icon: PenLine },
      { name: 'In Review', value: statusCounts.in_review, color: STATUS_CHART_COLORS.in_review, icon: Send },
      { name: 'Scheduled', value: statusCounts.scheduled, color: STATUS_CHART_COLORS.scheduled, icon: CalendarDays },
      { name: 'Published', value: statusCounts.published, color: STATUS_CHART_COLORS.published, icon: CheckCircle2 },
      { name: 'Archived', value: statusCounts.archived, color: STATUS_CHART_COLORS.archived, icon: Archive },
    ];
  }, [articles]);

  // ── Category distribution (pie chart) ────────────────────────────────

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    articles.forEach(a => {
      const cat = categories.find(c => c.id === a.category_id);
      const label = cat?.name || 'Uncategorised';
      counts[label] = (counts[label] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value], i) => ({ id: `cat-${i}`, name, value, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [articles, categories]);

  // ── Top articles by views ────────────────────────────────────────────

  const topArticles = useMemo(
    () =>
      [...articles]
        .filter(a => a.status === 'published')
        .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, 5),
    [articles],
  );

  // ── Trend helper ─────────────────────────────────────────────────────

  const trendPercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const publishTrend = trendPercent(kpis.recentPublished, kpis.prevPublished);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── KPI Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          label="Total Articles"
          value={kpis.total}
          icon={FileText}
          accent="purple"
        />
        <KPICard
          label="Published"
          value={kpis.published}
          icon={CheckCircle2}
          accent="green"
          trend={publishTrend}
          trendLabel="vs prev 30 days"
        />
        <KPICard
          label="Total Views"
          value={kpis.totalViews.toLocaleString()}
          icon={Eye}
          accent="blue"
          sub={`${kpis.avgViews} avg / article`}
        />
        <KPICard
          label="Featured"
          value={kpis.featured}
          icon={Star}
          accent="amber"
          sub={`${kpis.drafts} drafts in pipeline`}
        />
      </div>

      {/* ── Charts Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Publishing Velocity */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Publishing Velocity</CardTitle>
              <span className="text-xs text-muted-foreground">Last 6 months</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[260px]">
              {/* WORKAROUND: Custom SVG line chart replaces recharts LineChart/AreaChart because
                  recharts v2.x CategoricalChartWrapper internally renders multiple null-keyed SVG
                  elements (clip-path <defs>, background <rect>) causing React duplicate key warnings.
                  This is a known recharts internal bug that cannot be fixed from consumer code. */}
              <VelocityLineChart data={velocityData} />
            </div>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">By Category</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {categoryData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                No category data yet
              </div>
            ) : (
              <div className="h-[260px] flex items-center gap-2">
                <div className="w-1/2 h-full flex items-center justify-center">
                  <DonutChart data={categoryData} />
                </div>
                <div className="w-1/2 space-y-2 max-h-[260px] overflow-auto pr-1">
                  {categoryData.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-2 text-sm">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="truncate text-gray-700">{cat.name}</span>
                      <span className="ml-auto font-medium text-gray-900">{cat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Content Pipeline */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Content Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {pipelineData.map((stage) => {
              const pct = articles.length > 0 ? Math.round((stage.value / articles.length) * 100) : 0;
              const Icon = stage.icon;
              return (
                <div key={stage.name} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${stage.color}18` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: stage.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{stage.name}</span>
                      <span className="text-sm font-semibold text-gray-900">{stage.value}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: stage.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Top Performing Articles */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Top Performing</CardTitle>
              <span className="text-xs text-muted-foreground">By views</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {topArticles.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No published articles yet
              </div>
            ) : (
              <div className="space-y-3">
                {topArticles.map((article, i) => {
                  const cat = categories.find(c => c.id === article.category_id);
                  return (
                    <div key={article.id} className="flex items-center gap-3 group">
                      <div className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
                        i === 0 ? 'bg-purple-100 text-purple-700'
                          : i === 1 ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600',
                      )}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-purple-700 transition-colors">
                          {article.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {cat?.name || 'Uncategorised'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 shrink-0">
                        <Eye className="w-3.5 h-3.5" />
                        <span className="font-medium">{(article.view_count || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: 'purple' | 'green' | 'blue' | 'amber';
  trend?: number;
  trendLabel?: string;
  sub?: string;
}

const ACCENT_MAP = {
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-100' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  ring: 'ring-green-100' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   ring: 'ring-blue-100' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600',  ring: 'ring-amber-100' },
};

function KPICard({ label, value, icon: Icon, accent, trend, trendLabel, sub }: KPICardProps) {
  const a = ACCENT_MAP[accent];
  const isUp = (trend ?? 0) >= 0;

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight text-gray-900">{value}</p>
          </div>
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center ring-1', a.bg, a.ring)}>
            <Icon className={cn('w-5 h-5', a.text)} />
          </div>
        </div>

        {trend !== undefined && (
          <div className="flex items-center gap-1.5 mt-2">
            {isUp ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            )}
            <span className={cn('text-xs font-medium', isUp ? 'text-green-600' : 'text-red-500')}>
              {isUp ? '+' : ''}{trend}%
            </span>
            {trendLabel && (
              <span className="text-xs text-muted-foreground">{trendLabel}</span>
            )}
          </div>
        )}

        {sub && !trend && (
          <p className="text-xs text-muted-foreground mt-2">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Custom SVG Line Chart (replaces recharts LineChart) ──────────────────

interface VelocityLineChartProps {
  data: { label: string; published: number; drafts: number }[];
}

function VelocityLineChart({ data }: VelocityLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 400, h: 260 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; idx: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 20, right: 16, bottom: 32, left: 40 };
  const chartW = dims.w - pad.left - pad.right;
  const chartH = dims.h - pad.top - pad.bottom;

  const allValues = data.flatMap(d => [d.published, d.drafts]);
  const maxVal = Math.max(...allValues, 1);
  // Round up to nearest nice number for Y axis
  const niceMax = Math.ceil(maxVal / (maxVal > 10 ? 5 : 1)) * (maxVal > 10 ? 5 : 1);
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((niceMax / 4) * i));

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;
  const toX = (i: number) => pad.left + i * xStep;
  const toY = (v: number) => pad.top + chartH - (v / niceMax) * chartH;

  const buildPath = (key: 'published' | 'drafts') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d[key]).toFixed(1)}`).join(' ');

  const publishedPath = buildPath('published');
  const draftsPath = buildPath('drafts');

  // Gradient fill path (close to bottom)
  const fillPath = `${publishedPath} L${toX(data.length - 1).toFixed(1)},${toY(0).toFixed(1)} L${toX(0).toFixed(1)},${toY(0).toFixed(1)} Z`;

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left - pad.left;
    const idx = Math.round(mx / xStep);
    if (idx >= 0 && idx < data.length) {
      setTooltip({ x: toX(idx), y: e.clientY - rect.top, idx });
    }
  }, [data.length, xStep, pad.left]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg
        width={dims.w}
        height={dims.h}
        className="select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs key="velocity-defs">
          <linearGradient id="ca-vel-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map(tick => (
          <line
            key={`grid-${tick}`}
            x1={pad.left}
            x2={dims.w - pad.right}
            y1={toY(tick)}
            y2={toY(tick)}
            stroke="#f3f4f6"
            strokeWidth={1}
          />
        ))}

        {/* Y axis labels */}
        {yTicks.map(tick => (
          <text
            key={`ylabel-${tick}`}
            x={pad.left - 8}
            y={toY(tick) + 4}
            textAnchor="end"
            fontSize={11}
            fill="#9ca3af"
          >
            {tick}
          </text>
        ))}

        {/* X axis labels */}
        {data.map((d, i) => (
          <text
            key={`xlabel-${i}`}
            x={toX(i)}
            y={dims.h - 8}
            textAnchor="middle"
            fontSize={11}
            fill="#9ca3af"
          >
            {d.label}
          </text>
        ))}

        {/* Area fill */}
        <path d={fillPath} fill="url(#ca-vel-grad)" />

        {/* Published line */}
        <path d={publishedPath} fill="none" stroke="#7c3aed" strokeWidth={2.5} strokeLinejoin="round" />

        {/* Drafts line (dashed) */}
        <path d={draftsPath} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />

        {/* Published dots */}
        {data.map((d, i) => (
          <circle key={`pub-dot-${i}`} cx={toX(i)} cy={toY(d.published)} r={3} fill="#7c3aed" />
        ))}

        {/* Hover indicator */}
        {tooltip !== null && (
          <line
            x1={tooltip.x}
            x2={tooltip.x}
            y1={pad.top}
            y2={pad.top + chartH}
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {/* Tooltip */}
      {tooltip !== null && data[tooltip.idx] && (
        <div
          className="absolute pointer-events-none bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs z-10"
          style={{
            left: Math.min(tooltip.x + 12, dims.w - 120),
            top: Math.max(tooltip.y - 60, 4),
          }}
        >
          <div className="font-medium text-gray-700 mb-1">{data[tooltip.idx].label}</div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-600 inline-block" />
            <span className="text-gray-600">Published:</span>
            <span className="font-semibold text-gray-900">{data[tooltip.idx].published}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
            <span className="text-gray-600">Created:</span>
            <span className="font-semibold text-gray-900">{data[tooltip.idx].drafts}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Custom SVG Donut Chart (replaces recharts PieChart) ──────────────────

interface DonutChartProps {
  data: { id: string; name: string; value: number; color: string }[];
}

function DonutChart({ data }: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  const size = 170;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 75;
  const innerR = 48;
  const gap = 0.02; // radians gap between segments

  // Build arc segments
  let currentAngle = -Math.PI / 2; // Start from top
  const segments = data.map((d, i) => {
    const sweepAngle = (d.value / total) * (2 * Math.PI) - gap;
    const startAngle = currentAngle + gap / 2;
    const endAngle = startAngle + sweepAngle;
    currentAngle += (d.value / total) * (2 * Math.PI);

    const r = hovered === i ? outerR + 4 : outerR;

    const x1Outer = cx + r * Math.cos(startAngle);
    const y1Outer = cy + r * Math.sin(startAngle);
    const x2Outer = cx + r * Math.cos(endAngle);
    const y2Outer = cy + r * Math.sin(endAngle);
    const x1Inner = cx + innerR * Math.cos(endAngle);
    const y1Inner = cy + innerR * Math.sin(endAngle);
    const x2Inner = cx + innerR * Math.cos(startAngle);
    const y2Inner = cy + innerR * Math.sin(startAngle);

    const largeArc = sweepAngle > Math.PI ? 1 : 0;

    const pathD = [
      `M ${x1Outer.toFixed(2)} ${y1Outer.toFixed(2)}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2Outer.toFixed(2)} ${y2Outer.toFixed(2)}`,
      `L ${x1Inner.toFixed(2)} ${y1Inner.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2Inner.toFixed(2)} ${y2Inner.toFixed(2)}`,
      'Z',
    ].join(' ');

    return { pathD, color: d.color, key: d.id };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="select-none">
      {segments.map((seg, i) => (
        <path
          key={seg.key}
          d={seg.pathD}
          fill={seg.color}
          opacity={hovered !== null && hovered !== i ? 0.5 : 1}
          className="transition-opacity duration-150"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{ cursor: 'pointer' }}
        />
      ))}
      {/* Center text */}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={20} fontWeight={700} fill="#111827">
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={11} fill="#9ca3af">
        total
      </text>
    </svg>
  );
}