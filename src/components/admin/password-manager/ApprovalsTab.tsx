import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../ui/button';
import type { VaultApproval } from '../../../shared/password-manager';
import { DsPill, DsState } from '../layout/page/ds';
import { approve, deny, listApprovals } from './vaultApi';
import { ErrorLine, formatLeft, formatWhen, useAction, useSecondsLeft } from './ui';

const actionNames: Record<VaultApproval['action'], string> = {
  reveal: 'Reveal the password',
  otp: 'Get a one-time code',
  use: 'Sign in with the login',
  workflow: 'Run a workflow',
  checkpoint: 'Pass a checkpoint',
};
const stateTone = {
  pending: 'warn',
  approved: 'ok',
  consumed: 'ok',
  denied: 'bad',
  expired: 'neutral',
} as const;

export default function ApprovalsTab({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [pending, setPending] = useState<VaultApproval[] | null>(null);
  const [recent, setRecent] = useState<VaultApproval[]>([]);
  const { busy, error, run } = useAction();
  const load = useCallback(async () => {
    const [open, all] = await Promise.all([
      listApprovals('pending'),
      listApprovals('all').catch(() => [] as VaultApproval[]),
    ]);
    setPending(open);
    onCountChange(open.length);
    setRecent(all.filter((a) => a.state !== 'pending').slice(0, 25));
  }, [onCountChange]);

  useEffect(() => {
    void run(load, 'Could not load approvals.');
    const timer = setInterval(() => void load().catch(() => {}), 15_000);
    return () => clearInterval(timer);
  }, [load, run]);

  const decide = (id: string, yes: boolean) =>
    void run(async () => {
      await (yes ? approve(id) : deny(id));
      await load();
    });

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <ErrorLine>{error}</ErrorLine>
      <section className="grid gap-3">
        <h2 className="font-semibold">Waiting for you</h2>
        {pending === null && !error && <p role="status">Loading…</p>}
        {pending?.length === 0 && (
          <DsState title="Nothing to approve">
            Requests from AI connections that need a person appear here.
          </DsState>
        )}
        {pending?.map((a) => (
          <PendingApproval
            key={a.id}
            approval={a}
            busy={busy}
            onApprove={() => decide(a.id, true)}
            onDeny={() => decide(a.id, false)}
          />
        ))}
      </section>
      {recent.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-semibold">Recently decided</h2>
          <ul className="grid divide-y rounded-lg border bg-white">
            {recent.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{actionNames[a.action]}</span> · {a.credentialName}{' '}
                  · {a.personName}
                  <span className="block text-xs text-muted-foreground">
                    {formatWhen(a.createdAt)}
                  </span>
                </span>
                <DsPill tone={stateTone[a.state]}>{a.state}</DsPill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PendingApproval({
  approval: a,
  busy,
  onApprove,
  onDeny,
}: {
  approval: VaultApproval;
  busy: boolean;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const left = useSecondsLeft(Date.parse(a.expiresAt) || null);
  return (
    <article
      aria-label={actionNames[a.action] + ' · ' + a.credentialName}
      className="grid gap-2 rounded-lg border bg-white p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {actionNames[a.action]} · {a.credentialName}
          </p>
          <p className="text-sm text-muted-foreground">
            {a.personName} · {a.connectionName}
          </p>
        </div>
        <span className="text-sm text-muted-foreground">Expires in {formatLeft(left)}</span>
      </div>
      {a.reason && (
        <p className="text-sm">
          <span className="font-medium">Reason: </span>
          {a.reason}
        </p>
      )}
      {a.detail && <p className="text-sm whitespace-pre-wrap">{a.detail}</p>}
      <p className="text-xs text-muted-foreground">
        {a.approvals.length} of {a.requiredApprovals} approval
        {a.requiredApprovals === 1 ? '' : 's'}
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || left <= 0} onClick={onApprove}>
          Approve
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onDeny}>
          Deny
        </Button>
      </div>
    </article>
  );
}
