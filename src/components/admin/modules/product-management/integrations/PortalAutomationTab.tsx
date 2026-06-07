import { useCallback, useEffect, useState } from 'react';
import {
  IntegrationFieldBinding,
  IntegrationProvider,
  IntegrationSyncRun,
  PortalBrainMemorySummary,
  PortalCredentialStatus,
  PortalDiscoveryReport,
  PortalFlowField,
  PortalJobPolicyItem,
  PortalJobRunMode,
  PortalProviderFlow,
  PortalSyncJob,
} from '../types';
import { buildPortalFieldsFromBindings } from '@/shared/integrations/binding-utils';
import { getPortalFieldKey, getPortalFieldColumnName, getBindingKey } from './portal-automation/portalHelpers';
import { PortalConfigCard } from './portal-automation/PortalConfigCard';
import { PortalJobCard } from './portal-automation/PortalJobCard';

interface PortalAutomationTabProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
  flow?: PortalProviderFlow;
  job?: PortalSyncJob | null;
  stagedRun?: IntegrationSyncRun | null;
  jobItems: PortalJobPolicyItem[];
  discoveryReport?: PortalDiscoveryReport | null;
  brainMemory?: PortalBrainMemorySummary;
  isLoadingFlow: boolean;
  isLoadingDiscoveryReport: boolean;
  isLoadingJobItems: boolean;
  isCreatingJob: boolean;
  credentialStatus?: PortalCredentialStatus;
  mappingBindings: IntegrationFieldBinding[];
  selectedCredentialProfileId: string;
  onCredentialProfileChange: (profileId: string) => void;
  isSavingCredentials: boolean;
  isSavingFlow: boolean;
  isResettingFlow: boolean;
  isSubmittingOtp: boolean;
  isRefreshingJob: boolean;
  onCreateJob: (credentialProfileId: string, runMode: PortalJobRunMode, options?: Pick<PortalProviderFlow, 'policySchedule' | 'documentArtifacts'>) => void;
  onSaveCredentials: (profileId: string, credentials: { username: string; password?: string }) => void;
  onSaveFlow: (flow: PortalProviderFlow) => void;
  onResetFlow: () => void;
  onSubmitOtp: (otp: string) => void;
  onRefreshJob: () => void;
  onRetryItem: (item: PortalJobPolicyItem) => void;
  onApplyFlow: (patch: { policyRowSelector?: string; fields: PortalFlowField[] }) => void;
  onOpenUploadTab: () => void;
  onOpenMappingTab: () => void;
  isApplyingFlow: boolean;
}

