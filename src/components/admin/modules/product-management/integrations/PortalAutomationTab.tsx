import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/alert';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Separator } from '../../../../ui/separator';
import { AlertCircle, Bot, CheckCircle2, Clock, KeyRound, Loader2, Play, RefreshCw, Search } from 'lucide-react';
import { IntegrationProvider, PortalDiscoveryReport, PortalFlowField, PortalProviderFlow, PortalSyncJob } from '../types';
import { cn } from '../../../../ui/utils';

interface PortalAutomationTabProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
  flow?: PortalProviderFlow;
  job?: PortalSyncJob | null;
  discoveryReport?: PortalDiscoveryReport | null;
  isLoadingFlow: boolean;
  isLoadingDiscoveryReport: boolean;
  isCreatingJob: boolean;
  isSubmittingOtp: boolean;
  isRefreshingJob: boolean;
  onCreateJob: (credentialProfileId: string) => void;
  onSubmitOtp: (otp: string) => void;
  onRefreshJob: () => void;
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

export function PortalAutomationTab({
  provider,
  selectedCategoryId,
  flow,
  job,
  discoveryReport,
  isLoadingFlow,
  isLoadingDiscoveryReport,
  isCreatingJob,
  isSubmittingOtp,
  isRefreshingJob,
  onCreateJob,
  onSubmitOtp,
  onRefreshJob,
  onApplyFlow,
  isApplyingFlow,
}: PortalAutomationTabProps) {
  const [credentialProfileId, setCredentialProfileId] = useState('');
  const [otp, setOtp] = useState('');
  const [policyRowSelector, setPolicyRowSelector] = useState('');
  const [fieldSelectors, setFieldSelectors] = useState<PortalFlowField[]>([]);

  useEffect(() => {
    if (flow?.credentialProfiles?.length && !credentialProfileId) {
      setCredentialProfileId(flow.credentialProfiles[0].id);
    }
  }, [credentialProfileId, flow]);

  useEffect(() => {
    if (flow) {
      setPolicyRowSelector(flow.extraction.policyRowSelector || '');
      setFieldSelectors(flow.extraction.fields || []);
    }
  }, [flow]);

  const selectedProfile = flow?.credentialProfiles.find((profile) => profile.id === credentialProfileId);
  const workerCommand = job
    ? `npm run provider:sync -- --job-id ${job.id} --auth-token <admin-session-token>`
    : 'Create a job first, then run the worker command shown here.';
  const discoveryCommand = job
    ? `npm run provider:sync -- --mode discover --job-id ${job.id} --auth-token <admin-session-token>`
    : 'Create a job first, then run discovery.';
  const dryRunCommand = job
    ? `npm run provider:sync -- --mode dry-run --job-id ${job.id} --auth-token <admin-session-token>`
    : 'Create a job first, then run a dry run.';
  const policyRowCandidates = discoveryReport?.selectorCandidates.filter(candidate => candidate.purpose === 'policy_row') || [];

  const updateFieldSelector = (index: number, selector: string) => {
    setFieldSelectors(prev => prev.map((field, currentIndex) => (
      currentIndex === index ? { ...field, selector } : field
    )));
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
                Run a Playwright worker for {provider.name}, pause for SMS OTP, then stage extracted rows for policy review.
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
                <AlertTitle>Credentials stay outside Navigate Wealth</AlertTitle>
                <AlertDescription>
                  The worker reads username and password from environment variables. SMS OTP is entered manually here and is cleared after the worker consumes it.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Login URL</Label>
                  <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700 break-all">
                    {flow.loginUrl || 'Not configured'}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Credential Profile</Label>
                  <Select value={credentialProfileId} onValueChange={setCredentialProfileId}>
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
                <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
                  <div className="flex items-center gap-2 font-medium text-gray-900">
                    <KeyRound className="h-4 w-4" />
                    Worker secret inputs
                  </div>
                  <p>Username env var: <span className="font-mono">{selectedProfile.usernameEnvVar || 'Not configured'}</span></p>
                  <p>Password env var: <span className="font-mono">{selectedProfile.passwordEnvVar || 'Not configured'}</span></p>
                </div>
              )}

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

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => onCreateJob(credentialProfileId)}
                  disabled={!credentialProfileId || isCreatingJob}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isCreatingJob ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Create Portal Job
                </Button>
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
            <CardDescription>Use the worker command on a machine that can run Playwright and access the provider portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-medium">Step</p>
                <p className="text-sm font-semibold text-gray-900">{job.currentStep || '-'}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-medium">Rows</p>
                <p className="text-sm font-semibold text-gray-900">{job.extractedRows ?? '-'}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-medium">Updated</p>
                <p className="text-sm font-semibold text-gray-900">{new Date(job.updatedAt).toLocaleTimeString()}</p>
              </div>
            </div>

            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase text-gray-500 mb-2">Stage rows command</p>
              <code className="block whitespace-pre-wrap break-all text-xs text-gray-800">{workerCommand}</code>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-lg border bg-purple-50 p-4">
                <div className="flex items-center gap-2 text-purple-800 mb-2">
                  <Search className="h-4 w-4" />
                  <p className="text-xs font-medium uppercase">Discovery command</p>
                </div>
                <code className="block whitespace-pre-wrap break-all text-xs text-purple-950">{discoveryCommand}</code>
              </div>
              <div className="rounded-lg border bg-blue-50 p-4">
                <p className="text-xs font-medium uppercase text-blue-800 mb-2">Dry run command</p>
                <code className="block whitespace-pre-wrap break-all text-xs text-blue-950">{dryRunCommand}</code>
              </div>
            </div>

            <p className="text-sm text-gray-600">{job.message || 'Waiting for worker status.'}</p>
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
