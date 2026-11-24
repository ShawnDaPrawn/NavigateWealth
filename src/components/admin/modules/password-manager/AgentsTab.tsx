/**
 * AI agents: how to connect Claude, ChatGPT or another MCP client, the agents
 * connected so far, and the sign-in approval a tool sends you here for.
 */
import { useState } from 'react';
import { Bot, MoreHorizontal, Pause, Play, Plus, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import {
  DsCard,
  DsCardBody,
  DsCardHead,
  DsMeta,
  DsPill,
  DsState,
  ErrorState,
  Notice,
  useConfirm,
} from '../../layout/page';
import {
  connectionTools,
  passwordAccessLabels,
  type VaultConnection,
} from '../../../../shared/password-manager';
import { clearConsent, consentApi, errorText, pendingConsent, vaultApi } from './api';
import { useAgents, useServices, useVaultMutation } from './hooks';
import { CopyButton, Loading } from './parts';
import { formatDate } from './format';
import { AgentDialog } from './AgentDialog';

export const MCP_SERVER_URL = 'https://www.navigatewealth.co/mcp/password-vault';

export function AgentsTab() {
  const agents = useAgents();
  const services = useServices();
  const [dialog, setDialog] = useState<VaultConnection | 'new' | null>(null);
  const { confirm, confirmDialog } = useConfirm();
  const pause = useVaultMutation(vaultApi.pauseAll);
  const edit = useVaultMutation((a: { id: string; status: 'active' | 'paused' }) =>
    vaultApi.editAgent(a.id, { status: a.status }),
  );
  const disconnect = useVaultMutation(vaultApi.disconnectAgent);

  if (agents.isLoading) return <Loading what="agents" />;
  if (agents.error)
    return (
      <ErrorState
        title="Agents did not load"
        description={errorText(agents.error)}
        onRetry={() => void agents.refetch()}
      />
    );

  const list = (agents.data?.items ?? []).filter((a) => a.status !== 'revoked');
  const paused = agents.data?.aiPaused ?? false;
  const serviceName = new Map((services.data ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="grid gap-5">
      <ConsentRequest />

      {paused && (
        <Notice
          kind="attention"
          title="All AI access is paused."
          action={
            <Button size="sm" variant="outline" onClick={() => pause.mutate(false)}>
              Resume
            </Button>
          }
        >
          No agent can find logins, read skills or get passwords until you resume.
        </Notice>
      )}

      <DsCard>
        <DsCardHead title="How to connect an AI agent" />
        <DsCardBody>
          <ol className="grid gap-4 text-sm text-nw-text-2 md:grid-cols-3">
            <li className="grid content-start gap-2">
              <span className="font-semibold text-nw-ink">1. Connect it here</span>
              <span>
                Press <strong>Connect agent</strong> below, choose what it can work in, and copy the
                Client ID and secret you get.
              </span>
            </li>
            <li className="grid content-start gap-2">
              <span className="font-semibold text-nw-ink">2. Add the server in your AI tool</span>
              <span>
                In Claude: Settings → Connectors → Add custom connector. In ChatGPT: Settings → Apps
                &amp; Connectors → Create (developer mode). Paste this address and the Client ID and
                secret:
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <code className="rounded border border-nw-line bg-nw-paper px-2 py-1.5 text-xs break-all text-nw-ink">
                  {MCP_SERVER_URL}
                </code>
                <CopyButton value={MCP_SERVER_URL} label="Server address" />
              </span>
            </li>
            <li className="grid content-start gap-2">
              <span className="font-semibold text-nw-ink">3. Approve the sign-in</span>
              <span>
                Your tool sends you back here once. Approve it, and the agent can start working.
                Then ask it something like “Download October’s statement for broker 1234 from Allan
                Gray”.
              </span>
            </li>
          </ol>
        </DsCardBody>
      </DsCard>

      <DsCard>
        <DsCardHead
          title="Connected agents"
          actions={
            <>
              {!paused && list.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => pause.mutate(true)}>
                  <Pause aria-hidden="true" />
                  Pause all
                </Button>
              )}
              <Button size="sm" onClick={() => setDialog('new')}>
                <Plus aria-hidden="true" />
                Connect agent
              </Button>
            </>
          }
        />
        {list.length === 0 ? (
          <DsState icon={<Bot />} title="No agents connected yet">
            Connect Claude or ChatGPT to let it find logins and follow your skills.
          </DsState>
        ) : (
          <ul className="divide-y divide-nw-line">
            {list.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-nw-violet-50 text-nw-violet"
                  aria-hidden="true"
                >
                  <Bot className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium text-nw-ink">
                    {a.name}
                    {a.status === 'paused' && <DsPill tone="warn">Paused</DsPill>}
                  </span>
                  <span className="block text-[13px] text-nw-text-3">
                    {connectionTools[a.tool]} ·{' '}
                    {a.serviceIds
                      ? a.serviceIds
                          .map((id) => serviceName.get(id) ?? 'removed service')
                          .join(', ')
                      : 'Every service'}{' '}
                    · Passwords: {passwordAccessLabels[a.passwords].toLowerCase()}
                  </span>
                  <DsMeta>
                    {a.lastUsed ? 'Last used ' + formatDate(a.lastUsed) : 'Not used yet'} ·
                    connected until {formatDate(a.expiresAt)}
                  </DsMeta>
                </span>
                <Button size="sm" variant="outline" onClick={() => setDialog(a)}>
                  Change
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" aria-label={'More for ' + a.name}>
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        edit.mutate(
                          { id: a.id, status: a.status === 'paused' ? 'active' : 'paused' },
                          { onError: (e) => toast.error(errorText(e)) },
                        )
                      }
                    >
                      {a.status === 'paused' ? (
                        <Play aria-hidden="true" />
                      ) : (
                        <Pause aria-hidden="true" />
                      )}
                      {a.status === 'paused' ? 'Resume' : 'Pause'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-700"
                      onClick={async () => {
                        if (
                          !(await confirm({
                            title: 'Disconnect ' + a.name + '?',
                            description:
                              'It stops working straight away. To use it again you connect it afresh.',
                            confirmLabel: 'Disconnect',
                            destructive: true,
                          }))
                        )
                          return;
                        disconnect.mutate(a.id, {
                          onSuccess: (r) =>
                            toast.success(
                              a.name +
                                ' disconnected' +
                                (r.seen.length
                                  ? '. It had received ' +
                                    r.seen.length +
                                    ' passwords; consider changing them.'
                                  : ''),
                            ),
                          onError: (e) => toast.error(errorText(e)),
                        });
                      }}
                    >
                      <Unplug aria-hidden="true" />
                      Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </DsCard>

      {dialog && (
        <AgentDialog
          agent={dialog === 'new' ? undefined : dialog}
          onClose={() => setDialog(null)}
        />
      )}
      {confirmDialog}
    </div>
  );
}

/** The sign-in approval Claude or ChatGPT sends you here for. */
function ConsentRequest() {
  const [request, setRequest] = useState(pendingConsent);
  const [details, setDetails] = useState<{ name: string; redirectUri: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!request) return null;
  const dismiss = () => {
    clearConsent();
    setRequest(null);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Notice
      kind="attention"
      title={details ? details.name + ' wants to sign in.' : 'An AI tool is asking to sign in.'}
      action={
        <span className="flex gap-2">
          {details ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await consentApi.approve(request);
                  clearConsent();
                  window.location.assign(r.redirect);
                })
              }
            >
              Approve
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void run(async () => setDetails(await consentApi.details(request)))}
            >
              Review
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Dismiss
          </Button>
        </span>
      }
    >
      {details
        ? 'Approving lets it use the access you gave it here. You are then sent back to ' +
          new URL(details.redirectUri).hostname +
          '.'
        : 'Review who is asking before you approve.'}
    </Notice>
  );
}
