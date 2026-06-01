import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
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
import { Plus, Trash2, Type, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { brandApi } from './brand-api';
import type { TypographyConfig } from './brand-api';
import { SectionSkeleton } from './CorporateIdentitySkeleton';

export function TypographySection({ onUpdate }: { onUpdate: () => void }) {
  const [config, setConfig] = useState<TypographyConfig | null>(null);
  const [loading, setLoading] = useState(true);
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
    } catch (err) {
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
    } catch (err) {
      toast.error('Failed to save font');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFont = async (id: string) => {
    if (!config) return;
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
    } catch (err) {
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
    } catch (err) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Typography</h3>
          <p className="text-sm text-muted-foreground">Approved fonts, scale, and usage rules.</p>
        </div>
        <Button
          size="sm"
          className="bg-purple-600 hover:bg-purple-700"
          onClick={() => setEditOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Font
        </Button>
      </div>

      {/* Registered Fonts */}
      {config && config.fonts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {config.fonts.map((font) => (
            <Card key={font.id}>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {roleLabels[font.role] || font.role}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-red-400 hover:text-red-600"
                    onClick={() => handleDeleteFont(font.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div style={{ fontFamily: `${font.family}, ${font.fallback}` }}>
                  <p className="text-2xl font-bold">{font.family}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The quick brown fox jumps over the lazy dog
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {font.weights.map((w) => (
                    <Badge key={w} variant="secondary" className="text-[10px] font-mono">
                      {w}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Fallback: {font.fallback}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Type className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-sm">No fonts registered</p>
            <p className="text-xs text-muted-foreground mt-1">Add your approved font families.</p>
          </CardContent>
        </Card>
      )}

      {/* Type Scale */}
      {config && config.scale.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Type Scale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.scale.map((s) => (
              <div
                key={s.token}
                className="flex items-baseline justify-between border-b border-dashed pb-2 last:border-0 last:pb-0"
              >
                <div className="flex items-baseline gap-3">
                  <Badge variant="outline" className="font-mono text-[10px] w-12 justify-center">
                    {s.token}
                  </Badge>
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
          </CardContent>
        </Card>
      )}

      {/* Usage Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Usage Notes</CardTitle>
          <CardDescription className="text-xs">
            Rules and guidelines for typography usage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config?.notes || ''}
            onChange={(e) =>
              setConfig((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
            }
            onBlur={(e) => handleSaveNotes(e.target.value)}
            placeholder="e.g. Never use Light weight below 14px. Use Bold for monetary values..."
            rows={3}
          />
        </CardContent>
      </Card>

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
    </div>
  );
}
