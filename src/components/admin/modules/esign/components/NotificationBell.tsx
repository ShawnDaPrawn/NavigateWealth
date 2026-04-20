/**
 * P5.7 — In-app notification bell for the e-sign dashboard header.
 *
 * Small self-contained component: polls `/esign/me/notifications` on a
 * lightweight interval, renders an unread counter, and surfaces recent
 * items in a popover with "mark read" + "mark all read" controls.
 *
 * The component is intentionally decoupled from any global state — each
 * dashboard mount owns its own polling. When the user clicks an item we
 * call `onOpenEnvelope(envelopeId)` so the parent can navigate; if no
 * handler is supplied the click just marks the notification read.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../ui/popover';
import { ScrollArea } from '../../../../ui/scroll-area';
import { esignApi } from '../api';

const POLL_INTERVAL_MS = 60_000;

type InAppItem = Awaited<ReturnType<typeof esignApi.listInAppNotifications>>['items'][number];

interface NotificationBellProps {
  onOpenEnvelope?: (envelopeId: string) => void;
}

export function NotificationBell({ onOpenEnvelope }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InAppItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await esignApi.listInAppNotifications({ limit: 15 });
      setItems(res.items ?? []);
      setUnread(res.unread ?? 0);
    } catch {
      // Silent — bell is best-effort and should never block the dashboard
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    pollTimer.current = setInterval(() => { void load(); }, POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [load]);

  const markOne = useCallback(async (id: string) => {
    try {
      await esignApi.markInAppNotificationRead(id);
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnread((prev) => Math.max(0, prev - 1));
    } catch { /* best-effort */ }
  }, []);

  const markAll = useCallback(async () => {
    try {
      await esignApi.markAllInAppNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => n.read_at ? n : { ...n, read_at: now }));
      setUnread(0);
    } catch { /* best-effort */ }
  }, []);

  const handleClick = useCallback((item: InAppItem) => {
    if (!item.read_at) void markOne(item.id);
    if (item.envelope_id && onOpenEnvelope) {
      onOpenEnvelope(item.envelope_id);
      setOpen(false);
    }
  }, [markOne, onOpenEnvelope]);

  const relative = useMemo(() => new Intl.RelativeTimeFormat('en', { numeric: 'auto' }), []);
  const formatWhen = useCallback((iso: string): string => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return relative.format(-mins, 'minute');
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return relative.format(-hrs, 'hour');
    const days = Math.round(hrs / 24);
    return relative.format(-days, 'day');
  }, [relative]);

  const unreadLabel = unread > 99 ? '99+' : String(unread);

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) void load();
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative text-gray-500 hover:text-gray-700"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] leading-none flex items-center justify-center"
            >
              {unreadLabel}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            <p className="text-xs text-gray-500">
              {unread > 0 ? `${unread} unread` : 'All caught up'}
            </p>
          </div>
          {items.some((n) => !n.read_at) && (
            <Button variant="ghost" size="sm" onClick={markAll} className="text-xs">
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {loading && items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No notifications yet. You'll see envelope activity here.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((item) => {
                const isRead = !!item.read_at;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(item)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors ${isRead ? 'bg-white' : 'bg-indigo-50/40'}`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${isRead ? 'bg-transparent' : 'bg-indigo-500'}`}
                          aria-hidden="true"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{item.body}</p>
                          <p className="text-[11px] text-gray-400 mt-1">{formatWhen(item.created_at)}</p>
                        </div>
                        {!isRead && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); void markOne(item.id); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                void markOne(item.id);
                              }
                            }}
                            className="text-gray-400 hover:text-gray-600 cursor-pointer"
                            title="Mark as read"
                          >
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
