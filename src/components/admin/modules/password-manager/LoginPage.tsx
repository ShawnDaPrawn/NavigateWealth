/**
 * One login: its sign-in details, whether AI agents may use it, and the skills
 * an agent reads before working with it (shared ones from its service, then its
 * own) — with a preview of exactly what the agent receives.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Map as MapIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { DsCard, DsCardBody, DsCardHead, DsMeta, Notice, useConfirm } from '../../layout/page';
import {
  aiUseHelp,
  aiUseLabels,
  healthIssues,
  type AiUse,
  type OneTimeCode,
  type Skill,
} from '../../../../shared/password-manager';
import { renderSkillsFor, skillsFor } from '../../../../shared/vault-skills';
import { renderPlatformGuide } from '../../../../shared/platform-guide';
import { errorText, vaultApi } from './api';
import { useLogins, useServices, useSkills, useVaultMutation } from './hooks';
import { AiUsePill, ChoiceList, CopyButton, Loading } from './parts';
import { formatDate } from './format';
import { LoginDialog } from './LoginDialog';
import { PreviewDialog } from './PreviewDialog';

const AI_USES: AiUse[] = ['off', 'ask', 'allowed'];

export function LoginPage({
  loginId,
  onClose,
  onOpenSkill,
}: {
  loginId: string;
  onClose: () => void;
  onOpenSkill: (id: string, from?: { serviceId?: string; loginId?: string }) => void;
}) {
  const logins = useLogins();
  const services = useServices();
  const skills = useSkills();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<{ title: string; text: string } | null>(null);
  const { confirm, confirmDialog } = useConfirm();
  const remove = useVaultMutation(vaultApi.deleteLogin);
  const setAi = useVaultMutation((aiUse: AiUse) =>
    vaultApi.editLogin(login!.id, login!.revision, {
      serviceId: login!.serviceId,
      name: login!.name,
      url: login!.url,
      username: login!.username,
      password: '',
      aiUse,
      rotateMonths: login!.rotateMonths,
    }),
  );

  const login = logins.data?.find((l) => l.id === loginId);
  const service = services.data?.find((s) => s.id === login?.serviceId);

  if (logins.isLoading || services.isLoading) return <Loading what="the login" />;
  if (!login)
    return (
      <DsCard>
        <DsCardBody className="grid justify-items-start gap-3">
          <p>This login no longer exists.</p>
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft aria-hidden="true" />
            All logins
          </Button>
        </DsCardBody>
      </DsCard>
    );

  const issues = healthIssues(login.health);
  const { shared, own } = skillsFor(login, skills.data ?? []);
  const serviceName = service?.name ?? 'this service';

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onClose}>
            <ArrowLeft aria-hidden="true" />
            All logins
          </Button>
          <h1 className="text-2xl font-semibold text-nw-ink">{login.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-nw-text-3">
            {serviceName} <AiUsePill value={login.aiUse} />
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-red-700"
                onClick={async () => {
                  if (
                    !(await confirm({
                      title: 'Delete ' + login.name + '?',
                      description:
                        'The login and the skills written for it only are deleted. Shared skills stay.',
                      confirmLabel: 'Delete login',
                      destructive: true,
                    }))
                  )
                    return;
                  remove.mutate(login.id, {
                    onSuccess: () => {
                      toast.success('Login deleted');
                      onClose();
                    },
                    onError: (e) => toast.error(errorText(e)),
                  });
                }}
              >
                <Trash2 aria-hidden="true" />
                Delete login
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {issues.length > 0 && (
        <Notice kind="attention" title="Needs attention:">
          {issues.join(' · ')}.
        </Notice>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="grid gap-5">
          <SignInDetails
            loginId={login.id}
            url={login.url}
            username={login.username}
            hasOtp={login.hasOtp}
            changedAt={login.passwordChangedAt}
          />

          <DsCard>
            <DsCardHead title="Can AI agents use it?" />
            <DsCardBody className="grid gap-3">
              <ChoiceList
                label="AI use"
                value={login.aiUse}
                onChange={(v) =>
                  setAi.mutate(v, {
                    onSuccess: () => toast.success('AI access: ' + aiUseLabels[v]),
                    onError: (e) => toast.error(errorText(e)),
                  })
                }
                options={AI_USES.map((v) => ({
                  value: v,
                  label: aiUseLabels[v],
                  help: aiUseHelp[v],
                }))}
              />
              {login.seenByAi.length > 0 && (
                <div className="grid gap-1 text-sm">
                  <p className="font-medium text-nw-ink">Agents that received the password</p>
                  <ul className="grid gap-0.5 text-nw-text-2">
                    {[...login.seenByAi]
                      .reverse()
                      .slice(0, 5)
                      .map((e) => (
                        <li key={e.connectionId + e.at}>
                          {e.connectionName} · {formatDate(e.at)}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </DsCardBody>
          </DsCard>
        </div>

        <DsCard>
          <DsCardHead
            title="What an agent reads for this login"
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setPreview({
                    title: 'What an agent sees for ' + login.name,
                    text: renderSkillsFor(
                      login,
                      service ?? { id: login.serviceId, name: serviceName, description: '' },
                      skills.data ?? [],
                    ),
                  })
                }
              >
                <Eye aria-hidden="true" />
                Preview
              </Button>
            }
          />
          <DsCardBody className="grid gap-5">
            <p className="text-sm text-nw-text-3">
              Before an agent works with this login it reads these skills, in this order. Shared
              skills are written once for every {serviceName} login; skills for this login add to
              them and win where they differ.
            </p>

            {service?.builtIn && (
              <SkillGroup title="Built in">
                <SkillRow
                  icon={<MapIcon aria-hidden="true" className="h-4 w-4" />}
                  name="Navigate Wealth platform map"
                  detail="Every admin module, what it is for and its address."
                  onClick={() =>
                    setPreview({
                      title: 'Navigate Wealth platform map',
                      text: renderPlatformGuide(),
                    })
                  }
                />
              </SkillGroup>
            )}

            <SkillGroup
              title={'Shared by every ' + serviceName + ' login'}
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenSkill('new', { serviceId: login.serviceId })}
                >
                  <Plus aria-hidden="true" />
                  Shared skill
                </Button>
              }
              empty="No shared skills yet."
              skills={shared}
              onOpen={(s) => onOpenSkill(s.id)}
            />

            <SkillGroup
              title="Only for this login"
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onOpenSkill('new', { serviceId: login.serviceId, loginId: login.id })
                  }
                >
                  <Plus aria-hidden="true" />
                  Skill for this login
                </Button>
              }
              empty="None. Add one when this login works differently from the others."
              skills={own}
              onOpen={(s) => onOpenSkill(s.id)}
            />
          </DsCardBody>
        </DsCard>
      </div>

      {editing && (
        <LoginDialog
          login={login}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      )}
      {preview && <PreviewDialog {...preview} onClose={() => setPreview(null)} />}
      {confirmDialog}
    </div>
  );
}

function SignInDetails({
  loginId,
  url,
  username,
  hasOtp,
  changedAt,
}: {
  loginId: string;
  url: string;
  username: string;
  hasOtp: boolean;
  changedAt: string | null;
}) {
  const [secret, setSecret] = useState<{ password: string; notes: string } | null>(null);
  const [code, setCode] = useState<OneTimeCode | null>(null);

  // A shown password hides itself again after a minute.
  useEffect(() => {
    if (!secret) return;
    const t = setTimeout(() => setSecret(null), 60_000);
    return () => clearTimeout(t);
  }, [secret]);
  useEffect(() => {
    if (!code) return;
    const t = setTimeout(() => setCode(null), code.expiresIn * 1000);
    return () => clearTimeout(t);
  }, [code]);

  const show = async () => {
    try {
      const r = await vaultApi.reveal(loginId);
      setSecret({ password: r.password, notes: r.notes });
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <DsCard>
      <DsCardHead title="Sign-in details" />
      <DsCardBody>
        <dl className="grid gap-4 text-sm">
          <Row label="Website">
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 break-all text-nw-violet hover:underline"
            >
              {url}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </a>
          </Row>
          <Row
            label="Username"
            action={username && <CopyButton value={username} label="Username" />}
          >
            {username || <DsMeta>None</DsMeta>}
          </Row>
          <Row
            label="Password"
            action={
              <span className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => (secret ? setSecret(null) : void show())}
                >
                  {secret ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  {secret ? 'Hide' : 'Show'}
                </Button>
                <CopyButton
                  label="Password"
                  value={async () => secret?.password ?? (await vaultApi.reveal(loginId)).password}
                />
              </span>
            }
          >
            <span className="font-mono break-all">{secret ? secret.password : '••••••••••'}</span>
          </Row>
          {hasOtp && (
            <Row
              label="Authenticator code"
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      setCode(await vaultApi.oneTimeCode(loginId));
                    } catch (e) {
                      toast.error(errorText(e));
                    }
                  }}
                >
                  {code ? 'New code' : 'Show code'}
                </Button>
              }
            >
              {code ? (
                <span className="font-mono text-base tracking-widest">
                  {code.code} <DsMeta>· {code.expiresIn}s</DsMeta>
                </span>
              ) : (
                <DsMeta>Made by the vault when needed</DsMeta>
              )}
            </Row>
          )}
          {secret?.notes && (
            <Row label="Notes">
              <span className="whitespace-pre-wrap">{secret.notes}</span>
            </Row>
          )}
          <Row label="Password changed">{formatDate(changedAt, 'Not recorded')}</Row>
        </dl>
      </DsCardBody>
    </DsCard>
  );
}

function Row({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
      <dt className="text-nw-text-3">{label}</dt>
      <dd className="min-w-0 text-nw-ink">{children}</dd>
      {action && <dd>{action}</dd>}
    </div>
  );
}

function SkillGroup({
  title,
  action,
  empty,
  skills,
  onOpen,
  children,
}: {
  title: string;
  action?: ReactNode;
  empty?: string;
  skills?: Skill[];
  onOpen?: (s: Skill) => void;
  children?: ReactNode;
}) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="!text-[13px] !leading-5 font-semibold tracking-wide text-nw-text-2 uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
      {skills &&
        (skills.length ? (
          <ul className="grid gap-1.5">
            {skills.map((s) => (
              <li key={s.id}>
                <SkillRow
                  icon={<FileText aria-hidden="true" className="h-4 w-4" />}
                  name={s.name}
                  detail={s.whenToUse}
                  onClick={() => onOpen?.(s)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-nw-text-3">{empty}</p>
        ))}
    </section>
  );
}

function SkillRow({
  icon,
  name,
  detail,
  onClick,
}: {
  icon: ReactNode;
  name: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-md border border-nw-line px-3 py-2 text-left transition-colors hover:bg-nw-paper"
    >
      <span className="mt-0.5 text-nw-violet">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-nw-ink">{name}</span>
        {detail && <span className="block text-[13px] text-nw-text-3">{detail}</span>}
      </span>
    </button>
  );
}
