import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  Shield,
  Heart,
  PiggyBank,
  Briefcase,
  FileText,
  Landmark,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Target,
  Plus,
  Zap,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  Building2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '../../ui/table';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { withNavigateWealthPrintTitle } from '../../../utils/pdfPrintTitle';
import { toast } from 'sonner@2.0.3';
import { getFNAConfig, hasFNASupport } from './fna-config';
import { DEFAULT_SCHEMAS } from './default-schemas';
import { Goal } from '../modules/client-management/components/goals/types';
import { calculateGoalStatus } from '../modules/client-management/components/goals/utils';
import { PolicyComparisonPanel } from './PolicyComparisonPanel';

import type { PolicyRecord, SchemaField, LinkedGoalStatus } from './PolicyTable';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;

// Define the order as requested
const SECTIONS = [
  { id: 'risk-planning', categoryId: 'risk_planning', label: 'Risk Planning', icon: Shield, color: 'text-[#6d28d9]' },
  { id: 'medical-aid', categoryId: 'medical_aid', label: 'Medical Aid', icon: Heart, color: 'text-red-500' },
  { id: 'retirement', categoryId: 'retirement_planning', label: 'Retirement Planning', icon: PiggyBank, color: 'text-green-600' },
  { id: 'investments', categoryId: 'investments', label: 'Investment Planning', icon: TrendingUp, color: 'text-blue-600' },
  { id: 'tax-planning', categoryId: 'tax_planning', label: 'Tax Planning', icon: FileText, color: 'text-gray-600' },
  { id: 'estate-planning', categoryId: 'estate_planning', label: 'Estate Planning', icon: Landmark, color: 'text-gray-600' },
  { id: 'employee-benefits', categoryId: 'employee_benefits', label: 'Employee Benefits', icon: Briefcase, color: 'text-purple-600' },
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
}

