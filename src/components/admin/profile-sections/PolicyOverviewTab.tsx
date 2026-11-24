import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Badge } from '../../ui/badge';
import {
  Shield,
  Heart,
  PiggyBank,
  Briefcase,
  FileText,
  Landmark,
  TrendingUp,
  CheckCircle,
  Target,
  Info,
  Loader2,
  Building2,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { withNavigateWealthPrintTitle } from '../../../utils/pdfPrintTitle';
import { getFNAConfig, hasFNASupport } from './fna-config';
import { DEFAULT_SCHEMAS } from './default-schemas';
import { goalLinksByPolicyId, type InvestmentINASession } from '../modules/investment-ina';
import {
  clientPoliciesQueryOptions,
  filterPoliciesForCategory,
  policySchemasQueryOptions,
  type PolicySchemaFieldRow,
} from '../../../shared/api/clientPolicies';
import { fnaKeys } from '../../../utils/queryKeys';
import { PolicyComparisonPanel } from './PolicyComparisonPanel';
import { DsButton } from '../layout/page';

import type { PolicyRecord, SchemaField, LinkedGoalStatus } from './PolicyTable';

// Define the order as requested
const SECTIONS = [
  {
    id: 'risk-planning',
    categoryId: 'risk_planning',
    label: 'Risk Planning',
    icon: Shield,
    color: 'text-[#6d28d9]',
  },
  {
    id: 'medical-aid',
    categoryId: 'medical_aid',
    label: 'Medical Aid',
    icon: Heart,
    color: 'text-red-500',
  },
  {
    id: 'retirement',
    categoryId: 'retirement_planning',
    label: 'Retirement Planning',
    icon: PiggyBank,
    color: 'text-green-600',
  },
  {
    id: 'investments',
    categoryId: 'investments',
    label: 'Investment Planning',
    icon: TrendingUp,
    color: 'text-blue-600',
  },
  {
    id: 'tax-planning',
    categoryId: 'tax_planning',
    label: 'Tax Planning',
    icon: FileText,
    color: 'text-gray-600',
  },
  {
    id: 'estate-planning',
    categoryId: 'estate_planning',
    label: 'Estate Planning',
    icon: Landmark,
    color: 'text-gray-600',
  },
  {
    id: 'employee-benefits',
    categoryId: 'employee_benefits',
    label: 'Employee Benefits',
    icon: Briefcase,
    color: 'text-purple-600',
  },
];

interface PolicyOverviewTabProps {
  clientId: string;
  /** Used for Save-as-PDF default filename when printing the overview */
  clientDisplayName?: string;
  onRunFNA?: (categoryId: string) => void;
  onAddPolicy?: (categoryId: string) => void;
  onViewDetails?: (categoryId: string) => void;
  /** 'full' (default) renders standalone with header; 'embedded' omits header and tightens spacing for use inside another panel */
  variant?: 'full' | 'embedded';
  /** Show the cross-policy comparison under the header (off when it has its own view). */
  showComparison?: boolean;
}

export function PolicyOverviewTab({
  clientId,
  clientDisplayName,
  onRunFNA,
  onAddPolicy,
  variant = 'full',
  showComparison = true,
}: PolicyOverviewTabProps) {
  const isEmbedded = variant === 'embedded';

  const handlePrintOverview = () => {
    const name = clientDisplayName?.trim();
    const suffix = name ? `Financial Portfolio Overview - ${name}` : 'Financial Portfolio Overview';
    withNavigateWealthPrintTitle(suffix, () => window.print());
  };

  return (
    <div className={isEmbedded ? 'space-y-4' : 'space-y-4'}>
      {!isEmbedded && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-nw-ink">Financial portfolio overview</h2>
            <p className="ds-meta">Every policy on file, by category.</p>
          </div>
          <DsButton onClick={handlePrintOverview}>Download report</DsButton>
        </div>
      )}

      {/* Cross-Policy Comparison */}
      {!isEmbedded && showComparison && <PolicyComparisonPanel clientId={clientId} />}

      {SECTIONS.map((section) => (
        <OverviewSection
          key={section.id}
          section={section}
          clientId={clientId}
          onRunFNA={() => onRunFNA?.(section.id)}
          onAddPolicy={() => onAddPolicy?.(section.id)}
          variant={variant}
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// Sub-component for individual sections (fetches its own data)
// ----------------------------------------------------------------------

interface OverviewSectionProps {
  section: {
    id: string;
    categoryId: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  };
  clientId: string;
  onRunFNA: () => void;
  onAddPolicy: () => void;
  variant: 'full' | 'embedded';
}

const EMPTY_POLICIES: PolicyRecord[] = [];

/** Sections whose table splits into sub-categories, each with its own schema. */
const COMPOSITE_SUBCATEGORIES: Record<string, readonly string[]> = {
  retirement_planning: ['retirement_pre', 'retirement_post', 'retirement_post_fixed'],
  investments: ['investments_voluntary', 'investments_guaranteed'],
  employee_benefits: ['employee_benefits_risk', 'employee_benefits_retirement'],
};

/** A category's columns: the stored schema, else the built-in default. */
function schemaFieldsFor(
  schemas: Record<string, PolicySchemaFieldRow[]> | undefined,
  categoryId: string,
): SchemaField[] {
  return (schemas?.[categoryId] ??
    DEFAULT_SCHEMAS[categoryId]?.fields ??
    []) as unknown as SchemaField[];
}

/** The latest published FNA of a section, as its API returns it. */
async function fetchLatestPublishedFna(
  sectionId: string,
  clientId: string,
): Promise<Record<string, unknown> | null> {
  const fnaConfig = getFNAConfig(sectionId);
  if (!fnaConfig) return null;
  return fnaConfig.getLatestPublished(clientId);
}

/** A published FNA's results, unwrapped per FNA type. */
function unwrapFnaResults(
  sectionId: string,
  fnaData: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!fnaData) return null;
  let results: unknown;
  if (sectionId === 'medical-aid') {
    results = fnaData.results || fnaData; // Medical puts results at top or inside
  } else if (sectionId === 'investments') {
    results = fnaData.results || (fnaData as { session?: { results?: unknown } }).session?.results;
  } else {
    results = fnaData.results;
  }
  return (results as Record<string, unknown> | undefined) ?? null;
}

function OverviewSection({
  section,
  clientId,
  onRunFNA,
  onAddPolicy,
  variant,
}: OverviewSectionProps) {
  const Icon = section.icon;
  const isEmbedded = variant === 'embedded';

  // Three independent reads, in parallel. They used to run one after another —
  // schema, then sub-schemas, then policies, then goals, then the FNA — so each
  // section waited for up to five Edge Function round trips (~2 s each from
  // South Africa) before it could draw. Schemas and policies come from the
  // shared queries the Overview tab also uses (one request per client for all
  // seven sections); policies refetch on every open and on every write
  // (shared/api/clientPolicies.ts).
  const schemasQuery = useQuery(policySchemasQueryOptions());
  const policiesQuery = useQuery(clientPoliciesQueryOptions(clientId));
  // For Investments the published FNA is the goals analysis, which also says
  // which policies fund which goal.
  const fnaQuery = useQuery({
    queryKey: [...fnaKeys.latestPublished(clientId), section.id],
    queryFn: () => fetchLatestPublishedFna(section.id, clientId),
    enabled: hasFNASupport(section.id),
    staleTime: 0,
  });

  const tableStructure = useMemo(
    () => schemaFieldsFor(schemasQuery.data, section.categoryId),
    [schemasQuery.data, section.categoryId],
  );
  const subCategorySchemas = useMemo<Record<string, SchemaField[]>>(
    () =>
      Object.fromEntries(
        (COMPOSITE_SUBCATEGORIES[section.categoryId] ?? []).map((subCategoryId) => [
          subCategoryId,
          schemaFieldsFor(schemasQuery.data, subCategoryId),
        ]),
      ),
    [schemasQuery.data, section.categoryId],
  );
  const policies = useMemo(
    () =>
      filterPoliciesForCategory(
        (policiesQuery.data ?? EMPTY_POLICIES) as unknown as PolicyRecord[],
        section.categoryId,
      ),
    [policiesQuery.data, section.categoryId],
  );
  const publishedFna = fnaQuery.data ?? null;
  const fnaResults = useMemo(
    () => unwrapFnaResults(section.id, publishedFna),
    [section.id, publishedFna],
  );
  const loading = schemasQuery.isPending || policiesQuery.isPending;
  const hasError = policiesQuery.isError && !policiesQuery.data;

  // The goal each investment policy funds, from the published goals analysis.
  const linkedGoalsMap = useMemo<Record<string, LinkedGoalStatus>>(
    () =>
      section.categoryId === 'investments'
        ? goalLinksByPolicyId(publishedFna as unknown as InvestmentINASession | null)
        : {},
    [publishedFna, section.categoryId],
  );

  const formatFieldValue = (field: SchemaField, value: unknown): React.ReactNode => {
    if (!value && value !== 0) return '-';

    switch (field.type) {
      case 'currency':
        return `R${Number(value).toLocaleString()}`;
      case 'percentage':
        return `${value}%`;
      case 'date':
      case 'date_inception':
        return new Date(value as string).toLocaleDateString();
      case 'boolean':
        return value === true || value === 'true' ? 'Yes' : 'No';
      default:
        return value as React.ReactNode;
    }
  };

  // Calculate totals for currency columns
  const calculateTotal = (fieldId: string, currentPolicies: PolicyRecord[]) => {
    return currentPolicies.reduce((sum, policy) => {
      const val = policy.data?.[fieldId];
      return sum + (Number(val) || 0);
    }, 0);
  };

  // Helper to fuzzy match column name to FNA result keys
  const getFNAValueForColumn = (columnName: string) => {
    if (!fnaResults) return null;

    const normalizedCol = columnName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Flatten nested objects in FNA results to simplify searching
    // (A simple heuristic since we don't know exact structure)
    const flattenKeys = (obj: Record<string, unknown>, prefix = ''): Record<string, number> => {
      const acc: Record<string, number> = {};
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          Object.assign(acc, flattenKeys(obj[key] as Record<string, unknown>, prefix + key));
        } else if (typeof obj[key] === 'number') {
          acc[key.toLowerCase()] = obj[key] as number;
          if (prefix) acc[(prefix + key).toLowerCase()] = obj[key] as number;
        }
      }
      return acc;
    };

    const flatResults = flattenKeys(fnaResults);

    // Direct matches
    if (flatResults[normalizedCol] !== undefined) return flatResults[normalizedCol];

    // Heuristics mapping
    if (normalizedCol.includes('life') && flatResults['lifecover']) return flatResults['lifecover'];
    if (normalizedCol.includes('disability') && flatResults['disability'])
      return flatResults['disability'];
    if (normalizedCol.includes('illness') && flatResults['severeillness'])
      return flatResults['severeillness'];
    if (normalizedCol.includes('income') && flatResults['incomeprotection'])
      return flatResults['incomeprotection'];
    if (normalizedCol.includes('retirement') && flatResults['targetcapital'])
      return flatResults['targetcapital']; // Retirement Target
    if (normalizedCol.includes('projected') && flatResults['targetcapital'])
      return flatResults['targetcapital']; // Compare Projected vs Target

    // Specific mapping for Retirement Planning: "Estimated Maturity Value" -> "Required Capital" from FNA
    // Exclude "date" to prevent matching "Maturity Date"
    if (
      (normalizedCol.includes('maturity') || normalizedCol.includes('estimated')) &&
      !normalizedCol.includes('date') &&
      flatResults['requiredcapital']
    )
      return flatResults['requiredcapital'];

    return null;
  };

  const renderTable = (
    title: string,
    tablePolicies: PolicyRecord[],
    structure: SchemaField[],
    showFnaRow: boolean = false,
    linkedGoals?: Record<string, LinkedGoalStatus>,
  ) => {
    if (!tablePolicies || tablePolicies.length === 0) return null;

    const currencyColumns = structure.filter((f) => f.type === 'currency');

    return (
      <div className="space-y-2 mb-6 last:mb-0">
        {title && <h4 className="text-sm font-semibold text-gray-700 ml-1">{title}</h4>}
        <div className="border rounded-md overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="whitespace-nowrap px-6 py-3">Provider</TableHead>
                {structure.map((field) => (
                  <TableHead
                    key={field.id}
                    className={`${field.type === 'currency' ? 'text-right' : ''} whitespace-nowrap px-6 py-3`}
                  >
                    {field.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tablePolicies.map((policy) => {
                const linkedGoal = linkedGoals?.[policy.id];

                return (
                  <TableRow key={policy.id}>
                    <TableCell className="align-top py-4 px-6">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {String(policy.providerName ?? '')}
                          </span>
                        </div>

                        {/* Linked Goal Indicator */}
                        {linkedGoal && (
                          <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md border border-gray-100 w-fit">
                            <Target
                              className={`h-3.5 w-3.5 ${
                                linkedGoal.status === 'On Track'
                                  ? 'text-green-600'
                                  : linkedGoal.status === 'At Risk'
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                              }`}
                            />
                            <span className="text-xs text-gray-700 font-medium">
                              Linked: {linkedGoal.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {structure.map((field) => {
                      const cellValue = formatFieldValue(field, policy.data?.[field.id]);

                      // Check for Goal linkage enhancements
                      let goalContent = null;
                      if (linkedGoal) {
                        // Maturity Value (Target Amount)
                        if (
                          field.keyId === 'invest_maturity_value' ||
                          field.id === 'invest_maturity_value' ||
                          field.name === 'Estimated Maturity Value' ||
                          field.name === 'Est Maturity Value'
                        ) {
                          goalContent = (
                            <div className="text-xs mt-1 text-gray-500 flex flex-col items-end gap-0.5 bg-blue-50/50 px-2 py-1 rounded border border-blue-100/50">
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-400">
                                Target Goal
                              </span>
                              <span className="font-semibold text-blue-700">
                                R{Number(linkedGoal.targetAmount).toLocaleString()}
                              </span>
                            </div>
                          );
                        }
                        // Maturity Date (Goal Date)
                        else if (
                          (field.keyId === 'invest_maturity_date' ||
                            field.id === 'invest_maturity_date' ||
                            field.name === 'Maturity Date') &&
                          linkedGoal.targetDate
                        ) {
                          const targetDate = new Date(linkedGoal.targetDate);
                          goalContent = (
                            <div className="text-xs mt-1 text-gray-500 flex flex-col items-end gap-0.5 bg-blue-50/50 px-2 py-1 rounded border border-blue-100/50">
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-400">
                                Target Date
                              </span>
                              <span className="font-semibold text-blue-700">
                                {targetDate.toLocaleDateString()}
                              </span>
                            </div>
                          );
                        }
                        // Premium (Contributions)
                        else if (
                          field.keyId === 'invest_monthly_contribution' ||
                          field.id === 'invest_premium' ||
                          field.name === 'Premium'
                        ) {
                          const isShortfall = (linkedGoal.requiredMonthly ?? 0) > 0;
                          goalContent = isShortfall ? (
                            <div className="mt-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 text-right">
                              <div className="text-[10px] text-red-400 uppercase tracking-wider font-semibold">
                                Shortfall
                              </div>
                              +{Math.round(linkedGoal.requiredMonthly ?? 0).toLocaleString()} /pm
                            </div>
                          ) : (
                            <div className="mt-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded border border-green-100 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> On Track
                            </div>
                          );
                        }
                      }

                      return (
                        <TableCell
                          key={field.id}
                          className={`${field.type === 'currency' ? 'text-right' : ''} align-top py-4 px-6`}
                        >
                          <div
                            className={`flex flex-col gap-1.5 ${field.type === 'currency' ? 'items-end' : ''}`}
                          >
                            <span className="font-medium text-gray-900 text-sm">{cellValue}</span>
                            {goalContent}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}

              {/* Totals Row */}
              {currencyColumns.length > 0 && (
                <TableRow className="bg-gray-50 font-bold border-t-2 border-gray-200">
                  <TableCell className="px-6 py-4">TOTALS</TableCell>
                  {structure.map((field) => (
                    <TableCell
                      key={field.id}
                      className={`${field.type === 'currency' ? 'text-right' : ''} whitespace-nowrap px-6 py-4`}
                    >
                      {field.type === 'currency'
                        ? `R${calculateTotal(field.id, tablePolicies).toLocaleString()}`
                        : ''}
                    </TableCell>
                  ))}
                </TableRow>
              )}

              {/* Required (FNA) Row */}
              {showFnaRow && fnaResults && currencyColumns.length > 0 && (
                <TableRow className="bg-purple-50 font-bold border-t border-purple-100 text-purple-900">
                  <TableCell className="flex items-center gap-2 px-6 py-4">
                    {section.id === 'investments' ? 'REQUIRED (GOALS)' : 'REQUIRED (FNA)'}
                    <Info className="h-3 w-3 text-purple-400" />
                  </TableCell>
                  {structure.map((field) => {
                    const needed = getFNAValueForColumn(field.name ?? '');
                    const isCurrency = field.type === 'currency';

                    return (
                      <TableCell
                        key={field.id}
                        className={`${isCurrency ? 'text-right' : ''} whitespace-nowrap px-6 py-4`}
                      >
                        {isCurrency && needed !== null
                          ? `R${needed.toLocaleString()}`
                          : needed || ''}
                      </TableCell>
                    );
                  })}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (section.categoryId === 'retirement_planning') {
      const prePolicies = policies.filter(
        (p) => p.categoryId === 'retirement_pre' || p.categoryId === 'retirement_planning',
      );
      const postPolicies = policies.filter((p) => p.categoryId === 'retirement_post');
      const fixedPolicies = policies.filter((p) => p.categoryId === 'retirement_post_fixed');

      const preSchema = subCategorySchemas.retirement_pre || tableStructure;
      const postSchema = subCategorySchemas.retirement_post || [];
      const fixedSchema = subCategorySchemas.retirement_post_fixed || [];

      return (
        <div>
          {renderTable(
            prePolicies.length > 0 && postPolicies.length + fixedPolicies.length > 0
              ? 'Pre-Retirement'
              : '',
            prePolicies,
            preSchema,
            true,
          )}
          {renderTable('Post-Retirement (Living Annuity)', postPolicies, postSchema, false)}
          {renderTable('Post-Retirement (Fixed Annuity)', fixedPolicies, fixedSchema, false)}
        </div>
      );
    }

    if (section.categoryId === 'investments') {
      const volPolicies = policies.filter(
        (p) => p.categoryId === 'investments_voluntary' || p.categoryId === 'investments',
      );
      const guaPolicies = policies.filter((p) => p.categoryId === 'investments_guaranteed');

      const volSchema = subCategorySchemas.investments_voluntary || tableStructure;
      const guaSchema = subCategorySchemas.investments_guaranteed || [];

      return (
        <div className="space-y-6">
          {renderTable(
            volPolicies.length > 0 && guaPolicies.length > 0 ? 'Voluntary Investments' : '',
            volPolicies,
            volSchema,
            true,
            linkedGoalsMap,
          )}
          {renderTable('Guaranteed Investments', guaPolicies, guaSchema, false, linkedGoalsMap)}
        </div>
      );
    }

    if (section.categoryId === 'employee_benefits') {
      const riskPolicies = policies.filter(
        (p) => p.categoryId === 'employee_benefits_risk' || p.categoryId === 'employee_benefits',
      );
      const retPolicies = policies.filter((p) => p.categoryId === 'employee_benefits_retirement');

      const riskSchema = subCategorySchemas.employee_benefits_risk || tableStructure;
      const retSchema = subCategorySchemas.employee_benefits_retirement || [];

      return (
        <div>
          {renderTable(
            riskPolicies.length > 0 && retPolicies.length > 0 ? 'Risk Benefits' : '',
            riskPolicies,
            riskSchema,
            true,
          )}
          {renderTable('Retirement Funds', retPolicies, retSchema, false)}
        </div>
      );
    }

    return renderTable('', policies, tableStructure, true);
  };

  if (loading) {
    if (isEmbedded) {
      return (
        <div className="flex items-center gap-3 py-3 px-4 border border-gray-100 rounded-lg bg-gray-50/50">
          <div className="h-5 w-5 bg-gray-200 rounded animate-pulse flex-shrink-0" />
          <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
          <Loader2 className="h-4 w-4 animate-spin text-gray-300 ml-auto" />
        </div>
      );
    }
    return (
      <section className="ds-card overflow-hidden" aria-busy="true">
        <div className="ds-card-h">
          <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="ds-card-b flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-nw-text-3" aria-label="Loading" />
        </div>
      </section>
    );
  }

  // In embedded mode, skip sections with no policies (keeps the overview clean)
  if (isEmbedded && policies.length === 0) {
    return null;
  }

  if (isEmbedded) {
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        {/* Compact header */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-50/60 border-b border-gray-100">
          <div className="flex items-center justify-center h-6 w-6 rounded-md bg-white shadow-sm border border-gray-100 flex-shrink-0">
            <Icon className={`h-3.5 w-3.5 ${section.color}`} />
          </div>
          <span className="text-sm font-semibold text-gray-800">{section.label}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 ml-auto">
            {policies.length} {policies.length === 1 ? 'policy' : 'policies'}
          </Badge>
        </div>
        {/* Content */}
        <div className="px-0 py-0">
          {hasError ? (
            <div className="text-center py-4 text-sm text-red-500">Failed to load data.</div>
          ) : (
            renderContent()
          )}
        </div>
      </div>
    );
  }

  return (
    // CM-Policies: each category is a plain card — its name, then Add policy and
    // the FNA in the header.
    <section className="ds-card overflow-hidden" aria-label={section.label}>
      <div className="ds-card-h flex-wrap">
        <h3 className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${section.color}`} aria-hidden="true" />
          {section.label}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="ds-meta">
            {policies.length} {policies.length === 1 ? 'policy' : 'policies'}
          </span>
          {hasFNASupport(section.id) && (
            <DsButton size="sm" onClick={onRunFNA}>
              {section.id === 'investments' ? 'Open goals' : 'Open FNA'}
            </DsButton>
          )}
          <DsButton size="sm" variant="primary" onClick={onAddPolicy}>
            Add policy
          </DsButton>
        </div>
      </div>
      <div className="ds-card-b">
        {hasError ? (
          <span className="text-[13.5px] text-red-700">Failed to load data. Please try again.</span>
        ) : policies.length === 0 ? (
          <span className="ds-meta">
            No policies yet
            {tableStructure.length === 0 ? ' · product structure not configured' : ''}
          </span>
        ) : (
          renderContent()
        )}
      </div>
    </section>
  );
}
