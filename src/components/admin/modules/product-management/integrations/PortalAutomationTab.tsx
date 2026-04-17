import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/alert';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Separator } from '../../../../ui/separator';
import { Switch } from '../../../../ui/switch';
import { Textarea } from '../../../../ui/textarea';
import { AlertCircle, Bot, CheckCircle2, Clock, FileText, KeyRound, ListChecks, Loader2, Play, RefreshCw, RotateCcw, Search, Settings2 } from 'lucide-react';
import { IntegrationProvider, PortalCredentialStatus, PortalDiscoveryReport, PortalFlowField, PortalJobPolicyItem, PortalJobRunMode, PortalProviderFlow, PortalSyncJob } from '../types';
import { cn } from '../../../../ui/utils';

interface PortalAutomationTabProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
  flow?: PortalProviderFlow;
  job?: PortalSyncJob | null;
  jobItems: PortalJobPolicyItem[];
  discoveryReport?: PortalDiscoveryReport | null;
  isLoadingFlow: boolean;
  isLoadingDiscoveryReport: boolean;
  isLoadingJobItems: boolean;
  isCreatingJob: boolean;
  credentialStatus?: PortalCredentialStatus;
  mappingSourceHeaders: string[];
  selectedCredentialProfileId: string;
  onCredentialProfileChange: (profileId: string) => void;
  isSavingCredentials: boolean;
  isSavingFlow: boolean;
  isSubmittingOtp: boolean;
  isRefreshingJob: boolean;
  onCreateJob: (credentialProfileId: string, runMode: PortalJobRunMode) => void;
  onSaveCredentials: (profileId: string, credentials: { username: string; password?: string }) => void;
  onSaveFlow: (flow: PortalProviderFlow) => void;
  onSubmitOtp: (otp: string) => void;
  onRefreshJob: () => void;
  onRetryItem: (item: PortalJobPolicyItem) => void;
  onApplyFlow: (patch: { policyRowSelector?: string; fields: PortalFlowField[] }) => void;
  isApplyingFlow: boolean;
}

const statusClassNames: Record<PortalSyncJob['status'], string> = {
  queued: 'bg-gray-50 text-gray-700 border-gray-200',
  running: 'bg-blue-50 text-blue-700 border-blue-200',
  waiting_for_otp: 'bg-amber-50 text-amber-700 border-amber-200',
  discovering: 'bg-purple-50 text-purple-700 border-purple-200',
  discovery_ready: 'bg-green-50 text-green-700 border-green-200',
  extracting: 'bg-blue-50 text-blue-700 border-blue-200',
  dry_run_ready: 'bg-green-50 text-green-700 border-green-200',
  staging: 'bg-purple-50 text-purple-700 border-purple-200',
  staged: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-50 text-gray-600 border-gray-200',
};

const itemStatusClassNames: Record<PortalJobPolicyItem['status'], string> = {
  queued: 'bg-gray-50 text-gray-700 border-gray-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  skipped: 'bg-gray-50 text-gray-600 border-gray-200',
};

const splitPortalLines = (value: string) => value
  .split(/\r?\n|,/)
  .map((item) => item.trim())
  .filter(Boolean);

const latestPortalWarning = (value?: string, warnings?: string[]) => {
  if (Array.isArray(warnings) && warnings.length > 0) return warnings[warnings.length - 1];
  return value || '';
};

