/**
 * CROSS-POLICY COMPARISON PANEL
 *
 * Side-by-side comparison of all active policies for a client.
 * Shows key fields normalised across different policy categories,
 * highlights gaps, and provides a consolidated financial snapshot.
 *
 * @module PolicyComparisonPanel
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  ArrowLeftRight,
  Loader2,
  FileText,
  Lock,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { createClient } from '../../../utils/supabase/client';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;

interface KeyField {
  label: string;
  fieldId: string;
  fieldName: string;
  value: unknown;
}

interface ComparisonPolicy {
  id: string;
  providerId: string;
  providerName: string;
  categoryId: string;
  categoryLabel: string;
  createdAt: string;
  hasDocument: boolean;
  hasExtraction: boolean;
  extractionConfidence: number | null;
  lockedFieldCount: number;
  keyFields: KeyField[];
  totalFieldCount: number;
}

interface PolicyComparisonPanelProps {
  clientId: string;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    return `R${value.toLocaleString('en-ZA')}`;
  }
  return String(value);
}

function isMonetary(label: string): boolean {
  return /premium|cover|value|contribution|amount/i.test(label);
}

/** Category colour mapping for badges */
const CATEGORY_COLORS: Record<string, string> = {
  risk_planning: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
  medical_aid: 'bg-red-100 text-red-700 hover:bg-red-100',
  retirement_planning: 'bg-green-100 text-green-700 hover:bg-green-100',
  retirement_pre: 'bg-green-100 text-green-700 hover:bg-green-100',
  retirement_post: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  investments: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  investments_voluntary: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  investments_guaranteed: 'bg-sky-100 text-sky-700 hover:bg-sky-100',
  employee_benefits: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  employee_benefits_risk: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  employee_benefits_retirement: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  tax_planning: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  estate_planning: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
};