export function PolicyOverviewTab({ 
  clientId,
  clientDisplayName,
  onRunFNA,
  onAddPolicy,
  onViewDetails,
  variant = 'full',
}: PolicyOverviewTabProps) {
  const isEmbedded = variant === 'embedded';

  const handlePrintOverview = () => {
    const name = clientDisplayName?.trim();
    const suffix = name
      ? `Financial Portfolio Overview - ${name}`
      : 'Financial Portfolio Overview';
    withNavigateWealthPrintTitle(suffix, () => window.print());
  };

  return (
    <div className={isEmbedded ? 'space-y-4' : 'space-y-8 animate-in fade-in duration-500'}>
      {!isEmbedded && (
        <div className="flex items-center justify-between mb-6">
           <div>
             <h2 className="text-2xl font-bold text-gray-900">Financial Portfolio Overview</h2>
             <p className="text-gray-600">Comprehensive summary of all policies based on your product structure.</p>
           </div>
           <Button onClick={handlePrintOverview} variant="outline">
             Download Report
           </Button>
        </div>
      )}

      {/* Cross-Policy Comparison */}
      {!isEmbedded && (
        <PolicyComparisonPanel clientId={clientId} />
      )}

      {SECTIONS.map((section, index) => (
        <OverviewSection 
          key={section.id}
          index={index}
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
  index: number;
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

function OverviewSection({ index, section, clientId, onRunFNA, onAddPolicy, variant }: OverviewSectionProps) {
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [tableStructure, setTableStructure] = useState<SchemaField[]>([]);
  const [fnaResults, setFnaResults] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [subCategorySchemas, setSubCategorySchemas] = useState<Record<string, SchemaField[]>>({});
  const Icon = section.icon;
  const isEmbedded = variant === 'embedded';

  // Goal State (for Investments category)
  const [goals, setGoals] = useState<Goal[]>([]);
  const [linkedGoalsMap, setLinkedGoalsMap] = useState<Record<string, LinkedGoalStatus>>({});

  useEffect(() => {
    loadData();
  }, [clientId, section.categoryId]);

  // Update Linked Goals Map when policies or goals change
  useEffect(() => {
    if (section.categoryId === 'investments' && goals.length > 0 && policies.length > 0) {
       const map: Record<string, LinkedGoalStatus> = {};
       
       policies.forEach(policy => {
           // Find if policy is linked to any goal
           const linkedGoal = goals.find(g => g.linkedInvestmentIds?.includes(policy.id));
           
           if (linkedGoal) {
               const calc = calculateGoalStatus(linkedGoal, policies);
               map[policy.id] = {
                   name: linkedGoal.name,
                   status: calc.status,
                   targetAmount: linkedGoal.targetAmount,
                   requiredMonthly: calc.requiredMonthlyContribution,
                   targetDate: linkedGoal.targetDate
               };
           }
       });
       
       setLinkedGoalsMap(map);
    } else {
        setLinkedGoalsMap({});
    }
  }, [goals, policies, section.categoryId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Helper to fetch schema with retry for cold-start resilience
      const fetchSchemaForCategory = async (catId: string, retries = 2): Promise<SchemaField[]> => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            const res = await fetch(`${API_BASE}/schemas?categoryId=${catId}`, {
              headers: { Authorization: `Bearer ${publicAnonKey}` },
            });

            if (res.ok) {
              const data = await res.json();
              if (data && data.fields) return data.fields;
              if (Array.isArray(data)) return data;
            }
            
            // Non-ok response — fallback without retry
            break;
          } catch (err) {
            // Retry on transient network errors (cold-start / Failed to fetch)
            if (attempt < retries) {
              await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
              continue;
            }
            console.warn(`Error loading schema for ${catId} after ${retries + 1} attempts:`, err);
          }
        }
        // Final fallback to client-side defaults
        return DEFAULT_SCHEMAS[catId]?.fields || [];
      };

      // 1. Fetch Main Schema
      const mainFields = await fetchSchemaForCategory(section.categoryId);
      setTableStructure(mainFields);

      // 2. Fetch Sub-Schemas for Composite Categories in parallel
      if (section.categoryId === 'retirement_planning') {
        const [preFields, postFields] = await Promise.all([
          fetchSchemaForCategory('retirement_pre'),
          fetchSchemaForCategory('retirement_post'),
        ]);
        setSubCategorySchemas({
          retirement_pre: preFields,
          retirement_post: postFields
        });
      } else if (section.categoryId === 'investments') {
        const [volFields, guaFields] = await Promise.all([
          fetchSchemaForCategory('investments_voluntary'),
          fetchSchemaForCategory('investments_guaranteed'),
        ]);
        setSubCategorySchemas({
          investments_voluntary: volFields,
          investments_guaranteed: guaFields
        });
      } else if (section.categoryId === 'employee_benefits') {
        const [riskFields, retFields] = await Promise.all([
          fetchSchemaForCategory('employee_benefits_risk'),
          fetchSchemaForCategory('employee_benefits_retirement'),
        ]);
        setSubCategorySchemas({
          employee_benefits_risk: riskFields,
          employee_benefits_retirement: retFields
        });
      }

      // 3. Fetch Policies
      const policiesRes = await fetch(
        `${API_BASE}/policies?clientId=${clientId}&categoryId=${section.categoryId}`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (policiesRes.ok) {
        const policiesData = await policiesRes.json();
        setPolicies(policiesData.policies || []);
      }

      // 4. Fetch Goals (for Investments)
      if (section.categoryId === 'investments') {
        try {
          const goalsRes = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/goals/${clientId}`, {
             headers: { Authorization: `Bearer ${publicAnonKey}` }
          });
          if (goalsRes.ok) {
            const goalsData = await goalsRes.json();
            setGoals(goalsData.goals || []);
          }
        } catch (err) {
          console.warn('Error fetching goals:', err);
        }
      }

      // 5. Fetch FNA Data
      if (hasFNASupport(section.id)) {
         const fnaConfig = getFNAConfig(section.id);
         if (fnaConfig) {
            try {
               const fnaData = await fnaConfig.getLatestPublished(clientId);
               // Normalize results extraction based on FNA type
               let results = null;
               if (fnaData) {
                  if (section.id === 'medical-aid') {
                     results = fnaData.results || fnaData; // Medical puts results at top or inside
                  } else if (section.id === 'investments') {
                     results = fnaData.results || fnaData.session?.results;
                  } else {
                     results = fnaData.results;
                  }
               }
               setFnaResults(results);
            } catch (err) {
               console.warn(`Could not load FNA for ${section.label}`, err);
            }
         }
      }

    } catch (err) {
      console.error(`Error loading data for ${section.label}:`, err);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  const formatFieldValue = (field: SchemaField, value: unknown) => {
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
        return value;
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
       let acc: Record<string, number> = {};
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
    if (normalizedCol.includes('disability') && flatResults['disability']) return flatResults['disability'];
    if (normalizedCol.includes('illness') && flatResults['severeillness']) return flatResults['severeillness'];
    if (normalizedCol.includes('income') && flatResults['incomeprotection']) return flatResults['incomeprotection'];
    if (normalizedCol.includes('retirement') && flatResults['targetcapital']) return flatResults['targetcapital']; // Retirement Target
    if (normalizedCol.includes('projected') && flatResults['targetcapital']) return flatResults['targetcapital']; // Compare Projected vs Target
    
    // Specific mapping for Retirement Planning: "Estimated Maturity Value" -> "Required Capital" from FNA
    // Exclude "date" to prevent matching "Maturity Date"
    if ((normalizedCol.includes('maturity') || normalizedCol.includes('estimated')) && !normalizedCol.includes('date') && flatResults['requiredcapital']) return flatResults['requiredcapital'];
    
    return null;
  };

  const renderTable = (title: string, tablePolicies: PolicyRecord[], structure: SchemaField[], showFnaRow: boolean = false, linkedGoals?: Record<string, LinkedGoalStatus>) => {
    if (!tablePolicies || tablePolicies.length === 0) return null;
    
    const currencyColumns = structure.filter(f => f.type === 'currency');
    
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
                          <span className="font-medium text-gray-900">{policy.providerName}</span>
                        </div>
                        
                        {/* Linked Goal Indicator */}
                        {linkedGoal && (
                             <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md border border-gray-100 w-fit">
                                <Target className={`h-3.5 w-3.5 ${
                                    linkedGoal.status === 'On Track' ? 'text-green-600' :
                                    linkedGoal.status === 'At Risk' ? 'text-yellow-600' : 'text-red-600'
                                }`} />
                                <span className="text-xs text-gray-700 font-medium">Linked: {linkedGoal.name}</span>
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
                                  <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-400">Target Goal</span>
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
                                    <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-400">Target Date</span>
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
                            const isShortfall = linkedGoal.requiredMonthly > 0;
                            goalContent = isShortfall ? (
                                <div className="mt-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 text-right">
                                    <div className="text-[10px] text-red-400 uppercase tracking-wider font-semibold">Shortfall</div>
                                    +{Math.round(linkedGoal.requiredMonthly).toLocaleString()} /pm
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
                      <div className={`flex flex-col gap-1.5 ${field.type === 'currency' ? 'items-end' : ''}`}>
                          <span className="font-medium text-gray-900 text-sm">{cellValue}</span>
                          {goalContent}
                      </div>
                    </TableCell>
                  )})}
                </TableRow>
              )})}
              
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
                    REQUIRED (FNA)
                    <Info className="h-3 w-3 text-purple-400" />
                  </TableCell>
                  {structure.map((field) => {
                    const needed = getFNAValueForColumn(field.name);
                    const isCurrency = field.type === 'currency';
                    
                    return (
                      <TableCell 
                        key={field.id}
                        className={`${isCurrency ? 'text-right' : ''} whitespace-nowrap px-6 py-4`}
                      >
                        {isCurrency && needed !== null
                          ? `R${needed.toLocaleString()}`
                          : (needed || '')}
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
        const prePolicies = policies.filter(p => p.categoryId === 'retirement_pre' || p.categoryId === 'retirement_planning');
        const postPolicies = policies.filter(p => p.categoryId === 'retirement_post');
        
        const preSchema = subCategorySchemas.retirement_pre || tableStructure;
        const postSchema = subCategorySchemas.retirement_post || [];
        
        return (
           <div>
              {renderTable(prePolicies.length > 0 && postPolicies.length > 0 ? "Pre-Retirement" : "", prePolicies, preSchema, true)}
              {renderTable("Post-Retirement", postPolicies, postSchema, false)}
           </div>
        );
     }
     
     if (section.categoryId === 'investments') {
        const volPolicies = policies.filter(p => p.categoryId === 'investments_voluntary' || p.categoryId === 'investments');
        const guaPolicies = policies.filter(p => p.categoryId === 'investments_guaranteed');
        
        const volSchema = subCategorySchemas.investments_voluntary || tableStructure;
        const guaSchema = subCategorySchemas.investments_guaranteed || [];
        
        return (
           <div className="space-y-6">
              {renderTable(volPolicies.length > 0 && guaPolicies.length > 0 ? "Voluntary Investments" : "", volPolicies, volSchema, true, linkedGoalsMap)}
              {renderTable("Guaranteed Investments", guaPolicies, guaSchema, false, linkedGoalsMap)}
           </div>
        );
     }
     
     if (section.categoryId === 'employee_benefits') {
        const riskPolicies = policies.filter(p => p.categoryId === 'employee_benefits_risk' || p.categoryId === 'employee_benefits');
        const retPolicies = policies.filter(p => p.categoryId === 'employee_benefits_retirement');
        
        const riskSchema = subCategorySchemas.employee_benefits_risk || tableStructure;
        const retSchema = subCategorySchemas.employee_benefits_retirement || [];
        
        return (
           <div>
              {renderTable(riskPolicies.length > 0 && retPolicies.length > 0 ? "Risk Benefits" : "", riskPolicies, riskSchema, true)}
              {renderTable("Retirement Funds", retPolicies, retSchema, false)}
           </div>
        );
     }

     return renderTable("", policies, tableStructure, true);
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
      <Card className="mb-8 border-t-4" style={{ borderTopColor: section.color.replace('text-', '').replace('[', '').replace(']', '') }}>
        <CardHeader className="bg-gray-50/50 pb-4 border-b border-gray-100">
           <div className="flex items-center gap-3">
             <div className="h-6 w-6 bg-gray-200 rounded animate-pulse" />
             <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
           </div>
        </CardHeader>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
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
    <Card className="mb-8 border-t-4" style={{ borderTopColor: section.color.replace('text-', '').replace('[', '').replace(']', '') }}>
      <CardHeader className="bg-gray-50/50 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-white shadow-sm border border-gray-100`}>
              <Icon className={`h-5 w-5 ${section.color}`} />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {index + 1}. {section.label}
              </CardTitle>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onAddPolicy}>
              <Plus className="h-3 w-3 mr-1" /> Add Policy
            </Button>
            {hasFNASupport(section.id) && (
              <Button variant="ghost" size="sm" onClick={onRunFNA} className="text-gray-500 hover:text-purple-600">
                <Zap className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {hasError ? (
           <div className="text-center py-6 text-red-500">
             Failed to load data. Please try again.
           </div>
        ) : policies.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-sm text-gray-500 mb-2">No policies found for {section.label}</p>
            {tableStructure.length === 0 && (
               <p className="text-xs text-amber-600 mt-1">
                 Note: Product structure not configured.
               </p>
            )}
            <Button variant="link" size="sm" onClick={onAddPolicy}>
              + Add first policy
            </Button>
          </div>
        ) : (
          renderContent()
        )}
      </CardContent>
    </Card>
  );
}