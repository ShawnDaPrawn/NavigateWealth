import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
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
  AlertCircle,
  CheckCircle,
  Eye,
  Loader2,
  Mail,
  Search,
  Send,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

import { PublicationsAPI } from '../api';
import { useNewsletterSubscribers } from '../hooks/useNewsletterSubscribers';
import type { Article, ArticleReshareResponse } from '../types';
import { formatDate } from '../utils';

interface ArticleReshareDialogProps {
  article: Article;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TargetMode = 'all' | 'selected';

export function ArticleReshareDialog({
  article,
  open,
  onOpenChange,
}: ArticleReshareDialogProps) {
  const [targetMode, setTargetMode] = useState<TargetMode>('selected');
  const [search, setSearch] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [previewResult, setPreviewResult] = useState<ArticleReshareResponse | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const {
    filtered: activeSubscribers,
    isLoading,
  } = useNewsletterSubscribers({ statusFilter: 'active' });

  useEffect(() => {
    if (!open) {
      setSearch('');
      setTargetMode('selected');
      setSelectedEmails(new Set());
      setPreviewResult(null);
      setIsPreviewing(false);
      setIsSending(false);
      setConfirmOpen(false);
    }
  }, [open]);

  const visibleSubscribers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeSubscribers;

    return activeSubscribers.filter((subscriber) =>
      subscriber.email.toLowerCase().includes(query) ||
      subscriber.firstName.toLowerCase().includes(query) ||
      subscriber.surname.toLowerCase().includes(query) ||
      subscriber.name.toLowerCase().includes(query),
    );
  }, [activeSubscribers, search]);

  const selectedCount = selectedEmails.size;
  const canPreview = targetMode === 'all' || selectedCount > 0;

  const toggleRecipient = (email: string) => {
    setSelectedEmails((current) => {
      const next = new Set(current);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
    setPreviewResult(null);
  };

  const selectAllVisible = () => {
    setSelectedEmails(new Set(visibleSubscribers.map((subscriber) => subscriber.email)));
    setPreviewResult(null);
  };

  const clearSelection = () => {
    setSelectedEmails(new Set());
    setPreviewResult(null);
  };

  const buildPayload = () => ({
    dryRun: true,
    targetMode,
    recipientEmails: targetMode === 'selected' ? [...selectedEmails] : [],
  });

  const handlePreview = async () => {
    if (!canPreview) return;

    setIsPreviewing(true);
    setPreviewResult(null);

    try {
      const result = await PublicationsAPI.Articles.reshareArticle(article.id, buildPayload());
      setPreviewResult(result);

      if (result.recipientCount === 0) {
        toast.info('No active newsletter subscribers matched this selection');
      } else {
        toast.success(`Preview ready - ${result.recipientCount} recipient(s)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to preview article reshare';
      toast.error(message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSend = async () => {
    setConfirmOpen(false);
    setIsSending(true);

    try {
      const result = await PublicationsAPI.Articles.reshareArticle(article.id, {
        dryRun: false,
        targetMode,
        recipientEmails: targetMode === 'selected' ? [...selectedEmails] : [],
      });

      if (result.sent > 0) {
        toast.success(`Article reshared to ${result.sent} recipient(s)`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} delivery failure(s) occurred`);
      }

      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reshare article';
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-purple-600" />
              Reshare Published Article
            </DialogTitle>
            <DialogDescription>
              Send the currently published article to all active newsletter subscribers, or target a smaller selection.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-6">
            <Card className="border-purple-200 bg-purple-50/40">
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{article.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {article.excerpt || 'This article will be sent with the standard Navigate Wealth article notification template.'}
                    </p>
                  </div>
                  <Badge className="bg-white text-purple-700 border border-purple-200 shrink-0">
                    Published {article.published_at ? formatDate(article.published_at) : 'recently'}
                  </Badge>
                </div>
                <p className="text-[11px] text-purple-700">
                  This resend uses the current published article on the website, not any unsaved editor changes.
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Choose Audience</CardTitle>
                    <CardDescription className="text-xs">
                      Preview before sending so you can confirm exactly who will receive the resend.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setTargetMode('selected'); setPreviewResult(null); }}
                        className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                          targetMode === 'selected'
                            ? 'border-purple-300 bg-purple-50 text-purple-900'
                            : 'border-gray-200 hover:border-purple-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <UserPlus className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium">Selected subscribers</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Best for resending an older article to one or a few newly-added subscribers.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setTargetMode('all'); setPreviewResult(null); }}
                        className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                          targetMode === 'all'
                            ? 'border-purple-300 bg-purple-50 text-purple-900'
                            : 'border-gray-200 hover:border-purple-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium">All active subscribers</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Resend this article to the full active newsletter audience.
                        </p>
                      </button>
                    </div>

                    {targetMode === 'selected' ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              placeholder="Search active subscribers..."
                              className="pl-9"
                            />
                          </div>
                          <Button variant="outline" size="sm" onClick={selectAllVisible} disabled={visibleSubscribers.length === 0}>
                            Select Visible
                          </Button>
                          <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedCount === 0}>
                            Clear
                          </Button>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{selectedCount} selected</span>
                          <span>{activeSubscribers.length} active subscriber(s)</span>
                        </div>

                        <div className="border rounded-lg overflow-hidden">
                          <div className="max-h-72 overflow-y-auto divide-y">
                            {isLoading ? (
                              <div className="py-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading subscribers...
                              </div>
                            ) : visibleSubscribers.length === 0 ? (
                              <div className="py-8 text-center text-sm text-muted-foreground">
                                No active subscribers match this search.
                              </div>
                            ) : (
                              visibleSubscribers.map((subscriber) => {
                                const checked = selectedEmails.has(subscriber.email);
                                const displayName = subscriber.name || `${subscriber.firstName} ${subscriber.surname}`.trim() || subscriber.email;

                                return (
                                  <label
                                    key={subscriber.email}
                                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                      checked ? 'bg-purple-50/50' : 'hover:bg-gray-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleRecipient(subscriber.email)}
                                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                                      <p className="text-xs text-muted-foreground truncate">{subscriber.email}</p>
                                    </div>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed bg-gray-50 px-4 py-4">
                        <p className="text-sm font-medium text-gray-900">Full audience resend</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          The preview will use all currently active newsletter subscribers.
                        </p>
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white border px-3 py-1.5 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {activeSubscribers.length} active subscriber(s) available
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                {previewResult ? (
                  <Card className="border-blue-200 bg-blue-50/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Eye className="h-4 w-4 text-blue-600" />
                          Preview
                        </CardTitle>
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200">Dry Run</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {previewResult.recipientCount} recipient(s)
                      </div>

                      {previewResult.recipientCount > 0 ? (
                        <div className="border rounded-lg overflow-hidden bg-white">
                          <div className="max-h-72 overflow-y-auto divide-y">
                            {previewResult.recipients.map((recipient) => (
                              <div key={recipient.email} className="px-3 py-2.5">
                                <p className="text-sm text-gray-900 truncate">{recipient.name || recipient.firstName || recipient.email}</p>
                                <p className="text-xs text-muted-foreground truncate">{recipient.email}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed bg-white px-4 py-6 text-center">
                          <AlertCircle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">
                            No active newsletter subscribers matched this resend selection.
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
                        Choose a resend audience, then preview the recipients before sending.
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">How This Works</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      <strong className="text-foreground">Template:</strong> Recipients get the same branded article notification used at publish time.
                    </p>
                    <p>
                      <strong className="text-foreground">Audience:</strong> Only active newsletter subscribers are eligible for resend delivery.
                    </p>
                    <p>
                      <strong className="text-foreground">Safety:</strong> Preview always runs first so you can confirm the exact resend list.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPreviewing || isSending}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handlePreview} disabled={!canPreview || isPreviewing || isSending}>
              {isPreviewing ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-1.5" />
              )}
              Preview Recipients
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => setConfirmOpen(true)}
              disabled={!previewResult || previewResult.recipientCount === 0 || isSending}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              Reshare Article
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-purple-600" />
              Send Article Reshare?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to resend <strong>{article.title}</strong> to{' '}
                <strong>{previewResult?.recipientCount || 0} newsletter subscriber(s)</strong>.
              </p>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs">
                  <strong>Audience:</strong>{' '}
                  {targetMode === 'all' ? 'All active newsletter subscribers' : 'Selected newsletter subscribers only'}
                </p>
              </div>
              <p className="text-xs text-amber-600">
                This sends immediately and cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} className="bg-purple-600 hover:bg-purple-700" disabled={isSending}>
              {isSending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              Confirm & Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