export function PortalAutomationTab({
  provider,
  selectedCategoryId,
  flow,
  job,
  stagedRun,
  jobItems,
  discoveryReport,
  brainMemory,
  isLoadingFlow,
  isLoadingDiscoveryReport,
  isLoadingJobItems,
  isCreatingJob,
  credentialStatus,
  mappingBindings,
  selectedCredentialProfileId,
  onCredentialProfileChange,
  isSavingCredentials,
  isSavingFlow,
  isResettingFlow,
  isSubmittingOtp,
  isRefreshingJob,
  onCreateJob,
  onSaveCredentials,
  onSaveFlow,
  onResetFlow,
  onSubmitOtp,
  onRefreshJob,
  onRetryItem,
  onApplyFlow,
  onOpenUploadTab,
  onOpenMappingTab,
  isApplyingFlow,
}: PortalAutomationTabProps) {
  const [fieldSelectors, setFieldSelectors] = useState<PortalFlowField[]>([]);

  useEffect(() => {
    if (mappingBindings.length === 0) return;
    setFieldSelectors((currentFields) => {
      const merged = buildPortalFieldsFromBindings(mappingBindings, currentFields) as PortalFlowField[];
      const unchanged =
        merged.length === currentFields.length &&
        merged.every((field, index) => JSON.stringify(field) === JSON.stringify(currentFields[index]));
      return unchanged ? currentFields : merged;
    });
  }, [mappingBindings]);

  useEffect(() => {
    if (flow?.extraction?.fields?.length) {
      setFieldSelectors((current) => (current.length === 0 ? flow.extraction.fields : current));
    }
  }, [flow]);

  const updateFieldSelector = useCallback((index: number, selector: string) => {
    setFieldSelectors((prev) =>
      prev.map((field, currentIndex) =>
        currentIndex === index ? { ...field, selector } : field,
      ),
    );
  }, []);

  const updateFieldRequired = useCallback((index: number, required: boolean) => {
    setFieldSelectors((prev) =>
      prev.map((field, currentIndex) =>
        currentIndex === index ? { ...field, required } : field,
      ),
    );
  }, []);

  const buildProviderFallbackFields = useCallback((): PortalFlowField[] => {
    const existingByKey = new Map(
      (flow?.extraction?.fields || []).map((field) => [getPortalFieldKey(field), field]),
    );
    const existingByColumn = new Map(
      (flow?.extraction?.fields || []).map((field) => [getPortalFieldColumnName(field), field]),
    );
    const bindingByKey = new Map(
      mappingBindings.map((binding) => [binding.targetFieldId || binding.columnName, binding]),
    );
    const bindingByColumn = new Map(
      mappingBindings.map((binding) => [String(binding.columnName || '').trim(), binding]),
    );

    return fieldSelectors
      .map((field) => {
        const key = getPortalFieldKey(field);
        const columnName = getPortalFieldColumnName(field);
        const existing = existingByKey.get(key) || existingByColumn.get(columnName);
        const binding = bindingByKey.get(key) || bindingByColumn.get(columnName);
        const inheritedSelector = String(binding?.portalSelector || existing?.selector || '').trim();
        const nextSelector =
          field.selector.trim() === inheritedSelector
            ? String(existing?.selector || '').trim()
            : field.selector.trim();
        return {
          sourceHeader: columnName,
          columnName,
          targetFieldId: field.targetFieldId,
          targetFieldName: field.targetFieldName,
          selector: nextSelector,
          labels:
            Array.isArray(existing?.labels) && existing.labels.length > 0 ? existing.labels : [],
          attribute: existing?.attribute || field.attribute || 'text',
          required: field.required === true,
          transform: field.transform || existing?.transform || 'trim',
        };
      })
      .filter((field) => field.columnName);
  }, [fieldSelectors, flow, mappingBindings]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PortalConfigCard
        provider={provider}
        selectedCategoryId={selectedCategoryId}
        flow={flow}
        job={job}
        brainMemory={brainMemory}
        isLoadingFlow={isLoadingFlow}
        isCreatingJob={isCreatingJob}
        credentialStatus={credentialStatus}
        mappingBindings={mappingBindings}
        selectedCredentialProfileId={selectedCredentialProfileId}
        onCredentialProfileChange={onCredentialProfileChange}
        isSavingCredentials={isSavingCredentials}
        isSavingFlow={isSavingFlow}
        isResettingFlow={isResettingFlow}
        isRefreshingJob={isRefreshingJob}
        onCreateJob={onCreateJob}
        onSaveCredentials={onSaveCredentials}
        onSaveFlow={onSaveFlow}
        onResetFlow={onResetFlow}
        onRefreshJob={onRefreshJob}
        onOpenMappingTab={onOpenMappingTab}
        fieldSelectors={fieldSelectors}
        setFieldSelectors={setFieldSelectors}
        updateFieldSelector={updateFieldSelector}
        updateFieldRequired={updateFieldRequired}
        buildProviderFallbackFields={buildProviderFallbackFields}
      />
      {job && (
        <PortalJobCard
          job={job}
          jobItems={jobItems}
          isLoadingJobItems={isLoadingJobItems}
          stagedRun={stagedRun}
          provider={provider}
          selectedCategoryId={selectedCategoryId}
          discoveryReport={discoveryReport}
          isLoadingDiscoveryReport={isLoadingDiscoveryReport}
          isApplyingFlow={isApplyingFlow}
          onApplyFlow={onApplyFlow}
          onRetryItem={onRetryItem}
          onSubmitOtp={onSubmitOtp}
          isSubmittingOtp={isSubmittingOtp}
          onOpenUploadTab={onOpenUploadTab}
          fieldSelectors={fieldSelectors}
          updateFieldSelector={updateFieldSelector}
          buildProviderFallbackFields={buildProviderFallbackFields}
        />
      )}
    </div>
  );
}
