/**
 * Compliance Dashboard Panel (Phase 4)
 *
 * Displays an aggregated compliance readiness view:
 * - Overall readiness score (0–100)
 * - Per-category completion progress bars
 * - Check completion matrix
 * - Risk flags with severity indicators
 *
 * Data is fetched from GET /dashboard/:clientId which computes the
 * score from KV-stored check history.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import {
  Shield,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  Info,
  Clock,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { projectId } from '../../../../../../utils/supabase/info';
import { getAuthToken } from './compliance-auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryStatus {
  id: string;
  label: string;
  colour: string;
  completedCount: number;
  totalCount: number;
  percentage: number;
}

interface CheckStatus {
  checkType: string;
  label: string;
  category: string;
  completed: boolean;
  lastRun: string | null;
  runCount: number;
  lastMatterId: string | null;
}

interface RiskFlag {
  severity: 'high' | 'medium' | 'low' | 'info';
  source: string;
  message: string;
  checkType: string;
  detectedAt: string;
}

interface DashboardData {
  readinessScore: number;
  completedCheckTypes: number;
  totalCheckTypes: number;
  categories: CategoryStatus[];
  checks: CheckStatus[];
  riskFlags: RiskFlag[];
  lastCheckDate: string | null;
  totalCheckRuns: number;
}

interface ComplianceDashboardPanelProps {
  clientId: string;
  onNavigate?: (tab: string) => void;
}

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/honeycomb`;

// ─── Colour mappings ────────────────────────────────────────────────────────

const CATEGORY_COLOURS: Record<string, { bg: string; fill: string; text: string; icon: string }> = {
  blue:    { bg: 'bg-blue-100',    fill: 'bg-blue-600',    text: 'text-blue-700',    icon: 'text-blue-500' },
  green:   { bg: 'bg-green-100',   fill: 'bg-green-600',   text: 'text-green-700',   icon: 'text-green-500' },
  purple:  { bg: 'bg-purple-100',  fill: 'bg-purple-600',  text: 'text-purple-700',  icon: 'text-purple-500' },
  indigo:  { bg: 'bg-indigo-100',  fill: 'bg-indigo-600',  text: 'text-indigo-700',  icon: 'text-indigo-500' },
  emerald: { bg: 'bg-emerald-100', fill: 'bg-emerald-600', text: 'text-emerald-700', icon: 'text-emerald-500' },
  teal:    { bg: 'bg-teal-100',    fill: 'bg-teal-600',    text: 'text-teal-700',    icon: 'text-teal-500' },
  amber:   { bg: 'bg-amber-100',   fill: 'bg-amber-600',   text: 'text-amber-700',   icon: 'text-amber-500' },
};

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode; label: string }> = {
  high:   { bg: 'bg-red-50',    text: 'text-red-800',    border: 'border-red-200',    icon: <AlertOctagon className="h-4 w-4 text-red-600" />,    label: 'High' },
  medium: { bg: 'bg-amber-50',  text: 'text-amber-800',  border: 'border-amber-200',  icon: <AlertTriangle className="h-4 w-4 text-amber-600" />, label: 'Medium' },
  low:    { bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200',   icon: <Info className="h-4 w-4 text-blue-600" />,           label: 'Low' },
  info:   { bg: 'bg-gray-50',   text: 'text-gray-800',   border: 'border-gray-200',   icon: <Info className="h-4 w-4 text-gray-500" />,           label: 'Info' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getScoreColour(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Good';
  if (score >= 50) return 'Partial';
  if (score > 0)   return 'Low';
  return 'Not Started';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-600';
  if (score >= 50) return 'bg-amber-500';
  if (score > 0)   return 'bg-red-500';
  return 'bg-gray-300';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ComplianceDashboardPanel({ clientId, onNavigate }: ComplianceDashboardPanelProps) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCheckMatrix, setShowCheckMatrix] = useState(false);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/dashboard/${clientId}`, {
        headers: { Authorization: `Bearer ${await getAuthToken()}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Dashboard request failed (${res.status})`);
      }
      const data = await res.json();
      setDashboard(data.dashboard);
    } catch (err: unknown) {
      console.error('[ComplianceDashboard] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [clientId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <p className="text-sm text-red-700">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchDashboard}>
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!dashboard) return null;

  const {
    readinessScore,
    completedCheckTypes,
    totalCheckTypes,
    categories,
    checks,
    riskFlags,
    lastCheckDate,
    totalCheckRuns,
  } = dashboard;

  return (
    <div className="space-y-4">
      {/* ──── Score & Summary Row ──── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Readiness Score */}
        <Card className="md:col-span-1">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className={`text-4xl font-bold ${getScoreColour(readinessScore)}`}>
              {readinessScore}%
            </div>
            <Badge
              variant="outline"
              className={`mt-1 text-xs ${getScoreColour(readinessScore)}`}
            >
              {getScoreLabel(readinessScore)}
            </Badge>
            <span className="text-xs text-muted-foreground mt-1">Compliance Readiness</span>
          </CardContent>
        </Card>

        {/* Stat Cards */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-gray-50 p-2 rounded-lg">
              <BarChart3 className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <div className="text-xl font-bold">{completedCheckTypes}/{totalCheckTypes}</div>
              <div className="text-xs text-muted-foreground">Check Types Completed</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-gray-50 p-2 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <div className="text-xl font-bold">{totalCheckRuns}</div>
              <div className="text-xs text-muted-foreground">Total Check Runs</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-gray-50 p-2 rounded-lg">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <div className="text-sm font-bold">{lastCheckDate ? formatDate(lastCheckDate) : '—'}</div>
              <div className="text-xs text-muted-foreground">Last Check Run</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ──── Category Progress ──── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-medium flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            Category Completion
          </CardTitle>
          <CardDescription>
            Progress across the {totalCheckTypes} compliance check types, weighted by category importance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Overall bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-700">Overall Readiness</span>
              <span className={`font-bold ${getScoreColour(readinessScore)}`}>{readinessScore}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`${getScoreBg(readinessScore)} h-2.5 rounded-full transition-all duration-500`}
                style={{ width: `${readinessScore}%` }}
              />
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            {categories.map((cat) => {
              const colours = CATEGORY_COLOURS[cat.colour] || CATEGORY_COLOURS.blue;
              return (
                <div key={cat.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-medium ${colours.text}`}>{cat.label}</span>
                    <span className="text-gray-500">
                      {cat.completedCount}/{cat.totalCount} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className={`w-full ${colours.bg} rounded-full h-2`}>
                    <div
                      className={`${colours.fill} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ──── Risk Flags ──── */}
      {riskFlags.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-md font-medium flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Risk Flags
              <Badge variant="destructive" className="text-xs">{riskFlags.length}</Badge>
            </CardTitle>
            <CardDescription>
              Issues detected from completed compliance checks that require attention.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {riskFlags.map((flag, idx) => {
              const cfg = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.info;
              return (
                <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                  <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${cfg.text}`}>{flag.source}</span>
                      <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
                    </div>
                    <p className={`text-xs mt-0.5 ${cfg.text}`}>{flag.message}</p>
                    <span className="text-xs text-gray-400">{formatDate(flag.detectedAt)}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {riskFlags.length === 0 && totalCheckRuns > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-700">
            No risk flags detected from completed checks. All results within acceptable parameters.
          </p>
        </div>
      )}

      {/* ──── Check Matrix (expandable) ──── */}
      <Card>
        <CardHeader className="pb-0">
          <button
            onClick={() => setShowCheckMatrix(!showCheckMatrix)}
            className="flex items-center justify-between w-full"
          >
            <CardTitle className="text-md font-medium flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />
              Check Completion Matrix
              <Badge variant="secondary" className="text-xs">
                {completedCheckTypes}/{totalCheckTypes}
              </Badge>
            </CardTitle>
            {showCheckMatrix ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
        </CardHeader>
        {showCheckMatrix && (
          <CardContent className="pt-3">
            <div className="space-y-4">
              {categories.map((cat) => {
                const catChecks = checks.filter((c) => c.category === cat.id);
                const colours = CATEGORY_COLOURS[cat.colour] || CATEGORY_COLOURS.blue;
                return (
                  <div key={cat.id}>
                    <h4 className={`text-xs font-semibold mb-2 ${colours.text}`}>{cat.label}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {catChecks.map((check) => (
                        <div
                          key={check.checkType}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                            check.completed
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-gray-50 border border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {check.completed ? (
                              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300" />
                            )}
                            <span className={check.completed ? 'text-green-800' : 'text-gray-600'}>
                              {check.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {check.runCount > 0 && (
                              <Badge variant="outline" className="text-xs font-mono">
                                {check.runCount}x
                              </Badge>
                            )}
                            {check.lastRun && (
                              <span className="text-gray-400 text-xs hidden sm:inline">
                                {new Date(check.lastRun).toLocaleDateString('en-ZA', {
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={isLoading}>
          <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Dashboard
        </Button>
      </div>
    </div>
  );
}