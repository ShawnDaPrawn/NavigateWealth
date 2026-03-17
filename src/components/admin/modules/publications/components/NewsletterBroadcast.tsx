/**
 * Newsletter Broadcast — Compose & Send
 *
 * Admin UI for composing a newsletter and broadcasting it to all active,
 * confirmed subscribers. Follows the dry-run-first pattern (§14.1).
 *
 * Guidelines:
 *   §7    — Presentation layer only
 *   §8.3  — Status colour vocabulary, stat card standards
 *   §8.4  — Platform constraints (sonner@2.0.3)
 *   §14.1 — Dry-run-first pattern for batch operations
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Skeleton } from '../../../../ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import {
  Send,
  Eye,
  Loader2,
  CheckCircle,
  XCircle,
  Users,
  Mail,
  Clock,
  FileText,
  History,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  MailCheck,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { createClient } from '../../../../../utils/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

interface BroadcastRecipient {
  email: string;
  firstName: string;
  surname: string;
}

interface BroadcastResult {
  success: boolean;
  dryRun: boolean;
  message: string;
  recipientCount: number;
  sent: number;
  failed: number;
  errors?: string[];
  recipients: BroadcastRecipient[];
  broadcastId?: string;
}

interface BroadcastRecord {
  id: string;
  subject: string;
  bodySnippet: string;
  recipientCount: number;
  sent: number;
  failed: number;
  sentAt: string;
}

type View = 'compose' | 'history';

// ============================================================================
// API HELPERS
// ============================================================================

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/newsletter`;

async function getAuthToken(): Promise<string> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) return data.session.access_token;
  } catch { /* fall through */ }
  return publicAnonKey;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.details || `Request failed (${res.status})`);
  return data;
}

// ============================================================================
// UTILITY
// ============================================================================

function formatDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function NewsletterBroadcast() {
  const [view, setView] = useState<View>('compose');

  // ── Compose state ──────────────────────────────────────────────────────
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [previewResult, setPreviewResult] = useState<BroadcastResult | null>(null);
  const [sendResult, setSendResult] = useState<BroadcastResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── History state ──────────────────────────────────────────────────────
  const [broadcasts, setBroadcasts] = useState<BroadcastRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Validation ─────────────────────────────────────────────────────────
  const canPreview = subject.trim().length >= 3 && body.trim().length >= 10;

  // ── Load broadcast history ─────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await apiFetch('/admin/broadcasts');
      setBroadcasts(data.broadcasts || []);
    } catch (err) {
      console.error('Failed to load broadcast history:', err);
      toast.error('Failed to load broadcast history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'history') loadHistory();
  }, [view, loadHistory]);

  // ── Preview (dry run) ──────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!canPreview) return;
    setIsPreviewing(true);
    setPreviewResult(null);
    setSendResult(null);

    try {
      const data = await apiFetch('/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), dryRun: true }),
      });
      setPreviewResult(data);

      if (data.recipientCount === 0) {
        toast.info('No active subscribers to send to');
      } else {
        toast.success(`Preview ready — ${data.recipientCount} recipient(s)`);
      }
    } catch (err) {
      console.error('Preview failed:', err);
      toast.error(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setIsPreviewing(false);
    }
  };

  // ── Send (live) ────────────────────────────────────────────────────────
  const handleSend = async () => {
    setConfirmOpen(false);
    setIsSending(true);
    setSendResult(null);

    try {
      const data = await apiFetch('/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), dryRun: false }),
      });
      setSendResult(data);

      if (data.sent > 0) {
        toast.success(`Newsletter sent to ${data.sent} subscriber(s)`);
      }
      if (data.failed > 0) {
        toast.error(`${data.failed} delivery failure(s)`);
      }
    } catch (err) {
      console.error('Broadcast failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send newsletter');
    } finally {
      setIsSending(false);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────
  const handleReset = () => {
    setSubject('');
    setBody('');
    setPreviewResult(null);
    setSendResult(null);
  };

  // ── Send test email to the current admin ──────────────────────────────
  const handleSendTest = async () => {
    if (!canPreview) return;
    setIsSendingTest(true);
    try {
      // Resolve the admin's email from the current session
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const adminEmail = sessionData?.session?.user?.email;
      if (!adminEmail) {
        toast.error('Could not determine your email address. Please sign in again.');
        return;
      }

      await apiFetch('/admin/broadcast/test', {
        method: 'POST',
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          testEmail: adminEmail,
        }),
      });
      toast.success(`Test email sent to ${adminEmail}`);
    } catch (err) {
      console.error('Test send failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send test email');
    } finally {
      setIsSendingTest(false);
    }
  };

  // ── Resend: load a previous broadcast into the compose view ───────────
  const handleResend = (broadcast: BroadcastRecord) => {
    setSubject(broadcast.subject);
    setBody(broadcast.bodySnippet);
    setPreviewResult(null);
    setSendResult(null);
    setView('compose');
    toast.info('Broadcast loaded into composer — review and send when ready');
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Newsletter Broadcast</h3>
          <p className="text-sm text-muted-foreground">
            Compose and send a newsletter to all active subscribers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={view === 'compose' ? 'default' : 'outline'}
            onClick={() => setView('compose')}
            className={view === 'compose' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Compose
          </Button>
          <Button
            size="sm"
            variant={view === 'history' ? 'default' : 'outline'}
            onClick={() => setView('history')}
            className={view === 'history' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          >
            <History className="h-3.5 w-3.5 mr-1.5" />
            History
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* COMPOSE VIEW                                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {view === 'compose' && (
        <div className="contents">
          {/* Post-send result banner */}
          {sendResult && (
            <Card className={sendResult.failed > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-green-200 bg-green-50/50'}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-md ${sendResult.failed > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
                    {sendResult.failed > 0 ? (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${sendResult.failed > 0 ? 'text-amber-900' : 'text-green-900'}`}>
                      {sendResult.message}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" /> {sendResult.sent} sent
                      </span>
                      {sendResult.failed > 0 && (
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3 text-red-500" /> {sendResult.failed} failed
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {sendResult.recipientCount} total
                      </span>
                    </div>
                    {sendResult.errors && sendResult.errors.length > 0 && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700 space-y-0.5">
                        {sendResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                      </div>
                    )}
                    <Button size="sm" variant="outline" className="mt-3" onClick={handleReset}>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Compose Another
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compose form */}
          {!sendResult && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Compose */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mail className="h-4 w-4 text-purple-500" />
                      Compose Newsletter
                    </CardTitle>
                    <CardDescription className="text-xs">
                      The email will be sent using the Navigate Wealth branded template with a personalised greeting for each subscriber.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="broadcast-subject">
                        Subject Line <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="broadcast-subject"
                        value={subject}
                        onChange={(e) => { setSubject(e.target.value); setPreviewResult(null); }}
                        placeholder="e.g. March 2026 Market Update"
                        disabled={isSending}
                      />
                      {subject.length > 0 && subject.trim().length < 3 && (
                        <p className="text-xs text-red-500">Minimum 3 characters</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="broadcast-body">
                        Body Content <span className="text-red-500">*</span>
                      </Label>
                      <p className="text-[11px] text-muted-foreground -mt-1">
                        You can use basic HTML tags for formatting: {'<p>'}, {'<strong>'}, {'<em>'}, {'<ul>'}, {'<li>'}, {'<a href="...">'}.
                      </p>
                      <Textarea
                        id="broadcast-body"
                        value={body}
                        onChange={(e) => { setBody(e.target.value); setPreviewResult(null); }}
                        placeholder={"<p>Dear subscribers,</p>\n<p>Here's what's been happening at Navigate Wealth this month...</p>"}
                        rows={12}
                        className="font-mono text-sm"
                        disabled={isSending}
                      />
                      {body.length > 0 && body.trim().length < 10 && (
                        <p className="text-xs text-red-500">Minimum 10 characters</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        onClick={handlePreview}
                        disabled={!canPreview || isPreviewing || isSending}
                        variant="outline"
                      >
                        {isPreviewing ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4 mr-1.5" />
                        )}
                        Preview Recipients
                      </Button>

                      <Button
                        onClick={handleSendTest}
                        disabled={!canPreview || isSendingTest || isSending}
                        variant="outline"
                        className="border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        {isSendingTest ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <MailCheck className="h-4 w-4 mr-1.5" />
                        )}
                        Send Test to Me
                      </Button>

                      <Button
                        onClick={() => setConfirmOpen(true)}
                        disabled={!previewResult || previewResult.recipientCount === 0 || isSending}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-1.5" />
                        )}
                        Send Newsletter
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Preview panel */}
              <div className="space-y-4">
                {/* Preview result */}
                {previewResult ? (
                  <Card className="border-blue-200 bg-blue-50/30">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Eye className="h-4 w-4 text-blue-500" />
                          Preview
                        </CardTitle>
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
                          Dry Run
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{previewResult.recipientCount} recipient(s)</span>
                      </div>

                      {previewResult.recipientCount > 0 && (
                        <div className="border rounded-lg overflow-hidden bg-white">
                          <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b bg-muted/40">
                                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Name</th>
                                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Email</th>
                                </tr>
                              </thead>
                              <tbody>
                                {previewResult.recipients.map((r) => (
                                  <tr key={r.email} className="border-b last:border-0">
                                    <td className="py-1.5 px-3 text-foreground">
                                      {r.firstName || r.surname
                                        ? `${r.firstName} ${r.surname}`.trim()
                                        : <span className="text-muted-foreground/40">—</span>}
                                    </td>
                                    <td className="py-1.5 px-3 text-muted-foreground">{r.email}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground bg-muted/20">
                            {previewResult.recipientCount} subscriber(s) will receive this newsletter
                          </div>
                        </div>
                      )}

                      {previewResult.recipientCount === 0 && (
                        <div className="text-center py-4">
                          <AlertCircle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">
                            No active, confirmed subscribers found. Add subscribers first.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                      <Eye className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No preview yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Write your newsletter, then click "Preview Recipients" to see who will receive it.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Tips card */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">Tips</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      <strong className="text-foreground">Personalisation:</strong> Each email includes a personalised "Hi [Name]" greeting.
                    </p>
                    <p>
                      <strong className="text-foreground">Branding:</strong> Emails use the Navigate Wealth branded template automatically.
                    </p>
                    <p>
                      <strong className="text-foreground">Unsubscribe:</strong> Each email includes a unique unsubscribe link in the footer.
                    </p>
                    <p>
                      <strong className="text-foreground">Audit:</strong> Every broadcast is logged with recipient count, success/failure stats, and timestamp.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* HISTORY VIEW                                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {view === 'history' && (
        <div className="contents">
          {historyLoading ? (
            <Card>
              <CardContent className="pt-4 pb-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : broadcasts.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium text-sm">No broadcasts yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sent newsletters will appear here for audit and reference.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setView('compose')}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Compose First Newsletter
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left py-2.5 px-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Subject</th>
                      <th className="text-left py-2.5 px-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Recipients</th>
                      <th className="text-left py-2.5 px-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Sent</th>
                      <th className="text-left py-2.5 px-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Failed</th>
                      <th className="text-left py-2.5 px-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="text-right py-2.5 px-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadcasts.map((b) => (
                      <tr key={b.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-4">
                          <div>
                            <p className="font-medium text-foreground truncate max-w-xs">{b.subject}</p>
                            {b.bodySnippet && (
                              <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
                                {b.bodySnippet.replace(/<[^>]*>/g, '').substring(0, 80)}...
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {b.recipientCount}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle className="h-3 w-3" /> {b.sent}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          {b.failed > 0 ? (
                            <span className="flex items-center gap-1 text-red-600 text-xs">
                              <XCircle className="h-3 w-3" /> {b.failed}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground">
                          {formatDate(b.sentAt)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleResend(b)}
                            title="Load into composer to resend"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Resend
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t px-4 py-2.5 text-xs text-muted-foreground bg-muted/20">
                {broadcasts.length} broadcast(s) on record
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SEND CONFIRMATION DIALOG                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-purple-500" />
              Send Newsletter?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to send this newsletter to <strong>{previewResult?.recipientCount || 0} active subscriber(s)</strong>.</p>
              <div className="bg-muted/50 rounded-lg p-3 mt-2 space-y-1">
                <p className="text-xs">
                  <strong>Subject:</strong> {subject}
                </p>
                <p className="text-xs text-muted-foreground">
                  {body.replace(/<[^>]*>/g, '').substring(0, 120)}...
                </p>
              </div>
              <p className="text-xs text-amber-600 mt-2">
                This action cannot be undone. Emails will be delivered immediately.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSend}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Send className="h-4 w-4 mr-1.5" />
              Confirm & Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}