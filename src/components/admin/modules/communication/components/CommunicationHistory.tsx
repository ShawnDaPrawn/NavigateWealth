import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../../ui/sheet';
import {
  History,
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
  onClose?: () => void;
}

export function CommunicationHistory({ onClose }: CommunicationHistoryProps) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [senderOptions, setSenderOptions] = useState<CampaignHistorySenderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [recipientFilter, setRecipientFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [detailLog, setDetailLog] = useState<ActivityLogEntry | null>(null);

  const PAGE_SIZE = 15;
  const searchDebounceReady = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      if (searchDebounceReady.current) setCurrentPage(1);
      else searchDebounceReady.current = true;
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

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

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" aria-hidden />
            Communication History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={triggerRefresh}
              disabled={loading}
              aria-label="Refresh history"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
              setChannelFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by channel">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="portal">Portal only</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[190px]" aria-label="Filter by status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
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
              setOriginFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by source">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="campaign">Campaigns</SelectItem>
              <SelectItem value="direct">Individual messages</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={recipientFilter}
            onValueChange={(v) => {
              setRecipientFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by recipient type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="single">Single Client</SelectItem>
              <SelectItem value="group">Client Group</SelectItem>
              <SelectItem value="multiple">Multiple Clients</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={userFilter}
            onValueChange={(v) => {
              setUserFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by sender">
              <SelectValue placeholder="All Users" />
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
                setDebouncedSearch('');
                setChannelFilter('all');
                setRecipientFilter('all');
                setUserFilter('all');
                setStatusFilter('all');
                setOriginFilter('all');
                setCurrentPage(1);
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
                <TableHead scope="col">Date &amp; Time</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Channel</TableHead>
                <TableHead scope="col">Recipients</TableHead>
                <TableHead scope="col">Subject / Preview</TableHead>
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
              onClick={() => setCurrentPage((p) => p - 1)}
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
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= totalPages || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
      </CardContent>

      <Sheet open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {detailLog && (
            <>
              <SheetHeader className="text-left pr-8">
                <SheetTitle className="line-clamp-3">
                  {detailLog.subject || 'Communication'}
                </SheetTitle>
                <SheetDescription asChild>
                  <div className="space-y-1 text-left">
                    <p>{formatTimestamp(detailLog.timestamp)}</p>
                    <p>
                      Sent by{' '}
                      <span className="font-medium text-foreground">
                        {displaySenderName(detailLog)}
                      </span>
                    </p>
                    <p className="capitalize">
                      {detailLog.channel} · {formatRecipientLine(detailLog)}
                    </p>
                  </div>
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    Status
                  </div>
                  <div className="flex flex-col gap-1.5 items-start">
                    {getStatusBadge(detailLog.status)}
                    {formatDeliveryLine(detailLog) && (
                      <span className="text-sm text-muted-foreground">
                        {formatDeliveryLine(detailLog)}
                      </span>
                    )}
                    {detailLog.failureReason && (
                      <p className="text-sm text-red-700 break-words">{detailLog.failureReason}</p>
                    )}
                  </div>
                </div>
                {detailLog.cc && detailLog.cc.length > 0 && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                      CC
                    </div>
                    <p className="text-sm text-foreground break-words">{detailLog.cc.join(', ')}</p>
                  </div>
                )}
                {detailLog.templateUsed && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                      Template
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" aria-hidden />
                      {detailLog.templateUsed}
                    </Badge>
                  </div>
                )}
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    Preview
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                    {detailLog.messagePreviewFull || detailLog.messagePreview || '—'}
                  </p>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    Attachments
                  </div>
                  {detailLog.attachmentCount > 0 ? (
                    <p className="text-sm">
                      {detailLog.attachmentCount}{' '}
                      {detailLog.attachmentCount === 1 ? 'file' : 'files'}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">None</p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
