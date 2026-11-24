/** Password requests waiting for you, then everything people and agents did. */
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import {
  DsCard,
  DsCardBody,
  DsCardHead,
  DsMeta,
  DsPill,
  DsSegmented,
  DsState,
  ErrorState,
  type DsTone,
} from '../../layout/page';
import type { VaultEvent, VaultEventActor } from '../../../../shared/password-manager';
import { errorText, vaultApi } from './api';
import { passwordManagerKeys, useApprovals, useVaultMutation } from './hooks';
import { Loading } from './parts';
import { formatDateTime } from './format';

type Who = 'all' | VaultEventActor;
const OUTCOME: Record<VaultEvent['outcome'], { tone: DsTone; label: string }> = {
  ok: { tone: 'ok', label: 'Done' },
  denied: { tone: 'bad', label: 'Refused' },
  pending: { tone: 'warn', label: 'Waiting' },
  failed: { tone: 'bad', label: 'Failed' },
};

export function ActivityTab() {
  const approvals = useApprovals();
  const decide = useVaultMutation((a: { id: string; decision: 'approve' | 'deny' }) =>
    vaultApi.decide(a.id, a.decision),
  );
  const [who, setWho] = useState<Who>('all');
  const events = useInfiniteQuery({
    queryKey: passwordManagerKeys.events(who),
    queryFn: ({ pageParam }) =>
      vaultApi.events(pageParam || undefined, who === 'all' ? undefined : who),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = events.data?.pages.flatMap((p) => p.items) ?? [];
  const waiting = approvals.data ?? [];

  return (
    <div className="grid gap-5">
      <DsCard>
        <DsCardHead
          title={'Waiting for you' + (waiting.length ? ' (' + waiting.length + ')' : '')}
        />
        {waiting.length === 0 ? (
          <DsCardBody>
            <p className="text-sm text-nw-text-3">
              Nothing waiting. When an agent asks for a password that needs your approval, it
              appears here.
            </p>
          </DsCardBody>
        ) : (
          <ul className="divide-y divide-nw-line">
            {waiting.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-nw-ink">
                    {a.connectionName} wants the {a.action === 'otp' ? 'one-time code' : 'password'}{' '}
                    for {a.credentialName}
                  </span>
                  <span className="block text-sm text-nw-text-2">“{a.reason}”</span>
                  <DsMeta>
                    Asked {formatDateTime(a.createdAt)} · expires {formatDateTime(a.expiresAt)}
                  </DsMeta>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate(
                      { id: a.id, decision: 'deny' },
                      { onError: (e) => toast.error(errorText(e)) },
                    )
                  }
                >
                  Deny
                </Button>
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate(
                      { id: a.id, decision: 'approve' },
                      {
                        onSuccess: () =>
                          toast.success('Approved. The agent can now ask again and receive it.'),
                        onError: (e) => toast.error(errorText(e)),
                      },
                    )
                  }
                >
                  Approve
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DsCard>

      <DsCard>
        <DsCardHead
          title="Activity"
          actions={
            <DsSegmented<Who>
              label="Show"
              value={who}
              onChange={setWho}
              options={[
                { value: 'all', label: 'Everyone' },
                { value: 'person', label: 'People' },
                { value: 'connection', label: 'AI agents' },
              ]}
            />
          }
        />
        {events.isLoading ? (
          <Loading what="activity" />
        ) : events.error ? (
          <DsCardBody>
            <ErrorState
              title="Activity did not load"
              description={errorText(events.error)}
              onRetry={() => void events.refetch()}
            />
          </DsCardBody>
        ) : rows.length === 0 ? (
          <DsState icon={<History />} title="Nothing yet">
            Every login change, skill edit, agent request and password given out is recorded here.
          </DsState>
        ) : (
          <>
            <ul className="divide-y divide-nw-line">
              {rows.map((e) => (
                <li key={e.id} className="flex flex-wrap items-start gap-3 px-5 py-2.5 text-sm">
                  <DsMeta className="w-28 shrink-0 pt-0.5">{formatDateTime(e.at)}</DsMeta>
                  <span className="min-w-0 flex-1">
                    <span className="text-nw-ink">
                      <strong className="font-medium">{e.actorName}</strong>{' '}
                      {e.action.toLowerCase()}
                      {e.credentialName ? ' · ' + e.credentialName : ''}
                    </span>
                    {e.detail && <span className="block text-nw-text-3">{e.detail}</span>}
                  </span>
                  <DsPill tone={OUTCOME[e.outcome].tone}>{OUTCOME[e.outcome].label}</DsPill>
                </li>
              ))}
            </ul>
            {events.hasNextPage && (
              <div className="border-t border-nw-line px-5 py-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={events.isFetchingNextPage}
                  onClick={() => void events.fetchNextPage()}
                >
                  Show older
                </Button>
              </div>
            )}
          </>
        )}
      </DsCard>
    </div>
  );
}
