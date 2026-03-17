/**
 * Newsletter KPI Card — Dashboard widget.
 *
 * Shows subscriber count, broadcast activity, and last-send recency.
 * Redesigned to match the established card header pattern (§8.3, §8.4):
 *   - White card background with consistent CardHeader + CardDescription
 *   - bg-gray-50 icon container with rounded corners
 *   - Large bold number, small muted description text
 *   - Status indicator for "last broadcast" recency
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Skeleton } from '../../../../ui/skeleton';
import { Mail, Send, Users, Calendar, TrendingUp } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { createClient } from '../../../../../utils/supabase/client';

interface NewsletterStats {
  activeSubscribers: number;
  totalBroadcasts: number;
  broadcastsThisMonth: number;
  lastBroadcastAt: string | null;
}

async function fetchNewsletterStats(): Promise<NewsletterStats | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return null;

    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/newsletter/admin/stats`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const json = await res.json();
    if (json.success) return json.data;
  } catch (err) {
    console.error('Failed to fetch newsletter stats:', err);
  }
  return null;
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function LastBroadcastBadge({ iso }: { iso: string }) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days > 30) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-4 text-amber-700 border-amber-300 bg-amber-50">
        Overdue
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-4 text-green-700 border-green-300 bg-green-50">
      Recent
    </Badge>
  );
}

export function NewsletterKPICard() {
  const [stats, setStats] = useState<NewsletterStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNewsletterStats().then(s => {
      setStats(s);
      setLoading(false);
    });
  }, []);

  const primaryStats = [
    {
      label: 'Subscribers',
      value: stats?.activeSubscribers ?? 0,
      icon: Users,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      label: 'Total Sent',
      value: stats?.totalBroadcasts ?? 0,
      icon: Send,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'This Month',
      value: stats?.broadcastsThisMonth ?? 0,
      icon: TrendingUp,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="p-1.5 bg-purple-50 rounded-lg">
              <Mail className="h-4 w-4 text-purple-600" />
            </div>
            Newsletter
          </CardTitle>
          {!loading && stats?.lastBroadcastAt && (
            <LastBroadcastBadge iso={stats.lastBroadcastAt} />
          )}
        </div>
        <CardDescription>Subscriber &amp; broadcast overview</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Primary stat row */}
        <div className="grid grid-cols-3 gap-3">
          {primaryStats.map((item) => (
            <div key={item.label} className="rounded-lg bg-gray-50 p-3 text-center">
              <div className={`inline-flex p-1.5 rounded-md ${item.iconBg} mb-2`}>
                <item.icon className={`h-3.5 w-3.5 ${item.iconColor}`} />
              </div>
              {loading ? (
                <Skeleton className="h-6 w-10 mx-auto mb-1" />
              ) : (
                <p className="text-xl font-bold leading-tight">{item.value}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Last broadcast row */}
        <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5">
          <div className="p-1.5 rounded-md bg-white border border-gray-100">
            <Calendar className="h-3.5 w-3.5 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700">Last broadcast</p>
            {loading ? (
              <Skeleton className="h-3.5 w-20 mt-0.5" />
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats?.lastBroadcastAt ? formatRelativeDate(stats.lastBroadcastAt) : 'No broadcasts yet'}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}