/**
 * EXTRACTION QUALITY DASHBOARD
 *
 * Displays aggregated extraction quality metrics across all policies.
 * Shows per-provider confidence, success rates, low-confidence field
 * frequency, and extraction timeline data.
 *
 * Designed to be embedded within the DocumentMappingTab.
 *
 * @module ExtractionQualityDashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Lock,
  Loader2,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SVGBarChart } from '../../../../ui/svg-charts';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { createClient } from '../../../../../utils/supabase/client';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;

interface OverviewStats {
  totalPolicies: number;
  totalWithDocuments: number;
  totalExtractions: number;
  completedExtractions: number;
  failedExtractions: number;
  avgConfidence: number;
  successRate: number;
  totalLockedFields: number;
}

interface ProviderStat {
  providerId: string;
  providerName: string;
  totalPolicies: number;
  withDocuments: number;
  withExtractions: number;
  completedExtractions: number;
  failedExtractions: number;
  avgConfidence: number;
  successRate: number;
  totalFieldsMapped: number;
  totalWarnings: number;
  lockedFieldCount: number;
}

interface LowConfidenceField {
  fieldId: string;
  fieldName: string;
  avgConfidence: number;
  occurrences: number;
  lowConfidenceCount: number;
  lowConfidenceRate: number;
}

interface QualityData {
  overview: OverviewStats;
  providerStats: ProviderStat[];
  lowConfidenceFields: LowConfidenceField[];
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconBgClass,
  iconColorClass,
  subtext,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBgClass: string;
  iconColorClass: string;
  subtext?: string;
}) {
  return (
    <Card className="bg-white border border-gray-200 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg ${iconBgClass} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`h-5 w-5 ${iconColorClass}`} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            {subtext && <p className="text-[10px] text-gray-400">{subtext}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExtractionQualityDashboard() {
  const [data, setData] = useState<QualityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLowConfidence, setShowLowConfidence] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || publicAnonKey;

      const res = await fetch(`${API_BASE}/policy-extraction/quality-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to load quality stats');
      }

      const result = await res.json();
      setData({
        overview: result.overview,
        providerStats: result.providerStats,
        lowConfidenceFields: result.lowConfidenceFields,
      });
    } catch (err) {
      console.error('Error loading extraction quality stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        Unable to load extraction quality data.
        <Button variant="ghost" size="sm" onClick={fetchStats} className="ml-2">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  const { overview, providerStats, lowConfidenceFields } = data;

  // Prepare chart data
  const providerChartData = providerStats
    .filter(p => p.completedExtractions > 0)
    .map(p => ({
      name: p.providerName.length > 12 ? p.providerName.slice(0, 12) + '...' : p.providerName,
      fullName: p.providerName,
      confidence: Math.round(p.avgConfidence * 100),
      extractions: p.completedExtractions,
      successRate: p.successRate,
    }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-purple-600" />
          <h3 className="text-sm font-semibold text-gray-800">Extraction Quality</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchStats} className="text-xs h-7">
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Extractions"
          value={overview.completedExtractions}
          icon={Sparkles}
          iconBgClass="bg-purple-50"
          iconColorClass="text-purple-600"
          subtext={`${overview.failedExtractions} failed`}
        />
        <StatCard
          label="Avg Confidence"
          value={`${Math.round(overview.avgConfidence * 100)}%`}
          icon={TrendingUp}
          iconBgClass={overview.avgConfidence >= 0.75 ? 'bg-green-50' : 'bg-amber-50'}
          iconColorClass={overview.avgConfidence >= 0.75 ? 'text-green-600' : 'text-amber-600'}
        />
        <StatCard
          label="Success Rate"
          value={`${overview.successRate}%`}
          icon={CheckCircle2}
          iconBgClass="bg-green-50"
          iconColorClass="text-green-600"
          subtext={`${overview.totalWithDocuments} documents`}
        />
        <StatCard
          label="Locked Fields"
          value={overview.totalLockedFields}
          icon={Lock}
          iconBgClass="bg-amber-50"
          iconColorClass="text-amber-600"
          subtext="Protected from overwrite"
        />
      </div>

      {/* Provider Confidence Chart */}
      {providerChartData.length > 0 && (
        <Card className="bg-white border border-gray-200 shadow-none">
          <CardContent className="p-4">
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3">
              Average Confidence by Provider
            </h4>
            <div className="h-48">
              <SVGBarChart
                data={providerChartData}
                categoryKey="name"
                series={[{ key: 'confidence', label: 'Confidence', color: '#6366f1' }]}
                height={192}
                showLegend={false}
                yAxisFormatter={(v) => `${v}%`}
                tooltipFormatter={(v) => `${v}%`}
                barColorFn={(entry) => {
                  const conf = Number(entry.confidence) || 0;
                  return conf >= 85 ? '#22c55e' : conf >= 60 ? '#f59e0b' : '#ef4444';
                }}
                margin={{ top: 5, right: 10, bottom: 5, left: 40 }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provider Detail Table */}
      {providerStats.length > 0 && (
        <Card className="bg-white border border-gray-200 shadow-none overflow-hidden">
          <CardContent className="p-0">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <h4 className="text-xs font-semibold text-gray-600 uppercase">Provider Breakdown</h4>
            </div>
            <div className="divide-y divide-gray-100">
              {providerStats.map(ps => (
                <div key={ps.providerId} className="px-4 py-2.5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{ps.providerName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{ps.withDocuments} docs</span>
                    <span className="text-gray-300">|</span>
                    <span>{ps.completedExtractions} extracted</span>
                    {ps.failedExtractions > 0 && (
                      <span className="text-red-500">{ps.failedExtractions} failed</span>
                    )}
                    <span className="text-gray-300">|</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${
                      ps.avgConfidence >= 0.85
                        ? 'bg-green-100 text-green-700 hover:bg-green-100'
                        : ps.avgConfidence >= 0.5
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                        : 'bg-red-100 text-red-700 hover:bg-red-100'
                    }`}>
                      {Math.round(ps.avgConfidence * 100)}% avg
                    </Badge>
                    {ps.totalWarnings > 0 && (
                      <Badge className="bg-amber-50 text-amber-600 hover:bg-amber-50 text-[10px] px-1.5 py-0">
                        {ps.totalWarnings} warnings
                      </Badge>
                    )}
                    {ps.lockedFieldCount > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-600">
                        <Lock className="h-3 w-3" />{ps.lockedFieldCount}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low Confidence Fields */}
      {lowConfidenceFields.length > 0 && (
        <Card className="bg-white border border-gray-200 shadow-none overflow-hidden">
          <CardContent className="p-0">
            <button
              onClick={() => setShowLowConfidence(!showLowConfidence)}
              className="w-full px-4 py-2.5 flex items-center justify-between bg-amber-50/50 hover:bg-amber-50 transition-colors border-b border-gray-200"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <h4 className="text-xs font-semibold text-amber-800">
                  Low Confidence Fields ({lowConfidenceFields.length})
                </h4>
              </div>
              {showLowConfidence ? (
                <ChevronUp className="h-3.5 w-3.5 text-amber-600" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-amber-600" />
              )}
            </button>
            {showLowConfidence && (
              <div className="divide-y divide-gray-100">
                {lowConfidenceFields.map(f => (
                  <div key={f.fieldId} className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-gray-700">{f.fieldName}</span>
                      <span className="text-[10px] text-gray-400">({f.occurrences} occurrences)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        f.avgConfidence >= 0.5
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                          : 'bg-red-100 text-red-700 hover:bg-red-100'
                      }`}>
                        {Math.round(f.avgConfidence * 100)}% avg
                      </Badge>
                      <span className="text-[10px] text-red-500 font-medium">
                        {f.lowConfidenceRate}% low
                      </span>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2 bg-gray-50 text-[10px] text-gray-500">
                  Fields with confidence &lt; 50% may need prompt template refinement for the relevant providers.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {overview.totalExtractions === 0 && (
        <div className="text-center py-8">
          <FileText className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No extractions yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload policy documents and run extractions to see quality metrics here.
          </p>
        </div>
      )}
    </div>
  );
}