export function PolicyComparisonPanel({ clientId }: PolicyComparisonPanelProps) {
  const [policies, setPolicies] = useState<ComparisonPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(true);

  const fetchComparison = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || publicAnonKey;

      const res = await fetch(
        `${API_BASE}/policies/compare?clientId=${encodeURIComponent(clientId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to load comparison data');
      }

      const data = await res.json();
      setPolicies(data.policies || []);
    } catch (err) {
      console.error('Error loading policy comparison:', err);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (isOpen && policies.length === 0) {
      fetchComparison();
    }
  }, [isOpen, fetchComparison, policies.length]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  // Collect all unique key field labels across all policies
  const allLabels = new Set<string>();
  for (const p of policies) {
    for (const kf of p.keyFields) {
      allLabels.add(kf.label);
    }
  }
  const labelOrder = [
    'Policy Number', 'Plan Type', 'Premium', 'Cover Amount', 'Fund Value',
    'Monthly Contribution', 'Inception Date', 'Expiry Date', 'Status',
  ];
  const sortedLabels = labelOrder.filter(l => allLabels.has(l));
  // Add any labels not in our predefined order
  for (const l of allLabels) {
    if (!sortedLabels.includes(l)) sortedLabels.push(l);
  }

  // Group by category for display
  const categorised = new Map<string, ComparisonPolicy[]>();
  for (const p of policies) {
    const group = categorised.get(p.categoryId) || [];
    group.push(p);
    categorised.set(p.categoryId, group);
  }

  // Calculate totals for monetary fields
  const totals = new Map<string, number>();
  for (const p of policies) {
    for (const kf of p.keyFields) {
      if (isMonetary(kf.label) && typeof kf.value === 'number') {
        totals.set(kf.label, (totals.get(kf.label) || 0) + kf.value);
      }
    }
  }

  return (
    <div className="mt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="text-gray-500 hover:text-gray-700 text-xs h-7 px-2"
      >
        <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
        Compare All Policies
        {isOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
      </Button>

      {isOpen && (
        <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-semibold text-gray-700">Cross-Policy Comparison</span>
              {!isLoading && (
                <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px]">
                  {policies.length} policies
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGroupByCategory(!groupByCategory)}
                className="text-xs h-6"
              >
                {groupByCategory ? 'Flat View' : 'Group by Category'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchComparison}
                className="text-xs h-6"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            </div>
          ) : policies.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No active policies found</p>
              <p className="text-xs text-gray-400 mt-1">Add policies to see a comparison view.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {groupByCategory ? (
                /* Grouped view */
                <div className="divide-y divide-gray-200">
                  {Array.from(categorised.entries()).map(([catId, catPolicies]) => (
                    <div key={catId}>
                      <div className="px-4 py-2 bg-gray-50/50">
                        <Badge className={`text-[10px] ${CATEGORY_COLORS[catId] || 'bg-gray-100 text-gray-700 hover:bg-gray-100'}`}>
                          {catPolicies[0]?.categoryLabel || catId}
                        </Badge>
                        <span className="text-[10px] text-gray-400 ml-2">
                          {catPolicies.length} polic{catPolicies.length === 1 ? 'y' : 'ies'}
                        </span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] w-[140px]">Provider</TableHead>
                            {sortedLabels.map(label => (
                              <TableHead key={label} className="text-[10px]">{label}</TableHead>
                            ))}
                            <TableHead className="text-[10px] w-[80px] text-center">Doc / AI</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {catPolicies.map(p => (
                            <TableRow key={p.id} className="hover:bg-gray-50/50">
                              <TableCell className="text-xs font-medium text-gray-800 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                  {p.providerName}
                                </div>
                              </TableCell>
                              {sortedLabels.map(label => {
                                const kf = p.keyFields.find(f => f.label === label);
                                const value = kf?.value;
                                const isEmpty = value === undefined || value === null || value === '';
                                return (
                                  <TableCell
                                    key={label}
                                    className={`text-xs ${isEmpty ? 'text-gray-300' : 'text-gray-700'}`}
                                  >
                                    {isEmpty ? '—' : formatValue(value)}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {p.hasDocument && (
                                    <FileText className="h-3 w-3 text-green-500" title="Document attached" />
                                  )}
                                  {p.hasExtraction && (
                                    <Sparkles
                                      className="h-3 w-3 text-purple-500"
                                      title={`AI extracted (${Math.round((p.extractionConfidence || 0) * 100)}%)`}
                                    />
                                  )}
                                  {p.lockedFieldCount > 0 && (
                                    <Lock className="h-3 w-3 text-amber-500" title={`${p.lockedFieldCount} locked fields`} />
                                  )}
                                  {!p.hasDocument && !p.hasExtraction && p.lockedFieldCount === 0 && (
                                    <span className="text-[10px] text-gray-300">—</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}

                  {/* Totals row */}
                  {totals.size > 0 && (
                    <div className="px-4 py-2.5 bg-purple-50/50 border-t border-gray-200">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Portfolio Totals</p>
                      <div className="flex flex-wrap gap-4">
                        {Array.from(totals.entries()).map(([label, total]) => (
                          <div key={label} className="text-xs">
                            <span className="text-gray-500">{label}: </span>
                            <span className="font-semibold text-gray-800">
                              R{total.toLocaleString('en-ZA')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Flat view */
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] w-[140px]">Provider</TableHead>
                        <TableHead className="text-[10px] w-[100px]">Category</TableHead>
                        {sortedLabels.map(label => (
                          <TableHead key={label} className="text-[10px]">{label}</TableHead>
                        ))}
                        <TableHead className="text-[10px] w-[80px] text-center">Doc / AI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {policies.map(p => (
                        <TableRow key={p.id} className="hover:bg-gray-50/50">
                          <TableCell className="text-xs font-medium text-gray-800 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              {p.providerName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[9px] px-1.5 py-0 ${CATEGORY_COLORS[p.categoryId] || 'bg-gray-100 text-gray-700 hover:bg-gray-100'}`}>
                              {p.categoryLabel}
                            </Badge>
                          </TableCell>
                          {sortedLabels.map(label => {
                            const kf = p.keyFields.find(f => f.label === label);
                            const value = kf?.value;
                            const isEmpty = value === undefined || value === null || value === '';
                            return (
                              <TableCell
                                key={label}
                                className={`text-xs ${isEmpty ? 'text-gray-300' : 'text-gray-700'}`}
                              >
                                {isEmpty ? '—' : formatValue(value)}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {p.hasDocument && <FileText className="h-3 w-3 text-green-500" />}
                              {p.hasExtraction && <Sparkles className="h-3 w-3 text-purple-500" />}
                              {p.lockedFieldCount > 0 && <Lock className="h-3 w-3 text-amber-500" />}
                              {!p.hasDocument && !p.hasExtraction && p.lockedFieldCount === 0 && (
                                <span className="text-[10px] text-gray-300">—</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Totals */}
                  {totals.size > 0 && (
                    <div className="px-4 py-2.5 bg-purple-50/50 border-t border-gray-200">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Portfolio Totals</p>
                      <div className="flex flex-wrap gap-4">
                        {Array.from(totals.entries()).map(([label, total]) => (
                          <div key={label} className="text-xs">
                            <span className="text-gray-500">{label}: </span>
                            <span className="font-semibold text-gray-800">R{total.toLocaleString('en-ZA')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Gap Analysis */}
              {policies.length > 0 && (() => {
                const coveredCategories = new Set(policies.map(p => p.categoryId));
                const allCategories = [
                  { id: 'risk_planning', label: 'Risk Planning' },
                  { id: 'medical_aid', label: 'Medical Aid' },
                  { id: 'retirement_pre', label: 'Pre-Retirement' },
                  { id: 'investments_voluntary', label: 'Voluntary Investments' },
                ];
                // Also match parent categories
                const matchesCategory = (id: string) => {
                  if (coveredCategories.has(id)) return true;
                  // retirement_planning covers retirement_pre
                  if (id === 'retirement_pre' && coveredCategories.has('retirement_planning')) return true;
                  if (id === 'investments_voluntary' && coveredCategories.has('investments')) return true;
                  return false;
                };
                const gaps = allCategories.filter(c => !matchesCategory(c.id));

                if (gaps.length === 0) return null;

                return (
                  <div className="px-4 py-2.5 bg-amber-50/50 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      <p className="text-[10px] font-semibold text-amber-800 uppercase">Coverage Gaps</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {gaps.map(g => (
                        <Badge
                          key={g.id}
                          className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]"
                        >
                          {g.label}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-[10px] text-amber-600 mt-1">
                      Client has no active policies in these categories.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
