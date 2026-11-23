import { useEffect, useState } from 'react';
import { Button } from '../../ui/button';
import {
  actionModes,
  type ActionMode,
  type TrustSuggestion,
  type VaultConnection,
} from '../../../shared/password-manager';
import { trustSuggestions, updateConnection } from './vaultApi';
import { ErrorLine, useAction } from './ui';

type Row = TrustSuggestion & { connection: VaultConnection };

/** Workflows with a clean record that could be given more autonomy. */
export default function TrustSuggestions({
  connections,
  onChanged,
}: {
  connections: VaultConnection[];
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  // Overrides applied here, kept so two quick moves on one connection both stick.
  const [applied, setApplied] = useState<Record<string, Record<string, ActionMode>>>({});
  const { busy, error, run } = useAction();
  const active = connections.filter((c) => c.status === 'active');
  const ids = active.map((c) => c.id).join(',');

  useEffect(() => {
    let alive = true;
    const targets = connections.filter((c) => c.status === 'active');
    Promise.all(
      targets.map((c) =>
        trustSuggestions(c.id)
          .then((list) => list.map((s) => ({ ...s, connection: c })))
          .catch(() => [] as Row[]),
      ),
    ).then((lists) => {
      if (alive) setRows(lists.flat());
    });
    return () => {
      alive = false;
    };
    // Reload when the set of active connections changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const key = (r: Row) => r.connection.id + ':' + r.workflowId;
  const shown = rows.filter((r) => !dismissed.includes(key(r)));
  if (!shown.length) return null;
  return (
    <section className="grid gap-3 rounded-lg border bg-white p-4">
      <h2 className="font-semibold">Ready for more trust</h2>
      <ErrorLine>{error}</ErrorLine>
      <ul className="grid gap-2">
        {shown.map((r) => (
          <li
            key={key(r)}
            className="flex flex-wrap items-center justify-between gap-2 border-t pt-2"
          >
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                {r.workflowName} · {r.credentialName}
              </p>
              <p className="text-muted-foreground">
                {r.connection.name}: {actionModes[r.current]} → {actionModes[r.suggested]}.{' '}
                {r.cleanRuns} clean runs. {r.reason}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const cid = r.connection.id;
                    const autonomy = (connections.find((c) => c.id === cid) ?? r.connection)
                      .autonomy;
                    const workflowOverrides = {
                      ...autonomy.workflowOverrides,
                      ...applied[cid],
                      [r.workflowId]: r.suggested,
                    };
                    await updateConnection(cid, { autonomy: { ...autonomy, workflowOverrides } });
                    setApplied((a) => ({ ...a, [cid]: workflowOverrides }));
                    setDismissed((d) => [...d, key(r)]);
                    onChanged();
                  })
                }
              >
                Move up
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDismissed((d) => [...d, key(r)])}>
                Not now
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
