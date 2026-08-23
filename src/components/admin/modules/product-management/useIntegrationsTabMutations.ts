/**
 * The twelve upload/publish/portal/config mutations of the integrations
 * tab, moved verbatim from IntegrationsTab.tsx into one hook. Every name
 * the mutations captured from the component scope arrives as an argument.
 */
import React from 'react';
import { useMutation, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  IntegrationConfig,
  IntegrationFieldBinding,
  IntegrationSyncRun,
  PortalFlowField,
  PortalJobPolicyItem,
  PortalJobRunMode,
  PortalProviderFlow,
  PortalSyncJob,
  PreviewData,
  isPortalAutomationCategory,
} from './types';
import { productManagementApi } from './api';
import { integrationsKeys } from '../../../../utils/queryKeys';
import {
  buildIntegrationBindingsForFields,
  buildLegacyFieldMappingFromBindings,
} from '@/shared/integrations/binding-utils';
import { useProductSchema } from './hooks/useProductSchema';

interface UseIntegrationsTabMutationsArgs {
  queryClient: QueryClient;
  selectedProviderId: string | null;
  selectedCategoryId: string;
  categoryFields: ReturnType<typeof useProductSchema>['currentFields'];
  configBindings: IntegrationFieldBinding[];
  configSettings: {
    autoMap: boolean;
    ignoreUnmatched: boolean;
    strictMode: boolean;
    autoPublish: boolean;
  };
  portalFlow: PortalProviderFlow | undefined;
  rawFile: File | null;
  visiblePortalJobForSelection: PortalSyncJob | null;
  visibleStagedRunForSelection: IntegrationSyncRun | null;
  setUploadedFile: React.Dispatch<
    React.SetStateAction<{ name: string; size: string; uploadedAt: string } | null>
  >;
  setRawFile: React.Dispatch<React.SetStateAction<File | null>>;
  setShowUploadPreview: React.Dispatch<React.SetStateAction<boolean>>;
  setPreviewData: React.Dispatch<React.SetStateAction<PreviewData | null>>;
  setStagedRun: React.Dispatch<React.SetStateAction<IntegrationSyncRun | null>>;
  setPortalJob: React.Dispatch<React.SetStateAction<PortalSyncJob | null>>;
}

