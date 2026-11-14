/**
 * Partner advertisers — the practice's referral partners, on the Channels tab.
 *
 * Referral performance is not tracked yet, so clicks read "—" with a one-line
 * notice rather than an invented number.
 */
import { useMemo, useState } from 'react';
import { Copy, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { Input } from '../../../../ui/input';
import { Skeleton } from '../../../../ui/skeleton';
import { ErrorState, Notice, useConfirm } from '../../../layout/page';
import { useDeletePartner, usePartners, useSavePartner } from '../hooks/usePartners';
import type { SocialPartner } from '../types';
import { PartnerDialog } from './PartnerDialog';
import { PARTNER_STATUS_LABEL } from './partnersModel';

const STATUS_TONE: Record<SocialPartner['status'], string> = {
  active: 'border-green-200 bg-green-50 text-green-700',
  paused: 'border-amber-200 bg-amber-50 text-amber-700',
  ended: 'border-gray-200 bg-gray-100 text-gray-600',
};

export function PartnersPanel({ onViewAnalytics }: { onViewAnalytics?: () => void }) {
  const partnersQuery = usePartners();
  const save = useSavePartner();
  const remove = useDeletePartner();
  const { confirm, confirmDialog } = useConfirm();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SocialPartner | null>(null);

  const partners = useMemo(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((p) =>
      [p.name, p.contactName, p.contactEmail, p.referralCode].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [partners, search]);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (partner: SocialPartner) => {
    setEditing(partner);
    setDialogOpen(true);
  };

  const copyLink = async (partner: SocialPartner) => {
    try {
      await navigator.clipboard.writeText(partner.referralLink);
      toast.success(`Referral link for ${partner.name} copied`);
    } catch {
      toast.error('Could not copy the link — select it and copy it by hand');
    }
  };

  const askDelete = async (partner: SocialPartner) => {
    const ok = await confirm({
      title: `Remove ${partner.name}?`,
      description:
        'The partner and its referral code are removed. Links already shared keep working but are no longer attributed to anyone.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) remove.mutate({ id: partner.id, name: partner.name });
  };

  return (
    <section className="rounded-xl border border-nw-line bg-white" aria-labelledby="partners-h">
      <div className="flex flex-wrap items-center gap-3 border-b border-nw-line px-4 py-3">
        <h3 id="partners-h" className="text-base font-semibold text-nw-ink">
          Partner advertisers
        </h3>
        <span className="flex-1" />
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-nw-text-3"
            aria-hidden="true"
          />
          <Input
            aria-label="Search partners"
            placeholder="Search partners…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8"
          />
        </div>
        {onViewAnalytics ? (
          <Button size="sm" variant="outline" onClick={onViewAnalytics}>
            View analytics
          </Button>
        ) : null}
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add partner
        </Button>
      </div>

      <div className="space-y-3 p-4">
        <Notice title="Referral clicks:">
          tracking starts when a partner’s link is used; until then clicks show as “—”.
        </Notice>

        {partnersQuery.isLoading ? (
          <div className="space-y-2" data-testid="partners-loading">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : partnersQuery.error ? (
          <ErrorState
            title="Could not load partners"
            description={
              partnersQuery.error instanceof Error ? partnersQuery.error.message : undefined
            }
            onRetry={() => void partnersQuery.refetch()}
          />
        ) : partners.length === 0 ? (
          <div className="rounded-lg border border-dashed border-nw-line px-4 py-10 text-center">
            <p className="text-sm font-medium text-nw-ink">No partners yet</p>
            <p className="mt-1 text-sm text-nw-text-3">
              Add a business you promote to get a referral link to share with them.
            </p>
            <Button size="sm" className="mt-3" onClick={openAdd}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add partner
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-nw-line px-4 py-8 text-center text-sm text-nw-text-3">
            No partners match “{search}”.{' '}
            <button
              type="button"
              className="font-medium text-nw-violet-600 hover:underline"
              onClick={() => setSearch('')}
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nw-line text-left text-xs text-nw-text-3">
                  <th className="py-2 pr-3 font-medium">Partner</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Referral link</th>
                  <th className="py-2 pr-3 font-medium">Clicks (30 days)</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((partner) => (
                  <tr key={partner.id} className="border-b border-nw-line last:border-0">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-nw-ink">{partner.name}</div>
                      {partner.contactName || partner.contactEmail ? (
                        <div className="text-xs text-nw-text-3">
                          {[partner.contactName, partner.contactEmail].filter(Boolean).join(' · ')}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge variant="outline" className={STATUS_TONE[partner.status]}>
                        {PARTNER_STATUS_LABEL[partner.status]}
                      </Badge>
                    </td>
                    <td className="max-w-[18rem] py-2.5 pr-3">
                      <span
                        className="block truncate font-mono text-xs text-nw-text-2"
                        title={partner.referralLink}
                      >
                        {partner.referralLink}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-nw-text-3">—</td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => void copyLink(partner)}>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          Copy referral link
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              aria-label={`More options for ${partner.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openEdit(partner)}>
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-700"
                              onSelect={() => void askDelete(partner)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Remove…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PartnerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        partner={editing}
        partners={partners}
        saving={save.isPending}
        onSave={(input) => save.mutateAsync({ id: editing?.id, input })}
      />
      {confirmDialog}
    </section>
  );
}
