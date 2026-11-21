import { useEffect, useState } from 'react';
import { api } from '../../../utils/api/client';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { getSetup, ops, options, type Setup } from './portalApi';
import { type PortalRun, providers } from '../../../shared/broker-operations';
import type { VaultSummary } from '../../../shared/password-manager';
import AssistantConnections from './AssistantConnections';
import PortalInspector from './PortalInspector';
import PortalWorkflows from './PortalWorkflows';
export type OpsTab = 'AI connections' | 'Workflows' | 'Runs';

export default function PortalOperations({
  initialTab,
  linkedRun,
  accounts,
  selected,
}: {
  initialTab: OpsTab;
  linkedRun?: string | null;
  accounts: VaultSummary[];
  selected: VaultSummary | null;
}) {
  const [tab, setTab] = useState<OpsTab>(initialTab),
    [setup, setSetup] = useState<Setup | null>(null),
    [version, setVersion] = useState(0),
    [error, setError] = useState('');
  const [runs, setRuns] = useState<PortalRun[]>([]),
    [account, setAccount] = useState(selected?.id ?? ''),
    [workflow, setWorkflow] = useState(''),
    [ids, setIds] = useState<string[]>([]),
    [month, setMonth] = useState(''),
    [brokerFilter, filterBroker] = useState(''),
    [busy, setBusy] = useState(false);
  const [archiveMonth, setArchiveMonth] = useState(''),
    [page, setPage] = useState(0);
  const [history, setHistory] = useState<{
    lastVerified: string | null;
    lastReport: string | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    setHistory(null);
    if (account)
      api
        .get<{ lastVerified: string | null; lastReport: string | null }>(
          ops + '/accounts/' + account + '/history',
          options,
        )
        .then((value) => {
          if (active) setHistory(value);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [account, version]);
  const [inspecting, inspect] = useState<string | null>(linkedRun ?? null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const profile = accounts.find((a) => a.id === account)?.portal;
  const flow = setup?.workflows.find((w) => w.id === workflow);
  useEffect(() => {
    let alive = true;
    getSetup()
      .then((s) => {
        if (alive) setSetup(s);
      })
      .catch(() => {
        if (alive) setError('Could not load operations setup.');
      });
    return () => {
      alive = false;
    };
  }, [version]);
  useEffect(() => {
    if (tab !== 'Runs') return;
    let alive = true,
      pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const d = await api.get<{ runs: PortalRun[] }>(
          ops +
            '/runs?' +
            new URLSearchParams({
              brokerId: brokerFilter,
              month: archiveMonth,
              page: String(page),
            }),
          options,
        );
        if (
          linkedRun &&
          page === 0 &&
          !brokerFilter &&
          !archiveMonth &&
          !d.runs.some((r) => r.id === linkedRun)
        ) {
          const selected = await api.get<PortalRun>(
            ops + '/runs/' + encodeURIComponent(linkedRun),
            options,
          );
          d.runs.unshift(selected);
        }
        if (alive) setRuns(d.runs);
      } catch {
        if (alive) setError('Could not refresh runs.');
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = setInterval(load, 6000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [tab, version, brokerFilter, archiveMonth, page, linkedRun]);
  const reload = () => setVersion((n) => n + 1);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }
  function resetRequest() {
    setRequestId(crypto.randomUUID());
  }
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Broker operations">
        {(['AI connections', 'Workflows', 'Runs'] as const).map((t) => (
          <Button
            key={t}
            variant={tab === t ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setTab(t);
              setError('');
            }}
          >
            {t}
          </Button>
        ))}
      </nav>
      {error && (
        <p role="alert">
          {error} <button onClick={reload}>Refresh</button>
        </p>
      )}
      {!setup && <p role="status">Loading operations…</p>}
      {setup && tab === 'AI connections' && (
        <AssistantConnections connections={setup.connections} reload={reload} />
      )}
      {setup && tab === 'Workflows' && (
        <PortalWorkflows
          loginDefaults={setup.loginDefaults}
          flows={setup.workflows}
          onSave={reload}
        />
      )}
      {setup && tab === 'Runs' && (
        <>
          <form
            className="grid gap-3 rounded-md border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                await api.post(
                  ops + '/runs',
                  {
                    requestId,
                    accountId: account,
                    brokerIds: ids,
                    workflowId: workflow,
                    month: flow?.kind === 'monthly_statement' ? month : undefined,
                  },
                  options,
                );
                resetRequest();
              });
            }}
          >
            <label className="grid gap-1 text-sm">
              Portal account
              <select
                value={account}
                required
                onChange={(e) => {
                  setAccount(e.target.value);
                  setIds([]);
                  setWorkflow('');
                  resetRequest();
                }}
              >
                <option value="">Choose account</option>
                {accounts
                  .filter((a) => a.portal)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.portal?.brokerage || a.username}
                    </option>
                  ))}
              </select>
            </label>
            {history && (
              <p className="text-xs">
                Last verified sign-in ·{' '}
                {history.lastVerified
                  ? new Date(history.lastVerified).toLocaleString()
                  : 'No verified run'}
                <br />
                Last filed statement ·{' '}
                {history.lastReport
                  ? new Date(history.lastReport).toLocaleString()
                  : 'No filed statement'}
              </p>
            )}
            {profile && (
              <>
                <label className="grid gap-1 text-sm">
                  Workflow
                  <select
                    required
                    value={workflow}
                    onChange={(e) => {
                      setWorkflow(e.target.value);
                      resetRequest();
                    }}
                  >
                    <option value="">Choose workflow</option>
                    {setup.workflows
                      .filter((w) => w.provider === profile.provider)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </label>
                <fieldset className="space-y-1">
                  <legend>Brokers</legend>
                  {profile.brokers.map((b) => (
                    <label className="mr-3 inline-flex items-center gap-2" key={b.brokerId}>
                      <input
                        type="checkbox"
                        checked={ids.includes(b.brokerId)}
                        onChange={(e) => {
                          setIds(
                            e.target.checked
                              ? [...ids, b.brokerId]
                              : ids.filter((id) => id !== b.brokerId),
                          );
                          resetRequest();
                        }}
                      />
                      {setup.brokers.find((row) => row.id === b.brokerId)?.name} · {b.code}
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            {flow?.kind === 'monthly_statement' && (
              <label className="grid gap-1">
                Statement month
                <Input
                  type="month"
                  required
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    resetRequest();
                  }}
                />
              </label>
            )}
            <Button disabled={busy || !ids.length || !workflow} className="justify-self-start">
              {flow?.kind === 'test_login' ? 'Test login' : 'Start run'}
            </Button>
          </form>
          <label className="grid gap-1 text-sm">
            Run history and filed documents
            <select
              value={brokerFilter}
              onChange={(e) => {
                filterBroker(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All brokers</option>
              {setup.brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Filter by statement month
            <Input
              type="month"
              value={archiveMonth}
              onChange={(e) => {
                setArchiveMonth(e.target.value);
                setPage(0);
              }}
            />
          </label>
          {(page > 0 || runs.length === 50) && (
            <div className="flex gap-2">
              <Button variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>
                Newer runs
              </Button>
              <Button
                variant="outline"
                disabled={runs.length < 50}
                onClick={() => setPage(page + 1)}
              >
                Older runs
              </Button>
            </div>
          )}
          {!runs.length && <p>No runs for this selection.</p>}
          {runs.map((r) => (
            <article
              key={r.id}
              className={
                r.id === linkedRun
                  ? 'space-y-1 rounded-md border border-primary p-3'
                  : 'space-y-1 border-t py-3'
              }
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong>
                  {r.brokerName} · {r.workflowName}
                </strong>
                <span>{r.state.replaceAll('_', ' ')}</span>
              </div>
              <p className="text-sm">
                {providers[r.provider].name} · {r.code} · {r.month || 'Login check'} ·{' '}
                {new Date(r.createdAt).toLocaleString()}
              </p>
              <p className="text-sm">{r.message}</p>
              {r.verifiedIdentity && (
                <p className="text-xs">Verified account · {r.verifiedIdentity}</p>
              )}
              {inspecting === r.id && <PortalInspector id={r.id} />}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => inspect(inspecting === r.id ? null : r.id)}
                >
                  {inspecting === r.id ? 'Close checkpoint' : 'Inspect run'}
                </Button>
                {r.state === 'awaiting_mfa' && (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await api.post(ops + '/runs/' + r.id + '/resume', {}, options);
                      })
                    }
                  >
                    Resume after approval
                  </Button>
                )}
                {['queued', 'running', 'awaiting_mfa'].includes(r.state) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await api.post(ops + '/runs/' + r.id + '/cancel', {}, options);
                      })
                    }
                  >
                    Cancel run
                  </Button>
                )}
                {['failed', 'missing', 'cancelled'].includes(r.state) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await api.post(
                          ops + '/runs',
                          {
                            requestId: crypto.randomUUID(),
                            accountId: r.accountId,
                            brokerIds: [r.brokerId],
                            workflowId: r.workflowId,
                            month: r.month || undefined,
                          },
                          options,
                        );
                      })
                    }
                  >
                    Retry this broker
                  </Button>
                )}
                {r.document && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        const d = await api.post<{ url: string }>(
                          ops + '/runs/' + r.id + '/document',
                          {},
                          options,
                        );
                        const a = document.createElement('a');
                        a.href = d.url;
                        a.rel = 'noreferrer';
                        a.click();
                      })
                    }
                  >
                    Download filed PDF
                  </Button>
                )}
              </div>
            </article>
          ))}
        </>
      )}
    </div>
  );
}
