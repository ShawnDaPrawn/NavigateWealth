/** Connect an AI agent, or change what a connected one may do. */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Checkbox } from '../../../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import {
  connectionTools,
  passwordAccessHelp,
  passwordAccessLabels,
  type ConnectionTool,
  type IssuedConnection,
  type PasswordAccess,
  type VaultConnection,
} from '../../../../shared/password-manager';
import { errorText, vaultApi } from './api';
import { useServices, useVaultMutation } from './hooks';
import { ChoiceList, CopyButton, Field } from './parts';

/** Where each tool sends people back after they approve the sign-in. */
const KNOWN_CALLBACKS: Record<ConnectionTool, string> = {
  claude: 'https://claude.ai/api/mcp/auth_callback',
  chatgpt: 'https://chatgpt.com/connector_platform_oauth_redirect',
  other: '',
};
const PASSWORDS: PasswordAccess[] = ['never', 'ask', 'allowed'];

export function AgentDialog({ agent, onClose }: { agent?: VaultConnection; onClose: () => void }) {
  const services = useServices();
  const [name, setName] = useState(agent?.name ?? '');
  const [tool, setTool] = useState<ConnectionTool>(agent?.tool ?? 'claude');
  const [reach, setReach] = useState<'all' | 'some'>(agent?.serviceIds ? 'some' : 'all');
  const [chosen, setChosen] = useState<string[]>(agent?.serviceIds ?? []);
  const [passwords, setPasswords] = useState<PasswordAccess>(agent?.passwords ?? 'ask');
  const [callback, setCallback] = useState(agent?.redirectUri ?? KNOWN_CALLBACKS.claude);
  const [days, setDays] = useState('90');
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<IssuedConnection | null>(null);
  const save = useVaultMutation(async () => {
    const serviceIds = reach === 'all' ? null : chosen;
    if (agent) {
      await vaultApi.editAgent(agent.id, { name, serviceIds, passwords });
      return null;
    }
    return vaultApi.addAgent({
      name,
      tool,
      serviceIds,
      passwords,
      redirectUri: callback.trim(),
      expiresInDays: Number(days),
    });
  });

  if (issued) return <Issued issued={issued} onClose={onClose} />;

  const ready = name.trim() && (reach === 'all' || chosen.length > 0);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{agent ? 'Change ' + agent.name : 'Connect an AI agent'}</DialogTitle>
          <DialogDescription>
            One connection per person per AI tool, so you can see who did what and switch one off
            without touching the others.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            save.mutate(undefined, {
              onSuccess: (result) => {
                if (result) setIssued(result);
                else {
                  toast.success('Agent saved');
                  onClose();
                }
              },
              onError: (err) => setError(errorText(err)),
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="agent-name">
              <Input
                id="agent-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Claude — Shawn"
                autoFocus={!agent}
              />
            </Field>
            {!agent && (
              <Field label="AI tool">
                <Select
                  value={tool}
                  onValueChange={(v) => {
                    setTool(v as ConnectionTool);
                    setCallback(KNOWN_CALLBACKS[v as ConnectionTool]);
                  }}
                >
                  <SelectTrigger className="border-nw-line bg-white" aria-label="AI tool">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(connectionTools) as ConnectionTool[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {connectionTools[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>

          <Field label="Which services can it work in?">
            <ChoiceList
              label="Services"
              value={reach}
              onChange={setReach}
              options={[
                {
                  value: 'all',
                  label: 'Every service',
                  help: 'Including services you add later.',
                },
                { value: 'some', label: 'Only the services I choose', help: 'Pick them below.' },
              ]}
            />
          </Field>
          {reach === 'some' && (
            <fieldset className="grid gap-2 rounded-md border border-nw-line p-3">
              <legend className="sr-only">Services this agent can work in</legend>
              {services.data?.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={chosen.includes(s.id)}
                    onCheckedChange={(v) =>
                      setChosen((c) => (v === true ? [...c, s.id] : c.filter((x) => x !== s.id)))
                    }
                  />
                  {s.name}
                </label>
              ))}
            </fieldset>
          )}

          <Field label="Can it receive passwords?">
            <ChoiceList
              label="Passwords"
              value={passwords}
              onChange={setPasswords}
              options={PASSWORDS.map((v) => ({
                value: v,
                label: passwordAccessLabels[v],
                help: passwordAccessHelp[v],
              }))}
            />
          </Field>

          {!agent && (
            <>
              <Field
                label="Callback address"
                hint={
                  tool === 'other'
                    ? 'If your tool signs in with OAuth, paste the callback address it shows. Leave it empty to get a token to paste instead.'
                    : 'Filled in for ' +
                      connectionTools[tool] +
                      '. Change it only if your tool shows a different one.'
                }
                htmlFor="agent-callback"
              >
                <Input
                  id="agent-callback"
                  value={callback}
                  onChange={(e) => setCallback(e.target.value)}
                  placeholder="https://"
                />
              </Field>
              <Field label="Stays connected for">
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger
                    className="border-nw-line bg-white"
                    aria-label="Stays connected for"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">6 months</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready || save.isPending}>
              {agent ? 'Save' : 'Connect agent'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The one-time credentials for a new agent. */
function Issued({ issued, onClose }: { issued: IssuedConnection; onClose: () => void }) {
  const tool = connectionTools[issued.connection.tool];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{issued.connection.name} is ready</DialogTitle>
          <DialogDescription>
            Copy these into {tool} now. The secret is shown only once.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {issued.clientSecret ? (
            <>
              <Secret label="OAuth Client ID" value={issued.connection.id} />
              <Secret label="OAuth Client Secret" value={issued.clientSecret} />
              <p className="text-sm text-nw-text-2">
                In {tool}, paste these into the connector’s advanced settings, then connect. {tool}{' '}
                sends you to Navigate Wealth to approve the sign-in; approve it and you are done.
              </p>
            </>
          ) : (
            <>
              <Secret label="Token" value={issued.token ?? ''} />
              <p className="text-sm text-nw-text-2">
                Give your tool this token as a header:{' '}
                <code className="rounded bg-nw-paper px-1">
                  Authorization: Bearer &lt;token&gt;
                </code>
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Secret({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <Input readOnly value={value} onFocus={(e) => e.target.select()} className="font-mono" />
        <CopyButton value={value} label={label} />
      </div>
    </Field>
  );
}
