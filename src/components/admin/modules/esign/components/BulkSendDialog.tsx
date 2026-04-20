/**
 * P4.7 — Bulk Send Dialog.
 *
 * Lets a sender fan a single template + document out to N recipients
 * by uploading a CSV. The dispatch loop runs entirely on the client:
 *   1. POST /esign/campaigns → server persists the row plan + status
 *   2. For each row:
 *        a. POST /esign/envelopes/upload (with templateId + version)
 *        b. POST /esign/envelopes/:id/invites
 *        c. POST /esign/campaigns/:id/results/:rowId (status report)
 * The campaign record is the single source of truth for progress.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { Input } from '../../../../ui/input';
import { Textarea } from '../../../../ui/textarea';
import { ScrollArea } from '../../../../ui/scroll-area';
import { Badge } from '../../../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Loader2,
  Upload,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Send,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { esignApi } from '../api';
import type { EsignTemplateRecord, CampaignRecord, CampaignRecipientResult } from '../types';
import { logger } from '../../../../../utils/logger';

interface BulkSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional pre-selected template (e.g. when launched from the
   *  TemplateLibrary card menu). */
  initialTemplate?: EsignTemplateRecord | null;
  /** Called once the campaign finishes dispatching so the parent can
   *  refresh dashboard counters. */
  onCompleted?: (campaign: CampaignRecord) => void;
}

