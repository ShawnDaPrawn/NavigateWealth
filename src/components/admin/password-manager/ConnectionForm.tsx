import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  autonomyPreset,
  connectionLevels,
  type Collection,
  type ConnectionInput,
  type ConnectionLevel,
  type ConnectionTool,
  type IssuedConnection,
  type VaultConnection,
} from '../../../shared/password-manager';
import AutonomyEditor from './AutonomyEditor';
import { createConnection, updateConnection } from './vaultApi';
import { useStaff } from './useStaff';
import { ErrorLine, Field, NativeSelect, toolLabels, useAction } from './ui';

const levelHelp: Record<ConnectionLevel, string> = {
  find: 'Can list logins it is allowed to see.',
  use: 'Can also sign in with them in a hosted browser, without seeing passwords.',
  reveal: 'Can also read passwords and one-time codes where the login allows it.',
  full: 'Overrides each login’s own AI access setting. Use with care.',
};

function initial(connection: VaultConnection | null): ConnectionInput {
  if (!connection)
    return {
      name: '',
      personUserId: null,
      personName: '',
      tool: 'claude',
      collectionIds: [],
      tagFilter: null,
      level: 'use',
      autonomy: autonomyPreset('supervised'),
      redirectUri: '',
      expiresInDays: 90,
    };
  const { name, personUserId, personName, tool, collectionIds, tagFilter, level, autonomy } =
    connection;
  return {
    name,
    personUserId,
    personName,
    tool,
    collectionIds,
    tagFilter,
    level,
    autonomy,
    redirectUri: connection.redirectUri,
    expiresInDays: 90,
  };
}

export default function ConnectionForm({
  connection,
  collections,
  onClose,
  onSaved,
}: {
  connection: VaultConnection | null;
  collections: Collection[];
  onClose: () => void;
  onSaved: (issued: IssuedConnection | null) => void;
}) {
  const [draft, setDraft] = useState<ConnectionInput>(() => initial(connection));
  const staff = useStaff();
  const { busy, error, run } = useAction();
  const set = (patch: Partial<ConnectionInput>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{connection ? 'Edit AI connection' : 'New AI connection'}</DialogTitle>
          <DialogDescription>
            One connection per person per AI tool. It decides what the AI may reach and when it must
            wait for a person.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!draft.collectionIds.length) throw new Error('Choose at least one collection.');
              if (connection) {
                const { name, collectionIds, tagFilter, level, autonomy, personName } = draft;
                await updateConnection(connection.id, {
                  name,
                  collectionIds,
                  tagFilter,
                  level,
                  autonomy,
                  personName,
                });
                onSaved(null);
              } else onSaved(await createConnection(draft));
            });
          }}
        >
          <fieldset className="grid gap-3 sm:grid-cols-2" disabled={busy}>
            {staff.length > 0 && !connection && (
              <Field label="Person">
                <NativeSelect
                  value={draft.personUserId ?? ''}
                  onChange={(e) => {
                    const person = staff.find((p) => p.id === e.target.value);
                    set({
                      personUserId: person?.id ?? null,
                      personName: person?.name ?? draft.personName,
                    });
                  }}
                >
                  <option value="">Choose a person</option>
                  {staff.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field label="Person’s name">
              <Input
                required
                maxLength={120}
                value={draft.personName}
                onChange={(e) => set({ personName: e.target.value })}
              />
            </Field>
            {!connection && staff.length === 0 && (
              <Field label="Person’s user ID (optional)">
                <Input
                  maxLength={64}
                  value={draft.personUserId ?? ''}
                  onChange={(e) => set({ personUserId: e.target.value.trim() || null })}
                />
              </Field>
            )}
            <Field label="AI tool">
              <NativeSelect
                disabled={!!connection}
                value={draft.tool}
                onChange={(e) => set({ tool: e.target.value as ConnectionTool })}
              >
                {(Object.keys(toolLabels) as ConnectionTool[]).map((t) => (
                  <option key={t} value={t}>
                    {toolLabels[t]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Connection name">
              <Input
                required
                maxLength={80}
                placeholder="For example Amy’s Claude"
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </Field>
            <fieldset className="grid gap-1 sm:col-span-2">
              <legend className="text-sm font-medium">Collections it can reach</legend>
              {!collections.length && (
                <p className="text-sm text-muted-foreground">No collections to choose from.</p>
              )}
              {collections.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.collectionIds.includes(c.id)}
                    onChange={(e) =>
                      set({
                        collectionIds: e.target.checked
                          ? [...draft.collectionIds, c.id]
                          : draft.collectionIds.filter((id) => id !== c.id),
                      })
                    }
                  />
                  {c.name}
                </label>
              ))}
            </fieldset>
            <Field label="Only logins tagged (optional)">
              <Input
                maxLength={60}
                value={draft.tagFilter ?? ''}
                onChange={(e) => set({ tagFilter: e.target.value.trim() || null })}
              />
            </Field>
            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="text-sm font-medium">Access level</legend>
              {(Object.keys(connectionLevels) as ConnectionLevel[]).map((level) => (
                <label key={level} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="connection-level"
                    className="mt-1"
                    checked={draft.level === level}
                    onChange={() => set({ level })}
                  />
                  <span>
                    <span className="font-medium">{connectionLevels[level]}</span>
                    <span className="block text-xs text-muted-foreground">{levelHelp[level]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </fieldset>
          <AutonomyEditor value={draft.autonomy} onChange={(autonomy) => set({ autonomy })} />
          {!connection && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="OAuth callback URL (optional)"
                hint="Leave empty to get a bearer token instead."
              >
                <Input
                  type="url"
                  value={draft.redirectUri}
                  onChange={(e) => set({ redirectUri: e.target.value.trim() })}
                />
              </Field>
              <Field label="Expires in">
                <NativeSelect
                  value={draft.expiresInDays}
                  onChange={(e) => set({ expiresInDays: Number(e.target.value) })}
                >
                  {[90, 30, 7].map((days) => (
                    <option key={days} value={days}>
                      {days} days
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          )}
          <ErrorLine>{error}</ErrorLine>
          <div className="flex gap-2">
            <Button disabled={busy}>{connection ? 'Save connection' : 'Create connection'}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
