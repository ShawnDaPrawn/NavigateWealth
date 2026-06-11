import {
  IntegrationFieldBinding,
  IntegrationProvider,
  IntegrationSyncRun,
  PortalCredentialStatus,
  PortalDiscoveryReport,
  PortalFlowField,
  PortalJobHistoryEntry,
  PortalJobPolicyItem,
  PortalJobRunMode,
  PortalProviderFlow,
  PortalSyncJob,
} from '../types';
import { isActivePortalJob } from './portal-automation/portalHelpers';
import { PortalConfigCard } from './portal-automation/PortalConfigCard';
import { PortalJobCard } from './portal-automation/PortalJobCard';
import { PortalJobHistoryCard } from './portal-automation/PortalJobHistoryCard';

interface PortalAutomationTabProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
  flow?: PortalProviderFlow;
  job?: PortalSyncJob | null;
  stagedRun?: IntegrationSyncRun | null;
  jobItems: PortalJobPolicyItem[];
  jobHistory: PortalJobHistoryEntry[];
  discoveryReport?: PortalDiscoveryReport | null;
  isLoadingFlow: boolean;
  isLoadingDiscoveryReport: boolean;
  isLoadingJobItems: boolean;
  isLoadingJobHistory: boolean;
  isCreatingJob: boolean;
  credentialStatus?: PortalCredentialStatus;
  mappingBindings: IntegrationFieldBinding[];
  selectedCredentialProfileId: string;
  isSubmittingOtp: boolean;
  isRefreshingJob: boolean;
  onCreateJob: (credentialProfileId: string, runMode: PortalJobRunMode, options?: Pick<PortalProviderFlow, 'policySchedule' | 'documentArtifacts'>) => void;
  onSubmitOtp: (otp: string) => void;
  onRefreshJob: () => void;
  onRetryItem: (item: PortalJobPolicyItem) => void;
  onApplyFlow: (patch: { policyRowSelector?: string; fields: PortalFlowField[] }) => void;
  onOpenUploadTab: () => void;
  onOpenSetupTab: () => void;
  isApplyingFlow: boolean;
  fieldSelectors: PortalFlowField[];
  updateFieldSelector: (index: number, selector: string) => void;
  buildProviderFallbackFields: () => PortalFlowField[];
}

export function PortalAutomationTab({
  provider,
  selectedCategoryId,
  flow,
  job,
  stagedRun,
  jobItems,
  jobHistory,
  discoveryReport,
  isLoadingFlow,
  isLoadingDiscoveryReport,
  isLoadingJobItems,
  isLoadingJobHistory,
  isCreatingJob,
  credentialStatus,
  mappingBindings,
  selectedCredentialProfileId,
  isSubmittingOtp,
  isRefreshingJob,
  onCreateJob,
  onSubmitOtp,
  onRefreshJob,
  onRetryItem,
  onApplyFlow,
  onOpenUploadTab,
  onOpenSetupTab,
  isApplyingFlow,
  fieldSelectors,
  updateFieldSelector,
  buildProviderFallbackFields,
}: PortalAutomationTabProps) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PortalConfigCard
        provider={provider}
        selectedCategoryId={selectedCategoryId}
        flow={flow}
        job={job}
        isLoadingFlow={isLoadingFlow}
        isCreatingJob={isCreatingJob}
        credentialStatus={credentialStatus}
        mappingBindings={mappingBindings}
        selectedCredentialProfileId={selectedCredentialProfileId}
        isRefreshingJob={isRefreshingJob}
        onCreateJob={onCreateJob}
        onRefreshJob={onRefreshJob}
        onOpenSetupTab={onOpenSetupTab}
        fieldSelectors={fieldSelectors}
      />
      {job && (
        <PortalJobCard
          job={job}
          variant={isActivePortalJob(job) ? 'active' : 'latest'}
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
      <PortalJobHistoryCard
        history={jobHistory}
        isLoading={isLoadingJobHistory}
        excludeJobId={job?.id || null}
      />
    </div>
  );
}
