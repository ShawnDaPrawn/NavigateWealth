import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/alert';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../../../ui/sheet';
import { Switch } from '../../../../ui/switch';
import { Textarea } from '../../../../ui/textarea';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  KeyRound,
  ListChecks,
  Loader2,
  RotateCcw,
  Settings2,
} from 'lucide-react';
import {
  IntegrationFieldBinding,
  IntegrationProvider,
  PortalBrainMemorySummary,
  PortalCredentialStatus,
  PortalFlowField,
  PortalProviderFlow,
  PRODUCT_CATEGORIES,
} from '../types';
import { cn } from '../../../../ui/utils';
import { normaliseIntegrationLabelList } from '@/shared/integrations/binding-utils';
import {
  computePortalSetupSteps,
  splitPortalLines,
  getPortalFieldColumnName,
  getPortalFieldTitle,
  getPortalFieldKey,
  getBindingKey,
} from './portal-automation/portalHelpers';

interface ProviderSetupTabProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
  flow?: PortalProviderFlow;
  brainMemory?: PortalBrainMemorySummary;
  isLoadingFlow: boolean;
  credentialStatus?: PortalCredentialStatus;
  mappingBindings: IntegrationFieldBinding[];
  selectedCredentialProfileId: string;
  onCredentialProfileChange: (profileId: string) => void;
  isSavingCredentials: boolean;
  isSavingFlow: boolean;
  isResettingFlow: boolean;
  onSaveCredentials: (
    profileId: string,
    credentials: { username: string; password?: string },
  ) => void;
  onSaveFlow: (flow: PortalProviderFlow) => void;
  onResetFlow: () => void;
  onOpenMappingTab: () => void;
  fieldSelectors: PortalFlowField[];
  updateFieldSelector: (index: number, selector: string) => void;
  updateFieldRequired: (index: number, required: boolean) => void;
  buildProviderFallbackFields: () => PortalFlowField[];
}

function SetupStepIndicator({ complete, stepNumber }: { complete: boolean; stepNumber: number }) {
  return complete ? (
    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-label="Step complete" />
  ) : (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-[11px] font-medium text-gray-600">
      {stepNumber}
    </span>
  );
}

