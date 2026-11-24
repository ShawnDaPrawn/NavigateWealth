/**
 * Write or edit a skill: instructions in plain English that an AI agent
 * follows. It is shared by every login of a service, or belongs to one login.
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Textarea } from '../../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { DsCard, DsCardBody, DsCardHead, useConfirm } from '../../layout/page';
import type { SkillInput } from '../../../../shared/password-manager';
import { renderSkillsFor } from '../../../../shared/vault-skills';
import { errorText, vaultApi } from './api';
import { useLogins, useRefresh, useServices, useSkills } from './hooks';
import { ChoiceList, Field, Loading } from './parts';
import { PreviewDialog } from './PreviewDialog';

const STARTER = `Goal: what the finished job looks like, in one sentence.

Before you start, make sure you have:
- the client or broker the job is for
- the period or date, if it matters

Steps:
1. Sign in at the website with this login.
2. Go to …
3. …

Check before you finish:
- the document or record is for the right client and date

Never:
- change or submit anything you were not clearly asked to

When you are done, tell me: what you did and where the result is.`;

export function SkillEditor({
  skillId,
  presetServiceId,
  presetLoginId,
  onClose,
}: {
  skillId: string;
  presetServiceId: string | null;
  presetLoginId: string | null;
  onClose: () => void;
}) {
  const skills = useSkills();
  const services = useServices();
  const logins = useLogins();
  if (skills.isLoading || services.isLoading || logins.isLoading)
    return <Loading what="the skill" />;
  const existing = skillId === 'new' ? null : skills.data?.find((s) => s.id === skillId);
  if (skillId !== 'new' && !existing)
    return (
      <DsCard>
        <DsCardBody className="grid justify-items-start gap-3">
          <p>This skill no longer exists.</p>
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
        </DsCardBody>
      </DsCard>
    );
  const loginService = logins.data?.find((l) => l.id === presetLoginId)?.serviceId;
  return (
    <SkillForm
      initial={
        existing ?? {
          name: '',
          whenToUse: '',
          instructions: '',
          serviceId: loginService ?? presetServiceId ?? '',
          credentialId: presetLoginId,
        }
      }
      skillId={existing?.id ?? null}
      revision={existing?.revision ?? null}
      onClose={onClose}
    />
  );
}

function SkillForm({
  initial,
  skillId,
  revision,
  onClose,
}: {
  initial: SkillInput;
  skillId: string | null;
  revision: string | null;
  onClose: () => void;
}) {
  const services = useServices();
  const logins = useLogins();
  const skills = useSkills();
  const refresh = useRefresh();
  const { confirm, confirmDialog } = useConfirm();
  const [form, setForm] = useState<SkillInput>(initial);
  const [scope, setScope] = useState<'shared' | 'login'>(initial.credentialId ? 'login' : 'shared');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);

  const service = services.data?.find((s) => s.id === form.serviceId);
  const serviceLogins = useMemo(
    () => (logins.data ?? []).filter((l) => l.serviceId === form.serviceId),
    [logins.data, form.serviceId],
  );
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const input: SkillInput = { ...form, credentialId: scope === 'login' ? form.credentialId : null };
  const ready =
    form.name.trim() &&
    form.instructions.trim() &&
    form.serviceId &&
    (scope === 'shared' || form.credentialId);

  async function leave() {
    if (
      dirty &&
      !(await confirm({
        title: 'Leave without saving?',
        description: 'Your changes to this skill will be lost.',
        confirmLabel: 'Leave',
        destructive: true,
      }))
    )
      return;
    onClose();
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      if (skillId && revision) await vaultApi.editSkill(skillId, revision, input);
      else await vaultApi.addSkill(input);
      await refresh();
      toast.success('Skill saved');
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // What an agent would read, for the first login this skill applies to.
  const sample =
    scope === 'login' ? logins.data?.find((l) => l.id === form.credentialId) : serviceLogins[0];
  const previewText = sample
    ? renderSkillsFor(
        sample,
        service ?? { id: form.serviceId, name: 'this service', description: '' },
        [
          ...(skills.data ?? []).filter((s) => s.id !== skillId),
          {
            ...input,
            id: skillId ?? 'draft',
            revision: '',
            updatedAt: '',
            updatedBy: '',
          },
        ],
      )
    : '';

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => void leave()}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold text-nw-ink">
            {skillId ? initial.name || 'Skill' : 'New skill'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {skillId && (
            <Button
              variant="outline"
              className="text-red-700"
              onClick={async () => {
                if (
                  !(await confirm({
                    title: 'Delete this skill?',
                    description: 'Agents stop reading it straight away.',
                    confirmLabel: 'Delete skill',
                    destructive: true,
                  }))
                )
                  return;
                try {
                  await vaultApi.deleteSkill(skillId);
                  await refresh();
                  toast.success('Skill deleted');
                  onClose();
                } catch (e) {
                  toast.error(errorText(e));
                }
              }}
            >
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          )}
          <Button variant="outline" disabled={!sample} onClick={() => setPreview(true)}>
            <Eye aria-hidden="true" />
            Preview
          </Button>
          <Button disabled={!ready || busy} onClick={() => void save()}>
            Save skill
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <DsCard>
          <DsCardBody className="grid gap-5">
            <Field label="What is the job?" htmlFor="skill-name">
              <Input
                id="skill-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Download a monthly commission statement"
                autoFocus={!skillId}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Service">
                <Select
                  value={form.serviceId}
                  onValueChange={(v) => setForm({ ...form, serviceId: v, credentialId: null })}
                >
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
              {scope === 'login' && (
                <Field label="Login">
                  <Select
                    value={form.credentialId ?? ''}
                    onValueChange={(v) => setForm({ ...form, credentialId: v })}
                    disabled={!serviceLogins.length}
                  >
                    <SelectTrigger className="border-nw-line bg-white" aria-label="Login">
                      <SelectValue
                        placeholder={serviceLogins.length ? 'Choose a login' : 'No logins yet'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceLogins.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>

            <Field label="Which logins use it?">
              <ChoiceList
                label="Which logins use it"
                value={scope}
                onChange={setScope}
                options={[
                  {
                    value: 'shared',
                    label: 'Every ' + (service?.name ?? '') + ' login',
                    help: 'Write it once; all logins for this service follow it.',
                  },
                  {
                    value: 'login',
                    label: 'One login only',
                    help: 'Extra or different steps for one login. Agents read it after the shared skills.',
                  },
                ]}
              />
            </Field>

            <Field
              label="When should an agent use it?"
              hint="One sentence. Agents read this to pick the right skill."
              htmlFor="skill-when"
            >
              <Input
                id="skill-when"
                value={form.whenToUse}
                onChange={(e) => setForm({ ...form, whenToUse: e.target.value })}
                placeholder="When I ask for a broker’s commission statement for a month."
              />
            </Field>

            <Field
              label="Instructions"
              hint="Write it the way you would brief a new colleague: the goal, the steps, what to check and what never to do."
              htmlFor="skill-instructions"
            >
              <Textarea
                id="skill-instructions"
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                rows={18}
                className="min-h-[360px] leading-relaxed"
                placeholder={STARTER}
              />
            </Field>
            {!form.instructions && (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setForm({ ...form, instructions: STARTER })}
              >
                Start from an outline
              </Button>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
          </DsCardBody>
        </DsCard>

        <DsCard className="lg:sticky lg:top-4">
          <DsCardHead title="Writing a good skill" as="h2" />
          <DsCardBody className="grid gap-3 text-nw-text-2 [&_p]:text-[13px] [&_p]:leading-relaxed">
            <p>
              <strong className="text-nw-ink">Say what done looks like.</strong> “A PDF of the
              October statement, saved to the client’s documents” beats “get the statement”.
            </p>
            <p>
              <strong className="text-nw-ink">Number the steps</strong> and name buttons and menus
              the way they appear on screen.
            </p>
            <p>
              <strong className="text-nw-ink">Say what to check</strong> before finishing, and when
              to stop and ask you.
            </p>
            <p>
              <strong className="text-nw-ink">List what it must never do</strong>, such as
              submitting an instruction or changing banking details.
            </p>
            <p>
              <strong className="text-nw-ink">Write shared skills once.</strong> Put steps that
              apply to all ten Allan Gray logins on the service, and only the differences on one
              login.
            </p>
            <p>Agents never see passwords in a skill; they ask for them separately.</p>
          </DsCardBody>
        </DsCard>
      </div>

      {preview && (
        <PreviewDialog
          title={'What an agent sees for ' + (sample?.name ?? 'this login')}
          text={previewText}
          onClose={() => setPreview(false)}
        />
      )}
      {confirmDialog}
    </div>
  );
}
