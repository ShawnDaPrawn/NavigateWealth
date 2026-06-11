import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../../../../ui/alert';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../ui/card';
import { Label } from '../../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { Switch } from '../../../../../ui/switch';
import { AlertCircle, Bot, ExternalLink, Loader2, Play, RefreshCw } from 'lucide-react';
import {
  IntegrationFieldBinding,
  IntegrationProvider,
  PortalCredentialStatus,
  PortalFlowField,
  PortalJobRunMode,
  PortalJobPolicyItem,
  PortalProviderFlow,
  PortalSyncJob,
  PRODUCT_CATEGORIES,
  isPortalAutomationCategory,
} from '../../types';
import { cn } from '../../../../../ui/utils';
import { statusClassNames, computePortalSetupSteps } from './portalHelpers';

interface PortalConfigCardProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
  flow?: PortalProviderFlow;
  job?: PortalSyncJob | null;
  isLoadingFlow: boolean;
  isCreatingJob: boolean;
  credentialStatus?: PortalCredentialStatus;
  mappingBindings: IntegrationFieldBinding[];
  selectedCredentialProfileId: string;
  isRefreshingJob: boolean;
  onCreateJob: (
    credentialProfileId: string,
    runMode: PortalJobRunMode,
    options?: Pick<PortalProviderFlow, 'policySchedule' | 'documentArtifacts'>,
  ) => void;
  onRefreshJob: () => void;
  onOpenSetupTab: () => void;
  fieldSelectors: PortalFlowField[];
}

export function PortalConfigCard({
  provider,
  selectedCategoryId,
  flow,
  job,
  isLoadingFlow,
  isCreatingJob,
  credentialStatus,
  mappingBindings,
  selectedCredentialProfileId,
  isRefreshingJob,
  onCreateJob,
  onRefreshJob,
  onOpenSetupTab,
  fieldSelectors,
}: PortalConfigCardProps) {
  const [runMode, setRunMode] = useState<PortalJobRunMode>('run');
  const [policyScheduleEnabled, setPolicyScheduleEnabled] = useState(false);

  const selectedCategoryName =
    PRODUCT_CATEGORIES.find((c) => c.id === selectedCategoryId)?.name || selectedCategoryId;
  const selectedScopeLabel = `${provider.name} / ${selectedCategoryName}`;
  const automationCategorySelected = isPortalAutomationCategory(selectedCategoryId);

  useEffect(() => {
    if (flow) {
      setPolicyScheduleEnabled(flow.policySchedule?.enabled === true);
    }
  }, [flow]);

  const credentialsSaved = Boolean(credentialStatus?.hasUsername && credentialStatus?.hasPassword);
  const localWatchCommand = `npm run provider:watch -- --job-id ${job?.id || '<portal-job-id>'} --worker-secret <portal-worker-secret>`;

  // Setup completeness is judged on the SAVED flow config (not unsaved drafts) —
  // editing happens on the Provider Setup tab and must be saved there.
  const setupSteps = computePortalSetupSteps({
    loginUrl: flow?.loginUrl || '',
    credentialsSaved,
    searchLabels: flow?.search?.searchInputLabels || [],
    searchInputSelector: flow?.search?.searchInputSelector || '',
    mappingBindingCount: mappingBindings.length,
    fieldSelectorCount: fieldSelectors.length,
  });
  const setupComplete = setupSteps.every((step) => step.complete);

  // Runs use the saved policy-schedule config; only the per-run PDF toggle is local.
  const buildPolicyScheduleForRun = (): PortalProviderFlow['policySchedule'] => ({
    ...(flow?.policySchedule || {}),
    enabled: policyScheduleEnabled,
    downloadLabels: flow?.policySchedule?.downloadLabels || [
      'Policy schedule',
      'Download policy schedule',
      'Download PDF',
      'Statement',
    ],
    downloadMenuLabels: flow?.policySchedule?.downloadMenuLabels || [
      'Download PDF with company logo',
      'Download PDF without company logo',
    ],
    documentType: flow?.policySchedule?.documentType || 'policy_schedule',
    required: false,
    waitForDownloadMs: flow?.policySchedule?.waitForDownloadMs || 45000,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              Portal Automation
            </CardTitle>
            <CardDescription className="mt-2">
              Launch a GitHub Actions Playwright worker for {provider.name}, pause for SMS OTP, then
              stage extracted rows for policy review.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
              {selectedScopeLabel}
            </Badge>
            {job && (
              <Badge variant="outline" className={cn('capitalize', statusClassNames[job.status])}>
                {job.status.replace(/_/g, ' ')}
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
            {!automationCategorySelected && (
              <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Select a product subcategory</AlertTitle>
                <AlertDescription>
                  Portal automation is only available for specific product categories such as
                  Pre-Retirement, Post-Retirement, Voluntary Investments, and Guaranteed
                  Investments. Parent categories are used for grouping and reporting only.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() =>
                  onCreateJob(selectedCredentialProfileId, runMode, {
                    policySchedule: buildPolicyScheduleForRun(),
                    documentArtifacts: flow?.documentArtifacts || [],
                  })
                }
                disabled={
                  !automationCategorySelected ||
                  !selectedCredentialProfileId ||
                  !credentialStatus?.hasUsername ||
                  !credentialStatus?.hasPassword ||
                  isCreatingJob
                }
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isCreatingJob ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start Policy Update
              </Button>
              <Select
                value={runMode}
                onValueChange={(value) => setRunMode(value as PortalJobRunMode)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="run">Update policies</SelectItem>
                  <SelectItem value="dry-run">Dry run only</SelectItem>
                  <SelectItem value="discover">Discover page hints</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 rounded-md border bg-gray-50 px-3 py-2 text-sm">
                <Label
                  htmlFor="policy-schedule-run-enabled"
                  className={cn(
                    'text-xs',
                    policyScheduleEnabled ? 'text-green-700' : 'text-gray-500',
                  )}
                >
                  PDF for this run
                </Label>
                <Switch
                  id="policy-schedule-run-enabled"
                  checked={policyScheduleEnabled}
                  onCheckedChange={setPolicyScheduleEnabled}
                />
              </div>
              <Button variant="outline" onClick={onRefreshJob} disabled={!job || isRefreshingJob}>
                {isRefreshingJob ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh Job
              </Button>
            </div>
            {!setupComplete && (
              <p className="text-xs text-amber-700">
                Finish the provider setup before starting a run —{' '}
                {setupSteps
                  .filter((step) => !step.complete)
                  .map((step) => step.label)
                  .join(', ')}{' '}
                still outstanding.{' '}
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={onOpenSetupTab}
                >
                  Open Provider Setup
                </button>
              </p>
            )}

            <details className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-950">
              <summary className="cursor-pointer list-none font-medium text-purple-950">
                Watch automation
              </summary>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-purple-900">
                  The GitHub Actions link shows run logs. The live provider screen appears below on
                  the current job card while the worker is active.
                </p>
                {job?.actionsRunUrl ? (
                  <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-700">
                    <a href={job.actionsRunUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Watch current run
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-purple-800">
                    Start a job and the GitHub watch link will appear here.
                  </span>
                )}
              </div>
              <div className="mt-3 rounded-md border border-purple-200 bg-white/90 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-purple-800">
                  Visible browser on this machine
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Use the headed worker when you want to literally watch the browser move through
                  the provider steps.
                </p>
                <code className="mt-2 block overflow-x-auto rounded bg-gray-950 px-3 py-2 text-xs text-gray-100">
                  {localWatchCommand}
                </code>
              </div>
            </details>
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

// Re-export type for the job card
export type { PortalJobPolicyItem };
