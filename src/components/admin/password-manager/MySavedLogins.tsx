import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import type { OwnedLogin, OwnedLoginInput } from '../../../shared/password-manager';
import { DsPill } from '../layout/page/ds';
import { addMine, listMine, replaceMyPassword } from './vaultApi';
import { ErrorLine, Field, formatDay, hostOf, useAction } from './ui';

/**
 * A collection owner's own logins, write-only: they can replace a password or
 * add a login, but never read one back. Hidden for anyone who owns nothing.
 */
export default function MySavedLogins() {
  const [rows, setRows] = useState<OwnedLogin[] | null>(null);
  const [replacing, setReplacing] = useState<OwnedLogin | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => {
    listMine()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  if (!rows?.length) return null;
  return (
    <section
      aria-labelledby="my-saved-logins"
      className="grid gap-3 rounded-lg border bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="my-saved-logins" className="font-semibold">
            My saved logins
          </h2>
          <p className="text-sm text-muted-foreground">
            Logins the firm keeps for you. You can replace a password here; nobody can read it back
            on this page.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" />
          Add a login
        </Button>
      </div>
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <ul className="grid divide-y">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="min-w-0 text-sm">
              <span className="block font-medium">{row.name || hostOf(row.url)}</span>
              <span className="block text-muted-foreground">
                {row.username} · changed {formatDay(row.passwordChangedAt, 'never')}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {row.due && <DsPill tone="warn">Due for change</DsPill>}
              <Button size="sm" variant="outline" onClick={() => setReplacing(row)}>
                Replace password
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {replacing && (
        <ReplaceDialog
          login={replacing}
          onClose={() => setReplacing(null)}
          onDone={() => {
            setReplacing(null);
            setNotice('Password replaced.');
            load();
          }}
        />
      )}
      {adding && (
        <AddDialog
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            setNotice('Login added.');
            load();
          }}
        />
      )}
    </section>
  );
}

function ReplaceDialog({
  login,
  onClose,
  onDone,
}: {
  login: OwnedLogin;
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { busy, error, setError, run } = useAction();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Replace password</DialogTitle>
          <DialogDescription>
            {login.name || hostOf(login.url)} · {login.username}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (password !== confirm) return setError('The two passwords do not match.');
            void run(async () => {
              await replaceMyPassword(login.id, password);
              onDone();
            });
          }}
        >
          <Field label="New password">
            <Input
              type="password"
              required
              autoComplete="new-password"
              maxLength={8192}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              required
              autoComplete="new-password"
              maxLength={8192}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <ErrorLine>{error}</ErrorLine>
          <div className="flex gap-2">
            <Button disabled={busy}>Replace password</Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [draft, setDraft] = useState<OwnedLoginInput>({
    name: '',
    url: '',
    username: '',
    password: '',
  });
  const { busy, error, run } = useAction();
  const set = (patch: Partial<OwnedLoginInput>) => setDraft((d) => ({ ...d, ...patch }));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a login</DialogTitle>
          <DialogDescription>It is saved to your collection in the firm’s vault.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await addMine(draft);
              onDone();
            });
          }}
        >
          <Field label="Name">
            <Input
              maxLength={200}
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field label="Website URL">
            <Input
              type="url"
              required
              maxLength={2048}
              value={draft.url}
              onChange={(e) => set({ url: e.target.value })}
            />
          </Field>
          <Field label="Username">
            <Input
              maxLength={512}
              autoComplete="off"
              value={draft.username}
              onChange={(e) => set({ username: e.target.value })}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              autoComplete="new-password"
              maxLength={8192}
              value={draft.password}
              onChange={(e) => set({ password: e.target.value })}
            />
          </Field>
          <ErrorLine>{error}</ErrorLine>
          <div className="flex gap-2">
            <Button disabled={busy}>Add login</Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
