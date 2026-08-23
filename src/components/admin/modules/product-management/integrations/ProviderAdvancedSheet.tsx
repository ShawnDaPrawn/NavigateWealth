/**
 * Advanced & diagnostics sheet of the provider setup tab: login/search
 * selector overrides, smart-assist tuning and backend status, policy
 * schedule hints, and advanced field selectors. JSX moved verbatim from
 * ProviderSetupTab.tsx; every captured name became a prop.
 */
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../../../ui/sheet';
import { Textarea } from '../../../../ui/textarea';
import { Settings2 } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import type { IntegrationProvider, PortalBrainMemorySummary, PortalFlowField } from '../types';
import {
  getPortalFieldColumnName,
  getPortalFieldKey,
  getPortalFieldTitle,
} from './portal-automation/portalHelpers';

interface ProviderAdvancedSheetProps {
  selectedScopeLabel: string;
  provider: IntegrationProvider;
  brainMemory?: PortalBrainMemorySummary;
  smartAssistReady: boolean;
  usernameSelector: string;
  setUsernameSelector: (value: string) => void;
  passwordSelector: string;
  setPasswordSelector: (value: string) => void;
  submitSelector: string;
  setSubmitSelector: (value: string) => void;
  searchInputSelector: string;
  setSearchInputSelector: (value: string) => void;
  searchSubmitSelector: string;
  setSearchSubmitSelector: (value: string) => void;
  resultContainerSelector: string;
  setResultContainerSelector: (value: string) => void;
  resultLinkSelector: string;
  setResultLinkSelector: (value: string) => void;
  postLoginUrl: string;
  setPostLoginUrl: (value: string) => void;
  nextPageSelector: string;
  setNextPageSelector: (value: string) => void;
  policyListStepsJson: string;
  setPolicyListStepsJson: (value: string) => void;
  policyListStepsError: string;
  smartAssistGoal: string;
  setSmartAssistGoal: (value: string) => void;
  policyScheduleLabelsText: string;
  setPolicyScheduleLabelsText: (value: string) => void;
  policyScheduleSelector: string;
  setPolicyScheduleSelector: (value: string) => void;
  fieldSelectors: PortalFlowField[];
  updateFieldSelector: (index: number, selector: string) => void;
  saveSetupButton: React.ReactNode;
}

export function ProviderAdvancedSheet({
  selectedScopeLabel,
  provider,
  brainMemory,
  smartAssistReady,
  usernameSelector,
  setUsernameSelector,
  passwordSelector,
  setPasswordSelector,
  submitSelector,
  setSubmitSelector,
  searchInputSelector,
  setSearchInputSelector,
  searchSubmitSelector,
  setSearchSubmitSelector,
  resultContainerSelector,
  setResultContainerSelector,
  resultLinkSelector,
  setResultLinkSelector,
  postLoginUrl,
  setPostLoginUrl,
  nextPageSelector,
  setNextPageSelector,
  policyListStepsJson,
  setPolicyListStepsJson,
  policyListStepsError,
  smartAssistGoal,
  setSmartAssistGoal,
  policyScheduleLabelsText,
  setPolicyScheduleLabelsText,
  policyScheduleSelector,
  setPolicyScheduleSelector,
  fieldSelectors,
  updateFieldSelector,
  saveSetupButton,
}: ProviderAdvancedSheetProps) {
  return (
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
            Selector overrides and tuning for {selectedScopeLabel}. The worker discovers most of
            this on its own — only fill these in when a run gets stuck.
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
                Keep this simple and outcome-focused. The worker still verifies the policy number
                before extracting anything.
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
                  Add `NW_GOOGLE_AI_API_KEY` or `GEMINI_API_KEY` to the Supabase Edge Function
                  secrets to switch this on.
                </p>
              )}
              {smartAssistReady && (
                <p className="text-xs text-green-700">
                  The brain is ready and provider memory will keep getting better as successful
                  selectors are reused.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900">Policy schedule PDF</h4>
            <p className="text-xs text-gray-500">
              Whether the PDF is requested is controlled by the &quot;PDF for this run&quot; toggle
              next to the start button on the Portal Automation tab. These hints only help the
              worker find the download control.
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

          {fieldSelectors.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Advanced field selectors</h4>
              <p className="text-xs text-gray-500">
                These are provider-level fallback selectors for discovery and dry-run refinement.
                Category-specific labels and selector overrides live in Mapping Configuration and
                are merged in at runtime.
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
                    <p className="text-xs text-gray-500">{getPortalFieldColumnName(field)}</p>
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
  );
}
