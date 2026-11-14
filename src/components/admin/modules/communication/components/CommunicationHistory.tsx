import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
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
import {
  Mail,
  MessageSquare,
  Search,
  Calendar,
  Users,
  User,
  FileText,
  Paperclip,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import {
  ActivityLogEntry,
  CampaignHistorySenderOption,
  CommunicationStatus,
  COMMUNICATION_STATUS_FILTERS,
  HistoryChannel,
  RecipientType,
} from '../types';
import { communicationApi } from '../api';
import { useRecordInUrl } from '../../../layout/page';
import { Crumbs } from './Crumbs';
import { toast } from 'sonner';

const SENDER_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function displaySenderName(log: ActivityLogEntry): string {
  const n = log.userName.trim();
  if (SENDER_UUID_RE.test(n)) return 'Staff member';
  return n;
}

function formatRecipientLine(log: ActivityLogEntry): string {
  const n = log.recipientCount;
  if (log.recipientType === 'group') {
    if (log.groupName?.trim()) {
      return `Group · ${log.groupName.trim()}`;
    }
    return n === 1 ? '1 client in group' : `${n} clients in group`;
  }
  if (log.recipientType === 'multiple') {
    return n === 1 ? '1 client' : `${n} clients`;
  }
  return n === 1 ? '1 client' : `${n} clients`;
}

interface CommunicationHistoryProps {
  /**
   * Called with true while one message is open as a page of its own, so the
   * module can hide its header and tabs.
   */
  onRecordPageChange?: (open: boolean) => void;
}

export function CommunicationHistory({ onRecordPageChange }: CommunicationHistoryProps) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [senderOptions, setSenderOptions] = useState<CampaignHistorySenderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search, every filter and the page are in the address (?channel=email&page=2),
  // so a reload, Back from a message or a pasted link lands on the same list.
  const [searchParams, setSearchParams] = useSearchParams();
  const param = (key: string) => searchParams.get(key) ?? 'all';
  const debouncedSearch = searchParams.get('q') ?? '';
  const channelFilter = param('channel');
  const recipientFilter = param('recipient');
  const userFilter = param('sender');
  const statusFilter = param('status');
  const originFilter = param('source');
  const currentPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const [searchTerm, setSearchTerm] = useState(debouncedSearch);

  /** One address change for several filters ('all', '' and page 1 are left out). */
  const updateFilters = useCallback(
    (patch: Record<string, string | number | null>) =>
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (
              value === null ||
              value === 'all' ||
              value === '' ||
              (key === 'page' && value === 1)
            )
              params.delete(key);
            else params.set(key, String(value));
          }
          return params;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  const [refreshToken, setRefreshToken] = useState(0);
  const [detailLog, setDetailLog] = useState<ActivityLogEntry | null>(null);

  const PAGE_SIZE = 15;
  const searchDebounceReady = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      // The first run is the value read from the address: nothing to write.
      if (searchDebounceReady.current) updateFilters({ q: searchTerm.trim(), page: null });
      else searchDebounceReady.current = true;
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchTerm, updateFilters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await communicationApi.getHistoryPage({
          page: currentPage,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          channel: channelFilter,
          recipientType: recipientFilter,
          createdBy: userFilter,
          status: statusFilter,
          origin: originFilter,
        });
        if (cancelled) return;
        setLogs(result.entries);
        setTotal(result.total);
        setSenderOptions(result.senderOptions);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load history:', err);
        setError('Failed to load communication history');
        setLogs([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentPage,
    debouncedSearch,
    channelFilter,
    recipientFilter,
    userFilter,
    statusFilter,
    originFilter,
    refreshToken,
  ]);

  const triggerRefresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  // A message named in the address but not on the loaded page (an older one,
  // or one found through filters before a reload) is looked up on its own.
  const [lookup, setLookup] = useState<{
    id: string;
    done: boolean;
    entry: ActivityLogEntry | null;
  } | null>(null);

  useEffect(() => {
    if (!lookup || lookup.done) return;
    let cancelled = false;
    const { id } = lookup;
    communicationApi
      .findHistoryEntry(id)
      .catch((err) => {
        console.error('Failed to look up history message:', err);
        return null;
      })
      .then((entry) => {
        if (!cancelled) setLookup({ id, done: true, entry });
      });
    return () => {
      cancelled = true;
    };
  }, [lookup]);

  // The open message is in the address (?message=<id>): reload, Back and a
  // pasted link land on it, whichever list page it is on.
  useRecordInUrl('message', detailLog ? detailLog.id : null, {
    ready: !loading && !(lookup && !lookup.done),
    openFromUrl: (id) => {
      if (loading) return 'waiting';
      const match = logs.find((log) => log.id === id);
      if (match) {
        setDetailLog(match);
        return 'opened';
      }
      if (!lookup || lookup.id !== id) {
        setLookup({ id, done: false, entry: null });
        return 'waiting';
      }
      if (!lookup.done) return 'waiting';
      if (lookup.entry) {
        setDetailLog(lookup.entry);
        return 'opened';
      }
      if (!error) toast.error('Message not found in the history list');
      return 'missing';
    },
    closeFromUrl: (previousId) => {
      setDetailLog((current) => (current && current.id === previousId ? null : current));
    },
  });

  useEffect(() => {
    onRecordPageChange?.(!!detailLog);
  }, [detailLog, onRecordPageChange]);

  const formatTimestamp = (timestamp: Date): string => {
    return new Date(timestamp).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getChannelIcon = (channel: HistoryChannel) => {
    if (channel === 'email') return <Mail className="h-4 w-4 shrink-0" aria-hidden />;
    if (channel === 'portal') return <Inbox className="h-4 w-4 shrink-0" aria-hidden />;
    return <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />;
  };

  /** Portal-only rows are messages that reached the client's inbox, not an inbox. */
  const CHANNEL_LABEL: Record<HistoryChannel, string> = {
    email: 'Email',
    whatsapp: 'WhatsApp',
    portal: 'Portal only',
  };

  const getRecipientIcon = (type: RecipientType) => {
    return type === 'group' ? (
      <Users className="h-4 w-4 shrink-0" aria-hidden />
    ) : (
      <User className="h-4 w-4 shrink-0" aria-hidden />
    );
  };

  const getStatusBadge = (status: CommunicationStatus | string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600 text-white border-transparent">Completed</Badge>;
      case 'sent':
        return <Badge className="bg-green-600 text-white border-transparent">Sent</Badge>;
      case 'partial':
        return (
          <Badge className="bg-amber-500 text-white border-transparent">Partially delivered</Badge>
        );
      case 'rejected':
        // Distinct from Failed on purpose: rejected is terminal (the provider
        // refused the address or the message), so re-sending the same payload
        // will not help — the address has to be fixed first.
        return (
          <Badge variant="outline" className="text-red-700 border-red-600">
            Rejected
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            Scheduled
          </Badge>
        );
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'sending':
        return (
          <Badge className="bg-blue-600 text-white border-transparent animate-pulse">Sending</Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  /** "12 delivered · 3 failed" — the numbers behind the badge. */
  const formatDeliveryLine = (log: ActivityLogEntry): string | null => {
    if (!log.stats || log.stats.total === 0) return null;
    const { sent, failed } = log.stats;
    if (failed === 0) return `${sent} delivered`;
    return `${sent} delivered · ${failed} not delivered`;
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openRow = (log: ActivityLogEntry) => setDetailLog(log);

  const onRowKeyDown = (e: React.KeyboardEvent, log: ActivityLogEntry) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openRow(log);
    }
  };

  // One message is a page of its own (design system: records are pages,
  // never side panels). The list keeps its filters and page underneath.
  if (detailLog) {
    return (
      <>
        <Crumbs
          trail={[
            { label: 'History', onClick: () => setDetailLog(null) },
            { label: detailLog.subject || 'Message' },
          ]}
        />
        <HistoryMessagePage
          log={detailLog}
          onBack={() => setDetailLog(null)}
          formatTimestamp={formatTimestamp}
          statusBadge={getStatusBadge(detailLog.status)}
          deliveryLine={formatDeliveryLine(detailLog)}
          channelLabel={CHANNEL_LABEL[detailLog.channel] ?? detailLog.channel}
        />
      </>
    );
  }

  return (
    <Card className="w-full">
      <Crumbs trail={[{ label: 'History' }]} />
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="comm-history-search" className="sr-only">
              Search communications
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="comm-history-search"
                placeholder="Search communications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select
            value={channelFilter}
            onValueChange={(v) => {
              updateFilters({ channel: v, page: null });
            }}
          >
            <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by channel">
              <SelectValue placeholder="All channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="portal">Portal only</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => {
              updateFilters({ status: v, page: null });
            }}
          >
            <SelectTrigger className="w-full sm:w-[190px]" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {COMMUNICATION_STATUS_FILTERS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={originFilter}
            onValueChange={(v) => {
              updateFilters({ source: v, page: null });
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by source">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="campaign">Campaigns</SelectItem>
              <SelectItem value="direct">Individual messages</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={recipientFilter}
            onValueChange={(v) => {
              updateFilters({ recipient: v, page: null });
            }}
          >
            <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by recipient type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="single">Single client</SelectItem>
              <SelectItem value="group">Client group</SelectItem>
              <SelectItem value="multiple">Multiple clients</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={userFilter}
            onValueChange={(v) => {
              updateFilters({ sender: v, page: null });
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by sender">
              <SelectValue placeholder="All senders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All senders</SelectItem>
              {senderOptions.map(({ userId, label }) => (
                <SelectItem key={userId} value={userId}>
                  {SENDER_UUID_RE.test(label.trim()) ? 'Staff member' : label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={triggerRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>
            {total} communication{total !== 1 ? 's' : ''} found
          </span>
          {(searchTerm ||
            channelFilter !== 'all' ||
            recipientFilter !== 'all' ||
            userFilter !== 'all' ||
            statusFilter !== 'all' ||
            originFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                updateFilters({
                  q: null,
                  channel: null,
                  recipient: null,
                  sender: null,
                  status: null,
                  source: null,
                  page: null,
                });
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <div className="max-h-[min(70vh,720px)] overflow-auto rounded-lg border">
          <Table className="min-w-[920px]">
            <TableHeader className="sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Date &amp; time</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Channel</TableHead>
                <TableHead scope="col">Recipients</TableHead>
                <TableHead scope="col">Subject / preview</TableHead>
                <TableHead scope="col">Sent by</TableHead>
                <TableHead scope="col">Attachments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" aria-hidden />
                    Loading history…
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {error ? (
                      <span className="text-red-600">{error}</span>
                    ) : (
                      'No communications match your filters.'
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50 focus-within:bg-muted/50"
                    tabIndex={0}
                    role="button"
                    aria-label={`Open details: ${log.subject || 'Communication'}`}
                    onClick={() => openRow(log)}
                    onKeyDown={(e) => onRowKeyDown(e, log)}
                  >
                    <TableCell className="text-sm align-top">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                        <span className="tabular-nums">{formatTimestamp(log.timestamp)}</span>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(log.status)}
                        {formatDeliveryLine(log) && (
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatDeliveryLine(log)}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-2">
                          {getChannelIcon(log.channel)}
                          <Badge variant={log.channel === 'email' ? 'outline' : 'secondary'}>
                            {CHANNEL_LABEL[log.channel] ?? log.channel}
                          </Badge>
                        </div>
                        {log.origin === 'direct' && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 h-5 text-purple-700 border-purple-300"
                          >
                            Individual
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="flex items-start gap-2 min-w-[8rem]">
                        {getRecipientIcon(log.recipientType)}
                        <span className="text-sm leading-snug">{formatRecipientLine(log)}</span>
                      </div>
                    </TableCell>

                    <TableCell className="min-w-[280px] max-w-md align-top">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          {log.subject ? (
                            <div className="font-medium text-sm leading-snug line-clamp-2 min-w-0 flex-1">
                              {log.subject}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">No subject</span>
                          )}
                          {log.templateUsed ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] shrink-0 py-0 h-6 gap-1"
                            >
                              <FileText className="h-3 w-3" aria-hidden />
                              {log.templateUsed}
                            </Badge>
                          ) : null}
                        </div>
                        <div>
                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
                            Preview
                          </div>
                          <p className="text-sm text-muted-foreground leading-snug line-clamp-2">
                            {log.messagePreview || '—'}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <span className="font-medium text-sm">{displaySenderName(log)}</span>
                    </TableCell>

                    <TableCell className="align-top">
                      {log.attachmentCount > 0 ? (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
                          <span>
                            {log.attachmentCount} {log.attachmentCount === 1 ? 'file' : 'files'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground/80">None</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {total > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilters({ page: currentPage - 1 })}
              disabled={currentPage <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground text-center">
              Page {currentPage} of {totalPages}
              <span className="mx-1 text-muted-foreground/70">·</span>
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)} of{' '}
              {total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilters({ page: currentPage + 1 })}
              disabled={currentPage >= totalPages || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </h2>
      {children}
    </section>
  );
}

/** One sent message, in place of the history list, with its own address. */
function HistoryMessagePage({
  log,
  onBack,
  formatTimestamp,
  statusBadge,
  deliveryLine,
  channelLabel,
}: {
  log: ActivityLogEntry;
  onBack: () => void;
  formatTimestamp: (timestamp: Date) => string;
  statusBadge: React.ReactNode;
  deliveryLine: string | null;
  channelLabel: string;
}) {
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to history
      </button>

      <div className="overflow-hidden rounded-xl border border-nw-line bg-white">
        <div className="space-y-2 border-b border-gray-100 px-6 py-5">
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-nw-ink wrap-anywhere">
            {log.subject || 'Communication'}
          </h1>
          <p className="text-sm text-nw-text-3">
            {formatTimestamp(log.timestamp)} · Sent by{' '}
            <span className="font-medium text-nw-ink">{displaySenderName(log)}</span> ·{' '}
            {channelLabel} · {formatRecipientLine(log)}
          </p>
        </div>

        <div className="space-y-6 px-6 py-6">
          <DetailSection label="Status">
            <div className="flex flex-col gap-1.5 items-start">
              {statusBadge}
              {deliveryLine && (
                <span className="text-sm text-muted-foreground">{deliveryLine}</span>
              )}
              {log.failureReason && (
                <p className="text-sm text-red-700 break-words">{log.failureReason}</p>
              )}
            </div>
          </DetailSection>
          {log.cc && log.cc.length > 0 && (
            <DetailSection label="CC">
              <p className="text-sm text-foreground break-words">{log.cc.join(', ')}</p>
            </DetailSection>
          )}
          {log.templateUsed && (
            <DetailSection label="Template">
              <Badge variant="outline" className="gap-1">
                <FileText className="h-3 w-3" aria-hidden />
                {log.templateUsed}
              </Badge>
            </DetailSection>
          )}
          <DetailSection label="Preview">
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {log.messagePreviewFull || log.messagePreview || '—'}
            </p>
          </DetailSection>
          <DetailSection label="Attachments">
            {log.attachmentCount > 0 ? (
              <p className="text-sm">
                {log.attachmentCount} {log.attachmentCount === 1 ? 'file' : 'files'}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">None</p>
            )}
          </DetailSection>
        </div>
      </div>
    </div>
  );
}
