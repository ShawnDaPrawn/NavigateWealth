import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent } from '../../../ui/tabs';
import {
  IntegrationFieldBinding,
  PreviewData,
  IntegrationSyncRun,
  PortalBrainMemorySummary,
  PortalProviderConnection,
  PortalSyncJob,
  ProductCategoryId,
  getPortalAutomationCategoryOptions,
} from './types';
import { productManagementApi } from './api';
import { ProviderConnectionList } from './integrations/connections/ProviderConnectionList';
import { GuidedSignInDialog } from './integrations/connections/GuidedSignInDialog';
import { IntegrationHeader } from './integrations/IntegrationHeader';
import {
  INTEGRATION_SECTIONS,
  INTEGRATION_SECTION_LABELS,
  type IntegrationSection,
} from './integrations/integrationSections';
import { describeConnection } from './integrations/connections/connectionPresentation';
import { useSearchParams } from 'react-router';
import { useBreadcrumbTrail, useUrlState } from '../../layout/page';
import { UploadTab } from './integrations/UploadTab';
import { MappingTab } from './integrations/MappingTab';
import { ProviderSetupTab } from './integrations/ProviderSetupTab';
import { PortalAutomationTab } from './integrations/PortalAutomationTab';
import { PortfolioTableTab } from './integrations/PortfolioTableTab';
import { isActivePortalJob } from './integrations/portal-automation/portalHelpers';
import { usePortalFieldSelectors } from './integrations/portal-automation/usePortalFieldSelectors';
import { toast } from 'sonner';
import { ChevronLeft, Inbox, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { integrationsKeys } from '../../../../utils/queryKeys';
import { useProductSchema } from './hooks/useProductSchema';
import { useIntegrationsTabMutations } from './useIntegrationsTabMutations';
import { buildIntegrationBindingsForFields } from '@/shared/integrations/binding-utils';

export function IntegrationsTab() {
  const queryClient = useQueryClient();

  // UI State. The open integration, its section and the Advanced &
  // diagnostics page all live in the address (?integration=<id>&section=mapping
  // &advanced=1), so reload, Back and a pasted link land on the same page.
  const [searchParams, setSearchParams] = useSearchParams();
  const openProviderId = searchParams.get('integration');
  const advancedOpen = !!openProviderId && searchParams.get('advanced') === '1';
  const [activeTab, setActiveTab] = useUrlState<IntegrationSection>(
    'section',
    'review',
    INTEGRATION_SECTIONS,
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Upload State
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: string;
    uploadedAt: string;
  } | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [showUploadPreview, setShowUploadPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [stagedRun, setStagedRun] = useState<IntegrationSyncRun | null>(null);
  const [portalJob, setPortalJob] = useState<PortalSyncJob | null>(null);
  const [selectedPortalCredentialProfileId, setSelectedPortalCredentialProfileId] = useState('');
  /** The provider whose guided sign-in is open, or null when it is closed. */
  const [guidedSignInProviderId, setGuidedSignInProviderId] = useState<string | null>(null);

  // Mapping Configuration State (Local Mutable)
  const [configBindings, setConfigBindings] = useState<IntegrationFieldBinding[]>([]);
  const [configSettings, setConfigSettings] = useState({
    autoMap: true,
    ignoreUnmatched: false,
    strictMode: false,
    autoPublish: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Queries ---

  // 1. Fetch Providers
  const { data: providers = [], isLoading: isLoadingProviders } = useQuery({
    queryKey: integrationsKeys.providers(),
    queryFn: () => productManagementApi.fetchIntegrationProviders(),
  });

  // 1b. Sign-in state for every provider at once. This is the first thing an
  // adviser looks at ("which of these actually work?"), so it is one request
  // for the whole list rather than N requests assembled in the client.
  const { data: portalConnections = [] } = useQuery<PortalProviderConnection[]>({
    queryKey: integrationsKeys.portalConnections(),
    queryFn: () => productManagementApi.fetchPortalConnections(),
  });

  // Every query and mutation below is bound to one provider: the open
  // integration page, or — on the list — the provider whose guided sign-in is
  // open (the dialog stays over the list).
  const selectedProviderId = openProviderId ?? guidedSignInProviderId;

  const openIntegration = (providerId: string) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set('integration', providerId);
      params.delete('section');
      params.delete('advanced');
      return params;
    });
  };

  const closeIntegration = () => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete('integration');
      params.delete('section');
      params.delete('advanced');
      return params;
    });
  };

  const setAdvancedOpen = (open: boolean) => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (open) params.set('advanced', '1');
        else params.delete('advanced');
        return params;
      },
      { replace: !open },
    );
  };

  const selectedProvider = providers.find((p) => p.id === selectedProviderId);

  const openProviderName = openProviderId
    ? (providers.find((p) => p.id === openProviderId)?.name ?? 'Integration')
    : null;
  useBreadcrumbTrail(
    !openProviderName
      ? [{ label: 'Integrations' }]
      : advancedOpen
        ? [
            { label: 'Integrations', onClick: () => closeIntegration() },
            { label: openProviderName, onClick: () => setAdvancedOpen(false) },
            { label: 'Advanced & diagnostics' },
          ]
        : [
            { label: 'Integrations', onClick: () => closeIntegration() },
            { label: openProviderName },
            { label: INTEGRATION_SECTION_LABELS[activeTab] },
          ],
  );

  // Reset UI when provider changes
  useEffect(() => {
    if (selectedProvider) {
      const firstCat = getPortalAutomationCategoryOptions(selectedProvider.categoryIds)[0] || '';
      setSelectedCategoryId(firstCat);

      setUploadedFile(null);
      setRawFile(null);
      setShowUploadPreview(false);
      setPreviewData(null);
      setStagedRun(null);
      setPortalJob(null);
      setConfigBindings([]);
      setConfigSettings({
        autoMap: true,
        ignoreUnmatched: false,
        strictMode: false,
        autoPublish: false,
      });
    }
  }, [selectedProviderId, providers, selectedProvider]);

  // 2. Fetch History & Stats
  const { data: integrationStats } = useQuery({
    queryKey: integrationsKeys.history(selectedProviderId, selectedCategoryId),
    enabled: !!selectedProviderId && !!selectedCategoryId,
    queryFn: () =>
      productManagementApi.fetchIntegrationHistory(selectedProviderId!, selectedCategoryId),
    initialData: { lastAttempted: '-', lastUpdateStatus: null, lastSuccessful: '-' },
  });

  // 3. Fetch Config
  const { data: serverConfig } = useQuery({
    queryKey: integrationsKeys.config(selectedProviderId, selectedCategoryId),
    enabled: !!selectedProviderId && !!selectedCategoryId,
    queryFn: () =>
      productManagementApi.fetchIntegrationConfig(selectedProviderId!, selectedCategoryId),
  });

  const { currentFields: categoryFields, isLoading: isLoadingCategoryFields } = useProductSchema(
    (selectedCategoryId || '') as ProductCategoryId | '',
  );
  const mappingBindings: IntegrationFieldBinding[] = configBindings;

  const { data: portalFlow, isLoading: isLoadingPortalFlow } = useQuery({
    queryKey: integrationsKeys.portalFlow(selectedProviderId, selectedCategoryId),
    enabled: !!selectedProviderId && !!selectedCategoryId,
    queryFn: () => productManagementApi.fetchPortalFlow(selectedProviderId!, selectedCategoryId),
  });

  const {
    fieldSelectors: portalFieldSelectors,
    updateFieldSelector: updatePortalFieldSelector,
    updateFieldRequired: updatePortalFieldRequired,
    buildProviderFallbackFields: buildPortalProviderFallbackFields,
  } = usePortalFieldSelectors(mappingBindings, portalFlow);

  const { data: portalBrainMemory } = useQuery<PortalBrainMemorySummary>({
    queryKey: integrationsKeys.portalBrainMemory(selectedProviderId, selectedCategoryId),
    enabled: !!selectedProviderId && !!selectedCategoryId,
    queryFn: () =>
      productManagementApi.fetchPortalBrainMemory(selectedProviderId!, selectedCategoryId),
  });

  useEffect(() => {
    if (portalFlow?.credentialProfiles?.length) {
      setSelectedPortalCredentialProfileId((current) =>
        portalFlow.credentialProfiles.some((profile) => profile.id === current)
          ? current
          : portalFlow.credentialProfiles[0].id,
      );
    } else {
      setSelectedPortalCredentialProfileId('');
    }
  }, [portalFlow]);

  const { data: portalCredentialStatus } = useQuery({
    queryKey: integrationsKeys.portalCredentialStatus(
      selectedProviderId,
      `${selectedCategoryId}:${selectedPortalCredentialProfileId}`,
    ),
    enabled: !!selectedProviderId && !!selectedCategoryId && !!selectedPortalCredentialProfileId,
    queryFn: () =>
      productManagementApi.fetchPortalCredentialStatus(
        selectedProviderId!,
        selectedPortalCredentialProfileId,
        selectedCategoryId,
      ),
  });

  const portalJobForSelection =
    portalJob?.providerId === selectedProviderId && portalJob.categoryId === selectedCategoryId
      ? portalJob
      : null;
  const stagedRunForSelection =
    stagedRun?.providerId === selectedProviderId && stagedRun.categoryId === selectedCategoryId
      ? stagedRun
      : null;

  const { data: latestPortalJob } = useQuery({
    queryKey: integrationsKeys.latestPortalJob(selectedProviderId, selectedCategoryId),
    enabled: !!selectedProviderId && !!selectedCategoryId,
    queryFn: () =>
      productManagementApi.fetchLatestPortalJob(selectedProviderId!, selectedCategoryId),
    refetchInterval: isActivePortalJob(portalJobForSelection) ? 3000 : false,
    refetchIntervalInBackground: true,
  });

  const { data: portalJobHistory = [], isLoading: isLoadingPortalJobHistory } = useQuery({
    queryKey: integrationsKeys.portalJobHistory(selectedProviderId, selectedCategoryId),
    enabled: !!selectedProviderId && !!selectedCategoryId,
    queryFn: () =>
      productManagementApi.fetchPortalJobHistory(selectedProviderId!, selectedCategoryId),
    refetchInterval: isActivePortalJob(portalJobForSelection) ? 5000 : false,
    refetchIntervalInBackground: true,
  });

  const { data: portalDiscoveryReport, isLoading: isLoadingPortalDiscoveryReport } = useQuery({
    queryKey: integrationsKeys.portalDiscoveryReport(portalJobForSelection?.id || null),
    enabled: !!portalJobForSelection?.id,
    queryFn: () =>
      productManagementApi.fetchPortalDiscoveryReport(
        portalJobForSelection!.id,
        selectedProviderId!,
        selectedCategoryId,
      ),
  });

  const { data: portalJobItemsData, isLoading: isLoadingPortalJobItems } = useQuery({
    queryKey: integrationsKeys.portalJobItems(portalJobForSelection?.id || null),
    enabled: !!portalJobForSelection?.id,
    queryFn: () =>
      productManagementApi.fetchPortalJobItems(
        portalJobForSelection!.id,
        selectedProviderId!,
        selectedCategoryId,
      ),
    refetchInterval: isActivePortalJob(portalJobForSelection) ? 3000 : false,
    refetchIntervalInBackground: true,
  });

  const stagedRunId = portalJobForSelection?.stagedRunId || latestPortalJob?.stagedRunId || null;

  const { data: portalStagedRun } = useQuery({
    queryKey: integrationsKeys.syncRun(stagedRunId),
    enabled: !!stagedRunId,
    queryFn: () => productManagementApi.fetchIntegrationSyncRun(stagedRunId!),
  });

  const stagedRunForSelectionIsLoaded =
    !portalJobForSelection?.stagedRunId ||
    (portalStagedRun !== undefined &&
      portalStagedRun?.id === portalJobForSelection.stagedRunId &&
      portalStagedRun.providerId === selectedProviderId &&
      portalStagedRun.categoryId === selectedCategoryId);
  // Category mismatch is enforced server-side on both the read path
  // (`/portal-jobs/latest` answers with no job) and the publish path, so the
  // client only has to wait for the staged run that belongs to this selection.
  const visiblePortalJobForSelection = stagedRunForSelectionIsLoaded ? portalJobForSelection : null;
  const visibleStagedRunForSelection = stagedRunForSelectionIsLoaded ? stagedRunForSelection : null;

  // Rows still awaiting a decision, by the same rule the Review panel publishes
  // by. Surfaced on the Review tab so a queued refresh has a visible
  // destination rather than an adviser having to go hunting for the result.
  const pendingReviewCount =
    visibleStagedRunForSelection?.rows.filter(
      (row) =>
        row.matchStatus === 'matched' &&
        row.diffs.length > 0 &&
        row.publishStatus !== 'published' &&
        row.publishStatus !== 'failed' &&
        row.publishStatus !== 'skipped',
    ).length || 0;

  // The guided sign-in dialog only ever talks about the selected provider —
  // opening it selects that provider first — so everything it needs comes from
  // the same queries the rest of the tab already runs.
  const guidedSignInConnection =
    portalConnections.find((entry) => entry.providerId === guidedSignInProviderId) || null;
  const connectionTestJob = visiblePortalJobForSelection?.connectionTest
    ? visiblePortalJobForSelection
    : null;

  // A finished sign-in test is the only thing that changes what the Connections
  // list says, so the list is refreshed when one lands rather than polled.
  const connectionTestJobId = connectionTestJob?.id;
  const connectionTestSettled = connectionTestJob ? !isActivePortalJob(connectionTestJob) : false;
  useEffect(() => {
    if (!connectionTestJobId || !connectionTestSettled) return;
    queryClient.invalidateQueries({ queryKey: integrationsKeys.portalConnections() });
  }, [connectionTestJobId, connectionTestSettled, queryClient]);

  useEffect(() => {
    if (latestPortalJob === undefined) return;

    if (latestPortalJob === null) {
      setPortalJob((currentJob) =>
        currentJob?.providerId === selectedProviderId &&
        currentJob.categoryId === selectedCategoryId
          ? null
          : currentJob,
      );
      return;
    }

    if (
      latestPortalJob.providerId !== selectedProviderId ||
      latestPortalJob.categoryId !== selectedCategoryId
    ) {
      return;
    }

    setPortalJob((currentJob) => {
      if (!currentJob) return latestPortalJob;
      if (currentJob.id === latestPortalJob.id) {
        return currentJob.updatedAt === latestPortalJob.updatedAt ? currentJob : latestPortalJob;
      }

      const currentCreatedAt = Date.parse(currentJob.createdAt || '');
      const latestCreatedAt = Date.parse(latestPortalJob.createdAt || '');
      if (Number.isNaN(currentCreatedAt) || latestCreatedAt >= currentCreatedAt) {
        return latestPortalJob;
      }

      return currentJob;
    });
  }, [latestPortalJob, selectedCategoryId, selectedProviderId]);

  useEffect(() => {
    if (!portalStagedRun) return;
    if (
      portalStagedRun.providerId !== selectedProviderId ||
      portalStagedRun.categoryId !== selectedCategoryId
    )
      return;

    setStagedRun((currentRun) => {
      if (!currentRun) return portalStagedRun;
      if (currentRun.id !== portalStagedRun.id) return portalStagedRun;
      return currentRun.updatedAt === portalStagedRun.updatedAt ? currentRun : portalStagedRun;
    });
  }, [portalStagedRun, selectedCategoryId, selectedProviderId]);

  useEffect(() => {
    setPortalJob((currentJob) =>
      currentJob?.providerId === selectedProviderId && currentJob.categoryId === selectedCategoryId
        ? currentJob
        : null,
    );
    setStagedRun((currentRun) =>
      currentRun?.providerId === selectedProviderId && currentRun.categoryId === selectedCategoryId
        ? currentRun
        : null,
    );
  }, [selectedCategoryId, selectedProviderId]);

  // Sync server config to local state
  useEffect(() => {
    if (!serverConfig) {
      if (!selectedCategoryId) {
        setConfigBindings([]);
      }
      return;
    }
    setConfigBindings(
      buildIntegrationBindingsForFields(
        categoryFields,
        serverConfig.fieldBindings || [],
        serverConfig.fieldMapping || {},
      ) as IntegrationFieldBinding[],
    );
    setConfigSettings({
      autoMap: !!serverConfig.settings?.autoMap,
      ignoreUnmatched: !!serverConfig.settings?.ignoreUnmatched,
      strictMode: !!serverConfig.settings?.strictMode,
      autoPublish: !!serverConfig.settings?.autoPublish,
    });
  }, [categoryFields, selectedCategoryId, serverConfig]);
  const {
    processFileMutation,
    publishRunMutation,
    downloadTemplateMutation,
    createPortalJobMutation,
    startConnectionTestMutation,
    refreshPortalJobMutation,
    submitPortalOtpMutation,
    retryPortalJobItemMutation,
    applyPortalFlowMutation,
    savePortalFlowMutation,
    resetPortalFlowMutation,
    savePortalCredentialsMutation,
    saveConfigMutation,
  } = useIntegrationsTabMutations({
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
  });

  // --- Handlers ---

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    setRawFile(file);
    setUploadedFile({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      uploadedAt: new Date().toLocaleTimeString(),
    });
    setShowUploadPreview(false);
    setPreviewData(null);
    setStagedRun(null);
  };

  const handleProcessFile = () => {
    processFileMutation.mutate({ mode: 'preview' });
  };

  const handleConfirmImport = () => {
    toast.promise(processFileMutation.mutateAsync({ mode: 'commit' }), {
      loading: 'Staging policy sync...',
      success: 'Sync run staged',
      error: 'Import failed',
    });
  };

  const handleUpdateBinding = (targetFieldId: string, patch: Partial<IntegrationFieldBinding>) => {
    setConfigBindings((currentBindings) => {
      const nextBindings = currentBindings.map((binding) =>
        binding.targetFieldId === targetFieldId ? { ...binding, ...patch, targetFieldId } : binding,
      );

      if (nextBindings.some((binding) => binding.targetFieldId === targetFieldId)) {
        return nextBindings;
      }

      return [
        ...nextBindings,
        {
          targetFieldId,
          targetFieldName: targetFieldId,
          columnName: '',
          blankBehavior: 'ignore',
          ...patch,
        },
      ];
    });
  };

  const handleSettingChange = (key: keyof typeof configSettings, value: boolean) => {
    setConfigSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveConfiguration = () => {
    saveConfigMutation.mutate();
  };

  const handleCategoryChange = (categoryId: string) => {
    setPortalJob(null);
    setStagedRun(null);
    setUploadedFile(null);
    setRawFile(null);
    setShowUploadPreview(false);
    setPreviewData(null);
    queryClient.removeQueries({
      queryKey: integrationsKeys.portalDiscoveryReport(portalJobForSelection?.id || null),
    });
    queryClient.removeQueries({
      queryKey: integrationsKeys.portalJobItems(portalJobForSelection?.id || null),
    });
    queryClient.removeQueries({ queryKey: integrationsKeys.syncRun(stagedRunId) });
    setSelectedCategoryId(categoryId);
  };

  /**
   * Open guided sign-in for a provider.
   *
   * Selecting the provider first is what makes the dialog work at all: every
   * portal mutation in this tab is bound to the current selection, so the
   * alternative would be a second, parallel set of them targeting a different
   * provider — two ways to save the same credentials, which is exactly the kind
   * of duplication that let setup completeness disagree with itself before.
   */
  const handleOpenGuidedSignIn = (connection: PortalProviderConnection) => {
    setGuidedSignInProviderId(connection.providerId);
  };

  const handleSaveGuidedLoginUrl = async (loginUrl: string) => {
    if (!portalFlow) {
      // Throwing rather than returning is deliberate: the dialog awaits this
      // before starting the test, and a silent return would run the test
      // against the address the adviser has just corrected.
      toast.error('The provider setup is still loading. Try again in a moment.');
      throw new Error('Portal flow not loaded');
    }
    await savePortalFlowMutation.mutateAsync({ ...portalFlow, loginUrl });
  };

  const handleSaveGuidedCredentials = async (credentials: {
    username: string;
    password: string;
  }) => {
    const profileId =
      guidedSignInConnection?.credentialProfileId || selectedPortalCredentialProfileId;
    if (!profileId) {
      toast.error('This provider has no credential profile to save sign-in details against.');
      throw new Error('No credential profile');
    }
    await savePortalCredentialsMutation.mutateAsync({ profileId, ...credentials });
  };

  const handleStartConnectionTest = async () => {
    const profileId =
      guidedSignInConnection?.credentialProfileId || selectedPortalCredentialProfileId;
    if (!profileId) {
      toast.error('This provider has no credential profile to test.');
      throw new Error('No credential profile');
    }
    await startConnectionTestMutation.mutateAsync(profileId);
  };

  const isColumnMapped = (colName: string) =>
    configBindings.some(
      (binding) => binding.columnName === colName && binding.targetFieldId !== '',
    );

  const matchedColumnsCount = configBindings.filter(
    (binding) => binding.targetFieldId && binding.columnName,
  ).length;

  const openConnection = openProviderId
    ? portalConnections.find((entry) => entry.providerId === openProviderId) || null
    : null;
  const openConnectionAction = openConnection
    ? describeConnection(openConnection.state).action
    : undefined;

  const guidedSignIn = (
    <GuidedSignInDialog
      connection={guidedSignInConnection}
      open={!!guidedSignInConnection}
      onOpenChange={(next) => setGuidedSignInProviderId(next ? guidedSignInProviderId : null)}
      job={connectionTestJob}
      onSaveLoginUrl={handleSaveGuidedLoginUrl}
      onSaveCredentials={handleSaveGuidedCredentials}
      onStartTest={handleStartConnectionTest}
      onSubmitOtp={async (otp) => {
        await submitPortalOtpMutation.mutateAsync(otp);
      }}
      isSaving={savePortalFlowMutation.isPending || savePortalCredentialsMutation.isPending}
      isStartingTest={startConnectionTestMutation.isPending}
      isSubmittingOtp={submitPortalOtpMutation.isPending}
    />
  );

  // --- Integration page (?integration=<id>) ---
  if (openProviderId) {
    if (!selectedProvider) {
      return (
        <div className="flex flex-col gap-4">
          <BackToIntegrations onClick={closeIntegration} />
          <div className="flex flex-col items-center gap-2 rounded-xl border border-nw-line bg-white p-10 text-center">
            {isLoadingProviders ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" aria-hidden="true" />
                <p className="text-sm text-gray-500">Loading integration...</p>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-nw-ink">Integration not found</h2>
                <p className="text-sm text-nw-text-3">
                  This provider may have been removed. Go back to the connections list.
                </p>
              </>
            )}
          </div>
        </div>
      );
    }

    if (advancedOpen) {
      return (
        <>
          <ProviderSetupTab
            key={`${selectedProvider.id}:${selectedCategoryId}:advanced`}
            view="advanced"
            onCloseAdvanced={() => setAdvancedOpen(false)}
            provider={selectedProvider}
            selectedCategoryId={selectedCategoryId}
            flow={portalFlow}
            brainMemory={portalBrainMemory}
            isLoadingFlow={isLoadingPortalFlow}
            credentialStatus={portalCredentialStatus}
            mappingBindings={mappingBindings}
            selectedCredentialProfileId={selectedPortalCredentialProfileId}
            onCredentialProfileChange={setSelectedPortalCredentialProfileId}
            isSavingCredentials={savePortalCredentialsMutation.isPending}
            isSavingFlow={savePortalFlowMutation.isPending}
            isResettingFlow={resetPortalFlowMutation.isPending}
            onSaveCredentials={(profileId, credentials) =>
              savePortalCredentialsMutation.mutate({ profileId, ...credentials })
            }
            onSaveFlow={(flow) =>
              savePortalFlowMutation.mutate(flow, { onSuccess: () => setAdvancedOpen(false) })
            }
            onResetFlow={() => resetPortalFlowMutation.mutate()}
            onOpenMappingTab={() => {
              setAdvancedOpen(false);
              setActiveTab('mapping');
            }}
            fieldSelectors={portalFieldSelectors}
            updateFieldSelector={updatePortalFieldSelector}
            updateFieldRequired={updatePortalFieldRequired}
            buildProviderFallbackFields={buildPortalProviderFallbackFields}
          />
          {guidedSignIn}
        </>
      );
    }

    return (
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as IntegrationSection)}
        className="flex flex-col gap-5"
      >
        <IntegrationHeader
          provider={selectedProvider}
          selectedCategoryId={selectedCategoryId}
          stats={integrationStats}
          onCategoryChange={handleCategoryChange}
          pendingReviewCount={pendingReviewCount}
          onBack={closeIntegration}
          onOpenAdvanced={() => setAdvancedOpen(true)}
          statusLabel={openConnection ? describeConnection(openConnection.state).label : undefined}
          connectAction={
            openConnection && openConnectionAction
              ? {
                  label: openConnectionAction,
                  onClick: () => handleOpenGuidedSignIn(openConnection),
                }
              : undefined
          }
        />

        {/* Tab: Review (proposed changes) and spreadsheet upload */}
        <TabsContent value="review" className="m-0 focus-visible:outline-none">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileSelect}
          />
          <UploadTab
            provider={selectedProvider}
            selectedCategoryId={selectedCategoryId}
            uploadedFile={uploadedFile}
            isProcessing={processFileMutation.isPending}
            showPreview={showUploadPreview}
            onDrop={handleFileDrop}
            onManualUpload={() => fileInputRef.current?.click()}
            onProcess={handleProcessFile}
            onClear={() => {
              setUploadedFile(null);
              setRawFile(null);
              setShowUploadPreview(false);
              setPreviewData(null);
              setStagedRun(null);
            }}
            onConfirm={handleConfirmImport}
            onPublishRun={() => publishRunMutation.mutate()}
            isPublishingRun={publishRunMutation.isPending}
            isColumnMapped={isColumnMapped}
            previewData={previewData}
            stagedRun={visibleStagedRunForSelection}
            portalJobItems={portalJobItemsData?.items || []}
            stats={integrationStats}
            matchedColumnsCount={matchedColumnsCount}
          />
        </TabsContent>

        {/* Tab: Portfolio (the provider/product book, download / upload, agent endpoint) */}
        <TabsContent value="portfolio" className="m-0 focus-visible:outline-none">
          <PortfolioTableTab
            key={`${selectedProvider.id}:${selectedCategoryId}:portfolio`}
            provider={selectedProvider}
            selectedCategoryId={selectedCategoryId}
          />
        </TabsContent>

        {/* Tab: Provider Setup */}
        <TabsContent value="setup" className="m-0 focus-visible:outline-none">
          <div className="space-y-6 max-w-4xl mx-auto">
            <ProviderSetupTab
              key={`${selectedProvider.id}:${selectedCategoryId}:setup`}
              provider={selectedProvider}
              selectedCategoryId={selectedCategoryId}
              flow={portalFlow}
              brainMemory={portalBrainMemory}
              isLoadingFlow={isLoadingPortalFlow}
              credentialStatus={portalCredentialStatus}
              mappingBindings={mappingBindings}
              selectedCredentialProfileId={selectedPortalCredentialProfileId}
              onCredentialProfileChange={setSelectedPortalCredentialProfileId}
              isSavingCredentials={savePortalCredentialsMutation.isPending}
              isSavingFlow={savePortalFlowMutation.isPending}
              isResettingFlow={resetPortalFlowMutation.isPending}
              onSaveCredentials={(profileId, credentials) =>
                savePortalCredentialsMutation.mutate({ profileId, ...credentials })
              }
              onSaveFlow={(flow) => savePortalFlowMutation.mutate(flow)}
              onResetFlow={() => resetPortalFlowMutation.mutate()}
              onOpenMappingTab={() => setActiveTab('mapping')}
              fieldSelectors={portalFieldSelectors}
              updateFieldSelector={updatePortalFieldSelector}
              updateFieldRequired={updatePortalFieldRequired}
              buildProviderFallbackFields={buildPortalProviderFallbackFields}
            />
          </div>
        </TabsContent>

        {/* Tab: Mapping Configuration */}
        <TabsContent value="mapping" className="m-0 focus-visible:outline-none">
          <MappingTab
            provider={selectedProvider}
            selectedCategoryId={selectedCategoryId}
            categoryFields={categoryFields}
            configBindings={configBindings}
            configSettings={configSettings}
            onUpdateBinding={handleUpdateBinding}
            onUpdateSetting={handleSettingChange}
            onSave={handleSaveConfiguration}
            onDownloadTemplate={() => downloadTemplateMutation.mutate()}
            isDownloadingTemplate={downloadTemplateMutation.isPending}
            isLoadingFields={isLoadingCategoryFields}
          />
        </TabsContent>

        {/* Tab: Portal Automation */}
        <TabsContent value="portal" className="m-0 focus-visible:outline-none">
          <PortalAutomationTab
            key={`${selectedProvider.id}:${selectedCategoryId}:portal`}
            provider={selectedProvider}
            selectedCategoryId={selectedCategoryId}
            flow={portalFlow}
            job={visiblePortalJobForSelection}
            stagedRun={visibleStagedRunForSelection}
            jobItems={portalJobItemsData?.items || []}
            jobHistory={portalJobHistory}
            discoveryReport={portalDiscoveryReport}
            isLoadingFlow={isLoadingPortalFlow}
            isLoadingDiscoveryReport={isLoadingPortalDiscoveryReport}
            isLoadingJobItems={isLoadingPortalJobItems}
            isLoadingJobHistory={isLoadingPortalJobHistory}
            isCreatingJob={createPortalJobMutation.isPending}
            credentialStatus={portalCredentialStatus}
            mappingBindings={mappingBindings}
            selectedCredentialProfileId={selectedPortalCredentialProfileId}
            isSubmittingOtp={submitPortalOtpMutation.isPending}
            isRefreshingJob={refreshPortalJobMutation.isPending}
            onCreateJob={(credentialProfileId, runMode, options) =>
              createPortalJobMutation.mutate({ credentialProfileId, runMode, ...options })
            }
            onSubmitOtp={(otp) => submitPortalOtpMutation.mutate(otp)}
            onRefreshJob={() => refreshPortalJobMutation.mutate()}
            onRetryItem={(item) => retryPortalJobItemMutation.mutate(item)}
            onApplyFlow={(patch) => applyPortalFlowMutation.mutate(patch)}
            onOpenUploadTab={() => setActiveTab('review')}
            onOpenSetupTab={() => setActiveTab('setup')}
            isApplyingFlow={applyPortalFlowMutation.isPending}
            fieldSelectors={portalFieldSelectors}
            updateFieldSelector={updatePortalFieldSelector}
            buildProviderFallbackFields={buildPortalProviderFallbackFields}
          />
        </TabsContent>
      </Tabs>
    );
  }

  // --- Connections list ---
  return (
    <>
      {providers.length > 0 ? (
        <ProviderConnectionList
          providers={providers}
          connections={portalConnections}
          onSelect={openIntegration}
          onConnect={handleOpenGuidedSignIn}
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-nw-line bg-white py-16 text-gray-400">
          {isLoadingProviders ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
              <p className="text-sm text-gray-500">Loading providers...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 max-w-md text-center p-8">
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                <Inbox className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No providers configured</h3>
              <p className="text-sm text-gray-500">
                You haven't set up any product providers yet. Go to the{' '}
                <span className="font-medium text-gray-700">Providers</span> tab to add your first
                provider.
              </p>
            </div>
          )}
        </div>
      )}
      {guidedSignIn}
    </>
  );
}

function BackToIntegrations({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      Integrations
    </button>
  );
}
