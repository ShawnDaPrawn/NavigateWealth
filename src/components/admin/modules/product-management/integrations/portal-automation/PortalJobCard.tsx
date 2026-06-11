import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../../../../ui/alert';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../ui/card';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Separator } from '../../../../../ui/separator';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  ListChecks,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  IntegrationProvider,
  PortalDiscoveryReport,
  PortalFlowField,
  PortalJobPolicyItem,
  PortalSyncJob,
  IntegrationSyncRun,
  PRODUCT_CATEGORIES,
} from '../../types';
import { cn } from '../../../../../ui/utils';
import {
  isCloudflareVerificationStep,
  isPushApprovalStep,
  formatExtractedValue,
  getExtractedValues,
  getPrimaryArtifactStatus,
  latestPortalWarning,
  itemStatusClassNames,
  itemStatusLabels,
  artifactStatusClassNames,
  getPortalFieldKey,
  getPortalFieldTitle,
  getPortalFieldColumnName,
} from './portalHelpers';

interface PortalJobCardProps {
  job: PortalSyncJob;
  // 'active' = job still running ("Current Job"); 'latest' = most recent
  // terminal job ("Latest Run" with its outcome), kept visible because
  // discovery/dry-run/staged results carry actionable review UI.
  variant?: 'active' | 'latest';
  jobItems: PortalJobPolicyItem[];
  isLoadingJobItems: boolean;
  stagedRun?: IntegrationSyncRun | null;
  provider: IntegrationProvider;
  selectedCategoryId: string;
  discoveryReport?: PortalDiscoveryReport | null;
  isLoadingDiscoveryReport: boolean;
  isApplyingFlow: boolean;
  onApplyFlow: (patch: { policyRowSelector?: string; fields: PortalFlowField[] }) => void;
  onRetryItem: (item: PortalJobPolicyItem) => void;
  onSubmitOtp: (otp: string) => void;
  isSubmittingOtp: boolean;
  onOpenUploadTab: () => void;
  fieldSelectors: PortalFlowField[];
  updateFieldSelector: (index: number, selector: string) => void;
  buildProviderFallbackFields: () => PortalFlowField[];
}

