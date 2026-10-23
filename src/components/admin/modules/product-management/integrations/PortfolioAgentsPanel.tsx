/**
 * PortfolioAgentsPanel — the token each outside agent uses on the endpoint.
 *
 * One token per agent (ROADMAP §9a): the agent's name is the actor recorded on
 * every change it makes, and revoking one agent leaves the others working. A
 * super admin issues and revokes them here; anyone else sees one line saying
 * so, and the list is never fetched for them.
 *
 * A token is shown once, straight after it is issued, and kept only in this
 * component's state until the admin dismisses it. If it is lost, revoke the
 * name and issue it a new token; the actor stays the same.
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { cn } from '../../../../ui/utils';
import { productManagementApi } from '../api';
import { integrationsKeys } from '../../../../../utils/queryKeys';
import { copyToClipboard } from '../../../../../utils/clipboard';
import { useCurrentUserPermissions } from '../../personnel';
import {
  PORTFOLIO_TOKEN_HEADER,
  normalisePortfolioAgentName,
  portfolioAgentNameProblem,
  type PortfolioAgent,
  type PortfolioAgentIssued,
} from '@/shared/integrations/portfolio-table';
import { formatPortfolioDateTime } from './portfolioFormat';

/** The agent the migration made from the original shared token. */
const CARRIED_OVER_AGENT = 'shared';

const HEAD =
  'border-b border-gray-200 bg-gray-50 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500';
const CELL = 'border-b border-gray-100 px-3 py-2 align-middle text-sm text-gray-700';

