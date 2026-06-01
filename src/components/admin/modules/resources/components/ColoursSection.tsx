import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
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
import { Palette, Plus, Trash2, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { brandApi } from './brand-api';
import type { ColourSwatch, ColourPalette } from './brand-api';
import { hexToRgb, getContrastRatio } from './corporateIdentityUtils';
import { SectionSkeleton } from './CorporateIdentitySkeleton';

export function ColoursSection({ onUpdate }: { onUpdate: () => void }) {
  const [palette, setPalette] = useState<ColourPalette | null>(null);
  const [loading, setLoading] = useState(true);
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
    } catch (err) {
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
    } catch (err) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Brand Colours</h3>
          <p className="text-sm text-muted-foreground">
            Define and manage the brand colour palette.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-purple-600 hover:bg-purple-700"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Colour
        </Button>
      </div>

      {/* Colour groups */}
      {groups.map((group) => {
        const swatches = palette?.swatches.filter((s) => s.group === group) || [];
        if (swatches.length === 0) return null;
        return (
          <div key={group} className="space-y-3">
            <h4 className="text-sm font-medium capitalize text-muted-foreground">
              {group} Colours
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {swatches.map((swatch) => {
                const luminance = getContrastRatio(swatch.hex);
                const textColor = luminance > 0.5 ? 'text-gray-900' : 'text-white';
                return (
                  <Card key={swatch.id} className="overflow-hidden">
                    <div
                      className={`h-20 flex items-end p-3 ${textColor}`}
                      style={{ backgroundColor: swatch.hex }}
                    >
                      <span className="text-sm font-medium drop-shadow-sm">{swatch.name}</span>
                    </div>
                    <CardContent className="pt-3 pb-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                          onClick={() => copyToClipboard(swatch.hex, swatch.id + '-hex')}
                        >
                          {swatch.hex.toUpperCase()}
                          {copiedId === swatch.id + '-hex' ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-red-400 hover:text-red-600"
                          onClick={() => handleDeleteSwatch(swatch.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <button
                        className="text-[10px] text-muted-foreground font-mono hover:text-foreground transition-colors flex items-center gap-1"
                        onClick={() =>
                          copyToClipboard(
                            `rgb(${swatch.rgb.r}, ${swatch.rgb.g}, ${swatch.rgb.b})`,
                            swatch.id + '-rgb',
                          )
                        }
                      >
                        RGB({swatch.rgb.r}, {swatch.rgb.g}, {swatch.rgb.b})
                        {copiedId === swatch.id + '-rgb' ? (
                          <Check className="h-2.5 w-2.5 text-green-500" />
                        ) : (
                          <Copy className="h-2.5 w-2.5" />
                        )}
                      </button>
                      {/* Contrast indicator */}
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`h-4 w-4 rounded text-[8px] font-bold flex items-center justify-center ${textColor}`}
                          style={{ backgroundColor: swatch.hex }}
                        >
                          Aa
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {luminance > 0.5 ? 'Use dark text' : 'Use light text'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {(!palette || palette.swatches.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <Palette className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-sm">No colours defined yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add your brand colours to build a consistent palette.
            </p>
            <Button
              size="sm"
              className="mt-4 bg-purple-600 hover:bg-purple-700"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add First Colour
            </Button>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
