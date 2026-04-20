/**
 * P5.4 — Webhook management dialog.
 *
 * Three tabs:
 *   1. "Endpoints"   — list of subscriptions with add/edit/rotate/delete.
 *   2. "Recent"      — latest deliveries across all subs, newest first.
 *   3. "Dead letters"— failed deliveries with a one-click replay button.
 *
 * Kept deliberately compact; this is an ops surface for a small number of
 * firms at a time. The only advanced affordance is secret rotation — we
 * never expose the secret after the initial reveal, except on rotate.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Checkbox } from '../../../../ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Badge } from '../../../../ui/badge';
import { ScrollArea } from '../../../../ui/scroll-area';
import { toast } from 'sonner';
import { RefreshCw, Copy, Trash2, RotateCw, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { esignApi } from '../api';
import { logger } from '../../../../../utils/logger';

interface WebhooksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ALL_EVENTS: Array<{ value: string; label: string }> = [
  { value: 'signer.viewed', label: 'Signer viewed' },
  { value: 'signer.signed', label: 'Signer signed' },
  { value: 'signer.declined', label: 'Signer declined' },
  { value: 'envelope.completed', label: 'Envelope completed' },
  { value: 'envelope.expired', label: 'Envelope expired' },
  { value: 'envelope.recalled', label: 'Envelope recalled' },
];

type Subscription = {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
  last_success_at?: string;
  last_failure_at?: string;
  last_failure_message?: string;
};

type Delivery = {
  id: string;
  subscription_id: string;
  event_type: string;
  envelope_id?: string;
  attempts: number;
  status: 'pending' | 'delivered' | 'failed' | 'dead';
  next_attempt_at: string;
  last_attempt_at?: string;
  last_error?: string;
  response_code?: number;
  created_at: string;
  delivered_at?: string;
};

export function WebhooksDialog({ open, onOpenChange }: WebhooksDialogProps) {
  const [tab, setTab] = useState<'endpoints' | 'recent' | 'dlq'>('endpoints');
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deadLetters, setDeadLetters] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>(['envelope.completed']);
  const [newDesc, setNewDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [expandedSecret, setExpandedSecret] = useState<string | null>(null);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [subsRes, deliveriesRes, dlqRes] = await Promise.all([
        esignApi.listWebhookSubscriptions(),
        esignApi.listWebhookDeliveries({ limit: 100 }),
        esignApi.listWebhookDeadLetters(),
      ]);
      setSubs(subsRes.subscriptions as Subscription[]);
      setDeliveries(deliveriesRes.deliveries as Delivery[]);
      setDeadLetters(dlqRes.deliveries as Delivery[]);
    } catch (err) {
      logger.error('Failed to load webhooks:', err);
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleCreate = async () => {
    if (!/^https?:\/\//i.test(newUrl)) {
      toast.error('Enter a valid http(s) URL');
      return;
    }
    if (newEvents.length === 0) {
      toast.error('Select at least one event');
      return;
    }
    setBusy(true);
    try {
      const { subscription } = await esignApi.createWebhookSubscription({
        url: newUrl,
        events: newEvents,
        description: newDesc || undefined,
      });
      toast.success('Webhook created');
      setExpandedSecret(subscription.id);
      setShowAdd(false);
      setNewUrl('');
      setNewEvents(['envelope.completed']);
      setNewDesc('');
      await refresh();
    } catch (err) {
      logger.error('Failed to create webhook:', err);
      toast.error('Failed to create webhook');
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (sub: Subscription) => {
    try {
      await esignApi.updateWebhookSubscription(sub.id, { active: !sub.active });
      await refresh();
    } catch (err) {
      logger.error('Toggle failed:', err);
      toast.error('Failed to toggle subscription');
    }
  };

  const handleRotate = async (sub: Subscription) => {
    if (!confirm('Rotate the signing secret? Existing consumers will need the new value.')) return;
    try {
      await esignApi.rotateWebhookSecret(sub.id);
      setExpandedSecret(sub.id);
      await refresh();
      toast.success('Secret rotated');
    } catch (err) {
      logger.error('Rotate failed:', err);
      toast.error('Failed to rotate secret');
    }
  };

  const handleDelete = async (sub: Subscription) => {
    if (!confirm(`Delete webhook for ${sub.url}?`)) return;
    try {
      await esignApi.deleteWebhookSubscription(sub.id);
      await refresh();
      toast.success('Webhook deleted');
    } catch (err) {
      logger.error('Delete failed:', err);
      toast.error('Failed to delete');
    }
  };

  const handleReplay = async (id: string) => {
    try {
      await esignApi.replayWebhookDelivery(id);
      await refresh();
      toast.success('Delivery queued for retry');
    } catch (err) {
      logger.error('Replay failed:', err);
      toast.error('Failed to replay');
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Copy failed`);
    }
  };

  const renderDeliveries = (items: Delivery[], emptyMsg: string, includeReplay = false) => (
    <ScrollArea className="h-[360px] border rounded-md">
      <div className="divide-y">
        {items.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">{emptyMsg}</p>
        ) : (
          items.map((d) => {
            const expanded = expandedDelivery === d.id;
            return (
              <div key={d.id} className="p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-gray-700">{d.event_type}</code>
                      <Badge
                        variant="outline"
                        className={
                          d.status === 'delivered'
                            ? 'border-green-300 text-green-700 bg-green-50'
                            : d.status === 'dead'
                              ? 'border-red-300 text-red-700 bg-red-50'
                              : d.status === 'failed'
                                ? 'border-amber-300 text-amber-700 bg-amber-50'
                                : 'border-blue-300 text-blue-700 bg-blue-50'
                        }
                      >
                        {d.status}
                      </Badge>
                      {d.response_code ? <span className="text-gray-500">HTTP {d.response_code}</span> : null}
                      <span className="text-gray-400">attempts={d.attempts}</span>
                    </div>
                    <div className="text-gray-500 mt-1">
                      Created {new Date(d.created_at).toLocaleString()}
                      {d.last_attempt_at ? ` · last attempt ${new Date(d.last_attempt_at).toLocaleString()}` : ''}
                    </div>
                    {d.envelope_id ? (
                      <div className="text-gray-500 mt-0.5">Envelope: {d.envelope_id}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    {includeReplay ? (
                      <Button size="sm" variant="outline" onClick={() => handleReplay(d.id)}>
                        <RotateCw className="h-3 w-3 mr-1" /> Replay
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedDelivery(expanded ? null : d.id)}
                    >
                      {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                {expanded && d.last_error ? (
                  <pre className="mt-2 p-2 bg-red-50 text-red-800 rounded text-[11px] whitespace-pre-wrap">
                    {d.last_error}
                  </pre>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Webhooks</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mb-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="endpoints">Endpoints ({subs.length})</TabsTrigger>
              <TabsTrigger value="recent">Recent ({deliveries.length})</TabsTrigger>
              <TabsTrigger value="dlq">
                Dead letters {deadLetters.length > 0 ? `(${deadLetters.length})` : ''}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} className="ml-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          {tab === 'endpoints' && (
            <div className="space-y-3">
              <Button size="sm" variant="outline" onClick={() => setShowAdd((v) => !v)}>
                <Plus className="h-4 w-4 mr-1" /> New endpoint
              </Button>

              {showAdd && (
                <div className="border rounded-md p-3 space-y-2 bg-gray-50">
                  <div className="space-y-1">
                    <Label className="text-xs">Endpoint URL</Label>
                    <Input
                      placeholder="https://api.example.com/hooks/navigate"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description (optional)</Label>
                    <Input
                      placeholder="Shared with ops team"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Events</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {ALL_EVENTS.map((evt) => (
                        <label key={evt.value} className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={newEvents.includes(evt.value)}
                            onCheckedChange={(checked) => {
                              setNewEvents((prev) =>
                                checked ? [...prev, evt.value] : prev.filter((v) => v !== evt.value),
                              );
                            }}
                          />
                          {evt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreate}
                      disabled={busy}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {busy ? 'Creating…' : 'Create'}
                    </Button>
                  </div>
                </div>
              )}

              <ScrollArea className="h-[360px] border rounded-md">
                <div className="divide-y">
                  {subs.length === 0 ? (
                    <p className="p-6 text-center text-sm text-gray-500">No endpoints yet.</p>
                  ) : (
                    subs.map((sub) => (
                      <div key={sub.id} className="p-3 space-y-2 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <code className="text-xs text-gray-700 truncate max-w-[340px]" title={sub.url}>
                                {sub.url}
                              </code>
                              <Badge variant={sub.active ? 'default' : 'outline'} className={sub.active ? 'bg-green-100 text-green-700 border-green-200' : ''}>
                                {sub.active ? 'active' : 'paused'}
                              </Badge>
                            </div>
                            {sub.description ? (
                              <p className="text-xs text-gray-500 mt-0.5">{sub.description}</p>
                            ) : null}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {sub.events.map((e) => (
                                <Badge key={e} variant="outline" className="text-[10px] font-mono">
                                  {e}
                                </Badge>
                              ))}
                            </div>
                            {sub.last_failure_message ? (
                              <p className="text-[11px] text-red-600 mt-1">
                                Last failure: {sub.last_failure_message}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleToggle(sub)} title={sub.active ? 'Pause' : 'Resume'}>
                              {sub.active ? 'Pause' : 'Resume'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleRotate(sub)} title="Rotate secret">
                              <RotateCw className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(sub)} title="Delete">
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        </div>
                        {expandedSecret === sub.id && (
                          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
                            <div className="font-medium text-amber-800 mb-1">
                              Signing secret (save now — won't be shown again by default):
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-[11px] break-all flex-1">{sub.secret}</code>
                              <Button size="sm" variant="outline" onClick={() => handleCopy(sub.secret, 'Secret')}>
                                <Copy className="h-3 w-3 mr-1" /> Copy
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {tab === 'recent' && renderDeliveries(deliveries, 'No deliveries yet.')}
          {tab === 'dlq' && renderDeliveries(deadLetters, 'No dead letters. Healthy inbox.', true)}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
