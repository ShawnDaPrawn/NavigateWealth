/**
 * Newsletter Studio — per-recipient delivery log for one campaign.
 */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardHeader } from '../../../../../ui/card';
import { Skeleton } from '../../../../../ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../../ui/table';
import { useStudioRecipients } from '../../hooks/useNewsletterStudio';
import type { NewsletterCampaign } from '../../types';
import { formatDateTime, formatNumber, formatRelative } from '../../utils/format';
import { DeliveryStatusBadge } from '../StatusBadge';
import { EmptyState, ErrorState, SectionHeader } from '../shared';
import { Tabs } from '../../../../../ui/tabs';
import { SegmentedList, SegmentedTrigger, useUrlState } from '../../../../layout/page';

const PAGE_SIZE = 50;

const RECIPIENT_STATUSES = [
  'all',
  'sent',
  'pending',
  'failed_retryable',
  'failed_terminal',
] as const;
type RecipientStatus = (typeof RECIPIENT_STATUSES)[number];

export function RecipientsPanel({ campaign }: { campaign: NewsletterCampaign }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useUrlState('recipients', 'all', RECIPIENT_STATUSES);
  const query = useStudioRecipients(campaign.id, { page, status });

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (query.data?.limit ?? PAGE_SIZE)));

  // Counts track the campaign record, which polls while delivery is live.
  const chips = useMemo<{ id: RecipientStatus; label: string; count?: number }[]>(
    () => [
      { id: 'all', label: 'All', count: campaign.recipientCount },
      { id: 'sent', label: 'Delivered', count: campaign.sentCount },
      { id: 'pending', label: 'Pending', count: campaign.pendingCount },
      { id: 'failed_retryable', label: 'Retrying' },
      { id: 'failed_terminal', label: 'Failed', count: campaign.failedCount },
    ],
    [campaign],
  );

  const recipients = query.data?.recipients ?? [];

  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Users}
          title="Recipients"
          description="Delivery status for every address in the frozen audience"
        />
        <Tabs
          value={status}
          onValueChange={(next) => {
            setStatus(next as RecipientStatus);
            setPage(1);
          }}
          className="pt-2"
        >
          <SegmentedList aria-label="Filter recipients by delivery status">
            {chips.map((chip) => (
              <SegmentedTrigger key={chip.id} value={chip.id}>
                {chip.label}
                {typeof chip.count === 'number' ? (
                  <span className="ml-1.5 tabular-nums text-nw-text-3">
                    {formatNumber(chip.count)}
                  </span>
                ) : null}
              </SegmentedTrigger>
            ))}
          </SegmentedList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-0">
        {query.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <ErrorState
              title="Unable to load recipients"
              details={query.error instanceof Error ? query.error.message : undefined}
              onRetry={() => void query.refetch()}
            />
          </div>
        ) : recipients.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            title="No recipients in this view"
            description={
              status === 'all'
                ? 'The audience is resolved when the campaign is queued.'
                : 'Try another status filter.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Attempts</TableHead>
                  <TableHead className="hidden sm:table-cell">Delivered</TableHead>
                  <TableHead>Engaged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((recipient) => (
                  <TableRow key={recipient.token}>
                    <TableCell>
                      <span className="block max-w-64 truncate text-sm font-medium">
                        {recipient.name && recipient.name !== recipient.email
                          ? recipient.name
                          : recipient.email}
                      </span>
                      {recipient.name && recipient.name !== recipient.email ? (
                        <span className="block max-w-64 truncate text-xs text-muted-foreground">
                          {recipient.email}
                        </span>
                      ) : null}
                      {recipient.deliveryError ? (
                        <span
                          className="block max-w-64 truncate text-xs text-rose-600 dark:text-rose-400"
                          title={recipient.deliveryError}
                        >
                          {recipient.deliveryError}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <DeliveryStatusBadge status={recipient.deliveryStatus} />
                    </TableCell>
                    <TableCell className="hidden text-xs tabular-nums text-muted-foreground md:table-cell">
                      {recipient.attemptCount}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      <span title={formatDateTime(recipient.sentAt)}>
                        {recipient.sentAt ? formatRelative(recipient.sentAt) : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {recipient.clicks.length > 0
                        ? `${recipient.clicks.length} ${recipient.clicks.length === 1 ? 'click' : 'clicks'}`
                        : recipient.openedAt
                          ? 'Opened'
                          : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {total > 0 ? (
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {formatNumber(total)}{' '}
            {total === 1 ? 'recipient' : 'recipients'}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
