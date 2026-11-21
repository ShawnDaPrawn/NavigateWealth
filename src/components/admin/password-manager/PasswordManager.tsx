import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Plus, Upload } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { api } from '../../../utils/api/client';
import { getModuleUrl } from '../../../utils/api/config';
import type { CredentialInput, VaultPage, VaultSummary } from '../../../shared/password-manager';
import { importCsv } from './importCsv';

import PortalProfileFields from './PortalProfileFields';
import PortalOperations, { type OpsTab } from './PortalOperations';

import { providers } from '../../../shared/broker-operations';
import { getSetup, consentRequest } from './portalApi';
import type { Broker } from '../../../shared/broker-operations';

const path = '/password-vault';
const empty: CredentialInput = { name: '', url: '', username: '', password: '', notes: '' };
const request = { retryTransientFailures: false, cache: 'no-store' } as const;
type Screen = 'list' | 'edit' | 'add' | 'import' | 'connect' | 'delete' | 'operations';
type IssuedToken = { token: string; expiresAt: string };

export default function PasswordManager({ onClose }: { onClose: () => void }) {
  const [linkedRun] = useState(() => new URLSearchParams(window.location.search).get('brokerRun'));
  const [screen, setScreen] = useState<Screen>(() =>
    consentRequest() || linkedRun ? 'operations' : 'list',
  );
  const [opsTab, setOpsTab] = useState<OpsTab>(linkedRun ? 'Runs' : 'AI connections'),
    [search, setSearch] = useState(''),
    [directory, setDirectory] = useState<Broker[]>([]);
  const [preview, setPreview] = useState<CredentialInput[]>([]),
    [chosen, setChosen] = useState<number[]>([]);
  const [items, setItems] = useState<VaultSummary[]>([]);
  const [selection, select] = useState<VaultSummary | null>(null);
  const [draft, setDraft] = useState<CredentialInput>(empty);
  const [visible, show] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [generation, refresh] = useState(0);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    async function load() {
      const all: VaultSummary[] = [];
      let cursor: string | null = null;
      do {
        const page: VaultPage = await api.get<VaultPage>(
          path + (cursor ? '?after=' + encodeURIComponent(cursor) : ''),
          request,
        );
        if (!active) return;
        all.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      if (active) {
        setItems(all);
      }
      if (all.some((a) => a.portal)) {
        const d = await getSetup();
        if (active) setDirectory(d.brokers);
      }
    }
    load()
      .catch(() => {
        if (active)
          setError('Could not load credentials. Check your access and vault configuration.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [generation]);

  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Try again.');
    } finally {
      setBusy(false);
    }
  }
  function go(next: Screen, item: VaultSummary | null = null) {
    setScreen(next);
    select(item);
    setDraft(empty);
    show(false);
    setFile(null);
    setPreview([]);
    setChosen([]);
    setIssued(null);
    setError('');
    setNotice('');
  }
  function back(message = '') {
    go('list');
    setNotice(message);
    refresh((n) => n + 1);
  }
  function edit(item: VaultSummary) {
    void perform(async () => {
      const detail = await api.post<VaultSummary & CredentialInput>(
        path + '/' + item.id + '/reveal',
        {},
        request,
      );
      go('edit', { ...item, revision: detail.revision });
      setDraft({
        name: detail.name,
        url: detail.url,
        username: detail.username,
        password: detail.password,
        notes: detail.notes,
        portal: detail.portal,
      });
    });
  }
  const itemPath = path + '/' + selection?.id;
  const connected = Boolean(
    selection?.connectionExpiresAt && Date.parse(selection.connectionExpiresAt) > Date.now(),
  );
  const titles: Record<Screen, string> = {
    operations: 'Broker operations',
    list: 'Password manager',
    edit: 'Edit credential',
    add: 'Add credential',
    import: 'Import passwords',
    connect: 'MCP connection',
    delete: 'Delete credential?',
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titles[screen]}</DialogTitle>
          <DialogDescription>
            {screen === 'operations'
              ? 'Manage assistant connections, provider workflows and broker runs.'
              : screen === 'list'
                ? 'Saved logins and service access'
                : screen === 'import'
                  ? 'Upload a CSV exported from your password manager.'
                  : screen === 'connect'
                    ? 'Give a service read access to this login.'
                    : screen === 'delete'
                      ? 'Deleting this login also revokes its MCP connection.'
                      : 'Store the sign-in details for a service.'}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        {screen === 'operations' && (
          <PortalOperations
            linkedRun={linkedRun}
            initialTab={opsTab}
            accounts={items}
            selected={selection}
          />
        )}
        {screen === 'list' && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => go('add')}>
                <Plus />
                Add credential
              </Button>
              <Button disabled={busy} variant="outline" onClick={() => go('import')}>
                <Upload />
                Import CSV
              </Button>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => {
                  setOpsTab('AI connections');
                  go('operations');
                }}
              >
                Broker operations
              </Button>
              {error && (
                <Button disabled={busy} variant="outline" onClick={() => refresh((n) => n + 1)}>
                  Retry
                </Button>
              )}
            </div>
            {busy && (
              <p role="status" className="text-sm text-muted-foreground">
                Loading…
              </p>
            )}
            {!items.length && !busy && !error && (
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Your vault is empty. Add a login or import a CSV to get started.
              </p>
            )}
            {items.length > 0 && (
              <Input
                aria-label="Search portal accounts"
                placeholder="Search by account, broker, provider or code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
            <ul className="divide-y">
              {items
                .filter((item) =>
                  [
                    item.name,
                    item.url,
                    item.username,
                    item.portal?.brokerage,
                    item.portal?.purpose,
                    item.portal && providers[item.portal.provider].name,
                    ...(item.portal?.brokers.flatMap((b) => [
                      b.code,
                      directory.find((row) => row.id === b.brokerId)?.name,
                    ]) ?? []),
                  ]
                    .join(' ')
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {item.username} · {new URL(item.url).host}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {item.portal && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setOpsTab('Runs');
                            go('operations', item);
                          }}
                        >
                          Run
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => edit(item)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => go('connect', item)}
                      >
                        <KeyRound />
                        MCP
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          </>
        )}
        {(screen === 'add' || screen === 'edit') && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void perform(async () => {
                if (selection)
                  await api.put(
                    itemPath,
                    {
                      revision: selection.revision,
                      credential: draft,
                      clearPortal: !!selection.portal && !draft.portal,
                    },
                    request,
                  );
                else await api.post(path, { entries: [draft] }, request);
                back('Credential saved.');
              });
            }}
          >
            <fieldset className="grid gap-3" disabled={busy}>
              {(['name', 'url', 'username', 'password', 'notes'] as const).map((field) => (
                <label
                  className="grid gap-1 text-sm font-medium"
                  key={field}
                  htmlFor={'vault-' + field}
                >
                  {
                    {
                      name: 'Name (optional)',
                      url: 'Website URL',
                      username: 'Username',
                      password: 'Password',
                      notes: 'Notes (optional)',
                    }[field]
                  }
                  <span className="flex gap-2">
                    {field === 'notes' ? (
                      <Textarea
                        id="vault-notes"
                        maxLength={8192}
                        value={draft.notes}
                        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                      />
                    ) : (
                      <Input
                        id={'vault-' + field}
                        required={field === 'url' || field === 'password'}
                        type={
                          field === 'password' && !visible
                            ? 'password'
                            : field === 'url'
                              ? 'url'
                              : 'text'
                        }
                        maxLength={{ name: 200, url: 2048, username: 512, password: 8192 }[field]}
                        autoComplete={field === 'password' ? 'new-password' : 'off'}
                        spellCheck={false}
                        value={draft[field]}
                        onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                      />
                    )}
                    {field === 'password' && (
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={visible ? 'Hide password' : 'Show password'}
                        onClick={() => show(!visible)}
                      >
                        {visible ? <EyeOff /> : <Eye />}
                      </Button>
                    )}
                  </span>
                </label>
              ))}
              <PortalProfileFields
                profile={draft.portal}
                onChange={(portal) => setDraft({ ...draft, portal })}
              />
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy}>Save credential</Button>
              {selection && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => go('delete', selection)}
                >
                  Delete
                </Button>
              )}
            </div>
          </form>
        )}
        {screen === 'import' && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void perform(async () => {
                if (!file) return;
                if (file.size > 1024 * 1024)
                  throw new Error('Choose a CSV file smaller than 1 MiB.');
                if (!preview.length) {
                  const entries = importCsv(await file.text());
                  const seen = new Set(items.map((a) => a.url + '\n' + a.username));
                  setChosen(
                    entries.flatMap((row, i) => {
                      const key = row.url + '\n' + row.username;
                      if (seen.has(key)) return [];
                      seen.add(key);
                      return [i];
                    }),
                  );
                  setPreview(entries);
                  return;
                }
                const entries = preview.filter((_, i) => chosen.includes(i));
                const result = await api.post<{ count: number }>(path, { entries }, request);
                back(
                  'Imported ' + result.count + ' credential' + (result.count === 1 ? '.' : 's.'),
                );
              });
            }}
          >
            <p className="text-sm">
              Include <code>url</code>, <code>username</code> and <code>password</code> columns. You
              can also include <code>name</code> and <code>notes</code>. Import up to 100 rows per
              file.
            </p>
            <Input
              aria-label="Passwords CSV file"
              type="file"
              accept=".csv,text/csv"
              required
              disabled={busy}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview([]);
                setChosen([]);
              }}
            />
            {preview.length > 0 && (
              <fieldset>
                <legend>Choose accounts to import. Matching logins are initially unchecked.</legend>
                {preview.map((row, i) => (
                  <label className="flex items-center gap-2 py-1 text-sm" key={i}>
                    <input
                      type="checkbox"
                      checked={chosen.includes(i)}
                      onChange={(e) =>
                        setChosen(e.target.checked ? [...chosen, i] : chosen.filter((n) => n !== i))
                      }
                    />
                    {row.name || row.url} · {row.username}
                  </label>
                ))}
              </fieldset>
            )}
            <Button disabled={busy || !file || (!!preview.length && !chosen.length)}>
              {preview.length ? 'Import ' + chosen.length + ' accounts' : 'Preview import'}
            </Button>
          </form>
        )}
        {screen === 'connect' && selection && (
          <div className="space-y-4 text-sm">
            <p>
              <strong>{selection.name}</strong> · {selection.username}
            </p>
            <label className="grid gap-1 font-medium">
              Streamable HTTP endpoint
              <Input
                readOnly
                value={getModuleUrl('mcp/password-vault')}
                onFocus={(e) => e.target.select()}
              />
            </label>
            {issued ? (
              <>
                <p>
                  Save this token in your MCP client’s bearer-token setting. It is shown once and
                  expires on {new Date(issued.expiresAt).toLocaleDateString()}.
                </p>
                <label className="grid gap-1 font-medium">
                  Bearer token
                  <Input
                    readOnly
                    value={issued.token}
                    autoComplete="off"
                    onFocus={(e) => e.target.select()}
                  />
                </label>
              </>
            ) : (
              <>
                <p>
                  {connected
                    ? 'A token is active until ' +
                      new Date(selection.connectionExpiresAt!).toLocaleDateString() +
                      '. Replacing it disconnects the previous client.'
                    : 'Create a 90-day bearer token for this credential.'}{' '}
                  The service can retrieve its URL, username and password using{' '}
                  <code>get_credential</code>.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void perform(async () =>
                        setIssued(
                          await api.post<IssuedToken>(
                            itemPath + '/connect',
                            { revision: selection.revision },
                            request,
                          ),
                        ),
                      )
                    }
                  >
                    {connected ? 'Replace token' : 'Create token'}
                  </Button>
                  {connected && (
                    <Button
                      variant="destructive"
                      disabled={busy}
                      onClick={() =>
                        void perform(async () => {
                          await api.post(
                            itemPath + '/revoke',
                            { revision: selection.revision },
                            request,
                          );
                          back('MCP access revoked.');
                        })
                      }
                    >
                      Revoke access
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {screen === 'delete' && selection && (
          <div className="space-y-4">
            <p className="text-sm">
              {selection.name} · {selection.username}
            </p>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await api.delete(itemPath, request);
                  back('Credential deleted.');
                })
              }
            >
              Delete credential
            </Button>
          </div>
        )}
        {screen !== 'list' && (
          <Button
            variant="ghost"
            className="justify-self-start"
            disabled={busy}
            onClick={() => back()}
          >
            Back to vault
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
