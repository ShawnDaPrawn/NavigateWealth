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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
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
  Download,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { esignApi } from '../api';
import type { EsignTemplateRecord, CampaignRecord, CampaignRecipientResult } from '../types';
import { logger } from '../../../../../utils/logger';
import { communicationApi } from '../../communication/api';
import type { Client, ClientGroup } from '../../communication/types';

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
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(initialTemplate?.id ?? null);
  const [sourceMode, setSourceMode] = useState<'group' | 'csv'>('group');
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
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
    setLoadingGroups(true);
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

    Promise.all([communicationApi.getGroups(1, 200), communicationApi.getClients()])
      .then(([groupList, clientList]) => {
        setGroups(groupList || []);
        setClients(clientList || []);
      })
      .catch(() => {
        setGroups([]);
        setClients([]);
      })
      .finally(() => setLoadingGroups(false));
  }, [open, initialTemplate]);

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === selectedTemplateId) ?? initialTemplate ?? null,
    [templates, selectedTemplateId, initialTemplate],
  );
  const templateHasSavedDocuments = useMemo(
    () => Boolean(selectedTemplate?.documents?.length),
    [selectedTemplate],
  );

  useEffect(() => {
    if (templateHasSavedDocuments) {
      setFiles([]);
    }
  }, [templateHasSavedDocuments]);

  const recipientCount = selectedTemplate?.recipients.length ?? 0;
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const groupRecipients = useMemo(() => {
    if (!selectedGroup) return [];

    const clientMap = new Map(clients.map((client) => [client.id, client]));
    const clientMembers = (selectedGroup.clientIds || [])
      .map((clientId) => clientMap.get(clientId))
      .filter((client): client is Client => Boolean(client))
      .map((client) => ({
        id: client.id,
        name: getClientDisplayName(client),
        email: client.email?.trim() || '',
        source: 'client' as const,
      }));

    const externalMembers = (selectedGroup.externalContacts || []).map((contact, index) => ({
      id: `external-${index}-${contact.email}`,
      name: contact.name?.trim() || contact.email,
      email: contact.email?.trim() || '',
      source: 'external' as const,
    }));

    return [...clientMembers, ...externalMembers];
  }, [selectedGroup, clients]);

  const templateHasDefaultEmailsForAdditionalRecipients = useMemo(() => {
    if (!selectedTemplate) return false;
    if (selectedTemplate.recipients.length <= 1) return true;
    return selectedTemplate.recipients.slice(1).every((recipient) => Boolean(recipient.email?.trim()));
  }, [selectedTemplate]);

  const groupRows = useMemo(() => {
    if (!selectedTemplate || !selectedGroup) return [];

    return groupRecipients
      .filter((recipient) => recipient.email)
      .map((recipient, index) => ({
        rowId: `group-${selectedGroup.id}-${index + 1}`,
        signers: selectedTemplate.recipients.map((templateRecipient, recipientIndex) => {
          if (recipientIndex === 0) {
            return {
              name: recipient.name || templateRecipient.name || 'Client',
              email: recipient.email,
              role: templateRecipient.role,
              order: templateRecipient.order ?? recipientIndex + 1,
            };
          }

          return {
            name: templateRecipient.name || `Recipient ${recipientIndex + 1}`,
            email: templateRecipient.email || '',
            role: templateRecipient.role,
            order: templateRecipient.order ?? recipientIndex + 1,
          };
        }),
      }))
      .filter((row) => row.signers.every((signer) => signer.email));
  }, [selectedTemplate, selectedGroup, groupRecipients]);

  const groupWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (selectedGroup && recipientCount > 1 && !templateHasDefaultEmailsForAdditionalRecipients) {
      warnings.push(
        'This template has multiple recipient slots. Group send can only fill the first slot unless the remaining slots already have default email addresses saved on the template.',
      );
    }

    groupRecipients.forEach((recipient) => {
      if (!recipient.email) {
        warnings.push(`${recipient.name || 'Unnamed recipient'} has no email address and will be skipped.`);
      }
    });

    return warnings;
  }, [selectedGroup, recipientCount, templateHasDefaultEmailsForAdditionalRecipients, groupRecipients]);

  const groupRowCount = groupRows.length;
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
      .map((r, i) => [
        `email_${i + 1}`,
        `name_${i + 1}`,
        `role_${i + 1}`,
        `${(r.name || `recipient_${i + 1}`).toLowerCase().replace(/\s+/g, '_')}_email`,
        `${(r.name || `recipient_${i + 1}`).toLowerCase().replace(/\s+/g, '_')}_name`,
      ].join(' / '))
      .join(' | ');
  }, [selectedTemplate, recipientCount]);

  const csvTemplateText = useMemo(() => {
    if (!selectedTemplate) return '';
    const headers =
      recipientCount <= 1
        ? ['email', 'name', 'role']
        : selectedTemplate.recipients.flatMap((recipient, index) => [
            `email_${index + 1}`,
            `name_${index + 1}`,
            `role_${index + 1}`,
          ]);

    const sampleRow =
      recipientCount <= 1
        ? [
            'client@example.com',
            selectedTemplate.recipients[0]?.name || 'Client Name',
            selectedTemplate.recipients[0]?.role || 'Signer',
          ]
        : selectedTemplate.recipients.flatMap((recipient, index) => [
            `${(recipient.name || `recipient_${index + 1}`).toLowerCase().replace(/\s+/g, '_')}@example.com`,
            recipient.name || `Recipient ${index + 1}`,
            recipient.role || 'Signer',
          ]);

    return `${headers.join(',')}\n${sampleRow.join(',')}`;
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

  const handleDownloadCsvTemplate = () => {
    if (!csvTemplateText) {
      toast.error('Pick a template first to generate a matching CSV template.');
      return;
    }

    const blob = new Blob([csvTemplateText], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `esign-bulk-send-template-${selectedTemplate?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'template'}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleStart = async () => {
    if (!selectedTemplate) {
      toast.error('Pick a template first.');
      return;
    }
    if (!templateHasSavedDocuments && files.length === 0) {
      toast.error('Upload a document for this legacy template, or re-save the template with its source PDF.');
      return;
    }
    if (!title.trim()) {
      toast.error('Give the campaign a title.');
      return;
    }

    if (sourceMode === 'group') {
      if (!selectedGroup) {
        toast.error('Choose a client group first.');
        return;
      }
      if (groupWarnings.length > 0 && groupRows.length === 0) {
        toast.error(groupWarnings[0]);
        return;
      }
      if (groupRowCount === 0) {
        toast.error('No usable recipients were found in the selected group.');
        return;
      }
    }

    if (sourceMode === 'csv' && csvText.trim().length === 0) {
      toast.error('Paste a CSV or upload a file.');
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
        ...(sourceMode === 'group'
          ? { rows: groupRows }
          : { csvText }),
      });
      setCampaign(created.campaign);
      setWarnings(sourceMode === 'group' ? groupWarnings : (created.warnings || []));

      // Walk through queued rows in series. Series (not parallel)
      // keeps the rate limiter happy and surfaces errors row-by-row
      // so the operator can intervene if invites start failing.
      let working = created.campaign;
      for (const row of created.campaign.results) {
        if (row.status !== 'queued') continue;
        try {
          const draft = templateHasSavedDocuments
            ? await esignApi.materialiseTemplateDraft({
                templateId: created.campaign.templateId,
                title: created.campaign.title,
                message: created.campaign.message,
                expiryDays: created.campaign.expiryDays,
                campaignId: created.campaign.id,
              })
            : null;
          const upload = !templateHasSavedDocuments
            ? await esignApi.uploadDocument({
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
              })
            : null;
          const envelopeId = draft?.envelope?.id || upload?.envelope?.id;
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
                document_id:
                  (tf.documentId && draft?.documentMap?.[tf.documentId]) ||
                  draft?.envelope?.document_id ||
                  upload?.envelope?.document_id,
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
    setSourceMode('group');
    setSelectedGroupId('');
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
            Send the same template to many recipients in one go. Start with an existing client group, or use CSV when you need a custom recipient list.
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

              <div className="space-y-3">
                <Label>Recipient source</Label>
                <Tabs value={sourceMode} onValueChange={(value) => setSourceMode(value as 'group' | 'csv')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="group">Client Groups</TabsTrigger>
                    <TabsTrigger value="csv">CSV Import</TabsTrigger>
                  </TabsList>

                  <TabsContent value="group" className="mt-3 space-y-3 rounded-lg border border-gray-200 p-4">
                    <div className="space-y-2">
                      <Label>Select group</Label>
                      <Select
                        value={selectedGroupId}
                        onValueChange={setSelectedGroupId}
                        disabled={loadingGroups}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingGroups ? 'Loading client groups…' : 'Choose a predefined client group'} />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name} · {group.clientCount} member{group.clientCount === 1 ? '' : 's'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedGroup && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{selectedGroup.name}</Badge>
                          <span className="text-muted-foreground">
                            {groupRecipients.length} total member{groupRecipients.length === 1 ? '' : 's'}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">
                            {groupRowCount} ready envelope{groupRowCount === 1 ? '' : 's'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Group send uses the selected client group as the primary recipient source. CSV remains available below when you need custom rows or multi-recipient overrides.
                        </p>
                      </div>
                    )}

                    {groupWarnings.length > 0 && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs space-y-1">
                        {groupWarnings.map((warning, index) => (
                          <p key={index} className="text-amber-800">{warning}</p>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="csv" className="mt-3 space-y-3 rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Label>CSV upload</Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Use CSV when you need to override recipient slots row by row.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadCsvTemplate}
                        disabled={!selectedTemplate}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download CSV template
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Input type="file" accept=".csv,text/csv" onChange={handleCsvFile} className="flex-1" />
                      <Badge variant="outline">{csvRowCount} row{csvRowCount === 1 ? '' : 's'}</Badge>
                    </div>
                    {csvHeadersHint && (
                      <p className="text-[11px] text-muted-foreground">
                        Accepted headers: <code className="font-mono">{csvHeadersHint}</code>
                      </p>
                    )}
                    <Textarea
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      className="min-h-[120px] font-mono text-xs"
                      placeholder="Paste CSV here or upload a file above"
                    />
                  </TabsContent>
                </Tabs>
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
                disabled={
                  !selectedTemplate ||
                  files.length === 0 ||
                  (sourceMode === 'group' ? groupRowCount === 0 : csvRowCount === 0)
                }
              >
                <Upload className="h-4 w-4 mr-2" />
                Send {sourceMode === 'group' ? groupRowCount : csvRowCount}{' '}
                envelope{(sourceMode === 'group' ? groupRowCount : csvRowCount) === 1 ? '' : 's'}
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

function getClientDisplayName(client: Client): string {
  const first = client.firstName || '';
  const last = client.surname || client.lastName || '';
  return `${first} ${last}`.trim() || client.email || 'Unknown client';
}
