/**
 * Policy tables of the policy category tab: the per-policy card grid with
 * field values, status badges, and row actions. A plain JSX-returning
 * function called through a thin adapter in PolicyCategoryTab, so no new
 * component boundary appears in the tree.
 */
/**
 * POLICY CATEGORY TAB COMPONENT (REFACTORED)
 * Displays and manages policies for a specific category with dynamic forms
 */

import { PolicyTable } from './PolicyTable';
import type { PolicyRecord, SchemaField, LinkedGoalStatus } from './PolicyTable';
import type { Dispatch, SetStateAction } from 'react';

export const formatFieldValue = (
  field: { type?: string; options?: string[]; [key: string]: unknown },
  value: unknown,
): React.ReactNode => {
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

// Prepare wizard props dynamically based on config

interface RenderPolicyTablesArgs {
  categoryId: string;
  categoryName: string;
  clientId: string;
  policies: PolicyRecord[];
  tableStructure: SchemaField[];
  subCategorySchemas: Record<string, SchemaField[]>;
  linkedGoalsMap: Record<string, LinkedGoalStatus>;
  handleEditPolicy: (policy: Record<string, unknown>) => void;
  handleReinstatePolicy: (policy: Record<string, unknown>) => void;
  setArchivingPolicy: Dispatch<SetStateAction<PolicyRecord | null>>;
  setDeletingPolicy: Dispatch<SetStateAction<PolicyRecord | null>>;
}

export function renderPolicyTables({
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
}: RenderPolicyTablesArgs) {
  if (categoryId === 'retirement_planning') {
    const prePolicies = policies.filter(
      (p) => p.categoryId === 'retirement_pre' || p.categoryId === 'retirement_planning',
    );
    const postPolicies = policies.filter((p) => p.categoryId === 'retirement_post');

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

        {!hasPre &&
          !hasPost &&
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
          )}
      </div>
    );
  }

  if (categoryId === 'investments') {
    const volPolicies = policies.filter(
      (p) => p.categoryId === 'investments_voluntary' || p.categoryId === 'investments',
    );
    const guaPolicies = policies.filter((p) => p.categoryId === 'investments_guaranteed');

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
    const riskPoliciesOnly = policies.filter((p) => p.categoryId === 'employee_benefits_risk');
    const retPoliciesOnly = policies.filter((p) => p.categoryId === 'employee_benefits_retirement');
    const genericPolicies = policies.filter((p) => p.categoryId === 'employee_benefits');

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
}
