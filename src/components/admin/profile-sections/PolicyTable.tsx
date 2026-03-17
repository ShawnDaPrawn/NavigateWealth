import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '../../ui/table';
import { Button } from '../../ui/button';
import {
  Edit,
  Archive,
  Trash2,
  Building2,
  Target,
  CheckCircle,
  RotateCcw,
  FileText,
  Sparkles,
  Eye,
} from 'lucide-react';
import { PolicyDocumentViewer, type ViewerDocumentMeta } from './PolicyDocumentViewer';

/** A policy record returned from the integrations API */
export interface PolicyRecord {
  id: string;
  categoryId?: string;
  data?: Record<string, unknown>;
  archived?: boolean;
  archiveReason?: string;
  [key: string]: unknown;
}

/** A schema field definition describing a column in a policy table */
export interface SchemaField {
  id: string;
  label?: string;
  name?: string;
  type?: string;
  options?: string[];
  [key: string]: unknown;
}

/** Goal status linked to a policy */
export interface LinkedGoalStatus {
  name: string;
  status: string;
  targetAmount?: number;
  requiredMonthly?: number;
  targetDate?: string;
}

interface PolicyTableProps {
  title: string;
  policies: PolicyRecord[];
  structure: SchemaField[];
  clientId?: string;
  onEdit: (policy: PolicyRecord) => void;
  onArchive: (policy: PolicyRecord) => void;
  onReinstate?: (policy: PolicyRecord) => void;
  onDelete: (policy: PolicyRecord) => void;
  formatFieldValue: (field: SchemaField, value: unknown) => React.ReactNode;
  colorTheme?: 'purple' | 'green' | 'blue' | 'indigo' | 'amber' | 'orange' | 'gray';
  linkedGoals?: Record<string, LinkedGoalStatus>;
}

