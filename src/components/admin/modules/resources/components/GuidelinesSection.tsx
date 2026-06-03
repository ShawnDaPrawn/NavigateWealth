import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
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
import {
  Download,
  Upload,
  FileText,
  Plus,
  AlertCircle,
  Trash2,
  Pencil,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { brandApi } from './brand-api';
import type { BrandGuidelines } from './brand-api';
import { SectionSkeleton } from './CorporateIdentitySkeleton';

export function GuidelinesSection({ onUpdate }: { onUpdate: () => void }) {
  const [guidelines, setGuidelines] = useState<BrandGuidelines | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
    } catch (err) {
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

  const rules = guidelines?.rules || [];
  const voice = guidelines?.voice || { tone: '', terminology: '', notes: '' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Brand Guidelines</h3>
          <p className="text-sm text-muted-foreground">
            Quick-reference rules, brand voice, and downloadable guidelines.
          </p>
        </div>
      </div>

      {/* Guidelines PDF */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Guidelines Document</CardTitle>
            <div className="flex items-center gap-2">
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download PDF
                  </Button>
                </a>
              )}
              <Label htmlFor="pdf-upload" className="cursor-pointer">
                <Button size="sm" variant="outline" asChild>
                  <span>
                    {pdfUploading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {guidelines?.pdfFileName ? 'Replace PDF' : 'Upload PDF'}
                  </span>
                </Button>
              </Label>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handlePdfUpload}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {guidelines?.pdfFileName ? (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <FileText className="h-5 w-5 text-red-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{guidelines.pdfFileName}</p>
                <p className="text-xs text-muted-foreground">Brand guidelines document</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No guidelines document uploaded yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Brand Rules */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Quick Reference Rules</CardTitle>
              <CardDescription className="text-xs">
                Key brand rules for quick scanning.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setAddRuleOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No rules defined yet. Add quick-reference brand rules.
            </p>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg group"
                >
                  <AlertCircle className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{rule.title}</p>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 flex-shrink-0"
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Brand Voice */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Brand Voice</CardTitle>
              <CardDescription className="text-xs">
                Tone, terminology, and communication style.
              </CardDescription>
            </div>
            {!voiceEditing ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setVoiceDraft(voice);
                  setVoiceEditing(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setVoiceEditing(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={handleSaveVoice}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {voiceEditing ? (
            <div className="contents">
              <div className="space-y-2">
                <Label>Tone of Voice</Label>
                <Textarea
                  value={voiceDraft.tone}
                  onChange={(e) => setVoiceDraft((prev) => ({ ...prev, tone: e.target.value }))}
                  placeholder="e.g. Professional, approachable, knowledgeable. Avoid jargon unless speaking to industry peers..."
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
                  placeholder="e.g. Use 'wealth planning' not 'financial planning'. Use 'clients' not 'customers'..."
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
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Tone
                      </p>
                      <p className="text-sm">{voice.tone}</p>
                    </div>
                  )}
                  {voice.terminology && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Terminology
                      </p>
                      <p className="text-sm">{voice.terminology}</p>
                    </div>
                  )}
                  {voice.notes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Notes
                      </p>
                      <p className="text-sm">{voice.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No brand voice guidelines defined yet.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                placeholder="e.g. Minimum logo size: 30mm wide"
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
    </div>
  );
}
