/**
 * POLICY CATEGORY TAB COMPONENT (REFACTORED)
 * Displays and manages policies for a specific category with dynamic forms
 */

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Plus, Loader2, FileBarChart, EyeOff, History, Target, Calculator } from 'lucide-react';
import { PolicyFormDialog } from './PolicyFormDialog';
import { ErrorState, usePageTakeover } from '../layout/page';
import { ArchivePolicyDialog } from './ArchivePolicyDialog';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../utils/api';
import { invalidateClientPolicies } from '../../../shared/api/clientPolicies';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { getFNAConfig, hasFNASupport } from './fna-config';
import { useFNAManagement } from '../modules/fna';
import { useInvalidateFnaBatchStatus } from '@/shared/fna-intake/hooks/useFnaBatchStatus';
import { FNACard, PublishFNADialog, ViewPublishedFNADialog } from '../modules/fna';
import { isPortalAutomationCategoryId } from '@/shared/integrations/portal-categories';
import type { PolicyRecord, SchemaField, LinkedGoalStatus } from './PolicyTable';

import { renderPolicyTables as renderPolicyTablesView } from './policyTables';

// The goal dashboard is a heavy tree opened from a dialog, so it stays lazy.
const GoalDashboard = React.lazy(() =>
  import('./goals/GoalDashboard').then((m) => ({ default: m.GoalDashboard })),
);

import { calculateGoalStatus } from '../../../shared/goals';
import type { Goal } from '../../../shared/goals';
import { FNAManagementView as FNAManagementView } from '../modules/risk-planning-fna';
import { WillManagementView as WillManagementView } from '../modules/estate-planning-fna';
import { WillDraftingWizard as WillDraftingWizard } from '../modules/estate-planning-fna';
import { WillPdfView as WillPdfView } from '../modules/estate-planning-fna';
import { WillChatInterface as WillChatInterface } from '../modules/estate-planning-fna';
import { EstateDocumentsSection as EstateDocumentsSection } from '../modules/estate-planning-fna';
import { TaxDocumentsSection as TaxDocumentsSection } from '../modules/tax-planning-fna';

interface PolicyCategoryTabProps {
  categorySubtabId: string; // e.g., 'risk-planning'
  categoryName: string; // e.g., 'Risk Planning'
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  description: string;
  clientId: string;
  /** Actual client display name (firstName + lastName) — used for will chat, PDF titles, etc. */
  clientDisplayName?: string;
  /** Open on this category's FNA list (where a publish lands the adviser). */
  openFNAListOnMount?: boolean;
  /** Highlight this FNA in the list — the one just published. */
  highlightFnaId?: string;
}