export function PolicyTable({
  title,
  policies,
  structure,
  clientId,
  onEdit,
  onArchive,
  onReinstate,
  onDelete,
  formatFieldValue,
  colorTheme = 'purple',
  linkedGoals
}: PolicyTableProps) {
  
  if (!policies || policies.length === 0) return null;

  // Document viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerPolicy, setViewerPolicy] = useState<{ policyId: string; providerName: string; documentMeta: ViewerDocumentMeta | null } | null>(null);

  const handleViewDocument = (policy: PolicyRecord) => {
    const doc = (policy as Record<string, unknown>).document as ViewerDocumentMeta | undefined;
    setViewerPolicy({
      policyId: policy.id,
      providerName: (policy.providerName as string) || 'Unknown',
      documentMeta: doc ? { fileName: doc.fileName, fileSize: doc.fileSize, documentType: doc.documentType, uploadDate: doc.uploadDate } : null,
    });
    setViewerOpen(true);
  };

  // Calculate totals for currency fields
  const calculateFieldTotals = () => {
    const totals: Record<string, number> = {};
    
    structure.forEach((field) => {
      if (field.type === 'currency') {
        let sum = 0;
        policies.forEach((policy) => {
          const value = policy.data?.[field.id];
          if (value) {
            sum += Number(value);
          }
        });
        totals[field.id] = sum;
      }
    });
    
    return totals;
  };

  const totals = calculateFieldTotals();

  // Helper for footer colors
  const getFooterColors = () => {
    switch (colorTheme) {
      case 'green': return { bg: "bg-green-50/50 hover:bg-green-50/80", cell: "bg-green-50/50" };
      case 'blue': return { bg: "bg-blue-50/50 hover:bg-blue-50/80", cell: "bg-blue-50/50" };
      case 'indigo': return { bg: "bg-indigo-50/50 hover:bg-indigo-50/80", cell: "bg-indigo-50/50" };
      case 'amber': return { bg: "bg-amber-50/50 hover:bg-amber-50/80", cell: "bg-amber-50/50" };
      case 'orange': return { bg: "bg-orange-50/50 hover:bg-orange-50/80", cell: "bg-orange-50/50" };
      case 'purple': 
      default: return { bg: "bg-purple-50/50 hover:bg-purple-50/80", cell: "bg-purple-50/50" };
    }
  };

  const { bg: footerBgClass, cell: footerCellClass } = getFooterColors();

  return (
    <div className="space-y-2 mt-4">
      <h4 className="text-sm font-semibold text-gray-700 ml-1">{title}</h4>
      <div className="border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Provider</TableHead>
                {structure.map((field) => (
                  <TableHead key={field.id} className="min-w-[130px]">{field.label || field.name || field.id}</TableHead>
                ))}
                <TableHead className="text-right min-w-[100px] sticky right-0 bg-white">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => {
                 const linkedGoal = linkedGoals?.[policy.id];
                 
                 return (
                  <TableRow 
                    key={policy.id}
                    className={policy.archived ? "bg-gray-50/80 text-gray-500 hover:bg-gray-50" : ""}
                  >
                    <TableCell className="min-w-[150px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Building2 className={`h-4 w-4 ${policy.archived ? "text-gray-300" : "text-gray-400"}`} />
                          <span className={`font-medium ${policy.archived ? "text-gray-500 line-through" : ""}`}>
                            {policy.providerName}
                          </span>
                          {/* Document attachment indicator */}
                          {(policy as Record<string, unknown>).document && !policy.archived && (
                            <button
                              onClick={() => clientId && handleViewDocument(policy)}
                              title="View policy document"
                              className="flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                            >
                              <FileText className="h-3.5 w-3.5 text-purple-500 hover:text-purple-700" />
                            </button>
                          )}
                          {/* AI extraction indicator */}
                          {((policy as Record<string, unknown>).extraction as { status?: string } | undefined)?.status === 'completed' && !policy.archived && (
                            <span title="AI data extracted" className="flex-shrink-0">
                              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>
                        
                        {/* Subtle Linked Goal Indicator */}
                        {linkedGoal && (
                             <div className="flex items-center gap-1.5 mt-1">
                                <Target className={`h-3 w-3 ${
                                    linkedGoal.status === 'On Track' ? 'text-green-600' :
                                    linkedGoal.status === 'At Risk' ? 'text-yellow-600' : 'text-red-600'
                                }`} />
                                <span className="text-[10px] text-gray-500 font-medium">Linked: {linkedGoal.name}</span>
                             </div>
                        )}
  
                        {policy.archived && (
                          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            Archived: {policy.archivedReason}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {structure.map((field) => {
                      const cellValue = formatFieldValue(field, policy.data?.[field.id]);
                      
                      // Check for Goal linkage enhancements
                      let goalContent = null;
                      const fieldLabel = field.label || field.name || '';
                      if (linkedGoal) {
                          // Maturity Value (Target Amount)
                          if (
                              field.keyId === 'invest_maturity_value' || 
                              field.id === 'invest_maturity_value' || 
                              fieldLabel === 'Estimated Maturity Value' || 
                              fieldLabel === 'Est Maturity Value'
                          ) {
                              goalContent = (
                                <div className="text-[10px] mt-1 text-gray-500 flex items-center gap-1">
                                    <span>Goal:</span>
                                    <span className="font-semibold text-blue-600">
                                        R{Number(linkedGoal.targetAmount).toLocaleString()}
                                    </span>
                                </div>
                              );
                          } 
                          // Maturity Date (Goal Date)
                          else if (
                              (field.keyId === 'invest_maturity_date' || 
                               field.id === 'invest_maturity_date' || 
                               fieldLabel === 'Maturity Date') && 
                              linkedGoal.targetDate
                          ) {
                              const targetDate = new Date(linkedGoal.targetDate);
                              goalContent = (
                                  <div className="text-[10px] mt-1 text-gray-500 flex items-center gap-1">
                                      <span>Goal:</span>
                                      <span className="font-semibold text-blue-600">
                                          {targetDate.toLocaleDateString()}
                                      </span>
                                  </div>
                              );
                          } 
                          // Premium (Contributions)
                          else if (
                              field.keyId === 'invest_monthly_contribution' || 
                              field.id === 'invest_premium' || 
                              fieldLabel === 'Premium'
                          ) {
                              const isShortfall = linkedGoal.requiredMonthly > 0;
                              goalContent = isShortfall ? (
                                  <div className="text-[10px] mt-1 font-bold text-red-600 bg-red-50 inline-block px-1.5 py-0.5 rounded border border-red-100">
                                      +{Math.round(linkedGoal.requiredMonthly).toLocaleString()} /pm req
                                  </div>
                              ) : (
                                  <div className="text-[10px] mt-1 font-bold text-green-600 flex items-center gap-1">
                                      <CheckCircle className="h-3 w-3" /> On Track
                                  </div>
                              );
                          }
                      }

                      return (
                      <TableCell key={field.id} className="min-w-[130px] align-top py-3">
                        <div className="flex flex-col">
                            <span>{cellValue}</span>
                            {goalContent}
                        </div>
                      </TableCell>
                    )})}
                    <TableCell className="text-right min-w-[100px] sticky right-0 bg-white group-hover:bg-gray-50 align-top py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!policy.archived ? (
                          <div className="contents">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(policy)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              onClick={() => onArchive(policy)}
                              title="Archive Policy"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center">
                              <span className="text-xs text-gray-400 italic pr-2">Archived</span>
                              {onReinstate && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => onReinstate(policy)}
                                  title="Reinstate Policy"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(policy)}
                          title="Delete Permanently"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
               );})}
            </TableBody>
            <TableFooter>
              <TableRow className={`font-semibold ${footerBgClass}`}>
                <TableCell className="min-w-[150px] font-semibold">Total</TableCell>
                {structure.map((field) => {
                  const total = totals[field.id];
                  return (
                    <TableCell key={field.id} className="min-w-[130px] font-semibold">
                      {field.type === 'currency' && total 
                        ? `R${total.toLocaleString()}` 
                        : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className={`text-right min-w-[100px] sticky right-0 ${footerCellClass}`}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
      {viewerOpen && viewerPolicy && clientId && (
        <PolicyDocumentViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          policyId={viewerPolicy.policyId}
          clientId={clientId}
          providerName={viewerPolicy.providerName}
          documentMeta={viewerPolicy.documentMeta}
        />
      )}
    </div>
  );
}