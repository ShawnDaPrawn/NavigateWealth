/**
 * Newsletter Studio — campaigns tab: list, composer and drill-down.
 */
import { useMemo, useState } from 'react';
import { Mail, Plus, Search } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Progress } from '../../../../ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { CAMPAIGN_STATUS_CONFIG } from '../constants';
import { useStudioCampaigns } from '../hooks/useNewsletterStudio';
import { CampaignEditor } from './CampaignEditor';
import { CampaignDetail } from './CampaignDetail';
import { CampaignStatusBadge } from './StatusBadge';
import type { NewsletterCampaign } from '../types';

type View =
  | { kind: 'list' }
  | { kind: 'editor'; campaign: NewsletterCampaign | null }
  | { kind: 'detail'; campaignId: string };

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function CampaignsTab({
  canSend,
  view,
  onViewChange,
}: {
  canSend: boolean;
  view: View;
  onViewChange: (view: View) => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const { data, isLoading } = useStudioCampaigns(
    useMemo(() => ({ search: search || undefined, status }), [search, status]),
  );

  if (view.kind === 'editor') {
    return (
      <CampaignEditor
        campaign={view.campaign}
        onBack={() =>
          onViewChange(
            view.campaign ? { kind: 'detail', campaignId: view.campaign.id } : { kind: 'list' },
          )
        }
        onSaved={(campaign) => onViewChange({ kind: 'detail', campaignId: campaign.id })}
      />
    );
  }

  if (view.kind === 'detail') {
    return (
      <CampaignDetail
        campaignId={view.campaignId}
        canSend={canSend}
        onBack={() => onViewChange({ kind: 'list' })}
        onEdit={(campaign) => onViewChange({ kind: 'editor', campaign })}
        onDeleted={() => onViewChange({ kind: 'list' })}
      />
    );
  }

  const campaigns = data?.campaigns ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns…"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(CAMPAIGN_STATUS_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => onViewChange({ kind: 'editor', campaign: null })}>
          <Plus className="mr-1 h-4 w-4" aria-hidden /> New campaign
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading campaigns…</p>
          ) : campaigns.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Mail className="mx-auto mb-2 h-8 w-8 opacity-40" aria-hidden />
              {search || status !== 'all'
                ? 'No campaigns match the current filters.'
                : 'No campaigns yet. Create one to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead className="min-w-40">Delivery</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow
                      key={campaign.id}
                      className="cursor-pointer"
                      onClick={() => onViewChange({ kind: 'detail', campaignId: campaign.id })}
                    >
                      <TableCell>
                        <span className="block max-w-64 truncate font-medium">{campaign.name}</span>
                        <span className="block max-w-64 truncate text-xs text-muted-foreground">
                          {campaign.subject}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <CampaignStatusBadge status={campaign.status} />
                          {campaign.stuck ? (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              stalled
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-sm text-muted-foreground">
                        {campaign.listNames.join(', ') || '—'}
                      </TableCell>
                      <TableCell>
                        {campaign.recipientCount > 0 ? (
                          <div className="flex items-center gap-2">
                            <Progress value={campaign.progressPercent} className="h-1.5 w-20" />
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {campaign.sentCount}/{campaign.recipientCount}
                              {campaign.failedCount > 0 ? ` · ${campaign.failedCount} failed` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {campaign.status === 'scheduled'
                              ? `sends ${formatDate(campaign.scheduledAt)}`
                              : '—'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {campaign.sentCount > 0
                          ? `${campaign.openCount} opens · ${campaign.clickCount} clicks`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(campaign.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export type { View as CampaignsView };
