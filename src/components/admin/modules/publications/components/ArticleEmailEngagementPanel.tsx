import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import {
  Activity,
  BookOpenCheck,
  Loader2,
  Mail,
  MailOpen,
  RefreshCw,
  Users,
} from 'lucide-react';

import { PublicationsAPI } from '../api';
import type {
  ArticleEmailDeliveryStatus,
  ArticleEmailEngagementDetail,
  ArticleEmailEngagementRecipient,
  ArticleEmailEngagementSummary,
} from '../types';

function formatDateTime(value: string | null): string {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function formatRate(value: number): string {
  return `${value.toFixed(1)}%`;
}

function statusBadgeVariant(status: ArticleEmailDeliveryStatus): string {
  switch (status) {
    case 'sent':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'failed':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}

function sourceBadgeClass(source: ArticleEmailEngagementRecipient['source']): string {
  return source === 'reshare'
    ? 'bg-purple-50 text-purple-700 border-purple-200'
    : 'bg-blue-50 text-blue-700 border-blue-200';
}

export function ArticleEmailEngagementPanel() {
  const [summaries, setSummaries] = useState<ArticleEmailEngagementSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArticleEmailEngagementDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const loadSummary = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await PublicationsAPI.Articles.getEmailEngagementSummary();
      setSummaries(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article email engagement');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  const openDetail = async (articleId: string) => {
    setSelectedArticleId(articleId);
    setIsDetailLoading(true);
    setDetail(null);

    try {
      const result = await PublicationsAPI.Articles.getArticleEmailEngagement(articleId);
      setDetail(result);
    } catch {
      setDetail(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const totals = useMemo(() => {
    const sent = summaries.reduce((sum, item) => sum + item.sent, 0);
    const opened = summaries.reduce((sum, item) => sum + item.opened, 0);
    const read = summaries.reduce((sum, item) => sum + item.read, 0);
    const failed = summaries.reduce((sum, item) => sum + item.failed, 0);

    return {
      sent,
      opened,
      read,
      failed,
      openRate: sent > 0 ? (opened / sent) * 100 : 0,
      readRate: sent > 0 ? (read / sent) * 100 : 0,
    };
  }, [summaries]);

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            label="Emails Sent"
            value={totals.sent.toLocaleString()}
            icon={Mail}
            accent="blue"
            sub={`${summaries.length} tracked article campaign(s)`}
          />
          <MetricCard
            label="Unique Opens"
            value={totals.opened.toLocaleString()}
            icon={MailOpen}
            accent="purple"
            sub={formatRate(totals.openRate)}
          />
          <MetricCard
            label="Read Completions"
            value={totals.read.toLocaleString()}
            icon={BookOpenCheck}
            accent="green"
            sub={formatRate(totals.readRate)}
          />
          <MetricCard
            label="Delivery Failures"
            value={totals.failed.toLocaleString()}
            icon={Activity}
            accent="amber"
            sub="Best-effort tracking only"
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Article Email Engagement</CardTitle>
                <CardDescription>
                  Same-domain links only. No tracking pixel. Opens and reads are recorded after on-page engagement signals.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadSummary()} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-1.5">Refresh</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 flex items-center justify-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading article email engagement...
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : summaries.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-gray-900">No tracked article sends yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Publish or reshare an article to start collecting email engagement.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Read</TableHead>
                    <TableHead>Open Rate</TableHead>
                    <TableHead>Read Rate</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="text-right">Recipients</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((summary) => (
                    <TableRow key={summary.articleId}>
                      <TableCell className="align-top">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-[320px]">{summary.articleTitle}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {summary.publishedAt ? `Published ${formatDateTime(summary.publishedAt)}` : 'Tracked via article email send'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{summary.sent.toLocaleString()}</TableCell>
                      <TableCell>{summary.opened.toLocaleString()}</TableCell>
                      <TableCell>{summary.read.toLocaleString()}</TableCell>
                      <TableCell>{formatRate(summary.openRate)}</TableCell>
                      <TableCell>{formatRate(summary.readRate)}</TableCell>
                      <TableCell>{formatDateTime(summary.latestReadAt || summary.latestOpenedAt || summary.latestSentAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => void openDetail(summary.articleId)}>
                          View Recipients
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedArticleId)} onOpenChange={(open) => {
        if (!open) {
          setSelectedArticleId(null);
          setDetail(null);
        }
      }}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{detail?.summary.articleTitle || 'Recipient Engagement'}</DialogTitle>
            <DialogDescription>
              Recipient-level article email activity, including send status, opens, and read completions.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {isDetailLoading ? (
              <div className="py-16 flex items-center justify-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading recipient activity...
              </div>
            ) : !detail ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No recipient detail available.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <DetailStat label="Sent" value={detail.summary.sent} />
                  <DetailStat label="Opened" value={detail.summary.opened} />
                  <DetailStat label="Read" value={detail.summary.read} />
                  <DetailStat label="Read Rate" value={formatRate(detail.summary.readRate)} />
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Opened</TableHead>
                      <TableHead>Read</TableHead>
                      <TableHead>Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.recipients.map((recipient) => (
                      <TableRow key={recipient.token}>
                        <TableCell className="align-top">
                          <div>
                            <p className="font-medium text-gray-900">{recipient.recipientName || recipient.recipientEmail}</p>
                            <p className="text-xs text-muted-foreground mt-1">{recipient.recipientEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={sourceBadgeClass(recipient.source)}>
                            {recipient.source === 'reshare' ? 'Reshare' : 'Publish'}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <Badge className={statusBadgeVariant(recipient.deliveryStatus)}>
                              {recipient.deliveryStatus}
                            </Badge>
                            {recipient.deliveryError && (
                              <p className="text-[11px] text-red-600 max-w-[240px] whitespace-normal">
                                {recipient.deliveryError}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {recipient.openedAt ? (
                            <div>
                              <p>{formatDateTime(recipient.openedAt)}</p>
                              <p className="text-xs text-muted-foreground mt-1">{recipient.openCount} event(s)</p>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {recipient.readAt ? (
                            <div>
                              <p>{formatDateTime(recipient.readAt)}</p>
                              <p className="text-xs text-muted-foreground mt-1">{recipient.readCount} event(s)</p>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{formatDateTime(recipient.lastReadAt || recipient.lastOpenedAt || recipient.sentAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: 'blue' | 'purple' | 'green' | 'amber';
  sub: string;
}) {
  const tone = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    purple: 'bg-purple-50 text-purple-600 ring-purple-100',
    green: 'bg-green-50 text-green-600 ring-green-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  }[accent];

  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight text-gray-900">{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${tone}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{sub}</p>
      </CardContent>
    </Card>
  );
}

function DetailStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-muted/20 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
