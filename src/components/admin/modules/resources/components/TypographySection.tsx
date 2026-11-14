import { useState, useEffect, useCallback } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { brandApi } from './brand-api';
import type { TypographyConfig } from './brand-api';
import { SectionSkeleton } from './CorporateIdentitySkeleton';
import { DsButton, DsState, useConfirm, ErrorState } from '../../../layout/page';

export function TypographySection({ onUpdate }: { onUpdate: () => void }) {
  const { confirm: askConfirm, confirmDialog } = useConfirm();
  const [config, setConfig] = useState<TypographyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editFont, setEditFont] = useState({
    role: 'heading',
    family: '',
    weights: '400,500,700',
    fallback: 'sans-serif',
  });

  const loadConfig = useCallback(async () => {
    try {
      const data = await brandApi.getTypography();
      setConfig(
        data || {
          fonts: [],
          scale: [
            { token: 'h1', label: 'Heading 1', size: '2.25rem', lineHeight: '2.5rem', weight: 700 },
            {
              token: 'h2',
              label: 'Heading 2',
              size: '1.875rem',
              lineHeight: '2.25rem',
              weight: 600,
            },
            { token: 'h3', label: 'Heading 3', size: '1.5rem', lineHeight: '2rem', weight: 600 },
            { token: 'body', label: 'Body', size: '0.875rem', lineHeight: '1.25rem', weight: 400 },
            { token: 'small', label: 'Small', size: '0.75rem', lineHeight: '1rem', weight: 400 },
          ],
          notes: '',
          updatedAt: '',
          updatedBy: '',
        },
      );
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      console.error('Failed to load typography:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleAddFont = async () => {
    if (!config || !editFont.family) return;
    const font = {
      id: crypto.randomUUID(),
      role: editFont.role as 'heading' | 'body' | 'mono' | 'display',
      family: editFont.family,
      weights: editFont.weights
        .split(',')
        .map((w) => parseInt(w.trim()))
        .filter(Boolean),
      fallback: editFont.fallback,
    };
    const updated: TypographyConfig = {
      ...config,
      fonts: [...config.fonts, font],
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    };
    setSaving(true);
    try {
      const saved = await brandApi.saveTypography(updated);
      setConfig(saved);
      setEditOpen(false);
      setEditFont({ role: 'heading', family: '', weights: '400,500,700', fallback: 'sans-serif' });
      onUpdate();
      toast.success('Font added');
    } catch (_err) {
      toast.error('Failed to save font');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFont = async (id: string) => {
    if (!config) return;
    const ok = await askConfirm({
      title: 'Remove this font?',
      confirmLabel: 'Remove font',
      destructive: true,
    });
    if (!ok) return;
    const updated: TypographyConfig = {
      ...config,
      fonts: config.fonts.filter((f) => f.id !== id),
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    };
    try {
      const saved = await brandApi.saveTypography(updated);
      setConfig(saved);
      onUpdate();
      toast.success('Font removed');
    } catch (_err) {
      toast.error('Failed to remove font');
    }
  };

  const handleSaveNotes = async (notes: string) => {
    if (!config) return;
    const updated = { ...config, notes, updatedAt: new Date().toISOString(), updatedBy: 'admin' };
    try {
      const saved = await brandApi.saveTypography(updated);
      setConfig(saved);
      toast.success('Notes saved');
    } catch (_err) {
      toast.error('Failed to save notes');
    }
  };

  const roleLabels: Record<string, string> = {
    heading: 'Headings',
    body: 'Body Text',
    mono: 'Monospace',
    display: 'Display',
  };

  if (loading) return <SectionSkeleton rows={3} />;
  if (loadError) {
    return (
      <ErrorState
        title="Unable to load typography"
        onRetry={() => void loadConfig()}
        details={loadError}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* RE-CI-Typography: the fonts card, with Add font in its header */}
      <section className="ds-card overflow-hidden">
        <div className="ds-card-h">
          <div>
            <h3>Typography</h3>
            <p className="ds-meta">Approved fonts, scale, and usage rules.</p>
          </div>
          <DsButton size="sm" variant="primary" onClick={() => setEditOpen(true)}>
            Add font
          </DsButton>
        </div>
        <div className="ds-card-b flex flex-col gap-3">
          {config && config.fonts.length > 0 ? (
            config.fonts.map((font) => (
              <div key={font.id} className="ds-todo-row rounded-[10px] border border-nw-line">
                <div className="grow flex min-w-0 flex-col gap-1">
                  <b
                    className="text-[22px] font-semibold text-nw-ink"
                    style={{ fontFamily: `${font.family}, ${font.fallback}` }}
                  >
                    {font.family}
                  </b>
                  <span className="ds-meta">
                    {roleLabels[font.role] || font.role} · Fallback: {font.fallback}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {font.weights.map((w) => (
                      <span key={w} className="ds-pill">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
                <DsButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${font.family}`}
                  onClick={() => handleDeleteFont(font.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </DsButton>
              </div>
            ))
          ) : (
            <DsState title="No fonts yet" />
          )}
        </div>
      </section>

      {/* Type Scale */}
      {config && config.scale.length > 0 && (
        <section className="ds-card overflow-hidden">
          <div className="ds-card-h">
            <h3>Type scale</h3>
          </div>
          <div className="ds-card-b space-y-3">
            {config.scale.map((s) => (
              <div
                key={s.token}
                className="flex items-baseline justify-between border-b border-dashed pb-2 last:border-0 last:pb-0"
              >
                <div className="flex items-baseline gap-3">
                  <span className="ds-pill w-12 justify-center font-mono">{s.token}</span>
                  <span
                    style={{ fontSize: s.size, lineHeight: s.lineHeight, fontWeight: s.weight }}
                  >
                    {s.label}
                  </span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {s.size} / {s.lineHeight}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="ds-card overflow-hidden">
        <div className="ds-card-h">
          <h3>Usage notes</h3>
        </div>
        <div className="ds-card-b">
          <Textarea
            value={config?.notes || ''}
            onChange={(e) =>
              setConfig((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
            }
            onBlur={(e) => handleSaveNotes(e.target.value)}
            rows={3}
            aria-label="Usage notes"
          />
        </div>
      </section>

      {/* Add Font Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Font</DialogTitle>
            <DialogDescription>Register an approved font family.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editFont.role}
                onValueChange={(v) => setEditFont((prev) => ({ ...prev, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="heading">Headings</SelectItem>
                  <SelectItem value="body">Body Text</SelectItem>
                  <SelectItem value="mono">Monospace</SelectItem>
                  <SelectItem value="display">Display</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Input
                value={editFont.family}
                onChange={(e) => setEditFont((prev) => ({ ...prev, family: e.target.value }))}
                placeholder="e.g. Inter, Roboto, Playfair Display"
              />
            </div>
            <div className="space-y-2">
              <Label>Weights (comma-separated)</Label>
              <Input
                value={editFont.weights}
                onChange={(e) => setEditFont((prev) => ({ ...prev, weights: e.target.value }))}
                placeholder="400, 500, 700"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Fallback</Label>
              <Input
                value={editFont.fallback}
                onChange={(e) => setEditFont((prev) => ({ ...prev, fallback: e.target.value }))}
                placeholder="sans-serif"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleAddFont}
              disabled={!editFont.family || saving}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Add Font
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
