import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { brandApi } from './brand-api';
import type { BrandGuidelines } from './brand-api';
import { SectionSkeleton } from './CorporateIdentitySkeleton';
import { DsButton, useConfirm, ErrorState } from '../../../layout/page';

export function GuidelinesSection({ onUpdate }: { onUpdate: () => void }) {
  const { confirm: askConfirm, confirmDialog } = useConfirm();
  const [guidelines, setGuidelines] = useState<BrandGuidelines | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [newRule, setNewRule] = useState({ title: '', description: '' });
  const [voiceEditing, setVoiceEditing] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState({ tone: '', terminology: '', notes: '' });
  const [pdfUploading, setPdfUploading] = useState(false);

  const loadGuidelines = useCallback(async () => {
    try {
      const data = await brandApi.getGuidelines();
      setGuidelines(data.guidelines);
      setPdfUrl(data.pdfUrl);
      if (data.guidelines?.voice) {
        setVoiceDraft(data.guidelines.voice);
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      console.error('Failed to load guidelines:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGuidelines();
  }, [loadGuidelines]);

  const handleAddRule = async () => {
    if (!newRule.title) return;
    const rules = [...(guidelines?.rules || [])];
    rules.push({
      id: crypto.randomUUID(),
      title: newRule.title,
      description: newRule.description,
      order: rules.length,
    });
    setSaving(true);
    try {
      await brandApi.saveGuidelineRules(rules);
      setGuidelines((prev) => (prev ? { ...prev, rules } : null));
      setAddRuleOpen(false);
      setNewRule({ title: '', description: '' });
      onUpdate();
      toast.success('Rule added');
    } catch (_err) {
      toast.error('Failed to add rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    const ok = await askConfirm({
      title: 'Remove this rule?',
      confirmLabel: 'Remove rule',
      destructive: true,
    });
    if (!ok) return;
    const rules = (guidelines?.rules || []).filter((r) => r.id !== id);
    try {
      await brandApi.saveGuidelineRules(rules);
      setGuidelines((prev) => (prev ? { ...prev, rules } : null));
      onUpdate();
      toast.success('Rule removed');
    } catch (_err) {
      toast.error('Failed to remove rule');
    }
  };

  const handleSaveVoice = async () => {
    setSaving(true);
    try {
      await brandApi.saveGuidelineVoice(voiceDraft);
      setGuidelines((prev) => (prev ? { ...prev, voice: voiceDraft } : null));
      setVoiceEditing(false);
      onUpdate();
      toast.success('Brand voice saved');
    } catch (_err) {
      toast.error('Failed to save brand voice');
    } finally {
      setSaving(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfUploading(true);
    try {
      await brandApi.uploadGuidelinePdf(file);
      await loadGuidelines();
      onUpdate();
      toast.success('Guidelines PDF uploaded');
    } catch (_err) {
      toast.error('Failed to upload PDF');
    } finally {
      setPdfUploading(false);
    }
  };

  if (loading) return <SectionSkeleton rows={3} />;
  if (loadError) {
    return (
      <ErrorState
        title="Unable to load brand guidelines"
        onRetry={() => void loadGuidelines()}
        details={loadError}
      />
    );
  }

  const rules = guidelines?.rules || [];
  const voice = guidelines?.voice || { tone: '', terminology: '', notes: '' };

  return (
    // RE-CI-Guidelines: three cards — the PDF, quick reference rules, brand voice
    <div className="space-y-4">
      {/* Guidelines PDF */}
      <section className="ds-card overflow-hidden">
        <div className="ds-card-h">
          <h3>Guidelines document</h3>
        </div>
        <div className="ds-card-b">
          <div className="flex flex-wrap items-center gap-2">
            <div className="grow min-w-0">
              {guidelines?.pdfFileName ? (
                <>
                  <b className="block truncate text-[13.5px] font-medium text-nw-ink">
                    {guidelines.pdfFileName}
                  </b>
                  <span className="ds-meta">Brand guidelines document</span>
                </>
              ) : (
                <span className="ds-meta">No guidelines document yet</span>
              )}
            </div>
            {pdfUrl && (
              <a
                className="ds-btn ds-btn-sm"
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download PDF
              </a>
            )}
            <label
              htmlFor="pdf-upload"
              className={`ds-btn ds-btn-sm cursor-pointer ${guidelines?.pdfFileName ? 'ds-btn-ghost' : 'ds-btn-primary'}`}
            >
              {pdfUploading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {guidelines?.pdfFileName ? 'Replace' : 'Upload PDF'}
            </label>
            <input
              id="pdf-upload"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfUpload}
            />
          </div>
        </div>
      </section>

      {/* Brand Rules */}
      <section className="ds-card overflow-hidden">
        <div className="ds-card-h">
          <h3>Quick reference rules</h3>
          <DsButton size="sm" variant="primary" onClick={() => setAddRuleOpen(true)}>
            Add rule
          </DsButton>
        </div>
        {rules.length === 0 ? (
          <div className="ds-card-b">
            <span className="ds-meta">No rules yet</span>
          </div>
        ) : (
          <ul>
            {rules.map((rule) => (
              <li key={rule.id} className="ds-todo-row">
                <div className="grow min-w-0">
                  <b className="block text-[13.5px] font-medium text-nw-ink">{rule.title}</b>
                  {rule.description && <span className="ds-meta">{rule.description}</span>}
                </div>
                <DsButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete rule ${rule.title}`}
                  onClick={() => handleDeleteRule(rule.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </DsButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Brand Voice */}
      <section className="ds-card overflow-hidden">
        <div className="ds-card-h">
          <h3>Brand voice</h3>
          {!voiceEditing ? (
            <DsButton
              size="sm"
              onClick={() => {
                setVoiceDraft(voice);
                setVoiceEditing(true);
              }}
            >
              Edit
            </DsButton>
          ) : (
            <div className="flex items-center gap-1.5">
              <DsButton size="sm" variant="ghost" onClick={() => setVoiceEditing(false)}>
                Cancel
              </DsButton>
              <DsButton size="sm" variant="primary" onClick={handleSaveVoice} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </DsButton>
            </div>
          )}
        </div>
        <div className="ds-card-b space-y-4">
          {voiceEditing ? (
            <div className="contents">
              <div className="space-y-2">
                <Label>Tone of Voice</Label>
                <Textarea
                  value={voiceDraft.tone}
                  onChange={(e) => setVoiceDraft((prev) => ({ ...prev, tone: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Preferred Terminology</Label>
                <Textarea
                  value={voiceDraft.terminology}
                  onChange={(e) =>
                    setVoiceDraft((prev) => ({ ...prev, terminology: e.target.value }))
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Additional Notes</Label>
                <Textarea
                  value={voiceDraft.notes}
                  onChange={(e) => setVoiceDraft((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any other brand voice guidelines..."
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <div className="contents">
              {voice.tone || voice.terminology || voice.notes ? (
                <div className="space-y-4">
                  {voice.tone && (
                    <div>
                      <p className="ds-lbl mb-1">Tone</p>
                      <p className="text-sm">{voice.tone}</p>
                    </div>
                  )}
                  {voice.terminology && (
                    <div>
                      <p className="ds-lbl mb-1">Terminology</p>
                      <p className="text-sm">{voice.terminology}</p>
                    </div>
                  )}
                  {voice.notes && (
                    <div>
                      <p className="ds-lbl mb-1">Notes</p>
                      <p className="text-sm">{voice.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <span className="ds-meta">No brand voice yet</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Add Rule Dialog */}
      <Dialog open={addRuleOpen} onOpenChange={setAddRuleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Brand Rule</DialogTitle>
            <DialogDescription>Add a quick-reference brand rule.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rule Title</Label>
              <Input
                value={newRule.title}
                onChange={(e) => setNewRule((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={newRule.description}
                onChange={(e) => setNewRule((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Additional context or explanation..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRuleOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleAddRule}
              disabled={!newRule.title || saving}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