export function BulkSendDialog({ open, onOpenChange, initialTemplate, onCompleted }: BulkSendDialogProps) {
  const [templates, setTemplates] = useState<EsignTemplateRecord[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(initialTemplate?.id ?? null);
  const [csvText, setCsvText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState(initialTemplate?.name ?? '');
  const [message, setMessage] = useState(initialTemplate?.defaultMessage ?? '');
  const [expiryDays, setExpiryDays] = useState<number>(initialTemplate?.defaultExpiryDays ?? 30);
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [phase, setPhase] = useState<'compose' | 'dispatching' | 'done'>('compose');

  useEffect(() => {
    if (!open) return;
    setLoadingTemplates(true);
    esignApi
      .listTemplates()
      .then(r => {
        setTemplates(r.templates || []);
        if (initialTemplate?.id && !r.templates?.some(t => t.id === initialTemplate.id)) {
          setTemplates(prev => [initialTemplate, ...prev]);
        }
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, [open, initialTemplate]);

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === selectedTemplateId) ?? initialTemplate ?? null,
    [templates, selectedTemplateId, initialTemplate],
  );

  const recipientCount = selectedTemplate?.recipients.length ?? 0;
  const csvRowCount = useMemo(() => {
    const trimmed = csvText.trim();
    if (!trimmed) return 0;
    const lines = trimmed.split(/\r?\n/).filter(l => l.trim().length > 0);
    return Math.max(0, lines.length - 1);
  }, [csvText]);

  const csvHeadersHint = useMemo(() => {
    if (!selectedTemplate) return '';
    if (recipientCount === 1) return 'email,name,role';
    return selectedTemplate.recipients
      .map((r, i) => {
        const slug = (r.name || `recipient_${i + 1}`).toLowerCase().replace(/\s+/g, '_');
        return `${slug}_email,${slug}_name`;
      })
      .join(',');
  }, [selectedTemplate, recipientCount]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    setFiles(list);
    if (!title && list[0]) setTitle(list[0].name.replace(/\.pdf$/i, ''));
  };

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  };

  const handleStart = async () => {
    if (!selectedTemplate) {
      toast.error('Pick a template first.');
      return;
    }
    if (files.length === 0) {
      toast.error('Upload a document for the campaign.');
      return;
    }
    if (csvText.trim().length === 0) {
      toast.error('Paste a CSV or upload a file.');
      return;
    }
    if (!title.trim()) {
      toast.error('Give the campaign a title.');
      return;
    }

    try {
      setPhase('dispatching');
      const created = await esignApi.createCampaign({
        templateId: selectedTemplate.id,
        templateVersion: selectedTemplate.version,
        title: title.trim(),
        message: message.trim() || undefined,
        expiryDays,
        csvText,
      });
      setCampaign(created.campaign);
      setWarnings(created.warnings || []);

      // Walk through queued rows in series. Series (not parallel)
      // keeps the rate limiter happy and surfaces errors row-by-row
      // so the operator can intervene if invites start failing.
      let working = created.campaign;
      for (const row of created.campaign.results) {
        if (row.status !== 'queued') continue;
        try {
          // Materialise an envelope for this row by uploading the
          // shared document and pinning it to the template snapshot.
          const upload = await esignApi.uploadDocument({
            files,
            context: {
              title: created.campaign.title,
              message: created.campaign.message,
              expiryDays: created.campaign.expiryDays,
              expiresAt: new Date(
                Date.now() + created.campaign.expiryDays * 24 * 60 * 60 * 1000,
              ).toISOString(),
              templateId: created.campaign.templateId,
              templateVersion: created.campaign.templateVersion,
              campaignId: created.campaign.id,
            },
          });
          const envelopeId = upload.envelope?.id;
          if (!envelopeId) throw new Error('Upload did not return an envelope id');

          // Persist signers as a draft, then send invites with the
          // template's field positions resolved per-recipient.
          await esignApi.saveDraftSigners(envelopeId, row.signers.map((s, idx) => ({
            name: s.name,
            email: s.email,
            role: s.role || 'Signer',
            order: s.order ?? idx + 1,
          })));

          const fields = selectedTemplate.fields
            .map((tf, idx) => {
              const recipient = row.signers[tf.recipientIndex];
              if (!recipient) return null;
              return {
                id: `${envelopeId}:tpl:${idx}`,
                envelope_id: envelopeId,
                signer_id: recipient.email,
                signerIndex: tf.recipientIndex,
                type: tf.type,
                page: tf.page,
                x: tf.x,
                y: tf.y,
                width: tf.width,
                height: tf.height,
                required: tf.required,
                metadata: tf.metadata ?? {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            })
            .filter((f): f is NonNullable<typeof f> => f !== null);

          await esignApi.sendInvites(envelopeId, {
            signers: row.signers.map((s, idx) => ({
              name: s.name,
              email: s.email,
              role: s.role,
              order: s.order ?? idx + 1,
              requiresOtp: false,
            })),
            fields,
            message: created.campaign.message,
            expiryDays: created.campaign.expiryDays,
          });

          const updated = await esignApi.recordCampaignRowResult(created.campaign.id, row.rowId, {
            status: 'sent',
            envelopeId,
          });
          working = updated.campaign;
          setCampaign(updated.campaign);
        } catch (err) {
          logger.error('Campaign row failed', { rowId: row.rowId, err });
          const updated = await esignApi.recordCampaignRowResult(created.campaign.id, row.rowId, {
            status: 'failed',
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
          });
          working = updated.campaign;
          setCampaign(updated.campaign);
        }
      }

      setPhase('done');
      onCompleted?.(working);
      toast.success(
        `Campaign finished — ${working.sentCount} sent, ${working.failedCount} failed.`,
      );
    } catch (error: unknown) {
      logger.error('Failed to start campaign:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start campaign');
      setPhase('compose');
    }
  };

  const handleClose = () => {
    if (phase === 'dispatching') {
      toast.info('Cancel the campaign first to close while sending.');
      return;
    }
    setPhase('compose');
    setCampaign(null);
    setWarnings([]);
    setCsvText('');
    setFiles([]);
    onOpenChange(false);
  };

  const handleCancel = async () => {
    if (!campaign) return;
    try {
      const result = await esignApi.cancelCampaign(campaign.id);
      setCampaign(result.campaign);
      setPhase('done');
      toast.success('Campaign cancelled. In-flight envelopes are unaffected.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-[720px] max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-purple-600" />
            Bulk send from template
          </DialogTitle>
          <DialogDescription>
            Send the same template to many recipients in one go. Each row in the CSV becomes its own envelope.
          </DialogDescription>
        </DialogHeader>

        {phase === 'compose' && (
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select
                  value={selectedTemplateId ?? ''}
                  onValueChange={(v) => setSelectedTemplateId(v)}
                  disabled={loadingTemplates}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingTemplates ? 'Loading templates…' : 'Choose a template'} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} {t.category ? `· ${t.category}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">v{selectedTemplate.version}</Badge>
                    <span className="flex items-center gap-0.5">
                      <Users className="h-3 w-3" />
                      {recipientCount} recipient slot{recipientCount === 1 ? '' : 's'}
                    </span>
                    <span>·</span>
                    <span>{selectedTemplate.fields.length} fields placed</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Document(s)</Label>
                <Input type="file" accept="application/pdf" multiple onChange={handleFileChange} />
                {files.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {files.length} file(s) selected — same document will be sent to every recipient.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Campaign title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q3 ROA renewals" />
                </div>
                <div className="space-y-2">
                  <Label>Expiry (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Math.max(1, parseInt(e.target.value, 10) || 30))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email message (optional)</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[64px]"
                  placeholder="Sent to every recipient as the invitation body."
                />
              </div>

              <div className="space-y-2">
                <Label>Recipients (CSV)</Label>
                <div className="flex items-center gap-2 text-xs">
                  <Input type="file" accept=".csv,text/csv" onChange={handleCsvFile} className="flex-1" />
                  <Badge variant="outline">{csvRowCount} row{csvRowCount === 1 ? '' : 's'}</Badge>
                </div>
                {csvHeadersHint && (
                  <p className="text-[11px] text-muted-foreground">
                    Expected headers: <code className="font-mono">{csvHeadersHint}</code>
                  </p>
                )}
                <Textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="min-h-[120px] font-mono text-xs"
                  placeholder="Paste CSV here or upload a file above"
                />
              </div>
            </div>
          </ScrollArea>
        )}

        {(phase === 'dispatching' || phase === 'done') && campaign && (
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-3 py-2">
              <div className="rounded-md border bg-gray-50 p-3 text-sm flex items-center gap-3">
                {phase === 'dispatching' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                ) : campaign.failedCount > 0 ? (
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{campaign.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.sentCount} sent · {campaign.failedCount} failed ·{' '}
                    {campaign.results.length} total
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {campaign.status}
                </Badge>
              </div>

              {warnings.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs space-y-1">
                  <p className="font-medium text-amber-800 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> CSV warnings
                  </p>
                  <ul className="list-disc pl-4 text-amber-700">
                    {warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                    {warnings.length > 5 && <li>+ {warnings.length - 5} more…</li>}
                  </ul>
                </div>
              )}

              <div className="space-y-1.5">
                {campaign.results.map((row: CampaignRecipientResult) => (
                  <div
                    key={row.rowId}
                    className="flex items-center gap-2 text-xs border rounded-md px-2 py-1.5"
                  >
                    {row.status === 'sent' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                    {row.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-red-600" />}
                    {row.status === 'queued' && <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />}
                    {row.status === 'cancelled' && <XCircle className="h-3.5 w-3.5 text-gray-400" />}
                    <span className="font-medium flex-1 truncate">
                      {row.signers.map(s => s.email).join(', ')}
                    </span>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {row.status}
                    </Badge>
                    {row.errorMessage && (
                      <span className="text-red-600 truncate max-w-[180px]" title={row.errorMessage}>
                        {row.errorMessage}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="border-t pt-3">
          {phase === 'compose' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleStart}
                className="bg-purple-600 hover:bg-purple-700"
                disabled={!selectedTemplate || files.length === 0 || csvRowCount === 0}
              >
                <Upload className="h-4 w-4 mr-2" />
                Send {csvRowCount > 0 ? `${csvRowCount} ` : ''}envelope{csvRowCount === 1 ? '' : 's'}
              </Button>
            </>
          )}
          {phase === 'dispatching' && (
            <Button variant="outline" onClick={handleCancel} className="text-red-600 hover:text-red-700">
              Cancel remaining rows
            </Button>
          )}
          {phase === 'done' && (
            <Button onClick={handleClose} className="bg-purple-600 hover:bg-purple-700">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
