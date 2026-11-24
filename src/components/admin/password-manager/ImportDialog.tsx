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
  BROKERAGE_COLLECTION_ID,
  type Collection,
  type CredentialInput,
  type VaultSummary,
} from '../../../shared/password-manager';
import { importCsv } from './importCsv';
import { createCredentials } from './vaultApi';
import { ErrorLine, Field, NativeSelect, useAction } from './ui';

export default function ImportDialog({
  items,
  collections,
  defaultCollectionId,
  onClose,
  onImported,
}: {
  items: VaultSummary[];
  collections: Collection[];
  defaultCollectionId?: string;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CredentialInput[]>([]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [collectionId, setCollectionId] = useState(defaultCollectionId ?? BROKERAGE_COLLECTION_ID);
  const { busy, error, run } = useAction();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import passwords</DialogTitle>
          <DialogDescription>Upload a CSV exported from your password manager.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!file) return;
              if (file.size > 1024 * 1024) throw new Error('Choose a CSV file smaller than 1 MiB.');
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
              const entries = preview
                .filter((_, i) => chosen.includes(i))
                .map((entry) => ({ ...entry, collectionId }));
              const result = await createCredentials(entries);
              onImported(result.count);
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
          <Field label="Import into collection">
            <NativeSelect value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
              {!collections.some((c) => c.id === collectionId) && (
                <option value={collectionId}>Brokerage</option>
              )}
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {preview.length > 0 && (
            <fieldset className="text-sm">
              <legend>Choose accounts to import. Matching logins are initially unchecked.</legend>
              {preview.map((row, i) => (
                <label className="flex items-center gap-2 py-1" key={i}>
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
          <ErrorLine>{error}</ErrorLine>
          <div className="flex gap-2">
            <Button disabled={busy || !file || (!!preview.length && !chosen.length)}>
              {preview.length ? 'Import ' + chosen.length + ' accounts' : 'Preview import'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
