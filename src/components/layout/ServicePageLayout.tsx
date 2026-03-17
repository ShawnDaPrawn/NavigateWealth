/**
 * ServicePageLayout
 * Full-width layout for client product/service pages.
 *
 * Redesigned: table extends full viewport width;
 * quick actions + insights sit in a compact header row above the table.
 *
 * Guidelines refs: §7 (presentation), §8.3 (UI standards), §8.4 (AI builder)
 */

import React from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  Lightbulb,
  ChevronRight,
  MoreHorizontal,
  AlertTriangle,
  Info,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { ACTIVE_THEME } from '../portal/portal-theme';

export interface ServicePageAction {
  label: string;
  description?: string;
  icon: React.ElementType;
  onClick: () => void;
  primary?: boolean;
}

export interface ServicePageInsight {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  onClick?: () => void;
}

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

/** A single table section (used for multi-table layouts like retirement pre/post) */
export interface TableSection<T> {
  id: string;
  title: string;
  subtitle?: string;
  data: T[];
  columns: Column<T>[];
  emptyMessage?: string;
}

interface ServicePageLayoutProps<T> {
  title: string;
  description: string;
  icon: React.ElementType;
  themeColor: 'purple' | 'blue' | 'green' | 'red' | 'orange' | 'indigo';
  backPath?: string;

  /** Single-table mode (backward-compatible) */
  data?: T[];
  columns?: Column<T>[];

  /** Multi-table mode: array of table sections with separate schemas */
  tableSections?: TableSection<T>[];

  onRowClick?: (item: T) => void;

  quickActions: ServicePageAction[];
  insights: ServicePageInsight[];
}

const SEVERITY_CONFIG = {
  high: {
    border: 'border-l-red-500',
    bg: 'bg-red-50/60',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
  },
  medium: {
    border: 'border-l-amber-400',
    bg: 'bg-amber-50/60',
    icon: Info,
    iconColor: 'text-amber-500',
  },
  low: {
    border: 'border-l-blue-400',
    bg: 'bg-blue-50/40',
    icon: TrendingUp,
    iconColor: 'text-blue-500',
  },
} as const;

const THEME_STYLES = {
  purple: {
    iconBg: 'bg-purple-50',
    iconText: 'text-purple-600',
    actionBorder: 'border-purple-100 hover:border-purple-300',
    actionIconBg: 'bg-purple-50 group-hover:bg-purple-100',
    actionIconText: 'text-purple-600',
    insightText: 'text-purple-600',
    accentBg: 'bg-purple-600',
  },
  blue: {
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-600',
    actionBorder: 'border-blue-100 hover:border-blue-300',
    actionIconBg: 'bg-blue-50 group-hover:bg-blue-100',
    actionIconText: 'text-blue-600',
    insightText: 'text-blue-600',
    accentBg: 'bg-blue-600',
  },
  green: {
    iconBg: 'bg-green-50',
    iconText: 'text-green-600',
    actionBorder: 'border-green-100 hover:border-green-300',
    actionIconBg: 'bg-green-50 group-hover:bg-green-100',
    actionIconText: 'text-green-600',
    insightText: 'text-green-600',
    accentBg: 'bg-green-600',
  },
  red: {
    iconBg: 'bg-rose-50',
    iconText: 'text-rose-600',
    actionBorder: 'border-rose-100 hover:border-rose-300',
    actionIconBg: 'bg-rose-50 group-hover:bg-rose-100',
    actionIconText: 'text-rose-600',
    insightText: 'text-rose-600',
    accentBg: 'bg-rose-600',
  },
  orange: {
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
    actionBorder: 'border-amber-100 hover:border-amber-300',
    actionIconBg: 'bg-amber-50 group-hover:bg-amber-100',
    actionIconText: 'text-amber-600',
    insightText: 'text-amber-600',
    accentBg: 'bg-amber-600',
  },
  indigo: {
    iconBg: 'bg-indigo-50',
    iconText: 'text-indigo-600',
    actionBorder: 'border-indigo-100 hover:border-indigo-300',
    actionIconBg: 'bg-indigo-50 group-hover:bg-indigo-100',
    actionIconText: 'text-indigo-600',
    insightText: 'text-indigo-600',
    accentBg: 'bg-indigo-600',
  },
} as const;

