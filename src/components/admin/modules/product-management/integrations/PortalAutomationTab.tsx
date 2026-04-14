import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/alert';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Separator } from '../../../../ui/separator';
import { Textarea } from '../../../../ui/textarea';
import { AlertCircle, Bot, CheckCircle2, Clock, KeyRound, Loader2, Play, RefreshCw } from 'lucide-react';
import { IntegrationProvider, PortalCredentialStatus, PortalDiscoveryReport, PortalFlowField, PortalJobRunMode, PortalProviderFlow, PortalSyncJob } from '../types';
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
  credentialStatus?: PortalCredentialStatus;
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
  credentialStatus,
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
  onApplyFlow,
  isApplyingFlow,
}: PortalAutomationTabProps) {
  const [runMode, setRunMode] = useState<PortalJobRunMode>('discover');
  const [credentialUsername, setCredentialUsername] = useState('');
  const [credentialPassword, setCredentialPassword] = useState('');
  const [loginUrl, setLoginUrl] = useState('');
  const [usernameSelector, setUsernameSelector] = useState('');
  const [passwordSelector, setPasswordSelector] = useState('');
  const [submitSelector, setSubmitSelector] = useState('');
  const [postLoginUrl, setPostLoginUrl] = useState('');
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
      setNextPageSelector(flow.navigation.nextPageSelector || '');
      setPolicyListStepsJson(JSON.stringify(flow.navigation.policyListSteps || [], null, 2));
      setPolicyRowSelector(flow.extraction.policyRowSelector || '');
      setFieldSelectors(flow.extraction.fields || []);
    }
  }, [flow]);

  const selectedProfile = flow?.credentialProfiles.find((profile) => profile.id === selectedCredentialProfileId);
  const policyRowCandidates = discoveryReport?.selectorCandidates.filter(candidate => candidate.purpose === 'policy_row') || [];

  const updateFieldSelector = (index: number, selector: string) => {
    setFieldSelectors(prev => prev.map((field, currentIndex) => (
      currentIndex === index ? { ...field, selector } : field
    )));
  };

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
      extraction: {
        ...flow.extraction,
        policyRowSelector: policyRowSelector.trim(),
        fields: fieldSelectors,
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
                    Worker secret inputs
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
                        placeholder={credentialStatus?.hasPassword ? 'Saved. Enter to replace.' : 'Provider password'}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-gray-500">
                      {credentialStatus?.hasUsername && credentialStatus?.hasPassword
                        ? `Saved in Supabase${credentialStatus.updatedAt ? ` on ${new Date(credentialStatus.updatedAt).toLocaleString()}` : ''}.`
                        : 'Credentials are not saved yet for this provider.'}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        onSaveCredentials(selectedProfile.id, {
                          username: credentialUsername,
                          password: credentialPassword || undefined,
                        });
                        setCredentialPassword('');
                      }}
                      disabled={isSavingCredentials || (!credentialUsername.trim() && !credentialStatus?.hasUsername) || (!credentialPassword && !credentialStatus?.hasPassword)}
                    >
                      {isSavingCredentials ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                      Save Credentials
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-lg border bg-white p-4 space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900">Playwright Flow Logic</h4>
                  <p className="text-sm text-gray-500">Define how the worker signs in and reaches the policy table. Discovery can help you tighten selectors before a dry run.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Username Selector</Label>
                    <Input value={usernameSelector} onChange={(event) => setUsernameSelector(event.target.value)} placeholder="input[name='username']" />
                  </div>
                  <div className="space-y-2">
                    <Label>Password Selector</Label>
                    <Input value={passwordSelector} onChange={(event) => setPasswordSelector(event.target.value)} placeholder="input[type='password']" />
                  </div>
                  <div className="space-y-2">
                    <Label>Submit Selector</Label>
                    <Input value={submitSelector} onChange={(event) => setSubmitSelector(event.target.value)} placeholder="button[type='submit']" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Post-login URL</Label>
                    <Input value={postLoginUrl} onChange={(event) => setPostLoginUrl(event.target.value)} placeholder="Optional policy list URL" />
                  </div>
                  <div className="space-y-2">
                    <Label>Next Page Selector</Label>
                    <Input value={nextPageSelector} onChange={(event) => setNextPageSelector(event.target.value)} placeholder="button:has-text('Next')" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Policy List Steps JSON</Label>
                  <Textarea
                    value={policyListStepsJson}
                    onChange={(event) => setPolicyListStepsJson(event.target.value)}
                    className="min-h-32 font-mono text-xs"
                    placeholder='[{"id":"open-policies","action":"click","selector":"a:has-text(\"Policies\")"}]'
                  />
                  {policyListStepsError && <p className="text-sm text-red-700">{policyListStepsError}</p>}
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" onClick={saveFlowConfiguration} disabled={isSavingFlow}>
                    {isSavingFlow ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Save Flow Logic
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

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => onCreateJob(selectedCredentialProfileId, runMode)}
                  disabled={!selectedCredentialProfileId || !credentialStatus?.hasUsername || !credentialStatus?.hasPassword || isCreatingJob}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isCreatingJob ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Create Portal Job
                </Button>
                <Select value={runMode} onValueChange={(value) => setRunMode(value as PortalJobRunMode)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discover">Discover selectors</SelectItem>
                    <SelectItem value="dry-run">Dry run</SelectItem>
                    <SelectItem value="run">Stage rows</SelectItem>
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
                <p className="text-[10px] uppercase text-gray-500 font-medium">Rows</p>
                <p className="text-sm font-semibold text-gray-900">{job.extractedRows ?? '-'}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-medium">Updated</p>
                <p className="text-sm font-semibold text-gray-900">{new Date(job.updatedAt).toLocaleTimeString()}</p>
              </div>
            </div>

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
