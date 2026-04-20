/**
 * P4.8 — Packets Dialog.
 *
 * Surfaces packet authoring + run-start in one compact UI.
 *  - Library tab : lists authored packets, lets the sender start a run
 *                  or jump to the authoring tab to edit/extend.
 *  - Author tab  : create a new packet by sequencing existing templates.
 *  - Runs tab    : shows in-flight + historical runs and their per-step
 *                  progress so the sender can see exactly where in the
 *                  chain a recipient is.
 *
 * Run-start uploads one PDF per step up-front via the standalone
 * `/esign/documents/upload` endpoint, then POSTs `/esign/packet-runs`
 * with the resulting documentIds. The server materialises step 0
 * immediately and chains step 1..N when each previous envelope
 * completes (see esign-packet-service.ts).
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
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { ScrollArea } from '../../../../ui/scroll-area';
import { Badge } from '../../../../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Layers,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowUpDown,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { esignApi } from '../api';
import type {
  EsignTemplateRecord,
  PacketRecord,
  PacketRunRecord,
  PacketStep,
} from '../types';
import { logger } from '../../../../../utils/logger';

interface PacketsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

export function PacketsDialog({ open, onOpenChange, onCompleted }: PacketsDialogProps) {
  const [tab, setTab] = useState<'library' | 'author' | 'runs'>('library');

  // shared data
  const [templates, setTemplates] = useState<EsignTemplateRecord[]>([]);
  const [packets, setPackets] = useState<PacketRecord[]>([]);
  const [runs, setRuns] = useState<PacketRunRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // author state
  const [authorName, setAuthorName] = useState('');
  const [authorDescription, setAuthorDescription] = useState('');
  const [authorSteps, setAuthorSteps] = useState<PacketStep[]>([]);

  // run-start state
  const [startingPacket, setStartingPacket] = useState<PacketRecord | null>(null);
  const [stepFiles, setStepFiles] = useState<Array<File | null>>([]);
  const [recipients, setRecipients] = useState<Array<{ name: string; email: string; role: string }>>([
    { name: '', email: '', role: 'Signer' },
  ]);
  const [runMessage, setRunMessage] = useState('');
  const [runExpiry, setRunExpiry] = useState(30);
  const [starting, setStarting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [tplRes, packRes, runRes] = await Promise.all([
        esignApi.listTemplates(),
        esignApi.listPackets().catch(() => ({ packets: [] as PacketRecord[] })),
        esignApi.listPacketRuns().catch(() => ({ runs: [] as PacketRunRecord[] })),
      ]);
      setTemplates(tplRes.templates || []);
      setPackets(packRes.packets || []);
      setRuns(runRes.runs || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const templateById = useMemo(() => {
    const map = new Map<string, EsignTemplateRecord>();
    for (const t of templates) map.set(t.id, t);
    return map;
  }, [templates]);

  // -------------------------------------------------------------------------
  // Author tab handlers
  // -------------------------------------------------------------------------

  const handleAddStep = (templateId: string) => {
    const tpl = templateById.get(templateId);
    if (!tpl) return;
    setAuthorSteps((prev) => [
      ...prev,
      { templateId: tpl.id, templateVersion: tpl.version ?? 1, label: tpl.name },
    ]);
  };

  const handleMoveStep = (idx: number, direction: -1 | 1) => {
    setAuthorSteps((prev) => {
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleRemoveStep = (idx: number) => {
    setAuthorSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreatePacket = async () => {
    if (!authorName.trim()) {
      toast.error('Give the packet a name.');
      return;
    }
    if (authorSteps.length === 0) {
      toast.error('Add at least one template step.');
      return;
    }
    try {
      await esignApi.createPacket({
        name: authorName.trim(),
        description: authorDescription.trim() || undefined,
        steps: authorSteps.map((s) => ({
          templateId: s.templateId,
          templateVersion: s.templateVersion,
          label: s.label,
        })),
      });
      toast.success(`Packet "${authorName}" saved.`);
      setAuthorName('');
      setAuthorDescription('');
      setAuthorSteps([]);
      setTab('library');
      await refresh();
    } catch (err) {
      logger.error('Create packet failed', { err });
      toast.error(err instanceof Error ? err.message : 'Failed to create packet');
    }
  };

  const handleDeletePacket = async (id: string) => {
    if (!confirm('Delete this packet? Active runs will keep going.')) return;
    try {
      await esignApi.deletePacket(id);
      toast.success('Packet deleted.');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // -------------------------------------------------------------------------
  // Run-start handlers
  // -------------------------------------------------------------------------

  const handleStartFromLibrary = (packet: PacketRecord) => {
    setStartingPacket(packet);
    setStepFiles(new Array(packet.steps.length).fill(null));
    setRecipients([{ name: '', email: '', role: 'Signer' }]);
    setRunMessage('');
    setRunExpiry(30);
  };

  const handleStepFile = (idx: number, file: File | null) => {
    setStepFiles((prev) => {
      const next = [...prev];
      next[idx] = file;
      return next;
    });
  };

  const handleAddRecipient = () =>
    setRecipients((prev) => [...prev, { name: '', email: '', role: 'Signer' }]);

  const handleRemoveRecipient = (idx: number) =>
    setRecipients((prev) => prev.filter((_, i) => i !== idx));

  const handleRecipientChange = (idx: number, patch: Partial<{ name: string; email: string; role: string }>) => {
    setRecipients((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleStartRun = async () => {
    if (!startingPacket) return;
    if (stepFiles.some((f) => !f)) {
      toast.error('Upload a PDF for every step.');
      return;
    }
    const cleanRecipients = recipients
      .map((r) => ({ name: r.name.trim(), email: r.email.trim(), role: r.role.trim() }))
      .filter((r) => r.email);
    if (cleanRecipients.length === 0) {
      toast.error('Add at least one recipient.');
      return;
    }

    setStarting(true);
    try {
      // Upload every step's document up front so the server has a
      // documentId for each step before kicking off the run.
      const documentIds: string[] = [];
      for (let i = 0; i < stepFiles.length; i++) {
        const file = stepFiles[i];
        if (!file) continue;
        const upload = await esignApi.uploadStandaloneDocument(file);
        documentIds.push(upload.documentId);
      }

      const result = await esignApi.startPacketRun({
        packetId: startingPacket.id,
        recipients: cleanRecipients.map((r, i) => ({ ...r, order: i + 1 })),
        documentIdsByStep: documentIds,
        expiryDays: runExpiry,
        message: runMessage.trim() || undefined,
      });

      if (result.warning) {
        toast.warning(`Run started but step 1 failed: ${result.warning}`);
      } else {
        toast.success(`Packet run started. First envelope: ${result.firstEnvelopeId?.slice(0, 8)}…`);
      }

      setStartingPacket(null);
      setStepFiles([]);
      setRecipients([{ name: '', email: '', role: 'Signer' }]);
      onCompleted?.();
      setTab('runs');
      await refresh();
    } catch (err) {
      logger.error('Start packet run failed', { err });
      toast.error(err instanceof Error ? err.message : 'Failed to start run');
    } finally {
      setStarting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const renderRunStartUI = () => {
    if (!startingPacket) return null;
    return (
      <div className="border rounded-md bg-purple-50 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-medium text-sm flex items-center gap-2">
            <Play className="h-4 w-4 text-purple-600" />
            Start "{startingPacket.name}"
          </p>
          <Button variant="ghost" size="sm" onClick={() => setStartingPacket(null)}>
            Cancel
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Documents (one per step)</Label>
          {startingPacket.steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="shrink-0">Step {idx + 1}</Badge>
              <span className="font-medium flex-1 truncate">{step.label || templateById.get(step.templateId)?.name || step.templateId}</span>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => handleStepFile(idx, e.target.files?.[0] ?? null)}
                className="max-w-[220px] h-8 text-xs"
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Recipients (shared across all steps)</Label>
          {recipients.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_120px_auto] gap-2">
              <Input
                placeholder="Name"
                value={r.name}
                onChange={(e) => handleRecipientChange(i, { name: e.target.value })}
                className="h-8 text-xs"
              />
              <Input
                placeholder="email@example.com"
                value={r.email}
                onChange={(e) => handleRecipientChange(i, { email: e.target.value })}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Role"
                value={r.role}
                onChange={(e) => handleRecipientChange(i, { role: e.target.value })}
                className="h-8 text-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveRecipient(i)}
                disabled={recipients.length === 1}
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={handleAddRecipient}>
            <Plus className="h-3 w-3 mr-1" />
            Add recipient
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Expiry (days)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={runExpiry}
              onChange={(e) => setRunExpiry(Math.max(1, parseInt(e.target.value, 10) || 30))}
              className="h-8 text-xs"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Email message (optional)</Label>
            <Textarea
              value={runMessage}
              onChange={(e) => setRunMessage(e.target.value)}
              className="text-xs min-h-[44px]"
              placeholder="Sent with the first invite of the chain."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleStartRun} disabled={starting} className="bg-purple-600 hover:bg-purple-700">
            {starting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Starting…
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-2" /> Start chain
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-600" />
            Packet workflows
          </DialogTitle>
          <DialogDescription>
            Chain templates so envelope <strong>N+1</strong> auto-sends as soon as envelope <strong>N</strong> is signed.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="author">Author</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
          </TabsList>

          {/* ------------- Library ------------- */}
          <TabsContent value="library" className="flex-1 min-h-0 mt-2">
            <ScrollArea className="h-full pr-2">
              <div className="space-y-2 py-2">
                {loading && (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                )}
                {!loading && packets.length === 0 && (
                  <div className="border rounded-md bg-gray-50 p-3 text-sm text-muted-foreground">
                    No packets yet. Switch to the <strong>Author</strong> tab to create one.
                  </div>
                )}
                {packets.map((p) => (
                  <div key={p.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {p.steps.length} step{p.steps.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartFromLibrary(p)}
                          className="text-purple-700 border-purple-300 hover:bg-purple-50"
                        >
                          <Play className="h-3.5 w-3.5 mr-1" />
                          Start
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeletePacket(p.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {p.steps.map((s, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px]">
                          {idx + 1}. {s.label || templateById.get(s.templateId)?.name || 'Template'}
                          <span className="ml-1 text-muted-foreground">v{s.templateVersion}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {renderRunStartUI()}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ------------- Author ------------- */}
          <TabsContent value="author" className="flex-1 min-h-0 mt-2">
            <ScrollArea className="h-full pr-2">
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Packet name</Label>
                    <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Onboarding chain" />
                  </div>
                  <div>
                    <Label className="text-xs">Description (optional)</Label>
                    <Input value={authorDescription} onChange={(e) => setAuthorDescription(e.target.value)} placeholder="Engagement → FNA → ROA" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Add step from template</Label>
                  <Select onValueChange={handleAddStep} value="">
                    <SelectTrigger>
                      <SelectValue placeholder={templates.length === 0 ? 'No templates yet — create one first' : 'Pick a template to append'} />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} <span className="text-muted-foreground ml-1">v{t.version ?? 1}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  {authorSteps.length === 0 ? (
                    <p className="text-xs text-muted-foreground border rounded-md bg-gray-50 p-3">
                      Pick templates above to build your chain. Order matters — step 2 is sent the moment step 1 completes.
                    </p>
                  ) : (
                    authorSteps.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-2 border rounded-md p-2 text-xs">
                        <Badge variant="outline">Step {idx + 1}</Badge>
                        <span className="flex-1 truncate font-medium">
                          {s.label || templateById.get(s.templateId)?.name}
                          <span className="text-muted-foreground ml-1">v{s.templateVersion}</span>
                        </span>
                        <Button size="icon" variant="ghost" onClick={() => handleMoveStep(idx, -1)} disabled={idx === 0}>
                          <ArrowUpDown className="h-3.5 w-3.5 rotate-180" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleMoveStep(idx, 1)} disabled={idx === authorSteps.length - 1}>
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleRemoveStep(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleCreatePacket} className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="h-3.5 w-3.5 mr-2" /> Save packet
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ------------- Runs ------------- */}
          <TabsContent value="runs" className="flex-1 min-h-0 mt-2">
            <ScrollArea className="h-full pr-2">
              <div className="space-y-2 py-2">
                {loading && (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                )}
                {!loading && runs.length === 0 && (
                  <div className="border rounded-md bg-gray-50 p-3 text-sm text-muted-foreground">
                    No runs yet — start one from the Library tab.
                  </div>
                )}
                {runs.map((run) => {
                  const packet = packets.find((p) => p.id === run.packet_id);
                  return (
                    <div key={run.id} className="border rounded-md p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">
                          {packet?.name || run.packet_id.slice(0, 8)}
                        </p>
                        <Badge
                          variant="outline"
                          className={`capitalize text-[10px] ${
                            run.status === 'completed' ? 'text-emerald-700 border-emerald-300' :
                            run.status === 'failed' ? 'text-red-700 border-red-300' :
                            run.status === 'cancelled' ? 'text-gray-500' :
                            'text-purple-700 border-purple-300'
                          }`}
                        >
                          {run.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Started {new Date(run.created_at).toLocaleString()} · {run.recipients.map((r) => r.email).join(', ')}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {run.steps.map((s) => (
                          <Badge
                            key={s.step_index}
                            variant="outline"
                            className={`text-[10px] flex items-center gap-1 ${
                              s.status === 'completed' ? 'text-emerald-700 border-emerald-300' :
                              s.status === 'failed' ? 'text-red-700 border-red-300' :
                              s.status === 'sent' ? 'text-purple-700 border-purple-300' :
                              s.status === 'skipped' ? 'text-gray-400' :
                              'text-gray-500'
                            }`}
                          >
                            {s.status === 'completed' && <CheckCircle2 className="h-2.5 w-2.5" />}
                            {s.status === 'failed' && <AlertCircle className="h-2.5 w-2.5" />}
                            {s.status === 'sent' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                            Step {s.step_index + 1}: {s.status}
                          </Badge>
                        ))}
                      </div>
                      {run.status === 'running' && (
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (!confirm('Cancel this packet run? In-flight envelopes are unaffected.')) return;
                              try {
                                await esignApi.cancelPacketRun(run.id);
                                toast.success('Run cancelled.');
                                await refresh();
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Cancel failed');
                              }
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            Cancel run
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
