import { useState, type ReactNode } from 'react';
import { Copy, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '../../ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../ui/sheet';
import {
  credentialKinds,
  type Collection,
  type RevealedCredential,
  type VaultSummary,
} from '../../../shared/password-manager';
import { deleteCredential, moveCredential, oneTimeCode, revealCredential } from './vaultApi';
import { collectionOf } from './vaultFilters';
import { AiAccessPill, HealthPill } from './VaultTable';
import CredentialWorkflows from './CredentialWorkflows';
import LegacyToken from './LegacyToken';
import {
  ErrorLine,
  NativeSelect,
  TabStrip,
  copyText,
  formatDay,
  formatWhen,
  hostOf,
  useAction,
  useSecondsLeft,
} from './ui';

export default function CredentialPanel({
  item,
  collections,
  onClose,
  onChanged,
  onDeleted,
  onEdit,
  onRunBroker,
}: {
  item: VaultSummary;
  collections: Collection[];
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
  onEdit: (secret: RevealedCredential) => void;
  onRunBroker: () => void;
}) {
  const [tab, setTab] = useState<'details' | 'workflows'>('details');
  const [secret, setSecret] = useState<RevealedCredential | null>(null);
  const [visible, setVisible] = useState(false);
  const [otp, setOtp] = useState<{ code: string; until: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState('');
  const { busy, error, run } = useAction();
  const otpLeft = useSecondsLeft(otp?.until ?? null);

  async function reveal(): Promise<RevealedCredential> {
    if (secret) return secret;
    const value = await revealCredential(item.id);
    setSecret(value);
    return value;
  }
  const copied = (what: string) =>
    setMessage(what + ' copied. The clipboard clears in 30 seconds.');

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{item.name || hostOf(item.url)}</SheetTitle>
          <SheetDescription>
            {credentialKinds[item.kind ?? 'login']} · {hostOf(item.url)}
          </SheetDescription>
        </SheetHeader>
        <TabStrip
          label="Credential"
          className="mt-4"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'details', label: 'Details' },
            { value: 'workflows', label: 'Workflows' },
          ]}
        />
        <div className="mt-4 grid gap-4 text-sm">
          <ErrorLine>{error}</ErrorLine>
          {message && <p role="status">{message}</p>}
          {tab === 'workflows' && <CredentialWorkflows credential={item} />}
          {tab === 'details' && (
            <>
              <section className="grid gap-2 rounded-lg border p-3">
                <h3 className="font-semibold">Sign-in</h3>
                <Row label="Website">
                  <a href={item.url} target="_blank" rel="noreferrer" className="underline">
                    {item.url}
                  </a>
                </Row>
                <Row label="Username">
                  <span className="truncate">{item.username || '—'}</span>
                  {item.username && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Copy username"
                      onClick={() =>
                        void run(async () => {
                          await copyText(item.username);
                          setMessage('Username copied.');
                        })
                      }
                    >
                      <Copy aria-hidden="true" />
                    </Button>
                  )}
                </Row>
                <Row label="Password">
                  <span className="truncate font-mono">
                    {visible && secret ? secret.password : '••••••••••'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    onClick={() =>
                      void run(async () => {
                        if (!visible) await reveal();
                        setVisible(!visible);
                      })
                    }
                  >
                    {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label="Copy password"
                    onClick={() =>
                      void run(async () => {
                        await copyText((await reveal()).password, true);
                        copied('Password');
                      })
                    }
                  >
                    <Copy aria-hidden="true" />
                  </Button>
                </Row>
                {item.hasOtp && (
                  <Row label="One-time code">
                    {otp && otpLeft > 0 ? (
                      <>
                        <span className="font-mono text-base tracking-widest">{otp.code}</span>
                        <span className="text-xs text-muted-foreground">{otpLeft}s left</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Copy one-time code"
                          onClick={() =>
                            void run(async () => {
                              await copyText(otp.code, true);
                              copied('Code');
                            })
                          }
                        >
                          <Copy aria-hidden="true" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const code = await oneTimeCode(item.id);
                            setOtp({ code: code.code, until: Date.now() + code.expiresIn * 1000 });
                          })
                        }
                      >
                        <KeyRound aria-hidden="true" />
                        Show code
                      </Button>
                    )}
                  </Row>
                )}
                {visible && secret?.notes && (
                  <Row label="Notes">
                    <span className="whitespace-pre-wrap">{secret.notes}</span>
                  </Row>
                )}
              </section>

              <section className="grid gap-2 rounded-lg border p-3">
                <h3 className="font-semibold">Organisation</h3>
                <Row label="Collection">
                  <NativeSelect
                    aria-label="Move to collection"
                    className="h-9"
                    disabled={busy || !collections.length}
                    value={collectionOf(item)}
                    onChange={(e) => {
                      const target = e.target.value;
                      void run(async () => {
                        await moveCredential(item.id, item.revision, target);
                        setMessage('Moved.');
                        onChanged();
                      });
                    }}
                  >
                    {!collections.some((c) => c.id === collectionOf(item)) && (
                      <option value={collectionOf(item)}>Current collection</option>
                    )}
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Row>
                <Row label="Category">{item.category || '—'}</Row>
                <Row label="Tags">{item.tags?.length ? item.tags.join(', ') : '—'}</Row>
                <Row label="Password changed">{formatDay(item.passwordChangedAt, 'Unknown')}</Row>
                <Row label="Rotation">
                  {item.rotateMonths ? 'Every ' + item.rotateMonths + ' months' : 'No reminder'}
                </Row>
              </section>

              <section className="grid gap-2 rounded-lg border p-3">
                <h3 className="font-semibold">AI access and health</h3>
                <Row label="AI access">
                  <AiAccessPill access={item.aiAccess} />
                  {item.askFirst && <span className="text-xs">Ask first</span>}
                </Row>
                <Row label="Health">
                  <HealthPill item={item} />
                </Row>
                <div>
                  <p className="font-medium">Seen by an AI</p>
                  {item.seenByAi?.length ? (
                    <ul className="mt-1 grid gap-1">
                      {item.seenByAi.map((seen) => (
                        <li key={seen.connectionId + seen.at}>
                          {seen.connectionName} · {formatWhen(seen.at)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No AI has seen this password.</p>
                  )}
                </div>
              </section>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={() => void run(async () => onEdit(await reveal()))}
                >
                  Edit
                </Button>
                {item.portal && (
                  <Button variant="outline" onClick={onRunBroker}>
                    Run broker report
                  </Button>
                )}
                {!confirmDelete ? (
                  <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await deleteCredential(item.id);
                        onDeleted();
                      })
                    }
                  >
                    Delete credential
                  </Button>
                )}
              </div>
              {confirmDelete && (
                <p className="text-xs text-muted-foreground">
                  Deleting this login also revokes its legacy token and workflows.
                </p>
              )}
              <LegacyToken item={item} onChanged={onChanged} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1">{children}</span>
    </div>
  );
}
