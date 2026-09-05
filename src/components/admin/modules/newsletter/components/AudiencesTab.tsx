/**
 * Newsletter Studio — audiences: the subscriber base plus the communication
 * groups a campaign can target. Read-only here by design; membership is
 * managed in the Communication module (one source of truth) and individual
 * subscribers in Publications → Subscribers.
 */
import { Link } from 'react-router';
import { ExternalLink, Send, UserCheck, UserMinus, Users } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { SUBSCRIBER_LIST_ID } from '../constants';
import { useStudioDashboard, useStudioLists } from '../hooks/useNewsletterStudio';
import type { NewsletterCaps } from '../types';
import { formatNumber, pluralize, ratePercent } from '../utils/format';
import { EmptyState, ErrorState, MiniBar, SectionHeader } from './shared';

interface AudiencesTabProps {
  caps: NewsletterCaps;
  onCreateCampaign: (listIds: string[]) => void;
}

export function AudiencesTab({ caps, onCreateCampaign }: AudiencesTabProps) {
  const { data: lists = [], isLoading, isError, error, refetch, isFetching } = useStudioLists();
  const { data: dashboard } = useStudioDashboard();

  const subscriberList = lists.find((list) => list.id === SUBSCRIBER_LIST_ID);
  const otherLists = lists.filter((list) => list.id !== SUBSCRIBER_LIST_ID);
  const subscribers = dashboard?.subscribers;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Audiences"
        description="Campaign audiences are the platform's communication groups. Opted-out addresses are excluded from every send, whatever list they sit in."
        action={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin?module=publications">
                Manage subscribers <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin?module=communication">
                Manage groups <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          </>
        }
      />

      {isError && lists.length === 0 ? (
        <ErrorState
          title="Audiences could not be loaded"
          description={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Subscriber base */}
          <Card className="gap-0 overflow-hidden">
            <CardContent className="p-0">
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="flex items-start gap-4">
                  <span className="rounded-2xl bg-purple-600 p-3 text-white shadow-sm">
                    <Users className="h-6 w-6" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        {subscriberList?.name ?? 'Newsletter Contacts'}
                      </h3>
                      <Badge className="bg-purple-600 text-white hover:bg-purple-600">
                        Default audience
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                      Every confirmed subscriber who has not opted out — from the website sign-up
                      form, admin imports and client reconciliation. Kept in sync automatically.
                    </p>
                    <div className="mt-4 grid max-w-md grid-cols-3 gap-4">
                      <Figure
                        icon={UserCheck}
                        label="Reachable"
                        value={formatNumber(
                          subscriberList?.memberCount ?? subscribers?.active ?? 0,
                        )}
                      />
                      <Figure
                        icon={Users}
                        label="Total"
                        value={formatNumber(subscribers?.total ?? 0)}
                      />
                      <Figure
                        icon={UserMinus}
                        label="Opted out"
                        value={formatNumber(subscribers?.unsubscribed ?? 0)}
                        tone="rose"
                      />
                    </div>
                    {subscribers && subscribers.total > 0 ? (
                      <div className="mt-3 max-w-md">
                        <MiniBar
                          value={ratePercent(subscribers.active, subscribers.total)}
                          tone="purple"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {Math.round(ratePercent(subscribers.active, subscribers.total))}% of all
                          subscribers can currently receive campaigns
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
                {caps.create ? (
                  <Button size="lg" onClick={() => onCreateCampaign([SUBSCRIBER_LIST_ID])}>
                    <Send className="h-4 w-4" aria-hidden /> Campaign to subscribers
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Other lists */}
          <Card className="gap-0 overflow-hidden">
            <div className="border-b border-border/60 px-6 py-4">
              <SectionHeader
                title="Communication groups"
                description={`${pluralize(otherLists.length, 'group')} available as additional audiences`}
              />
            </div>
            <CardContent className="p-0">
              {otherLists.length === 0 ? (
                <EmptyState
                  compact
                  icon={Users}
                  title="No other groups yet"
                  description="Create client or contact groups in the Communication module to target them here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Group</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Members</TableHead>
                        <TableHead className="hidden text-right md:table-cell">Clients</TableHead>
                        <TableHead className="hidden text-right md:table-cell">Contacts</TableHead>
                        {caps.create ? (
                          <TableHead className="w-36 text-right">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {otherLists.map((list) => (
                        <TableRow key={list.id}>
                          <TableCell>
                            <span className="block font-medium">{list.name}</span>
                            {list.description ? (
                              <span className="block max-w-md truncate text-xs text-muted-foreground">
                                {list.description}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge variant={list.type === 'system' ? 'secondary' : 'outline'}>
                              {list.type === 'system' ? 'Automatic' : 'Custom'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatNumber(list.memberCount)}
                          </TableCell>
                          <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                            {formatNumber(list.clientCount)}
                          </TableCell>
                          <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                            {formatNumber(list.externalContactCount)}
                          </TableCell>
                          {caps.create ? (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onCreateCampaign([list.id])}
                                disabled={list.memberCount === 0}
                                title={
                                  list.memberCount === 0
                                    ? 'This group has no members yet'
                                    : undefined
                                }
                              >
                                <Send className="h-3.5 w-3.5" aria-hidden /> New campaign
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Figure({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: 'default' | 'rose';
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
      </p>
      <p
        className={
          tone === 'rose'
            ? 'text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400'
            : 'text-xl font-semibold tabular-nums'
        }
      >
        {value}
      </p>
    </div>
  );
}
