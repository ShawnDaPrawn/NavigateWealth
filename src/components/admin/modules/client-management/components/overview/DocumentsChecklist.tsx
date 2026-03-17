/**
 * Documents Checklist — Phase 3
 *
 * Displays a categorised checklist of required/recommended documents
 * for the client's financial planning file. Status is derived from
 * profile data and policy presence — no new API calls required.
 *
 * Categories:
 *   1. FICA / KYC — ID copy, proof of address, bank statement
 *   2. Income Verification — payslip, IRP5, tax return
 *   3. Policy Schedules — per-category policy documents
 *   4. FNA Records — Financial Needs Analysis per published FNA
 *
 * Guidelines §7.1 — display only; status derivation is pure.
 * Guidelines §8.3 — status colour vocabulary (green/amber/gray).
 * Guidelines §8.4 — Design System components for card containers.
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import {
  FileCheck,
  FileX,
  FolderOpen,
  CheckCircle2,
  Circle,
  AlertCircle,
} from 'lucide-react';
import type { DashboardMode } from '../ClientOverviewTab';

// ── Types ───────────────────────────────────────────────────────────────

export type DocumentStatus = 'available' | 'missing' | 'not-applicable';

export interface DocumentItem {
  id: string;
  label: string;
  category: DocumentCategory;
  status: DocumentStatus;
  detail?: string;
}

export type DocumentCategory = 'fica' | 'income' | 'policies' | 'fna';

interface DocumentCategoryConfig {
  label: string;
  adviserLabel: string;
  clientLabel: string;
}

const CATEGORY_CONFIG: Record<DocumentCategory, DocumentCategoryConfig> = {
  fica: {
    label: 'FICA / KYC',
    adviserLabel: 'FICA / KYC Documents',
    clientLabel: 'Identity & Address Documents',
  },
  income: {
    label: 'Income',
    adviserLabel: 'Income Verification',
    clientLabel: 'Income Documents',
  },
  policies: {
    label: 'Policies',
    adviserLabel: 'Policy Schedules',
    clientLabel: 'Policy Documents',
  },
  fna: {
    label: 'FNA',
    adviserLabel: 'Financial Needs Analyses',
    clientLabel: 'Financial Analysis Records',
  },
};

const STATUS_CONFIG: Record<DocumentStatus, {
  icon: React.ElementType;
  iconClass: string;
  label: string;
}> = {
  available: { icon: CheckCircle2, iconClass: 'text-green-500', label: 'Available' },
  missing: { icon: Circle, iconClass: 'text-gray-300', label: 'Missing' },
  'not-applicable': { icon: Circle, iconClass: 'text-gray-200', label: 'N/A' },
};

// ── Props ───────────────────────────────────────────────────────────────

export interface DocumentsChecklistProps {
  documents: DocumentItem[];
  mode?: DashboardMode;
}

// ── Component ───────────────────────────────────────────────────────────

export function DocumentsChecklist({
  documents,
  mode = 'adviser',
}: DocumentsChecklistProps) {
  const isClient = mode === 'client';

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<DocumentCategory, DocumentItem[]> = {
      fica: [],
      income: [],
      policies: [],
      fna: [],
    };
    documents.forEach((doc) => {
      if (groups[doc.category]) {
        groups[doc.category].push(doc);
      }
    });
    return groups;
  }, [documents]);

  // Summary stats
  const totalDocs = documents.filter(d => d.status !== 'not-applicable').length;
  const availableDocs = documents.filter(d => d.status === 'available').length;
  const missingDocs = documents.filter(d => d.status === 'missing').length;
  const completionPct = totalDocs > 0 ? Math.round((availableDocs / totalDocs) * 100) : 0;

  if (documents.length === 0) {
    return null;
  }

  return (
    <Card className="border border-gray-200 rounded-lg bg-white shadow-sm">
      <CardHeader className="px-5 py-3.5 bg-gray-50/40 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-md bg-[#6d28d9]/10 flex-shrink-0">
            <FolderOpen className="h-3.5 w-3.5 text-[#6d28d9]" />
          </div>
          <CardTitle className="text-sm font-semibold text-gray-800 !leading-none">
            {isClient ? 'My Documents' : 'Documents Checklist'}
          </CardTitle>
          <div className="flex items-center gap-2 ml-auto">
            {missingDocs > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-200 text-amber-600">
                {missingDocs} missing
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 ${
                completionPct === 100
                  ? 'border-green-200 text-green-700'
                  : 'border-gray-200 text-gray-500'
              }`}
            >
              {completionPct}% complete
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-3 px-5">
        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-gray-100 mb-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              completionPct === 100 ? 'bg-green-500' : completionPct >= 50 ? 'bg-amber-400' : 'bg-gray-300'
            }`}
            style={{ width: `${completionPct}%` }}
          />
        </div>

        {/* Grouped checklists */}
        <div className="space-y-4">
          {(Object.keys(CATEGORY_CONFIG) as DocumentCategory[]).map((cat) => {
            const items = grouped[cat];
            if (items.length === 0) return null;
            const config = CATEGORY_CONFIG[cat];
            const catAvailable = items.filter(d => d.status === 'available').length;
            const catTotal = items.filter(d => d.status !== 'not-applicable').length;

            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                    {isClient ? config.clientLabel : config.adviserLabel}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {catAvailable}/{catTotal}
                  </span>
                </div>
                <div className="space-y-1">
                  {items.map((doc) => {
                    const statusCfg = STATUS_CONFIG[doc.status];
                    const StatusIcon = statusCfg.icon;
                    return (
                      <div
                        key={doc.id}
                        className={`flex items-center gap-2.5 py-1.5 px-3 rounded-md ${
                          doc.status === 'available'
                            ? 'bg-green-50/50'
                            : doc.status === 'missing'
                              ? 'bg-gray-50'
                              : 'bg-gray-50/30'
                        }`}
                      >
                        <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${statusCfg.iconClass}`} />
                        <span className={`text-xs ${
                          doc.status === 'available' ? 'text-gray-700' : 'text-gray-500'
                        }`}>
                          {doc.label}
                        </span>
                        {doc.detail && (
                          <span className="text-[10px] text-gray-400 ml-auto truncate max-w-[200px]">
                            {doc.detail}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Data derivation utility ─────────────────────────────────────────────

/**
 * Derives document checklist items from profile data and policy/FNA state.
 * Pure function — no side effects.
 *
 * Guidelines §7.1 — pure utility for derived display state.
 */
export function deriveDocumentChecklist({
  hasIdNumber,
  hasAddress,
  hasBankDetails,
  hasPayslip,
  hasTaxNumber,
  hasIncome,
  policyCategoriesWithDocs,
  publishedFnaModules,
}: {
  hasIdNumber: boolean;
  hasAddress: boolean;
  hasBankDetails: boolean;
  hasPayslip: boolean;
  hasTaxNumber: boolean;
  hasIncome: boolean;
  /** Category IDs that have at least one policy on record */
  policyCategoriesWithDocs: string[];
  /** FNA module keys that have been published */
  publishedFnaModules: string[];
}): DocumentItem[] {
  const docs: DocumentItem[] = [];

  // ── FICA / KYC ──
  docs.push({
    id: 'fica-id',
    label: 'ID Document / Passport',
    category: 'fica',
    status: hasIdNumber ? 'available' : 'missing',
    detail: hasIdNumber ? 'ID number on file' : undefined,
  });
  docs.push({
    id: 'fica-address',
    label: 'Proof of Address',
    category: 'fica',
    status: hasAddress ? 'available' : 'missing',
    detail: hasAddress ? 'Residential address captured' : undefined,
  });
  docs.push({
    id: 'fica-bank',
    label: 'Bank Confirmation / Statement',
    category: 'fica',
    status: hasBankDetails ? 'available' : 'missing',
    detail: hasBankDetails ? 'Banking details on file' : undefined,
  });

  // ── Income Verification ──
  docs.push({
    id: 'income-payslip',
    label: 'Recent Payslip',
    category: 'income',
    status: hasPayslip || hasIncome ? 'available' : 'missing',
    detail: hasIncome ? 'Income recorded' : undefined,
  });
  docs.push({
    id: 'income-tax',
    label: 'Tax Reference (IRP5 / IT12)',
    category: 'income',
    status: hasTaxNumber ? 'available' : 'missing',
    detail: hasTaxNumber ? 'Tax number on file' : undefined,
  });

  // ── Policy Schedules ──
  const policyCategories = [
    { id: 'risk_planning', label: 'Risk Planning Policy Schedule' },
    { id: 'medical_aid', label: 'Medical Aid Membership Certificate' },
    { id: 'retirement_planning', label: 'Retirement Fund Statement' },
    { id: 'investments', label: 'Investment Portfolio Statement' },
    { id: 'employee_benefits', label: 'Employee Benefits Schedule' },
    { id: 'estate_planning', label: 'Estate Plan / Will' },
  ];

  policyCategories.forEach((pc) => {
    const hasDoc = policyCategoriesWithDocs.includes(pc.id);
    docs.push({
      id: `policy-${pc.id}`,
      label: pc.label,
      category: 'policies',
      status: hasDoc ? 'available' : 'missing',
      detail: hasDoc ? 'On record' : undefined,
    });
  });

  // ── FNA Records ──
  const fnaModules = [
    { key: 'risk', label: 'Risk Planning FNA' },
    { key: 'medical', label: 'Medical Aid FNA' },
    { key: 'retirement', label: 'Retirement Planning FNA' },
    { key: 'investment', label: 'Investment Planning FNA' },
    { key: 'estate', label: 'Estate Planning FNA' },
  ];

  fnaModules.forEach((fm) => {
    const isPublished = publishedFnaModules.includes(fm.key);
    docs.push({
      id: `fna-roa-${fm.key}`,
      label: fm.label,
      category: 'fna',
      status: isPublished ? 'available' : 'missing',
      detail: isPublished ? 'Published' : undefined,
    });
  });

  return docs;
}