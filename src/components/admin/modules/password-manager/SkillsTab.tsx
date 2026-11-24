/**
 * Every skill, grouped by service. A skill is shared by all the service's
 * logins unless it was written for one login.
 */
import { useMemo, useState } from 'react';
import { FileText, Map as MapIcon, Plus, Search } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { DsCard, DsCardHead, DsMeta, DsPill, DsState, ErrorState, Notice } from '../../layout/page';
import { renderPlatformGuide } from '../../../../shared/platform-guide';
import type { Skill } from '../../../../shared/password-manager';
import { useLogins, useServices, useSkills } from './hooks';
import { errorText } from './api';
import { Loading } from './parts';
import { formatDate } from './format';
import { PreviewDialog } from './PreviewDialog';

export function SkillsTab({
  onOpenSkill,
}: {
  onOpenSkill: (id: string, from?: { serviceId?: string }) => void;
}) {
  const skills = useSkills();
  const services = useServices();
  const logins = useLogins();
  const [query, setQuery] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);

  const loginName = useMemo(
    () => new Map((logins.data ?? []).map((l) => [l.id, l.name])),
    [logins.data],
  );
  const q = query.trim().toLowerCase();
  const matches = (s: Skill) =>
    !q || [s.name, s.whenToUse, s.instructions].join(' ').toLowerCase().includes(q);

  if (skills.isLoading || services.isLoading) return <Loading what="skills" />;
  if (skills.error || services.error)
    return (
      <ErrorState
        title="Skills did not load"
        description={errorText(skills.error ?? services.error)}
        onRetry={() => {
          void skills.refetch();
          void services.refetch();
        }}
      />
    );

  const all = skills.data ?? [];
  const groups = (services.data ?? []).map((service) => ({
    service,
    rows: all.filter((s) => s.serviceId === service.id && matches(s)),
  }));

  return (
    <div className="grid gap-5">
      <Notice
        title="A skill tells an AI agent how to do one job, in plain English."
        className="bg-nw-violet-50"
      >
        Write it once for a service and every login of that service uses it. When one login works
        differently, add a skill to that login only: the agent reads it after the shared ones.
      </Notice>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-nw-text-3"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills"
            aria-label="Search skills"
            className="pl-9"
          />
        </div>
        <Button className="ml-auto" onClick={() => onOpenSkill('new')}>
          <Plus aria-hidden="true" />
          New skill
        </Button>
      </div>

      {all.length === 0 && !q && (
        <DsCard>
          <DsState
            icon={<FileText />}
            title="No skills yet"
            action={
              <Button onClick={() => onOpenSkill('new')}>
                <Plus aria-hidden="true" />
                Write your first skill
              </Button>
            }
          >
            Start with the job you most often ask an agent to do, such as downloading a monthly
            statement from a provider.
          </DsState>
        </DsCard>
      )}

      {groups
        .filter(({ service, rows }) => rows.length > 0 || (service.builtIn && !q))
        .map(({ service, rows }) => (
          <DsCard key={service.id}>
            <DsCardHead
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {service.name}
                  <DsMeta>
                    {service.logins} {service.logins === 1 ? 'login' : 'logins'}
                  </DsMeta>
                </span>
              }
              actions={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenSkill('new', { serviceId: service.id })}
                >
                  <Plus aria-hidden="true" />
                  Add skill
                </Button>
              }
            />
            <ul className="divide-y divide-nw-line">
              {service.builtIn && !q && (
                <li>
                  <button
                    type="button"
                    onClick={() => setGuideOpen(true)}
                    className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-nw-paper"
                  >
                    <MapIcon className="mt-0.5 h-4 w-4 text-nw-violet" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-nw-ink">Platform map</span>
                      <span className="block text-[13px] text-nw-text-3">
                        Every admin module, what it is for and its address. Agents read it with
                        every Navigate Wealth login.
                      </span>
                    </span>
                    <DsPill tone="brand">Built in</DsPill>
                  </button>
                </li>
              )}
              {rows.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onOpenSkill(s.id)}
                    className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-nw-paper"
                  >
                    <FileText className="mt-0.5 h-4 w-4 text-nw-violet" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-nw-ink">{s.name}</span>
                      {s.whenToUse && (
                        <span className="block text-[13px] text-nw-text-3">{s.whenToUse}</span>
                      )}
                    </span>
                    <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                      <DsPill tone={s.credentialId ? 'info' : 'neutral'}>
                        {s.credentialId
                          ? 'Only ' + (loginName.get(s.credentialId) ?? 'one login')
                          : 'Every ' + service.name + ' login'}
                      </DsPill>
                      <DsMeta>Updated {formatDate(s.updatedAt)}</DsMeta>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </DsCard>
        ))}

      {q && groups.every((g) => g.rows.length === 0) && (
        <DsCard>
          <DsState icon={<Search />} title="No skills match">
            Try another word.
          </DsState>
        </DsCard>
      )}

      {guideOpen && (
        <PreviewDialog
          title="Navigate Wealth platform map"
          text={renderPlatformGuide()}
          onClose={() => setGuideOpen(false)}
        />
      )}
    </div>
  );
}
