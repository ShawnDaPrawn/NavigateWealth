/** Add a login, or edit one. Editing never shows or asks for the saved password. */
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Textarea } from '../../../ui/textarea';
import { Checkbox } from '../../../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import {
  aiUseHelp,
  aiUseLabels,
  type AiUse,
  type VaultSummary,
} from '../../../../shared/password-manager';
import { errorText, vaultApi } from './api';
import { useRefresh, useServices } from './hooks';
import { ChoiceList, Field } from './parts';

const NEW_SERVICE = '__new';
const AI_USES: AiUse[] = ['off', 'ask', 'allowed'];

export function LoginDialog({
  login,
  presetServiceId,
  onClose,
  onSaved,
}: {
  /** The login being edited; absent to add one. */
  login?: VaultSummary;
  presetServiceId?: string;
  onClose: () => void;
  /** The new login's id when one was added. */
  onSaved: (id?: string) => void;
}) {
  const services = useServices();
  const refresh = useRefresh();
  const [serviceId, setServiceId] = useState(login?.serviceId ?? presetServiceId ?? '');
  const [newService, setNewService] = useState('');
  const [name, setName] = useState(login?.name ?? '');
  const [url, setUrl] = useState(
    login?.url ?? services.data?.find((s) => s.id === presetServiceId)?.website ?? '',
  );
  const [username, setUsername] = useState(login?.username ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notes, setNotes] = useState('');
  const [clearNotes, setClearNotes] = useState(false);
  const [otpSecret, setOtpSecret] = useState('');
  const [clearOtp, setClearOtp] = useState(false);
  const [aiUse, setAiUse] = useState<AiUse>(login?.aiUse ?? 'ask');
  const [rotateMonths, setRotateMonths] = useState(String(login?.rotateMonths ?? 12));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const editing = Boolean(login);
  const pickService = (id: string) => {
    setServiceId(id);
    const site = services.data?.find((s) => s.id === id)?.website;
    if (site && !url) setUrl(site);
  };

  async function submit() {
    setError('');
    setBusy(true);
    try {
      let sid = serviceId;
      if (sid === NEW_SERVICE) {
        const created = await vaultApi.addService({
          name: newService.trim(),
          website: '',
          description: '',
        });
        sid = created.id;
        // Keep it chosen, so a retry after a failed save reuses this service.
        setServiceId(sid);
        setNewService('');
      }
      const fields = {
        serviceId: sid,
        name: name.trim(),
        url: url.trim(),
        username,
        aiUse,
        rotateMonths: Number(rotateMonths),
        otpSecret: otpSecret.replace(/\s+/g, '') || undefined,
      };
      if (login) {
        await vaultApi.editLogin(
          login.id,
          login.revision,
          { ...fields, password, notes: clearNotes ? '' : notes || undefined },
          clearOtp,
        );
        toast.success('Login saved');
        await refresh();
        onSaved();
      } else {
        const result = await vaultApi.addLogins([{ ...fields, password, notes }]);
        toast.success('Login added');
        await refresh();
        onSaved(result.ids[0]);
      }
    } catch (e) {
      setError(errorText(e));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const canSave =
    serviceId &&
    (serviceId !== NEW_SERVICE || newService.trim()) &&
    url.trim() &&
    (editing || password);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit login' : 'Add a login'}</DialogTitle>
          <DialogDescription>
            Passwords are encrypted. You choose below whether AI agents may use this login.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Service" hint="The system this login signs in to.">
            <Select value={serviceId} onValueChange={pickService}>
              <SelectTrigger className="border-nw-line bg-white" aria-label="Service">
                <SelectValue placeholder="Choose a service" />
              </SelectTrigger>
              <SelectContent>
                {services.data?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value={NEW_SERVICE}>Add a new service…</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {serviceId === NEW_SERVICE && (
            <Field label="New service name" htmlFor="login-new-service">
              <Input
                id="login-new-service"
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                placeholder="GoAML"
                autoFocus
              />
            </Field>
          )}
          <Field
            label="Name"
            hint="How you tell this login apart from others for the same service. Optional."
            htmlFor="login-name"
          >
            <Input
              id="login-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Broker 1234 — Sarah"
            />
          </Field>
          <Field label="Website" htmlFor="login-url">
            <Input
              id="login-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username or email" htmlFor="login-username">
              <Input
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field
              label="Password"
              hint={editing ? 'Leave empty to keep the current one.' : undefined}
              htmlFor="login-password"
            >
              <div className="flex gap-2">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required={!editing}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>
            </Field>
          </div>

          <Field label="Can AI agents use this login?">
            <ChoiceList
              label="AI use"
              value={aiUse}
              onChange={setAiUse}
              options={AI_USES.map((v) => ({
                value: v,
                label: aiUseLabels[v],
                help: aiUseHelp[v],
              }))}
            />
          </Field>

          <details className="rounded-md border border-nw-line px-3 py-2 [&[open]]:pb-3">
            <summary className="cursor-pointer text-sm font-medium text-nw-ink">
              More: authenticator code, notes, reminders
            </summary>
            <div className="mt-3 grid gap-4">
              <Field
                label="Authenticator setup key"
                hint={
                  login?.hasOtp
                    ? 'A key is saved. Enter a new one to replace it.'
                    : 'If the site asks for a 6-digit code from an app, paste the setup key it showed you. The vault then makes the codes.'
                }
                htmlFor="login-otp"
              >
                <Input
                  id="login-otp"
                  value={otpSecret}
                  onChange={(e) => setOtpSecret(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              {login?.hasOtp && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={clearOtp} onCheckedChange={(v) => setClearOtp(v === true)} />
                  Remove the saved authenticator key
                </label>
              )}
              <Field
                label="Notes"
                hint={
                  editing
                    ? 'Leave empty to keep the saved notes. Notes are encrypted.'
                    : 'Security questions, account numbers. Encrypted.'
                }
                htmlFor="login-notes"
              >
                <Textarea
                  id="login-notes"
                  rows={3}
                  value={notes}
                  disabled={clearNotes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
              {editing && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={clearNotes}
                    onCheckedChange={(v) => setClearNotes(v === true)}
                  />
                  Clear the saved notes
                </label>
              )}
              <Field label="Remind me to change the password">
                <Select value={rotateMonths} onValueChange={setRotateMonths}>
                  <SelectTrigger
                    className="border-nw-line bg-white"
                    aria-label="Password change reminder"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Never</SelectItem>
                    <SelectItem value="3">Every 3 months</SelectItem>
                    <SelectItem value="6">Every 6 months</SelectItem>
                    <SelectItem value="12">Every year</SelectItem>
                    <SelectItem value="24">Every 2 years</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </details>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !canSave}>
              {editing ? 'Save' : 'Add login'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
