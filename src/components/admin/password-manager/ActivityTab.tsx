import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import type { VaultEvent, VaultEventActor, VaultRun } from '../../../shared/password-manager';
import { DsPill, DsSegmented } from '../layout/page/ds';
import { listEvents, listRuns } from './vaultApi';
import RunDetail from './RunDetail';
import { ErrorLine, NativeSelect, formatWhen, runStateLabels, useAction } from './ui';

const actorOptions: { value: VaultEventActor | ''; label: string }[] = [
  { value: '', label: 'Everyone' },
  { value: 'person', label: 'People' },
  { value: 'connection', label: 'AI connections' },
  { value: 'runner', label: 'Runner' },
];
const outcomeTone = { ok: 'ok', denied: 'bad', pending: 'warn', failed: 'bad' } as const;

export default function ActivityTab({ onOpenApprovals }: { onOpenApprovals: () => void }) {
  const [view, setView] = useState<'events' | 'runs'>('events');
  return (
    <div className="mx-auto grid max-w-6xl gap-4">
      <DsSegmented
        label="Activity view"
        value={view}
        onChange={setView}
        options={[
          { value: 'events', label: 'Events' },
          { value: 'runs', label: 'Runs' },
        ]}
      />
      {view === 'events' ? <Events /> : <Runs onOpenApprovals={onOpenApprovals} />}
    </div>
  );
}

function Events() {
  const [actor, setActor] = useState<VaultEventActor | ''>('');
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<VaultEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { busy, error, run } = useAction();

  useEffect(() => {
    setLoaded(false);
    void run(async () => {
      const page = await listEvents(null, actor);
      setEvents(page.items);
      setCursor(page.nextCursor);
      setLoaded(true);
    }, 'Could not load activity.');
  }, [actor, run]);

  const needle = search.trim().toLowerCase();
  const shown = needle
    ? events.filter((e) =>
        [e.actorName, e.action, e.credentialName, e.detail, e.outcome]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
    : events;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <NativeSelect
          aria-label="Who"
          className="w-auto"
          value={actor}
          onChange={(e) => setActor(e.target.value as VaultEventActor | '')}
        >
          {actorOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
        <Input
          aria-label="Search activity"
          placeholder="Search activity"
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ErrorLine>{error}</ErrorLine>
      {loaded && !shown.length && <p className="text-sm text-muted-foreground">No activity.</p>}
      <ul className="grid divide-y rounded-lg border bg-white">
        {shown.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
            <span className="min-w-0">
              <span className="font-medium">{e.actorName}</span> {e.action}
              {e.credentialName ? ' · ' + e.credentialName : ''}
              {e.detail && <span className="block text-muted-foreground">{e.detail}</span>}
            </span>
            <span className="flex items-center gap-2">
              <DsPill tone={outcomeTone[e.outcome]}>{e.outcome}</DsPill>
              <span className="text-xs text-muted-foreground">{formatWhen(e.at)}</span>
            </span>
          </li>
        ))}
      </ul>
      {cursor && (
        <Button
          variant="outline"
          className="justify-self-start"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const page = await listEvents(cursor, actor);
              setEvents((rows) => [...rows, ...page.items]);
              setCursor(page.nextCursor);
            })
          }
        >
          Load older activity
        </Button>
      )}
    </div>
  );
}

function Runs({ onOpenApprovals }: { onOpenApprovals: () => void }) {
  const [runs, setRuns] = useState<VaultRun[] | null>(null);
  const [selected, setSelected] = useState<VaultRun | null>(null);
  const { error, run } = useAction();
  const load = useCallback(
    () => run(async () => setRuns(await listRuns()), 'Could not load runs.'),
    [run],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (selected)
    return (
      <RunDetail
        run={selected}
        onBack={() => setSelected(null)}
        onOpenApprovals={onOpenApprovals}
        onChanged={() => void load()}
      />
    );
  return (
    <div className="grid gap-3">
      <ErrorLine>{error}</ErrorLine>
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workflow</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Started by</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No runs yet.
                </TableCell>
              </TableRow>
            )}
            {runs?.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => setSelected(r)}
                  >
                    {r.workflowName}
                  </button>
                </TableCell>
                <TableCell>{r.credentialName}</TableCell>
                <TableCell>{r.connectionName || 'A person'}</TableCell>
                <TableCell>{runStateLabels[r.state]}</TableCell>
                <TableCell>{formatWhen(r.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
