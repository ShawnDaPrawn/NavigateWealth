import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/alert';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  KeyRound,
  ListChecks,
  Loader2,
  RotateCcw,
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
import { SetupStepIndicator } from './SetupStepIndicator';
import { ProviderCredentialsSection } from './ProviderCredentialsSection';
import { ProviderAdvancedSheet } from './ProviderAdvancedSheet';

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

            <ProviderCredentialsSection
              setupSteps={setupSteps}
              flow={flow}
              selectedProfile={selectedProfile}
              selectedCredentialProfileId={selectedCredentialProfileId}
              onCredentialProfileChange={onCredentialProfileChange}
              credentialStatus={credentialStatus}
              credentialsSaved={credentialsSaved}
              showCredentialFields={showCredentialFields}
              showCredentialSaveSuccess={showCredentialSaveSuccess}
              credentialUsername={credentialUsername}
              setCredentialUsername={setCredentialUsername}
              credentialPassword={credentialPassword}
              setCredentialPassword={setCredentialPassword}
              isEditingCredentials={isEditingCredentials}
              setIsEditingCredentials={setIsEditingCredentials}
              setIsAwaitingCredentialSave={setIsAwaitingCredentialSave}
              buildFlowDraft={buildFlowDraft}
              onSaveFlow={onSaveFlow}
              onSaveCredentials={onSaveCredentials}
              canSaveCredentials={canSaveCredentials}
              isSavingCredentials={isSavingCredentials}
            />

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

            <ProviderAdvancedSheet
              selectedScopeLabel={selectedScopeLabel}
              provider={provider}
              brainMemory={brainMemory}
              smartAssistReady={smartAssistReady}
              usernameSelector={usernameSelector}
              setUsernameSelector={setUsernameSelector}
              passwordSelector={passwordSelector}
              setPasswordSelector={setPasswordSelector}
              submitSelector={submitSelector}
              setSubmitSelector={setSubmitSelector}
              searchInputSelector={searchInputSelector}
              setSearchInputSelector={setSearchInputSelector}
              searchSubmitSelector={searchSubmitSelector}
              setSearchSubmitSelector={setSearchSubmitSelector}
              resultContainerSelector={resultContainerSelector}
              setResultContainerSelector={setResultContainerSelector}
              resultLinkSelector={resultLinkSelector}
              setResultLinkSelector={setResultLinkSelector}
              postLoginUrl={postLoginUrl}
              setPostLoginUrl={setPostLoginUrl}
              nextPageSelector={nextPageSelector}
              setNextPageSelector={setNextPageSelector}
              policyListStepsJson={policyListStepsJson}
              setPolicyListStepsJson={setPolicyListStepsJson}
              policyListStepsError={policyListStepsError}
              smartAssistGoal={smartAssistGoal}
              setSmartAssistGoal={setSmartAssistGoal}
              policyScheduleLabelsText={policyScheduleLabelsText}
              setPolicyScheduleLabelsText={setPolicyScheduleLabelsText}
              policyScheduleSelector={policyScheduleSelector}
              setPolicyScheduleSelector={setPolicyScheduleSelector}
              fieldSelectors={fieldSelectors}
              updateFieldSelector={updateFieldSelector}
              saveSetupButton={saveSetupButton}
            />
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