function RevealedToken({ issued, onDone }: { issued: PortfolioAgentIssued; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await copyToClipboard(issued.token);
      setCopied(true);
      toast.success('Token copied');
    } catch {
      toast.error('Could not copy the token. Select it and copy it by hand.');
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-3"
    >
      <p className="text-sm font-medium text-green-900">
        Token for <span className="font-semibold">{issued.agent.name}</span>. Copy it now: it is
        shown only this once.
      </p>
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-white py-1 pr-1 pl-3">
        <code
          className="min-w-0 flex-1 truncate font-mono text-xs text-gray-900"
          aria-label={`Token for ${issued.agent.name}`}
        >
          {issued.token}
        </code>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1.5 text-xs"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy token'}
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-green-800">
          Give it to the agent as the <code>{PORTFOLIO_TOKEN_HEADER}</code> header.
        </p>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

export function PortfolioAgentsPanel() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useCurrentUserPermissions();
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [issued, setIssued] = useState<PortfolioAgentIssued | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const {
    data: agents,
    isLoading,
    error,
  } = useQuery({
    queryKey: integrationsKeys.portfolioAgents(),
    queryFn: () => productManagementApi.listPortfolioAgents(),
    enabled: isSuperAdmin,
  });

  const refreshAgents = () =>
    queryClient.invalidateQueries({ queryKey: integrationsKeys.portfolioAgents() });

  const issueMutation = useMutation({
    mutationFn: (agentName: string) => productManagementApi.issuePortfolioAgentToken(agentName),
    onSuccess: (result) => {
      setIssued(result);
      setName('');
      setNameTouched(false);
      refreshAgents();
    },
    onError: (err: Error) => toast.error(err.message || 'Could not issue the token'),
  });

  const revokeMutation = useMutation({
    mutationFn: (agentName: string) => productManagementApi.revokePortfolioAgentToken(agentName),
    onSuccess: (agent) => {
      setConfirming(null);
      toast.success(`Revoked the token for ${agent.name}`);
      refreshAgents();
    },
    onError: (err: Error) => toast.error(err.message || 'Could not revoke the token'),
  });

  if (!isSuperAdmin) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
        Each agent has its own token. A super admin issues and revokes them here.
      </p>
    );
  }

  const normalised = normalisePortfolioAgentName(name);
  const problem = normalised ? portfolioAgentNameProblem(normalised) : null;
  const live = (agents ?? []).filter((agent) => !agent.revokedAt);
  const nameIsLive = live.some((agent) => agent.name === normalised);

  const handleIssue = (event: React.FormEvent) => {
    event.preventDefault();
    setNameTouched(true);
    if (!normalised || problem || nameIsLive) return;
    issueMutation.mutate(normalised);
  };

  const renderStatus = (agent: PortfolioAgent) =>
    agent.revokedAt ? (
      <span className="text-xs text-gray-500">
        Revoked {formatPortfolioDateTime(agent.revokedAt)}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
        Live
      </span>
    );

  const renderAction = (agent: PortfolioAgent) => {
    if (agent.revokedAt) return null;
    if (confirming === agent.name) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-xs text-gray-600">Revoke {agent.name}?</span>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs"
            disabled={revokeMutation.isPending}
            onClick={() => revokeMutation.mutate(agent.name)}
          >
            {revokeMutation.isPending && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
            )}
            Yes, revoke
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setConfirming(null)}
          >
            Cancel
          </Button>
        </span>
      );
    }
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setConfirming(agent.name)}
        aria-label={`Revoke the token for ${agent.name}`}
      >
        Revoke
      </Button>
    );
  };

  const nameError = nameTouched && normalised ? problem : null;
  const duplicateError =
    nameTouched && !problem && nameIsLive
      ? `"${normalised}" already has a live token. Revoke it first to issue a new one.`
      : null;

  return (
    <div className="space-y-3">
      <div>
        <h5 className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <KeyRound className="h-4 w-4 text-gray-400" aria-hidden="true" />
          Agent tokens
        </h5>
        <p className="mt-0.5 text-xs text-gray-500">
          Each agent sends its own token, and its name is recorded on every change it makes.
          Revoking one agent leaves the others working.
        </p>
      </div>

      {issued && <RevealedToken issued={issued} onDone={() => setIssued(null)} />}

      {isLoading ? (
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Loading agent tokens…
        </p>
      ) : error ? (
        <p className="text-xs text-red-700">
          The agent tokens could not be loaded:{' '}
          {error instanceof Error ? error.message : 'unexpected error'}
        </p>
      ) : (agents ?? []).length === 0 ? (
        <p className="text-xs text-gray-500">No agent has a token yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th scope="col" className={HEAD}>
                  Agent
                </th>
                <th scope="col" className={HEAD}>
                  Issued
                </th>
                <th scope="col" className={HEAD}>
                  Last used
                </th>
                <th scope="col" className={HEAD}>
                  Status
                </th>
                <th scope="col" className={cn(HEAD, 'text-right')}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(agents ?? []).map((agent) => (
                <tr
                  key={`${agent.name}:${agent.createdAt}`}
                  className={cn(agent.revokedAt && 'text-gray-400')}
                >
                  <th scope="row" className={cn(CELL, 'font-medium text-gray-900')}>
                    {agent.name}
                    {agent.name === CARRIED_OVER_AGENT && !agent.revokedAt && (
                      <span className="mt-0.5 block text-[11px] font-normal text-amber-700">
                        The original shared token. Revoke it once every agent has its own.
                      </span>
                    )}
                  </th>
                  <td className={cn(CELL, 'whitespace-nowrap tabular-nums')}>
                    {formatPortfolioDateTime(agent.createdAt)}
                  </td>
                  <td className={cn(CELL, 'whitespace-nowrap tabular-nums')}>
                    {agent.lastUsedAt ? formatPortfolioDateTime(agent.lastUsedAt) : 'Never'}
                  </td>
                  <td className={CELL}>{renderStatus(agent)}</td>
                  <td className={cn(CELL, 'text-right whitespace-nowrap')}>
                    {renderAction(agent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleIssue} className="flex flex-wrap items-start gap-2" noValidate>
        <div className="w-full sm:w-56">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setNameTouched(true)}
            placeholder="Agent name, e.g. grok"
            aria-label="Agent name"
            aria-invalid={Boolean(nameError || duplicateError)}
            className="h-9 text-sm"
            maxLength={40}
          />
          {(nameError || duplicateError) && (
            <p className="mt-1 text-xs text-red-700">{nameError || duplicateError}</p>
          )}
        </div>
        <Button
          type="submit"
          size="sm"
          className="h-9 bg-purple-600 hover:bg-purple-700"
          disabled={!normalised || issueMutation.isPending}
        >
          {issueMutation.isPending && (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          Issue token
        </Button>
      </form>
    </div>
  );
}
