import { useState } from 'react';
import { Eye, EyeOff, Wand2 } from 'lucide-react';
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
import {
  BROKERAGE_COLLECTION_ID,
  aiAccessLabels,
  credentialKinds,
  type AiAccess,
  type Collection,
  type CredentialInput,
  type CredentialKind,
  type RevealedCredential,
} from '../../../shared/password-manager';
import PortalProfileFields from './PortalProfileFields';
import { createCredentials, updateCredential } from './vaultApi';
import { ErrorLine, Field, NativeSelect, generatePassword, splitList, useAction } from './ui';

const aiAccessHelp: Record<AiAccess, string> = {
  never: 'No AI can find or use this login.',
  find: 'An AI can see that it exists, not use it.',
  use: 'An AI can sign in with it in a hosted session but never sees the password.',
  reveal: 'An AI can read the password.',
};
const rotationChoices = [12, 6, 3, 0];

function initialDraft(existing: RevealedCredential | null, collectionId?: string) {
  if (!existing)
    return {
      name: '',
      url: '',
      username: '',
      password: '',
      notes: '',
      kind: 'login' as CredentialKind,
      collectionId: collectionId ?? BROKERAGE_COLLECTION_ID,
      tags: [],
      category: '',
      aiAccess: 'never' as AiAccess,
      askFirst: false,
      rotateMonths: 12,
      otpSecret: '',
    } satisfies CredentialInput;
  return {
    name: existing.name,
    url: existing.url,
    username: existing.username,
    password: existing.password,
    notes: existing.notes,
    portal: existing.portal,
    kind: existing.kind ?? 'login',
    collectionId: existing.collectionId,
    tags: existing.tags ?? [],
    category: existing.category ?? '',
    aiAccess: existing.aiAccess ?? 'never',
    askFirst: !!existing.askFirst,
    rotateMonths: existing.rotateMonths ?? 12,
    otpSecret: '',
  } satisfies CredentialInput;
}

export default function CredentialForm({
  existing,
  revision,
  collections,
  defaultCollectionId,
  onClose,
  onSaved,
}: {
  existing: RevealedCredential | null;
  revision: string | null;
  collections: Collection[];
  defaultCollectionId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<CredentialInput>(() =>
    initialDraft(existing, defaultCollectionId),
  );
  const [tags, setTags] = useState((draft.tags ?? []).join(', '));
  const [visible, setVisible] = useState(false);
  const [clearOtp, setClearOtp] = useState(false);
  const { busy, error, run } = useAction();
  const set = (patch: Partial<CredentialInput>) => setDraft((d) => ({ ...d, ...patch }));

  function submit() {
    const { otpSecret, collectionId, ...rest } = draft;
    const credential: CredentialInput = {
      ...rest,
      tags: splitList(tags),
      ...(otpSecret?.trim() ? { otpSecret: otpSecret.replace(/\s/g, '') } : {}),
      // Moving a login is its own call (the credential panel), not an edit.
      ...(existing ? {} : { collectionId }),
    };
    void run(async () => {
      if (existing && revision)
        await updateCredential(
          existing.id,
          revision,
          credential,
          !!existing.portal && !credential.portal,
          clearOtp && !credential.otpSecret,
        );
      else await createCredentials([credential]);
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit credential' : 'Add credential'}</DialogTitle>
          <DialogDescription>Store the sign-in details for a service.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <fieldset className="grid gap-3 sm:grid-cols-2" disabled={busy}>
            <Field label="Type">
              <NativeSelect
                value={draft.kind}
                onChange={(e) => set({ kind: e.target.value as CredentialKind })}
              >
                {(Object.keys(credentialKinds) as CredentialKind[]).map((k) => (
                  <option key={k} value={k}>
                    {credentialKinds[k]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Name (optional)">
              <Input
                maxLength={200}
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </Field>
            <Field label="Website URL" className="sm:col-span-2">
              <Input
                type="url"
                required
                maxLength={2048}
                spellCheck={false}
                value={draft.url}
                onChange={(e) => set({ url: e.target.value })}
              />
            </Field>
            <Field label="Username">
              <Input
                maxLength={512}
                autoComplete="off"
                spellCheck={false}
                value={draft.username}
                onChange={(e) => set({ username: e.target.value })}
              />
            </Field>
            <label className="grid gap-1 text-sm font-medium" htmlFor="vault-password">
              Password
              <span className="flex gap-1">
                <Input
                  id="vault-password"
                  required
                  maxLength={8192}
                  type={visible ? 'text' : 'password'}
                  autoComplete="new-password"
                  spellCheck={false}
                  value={draft.password}
                  onChange={(e) => set({ password: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff /> : <Eye />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Generate a strong password"
                  onClick={() => {
                    set({ password: generatePassword() });
                    setVisible(true);
                  }}
                >
                  <Wand2 />
                </Button>
              </span>
            </label>
            <Field
              label="One-time code setup key (optional)"
              hint={
                existing?.hasOtp
                  ? 'A key is saved. Enter a new one to replace it.'
                  : 'The authenticator key from the site. It is never shown again.'
              }
              className="sm:col-span-2"
            >
              <Input
                autoComplete="off"
                spellCheck={false}
                maxLength={256}
                value={draft.otpSecret ?? ''}
                onChange={(e) => set({ otpSecret: e.target.value })}
              />
            </Field>
            {existing?.hasOtp && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={clearOtp}
                  onChange={(e) => setClearOtp(e.target.checked)}
                />
                Remove the saved one-time code key
              </label>
            )}
            <Field label="Notes (optional)" className="sm:col-span-2">
              <Textarea
                maxLength={8192}
                value={draft.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </Field>
            {!existing && (
              <Field label="Collection">
                <NativeSelect
                  value={draft.collectionId}
                  onChange={(e) => set({ collectionId: e.target.value })}
                >
                  {!collections.some((c) => c.id === draft.collectionId) && (
                    <option value={draft.collectionId}>Brokerage</option>
                  )}
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field label="Category (optional)" hint="For example Provider portal, Banking.">
              <Input
                maxLength={80}
                value={draft.category}
                onChange={(e) => set({ category: e.target.value })}
              />
            </Field>
            <Field label="Tags (optional)" hint="Separate tags with commas.">
              <Input maxLength={400} value={tags} onChange={(e) => setTags(e.target.value)} />
            </Field>
            <Field label="Rotation reminder">
              <NativeSelect
                value={draft.rotateMonths}
                onChange={(e) => set({ rotateMonths: Number(e.target.value) })}
              >
                {rotationChoices.map((m) => (
                  <option key={m} value={m}>
                    {m ? 'Every ' + m + ' months' : 'Never'}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="text-sm font-medium">AI access</legend>
              {(Object.keys(aiAccessLabels) as AiAccess[]).map((a) => (
                <label key={a} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="ai-access"
                    className="mt-1"
                    checked={draft.aiAccess === a}
                    onChange={() => set({ aiAccess: a })}
                  />
                  <span>
                    <span className="font-medium">{aiAccessLabels[a]}</span>
                    <span className="block text-xs text-muted-foreground">{aiAccessHelp[a]}</span>
                  </span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!draft.askFirst}
                  onChange={(e) => set({ askFirst: e.target.checked })}
                />
                Ask first — a person approves before any AI uses or reveals it
              </label>
            </fieldset>
            <div className="sm:col-span-2">
              <PortalProfileFields profile={draft.portal} onChange={(portal) => set({ portal })} />
            </div>
          </fieldset>
          <ErrorLine>{error}</ErrorLine>
          <div className="flex gap-2">
            <Button disabled={busy}>Save credential</Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
