/** Import logins exported from a browser or another password manager (CSV). */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { errorText, vaultApi } from './api';
import { useServices, useVaultMutation } from './hooks';
import { Field } from './parts';
import { importCsv, type ImportedLogin } from './importCsv';

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const services = useServices();
  const [rows, setRows] = useState<ImportedLogin[] | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [error, setError] = useState('');
  const save = useVaultMutation(vaultApi.addLogins);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import logins from a CSV file</DialogTitle>
          <DialogDescription>
            Export from your browser or old password manager. The file needs the columns url,
            username and password; name and notes are optional. Up to 100 logins at a time. Imported
            logins start as “Ask me first” for AI.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="File" htmlFor="import-file">
            <input
              id="import-file"
              type="file"
              accept=".csv,text/csv"
              className="text-sm"
              onChange={async (e) => {
                setError('');
                setRows(null);
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 1024 * 1024) return setError('Choose a file under 1 MB.');
                try {
                  setRows(importCsv(await file.text()));
                } catch (err) {
                  setError(errorText(err, 'This file could not be read.'));
                }
              }}
            />
          </Field>
          {rows && (
            <p className="text-sm text-nw-text-2">
              {rows.length} {rows.length === 1 ? 'login' : 'logins'} found.
            </p>
          )}
          <Field label="Service" hint="All the logins in this file are for one service.">
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="border-nw-line bg-white" aria-label="Service">
                <SelectValue placeholder="Choose a service" />
              </SelectTrigger>
              <SelectContent>
                {services.data?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!rows?.length || !serviceId || save.isPending}
            onClick={() =>
              save.mutate(
                rows!.map((r) => ({ ...r, serviceId, aiUse: 'ask' as const })),
                {
                  onSuccess: (r) => {
                    toast.success(r.count + ' logins imported');
                    onClose();
                  },
                  onError: (e) => setError(errorText(e)),
                },
              )
            }
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
