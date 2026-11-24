import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Textarea } from '../../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import type { Service, ServiceInput } from '../../../../shared/password-manager';
import { errorText, vaultApi } from './api';
import { useVaultMutation } from './hooks';
import { Field } from './parts';

/** Add a service (a system the firm signs in to), or edit one. */
export function ServiceDialog({
  service,
  onClose,
  onSaved,
}: {
  service: Service | null;
  onClose: () => void;
  onSaved?: (service: Service) => void;
}) {
  const [form, setForm] = useState<ServiceInput>({
    name: service?.name ?? '',
    website: service?.website ?? '',
    description: service?.description ?? '',
  });
  const [error, setError] = useState('');
  const save = useVaultMutation((input: ServiceInput) =>
    service ? vaultApi.editService(service.id, input) : vaultApi.addService(input),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? 'Edit ' + service.name : 'Add a service'}</DialogTitle>
          <DialogDescription>
            A service is a system you sign in to, like Allan Gray or GoAML. Its logins share the
            skills you write for it.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            save.mutate(form, {
              onSuccess: (row) => {
                toast.success(service ? 'Service saved' : row.name + ' added');
                onSaved?.(row);
                onClose();
              },
              onError: (err) => setError(errorText(err)),
            });
          }}
        >
          <Field label="Name" htmlFor="service-name">
            <Input
              id="service-name"
              value={form.name}
              disabled={service?.builtIn}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Allan Gray"
              required
              autoFocus={!service}
            />
          </Field>
          <Field label="Website" hint="Where people sign in. Optional." htmlFor="service-website">
            <Input
              id="service-website"
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://"
            />
          </Field>
          <Field
            label="What the firm uses it for"
            hint="Agents read this, so one or two plain sentences help. Optional."
            htmlFor="service-description"
          >
            <Textarea
              id="service-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Investment platform where our clients’ unit trusts and retirement annuities are held."
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !form.name.trim()}>
              {service ? 'Save' : 'Add service'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