export function PolicyCategoryTab({
  categorySubtabId,
  categoryName,
  icon: Icon,
  iconColor,
  description,
  clientId,
  clientDisplayName,
  openFNAListOnMount = false,
  highlightFnaId,
}: PolicyCategoryTabProps) {
  const queryClient = useQueryClient();
  // Policy State
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyRecord | null>(null);
  const [deletingPolicy, setDeletingPolicy] = useState<PolicyRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshingPolicyId, setRefreshingPolicyId] = useState<string | null>(null);
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
  const [selectedHistoricalFnaId, setSelectedHistoricalFnaId] = useState<string | undefined>(
    undefined,
  );
  const [showFNAManagement, setShowFNAManagement] = useState(openFNAListOnMount);
  const [refreshFNAManagementTrigger, setRefreshFNAManagementTrigger] = useState(0);
  const [highlightedFnaId, setHighlightedFnaId] = useState(highlightFnaId);
  const invalidateFnaBatchStatus = useInvalidateFnaBatchStatus();

  // Will Management State (for Estate Planning)
  const [showWillManagement, setShowWillManagement] = useState(false);
  const [selectedWillId, setSelectedWillId] = useState<string | undefined>(undefined);
  const [willDraftingWizardOpen, setWillDraftingWizardOpen] = useState(false);
  const [livingWillDraftingWizardOpen, setLivingWillDraftingWizardOpen] = useState(false);
  const [willPdfViewOpen, setWillPdfViewOpen] = useState(false);
  const [willChatInterfaceOpen, setWillChatInterfaceOpen] = useState(false);
  // Resume Draft state
  const [resumeDraftWillId, setResumeDraftWillId] = useState<string | undefined>(undefined);
  const [resumeDraftWillType, setResumeDraftWillType] = useState<'last_will' | 'living_will'>(
    'last_will',
  );

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
    retirement: 'retirement_planning',
    investments: 'investments',
    'employee-benefits': 'employee_benefits',
    'tax-planning': 'tax_planning',
    'estate-planning': 'estate_planning',
  };

  const categoryId = categoryIdMap[categorySubtabId];

  const fnaListTitle = `${categoryName} FNAs`;

  // A publish lands on this category's FNA list with the new FNA highlighted.
  const handleFNAPublished = (fnaId: string) => {
    fnaManagement.handleFNAComplete(fnaId);
    invalidateFnaBatchStatus(clientId);
    setHighlightedFnaId(fnaId);
    setShowWillManagement(false);
    setShowFNAManagement(true);
    setRefreshFNAManagementTrigger((prev) => prev + 1);
  };

  const loadTableStructure = useCallback(async () => {
    // Helper to fetch schema for a specific category with retry for cold-start resilience
    const fetchSchemaForCategory = async (catId: string, retries = 2): Promise<SchemaField[]> => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const data = await api.get<{ fields?: SchemaField[] } | SchemaField[]>(
            `/integrations/schemas?categoryId=${catId}`,
          );
          if (data && !Array.isArray(data) && data.fields) return data.fields;
          if (Array.isArray(data)) return data;
          break;
        } catch (err) {
          // Retry on transient network errors (cold-start / Failed to fetch)
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
            continue;
          }
          console.warn(`Error loading schema for ${catId} after ${retries + 1} attempts:`, err);
        }
      }
      // Final fallback to client-side defaults
      return (DEFAULT_SCHEMAS[catId]?.fields || []) as unknown as SchemaField[];
    };

    // Load main structure
    const mainFields = await fetchSchemaForCategory(categoryId);
    setTableStructure(mainFields);

    // Load sub-structures for composite categories in parallel
    if (categoryId === 'retirement_planning') {
      const [preFields, postFields, fixedFields] = await Promise.all([
        fetchSchemaForCategory('retirement_pre'),
        fetchSchemaForCategory('retirement_post'),
        fetchSchemaForCategory('retirement_post_fixed'),
      ]);
      setSubCategorySchemas({
        retirement_pre: preFields,
        retirement_post: postFields,
        retirement_post_fixed: fixedFields,
      });
    } else if (categoryId === 'investments') {
      const [volFields, guaFields] = await Promise.all([
        fetchSchemaForCategory('investments_voluntary'),
        fetchSchemaForCategory('investments_guaranteed'),
      ]);
      setSubCategorySchemas({
        investments_voluntary: volFields,
        investments_guaranteed: guaFields,
      });
    } else if (categoryId === 'employee_benefits') {
      const [riskFields, retFields] = await Promise.all([
        fetchSchemaForCategory('employee_benefits_risk'),
        fetchSchemaForCategory('employee_benefits_retirement'),
      ]);
      setSubCategorySchemas({
        employee_benefits_risk: riskFields,
        employee_benefits_retirement: retFields,
      });
    } else {
      setSubCategorySchemas({});
    }
  }, [categoryId]);

  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const loadPolicies = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<{ policies?: PolicyRecord[] }>(
        `/integrations/policies?clientId=${clientId}&categoryId=${categoryId}&includeArchived=${showArchived}`,
      );
      setPolicies(data.policies || []);
      setPoliciesError(null);
    } catch (err) {
      console.error('Error loading policies:', err);
      // An error state in place of the table, not "No policies added".
      setPoliciesError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [clientId, categoryId, showArchived]);

  useEffect(() => {
    loadPolicies();
    loadTableStructure();
  }, [categoryId, clientId, showArchived, loadPolicies, loadTableStructure]);

  // Update Linked Goals Map when policies or goals change
  useEffect(() => {
    if (categorySubtabId === 'investments' && goals.length > 0 && policies.length > 0) {
      const map: Record<string, LinkedGoalStatus> = {};

      policies.forEach((policy) => {
        // Find if policy is linked to any goal
        const linkedGoal = goals.find((g) => g.linkedInvestmentIds?.includes(policy.id));

        if (linkedGoal) {
          const calc = calculateGoalStatus(linkedGoal, policies);
          map[policy.id] = {
            name: linkedGoal.name,
            status: calc.status,
            targetAmount: linkedGoal.targetAmount,
            requiredMonthly: calc.requiredMonthlyContribution,
            targetDate: linkedGoal.targetDate,
          };
        }
      });

      setLinkedGoalsMap(map);
    } else {
      setLinkedGoalsMap({});
    }
  }, [goals, policies, categorySubtabId]);

  const handleAddPolicy = () => {
    setEditingPolicy(null);
    setIsFormOpen(true);
  };

  // Assumptions (design: category header): project a policy's maturity value.
  // The tool lives on the policy form, so the button opens that policy's form
  // with the tool open — after asking which policy when there are several.
  const supportsAssumptions =
    categorySubtabId === 'retirement' || categorySubtabId === 'investments';
  const activePolicies = showArchived ? [] : policies.filter((p) => !p.archived);
  const [assumptionsPickerOpen, setAssumptionsPickerOpen] = useState(false);
  const [openAssumptions, setOpenAssumptions] = useState(false);
  const openPolicyAssumptions = (policy: PolicyRecord) => {
    setAssumptionsPickerOpen(false);
    setEditingPolicy(policy);
    setOpenAssumptions(true);
    setIsFormOpen(true);
  };
  const handleAssumptions = () => {
    if (activePolicies.length === 1) openPolicyAssumptions(activePolicies[0]);
    else setAssumptionsPickerOpen(true);
  };

  const handleEditPolicy = (policy: Record<string, unknown>) => {
    // onEdit hands back a loose record; it is in fact a PolicyRecord row.
    setEditingPolicy(policy as unknown as PolicyRecord);
    setIsFormOpen(true);
  };

  const handleDeletePolicy = async () => {
    if (!deletingPolicy) return;

    setIsDeleting(true);
    const toastId = toast.loading('Deleting policy...');

    try {
      await api.delete(`/integrations/policies?id=${deletingPolicy.id}&clientId=${clientId}`);

      toast.success('Policy deleted successfully', { id: toastId });
      setDeletingPolicy(null);
      loadPolicies();
      void invalidateClientPolicies(queryClient, clientId);
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
      await api.post('/integrations/policies/archive', {
        id: archivingPolicy.id,
        clientId,
        reason,
      });

      toast.success('Policy archived successfully', { id: toastId });
      setArchivingPolicy(null);
      loadPolicies();
      void invalidateClientPolicies(queryClient, clientId);
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
      await api.post('/integrations/policies/reinstate', {
        id: policy.id,
        clientId,
      });

      toast.success('Policy reinstated successfully', { id: toastId });
      loadPolicies();
      void invalidateClientPolicies(queryClient, clientId);
    } catch (err: unknown) {
      console.error('Error reinstating policy:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to reinstate policy');
    }
  };

  /**
   * Refresh ONE policy's values from the provider portal.
   *
   * Before this, the smallest unit of portal work was every policy the provider
   * has in this category, which is why the module read as a batch tool rather
   * than something you use on a client record. The job is scoped by policy id;
   * the queued run still stages into the same review step, so nothing is written
   * to the policy without review.
   */
  /**
   * Portal automation only runs for specific product subcategories. Legacy
   * records still carry the parent category ('retirement_planning',
   * 'investments') while being displayed in a child table, and the server
   * rejects those outright — so offering them the control would only ever
   * produce an error.
   */
  const canRefreshPolicy = (policy: PolicyRecord) =>
    Boolean((policy as Record<string, unknown>).providerId) &&
    isPortalAutomationCategoryId(String(policy.categoryId || ''));

  const handleRefreshPolicy = async (policy: PolicyRecord) => {
    const providerId = String((policy as Record<string, unknown>).providerId || '');
    const policyCategoryId = String(policy.categoryId || categoryId || '');

    if (!providerId) {
      toast.error('This policy has no provider linked, so it cannot be refreshed from a portal.');
      return;
    }

    setRefreshingPolicyId(policy.id);
    const toastId = toast.loading('Queueing a portal refresh for this policy...');
    try {
      await api.post('/integrations/portal-jobs', {
        providerId,
        categoryId: policyCategoryId,
        runMode: 'run',
        policyIds: [policy.id],
      });
      toast.success(
        'Portal refresh queued. The updated value appears in Review once the run finishes.',
        { id: toastId },
      );
    } catch (err: unknown) {
      console.error('Error queueing policy refresh:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to queue the portal refresh', {
        id: toastId,
      });
    } finally {
      setRefreshingPolicyId(null);
    }
  };

  // Helper to determine if we should split tables
  const renderPolicyTables = () =>
    renderPolicyTablesView({
      categoryId,
      categoryName,
      clientId,
      policies,
      tableStructure,
      subCategorySchemas,
      linkedGoalsMap,
      handleEditPolicy,
      handleReinstatePolicy,
      setArchivingPolicy,
      setDeletingPolicy,
      handleRefreshPolicy,
      canRefreshPolicy,
      refreshingPolicyId,
    });

  // FNA wizards, the FNA report and the will wizards are pages of their own:
  // while one is open it takes the place of the category's content.
  const fnaPageOpen =
    (hasFNA && !!fnaConfig && fnaManagement.wizardOpen) ||
    (hasFNA && !!fnaConfig && !!selectedHistoricalFnaId && viewFNADialogOpen) ||
    (categorySubtabId === 'estate-planning' &&
      (willDraftingWizardOpen ||
        livingWillDraftingWizardOpen ||
        (willPdfViewOpen && !!selectedWillId)));
  // These pages take the whole client page (no client header, tabs or rails);
  // the AI will builder does too. The add / edit policy page only hides the rail.
  usePageTakeover(
    fnaPageOpen || (categorySubtabId === 'estate-planning' && willChatInterfaceOpen),
    'page',
  );
  usePageTakeover(isFormOpen, 'section');

  return (
    <div className="space-y-4">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9]" />
          </div>
        }
      >
        {/* Add / edit policy is a page in place of the category */}
        {isFormOpen ? (
          <PolicyFormDialog
            isOpen
            onClose={() => {
              setIsFormOpen(false);
              setEditingPolicy(null);
              setOpenAssumptions(false);
            }}
            openAssumptions={openAssumptions}
            categorySubtabId={categorySubtabId}
            categoryName={categoryName}
            clientId={clientId}
            editingPolicy={
              editingPolicy as unknown as React.ComponentProps<
                typeof PolicyFormDialog
              >['editingPolicy']
            }
            onSave={() => {
              loadPolicies();
            }}
          />
        ) : fnaPageOpen ? null /* Show Will Management View for Estate Planning */ : categorySubtabId ===
            'estate-planning' && willChatInterfaceOpen ? (
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
            clientName={clientDisplayName || categoryName}
            title={fnaListTitle}
            fnaName={fnaConfig.name}
            loadFNAs={() => fnaConfig.listForClient(clientId)}
            highlightFnaId={highlightedFnaId}
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
                {supportsAssumptions && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAssumptions}
                    disabled={activePolicies.length === 0}
                    title={
                      activePolicies.length === 0
                        ? 'Add a policy first; assumptions project a policy’s value.'
                        : 'Project a policy’s maturity value from growth and escalation assumptions'
                    }
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Assumptions
                  </Button>
                )}
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
                {categorySubtabId === 'estate-planning' && (
                  <Button variant="outline" size="sm" onClick={() => setShowWillManagement(true)}>
                    <FileBarChart className="h-4 w-4 mr-2" />
                    Will management
                  </Button>
                )}
                {hasFNA && (
                  <Button variant="outline" size="sm" onClick={() => setShowFNAManagement(true)}>
                    <FileBarChart className="h-4 w-4 mr-2" />
                    All FNAs
                  </Button>
                )}
                <Button
                  variant={showArchived ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                  className={
                    showArchived
                      ? 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200'
                      : ''
                  }
                >
                  {showArchived ? (
                    <div className="contents">
                      <EyeOff className="h-4 w-4 mr-2" />
                      Hide history
                    </div>
                  ) : (
                    <div className="contents">
                      <History className="h-4 w-4 mr-2" />
                      History
                    </div>
                  )}
                </Button>
                <Button size="sm" onClick={handleAddPolicy}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add policy
                </Button>
              </div>
            </div>

            {/* Policies List */}
            {/* Goal Dashboard moved to Dialog */}

            {policiesError && !isLoading ? (
              <ErrorState
                title="Couldn't load policies"
                description={`This client's ${categoryName.toLowerCase()} policies could not be loaded.`}
                onRetry={() => void loadPolicies()}
                details={policiesError}
              />
            ) : isLoading ? (
              <Card>
                <CardContent className="py-12 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9]" />
                </CardContent>
              </Card>
            ) : policies.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Icon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No policies added</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Add the client&apos;s {categoryName.toLowerCase()} policies to track cover,
                    values and premiums.
                  </p>
                  <Button onClick={handleAddPolicy}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add policy
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="contents">
                {/* Retirement Summary Cards removed as per user request */}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {showArchived ? 'Archived policies' : 'Active policies'} ({policies.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>{renderPolicyTables()}</CardContent>
                </Card>
              </div>
            )}

            {/* FNA Card - Only show for draft FNAs (published FNAs are in the FNA list) */}
            {hasFNA &&
              fnaManagement.fna &&
              fnaConfig &&
              fnaManagement.fna.status !== 'published' && (
                <FNACard
                  fna={fnaManagement.fna}
                  config={fnaConfig}
                  onEdit={fnaManagement.handleEditFNA}
                  onDelete={() => fnaManagement.setDeleteDialogOpen(true)}
                  onPublish={() => fnaManagement.setPublishDialogOpen(true)}
                  onView={() => {
                    if (fnaManagement.fna) {
                      setSelectedHistoricalFnaId(fnaManagement.fna.id as string);
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

      {/* Assumptions: which policy to project */}
      <Dialog open={assumptionsPickerOpen} onOpenChange={setAssumptionsPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assumptions</DialogTitle>
            <DialogDescription>
              Choose the policy whose maturity value you want to project.
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-gray-100 rounded-lg border">
            {activePolicies.map((policy, i) => (
              <li key={policy.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
                  onClick={() => openPolicyAssumptions(policy)}
                >
                  <span className="font-medium text-nw-ink">
                    {String(policy.providerName ?? `Policy ${i + 1}`)}
                  </span>
                  {typeof policy.categoryId === 'string' && (
                    <span className="ml-2 text-xs text-nw-text-3">{policy.categoryId}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

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
              schemas={
                subCategorySchemas as unknown as React.ComponentProps<
                  typeof GoalDashboard
                >['schemas']
              }
              mainSchema={
                tableStructure as unknown as React.ComponentProps<
                  typeof GoalDashboard
                >['mainSchema']
              }
            />
          </Suspense>
        </DialogContent>
      </Dialog>

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

      {/* FNA Wizard - Unified for all FNA types. Mounted per opening so every
          session starts on Step 1 with fresh state, like the intake hand-off. */}
      {hasFNA && fnaConfig && fnaManagement.wizardOpen && (
        <Suspense fallback={null}>
          <fnaConfig.Wizard
            open={fnaManagement.wizardOpen}
            onClose={() => fnaManagement.setWizardOpen(false)}
            clientId={clientId}
            clientName={clientDisplayName || undefined}
            onFNAComplete={handleFNAPublished}
          />
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
          currentStatus={
            (fnaManagement.fna.status || 'draft') as 'draft' | 'published' | 'archived'
          }
          onPublishSuccess={() => fnaManagement.loadFNA()}
          publishFunction={fnaManagement.handlePublishFNA}
          unpublishFunction={fnaManagement.handleUnpublishFNA}
        />
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
          loadFn={(fnaId) => fnaConfig.getById(fnaId, clientId)}
          deleteFn={(fnaId) => fnaConfig.deleteFNA(fnaId, clientId)}
          unpublishFn={(fnaId) => fnaConfig.unpublishFNA(fnaId, clientId)}
          onUnpublished={() => {
            setRefreshFNAManagementTrigger((prev) => prev + 1);
            fnaManagement.loadFNA();
          }}
          backLabel={fnaListTitle}
          onDeleted={() => {
            // Refresh the FNA management view
            setRefreshFNAManagementTrigger((prev) => prev + 1);
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
            clientName={clientDisplayName || categoryName}
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
            clientName={clientDisplayName || categoryName}
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