export function ServicePageLayout<T extends { id?: string | number; [key: string]: unknown }>({
  title,
  description,
  icon: Icon,
  themeColor = 'purple',
  backPath = '/products-services-dashboard',
  data,
  columns,
  tableSections,
  onRowClick,
  quickActions,
  insights,
}: ServicePageLayoutProps<T>) {
  const navigate = useNavigate();
  const theme = THEME_STYLES[themeColor] || THEME_STYLES.purple;

  // Build sections: if tableSections provided, use those; otherwise wrap single table
  const sections: TableSection<T>[] = tableSections ?? [
    {
      id: 'default',
      title: 'Your Policies',
      subtitle: 'View and manage your active portfolio',
      data: data ?? [],
      columns: columns ?? [],
    },
  ];

  return (
    <div className={`min-h-screen ${ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-gray-50/50'}`}>
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">

        {/* ── Header ── */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(backPath)}
            className="text-gray-500 hover:text-gray-900 mb-3 pl-0 -ml-2 h-8 text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back to Products & Services
          </Button>

          <div className="flex items-start gap-4">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${theme.iconBg} ${theme.iconText}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">{title}</h1>
              <p className="text-gray-500 mt-0.5 text-sm lg:text-base max-w-2xl">{description}</p>
            </div>
          </div>
        </div>

        {/* ── Quick Actions Row ── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {quickActions.map((action, idx) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={idx}
                onClick={action.onClick}
                className={`group flex items-center gap-2.5 px-4 py-2.5 rounded-lg border bg-white transition-all duration-150 hover:shadow-sm text-left ${
                  action.primary ? theme.actionBorder : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                  action.primary
                    ? `${theme.actionIconBg} ${theme.actionIconText}`
                    : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                }`}>
                  <ActionIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900 leading-tight">
                    {action.label}
                  </span>
                  {action.description && (
                    <span className="block text-[11px] text-gray-400 leading-tight">
                      {action.description}
                    </span>
                  )}
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 ml-1 flex-shrink-0" />
              </button>
            );
          })}
        </div>

        {/* ── Insights Banner ── */}
        {insights.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className={`h-4 w-4 ${theme.insightText}`} />
              <h3 className="text-sm font-semibold text-gray-700">Smart Insights</h3>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-gray-200 text-gray-500">
                {insights.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {insights.map((insight) => {
                const sev = SEVERITY_CONFIG[insight.severity];
                const SevIcon = sev.icon;
                return (
                  <div
                    key={insight.id}
                    onClick={insight.onClick}
                    className={`border-l-[3px] ${sev.border} ${sev.bg} rounded-r-lg px-4 py-3 ${
                      insight.onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <SevIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${sev.iconColor}`} />
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 leading-tight">
                          {insight.title}
                        </h4>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Table Section(s) ── */}
        <div className="space-y-6">
          {sections.map((section) => (
            <div
              key={section.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{section.title}</h2>
                  {section.subtitle && (
                    <p className="text-xs text-gray-500 mt-0.5">{section.subtitle}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-xs text-gray-500 border-gray-200">
                  {section.data.length} {section.data.length === 1 ? 'policy' : 'policies'}
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-gray-50/60">
                      {section.columns.map((col, idx) => (
                        <TableHead
                          key={idx}
                          className={`font-semibold text-gray-600 text-xs uppercase tracking-wider whitespace-nowrap first:pl-5 last:pr-5 ${col.className || ''}`}
                        >
                          {col.header}
                        </TableHead>
                      ))}
                      <TableHead className="w-[40px] pr-5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.data.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={section.columns.length + 1}
                          className="h-28 text-center text-sm text-gray-400"
                        >
                          {section.emptyMessage || 'No policies found.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      section.data.map((item, rowIndex) => (
                        <TableRow
                          key={item.id ?? rowIndex}
                          className={`group transition-colors ${
                            onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                          }`}
                          onClick={() => onRowClick?.(item)}
                        >
                          {section.columns.map((col, colIndex) => (
                            <TableCell
                              key={colIndex}
                              className={`py-3.5 text-sm ${colIndex === 0 ? 'pl-5' : ''} ${
                                colIndex === section.columns.length - 1 ? 'pr-5' : ''
                              }`}
                            >
                              {col.render
                                ? col.render(item)
                                : col.accessorKey
                                  ? (item[col.accessorKey] as React.ReactNode)
                                  : null}
                            </TableCell>
                          ))}
                          <TableCell className="pr-5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 h-7 w-7 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
