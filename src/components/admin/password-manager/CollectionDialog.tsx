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
import type { Collection, CollectionInput } from '../../../shared/password-manager';
import { createCollection } from './vaultApi';
import { ErrorLine, Field, NativeSelect, useAction } from './ui';
import { useStaff } from './useStaff';

export default function CollectionDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (collection: Collection) => void;
}) {
  const [draft, setDraft] = useState<CollectionInput>({
    name: '',
    kind: 'person',
    ownerUserId: null,
    ownerName: '',
  });
  const staff = useStaff();
  const { busy, error, run } = useAction();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>
            A collection groups logins. A person’s collection lets them replace its passwords
            without seeing them.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => onCreated(await createCollection(draft)));
          }}
        >
          <Field label="Name">
            <Input
              required
              maxLength={120}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="Kind">
            <NativeSelect
              value={draft.kind}
              onChange={(e) =>
                setDraft({ ...draft, kind: e.target.value as CollectionInput['kind'] })
              }
            >
              <option value="person">A person’s logins</option>
              <option value="brokerage">Firm-wide (brokerage)</option>
            </NativeSelect>
          </Field>
          {staff.length > 0 && (
            <Field label="Owner from staff list">
              <NativeSelect
                value={draft.ownerUserId ?? ''}
                onChange={(e) => {
                  const person = staff.find((p) => p.id === e.target.value);
                  setDraft({
                    ...draft,
                    ownerUserId: person?.id ?? null,
                    ownerName: person?.name ?? draft.ownerName,
                  });
                }}
              >
                <option value="">Nobody chosen</option>
                {staff.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.email ? ' · ' + p.email : ''}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field label="Owner name">
            <Input
              required={draft.kind === 'person'}
              maxLength={120}
              value={draft.ownerName}
              onChange={(e) => setDraft({ ...draft, ownerName: e.target.value })}
            />
          </Field>
          {staff.length === 0 && (
            <Field label="Owner user ID (optional)">
              <Input
                maxLength={64}
                value={draft.ownerUserId ?? ''}
                onChange={(e) => setDraft({ ...draft, ownerUserId: e.target.value.trim() || null })}
              />
            </Field>
          )}
          <ErrorLine>{error}</ErrorLine>
          <div className="flex gap-2">
            <Button disabled={busy}>Create collection</Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