export function PortalJobCard({
  job,
  variant = 'active',
  jobItems,
  isLoadingJobItems,
  stagedRun,
  provider,
  selectedCategoryId,
  discoveryReport,
  isLoadingDiscoveryReport,
  isApplyingFlow,
  onApplyFlow,
  onRetryItem,
  onSubmitOtp,
  isSubmittingOtp,
  onOpenUploadTab,
  fieldSelectors,
  updateFieldSelector,
  buildProviderFallbackFields,
}: PortalJobCardProps) {
  const [otp, setOtp] = useState('');
  const [submittedOtpForJobId, setSubmittedOtpForJobId] = useState<string | null>(null);
  const [policyRowSelector, setPolicyRowSelector] = useState('');

  useEffect(() => {
    if (job.status !== 'waiting_for_otp') {
      setSubmittedOtpForJobId(null);
    }
  }, [job.id, job.status]);

  const selectedCategoryName =
    PRODUCT_CATEGORIES.find((c) => c.id === selectedCategoryId)?.name || selectedCategoryId;
  const selectedScopeLabel = `${provider.name} / ${selectedCategoryName}`;

  const queueSummary = job.queueSummary || {
    total: jobItems.length,
    queued: jobItems.filter((item) => item.status === 'queued').length,
    inProgress: jobItems.filter((item) => item.status === 'in_progress').length,
    completed: jobItems.filter((item) => item.status === 'completed').length,
    failed: jobItems.filter((item) => item.status === 'failed').length,
    skipped: jobItems.filter((item) => item.status === 'skipped').length,
  };
  const progressPercent =
    queueSummary.total > 0
      ? Math.round(
          ((queueSummary.completed + queueSummary.failed + queueSummary.skipped) /
            queueSummary.total) *
            100,
        )
      : 0;

  const stagedRowsAwaitingPublish =
    stagedRun?.rows.filter(
      (row) =>
        row.matchStatus === 'matched' &&
        row.diffs.length > 0 &&
        row.publishStatus !== 'published' &&
        row.publishStatus !== 'failed' &&
        row.publishStatus !== 'skipped',
    ).length || 0;
  const stagedRows = stagedRun?.rows || [];
  const stagedPreviewRow =
    stagedRows.find((row) => jobItems.some((item) => item.policyNumber === row.policyNumber)) ||
    stagedRows[0];
  const stagedPreviewMatchCopy =
    stagedPreviewRow?.matchMethod === 'template_metadata'
      ? 'Matched via hidden template metadata'
      : stagedPreviewRow?.matchMethod === 'policy_number'
        ? 'Matched via policy number fallback'
        : 'No stable match key supplied';
  const stagedPreviewExtractedValues = stagedPreviewRow
    ? getExtractedValues(stagedPreviewRow.rawData)
    : [];
  const currentJobWarning = latestPortalWarning(job.warning, job.warnings);
  const currentJobRequestedDocument = Boolean(
    job.policySchedule?.enabled ||
    job.documentArtifacts?.some((artifact) => artifact.enabled !== false) ||
    false,
  );
  const liveViewCapturedLabel = job.liveView?.capturedAt
    ? new Date(job.liveView.capturedAt).toLocaleTimeString()
    : '';
  const cloudflareCheckpointActive = isCloudflareVerificationStep(job);
  const pushApprovalActive = isPushApprovalStep(job);
  const otpSubmittedForCurrentJob = Boolean(
    job.id && submittedOtpForJobId === job.id && job.status === 'waiting_for_otp',
  );
  const localWatchCommand = `npm run provider:watch -- --job-id ${job.id || '<portal-job-id>'} --worker-secret <portal-worker-secret>`;
  const policyRowCandidates =
    discoveryReport?.selectorCandidates.filter((candidate) => candidate.purpose === 'policy_row') ||
    [];

  const outcomeBadge: Record<string, { label: string; className: string }> = {
    staged: { label: 'Completed', className: 'border-green-200 bg-green-50 text-green-700' },
    failed: { label: 'Failed', className: 'border-red-200 bg-red-50 text-red-700' },
    cancelled: { label: 'Cancelled', className: 'border-gray-200 bg-gray-50 text-gray-600' },
    discovery_ready: {
      label: 'Needs Review',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    dry_run_ready: {
      label: 'Needs Review',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    },
  };
  const latestOutcome = outcomeBadge[job.status];
  const finishedAtLabel = new Date(job.completedAt || job.updatedAt).toLocaleString();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              {variant === 'active' ? 'Current Job' : 'Latest Run'}
              {variant === 'active' ? (
                <Badge
                  variant="outline"
                  className="border-blue-200 bg-blue-50 text-blue-700 animate-pulse"
                >
                  In Progress
                </Badge>
              ) : (
                latestOutcome && (
                  <Badge variant="outline" className={latestOutcome.className}>
                    {latestOutcome.label}
                  </Badge>
                )
              )}
            </CardTitle>
            <CardDescription>
              {variant === 'active'
                ? 'GitHub Actions runs the Playwright worker and updates this status automatically.'
                : `This run finished on ${finishedAtLabel}. Start a new policy update above to run again.`}
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
            {selectedScopeLabel}
          </Badge>
        </div>
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
            <p className="text-sm font-semibold text-gray-900">
              {new Date(job.updatedAt).toLocaleTimeString()}
            </p>
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
              <div
                className="h-full bg-purple-600 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="rounded-lg border bg-gray-50 p-2 text-center">
                <p className="text-[10px] uppercase text-gray-500">Total</p>
                <p className="font-semibold">{queueSummary.total}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-2 text-center">
                <p className="text-[10px] uppercase text-gray-500">Waiting</p>
                <p className="font-semibold">{queueSummary.queued}</p>
              </div>
              <div className="rounded-lg border bg-blue-50 p-2 text-center">
                <p className="text-[10px] uppercase text-blue-600">Working</p>
                <p className="font-semibold text-blue-700">{queueSummary.inProgress}</p>
              </div>
              <div className="rounded-lg border bg-green-50 p-2 text-center">
                <p className="text-[10px] uppercase text-green-600">Complete</p>
                <p className="font-semibold text-green-700">{queueSummary.completed}</p>
              </div>
              <div className="rounded-lg border bg-red-50 p-2 text-center">
                <p className="text-[10px] uppercase text-red-600">Failed</p>
                <p className="font-semibold text-red-700">{queueSummary.failed}</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-700">
          <p>
            <span className="font-medium text-gray-900">Run mode:</span>{' '}
            {(job.runMode || 'discover').replace('-', ' ')}
          </p>
          <p>
            <span className="font-medium text-gray-900">Worker:</span>{' '}
            {job.workerId || 'Waiting for GitHub Actions'}
          </p>
          {job.actionsRunUrl && (
            <p>
              <span className="font-medium text-gray-900">GitHub run:</span>{' '}
              <a
                className="text-purple-700 hover:underline"
                href={job.actionsRunUrl}
                target="_blank"
                rel="noreferrer"
              >
                Watch run logs
              </a>
            </p>
          )}
          {job.actionsDispatchError && <p className="text-red-700">{job.actionsDispatchError}</p>}
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Live Portal View</h4>
              <p className="text-sm text-gray-500">
                This refreshes while the worker is running so you can see the actual provider page
                it is on.
              </p>
            </div>
            {job.liveView?.signedUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={job.liveView.signedUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open image
                </a>
              </Button>
            ) : null}
          </div>

          {job.liveView?.signedUrl ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 md:grid-cols-3">
                <p>
                  <span className="font-medium text-gray-900">Captured:</span>{' '}
                  {liveViewCapturedLabel || '-'}
                </p>
                <p>
                  <span className="font-medium text-gray-900">Page:</span>{' '}
                  {job.liveView.pageTitle || '-'}
                </p>
                <p className="truncate">
                  <span className="font-medium text-gray-900">URL:</span>{' '}
                  {job.liveView.pageUrl || '-'}
                </p>
              </div>
              <div className="overflow-hidden rounded-lg border bg-gray-50">
                <img
                  src={job.liveView.signedUrl}
                  alt={`Live provider portal screen for ${provider.name}`}
                  className="w-full object-contain"
                />
              </div>
              {job.liveView.note && <p className="text-xs text-gray-500">{job.liveView.note}</p>}
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-gray-50 px-3 py-4 text-sm text-gray-500">
              {['queued'].includes(job.status)
                ? 'Live portal screenshots will appear after the worker opens the provider site.'
                : 'Waiting for the worker to publish the first provider screenshot.'}
            </div>
          )}
        </div>

        <p className="text-sm text-gray-600">{job.message || 'Waiting for worker status.'}</p>
        {currentJobWarning && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {job.warnings?.length || 1} worker warning
              {(job.warnings?.length || 1) === 1 ? '' : 's'}
            </AlertTitle>
            <AlertDescription>
              <details className="mt-1">
                <summary className="cursor-pointer text-sm font-medium">View detail</summary>
                <p className="mt-2 text-xs leading-5">{currentJobWarning}</p>
              </details>
            </AlertDescription>
          </Alert>
        )}
        {job.error && <p className="text-sm text-red-700">{job.error}</p>}

        {job.stagedRunId && (
          <Alert className="border-blue-200 bg-blue-50 text-blue-900">
            <FileText className="h-4 w-4" />
            <AlertTitle>
              {stagedRun?.summary.publishedRows
                ? 'Portal extraction published'
                : 'Portal extraction staged for review'}
            </AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                {stagedRun
                  ? `${stagedRun.summary.totalRows} row${stagedRun.summary.totalRows === 1 ? '' : 's'} extracted. Published rows: ${stagedRun.summary.publishedRows}.`
                  : 'The worker extracted policy data and created a staged sync run.'}
                {stagedRun && stagedRowsAwaitingPublish > 0
                  ? ` ${stagedRowsAwaitingPublish} row${stagedRowsAwaitingPublish === 1 ? '' : 's'} still need to be published before the live policy records change.`
                  : ''}
              </p>
              {stagedPreviewRow && (
                <details className="rounded-md border border-blue-200 bg-white/80 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-blue-900">
                    View extracted values for {stagedPreviewRow.policyNumber}
                  </summary>
                  <p className="mt-2 text-xs text-slate-500">{stagedPreviewMatchCopy}</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    {stagedPreviewExtractedValues.length > 0 ? (
                      stagedPreviewExtractedValues.map(([key, value]) => (
                        <div
                          key={`${stagedPreviewRow.id}-raw-${key}`}
                          className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <span className="font-medium text-slate-900">{key}</span>
                          <span className="text-slate-600 sm:text-right">
                            {formatExtractedValue(value)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500">
                        No extracted values were staged for this row.
                      </p>
                    )}
                    {stagedPreviewRow.diffs.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
                          Publish changes
                        </p>
                        <div className="mt-1 space-y-1">
                          {stagedPreviewRow.diffs.slice(0, 4).map((diff) => (
                            <div
                              key={`${stagedPreviewRow.id}-${diff.fieldId}`}
                              className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"
                            >
                              <span className="font-medium text-slate-900">{diff.fieldName}</span>
                              <span className="text-slate-600 sm:text-right">
                                {String(diff.oldValue ?? '-')} {' -> '}{' '}
                                {String(diff.newValue ?? '-')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={onOpenUploadTab}>
                  Open Upload &amp; Sync
                </Button>
                {stagedRun &&
                  stagedRowsAwaitingPublish === 0 &&
                  stagedRun.summary.publishedRows === 0 && (
                    <span className="text-xs text-blue-800">
                      No live policy values were changed yet.
                    </span>
                  )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {cloudflareCheckpointActive && (
          <>
            <Separator />
            <Alert className="border-amber-200 bg-amber-50 text-amber-950">
              <Clock className="h-4 w-4" />
              <AlertTitle>Manual Cloudflare verification is required</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  This GitHub-hosted browser session cannot be taken over in place. When Capital
                  Legacy shows a Cloudflare challenge, the worker can only stop, publish the
                  screenshot, and wait for you to rerun the same job locally in watch mode.
                </p>
                <p>
                  Use the live portal screenshot above to confirm the challenge, then start a local
                  headed replay on your machine and complete the verification in that visible
                  browser window.
                </p>
                <div className="rounded-md border border-amber-200 bg-white/90 p-3 text-xs text-slate-700">
                  <p className="font-medium text-slate-900">Local takeover command</p>
                  <code className="mt-2 block whitespace-pre-wrap break-all rounded bg-slate-950 px-3 py-2 text-slate-100">
                    {localWatchCommand}
                  </code>
                </div>
                <p className="text-xs text-amber-900">
                  If this provider keeps triggering Cloudflare in hosted runs, ask Capital Legacy to
                  allowlist the worker path or provide an automation-safe login route.
                </p>
              </AlertDescription>
            </Alert>
          </>
        )}

        {job.status === 'waiting_for_otp' && pushApprovalActive && (
          <>
            <Separator />
            <Alert className="border-amber-200 bg-amber-50 text-amber-950">
              <Clock className="h-4 w-4" />
              <AlertTitle>Approve the sign-in in the PingID app</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  {job.message ||
                    'The provider is waiting for a PingID push approval on the registered phone.'}
                </p>
                <p className="text-xs text-amber-900">
                  Open the PingID app on the registered phone and tap the number shown in the live
                  portal view above. No OTP entry is needed here — the worker continues
                  automatically as soon as the provider accepts the approval.
                </p>
              </AlertDescription>
            </Alert>
          </>
        )}

        {job.status === 'waiting_for_otp' && !pushApprovalActive && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-700">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {otpSubmittedForCurrentJob
                    ? 'OTP submitted. Waiting for the provider portal to continue.'
                    : 'Enter the SMS OTP from your phone'}
                </span>
              </div>
              {otpSubmittedForCurrentJob ? (
                <div className="flex flex-col gap-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
                  <span>The input is hidden to avoid submitting the same OTP twice.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSubmittedOtpForJobId(null)}
                  >
                    Enter Different OTP
                  </Button>
                </div>
              ) : (
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
                      if (job.id) setSubmittedOtpForJobId(job.id);
                      onSubmitOtp(otp);
                      setOtp('');
                    }}
                    disabled={otp.trim().length < 4 || isSubmittingOtp}
                  >
                    {isSubmittingOtp ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Submit OTP
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        <Separator />
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Policy Worklist</h4>
              <p className="text-sm text-gray-500">
                Each policy is searched, extracted, and saved independently so a stopped job can
                resume without starting over.
              </p>
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
                  {jobItems.map((item) => {
                    const extractedValues = getExtractedValues(item.rawData);
                    const artifactStatus = getPrimaryArtifactStatus(item);
                    return (
                      <tr key={item.id} className="border-t align-top">
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={cn('capitalize', itemStatusClassNames[item.status])}
                          >
                            {itemStatusLabels[item.status]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">{item.clientName}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.policyNumber}</td>
                        <td className="px-3 py-2">
                          {artifactStatus ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'capitalize',
                                artifactStatusClassNames[artifactStatus.status] ||
                                  'bg-gray-50 text-gray-600 border-gray-200',
                              )}
                            >
                              {artifactStatus.status.replace('_', ' ')}
                            </Badge>
                          ) : item.documentAttached ? (
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200"
                            >
                              Attached
                            </Badge>
                          ) : currentJobRequestedDocument ? (
                            <span className="text-xs text-amber-700">Not attached</span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                          {(artifactStatus?.fileName || item.documentFileName) && (
                            <div
                              className="mt-1 max-w-[180px] truncate text-xs text-gray-500"
                              title={artifactStatus?.fileName || item.documentFileName}
                            >
                              {artifactStatus?.fileName || item.documentFileName}
                            </div>
                          )}
                          {artifactStatus?.error && (
                            <div
                              className="mt-1 max-w-[220px] text-xs text-red-700"
                              title={artifactStatus.error}
                            >
                              {artifactStatus.error}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          <div>{item.currentStep || '-'}</div>
                          {item.message && (
                            <div className="mt-1 max-w-md text-xs text-gray-600">
                              {item.message}
                            </div>
                          )}
                          {extractedValues.length > 0 && (
                            <div className="mt-2 max-w-md rounded-md border border-gray-100 bg-gray-50 p-2 text-xs text-gray-700">
                              <div className="font-medium text-gray-900">Extracted</div>
                              <div className="mt-1 space-y-0.5">
                                {extractedValues.map(([key, value]) => (
                                  <div key={`${item.id}-raw-${key}`}>
                                    <span className="font-medium">{key}:</span>{' '}
                                    {formatExtractedValue(value)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {latestPortalWarning(item.warning, item.warnings) && (
                            <div className="mt-1 max-w-md text-xs text-amber-700">
                              {latestPortalWarning(item.warning, item.warnings)}
                            </div>
                          )}
                          {item.error && (
                            <div className="mt-1 max-w-md text-xs text-red-700">{item.error}</div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {item.status === 'failed' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onRetryItem(item)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
                  {discoveryReport.mode === 'dry-run' ? 'Dry run' : 'Discovery'} captured from{' '}
                  {discoveryReport.urlHost || 'provider portal'} for {selectedCategoryId}.
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
                  <p className="font-semibold">
                    {discoveryReport.summary.extractedRowCount ?? '-'}
                  </p>
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
                  <p className="text-sm text-gray-500">
                    Use discovery candidates to tighten the Playwright extraction flow, then run
                    dry-run again before staging.
                  </p>
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
                      <div
                        key={`${getPortalFieldKey(field)}-${index}`}
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
                          placeholder="td:nth-child(1)"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={() =>
                      onApplyFlow({
                        policyRowSelector: policyRowSelector.trim(),
                        fields: buildProviderFallbackFields(),
                      })
                    }
                    disabled={isApplyingFlow || !policyRowSelector.trim()}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isApplyingFlow ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
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
                        <td className="px-3 py-2 capitalize">
                          {candidate.purpose.replace('_', ' ')}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs break-all">
                          {candidate.selector}
                        </td>
                        <td className="px-3 py-2 capitalize">{candidate.confidence}</td>
                        <td className="px-3 py-2 text-gray-500">
                          {candidate.notes || candidate.label || '-'}
                        </td>
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
  );
}
