import { useCallback, useEffect, useState } from 'react';
import { Copy, Pause, Play, Plus } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import {
  autonomyLevels,
  connectionLevels,
  type Collection,
  type IssuedConnection,
  type VaultConnection,
  type VaultSummary,
} from '../../../shared/password-manager';
import { DsPill } from '../layout/page/ds';
import ConnectionForm from './ConnectionForm';
import TrustSuggestions from './TrustSuggestions';
import {
  listConnections,
  pauseAllConnections,
  resumeAllConnections,
  revokeConnection,
  updateConnection,
} from './vaultApi';
import { collectionName } from './vaultFilters';
import {
  ErrorLine,
  VAULT_MCP_ENDPOINT,
  copyText,
  formatDay,
  formatWhen,
  toolLabels,
  useAction,
} from './ui';

export default function ConnectionsTab({
  items,
  collections,
}: {
  items: VaultSummary[];
  collections: Collection[];
}) {
  const [rows, setRows] = useState<VaultConnection[] | null>(null);
  const [editing, setEditing] = useState<VaultConnection | 'new' | null>(null);
  const [issued, setIssued] = useState<IssuedConnection | null>(null);
  const [revoked, setRevoked] = useState<{ name: string; seen: VaultSummary[] } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const { busy, error, run } = useAction();
  const load = useCallback(
    () => run(async () => setRows(await listConnections()), 'Could not load AI connections.'),
    [run],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const levelOf = (c: VaultConnection) =>
    c.autonomy.level === 'custom' ? 'Custom' : autonomyLevels[c.autonomy.level];

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <section className="grid gap-3 rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Connect an AI tool</h2>
        <div className="flex gap-2">
          <Input
            readOnly
            aria-label="Password vault MCP server URL"
            value={VAULT_MCP_ENDPOINT}
            onFocus={(e) => e.target.select()}
          />
          <Button
            variant="outline"
            onClick={() =>
              void run(async () => {
                await copyText(VAULT_MCP_ENDPOINT);
                setNotice('Server URL copied.');
              })
            }
          >
            <Copy aria-hidden="true" />
            Copy
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          In Claude, add a custom connector with this URL. In ChatGPT, create an app in the
          workspace’s developer settings. Create a connection below first: give it the client’s
          OAuth callback URL to get a client ID and secret, or leave the callback empty to get a
          bearer token for a custom client.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          New connection
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await pauseAllConnections();
              setNotice('All AI access is paused.');
              await load();
            })
          }
        >
          <Pause aria-hidden="true" />
          Pause all AI access
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await resumeAllConnections();
              setNotice('AI access resumed.');
              await load();
            })
          }
        >
          <Play aria-hidden="true" />
          Resume all
        </Button>
      </div>
      {notice && <p role="status">{notice}</p>}
      <ErrorLine>{error}</ErrorLine>

      {issued && (
        <section className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-semibold">
            Copy these settings now. The {issued.clientSecret ? 'secret' : 'token'} is shown once.
          </p>
          {issued.clientSecret && (
            <label className="grid gap-1">
              Client ID
              <Input readOnly value={issued.connection.id} onFocus={(e) => e.target.select()} />
            </label>
          )}
          <label className="grid gap-1">
            {issued.clientSecret ? 'Client secret' : 'Bearer token'}
            <Input
              readOnly
              autoComplete="off"
              value={issued.clientSecret ?? issued.token ?? ''}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void run(async () => {
                  await copyText(issued.clientSecret ?? issued.token ?? '', true);
                  setNotice('Copied. The clipboard clears in 30 seconds.');
                })
              }
            >
              <Copy aria-hidden="true" />
              Copy
            </Button>
            <Button variant="ghost" onClick={() => setIssued(null)}>
              Done
            </Button>
          </div>
        </section>
      )}

      {revoked && (
        <section className="grid gap-2 rounded-lg border p-4 text-sm" role="status">
          <p className="font-semibold">{revoked.name} is revoked.</p>
          {revoked.seen.length ? (
            <>
              <p>It had seen these passwords. Change them at the provider soon:</p>
              <ul className="list-disc pl-5">
                {revoked.seen.map((item) => (
                  <li key={item.id}>
                    {item.name || item.url} · {item.username}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>It had not seen any passwords.</p>
          )}
          <Button variant="ghost" className="justify-self-start" onClick={() => setRevoked(null)}>
            Dismiss
          </Button>
        </section>
      )}

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Connection</TableHead>
              <TableHead>Collections</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Autonomy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  No AI connections yet.
                </TableCell>
              </TableRow>
            )}
            {rows?.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <span className="block font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.personName} · {toolLabels[c.tool] ?? c.tool}
                  </span>
                </TableCell>
                <TableCell className="max-w-[12rem] whitespace-normal">
                  {c.collectionIds.map((id) => collectionName(collections, id)).join(', ') || '—'}
                  {c.tagFilter && (
                    <span className="block text-xs text-muted-foreground">
                      Tagged {c.tagFilter}
                    </span>
                  )}
                </TableCell>
                <TableCell>{connectionLevels[c.level]}</TableCell>
                <TableCell>{levelOf(c)}</TableCell>
                <TableCell>
                  <DsPill
                    tone={c.status === 'active' ? 'ok' : c.status === 'paused' ? 'warn' : 'bad'}
                  >
                    {c.status === 'active'
                      ? 'Active'
                      : c.status === 'paused'
                        ? 'Paused'
                        : 'Revoked'}
                  </DsPill>
                </TableCell>
                <TableCell>{formatWhen(c.lastUsed)}</TableCell>
                <TableCell>{formatDay(c.expiresAt)}</TableCell>
                <TableCell>
                  {c.status !== 'revoked' && (
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await updateConnection(c.id, {
                              status: c.status === 'active' ? 'paused' : 'active',
                            });
                            await load();
                          })
                        }
                      >
                        {c.status === 'active' ? 'Pause' : 'Resume'}
                      </Button>
                      <Button
                        size="sm"
                        variant={confirmRevoke === c.id ? 'destructive' : 'outline'}
                        disabled={busy}
                        onClick={() => {
                          if (confirmRevoke !== c.id) {
                            setConfirmRevoke(c.id);
                            return;
                          }
                          void run(async () => {
                            await revokeConnection(c.id);
                            setConfirmRevoke(null);
                            setRevoked({
                              name: c.name,
                              seen: items.filter((item) =>
                                item.seenByAi?.some((s) => s.connectionId === c.id),
                              ),
                            });
                            await load();
                          });
                        }}
                      >
                        {confirmRevoke === c.id ? 'Confirm revoke' : 'Revoke'}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {rows && <TrustSuggestions connections={rows} onChanged={() => void load()} />}

      {editing && (
        <ConnectionForm
          connection={editing === 'new' ? null : editing}
          collections={collections}
          onClose={() => setEditing(null)}
          onSaved={(result) => {
            setEditing(null);
            if (result) setIssued(result);
            setNotice('Connection saved.');
            void load();
          }}
        />
      )}
    </div>
  );
}