export function PortalAutomationTab({
  provider,
  selectedCategoryId,
  flow,
  job,
  jobItems,
  discoveryReport,
  isLoadingFlow,
  isLoadingDiscoveryReport,
  isLoadingJobItems,
  isCreatingJob,
  credentialStatus,
  mappingSourceHeaders,
  selectedCredentialProfileId,
  onCredentialProfileChange,
  isSavingCredentials,
  isSavingFlow,
  isSubmittingOtp,
  isRefreshingJob,
  onCreateJob,
  onSaveCredentials,
  onSaveFlow,
  onSubmitOtp,
  onRefreshJob,
  onRetryItem,
  onApplyFlow,
  isApplyingFlow,
}: PortalAutomationTabProps) {
  const [runMode, setRunMode] = useState<PortalJobRunMode>('run');
  const [credentialUsername, setCredentialUsername] = useState('');
  const [credentialPassword, setCredentialPassword] = useState('');
  const [isAwaitingCredentialSave, setIsAwaitingCredentialSave] = useState(false);
  const [lastSavedCredentialProfileId, setLastSavedCredentialProfileId] = useState<string | null>(null);
  const [loginUrl, setLoginUrl] = useState('');
  const [usernameSelector, setUsernameSelector] = useState('');
  const [passwordSelector, setPasswordSelector] = useState('');
  const [submitSelector, setSubmitSelector] = useState('');
  const [postLoginUrl, setPostLoginUrl] = useState('');
  const [searchPageUrl, setSearchPageUrl] = useState('');
  const [searchInputLabelsText, setSearchInputLabelsText] = useState('');
  const [searchInputSelector, setSearchInputSelector] = useState('');
  const [searchSubmitSelector, setSearchSubmitSelector] = useState('');
  const [resultContainerSelector, setResultContainerSelector] = useState('');
  const [resultLinkSelector, setResultLinkSelector] = useState('');
  const [policyScheduleEnabled, setPolicyScheduleEnabled] = useState(false);
  const [policyScheduleLabelsText, setPolicyScheduleLabelsText] = useState('');
  const [policyScheduleSelector, setPolicyScheduleSelector] = useState('');
  const [nextPageSelector, setNextPageSelector] = useState('');
  const [policyListStepsJson, setPolicyListStepsJson] = useState('[]');
  const [policyListStepsError, setPolicyListStepsError] = useState('');
  const [otp, setOtp] = useState('');
  const [policyRowSelector, setPolicyRowSelector] = useState('');
  const [fieldSelectors, setFieldSelectors] = useState<PortalFlowField[]>([]);

  useEffect(() => {
    if (flow?.credentialProfiles?.length && !selectedCredentialProfileId) {
      onCredentialProfileChange(flow.credentialProfiles[0].id);
    }
  }, [flow, onCredentialProfileChange, selectedCredentialProfileId]);

  useEffect(() => {
    if (flow) {
      setLoginUrl(flow.loginUrl || '');
      setUsernameSelector(flow.login.usernameSelector || '');
      setPasswordSelector(flow.login.passwordSelector || '');
      setSubmitSelector(flow.login.submitSelector || '');
      setPostLoginUrl(flow.navigation.postLoginUrl || '');
      setSearchPageUrl(flow.search?.searchPageUrl || '');
      setSearchInputLabelsText((flow.search?.searchInputLabels || ['Policy number', 'Search']).join('\n'));
      setSearchInputSelector(flow.search?.searchInputSelector || '');
      setSearchSubmitSelector(flow.search?.submitSelector || '');
      setResultContainerSelector(flow.search?.resultContainerSelector || '');
      setResultLinkSelector(flow.search?.resultLinkSelector || '');
      setPolicyScheduleEnabled(flow.policySchedule?.enabled === true);
      setPolicyScheduleLabelsText((flow.policySchedule?.downloadLabels || ['Policy schedule', 'Download policy schedule', 'Download PDF', 'Statement']).join('\n'));
      setPolicyScheduleSelector(flow.policySchedule?.downloadSelector || '');
      setNextPageSelector(flow.navigation.nextPageSelector || '');
      setPolicyListStepsJson(JSON.stringify(flow.navigation.policyListSteps || [], null, 2));
      setPolicyRowSelector(flow.extraction.policyRowSelector || '');
      setFieldSelectors(flow.extraction.fields || []);
    }
  }, [flow]);

  useEffect(() => {
    if (mappingSourceHeaders.length === 0) return;
    setFieldSelectors((currentFields) => {
      const byHeader = new Map(currentFields.map((field) => [field.sourceHeader, field]));
      const merged = mappingSourceHeaders.map((sourceHeader) => (
        byHeader.get(sourceHeader) || {
          sourceHeader,
          selector: '',
          labels: [sourceHeader],
          attribute: 'text',
          transform: 'trim',
          required: /policy\s*(number|no)|reference/i.test(sourceHeader),
        }
      ));
      const unchanged = merged.length === currentFields.length &&
        merged.every((field, index) => field === currentFields[index]);
      return unchanged ? currentFields : merged;
    });
  }, [mappingSourceHeaders]);

  const selectedProfile = flow?.credentialProfiles.find((profile) => profile.id === selectedCredentialProfileId);
  const policyRowCandidates = discoveryReport?.selectorCandidates.filter(candidate => candidate.purpose === 'policy_row') || [];
  const credentialsSaved = Boolean(credentialStatus?.hasUsername && credentialStatus?.hasPassword);
  const queueSummary = job?.queueSummary || {
    total: jobItems.length,
    queued: jobItems.filter((item) => item.status === 'queued').length,
    inProgress: jobItems.filter((item) => item.status === 'in_progress').length,
    completed: jobItems.filter((item) => item.status === 'completed').length,
    failed: jobItems.filter((item) => item.status === 'failed').length,
    skipped: jobItems.filter((item) => item.status === 'skipped').length,
  };
  const progressPercent = queueSummary.total > 0
    ? Math.round(((queueSummary.completed + queueSummary.failed + queueSummary.skipped) / queueSummary.total) * 100)
    : 0;
  const hasCredentialDraft = Boolean(credentialUsername.trim() || credentialPassword);
  const canSaveCredentials = Boolean(
    selectedProfile &&
    !isSavingCredentials &&
    ((credentialUsername.trim() && credentialPassword) ||
      (credentialsSaved && (credentialUsername.trim() || credentialPassword)))
  );
  const showCredentialSaveSuccess = credentialsSaved && lastSavedCredentialProfileId === selectedCredentialProfileId;
  const configuredPolicyListSteps = (() => {
    try {
      const parsed = JSON.parse(policyListStepsJson || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const searchLabels = splitPortalLines(searchInputLabelsText);
  const hasSearchFallback = Boolean(searchInputSelector.trim() || searchLabels.length > 0);
  const hasPostLoginFallback = configuredPolicyListSteps.length > 0 || hasSearchFallback;
  const setupWarnings = [
    postLoginUrl.trim() && !hasPostLoginFallback
      ? 'A post-login page URL is set, but there is no click-step or search fallback if that page cannot be opened.'
      : '',
    searchPageUrl.trim() && !hasSearchFallback
      ? 'A search page URL is set, but there is no search selector or search-box wording configured if that page cannot be opened.'
      : '',
  ].filter(Boolean);
  const currentJobWarning = latestPortalWarning(job?.warning, job?.warnings);

  const updateFieldSelector = (index: number, selector: string) => {
    setFieldSelectors(prev => prev.map((field, currentIndex) => (
      currentIndex === index ? { ...field, selector } : field
    )));
  };

  const updateFieldLabels = (index: number, labelsText: string) => {
    const labels = splitPortalLines(labelsText);
    setFieldSelectors(prev => prev.map((field, currentIndex) => (
      currentIndex === index ? { ...field, labels } : field
    )));
  };

  useEffect(() => {
    if (!selectedCredentialProfileId) {
      setIsAwaitingCredentialSave(false);
      setLastSavedCredentialProfileId(null);
      return;
    }
    if (credentialsSaved && isAwaitingCredentialSave && !hasCredentialDraft) {
      setLastSavedCredentialProfileId(selectedCredentialProfileId);
      setIsAwaitingCredentialSave(false);
      return;
    }
    if (!isSavingCredentials && isAwaitingCredentialSave && !hasCredentialDraft) {
      setIsAwaitingCredentialSave(false);
    }
  }, [credentialsSaved, hasCredentialDraft, isAwaitingCredentialSave, isSavingCredentials, selectedCredentialProfileId]);

  const saveFlowConfiguration = () => {
    if (!flow) return;
    let policyListSteps = flow.navigation.policyListSteps || [];
    try {
      const parsed = JSON.parse(policyListStepsJson || '[]');
      policyListSteps = Array.isArray(parsed) ? parsed : [];
      setPolicyListStepsError('');
    } catch {
      setPolicyListStepsError('Policy list steps must be valid JSON.');
      return;
    }

    onSaveFlow({
      ...flow,
      loginUrl: loginUrl.trim(),
      login: {
        ...flow.login,
        usernameSelector: usernameSelector.trim(),
        passwordSelector: passwordSelector.trim(),
        submitSelector: submitSelector.trim(),
      },
      navigation: {
        ...flow.navigation,
        postLoginUrl: postLoginUrl.trim() || undefined,
        nextPageSelector: nextPageSelector.trim() || undefined,
        policyListSteps,
      },
      search: {
        mode: 'policy_number',
        searchPageUrl: searchPageUrl.trim() || undefined,
        searchInputLabels: splitPortalLines(searchInputLabelsText),
        searchInputSelector: searchInputSelector.trim() || undefined,
        submitSelector: searchSubmitSelector.trim() || undefined,
        resultContainerSelector: resultContainerSelector.trim() || undefined,
        resultLinkSelector: resultLinkSelector.trim() || undefined,
        noResultsText: flow.search?.noResultsText || ['No results', 'No policies found'],
        instructions: 'Search by Navigate Wealth policy number and only open exact policy-number matches.',
      },
      extraction: {
        ...flow.extraction,
        policyRowSelector: policyRowSelector.trim(),
        fields: fieldSelectors,
      },
      policySchedule: {
        ...(flow.policySchedule || {}),
        enabled: policyScheduleEnabled,
        downloadLabels: splitPortalLines(policyScheduleLabelsText),
        downloadSelector: policyScheduleSelector.trim() || undefined,
        documentType: flow.policySchedule?.documentType || 'policy_schedule',
        required: true,
        waitForDownloadMs: flow.policySchedule?.waitForDownloadMs || 45000,
      },
      needsDiscovery: false,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-600" />
                Portal Automation
              </CardTitle>
              <CardDescription className="mt-2">
                Launch a GitHub Actions Playwright worker for {provider.name}, pause for SMS OTP, then stage extracted rows for policy review.
              </CardDescription>
            </div>
            {job && (
              <Badge variant="outline" className={cn('capitalize', statusClassNames[job.status])}>
                {job.status.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingFlow ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading portal flow...
            </div>
          ) : flow ? (
            <>
              <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Live worker mode</AlertTitle>
                <AlertDescription>
                  Provider credentials are saved server-side in Supabase and never returned to the browser. GitHub Actions starts the Playwright worker when you create a job and continues after an admin enters the SMS OTP here.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
                <div className="space-y-2">
                  <Label htmlFor="portal-login-url">Login URL</Label>
                  <Input
                    id="portal-login-url"
                    value={loginUrl}
                    onChange={(event) => setLoginUrl(event.target.value)}
                    placeholder="https://provider.example/login"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Credential Profile</Label>
                  <Select value={selectedCredentialProfileId} onValueChange={onCredentialProfileChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select credentials" />
                    </SelectTrigger>
                    <SelectContent>
                      {flow.credentialProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedProfile && (
                <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-700 space-y-4">
                  <div className="flex items-center gap-2 font-medium text-gray-900">
                    <KeyRound className="h-4 w-4" />
                    Provider credentials
                  </div>
                  <div className={cn(
                    'rounded-md border px-3 py-2 text-sm',
                    credentialsSaved
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-amber-200 bg-amber-50 text-amber-900',
                  )}>
                    <div className="flex items-center gap-2 font-medium">
                      {credentialsSaved ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                      {credentialsSaved ? 'Credentials saved' : 'Credentials not saved yet'}
                    </div>
                    <p className="mt-1 text-xs">
                      {credentialsSaved
                        ? `Stored in Supabase${credentialStatus?.updatedAt ? ` on ${new Date(credentialStatus.updatedAt).toLocaleString()}` : ''}. For security, the saved password is never shown again in the browser.`
                        : 'Enter both the username and password once, then click Save Credentials before creating a portal job.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="portal-username">Username</Label>
                      <Input
                        id="portal-username"
                        value={credentialUsername}
                        onChange={(event) => setCredentialUsername(event.target.value)}
                        placeholder={credentialStatus?.hasUsername ? 'Saved. Enter to replace.' : 'Provider username'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="portal-password">Password</Label>
                      <Input
                        id="portal-password"
                        type="password"
                        value={credentialPassword}
                        onChange={(event) => setCredentialPassword(event.target.value)}
                        placeholder={credentialStatus?.hasPassword ? 'Saved already. Enter a new password only if replacing it.' : 'Provider password'}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-gray-500">
                      {showCredentialSaveSuccess
                        ? 'Credentials were saved successfully. You can create a portal job now.'
                        : credentialsSaved
                          ? 'You only need to re-enter a field if you want to replace the saved value.'
                          : 'The first save requires both fields.'}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAwaitingCredentialSave(true);
                        onSaveCredentials(selectedProfile.id, {
                          username: credentialUsername,
                          password: credentialPassword || undefined,
                        });
                        setCredentialPassword('');
                      }}
                      disabled={!canSaveCredentials}
                    >
                      {isSavingCredentials ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                      {credentialsSaved ? 'Update Credentials' : 'Save Credentials'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-lg border bg-white p-4 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-md bg-purple-50 p-2 text-purple-700">
                    <Search className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Policy Search Setup</h4>
                    <p className="text-sm text-gray-500">
                      The worker starts from Navigate Wealth policies, searches {provider.name} by policy number, opens exact matches, then extracts the mapped values.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Search page URL</Label>
                    <Input value={searchPageUrl} onChange={(event) => setSearchPageUrl(event.target.value)} placeholder="Optional; if unreachable the worker will search using the configured path." />
                    <p className="text-xs text-gray-500">
                      Optional. Use this when the provider has a dedicated policy search page.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Search box words</Label>
                    <Input
                      value={searchInputLabelsText.replace(/\n/g, ', ')}
                      onChange={(event) => setSearchInputLabelsText(event.target.value)}
                      placeholder="Policy number, Account number, Search"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h5 className="font-medium text-gray-900">Values To Extract</h5>
                    <p className="text-sm text-gray-500">These come from your mapping configuration. Add the words Allan Gray uses beside each value.</p>
                  </div>
                  {mappingSourceHeaders.length === 0 ? (
                    <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Mapping needed first</AlertTitle>
                      <AlertDescription>
                        Save your column mappings first. The portal worker uses those mapped source headers to know which provider values to extract.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-3">
                      {fieldSelectors.map((field, index) => (
                        <div key={`${field.sourceHeader}-${index}`} className="grid grid-cols-1 gap-2 rounded-md border bg-gray-50 p-3 md:grid-cols-[180px_1fr] md:items-start">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{field.sourceHeader}</p>
                            {field.required && <p className="text-xs text-red-600">Required</p>}
                          </div>
                          <Textarea
                            value={(field.labels || []).join(', ')}
                            onChange={(event) => updateFieldLabels(index, event.target.value)}
                            className="min-h-10 bg-white"
                            placeholder={`Provider labels for ${field.sourceHeader}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-md border bg-gray-50 p-4 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-white p-2 text-purple-700">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-900">Policy Schedule PDF</h5>
                        <p className="text-sm text-gray-500">
                          When enabled, the worker downloads the provider PDF and replaces the PDF already attached to the matched policy.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="policy-schedule-enabled" className="text-sm text-gray-700">
                        Attach PDF
                      </Label>
                      <Switch
                        id="policy-schedule-enabled"
                        checked={policyScheduleEnabled}
                        onCheckedChange={setPolicyScheduleEnabled}
                      />
                    </div>
                  </div>

                  {policyScheduleEnabled && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Download button words</Label>
                        <Textarea
                          value={policyScheduleLabelsText}
                          onChange={(event) => setPolicyScheduleLabelsText(event.target.value)}
                          className="min-h-20 bg-white"
                          placeholder="Policy schedule, Download PDF, Statement"
                        />
                        <p className="text-xs text-gray-500">
                          Put each phrase on a new line. The worker tries these before advanced selectors.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Download selector</Label>
                        <Input
                          value={policyScheduleSelector}
                          onChange={(event) => setPolicyScheduleSelector(event.target.value)}
                          placeholder="Optional CSS selector"
                        />
                        <p className="text-xs text-gray-500">
                          Leave blank unless the provider page has several similar download buttons.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <details className="rounded-md border bg-gray-50 p-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-gray-900">
                    <Settings2 className="h-4 w-4" />
                    Advanced Playwright settings
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Username selector</Label>
                        <Input value={usernameSelector} onChange={(event) => setUsernameSelector(event.target.value)} placeholder="input[name='username']" />
                      </div>
                      <div className="space-y-2">
                        <Label>Password selector</Label>
                        <Input value={passwordSelector} onChange={(event) => setPasswordSelector(event.target.value)} placeholder="input[type='password']" />
                      </div>
                      <div className="space-y-2">
                        <Label>Login button selector</Label>
                        <Input value={submitSelector} onChange={(event) => setSubmitSelector(event.target.value)} placeholder="button[type='submit']" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Search input selector</Label>
                        <Input value={searchInputSelector} onChange={(event) => setSearchInputSelector(event.target.value)} placeholder="Optional CSS selector" />
                      </div>
                      <div className="space-y-2">
                        <Label>Search button selector</Label>
                        <Input value={searchSubmitSelector} onChange={(event) => setSearchSubmitSelector(event.target.value)} placeholder="button:has-text('Search')" />
                      </div>
                      <div className="space-y-2">
                        <Label>Result row selector</Label>
                        <Input value={resultContainerSelector} onChange={(event) => setResultContainerSelector(event.target.value)} placeholder="table tbody tr" />
                      </div>
                      <div className="space-y-2">
                        <Label>Open result selector</Label>
                        <Input value={resultLinkSelector} onChange={(event) => setResultLinkSelector(event.target.value)} placeholder="a, button" />
                      </div>
                      <div className="space-y-2">
                        <Label>Post-login URL</Label>
                        <Input value={postLoginUrl} onChange={(event) => setPostLoginUrl(event.target.value)} placeholder="Optional; if unreachable the worker will use click steps." />
                        <p className="text-xs text-gray-500">
                          Optional shortcut after login. Leave blank if the provider lands on the correct page already.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Next page selector</Label>
                        <Input value={nextPageSelector} onChange={(event) => setNextPageSelector(event.target.value)} placeholder="button:has-text('Next')" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Extra navigation steps JSON</Label>
                      <Textarea
                        value={policyListStepsJson}
                        onChange={(event) => setPolicyListStepsJson(event.target.value)}
                        className="min-h-24 font-mono text-xs bg-white"
                        placeholder='[{"id":"open-policies","action":"click","selector":"a:has-text(\"Policies\")"}]'
                      />
                      {policyListStepsError && <p className="text-sm text-red-700">{policyListStepsError}</p>}
                    </div>
                    {fieldSelectors.length > 0 && (
                      <div className="space-y-3">
                        <Label>Advanced field selectors</Label>
                        {fieldSelectors.map((field, index) => (
                          <div key={`${field.sourceHeader}-selector-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr] md:items-center">
                            <span className="text-sm font-medium text-gray-700">{field.sourceHeader}</span>
                            <Input
                              value={field.selector}
                              onChange={(event) => updateFieldSelector(index, event.target.value)}
                              placeholder="Optional CSS selector fallback"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>

                <div className="flex justify-end">
                  <Button type="button" variant="outline" onClick={saveFlowConfiguration} disabled={isSavingFlow}>
                    {isSavingFlow ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Save Search Setup
                  </Button>
                </div>
              </div>

              {flow.notes.length > 0 && (
                <div className="space-y-2">
                  <Label>Flow Notes</Label>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {flow.notes.map((note) => (
                      <li key={note}>- {note}</li>
                    ))}
                  </ul>
                </div>
              )}

              {setupWarnings.length > 0 && (
                <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Fallback path still needed</AlertTitle>
                  <AlertDescription>
                    {setupWarnings.join(' ')}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => onCreateJob(selectedCredentialProfileId, runMode)}
                  disabled={!selectedCredentialProfileId || !credentialStatus?.hasUsername || !credentialStatus?.hasPassword || isCreatingJob}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isCreatingJob ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Start Policy Update
                </Button>
                <Select value={runMode} onValueChange={(value) => setRunMode(value as PortalJobRunMode)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="run">Update policies</SelectItem>
                    <SelectItem value="dry-run">Dry run only</SelectItem>
                    <SelectItem value="discover">Discover page hints</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={onRefreshJob} disabled={!job || isRefreshingJob}>
                  {isRefreshingJob ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Refresh Job
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">No portal flow is available for this provider yet.</p>
          )}
        </CardContent>
      </Card>

      {job && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Job</CardTitle>
            <CardDescription>GitHub Actions runs the Playwright worker and updates this status automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-medium">Step</p>
                <p className="text-sm font-semibold text-gray-900">{job.currentStep || '-'}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-medium">Current policy</p>
                <p className="text-sm font-semibold text-gray-900">{job.currentPolicyNumber || '-'}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-medium">Updated</p>
                <p className="text-sm font-semibold text-gray-900">{new Date(job.updatedAt).toLocaleTimeString()}</p>
              </div>
            </div>

            {queueSummary.total > 0 && (
              <div className="rounded-lg border bg-white p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-purple-700" />
                    <h4 className="font-medium text-gray-900">Policy Queue</h4>
                  </div>
                  <span className="text-sm text-gray-500">{progressPercent}% processed</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full bg-purple-600 transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  <div>
                    <p className="text-[10px] uppercase text-gray-500">Total</p>
                    <p className="font-semibold">{queueSummary.total}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-gray-500">Waiting</p>
                    <p className="font-semibold">{queueSummary.queued}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-gray-500">Working</p>
                    <p className="font-semibold">{queueSummary.inProgress}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-gray-500">Complete</p>
                    <p className="font-semibold">{queueSummary.completed}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-gray-500">Needs attention</p>
                    <p className="font-semibold">{queueSummary.failed}</p>
                  </div>
                </div>
                {job.currentClientName && (
                  <p className="text-sm text-gray-600">
                    Working on <span className="font-medium text-gray-900">{job.currentClientName}</span>
                    {job.currentPolicyNumber ? ` / ${job.currentPolicyNumber}` : ''}.
                  </p>
                )}
              </div>
            )}

            <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-700">
              <p><span className="font-medium text-gray-900">Run mode:</span> {(job.runMode || 'discover').replace('-', ' ')}</p>
              <p><span className="font-medium text-gray-900">Worker:</span> {job.workerId || 'Waiting for GitHub Actions'}</p>
              {job.actionsRunUrl && (
                <p>
                  <span className="font-medium text-gray-900">GitHub run:</span>{' '}
                  <a className="text-purple-700 hover:underline" href={job.actionsRunUrl} target="_blank" rel="noreferrer">
                    Open workflow
                  </a>
                </p>
              )}
              {job.actionsDispatchError && <p className="text-red-700">{job.actionsDispatchError}</p>}
            </div>

            <p className="text-sm text-gray-600">{job.message || 'Waiting for worker status.'}</p>
            {currentJobWarning && (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Worker warning</AlertTitle>
                <AlertDescription>{currentJobWarning}</AlertDescription>
              </Alert>
            )}
            {job.error && <p className="text-sm text-red-700">{job.error}</p>}

            {job.status === 'waiting_for_otp' && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-amber-700">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">Enter the SMS OTP from your phone</span>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      value={otp}
                      onChange={(event) => setOtp(event.target.value)}
                      placeholder="Enter OTP"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                    />
                    <Button
                      onClick={() => {
                        onSubmitOtp(otp);
                        setOtp('');
                      }}
                      disabled={otp.trim().length < 4 || isSubmittingOtp}
                    >
                      {isSubmittingOtp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Submit OTP
                    </Button>
                  </div>
                </div>
              </>
            )}

            <Separator />
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Policy Worklist</h4>
                  <p className="text-sm text-gray-500">Each policy is searched, extracted, and saved independently so a stopped job can resume without starting over.</p>
                </div>
                {isLoadingJobItems && (
                  <span className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating
                  </span>
                )}
              </div>

              {jobItems.length === 0 ? (
                <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
                  The policy queue will appear after a policy update job is created.
                </div>
              ) : (
                <div className="rounded-lg border bg-white overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium text-gray-600">Status</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Client</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Policy Number</th>
                        <th className="px-3 py-2 font-medium text-gray-600">PDF</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Step</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobItems.map((item) => (
                        <tr key={item.id} className="border-t align-top">
                          <td className="px-3 py-2">
                            <Badge variant="outline" className={cn('capitalize', itemStatusClassNames[item.status])}>
                              {item.status.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900">{item.clientName}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.policyNumber}</td>
                          <td className="px-3 py-2">
                            {item.documentAttached ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Attached
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                            {item.documentFileName && (
                              <div className="mt-1 max-w-[160px] truncate text-xs text-gray-500" title={item.documentFileName}>
                                {item.documentFileName}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            <div>{item.currentStep || '-'}</div>
                            {latestPortalWarning(item.warning, item.warnings) && (
                              <div className="mt-1 max-w-md text-xs text-amber-700">{latestPortalWarning(item.warning, item.warnings)}</div>
                            )}
                            {item.error && <div className="mt-1 max-w-md text-xs text-red-700">{item.error}</div>}
                          </td>
                          <td className="px-3 py-2">
                            {item.status === 'failed' ? (
                              <Button type="button" variant="outline" size="sm" onClick={() => onRetryItem(item)}>
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Retry
                              </Button>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {isLoadingDiscoveryReport && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading discovery report...
              </div>
            )}

            {discoveryReport && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Discovery Report</h4>
                    <p className="text-sm text-gray-500">
                      {discoveryReport.mode === 'dry-run' ? 'Dry run' : 'Discovery'} captured from {discoveryReport.urlHost || 'provider portal'} for {selectedCategoryId}.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <div className="rounded-lg border bg-gray-50 p-3">
                      <p className="text-[10px] uppercase text-gray-500">Inputs</p>
                      <p className="font-semibold">{discoveryReport.summary.inputCount}</p>
                    </div>
                    <div className="rounded-lg border bg-gray-50 p-3">
                      <p className="text-[10px] uppercase text-gray-500">Buttons</p>
                      <p className="font-semibold">{discoveryReport.summary.buttonCount}</p>
                    </div>
                    <div className="rounded-lg border bg-gray-50 p-3">
                      <p className="text-[10px] uppercase text-gray-500">Links</p>
                      <p className="font-semibold">{discoveryReport.summary.linkCount}</p>
                    </div>
                    <div className="rounded-lg border bg-gray-50 p-3">
                      <p className="text-[10px] uppercase text-gray-500">Tables</p>
                      <p className="font-semibold">{discoveryReport.summary.tableCount}</p>
                    </div>
                    <div className="rounded-lg border bg-gray-50 p-3">
                      <p className="text-[10px] uppercase text-gray-500">Rows</p>
                      <p className="font-semibold">{discoveryReport.summary.extractedRowCount ?? '-'}</p>
                    </div>
                  </div>

                  {discoveryReport.warnings.length > 0 && (
                    <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Selector work still needed</AlertTitle>
                      <AlertDescription>
                        {discoveryReport.warnings.slice(0, 3).join(' ')}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="rounded-lg border bg-white p-4 space-y-4">
                    <div>
                      <h5 className="font-medium text-gray-900">Apply Selectors To Flow</h5>
                      <p className="text-sm text-gray-500">Use discovery candidates to tighten the Playwright extraction flow, then run dry-run again before staging.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Policy Row Selector</Label>
                      <Input
                        value={policyRowSelector}
                        onChange={(event) => setPolicyRowSelector(event.target.value)}
                        placeholder="table tbody tr"
                      />
                      {policyRowCandidates.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {policyRowCandidates.slice(0, 3).map((candidate) => (
                            <Button
                              key={candidate.selector}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setPolicyRowSelector(candidate.selector)}
                            >
                              Use {candidate.confidence} candidate
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>

                    {fieldSelectors.length > 0 && (
                      <div className="space-y-3">
                        <Label>Field Selectors</Label>
                        {fieldSelectors.map((field, index) => (
                          <div key={`${field.sourceHeader}-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr] md:items-center">
                            <span className="text-sm font-medium text-gray-700">{field.sourceHeader}</span>
                            <Input
                              value={field.selector}
                              onChange={(event) => updateFieldSelector(index, event.target.value)}
                              placeholder="td:nth-child(1)"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button
                        onClick={() => onApplyFlow({ policyRowSelector: policyRowSelector.trim(), fields: fieldSelectors })}
                        disabled={isApplyingFlow || !policyRowSelector.trim()}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {isApplyingFlow ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Apply To Flow
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-white overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left">
                        <tr>
                          <th className="px-3 py-2 font-medium text-gray-600">Purpose</th>
                          <th className="px-3 py-2 font-medium text-gray-600">Selector</th>
                          <th className="px-3 py-2 font-medium text-gray-600">Confidence</th>
                          <th className="px-3 py-2 font-medium text-gray-600">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {discoveryReport.selectorCandidates.slice(0, 12).map((candidate, index) => (
                          <tr key={`${candidate.selector}-${index}`} className="border-t">
                            <td className="px-3 py-2 capitalize">{candidate.purpose.replace('_', ' ')}</td>
                            <td className="px-3 py-2 font-mono text-xs break-all">{candidate.selector}</td>
                            <td className="px-3 py-2 capitalize">{candidate.confidence}</td>
                            <td className="px-3 py-2 text-gray-500">{candidate.notes || candidate.label || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