export function ProviderSetupTab({
  provider,
  selectedCategoryId,
  flow,
  brainMemory,
  isLoadingFlow,
  credentialStatus,
  mappingBindings,
  selectedCredentialProfileId,
  onCredentialProfileChange,
  isSavingCredentials,
  isSavingFlow,
  isResettingFlow,
  onSaveCredentials,
  onSaveFlow,
  onResetFlow,
  onOpenMappingTab,
  fieldSelectors,
  updateFieldSelector,
  updateFieldRequired,
  buildProviderFallbackFields,
}: ProviderSetupTabProps) {
  const [credentialUsername, setCredentialUsername] = useState('');
  const [credentialPassword, setCredentialPassword] = useState('');
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);
  const [isAwaitingCredentialSave, setIsAwaitingCredentialSave] = useState(false);
  const [lastSavedCredentialProfileId, setLastSavedCredentialProfileId] = useState<string | null>(
    null,
  );
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
  const [smartAssistEnabled, setSmartAssistEnabled] = useState(false);
  const [smartAssistGoal, setSmartAssistGoal] = useState('');
  const [policyScheduleLabelsText, setPolicyScheduleLabelsText] = useState('');
  const [policyScheduleSelector, setPolicyScheduleSelector] = useState('');
  const [nextPageSelector, setNextPageSelector] = useState('');
  const [policyListStepsJson, setPolicyListStepsJson] = useState('[]');
  const [policyListStepsError, setPolicyListStepsError] = useState('');

  const selectedCategoryName =
    PRODUCT_CATEGORIES.find((c) => c.id === selectedCategoryId)?.name || selectedCategoryId;
  const selectedScopeLabel = `${provider.name} / ${selectedCategoryName}`;

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
      setSearchInputLabelsText(
        (flow.search?.searchInputLabels || ['Policy number', 'Search']).join('\n'),
      );
      setSearchInputSelector(flow.search?.searchInputSelector || '');
      setSearchSubmitSelector(flow.search?.submitSelector || '');
      setResultContainerSelector(flow.search?.resultContainerSelector || '');
      setResultLinkSelector(flow.search?.resultLinkSelector || '');
      setSmartAssistEnabled(flow.search?.brain?.enabled === true);
      setSmartAssistGoal(flow.search?.brain?.goal || '');
      setPolicyScheduleLabelsText(
        (
          flow.policySchedule?.downloadLabels || [
            'Policy schedule',
            'Download policy schedule',
            'Download PDF',
            'Statement',
          ]
        ).join('\n'),
      );
      setPolicyScheduleSelector(flow.policySchedule?.downloadSelector || '');
      setNextPageSelector(flow.navigation.nextPageSelector || '');
      setPolicyListStepsJson(JSON.stringify(flow.navigation.policyListSteps || [], null, 2));
    }
  }, [flow]);

  const selectedProfile = flow?.credentialProfiles.find(
    (p) => p.id === selectedCredentialProfileId,
  );
  const credentialsSaved = Boolean(credentialStatus?.hasUsername && credentialStatus?.hasPassword);
  const hasCredentialDraft = Boolean(credentialUsername.trim() || credentialPassword);

  useEffect(() => {
    if (!selectedCredentialProfileId) {
      setIsAwaitingCredentialSave(false);
      setLastSavedCredentialProfileId(null);
      return;
    }
    if (credentialsSaved && isAwaitingCredentialSave && !hasCredentialDraft) {
      setLastSavedCredentialProfileId(selectedCredentialProfileId);
      setIsEditingCredentials(false);
      setIsAwaitingCredentialSave(false);
      return;
    }
    if (!isSavingCredentials && isAwaitingCredentialSave && !hasCredentialDraft) {
      setIsAwaitingCredentialSave(false);
    }
  }, [
    credentialsSaved,
    hasCredentialDraft,
    isAwaitingCredentialSave,
    isSavingCredentials,
    selectedCredentialProfileId,
  ]);
  const showCredentialFields = Boolean(
    selectedProfile && (!credentialsSaved || isEditingCredentials),
  );
  const canSaveCredentials = Boolean(
    selectedProfile &&
    !isSavingCredentials &&
    showCredentialFields &&
    (credentialsSaved
      ? credentialUsername.trim() || credentialPassword
      : credentialUsername.trim() && credentialPassword),
  );
  const showCredentialSaveSuccess =
    credentialsSaved && lastSavedCredentialProfileId === selectedCredentialProfileId;

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
  const smartAssistReady = Boolean(brainMemory?.available && brainMemory?.configured);
  const smartAssistStatusLabel = !brainMemory?.available
    ? smartAssistEnabled
      ? 'Unavailable'
      : 'Needs key'
    : smartAssistEnabled
      ? 'Armed'
      : 'Off';
  const setupWarnings = [
    postLoginUrl.trim() && !hasPostLoginFallback
      ? 'A post-login page URL is set, but there is no click-step or search fallback if that page cannot be opened.'
      : '',
    searchPageUrl.trim() && !hasSearchFallback
      ? 'A search page URL is set, but there is no search selector or search-box wording configured if that page cannot be opened.'
      : '',
    smartAssistEnabled && !brainMemory?.available
      ? 'Smart search assist is enabled here, but the Google AI key is not configured on the Supabase backend yet.'
      : '',
  ].filter(Boolean);

  const setupSteps = computePortalSetupSteps({
    loginUrl,
    credentialsSaved,
    searchLabels,
    searchInputSelector,
    mappingBindingCount: mappingBindings.length,
    fieldSelectorCount: fieldSelectors.length,
  });
  const completedSteps = setupSteps.filter((step) => step.complete).length;
  const setupComplete = completedSteps === setupSteps.length;

  const getBindingForPortalField = (field: PortalFlowField) =>
    mappingBindings.find(
      (binding) =>
        getBindingKey(binding) === getPortalFieldKey(field) ||
        String(binding.columnName || '').trim() === getPortalFieldColumnName(field),
    );

  const buildPolicyScheduleDraft = (): PortalProviderFlow['policySchedule'] => ({
    ...(flow?.policySchedule || {}),
    enabled: flow?.policySchedule?.enabled === true,
    downloadLabels: splitPortalLines(policyScheduleLabelsText),
    downloadSelector: policyScheduleSelector.trim() || undefined,
    downloadMenuLabels: flow?.policySchedule?.downloadMenuLabels || [
      'Download PDF with company logo',
      'Download PDF without company logo',
    ],
    documentType: flow?.policySchedule?.documentType || 'policy_schedule',
    required: false,
    waitForDownloadMs: flow?.policySchedule?.waitForDownloadMs || 45000,
  });

  const buildFlowDraft = (): PortalProviderFlow | null => {
    if (!flow) return null;
    let policyListSteps;
    try {
      const parsed = JSON.parse(policyListStepsJson || '[]');
      policyListSteps = Array.isArray(parsed) ? parsed : [];
      setPolicyListStepsError('');
    } catch {
      setPolicyListStepsError('Policy list steps must be valid JSON.');
      return null;
    }
    return {
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
        instructions:
          'Search by Navigate Wealth policy number and only open exact policy-number matches.',
        brain: {
          enabled: smartAssistEnabled,
          goal:
            smartAssistGoal.trim() ||
            `Use the main provider search journey to find the exact policy number for ${provider.name}.`,
          maxDecisionsPerItem: flow.search?.brain?.maxDecisionsPerItem || 2,
          rememberSelectors: flow.search?.brain?.rememberSelectors ?? true,
        },
      },
      extraction: {
        ...flow.extraction,
        policyRowSelector: flow.extraction.policyRowSelector,
        fields: buildProviderFallbackFields(),
      },
      policySchedule: buildPolicyScheduleDraft(),
      needsDiscovery: false,
    };
  };

  const saveFlowConfiguration = () => {
    const draft = buildFlowDraft();
    if (!draft) return;
    onSaveFlow(draft);
  };

  const saveSetupButton = (
    <Button type="button" onClick={saveFlowConfiguration} disabled={isSavingFlow}>
      {isSavingFlow ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <CheckCircle2 className="h-4 w-4 mr-2" />
      )}
      Save Setup
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-purple-600" />
              Provider Setup
            </CardTitle>
            <CardDescription className="mt-2">
              Configure the {provider.name} portal login, credentials, search journey, and values to
              extract before running portal automation.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
              {selectedScopeLabel}
            </Badge>
            {flow && (
              <Badge
                variant="outline"
                className={cn(
                  setupComplete
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-amber-200 bg-amber-50 text-amber-800',
                )}
              >
                {completedSteps} of {setupSteps.length} steps complete
              </Badge>
            )}
          </div>
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
            <Alert className="border-blue-200 bg-blue-50 text-blue-900">
              <ListChecks className="h-4 w-4" />
              <AlertTitle>Provider login is shared. This product flow is isolated.</AlertTitle>
              <AlertDescription>
                Jobs, staged results, and flow settings here are only for {selectedCategoryName}.
                Credentials stay saved server-side and are not shown in the browser.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <SetupStepIndicator complete={setupSteps[0].complete} stepNumber={1} />
                <Label htmlFor="portal-login-url" className="font-medium text-gray-900">
                  Login URL
                </Label>
              </div>
              <Input
                id="portal-login-url"
                value={loginUrl}
                onChange={(event) => setLoginUrl(event.target.value)}
                placeholder="https://provider.example/login"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <SetupStepIndicator complete={setupSteps[1].complete} stepNumber={2} />
                <span className="font-medium text-gray-900">Provider credentials</span>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
                <div className="space-y-2">
                  <Label>Credential Profile</Label>
                  <Select
                    value={selectedCredentialProfileId}
                    onValueChange={onCredentialProfileChange}
                  >
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
                {selectedProfile && (
                  <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-700 space-y-4">
                    <div
                      className={cn(
                        'rounded-md border px-3 py-2 text-sm',
                        credentialsSaved
                          ? 'border-green-200 bg-green-50 text-green-800'
                          : 'border-amber-200 bg-amber-50 text-amber-900',
                      )}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        {credentialsSaved ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        {credentialsSaved ? 'Credentials saved' : 'Credentials not saved yet'}
                      </div>
                      <p className="mt-1 text-xs">
                        {credentialsSaved
                          ? `Stored in Supabase${credentialStatus?.updatedAt ? ` on ${new Date(credentialStatus.updatedAt).toLocaleString()}` : ''}. For security, the saved password is never shown again in the browser.`
                          : 'Enter both the username and password once, then click Save Credentials before creating a portal job.'}
                      </p>
                    </div>
                    {showCredentialFields && (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="portal-username">Username</Label>
                          <Input
                            id="portal-username"
                            value={credentialUsername}
                            onChange={(event) => setCredentialUsername(event.target.value)}
                            placeholder={
                              credentialStatus?.hasUsername
                                ? 'Leave blank to keep saved username'
                                : 'Provider username'
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="portal-password">Password</Label>
                          <Input
                            id="portal-password"
                            type="password"
                            value={credentialPassword}
                            onChange={(event) => setCredentialPassword(event.target.value)}
                            placeholder={
                              credentialStatus?.hasPassword
                                ? 'Leave blank to keep saved password'
                                : 'Provider password'
                            }
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-gray-500">
                        {showCredentialSaveSuccess
                          ? 'Credentials were saved successfully. You can create a portal job now.'
                          : credentialsSaved
                            ? 'Saved credentials are locked. Open update mode only when you need to replace a saved value.'
                            : 'The first save requires both fields.'}
                      </p>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {credentialsSaved && !isEditingCredentials ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setCredentialUsername('');
                              setCredentialPassword('');
                              setIsEditingCredentials(true);
                            }}
                          >
                            <KeyRound className="h-4 w-4 mr-2" />
                            Update Credentials
                          </Button>
                        ) : (
                          <>
                            {credentialsSaved && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  setCredentialUsername('');
                                  setCredentialPassword('');
                                  setIsEditingCredentials(false);
                                }}
                              >
                                Cancel
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const draft = buildFlowDraft();
                                if (draft) onSaveFlow(draft);
                                setIsAwaitingCredentialSave(true);
                                onSaveCredentials(selectedProfile.id, {
                                  username: credentialUsername,
                                  password: credentialPassword || undefined,
                                });
                                setCredentialUsername('');
                                setCredentialPassword('');
                              }}
                              disabled={!canSaveCredentials}
                            >
                              {isSavingCredentials ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <KeyRound className="h-4 w-4 mr-2" />
                              )}
                              {credentialsSaved ? 'Save Updated Credentials' : 'Save Credentials'}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <SetupStepIndicator complete={setupSteps[2].complete} stepNumber={3} />
                <span className="font-medium text-gray-900">Policy search</span>
              </div>
              <p className="text-sm text-gray-500">
                The worker starts from Navigate Wealth policies, searches {provider.name} by policy
                number, opens exact matches, then extracts the mapped values.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Search box words</Label>
                  <Input
                    value={searchInputLabelsText.replace(/\n/g, ', ')}
                    onChange={(event) => setSearchInputLabelsText(event.target.value)}
                    placeholder="Policy number, Account number, Search"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Search page URL</Label>
                  <Input
                    value={searchPageUrl}
                    onChange={(event) => setSearchPageUrl(event.target.value)}
                    placeholder="Optional; only if the provider has a dedicated search page."
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Bot className="h-4 w-4 text-purple-700" />
                  <span className="font-medium text-gray-900">Smart Search Assist</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      brainMemory?.available
                        ? smartAssistEnabled
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-white text-gray-600'
                        : 'border-amber-200 bg-amber-50 text-amber-800',
                    )}
                  >
                    {smartAssistStatusLabel}
                  </Badge>
                </div>
                <Switch
                  id="smart-assist-enabled"
                  aria-label="Enable smart search assist"
                  checked={smartAssistEnabled}
                  onCheckedChange={setSmartAssistEnabled}
                />
              </div>
              <p className="text-xs text-gray-500">
                Used only when the normal search path cannot confidently find the next step. The
                search goal and learned-selector stats live under Advanced &amp; diagnostics.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <SetupStepIndicator complete={setupSteps[3].complete} stepNumber={4} />
                <span className="font-medium text-gray-900">Values to extract</span>
              </div>
              <p className="text-sm text-gray-500">
                These come directly from Mapping Configuration. The spreadsheet column name stays
                fixed there, along with the provider wording and any category-specific selector
                override.
              </p>
              {mappingBindings.length === 0 ? (
                <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Mapping needed first</AlertTitle>
                  <AlertDescription>
                    Save your column mappings first. The portal worker uses those mapped columns as
                    the canonical update format, and the labels here tell it what to look for on the
                    provider page.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {fieldSelectors.map((field, index) => {
                    const binding = getBindingForPortalField(field);
                    const bindingLabels = normaliseIntegrationLabelList(binding?.portalLabels);
                    const effectiveLabels =
                      bindingLabels.length > 0
                        ? bindingLabels
                        : normaliseIntegrationLabelList(field.labels);
                    const effectiveSelector = String(
                      binding?.portalSelector || field.selector || '',
                    ).trim();
                    const visibleLabels = effectiveLabels.slice(0, 3);
                    return (
                      <div
                        key={`${getPortalFieldKey(field)}-${index}`}
                        className="grid grid-cols-1 gap-3 rounded-md border bg-gray-50 p-3 md:grid-cols-[200px_1fr_120px] md:items-start"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {getPortalFieldTitle(field)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Spreadsheet column: {getPortalFieldColumnName(field)}
                          </p>
                        </div>
                        <div className="rounded-md border bg-white px-3 py-2 text-sm text-gray-700">
                          <div className="flex flex-wrap gap-1.5">
                            {visibleLabels.length > 0 ? (
                              visibleLabels.map((label) => (
                                <Badge
                                  key={`${getPortalFieldKey(field)}-${label}`}
                                  variant="outline"
                                  className="border-gray-200 bg-gray-50 text-[10px] text-gray-600"
                                >
                                  {label}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-gray-500">No provider labels yet</span>
                            )}
                            {effectiveLabels.length > visibleLabels.length && (
                              <Badge
                                variant="outline"
                                className="border-gray-200 bg-gray-50 text-[10px] text-gray-600"
                              >
                                +{effectiveLabels.length - visibleLabels.length} more
                              </Badge>
                            )}
                            {effectiveSelector && (
                              <Badge
                                variant="outline"
                                className="border-blue-200 bg-blue-50 text-[10px] text-blue-700"
                              >
                                Selector set
                              </Badge>
                            )}
                          </div>
                          <details className="mt-2 text-xs text-gray-500">
                            <summary className="cursor-pointer font-medium text-gray-700">
                              Provider matching hints
                            </summary>
                            <p className="mt-2">
                              <span className="font-medium text-gray-900">Labels:</span>{' '}
                              {effectiveLabels.length > 0
                                ? effectiveLabels.join(', ')
                                : 'No labels are available for this field yet'}
                            </p>
                            <p className="mt-1 break-words">
                              <span className="font-medium text-gray-900">Selector:</span>{' '}
                              {effectiveSelector ||
                                'No selector fallback is available for this field yet'}
                            </p>
                          </details>
                        </div>
                        <div className="flex items-center justify-between rounded-md border bg-white px-3 py-2 md:justify-center md:gap-2">
                          <Label
                            htmlFor={`required-field-${index}`}
                            className="text-xs text-gray-700"
                          >
                            Required
                          </Label>
                          <Switch
                            id={`required-field-${index}`}
                            checked={field.required === true}
                            onCheckedChange={(required) => updateFieldRequired(index, required)}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" onClick={onOpenMappingTab}>
                      Edit In Mapping Configuration
                    </Button>
                  </div>
                </div>
              )}
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
                <AlertDescription>{setupWarnings.join(' ')}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (
                    window.confirm(
                      `Reset only the ${selectedScopeLabel} portal flow? Provider credentials and other product flows will be kept.`,
                    )
                  ) {
                    onResetFlow();
                  }
                }}
                disabled={isResettingFlow || isSavingFlow}
              >
                {isResettingFlow ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Reset This Product Flow
              </Button>
              {saveSetupButton}
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Advanced &amp; diagnostics
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>Advanced &amp; diagnostics</SheetTitle>
                  <SheetDescription>
                    Selector overrides and tuning for {selectedScopeLabel}. The worker discovers
                    most of this on its own — only fill these in when a run gets stuck.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-6 pb-10">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">Login selectors</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label>Username selector</Label>
                        <Input
                          value={usernameSelector}
                          onChange={(event) => setUsernameSelector(event.target.value)}
                          placeholder="input[name='username']"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Password selector</Label>
                        <Input
                          value={passwordSelector}
                          onChange={(event) => setPasswordSelector(event.target.value)}
                          placeholder="input[type='password']"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Login button selector</Label>
                        <Input
                          value={submitSelector}
                          onChange={(event) => setSubmitSelector(event.target.value)}
                          placeholder="button[type='submit']"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">Search &amp; navigation</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label>Search input selector</Label>
                        <Input
                          value={searchInputSelector}
                          onChange={(event) => setSearchInputSelector(event.target.value)}
                          placeholder="Optional CSS selector"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Search button selector</Label>
                        <Input
                          value={searchSubmitSelector}
                          onChange={(event) => setSearchSubmitSelector(event.target.value)}
                          placeholder="button:has-text('Search')"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Result row selector</Label>
                        <Input
                          value={resultContainerSelector}
                          onChange={(event) => setResultContainerSelector(event.target.value)}
                          placeholder="table tbody tr"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Open result selector</Label>
                        <Input
                          value={resultLinkSelector}
                          onChange={(event) => setResultLinkSelector(event.target.value)}
                          placeholder="a, button"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Post-login URL</Label>
                        <Input
                          value={postLoginUrl}
                          onChange={(event) => setPostLoginUrl(event.target.value)}
                          placeholder="Optional; if unreachable the worker will use click steps."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Next page selector</Label>
                        <Input
                          value={nextPageSelector}
                          onChange={(event) => setNextPageSelector(event.target.value)}
                          placeholder="button:has-text('Next')"
                        />
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
                      {policyListStepsError && (
                        <p className="text-sm text-red-700">{policyListStepsError}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">Smart Search Assist</h4>
                    <div className="space-y-2">
                      <Label>Search goal</Label>
                      <Textarea
                        value={smartAssistGoal}
                        onChange={(event) => setSmartAssistGoal(event.target.value)}
                        className="min-h-20 bg-white"
                        placeholder={`Use the main provider search journey to find the exact policy number for ${provider.name}.`}
                      />
                      <p className="text-xs text-gray-500">
                        Keep this simple and outcome-focused. The worker still verifies the policy
                        number before extracting anything.
                      </p>
                    </div>
                    <div className="rounded-md border bg-white p-3 text-sm text-gray-700 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-900">Backend status</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            brainMemory?.available
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : 'border-amber-200 bg-amber-50 text-amber-800',
                          )}
                        >
                          {brainMemory?.available ? 'Ready' : 'Needs Google AI key'}
                        </Badge>
                      </div>
                      <p>
                        <span className="font-medium text-gray-900">Model:</span>{' '}
                        {brainMemory?.model || 'Not configured'}
                      </p>
                      <p>
                        <span className="font-medium text-gray-900">Learned search boxes:</span>{' '}
                        {brainMemory?.searchInputHints || 0}
                      </p>
                      <p>
                        <span className="font-medium text-gray-900">Learned result openings:</span>{' '}
                        {brainMemory?.searchResultHints || 0}
                      </p>
                      <p>
                        <span className="font-medium text-gray-900">Successful assists:</span>{' '}
                        {brainMemory?.successfulDecisions || 0}
                      </p>
                      {brainMemory?.updatedAt && (
                        <p className="text-xs text-gray-500">
                          Last learned on {new Date(brainMemory.updatedAt).toLocaleString()}.
                        </p>
                      )}
                      {!brainMemory?.available && (
                        <p className="text-xs text-amber-800">
                          Add `NW_GOOGLE_AI_API_KEY` or `GEMINI_API_KEY` to the Supabase Edge
                          Function secrets to switch this on.
                        </p>
                      )}
                      {smartAssistReady && (
                        <p className="text-xs text-green-700">
                          The brain is ready and provider memory will keep getting better as
                          successful selectors are reused.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">Policy schedule PDF</h4>
                    <p className="text-xs text-gray-500">
                      Whether the PDF is requested is controlled by the &quot;PDF for this run&quot;
                      toggle next to the start button on the Portal Automation tab. These hints only
                      help the worker find the download control.
                    </p>
                    <div className="space-y-2">
                      <Label>Download button words</Label>
                      <Textarea
                        value={policyScheduleLabelsText}
                        onChange={(event) => setPolicyScheduleLabelsText(event.target.value)}
                        className="min-h-20 bg-white"
                        placeholder="Policy schedule, Download PDF, Statement"
                      />
                      <p className="text-xs text-gray-500">
                        Put each phrase on a new line. The worker tries these before advanced
                        selectors.
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

                  {fieldSelectors.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-900">
                        Advanced field selectors
                      </h4>
                      <p className="text-xs text-gray-500">
                        These are provider-level fallback selectors for discovery and dry-run
                        refinement. Category-specific labels and selector overrides live in Mapping
                        Configuration and are merged in at runtime.
                      </p>
                      {fieldSelectors.map((field, index) => (
                        <div
                          key={`${getPortalFieldKey(field)}-selector-${index}`}
                          className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr] md:items-center"
                        >
                          <div className="space-y-1">
                            <span className="text-sm font-medium text-gray-700">
                              {getPortalFieldTitle(field)}
                            </span>
                            <p className="text-xs text-gray-500">
                              {getPortalFieldColumnName(field)}
                            </p>
                          </div>
                          <Input
                            value={field.selector}
                            onChange={(event) => updateFieldSelector(index, event.target.value)}
                            placeholder="Optional CSS selector fallback"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end border-t pt-4">{saveSetupButton}</div>
                </div>
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            No portal flow is available for this provider yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
