/**
 * POLICY CATEGORY TAB COMPONENT (REFACTORED)
 * Displays and manages policies for a specific category with dynamic forms
 */

import React, { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import {
  Plus,
  Loader2,
  FileBarChart,
  EyeOff,
  History,
  Target,
} from 'lucide-react';
import { PolicyFormDialog } from './PolicyFormDialog';
import { ArchivePolicyDialog } from './ArchivePolicyDialog';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { DEFAULT_SCHEMAS } from './default-schemas';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { getFNAConfig, hasFNASupport } from './fna-config';
import { useFNAManagement } from '../modules/fna/hooks/useFNAManagement';
import { FNACard, PublishFNADialog, ViewPublishedFNADialog } from '../modules/fna';
import { PolicyTable } from './PolicyTable';

// Heavy FNA management views — lazy-loaded to reduce initial bundle
const FNAManagementView = React.lazy(() =>
  import('../modules/risk-planning-fna/components/FNAManagementView').then(m => ({ default: m.FNAManagementView }))
);
const PreviousFNAsDialog = React.lazy(
  () => import('../modules/risk-planning-fna/components/PreviousFNAsDialog'),
);
const WillManagementView = React.lazy(() =>
  import('../modules/estate-planning-fna/components/WillManagementView').then(m => ({ default: m.WillManagementView }))
);
const WillDraftingWizard = React.lazy(() =>
  import('../modules/estate-planning-fna/components/WillDraftingWizard').then(m => ({ default: m.WillDraftingWizard }))
);
const WillPdfView = React.lazy(() =>
  import('../modules/estate-planning-fna/components/WillPdfView').then(m => ({ default: m.WillPdfView }))
);
const WillChatInterface = React.lazy(() =>
  import('../modules/estate-planning-fna/components/WillChatInterface').then(m => ({ default: m.WillChatInterface }))
);
const GoalDashboard = React.lazy(() =>
  import('../modules/client-management/components/goals/GoalDashboard').then(m => ({ default: m.GoalDashboard }))
);

const EstateDocumentsSection = React.lazy(() =>
  import('../modules/estate-planning-fna/components/EstateDocumentsSection').then(m => ({ default: m.EstateDocumentsSection }))
);

const TaxDocumentsSection = React.lazy(() =>
  import('../modules/tax-planning-fna/components/TaxDocumentsSection').then(m => ({ default: m.TaxDocumentsSection }))
);

import { Goal } from '../modules/client-management/components/goals/types';
import { calculateGoalStatus } from '../modules/client-management/components/goals/utils';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;

interface PolicyCategoryTabProps {
  categorySubtabId: string; // e.g., 'risk-planning'
  categoryName: string; // e.g., 'Risk Planning'
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  description: string;
  clientId: string;
  /** Actual client display name (firstName + lastName) — used for will chat, PDF titles, etc. */
  clientDisplayName?: string;
}

export function PolicyCategoryTab({
  categorySubtabId,
  categoryName,
  icon: Icon,
  iconColor,
  description,
  clientId,
  clientDisplayName,
}: PolicyCategoryTabProps) {
  // Policy State
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyRecord | null>(null);
  const [deletingPolicy, setDeletingPolicy] = useState<PolicyRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tableStructure, setTableStructure] = useState<SchemaField[]>([]);
  const [subCategorySchemas, setSubCategorySchemas] = useState<Record<string, SchemaField[]>>({});
  
  // Goal State (for Investments category)
  const [goals, setGoals] = useState<Goal[]>([]);
  const [linkedGoalsMap, setLinkedGoalsMap] = useState<Record<string, LinkedGoalStatus>>({});

  // Archiving State
  const [archivingPolicy, setArchivingPolicy] = useState<PolicyRecord | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  
  // View FNA Dialog State
  const [viewFNADialogOpen, setViewFNADialogOpen] = useState(false);
  const [previousFNAsDialogOpen, setPreviousFNAsDialogOpen] = useState(false);
  const [selectedHistoricalFnaId, setSelectedHistoricalFnaId] = useState<string | undefined>(undefined);
  const [showFNAManagement, setShowFNAManagement] = useState(false);
  const [refreshFNAManagementTrigger, setRefreshFNAManagementTrigger] = useState(0);

  // Will Management State (for Estate Planning)
  const [showWillManagement, setShowWillManagement] = useState(false);
  const [selectedWillId, setSelectedWillId] = useState<string | undefined>(undefined);
  const [willDraftingWizardOpen, setWillDraftingWizardOpen] = useState(false);
  const [livingWillDraftingWizardOpen, setLivingWillDraftingWizardOpen] = useState(false);
  const [willPdfViewOpen, setWillPdfViewOpen] = useState(false);
  const [willChatInterfaceOpen, setWillChatInterfaceOpen] = useState(false);
  // Resume Draft state
  const [resumeDraftWillId, setResumeDraftWillId] = useState<string | undefined>(undefined);
  const [resumeDraftWillType, setResumeDraftWillType] = useState<'last_will' | 'living_will'>('last_will');

  const [isGoalDashboardOpen, setIsGoalDashboardOpen] = useState(false);

  // FNA Configuration and Management
  const fnaConfig = getFNAConfig(categorySubtabId);
  const hasFNA = hasFNASupport(categorySubtabId);
  
  const fnaManagement = useFNAManagement({
    config: fnaConfig,
    clientId,
    enabled: hasFNA,
  });

  // Map subtab IDs to category IDs for API
  const categoryIdMap: Record<string, string> = {
    'risk-planning': 'risk_planning',
    'medical-aid': 'medical_aid',
    'retirement': 'retirement_planning',
    'investments': 'investments',
    'employee-benefits': 'employee_benefits',
    'tax-planning': 'tax_planning',
    'estate-planning': 'estate_planning',
  };

  const categoryId = categoryIdMap[categorySubtabId];

  // Helper to determine FNA API Base URL
  const getFnaApiBaseUrl = () => {
    const SERVER_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;
    
    switch (categorySubtabId) {
      case 'medical-aid':
        return `${SERVER_BASE}/medical-fna`;
      case 'retirement':
        return `${SERVER_BASE}/retirement-fna`;
      case 'investments':
        return `${SERVER_BASE}/investment-ina`;
      case 'tax-planning':
        return `${SERVER_BASE}/tax-planning-fna`;
      case 'estate-planning':
        return `${SERVER_BASE}/estate-planning-fna`;
      case 'risk-planning':
      default:
        return `${SERVER_BASE}/risk-planning-fna`;
    }
  };

  const fnaApiBaseUrl = getFnaApiBaseUrl();

  // Helper to determine FNA list API URL
  const getFnaListApiUrl = () => {
    switch (categorySubtabId) {
      case 'risk-planning':
        return `${fnaApiBaseUrl}/client/${clientId}/list`;
      default:
        return `${fnaApiBaseUrl}/client/${clientId}`;
    }
  };

  const fnaListApiUrl = getFnaListApiUrl();
  const fnaListTitle = `${categoryName} FNAs`;

  useEffect(() => {
    loadPolicies();
    loadTableStructure();
  }, [categoryId, clientId, showArchived]);

  // Update Linked Goals Map when policies or goals change
  useEffect(() => {
    if (categorySubtabId === 'investments' && goals.length > 0 && policies.length > 0) {
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
  }, [goals, policies, categorySubtabId]);

  const loadTableStructure = async () => {
    // Helper to fetch schema for a specific category with retry for cold-start resilience
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

    // Load main structure
    const mainFields = await fetchSchemaForCategory(categoryId);
    setTableStructure(mainFields);

    // Load sub-structures for composite categories in parallel
    if (categoryId === 'retirement_planning') {
      const [preFields, postFields] = await Promise.all([
        fetchSchemaForCategory('retirement_pre'),
        fetchSchemaForCategory('retirement_post'),
      ]);
      setSubCategorySchemas({
        retirement_pre: preFields,
        retirement_post: postFields
      });
    } else if (categoryId === 'investments') {
      const [volFields, guaFields] = await Promise.all([
        fetchSchemaForCategory('investments_voluntary'),
        fetchSchemaForCategory('investments_guaranteed'),
      ]);
      setSubCategorySchemas({
        investments_voluntary: volFields,
        investments_guaranteed: guaFields
      });
    } else if (categoryId === 'employee_benefits') {
      const [riskFields, retFields] = await Promise.all([
        fetchSchemaForCategory('employee_benefits_risk'),
        fetchSchemaForCategory('employee_benefits_retirement'),
      ]);
      setSubCategorySchemas({
        employee_benefits_risk: riskFields,
        employee_benefits_retirement: retFields
      });
    } else {
        setSubCategorySchemas({});
    }
  };

  const loadPolicies = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/policies?clientId=${clientId}&categoryId=${categoryId}&includeArchived=${showArchived}`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (!res.ok) throw new Error('Failed to load policies');

      const data = await res.json();
      setPolicies(data.policies || []);
    } catch (err) {
      console.error('Error loading policies:', err);
      toast.error('Failed to load policies');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPolicy = () => {
    setEditingPolicy(null);
    setIsFormOpen(true);
  };

  const handleEditPolicy = (policy: Record<string, unknown>) => {
    setEditingPolicy(policy);
    setIsFormOpen(true);
  };

  const handleDeletePolicy = async () => {
    if (!deletingPolicy) return;

    setIsDeleting(true);
    const toastId = toast.loading('Deleting policy...');

    try {
      const res = await fetch(
        `${API_BASE}/policies?id=${deletingPolicy.id}&clientId=${clientId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (!res.ok) throw new Error('Failed to delete policy');

      toast.success('Policy deleted successfully', { id: toastId });
      setDeletingPolicy(null);
      loadPolicies();
    } catch (err: unknown) {
      console.error('Error deleting policy:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete policy');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchivePolicy = async (reason: string) => {
    if (!archivingPolicy) return;

    setIsArchiving(true);
    const toastId = toast.loading('Archiving policy...');

    try {
      const res = await fetch(`${API_BASE}/policies/archive`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}` 
        },
        body: JSON.stringify({
          id: archivingPolicy.id,
          clientId,
          reason
        })
      });

      if (!res.ok) throw new Error('Failed to archive policy');

      toast.success('Policy archived successfully', { id: toastId });
      setArchivingPolicy(null);
      loadPolicies();
    } catch (err: unknown) {
      console.error('Error archiving policy:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to archive policy');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleReinstatePolicy = async (policy: Record<string, unknown>) => {
    const toastId = toast.loading('Reinstating policy...');
    try {
       const res = await fetch(`${API_BASE}/policies/reinstate`, {
           method: 'POST',
           headers: {
               'Content-Type': 'application/json',
               Authorization: `Bearer ${publicAnonKey}`
           },
           body: JSON.stringify({
               id: policy.id,
               clientId
           })
       });

       if (!res.ok) throw new Error('Failed to reinstate policy');
       
       toast.success('Policy reinstated successfully', { id: toastId });
       loadPolicies();
    } catch (err: unknown) {
        console.error('Error reinstating policy:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to reinstate policy');
    }
  };

  const formatFieldValue = (field: { type?: string; options?: string[]; [key: string]: unknown }, value: unknown) => {
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

  // Prepare wizard props dynamically based on config
  const getWizardProps = () => {
    if (!hasFNA || !fnaConfig) return {};

    const props: Record<string, unknown> = {
      open: fnaManagement.wizardOpen,
      onClose: () => fnaManagement.setWizardOpen(false),
      clientId,
    };

    // Add completion callback with the correct key name
    const completionKey = fnaConfig.wizardProps?.onCompleteKey || 'onFNAComplete';
    props[completionKey] = fnaManagement.handleFNAComplete;

    return props;
  };

  // Helper to determine if we should split tables
  const renderPolicyTables = () => {
    if (categoryId === 'retirement_planning') {
      const prePolicies = policies.filter(p => p.categoryId === 'retirement_pre' || p.categoryId === 'retirement_planning');
      const postPolicies = policies.filter(p => p.categoryId === 'retirement_post');
      
      const hasPre = prePolicies.length > 0;
      const hasPost = postPolicies.length > 0;

      // Use pre-retirement schema for legacy/pre policies
      const preSchema = subCategorySchemas.retirement_pre || tableStructure;
      const postSchema = subCategorySchemas.retirement_post || [];

      return (
        <div className="space-y-6">
          {hasPre && (
            <PolicyTable
              title="Pre-Retirement"
              policies={prePolicies}
              structure={preSchema}
              clientId={clientId}
              onEdit={handleEditPolicy}
              onArchive={setArchivingPolicy}
              onReinstate={handleReinstatePolicy}
              onDelete={setDeletingPolicy}
              formatFieldValue={formatFieldValue}
              colorTheme="purple"
            />
          )}
          
          {hasPost && (
            <PolicyTable
              title="Post-Retirement"
              policies={postPolicies}
              structure={postSchema}
              clientId={clientId}
              onEdit={handleEditPolicy}
              onArchive={setArchivingPolicy}
              onReinstate={handleReinstatePolicy}
              onDelete={setDeletingPolicy}
              formatFieldValue={formatFieldValue}
              colorTheme="green"
            />
          )}

          {!hasPre && !hasPost && (
             // Fallback if no specific categories found but we have policies
             policies.length > 0 && (
                <PolicyTable
                    title="Retirement Policies"
                    policies={policies}
                    structure={tableStructure}
                    clientId={clientId}
                    onEdit={handleEditPolicy}
                    onArchive={setArchivingPolicy}
                    onReinstate={handleReinstatePolicy}
                    onDelete={setDeletingPolicy}
                    formatFieldValue={formatFieldValue}
                    colorTheme="purple"
                />
             )
          )}
        </div>
      );
    } 
    
    if (categoryId === 'investments') {
        const volPolicies = policies.filter(p => p.categoryId === 'investments_voluntary' || p.categoryId === 'investments');
        const guaPolicies = policies.filter(p => p.categoryId === 'investments_guaranteed');
        
        const hasVol = volPolicies.length > 0;
        const hasGua = guaPolicies.length > 0;
  
        const volSchema = subCategorySchemas.investments_voluntary || tableStructure;
        const guaSchema = subCategorySchemas.investments_guaranteed || [];
  
        return (
          <div className="space-y-6">
            {hasVol && (
              <PolicyTable
                title="Voluntary Investments"
                policies={volPolicies}
                structure={volSchema}
                clientId={clientId}
                onEdit={handleEditPolicy}
                onArchive={setArchivingPolicy}
                onReinstate={handleReinstatePolicy}
                onDelete={setDeletingPolicy}
                formatFieldValue={formatFieldValue}
                colorTheme="blue"
                linkedGoals={linkedGoalsMap}
              />
            )}
            
            {hasGua && (
              <PolicyTable
                title="Guaranteed Investments"
                policies={guaPolicies}
                structure={guaSchema}
                clientId={clientId}
                onEdit={handleEditPolicy}
                onArchive={setArchivingPolicy}
                onReinstate={handleReinstatePolicy}
                onDelete={setDeletingPolicy}
                formatFieldValue={formatFieldValue}
                colorTheme="indigo"
                linkedGoals={linkedGoalsMap}
              />
            )}

            {!hasVol && !hasGua && policies.length > 0 && (
                 <PolicyTable
                    title="Investments"
                    policies={policies}
                    structure={tableStructure}
                    clientId={clientId}
                    onEdit={handleEditPolicy}
                    onArchive={setArchivingPolicy}
                    onReinstate={handleReinstatePolicy}
                    onDelete={setDeletingPolicy}
                    formatFieldValue={formatFieldValue}
                    colorTheme="blue"
                    linkedGoals={linkedGoalsMap}
                />
            )}
          </div>
        );
      }

    if (categoryId === 'employee_benefits') {
        const riskPolicies = policies.filter(p => p.categoryId === 'employee_benefits_risk' || p.categoryId === 'employee_benefits'); // Include legacy as risk
        const riskPoliciesOnly = policies.filter(p => p.categoryId === 'employee_benefits_risk');
        const retPoliciesOnly = policies.filter(p => p.categoryId === 'employee_benefits_retirement');
        const genericPolicies = policies.filter(p => p.categoryId === 'employee_benefits');
        
        const finalRiskPolicies = [...riskPoliciesOnly, ...genericPolicies]; // Defaulting legacy to Risk table
        const finalRetPolicies = retPoliciesOnly;

        const hasRisk = finalRiskPolicies.length > 0;
        const hasRet = finalRetPolicies.length > 0;
  
        const riskSchema = subCategorySchemas.employee_benefits_risk || tableStructure;
        const retSchema = subCategorySchemas.employee_benefits_retirement || [];
  
        return (
          <div className="space-y-6">
            {hasRisk && (
              <PolicyTable
                title="Risk Benefits"
                policies={finalRiskPolicies}
                structure={riskSchema}
                clientId={clientId}
                onEdit={handleEditPolicy}
                onArchive={setArchivingPolicy}
                onReinstate={handleReinstatePolicy}
                onDelete={setDeletingPolicy}
                formatFieldValue={formatFieldValue}
                colorTheme="amber"
              />
            )}
            
            {hasRet && (
              <PolicyTable
                title="Retirement Funds"
                policies={finalRetPolicies}
                structure={retSchema}
                clientId={clientId}
                onEdit={handleEditPolicy}
                onArchive={setArchivingPolicy}
                onReinstate={handleReinstatePolicy}
                onDelete={setDeletingPolicy}
                formatFieldValue={formatFieldValue}
                colorTheme="orange"
              />
            )}

            {!hasRisk && !hasRet && policies.length > 0 && (
                 <PolicyTable
                    title="Employee Benefits"
                    policies={policies}
                    structure={tableStructure}
                    clientId={clientId}
                    onEdit={handleEditPolicy}
                    onArchive={setArchivingPolicy}
                    onReinstate={handleReinstatePolicy}
                    onDelete={setDeletingPolicy}
                    formatFieldValue={formatFieldValue}
                    colorTheme="amber"
                />
            )}
          </div>
        );
      }

    // Default single table for other categories
    return (
        <PolicyTable
            title={`${categoryName} Policies`}
            policies={policies}
            structure={tableStructure}
            clientId={clientId}
            onEdit={handleEditPolicy}
            onArchive={setArchivingPolicy}
            onReinstate={handleReinstatePolicy}
            onDelete={setDeletingPolicy}
            formatFieldValue={formatFieldValue}
        />
    );
  };

  return (
    <div className="space-y-4">
      <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#6d28d9]" /></div>}>
      {/* Show Will Management View for Estate Planning */}
      {categorySubtabId === 'estate-planning' && willChatInterfaceOpen ? (
        <WillChatInterface
          clientId={clientId}
          clientName={clientDisplayName || categoryName}
          onClose={() => setWillChatInterfaceOpen(false)}
          onWillSaved={() => {
            // Refresh will management after saving
            setShowWillManagement(false);
            setTimeout(() => setShowWillManagement(true), 100);
          }}
        />
      ) : categorySubtabId === 'estate-planning' && showWillManagement ? (
        <WillManagementView
          clientId={clientId}
          clientName={clientDisplayName || categoryName}
          onDraftLastWill={() => {
            setWillDraftingWizardOpen(true);
          }}
          onDraftLivingWill={() => {
            setLivingWillDraftingWizardOpen(true);
          }}
          onViewWill={(willId: string) => {
            setSelectedWillId(willId);
            setWillPdfViewOpen(true);
          }}
          onResumeDraft={(willId: string, willType: 'last_will' | 'living_will') => {
            setResumeDraftWillId(willId);
            setResumeDraftWillType(willType);
            if (willType === 'living_will') {
              setLivingWillDraftingWizardOpen(true);
            } else {
              setWillDraftingWizardOpen(true);
            }
          }}
          onClose={() => setShowWillManagement(false)}
          onAIWillBuilder={() => setWillChatInterfaceOpen(true)}
        />
      ) : showFNAManagement && hasFNA && fnaConfig ? (
        <FNAManagementView
          key={refreshFNAManagementTrigger}
          clientId={clientId}
          clientName={categoryName}
          title={fnaListTitle}
          apiUrl={fnaListApiUrl}
          onCreateNew={() => {
            setShowFNAManagement(false);
            fnaManagement.handleRunFNA();
          }}
          onViewFNA={(fnaId: string) => {
            setSelectedHistoricalFnaId(fnaId);
            setViewFNADialogOpen(true);
          }}
          onClose={() => setShowFNAManagement(false)}
        />
      ) : (
        <div className="contents">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Icon className={`h-5 w-5 ${iconColor}`} />
                {categoryName}
              </h3>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
            <div className="flex gap-2">
              {categorySubtabId === 'investments' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsGoalDashboardOpen(true)}
                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Goals
                  </Button>
              )}
              {/* Show Will Management button for Estate Planning instead of FNA */}
              {categorySubtabId === 'estate-planning' ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowWillManagement(true)}
                >
                  <FileBarChart className="h-4 w-4 mr-2" />
                  Will Management
                </Button>
              ) : hasFNA && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowFNAManagement(true)}
                >
                  <FileBarChart className="h-4 w-4 mr-2" />
                  FNA
                </Button>
              )}
              <Button
                variant={showArchived ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className={showArchived ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200" : ""}
              >
                {showArchived ? (
                  <div className="contents">
                    <EyeOff className="h-4 w-4 mr-2" />
                    Hide History
                  </div>
                ) : (
                  <div className="contents">
                    <History className="h-4 w-4 mr-2" />
                    Show History
                  </div>
                )}
              </Button>
              <Button size="sm" onClick={handleAddPolicy}>
                <Plus className="h-4 w-4 mr-2" />
                Add Policy
              </Button>
            </div>
          </div>

          {/* Policies List */}
          {/* Goal Dashboard moved to Dialog */}

          {isLoading ? (
            <Card>
              <CardContent className="py-12 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9]" />
              </CardContent>
            </Card>
          ) : policies.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Icon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Policies Added</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Start by adding your first {categoryName.toLowerCase()} policy
                </p>
                <Button onClick={handleAddPolicy}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Policy
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="contents">
              {/* Retirement Summary Cards removed as per user request */}
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {showArchived ? 'Archived Policies' : 'Active Policies'} ({policies.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    {renderPolicyTables()}
                </CardContent>
              </Card>
            </div>
          )}

          {/* FNA Card - Only show for draft FNAs (published FNAs are in "Previous FNAs" modal) */}
          {hasFNA && fnaManagement.fna && fnaConfig && fnaManagement.fna.status !== 'published' && (
            <FNACard
              fna={fnaManagement.fna}
              config={fnaConfig}
              onEdit={fnaManagement.handleEditFNA}
              onDelete={() => fnaManagement.setDeleteDialogOpen(true)}
              onPublish={() => fnaManagement.setPublishDialogOpen(true)}
              onView={() => {
                if (fnaManagement.fna) {
                  setSelectedHistoricalFnaId(fnaManagement.fna.id);
                  setViewFNADialogOpen(true);
                }
              }}
            />
          )}

          {/* Estate Documents Section — ad-hoc legal document uploads for estate planning */}
          {categorySubtabId === 'estate-planning' && (
            <div className="mt-8">
              <EstateDocumentsSection
                clientId={clientId}
                clientName={clientDisplayName || categoryName}
              />
            </div>
          )}

          {/* Tax Documents Section — ad-hoc tax document uploads for tax planning */}
          {categorySubtabId === 'tax-planning' && (
            <div className="mt-8">
              <TaxDocumentsSection
                clientId={clientId}
                clientName={clientDisplayName || categoryName}
              />
            </div>
          )}
        </div>
      )}
      </Suspense>
      
      {/* Goal Dashboard Dialog */}
      <Dialog open={isGoalDashboardOpen} onOpenChange={setIsGoalDashboardOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gray-50">
           <DialogHeader>
              <DialogTitle>Investment Goals</DialogTitle>
           </DialogHeader>
           <Suspense fallback={<div>Loading...</div>}>
              <GoalDashboard 
                clientId={clientId} 
                policies={policies}
                onGoalsUpdate={setGoals} 
                schemas={subCategorySchemas}
                mainSchema={tableStructure}
              />
           </Suspense>
        </DialogContent>
      </Dialog>
      
      {/* Policy Form Dialog */}
      <PolicyFormDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingPolicy(null);
        }}
        categorySubtabId={categorySubtabId}
        categoryName={categoryName}
        clientId={clientId}
        editingPolicy={editingPolicy}
        onSave={() => {
          loadPolicies();
        }}
      />

      {/* Archive Policy Dialog */}
      <ArchivePolicyDialog
        isOpen={!!archivingPolicy}
        onClose={() => setArchivingPolicy(null)}
        onArchive={handleArchivePolicy}
        isArchiving={isArchiving}
        policy={archivingPolicy}
      />

      {/* Delete Policy Confirmation Dialog */}
      <AlertDialog
        open={!!deletingPolicy}
        onOpenChange={(open) => !open && setDeletingPolicy(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this policy? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePolicy}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </div>
              ) : (
                'Delete Policy'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FNA Wizard - Unified for all FNA types */}
      {hasFNA && fnaConfig && (
        <Suspense fallback={null}>
          <fnaConfig.Wizard {...getWizardProps()} />
        </Suspense>
      )}

      {/* Delete FNA Confirmation Dialog - Unified for all FNA types */}
      {hasFNA && fnaConfig && (
        <AlertDialog
          open={fnaManagement.deleteDialogOpen}
          onOpenChange={fnaManagement.setDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {fnaConfig.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this {fnaConfig.name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={fnaManagement.deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={fnaManagement.handleDeleteFNA}
                disabled={fnaManagement.deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {fnaManagement.deleting ? (
                  <div className="contents">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </div>
                ) : (
                  'Delete FNA'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Publish FNA Dialog - Unified for all FNA types */}
      {hasFNA && fnaConfig && fnaManagement.fna && (
        <PublishFNADialog
          open={fnaManagement.publishDialogOpen}
          onOpenChange={fnaManagement.setPublishDialogOpen}
          fnaType={fnaConfig.type}
          fnaTypeName={fnaConfig.name}
          fnaData={fnaManagement.fna}
          currentStatus={fnaManagement.fna.status || 'draft'}
          onPublishSuccess={() => fnaManagement.loadFNA()}
          publishFunction={fnaManagement.handlePublishFNA}
          unpublishFunction={fnaManagement.handleUnpublishFNA}
        />
      )}

      {/* Previous FNAs Dialog - Unified for all FNA types (lazy chunk requires Suspense) */}
      {hasFNA && fnaConfig && (
        <Suspense fallback={null}>
          <PreviousFNAsDialog
            open={previousFNAsDialogOpen}
            onOpenChange={setPreviousFNAsDialogOpen}
            clientId={clientId}
            title={`Previous ${fnaListTitle}`}
            apiUrl={fnaListApiUrl}
            onViewFNA={(fnaId: string) => {
              setSelectedHistoricalFnaId(fnaId);
              setViewFNADialogOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* View Historical FNA Dialog */}
      {hasFNA && fnaConfig && selectedHistoricalFnaId && (
        <ViewPublishedFNADialog
          open={viewFNADialogOpen && !!selectedHistoricalFnaId}
          onOpenChange={(open) => {
            setViewFNADialogOpen(open);
            if (!open) {
              setSelectedHistoricalFnaId(undefined);
            }
          }}
          fnaType={fnaConfig.type}
          fnaTypeName={fnaConfig.name}
          fnaId={selectedHistoricalFnaId}
          ResultsView={fnaConfig.ResultsView}
          apiBaseUrl={fnaApiBaseUrl}
          deleteFn={fnaConfig.deleteFNA}
          onDeleted={() => {
            // Refresh the FNA management view
            setRefreshFNAManagementTrigger(prev => prev + 1);
            // Reload the current FNA
            fnaManagement.loadFNA();
          }}
        />
      )}

      {/* Will Drafting Wizard — only mount when open to avoid two Radix Dialog
          instances coexisting (their focus-scope can interfere with each other) */}
      {categorySubtabId === 'estate-planning' && willDraftingWizardOpen && (
        <Suspense fallback={null}>
          <WillDraftingWizard
            open={willDraftingWizardOpen}
            onClose={() => {
              setWillDraftingWizardOpen(false);
              setResumeDraftWillId(undefined);
            }}
            clientId={clientId}
            clientName={categoryName}
            willType="last_will"
            existingWillId={resumeDraftWillType === 'last_will' ? resumeDraftWillId : undefined}
            onComplete={() => {
              setWillDraftingWizardOpen(false);
              setResumeDraftWillId(undefined);
              // Refresh the will management list
              setShowWillManagement(false);
              setTimeout(() => setShowWillManagement(true), 100);
            }}
          />
        </Suspense>
      )}
      {categorySubtabId === 'estate-planning' && livingWillDraftingWizardOpen && (
        <Suspense fallback={null}>
          <WillDraftingWizard
            open={livingWillDraftingWizardOpen}
            onClose={() => {
              setLivingWillDraftingWizardOpen(false);
              setResumeDraftWillId(undefined);
            }}
            clientId={clientId}
            clientName={categoryName}
            willType="living_will"
            existingWillId={resumeDraftWillType === 'living_will' ? resumeDraftWillId : undefined}
            onComplete={() => {
              setLivingWillDraftingWizardOpen(false);
              setResumeDraftWillId(undefined);
              // Refresh the will management list
              setShowWillManagement(false);
              setTimeout(() => setShowWillManagement(true), 100);
            }}
          />
        </Suspense>
      )}

      {/* Will PDF View — rendered when user clicks "View Will" from Will Management */}
      {categorySubtabId === 'estate-planning' && selectedWillId && (
        <Suspense fallback={null}>
          <WillPdfView
            open={willPdfViewOpen}
            onClose={() => {
              setWillPdfViewOpen(false);
              setSelectedWillId(undefined);
            }}
            clientName={categoryName}
            willId={selectedWillId}
          />
        </Suspense>
      )}
    </div>
  );
}