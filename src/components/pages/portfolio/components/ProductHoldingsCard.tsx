/**
 * Portfolio Summary — Product Holdings Card
 * Displays per-product policy details in a table grouped by category.
 * Guidelines §7 (presentation only), §8.3 (consistent patterns, data tables).
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table';
import {
  Briefcase,
  Shield,
  Target,
  TrendingUp,
  Heart,
  FileText,
} from 'lucide-react';
import type { ProductHolding } from '../api';
import { formatCurrency } from '../utils';

// ── Category display config (Guidelines §5.3) ──

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; iconClass: string }> = {
  life: { label: 'Life Insurance', icon: Shield, iconClass: 'text-red-600' },
  employeeBenefits: { label: 'Employee Benefits', icon: Briefcase, iconClass: 'text-indigo-600' },
  retirement: { label: 'Retirement Savings', icon: Target, iconClass: 'text-blue-600' },
  investment: { label: 'Investments', icon: TrendingUp, iconClass: 'text-green-600' },
  medicalAid: { label: 'Medical Aid', icon: Heart, iconClass: 'text-pink-600' },
  shortTerm: { label: 'Short-Term Insurance', icon: FileText, iconClass: 'text-amber-600' },
  estate: { label: 'Estate Planning', icon: FileText, iconClass: 'text-purple-600' },
  tax: { label: 'Tax Planning', icon: FileText, iconClass: 'text-orange-600' },
  other: { label: 'Other Products', icon: FileText, iconClass: 'text-gray-600' },
};

// ── Status badge colour (Guidelines §8.3 colour vocabulary) ──

function holdingStatusClass(status: string): string {
  const lower = status.toLowerCase();
  if (lower === 'active') return 'bg-green-100 text-green-800 border-green-200';
  if (lower === 'lapsed' || lower === 'cancelled') return 'bg-red-100 text-red-800 border-red-200';
  if (lower === 'archived') return 'bg-gray-100 text-gray-700 border-gray-200';
  if (lower.includes('review')) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

// ── Grouping utility ──

function groupByCategory(holdings: ProductHolding[]): Record<string, ProductHolding[]> {
  const groups: Record<string, ProductHolding[]> = {};
  for (const h of holdings) {
    const cat = h.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(h);
  }
  return groups;
}

// ── Component ──

interface ProductHoldingsCardProps {
  holdings: ProductHolding[];
}

export function ProductHoldingsCard({ holdings }: ProductHoldingsCardProps) {
  if (holdings.length === 0) return null;

  const grouped = groupByCategory(holdings);

  // Compute totals
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const totalPremium = holdings.reduce((sum, h) => sum + h.premium, 0);

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Briefcase className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-black">Product Holdings</CardTitle>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-500">Total Value: </span>
              <span className="font-semibold text-black">{formatCurrency(totalValue)}</span>
            </div>
            <div>
              <span className="text-gray-500">Monthly Premiums: </span>
              <span className="font-semibold text-black">{formatCurrency(totalPremium)}</span>
            </div>
          </div>
        </div>
        <CardDescription>
          Your active policies and product details across all categories
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => {
            const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
            const CatIcon = config.icon;
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <CatIcon className={`h-4 w-4 ${config.iconClass}`} />
                  <h4 className="text-sm font-semibold text-black">{config.label}</h4>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {items.length} {items.length === 1 ? 'policy' : 'policies'}
                  </Badge>
                </div>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs font-medium text-gray-600">Provider</TableHead>
                        <TableHead className="text-xs font-medium text-gray-600">Product</TableHead>
                        <TableHead className="text-xs font-medium text-gray-600">Policy No.</TableHead>
                        <TableHead className="text-xs font-medium text-gray-600 text-right">Value</TableHead>
                        <TableHead className="text-xs font-medium text-gray-600 text-right">Premium</TableHead>
                        <TableHead className="text-xs font-medium text-gray-600 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="text-sm text-black">{h.provider}</TableCell>
                          <TableCell className="text-sm text-black">{h.product}</TableCell>
                          <TableCell className="text-sm text-gray-500 font-mono text-xs">{h.policyNumber}</TableCell>
                          <TableCell className="text-sm text-black text-right">{formatCurrency(h.value)}</TableCell>
                          <TableCell className="text-sm text-black text-right">{formatCurrency(h.premium)}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={`text-xs ${holdingStatusClass(h.status)}`}>
                              {h.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
