/**
 * Provider credentials section (setup step 2) of the provider setup tab:
 * profile picker, status banner, username/password entry, and the save /
 * update / cancel controls. JSX moved verbatim from ProviderSetupTab.tsx;
 * every captured name became a prop.
 */
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import type { PortalCredentialStatus, PortalProviderFlow } from '../types';
import { SetupStepIndicator } from './SetupStepIndicator';

interface ProviderCredentialsSectionProps {
  setupSteps: { complete: boolean }[];
  flow: PortalProviderFlow;
  selectedProfile: PortalProviderFlow['credentialProfiles'][number] | undefined;
  selectedCredentialProfileId: string;
  onCredentialProfileChange: (profileId: string) => void;
  credentialStatus?: PortalCredentialStatus;
  credentialsSaved: boolean;
  showCredentialFields: boolean;
  showCredentialSaveSuccess: boolean;
  credentialUsername: string;
  setCredentialUsername: (value: string) => void;
  credentialPassword: string;
  setCredentialPassword: (value: string) => void;
  isEditingCredentials: boolean;
  setIsEditingCredentials: (value: boolean) => void;
  setIsAwaitingCredentialSave: (value: boolean) => void;
  buildFlowDraft: () => PortalProviderFlow | null;
  onSaveFlow: (flow: PortalProviderFlow) => void;
  onSaveCredentials: (
    profileId: string,
    credentials: { username: string; password?: string },
  ) => void;
  canSaveCredentials: boolean;
  isSavingCredentials: boolean;
}

export function ProviderCredentialsSection({
  setupSteps,
  flow,
  selectedProfile,
  selectedCredentialProfileId,
  onCredentialProfileChange,
  credentialStatus,
  credentialsSaved,
  showCredentialFields,
  showCredentialSaveSuccess,
  credentialUsername,
  setCredentialUsername,
  credentialPassword,
  setCredentialPassword,
  isEditingCredentials,
  setIsEditingCredentials,
  setIsAwaitingCredentialSave,
  buildFlowDraft,
  onSaveFlow,
  onSaveCredentials,
  canSaveCredentials,
  isSavingCredentials,
}: ProviderCredentialsSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SetupStepIndicator complete={setupSteps[1].complete} stepNumber={2} />
        <span className="font-medium text-gray-900">Provider credentials</span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
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
  );
}
