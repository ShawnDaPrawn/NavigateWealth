/**
 * Logins, grouped by the service they sign in to. Navigate Wealth, the firm's
 * own platform, is built in and always listed first.
 */
import { useMemo, useState } from 'react';
import {
  ChevronRight,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import {
  DsCard,
  DsCardHead,
  DsMeta,
  DsPill,
  DsStat,
  DsStats,
  DsState,
  ErrorState,
  useConfirm,
} from '../../layout/page';
import {
  healthIssues,
  type ServiceSummary,
  type VaultSummary,
} from '../../../../shared/password-manager';
import { useLogins, useServices, useVaultMutation } from './hooks';
import { errorText, vaultApi } from './api';
import { AiUsePill, Loading } from './parts';
import { hostOf } from './format';
import { LoginDialog } from './LoginDialog';
import { ServiceDialog } from './ServiceDialog';
import { ImportDialog } from './ImportDialog';

export function LoginsTab({
  onOpenLogin,
  onOpenSkill,
}: {
  onOpenLogin: (id: string) => void;
  onOpenSkill: (id: string, from?: { serviceId?: string }) => void;
}) {
  const logins = useLogins();
  const services = useServices();
  const [query, setQuery] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [adding, setAdding] = useState<{ serviceId?: string } | null>(null);
  const [serviceDialog, setServiceDialog] = useState<ServiceSummary | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const removeService = useVaultMutation(vaultApi.deleteService);

  const all = useMemo(() => logins.data ?? [], [logins.data]);
  const attention = all.filter((l) => healthIssues(l.health).length > 0);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const names = new Map((services.data ?? []).map((s) => [s.id, s.name]));
    return all.filter(
      (l) =>
        (!attentionOnly || healthIssues(l.health).length > 0) &&
        (!q ||
          [l.name, l.url, l.username, names.get(l.serviceId) ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q)),
    );
  }, [all, query, attentionOnly, services.data]);

  if (logins.isLoading || services.isLoading) return <Loading what="logins" />;
  if (logins.error || services.error)
    return (
      <ErrorState
        title="The password manager did not load"
        description={errorText(logins.error ?? services.error)}
        onRetry={() => {
          void logins.refetch();
          void services.refetch();
        }}
      />
    );

  const filtering = Boolean(query.trim()) || attentionOnly;
  const groups = (services.data ?? [])
    .map((service) => ({ service, rows: shown.filter((l) => l.serviceId === service.id) }))
    .filter((g) => !filtering || g.rows.length > 0);

  return (
    <div className="grid gap-5">
      <DsStats>
        <DsStat label="Logins" value={all.length} />
        <DsStat label="Services" value={services.data?.length ?? 0} />
        <DsStat
          label="Need attention"
          value={attention.length}
          meta={attention.length ? 'Weak, reused, old or given to AI' : 'All good'}
          onClick={() => setAttentionOnly((v) => !v)}
          selected={attentionOnly}
        />
      </DsStats>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-nw-text-3"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search logins"
            aria-label="Search logins"
            className="pl-9"
          />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}>
            <Upload aria-hidden="true" />
            Import CSV
          </Button>
          <Button variant="outline" onClick={() => setServiceDialog('new')}>
            <Plus aria-hidden="true" />
            Add service
          </Button>
          <Button onClick={() => setAdding({})}>
            <Plus aria-hidden="true" />
            Add login
          </Button>
        </div>
      </div>

      {filtering && groups.length === 0 && (
        <DsCard>
          <DsState icon={<Search />} title="No logins match">
            Try another word, or clear the filter.
          </DsState>
        </DsCard>
      )}

      {groups.map(({ service, rows }) => (
        <DsCard key={service.id}>
          <DsCardHead
            title={
              <span className="flex flex-wrap items-center gap-2">
                {service.name}
                {service.builtIn && <DsPill tone="brand">Our platform</DsPill>}
                <DsMeta>
                  {rows.length} {rows.length === 1 ? 'login' : 'logins'} · {service.skills} shared{' '}
                  {service.skills === 1 ? 'skill' : 'skills'}
                </DsMeta>
              </span>
            }
            actions={
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAdding({ serviceId: service.id })}
                >
                  <Plus aria-hidden="true" />
                  Add login
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" aria-label={'More for ' + service.name}>
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onOpenSkill('new', { serviceId: service.id })}>
                      <Plus aria-hidden="true" />
                      Write a shared skill
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setServiceDialog(service)}>
                      <Pencil aria-hidden="true" />
                      Edit service
                    </DropdownMenuItem>
                    {!service.builtIn && (
                      <DropdownMenuItem
                        className="text-red-700"
                        onClick={async () => {
                          if (
                            !(await confirm({
                              title: 'Delete ' + service.name + '?',
                              description:
                                service.logins > 0
                                  ? 'Delete or move its logins first.'
                                  : 'Its shared skills are deleted with it.',
                              confirmLabel: 'Delete service',
                              destructive: true,
                            }))
                          )
                            return;
                          removeService.mutate(service.id, {
                            onSuccess: () => toast.success(service.name + ' deleted'),
                            onError: (e) => toast.error(errorText(e)),
                          });
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                        Delete service
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            }
          />
          {service.description && (
            <p className="border-b border-nw-line px-5 pb-3 text-[13px] text-nw-text-3">
              {service.description}
            </p>
          )}
          {rows.length ? (
            <ul className="divide-y divide-nw-line">
              {rows.map((login) => (
                <LoginRow key={login.id} login={login} onOpen={() => onOpenLogin(login.id)} />
              ))}
            </ul>
          ) : (
            <div className="px-5 py-6 text-sm text-nw-text-3">
              {service.builtIn
                ? 'Add the Navigate Wealth account your AI agents sign in with.'
                : 'No logins yet.'}{' '}
              <button
                type="button"
                className="font-medium text-nw-violet underline-offset-2 hover:underline"
                onClick={() => setAdding({ serviceId: service.id })}
              >
                Add one
              </button>
            </div>
          )}
        </DsCard>
      ))}

      {adding && (
        <LoginDialog
          presetServiceId={adding.serviceId}
          onClose={() => setAdding(null)}
          onSaved={(id) => {
            setAdding(null);
            if (id) onOpenLogin(id);
          }}
        />
      )}
      {serviceDialog && (
        <ServiceDialog
          service={serviceDialog === 'new' ? null : serviceDialog}
          onClose={() => setServiceDialog(null)}
        />
      )}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {confirmDialog}
    </div>
  );
}

function LoginRow({ login, onOpen }: { login: VaultSummary; onOpen: () => void }) {
  const issues = healthIssues(login.health);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-nw-paper"
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-nw-violet-50 text-nw-violet"
          aria-hidden="true"
        >
          <KeyRound className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-nw-ink">{login.name}</span>
          <span className="block truncate text-[13px] text-nw-text-3">
            {login.username || 'No username'} · {hostOf(login.url)}
          </span>
        </span>
        <span className="hidden flex-wrap justify-end gap-1.5 sm:flex">
          {issues.slice(0, 1).map((i) => (
            <DsPill key={i} tone="warn">
              {i}
            </DsPill>
          ))}
          <AiUsePill value={login.aiUse} />
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-nw-text-3" aria-hidden="true" />
      </button>
    </li>
  );
}