export function useIntegrationsTabMutations({
  queryClient,
  selectedProviderId,
  selectedCategoryId,
  categoryFields,
  configBindings,
  configSettings,
  portalFlow,
  rawFile,
  visiblePortalJobForSelection,
  visibleStagedRunForSelection,
  setUploadedFile,
  setRawFile,
  setShowUploadPreview,
  setPreviewData,
  setStagedRun,
  setPortalJob,
}: UseIntegrationsTabMutationsArgs) {
  // Upload/Process File Mutation
  const processFileMutation = useMutation({
    mutationFn: async (params: { mode: 'preview' | 'commit' }) => {
      if (!rawFile || !selectedProviderId || !selectedCategoryId)
        throw new Error('Missing requirements');

      return productManagementApi.uploadIntegrationFile(
        rawFile,
        selectedProviderId,
        selectedCategoryId,
        params.mode,
      );
    },
    onSuccess: (data, variables) => {
      if (variables.mode === 'preview') {
        if (data.success && data.preview) {
          const headers = [...data.preview.mappedColumns, ...data.preview.unmappedColumns];
          setPreviewData({
            headers: headers,
            rows: data.preview.sampleData || [],
            validationErrors: data.preview.validationErrors,
          });
          setShowUploadPreview(true);
          if (data.preview.validationErrors?.length > 0) {
            toast.warning(`Found ${data.preview.validationErrors.length} validation issues.`);
          } else {
            toast.success('File processed successfully.');
          }
        }
      } else {
        // Commit success
        if (data.success && data.result) {
          if (data.result.stagedRun) {
            setStagedRun(data.result.stagedRun);
            setShowUploadPreview(false);
            setPreviewData(null);
            toast.success(
              `Staged ${data.result.stagedRows || data.result.stagedRun.summary.totalRows} rows for review.`,
            );
          } else {
            toast.success(`Successfully imported ${data.result.insertedRows} rows.`);
            setUploadedFile(null);
            setRawFile(null);
            setShowUploadPreview(false);
            setPreviewData(null);
          }

          // Refresh stats
          queryClient.invalidateQueries({
            queryKey: integrationsKeys.history(selectedProviderId, selectedCategoryId),
          });
        }
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Operation failed');
    },
  });

  const publishRunMutation = useMutation({
    mutationFn: async () => {
      if (!visibleStagedRunForSelection) throw new Error('No staged run selected');
      const rowIds = visibleStagedRunForSelection.rows
        .filter(
          (row) =>
            row.matchStatus === 'matched' &&
            row.diffs.length > 0 &&
            row.publishStatus !== 'published' &&
            row.publishStatus !== 'failed' &&
            row.publishStatus !== 'skipped',
        )
        .map((row) => row.id);
      return productManagementApi.publishIntegrationSyncRun(
        visibleStagedRunForSelection.id,
        selectedProviderId!,
        selectedCategoryId,
        rowIds,
      );
    },
    onSuccess: (run) => {
      const newlyPublishedRows = Math.max(
        0,
        run.summary.publishedRows - (visibleStagedRunForSelection?.summary.publishedRows || 0),
      );
      setStagedRun(run);
      toast.success(
        `Published ${newlyPublishedRows} policy row${newlyPublishedRows === 1 ? '' : 's'}.`,
      );
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.history(selectedProviderId, selectedCategoryId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to publish staged rows');
    },
  });

  const downloadTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProviderId || !selectedCategoryId) throw new Error('Missing selection');
      return productManagementApi.downloadIntegrationTemplate(
        selectedProviderId,
        selectedCategoryId,
      );
    },
    onSuccess: () => {
      toast.success('Integration template downloaded');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to download template');
    },
  });

  const createPortalJobMutation = useMutation({
    mutationFn: async (params: {
      credentialProfileId: string;
      runMode: PortalJobRunMode;
      policySchedule?: PortalProviderFlow['policySchedule'];
      documentArtifacts?: PortalProviderFlow['documentArtifacts'];
    }) => {
      if (!selectedProviderId || !selectedCategoryId)
        throw new Error('Missing provider or category');
      if (!isPortalAutomationCategory(selectedCategoryId)) {
        throw new Error('Portal automation can only run for specific product subcategories.');
      }
      return productManagementApi.createPortalJob(
        selectedProviderId,
        selectedCategoryId,
        params.credentialProfileId,
        params.runMode,
        {
          policySchedule: params.policySchedule,
          documentArtifacts: params.documentArtifacts,
        },
      );
    },
    onSuccess: ({ job }) => {
      setPortalJob(job);
      if (job.actionsDispatchError) {
        toast.warning(job.actionsDispatchError);
      } else {
        toast.success('Portal job queued. GitHub Actions is starting the Playwright worker.');
      }
      queryClient.invalidateQueries({ queryKey: integrationsKeys.portalJob(job.id) });
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.latestPortalJob(selectedProviderId, selectedCategoryId),
      });
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.portalJobHistory(selectedProviderId, selectedCategoryId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create portal job');
    },
  });

  const refreshPortalJobMutation = useMutation({
    mutationFn: async () => {
      if (!visiblePortalJobForSelection) throw new Error('No portal job selected');
      return productManagementApi.fetchPortalJob(
        visiblePortalJobForSelection.id,
        selectedProviderId!,
        selectedCategoryId,
      );
    },
    onSuccess: (job) => {
      setPortalJob(job);
      if (job.stagedRunId) {
        toast.success('Portal extraction staged. Open Upload & Sync to review the sync run.');
      }
      if (job.discoveryReportId) {
        queryClient.invalidateQueries({ queryKey: integrationsKeys.portalDiscoveryReport(job.id) });
      }
      queryClient.invalidateQueries({ queryKey: integrationsKeys.portalJobItems(job.id) });
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.portalJobHistory(selectedProviderId, selectedCategoryId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to refresh portal job');
    },
  });

  const submitPortalOtpMutation = useMutation({
    mutationFn: async (otp: string) => {
      if (!visiblePortalJobForSelection) throw new Error('No portal job selected');
      return productManagementApi.submitPortalOtp(
        visiblePortalJobForSelection.id,
        otp,
        selectedProviderId!,
        selectedCategoryId,
      );
    },
    onSuccess: (job) => {
      setPortalJob(job);
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.latestPortalJob(selectedProviderId, selectedCategoryId),
      });
      toast.success('OTP submitted. The worker will continue shortly.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to submit OTP');
    },
  });

  const retryPortalJobItemMutation = useMutation({
    mutationFn: async (item: PortalJobPolicyItem) => {
      if (!visiblePortalJobForSelection) throw new Error('No portal job selected');
      return productManagementApi.retryPortalJobItem(
        visiblePortalJobForSelection.id,
        item.id,
        selectedProviderId!,
        selectedCategoryId,
      );
    },
    onSuccess: ({ job }) => {
      setPortalJob(job);
      toast.success('Policy queued for retry.');
      queryClient.invalidateQueries({ queryKey: integrationsKeys.portalJobItems(job.id) });
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.latestPortalJob(selectedProviderId, selectedCategoryId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to retry policy');
    },
  });

  const applyPortalFlowMutation = useMutation({
    mutationFn: async (patch: { policyRowSelector?: string; fields: PortalFlowField[] }) => {
      if (!selectedProviderId || !portalFlow) throw new Error('Portal flow is not loaded');
      if (!selectedCategoryId) throw new Error('No category selected');
      return productManagementApi.savePortalFlow(selectedProviderId, selectedCategoryId, {
        ...portalFlow,
        extraction: {
          ...portalFlow.extraction,
          policyRowSelector: patch.policyRowSelector || portalFlow.extraction.policyRowSelector,
          fields: patch.fields,
        },
        needsDiscovery: false,
      });
    },
    onSuccess: () => {
      toast.success('Portal flow selectors updated. Run dry-run before staging.');
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.portalFlow(selectedProviderId, selectedCategoryId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update portal flow');
    },
  });

  const savePortalFlowMutation = useMutation({
    mutationFn: async (flow: PortalProviderFlow) => {
      if (!selectedProviderId || !selectedCategoryId)
        throw new Error('No provider or category selected');
      return productManagementApi.savePortalFlow(selectedProviderId, selectedCategoryId, flow);
    },
    onSuccess: () => {
      toast.success('Portal automation flow saved.');
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.portalFlow(selectedProviderId, selectedCategoryId),
      });
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.portalBrainMemory(selectedProviderId, selectedCategoryId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save portal flow');
    },
  });

  const resetPortalFlowMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProviderId || !selectedCategoryId)
        throw new Error('No provider or category selected');
      return productManagementApi.resetPortalFlow(selectedProviderId, selectedCategoryId);
    },
    onSuccess: () => {
      toast.success('This product flow was reset. Provider credentials were kept.');
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.portalFlow(selectedProviderId, selectedCategoryId),
      });
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.portalBrainMemory(selectedProviderId, selectedCategoryId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to reset portal flow');
    },
  });

  const savePortalCredentialsMutation = useMutation({
    mutationFn: async (params: { profileId: string; username: string; password?: string }) => {
      if (!selectedProviderId || !selectedCategoryId)
        throw new Error('No provider or category selected');
      return productManagementApi.savePortalCredentials(
        selectedProviderId,
        params.profileId,
        selectedCategoryId,
        {
          username: params.username,
          password: params.password,
        },
      );
    },
    onSuccess: (_, variables) => {
      toast.success('Provider portal credentials saved in Supabase.');
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.portalCredentialStatus(
          selectedProviderId,
          `${selectedCategoryId}:${variables.profileId}`,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.portalFlow(selectedProviderId, selectedCategoryId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save portal credentials');
    },
  });

  // Save Config Mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProviderId || !selectedCategoryId) throw new Error('Missing selection');
      const fieldBindings = buildIntegrationBindingsForFields(
        categoryFields,
        configBindings,
        buildLegacyFieldMappingFromBindings(configBindings),
      ).filter(
        (binding) => binding.columnName && binding.targetFieldId,
      ) as IntegrationFieldBinding[];

      const config: IntegrationConfig = {
        fieldBindings,
        fieldMapping: buildLegacyFieldMappingFromBindings(fieldBindings),
        settings: configSettings,
      };

      return productManagementApi.saveIntegrationConfig(
        selectedProviderId,
        selectedCategoryId,
        config,
      );
    },
    onSuccess: () => {
      toast.success('Configuration saved successfully');
      queryClient.invalidateQueries({
        queryKey: integrationsKeys.config(selectedProviderId, selectedCategoryId),
      });
    },
    onError: () => {
      toast.error('Failed to save configuration');
    },
  });

  return {
    processFileMutation,
    publishRunMutation,
    downloadTemplateMutation,
    createPortalJobMutation,
    refreshPortalJobMutation,
    submitPortalOtpMutation,
    retryPortalJobItemMutation,
    applyPortalFlowMutation,
    savePortalFlowMutation,
    resetPortalFlowMutation,
    savePortalCredentialsMutation,
    saveConfigMutation,
  };
}
