import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../../ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Trash2, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { brandApi } from './brand-api';
import type { ColourSwatch, ColourPalette } from './brand-api';
import { hexToRgb, getContrastRatio } from './corporateIdentityUtils';
import { SectionSkeleton } from './CorporateIdentitySkeleton';
import { DsButton, DsState, useConfirm, ErrorState } from '../../../layout/page';

export function ColoursSection({ onUpdate }: { onUpdate: () => void }) {
  const { confirm: askConfirm, confirmDialog } = useConfirm();
  const [palette, setPalette] = useState<ColourPalette | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newSwatch, setNewSwatch] = useState<Partial<ColourSwatch>>({
    name: '',
    hex: '#6d28d9',
    group: 'primary',
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadPalette = useCallback(async () => {
    try {
      const data = await brandApi.getColourPalette();
      setPalette(data || { swatches: [], updatedAt: '', updatedBy: '' });
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      console.error('Failed to load palette:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPalette();
  }, [loadPalette]);

  const handleAddSwatch = async () => {
    if (!newSwatch.name || !newSwatch.hex || !palette) return;
    const swatch: ColourSwatch = {
      id: crypto.randomUUID(),
      name: newSwatch.name!,
      hex: newSwatch.hex!,
      rgb: hexToRgb(newSwatch.hex!),
      group: (newSwatch.group as ColourSwatch['group']) || 'primary',
      order: palette.swatches.length,
    };
    const updated: ColourPalette = {
      ...palette,
      swatches: [...palette.swatches, swatch],
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    };
    setSaving(true);
    try {
      const saved = await brandApi.saveColourPalette(updated);
      setPalette(saved);
      setAddOpen(false);
      setNewSwatch({ name: '', hex: '#6d28d9', group: 'primary' });
      onUpdate();
      toast.success('Colour added');
    } catch (err) {
      console.error('Failed to save palette:', err);
      toast.error('Failed to save colour');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSwatch = async (id: string) => {
    if (!palette) return;
    const ok = await askConfirm({
      title: 'Remove this colour?',
      confirmLabel: 'Remove colour',
      destructive: true,
    });
    if (!ok) return;
    const updated: ColourPalette = {
      ...palette,
      swatches: palette.swatches.filter((s) => s.id !== id),
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    };
    try {
      const saved = await brandApi.saveColourPalette(updated);
      setPalette(saved);
      onUpdate();
      toast.success('Colour removed');
    } catch (_err) {
      toast.error('Failed to remove colour');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const groups = ['primary', 'secondary', 'accent', 'neutral', 'semantic'] as const;

  if (loading) return <SectionSkeleton rows={3} />;
  if (loadError) {
    return (
      <ErrorState
        title="Unable to load brand colours"
        onRetry={() => void loadPalette()}
        details={loadError}
      />
    );
  }

  return (
    // RE-CI-Colours: one "Brand colours" card, action in its header, swatch tiles inside
    <section className="ds-card overflow-hidden">
      <div className="ds-card-h">
        <h3>Brand colours</h3>
        <DsButton size="sm" variant="primary" onClick={() => setAddOpen(true)}>
          Add colour
        </DsButton>
      </div>
      <div className="ds-card-b space-y-4">
        {groups.map((group) => {
          const swatches = palette?.swatches.filter((s) => s.group === group) || [];
          if (swatches.length === 0) return null;
          return (
            <div key={group} className="space-y-2.5">
              <span className="ds-lbl capitalize">{group}</span>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {swatches.map((swatch) => {
                  const luminance = getContrastRatio(swatch.hex);
                  const textColor = luminance > 0.5 ? 'text-gray-900' : 'text-white';
                  const rgb = `rgb(${swatch.rgb.r}, ${swatch.rgb.g}, ${swatch.rgb.b})`;
                  return (
                    <div
                      key={swatch.id}
                      className="overflow-hidden rounded-[10px] border border-nw-line bg-white"
                    >
                      <div
                        className={`flex h-[70px] items-end justify-end p-2 text-[11px] font-semibold ${textColor}`}
                        style={{ backgroundColor: swatch.hex }}
                        aria-hidden="true"
                      >
                        Aa
                      </div>
                      <div className="flex flex-col gap-0.5 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <b className="text-[13.5px] font-semibold text-nw-ink">{swatch.name}</b>
                          <DsButton
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${swatch.name}`}
                            onClick={() => handleDeleteSwatch(swatch.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </DsButton>
                        </div>
                        <button
                          type="button"
                          className="ds-meta flex items-center gap-1 text-left hover:text-nw-ink"
                          onClick={() => copyToClipboard(swatch.hex, swatch.id + '-hex')}
                          aria-label={`Copy ${swatch.hex.toUpperCase()}`}
                        >
                          {swatch.hex.toUpperCase()} ·{' '}
                          <span className="capitalize">{swatch.group}</span>
                          {copiedId === swatch.id + '-hex' ? (
                            <Check className="h-3 w-3 text-green-600" aria-hidden="true" />
                          ) : (
                            <Copy className="h-3 w-3" aria-hidden="true" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="ds-meta flex items-center gap-1 text-left font-mono text-[11px] hover:text-nw-ink"
                          onClick={() => copyToClipboard(rgb, swatch.id + '-rgb')}
                          aria-label={`Copy ${rgb}`}
                        >
                          {rgb}
                          {copiedId === swatch.id + '-rgb' ? (
                            <Check className="h-3 w-3 text-green-600" aria-hidden="true" />
                          ) : (
                            <Copy className="h-3 w-3" aria-hidden="true" />
                          )}
                        </button>
                        <span className="ds-meta text-[11px]">
                          {luminance > 0.5 ? 'Use dark text' : 'Use light text'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {(!palette || palette.swatches.length === 0) && <DsState title="No colours yet" />}
      </div>

      {/* Add Colour Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Colour</DialogTitle>
            <DialogDescription>Add a new swatch to the brand palette.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Colour Name</Label>
              <Input
                value={newSwatch.name || ''}
                onChange={(e) => setNewSwatch((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Navigate Purple"
              />
            </div>
            <div className="space-y-2">
              <Label>Colour</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={newSwatch.hex || '#6d28d9'}
                  onChange={(e) => setNewSwatch((prev) => ({ ...prev, hex: e.target.value }))}
                  className="h-10 w-14 rounded border cursor-pointer"
                />
                <Input
                  value={newSwatch.hex || ''}
                  onChange={(e) => setNewSwatch((prev) => ({ ...prev, hex: e.target.value }))}
                  placeholder="#6d28d9"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Group</Label>
              <Select
                value={newSwatch.group || 'primary'}
                onValueChange={(v) =>
                  setNewSwatch((prev) => ({ ...prev, group: v as ColourSwatch['group'] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="accent">Accent</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="semantic">Semantic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-lg border"
                  style={{ backgroundColor: newSwatch.hex }}
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium">{newSwatch.name || 'Unnamed'}</p>
                  <p className="text-xs font-mono text-muted-foreground">{newSwatch.hex}</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleAddSwatch}
              disabled={!newSwatch.name || saving}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Add Colour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </section>
  );
}
