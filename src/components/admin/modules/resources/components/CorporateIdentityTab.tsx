/**
 * Corporate Identity Tab
 *
 * Central management of brand assets: logos, colours, typography,
 * collateral files, and brand guidelines.
 *
 * Guidelines:
 *   SS7    — Presentation layer (no business logic in UI)
 *   SS8.3  — Status colour vocabulary, stat card standards
 *   SS8.4  — Platform constraints (sonner version, contents wrapper)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Skeleton } from '../../../../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../../ui/tooltip';
import {
  Image,
  Palette,
  FolderOpen,
  Clock,
  Upload,
  Trash2,
  Plus,
  Download,
  Copy,
  Check,
  Loader2,
  FileText,
  Type,
  BookOpen,
  AlertCircle,
  Pencil,
  Search,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  brandApi,
  LOGO_VARIANTS,
  COLLATERAL_CATEGORIES,
} from './brand-api';
import type {
  LogoEntry,
  ColourSwatch,
  ColourPalette,
  TypographyConfig,
  CollateralItem,
  BrandRule,
  BrandGuidelines,
  BrandSummary,
} from './brand-api';

const EmailSignatureGenerator = React.lazy(() =>
  import('./EmailSignatureGenerator').then(m => ({ default: m.EmailSignatureGenerator }))
);

// ============================================================================
// STAT CARD CONFIG (SS8.3)
// ============================================================================

const STAT_CONFIG = {
  logoCount: { label: 'Logo Variants', icon: Image, iconColor: 'text-blue-600', bgColor: 'bg-blue-50' },
  colourCount: { label: 'Brand Colours', icon: Palette, iconColor: 'text-purple-600', bgColor: 'bg-purple-50' },
  collateralCount: { label: 'Collateral', icon: FolderOpen, iconColor: 'text-green-600', bgColor: 'bg-green-50' },
  lastUpdated: { label: 'Last Updated', icon: Clock, iconColor: 'text-amber-600', bgColor: 'bg-amber-50' },
} as const;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CorporateIdentityTab() {
  const [summary, setSummary] = useState<BrandSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    try {
      const data = await brandApi.getSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load brand summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const formatDate = (d: string | null) => {
    if (!d) return 'Never';
    try { return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return 'Unknown'; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold leading-none">Corporate Identity</h2>
        <p className="text-sm text-muted-foreground">
          Manage logos, brand colours, typography, collateral, and brand guidelines.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {(Object.keys(STAT_CONFIG) as Array<keyof typeof STAT_CONFIG>).map((key) => {
          const cfg = STAT_CONFIG[key];
          const Icon = cfg.icon;
          const value = loading
            ? null
            : key === 'lastUpdated'
            ? formatDate(summary?.lastUpdated ?? null)
            : summary?.[key as keyof BrandSummary] ?? 0;
          return (
            <Card key={key}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${cfg.bgColor}`}>
                    <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
                  </div>
                  <div>
                    {loading ? (
                      <div className="space-y-1.5">
                        <Skeleton className="h-5 w-8" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ) : (
                      <div className="contents">
                        <p className="text-xl font-bold leading-none">{value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{cfg.label}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Section Tabs */}
      <Tabs defaultValue="logos" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 h-10">
          <TabsTrigger value="logos" className="flex items-center gap-1.5 text-sm">
            <Image className="h-3.5 w-3.5" />
            Logos
          </TabsTrigger>
          <TabsTrigger value="colours" className="flex items-center gap-1.5 text-sm">
            <Palette className="h-3.5 w-3.5" />
            Colours
          </TabsTrigger>
          <TabsTrigger value="typography" className="flex items-center gap-1.5 text-sm">
            <Type className="h-3.5 w-3.5" />
            Typography
          </TabsTrigger>
          <TabsTrigger value="collateral" className="flex items-center gap-1.5 text-sm">
            <FolderOpen className="h-3.5 w-3.5" />
            Collateral
          </TabsTrigger>
          <TabsTrigger value="signatures" className="flex items-center gap-1.5 text-sm">
            <Mail className="h-3.5 w-3.5" />
            Signatures
          </TabsTrigger>
          <TabsTrigger value="guidelines" className="flex items-center gap-1.5 text-sm">
            <BookOpen className="h-3.5 w-3.5" />
            Guidelines
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logos">
          <LogosSection onUpdate={loadSummary} />
        </TabsContent>
        <TabsContent value="colours">
          <ColoursSection onUpdate={loadSummary} />
        </TabsContent>
        <TabsContent value="typography">
          <TypographySection onUpdate={loadSummary} />
        </TabsContent>
        <TabsContent value="collateral">
          <CollateralSection onUpdate={loadSummary} />
        </TabsContent>
        <TabsContent value="signatures">
          <React.Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-purple-600" /></div>}>
            <EmailSignatureGenerator />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="guidelines">
          <GuidelinesSection onUpdate={loadSummary} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// LOGOS SECTION
// ============================================================================

function LogosSection({ onUpdate }: { onUpdate: () => void }) {
  const [logos, setLogos] = useState<LogoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string>('primary');
  const [usageNotes, setUsageNotes] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewBg, setPreviewBg] = useState<'light' | 'dark' | 'brand'>('light');

  const loadLogos = useCallback(async () => {
    try {
      const data = await brandApi.getLogos();
      setLogos(data);
    } catch (err) {
      console.error('Failed to load logos:', err);
      toast.error('Failed to load logos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogos(); }, [loadLogos]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const variantLabel = LOGO_VARIANTS.find(v => v.value === selectedVariant)?.label || selectedVariant;
      const updated = await brandApi.uploadLogo(uploadFile, selectedVariant, variantLabel, usageNotes);
      setLogos(updated);
      setUploadOpen(false);
      setUploadFile(null);
      setUsageNotes('');
      onUpdate();
      toast.success('Logo uploaded successfully');
    } catch (err) {
      console.error('Logo upload failed:', err);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (variant: string) => {
    try {
      const updated = await brandApi.deleteLogo(variant);
      setLogos(updated);
      onUpdate();
      toast.success('Logo deleted');
    } catch (err) {
      console.error('Logo delete failed:', err);
      toast.error('Failed to delete logo');
    }
  };

  const bgClasses: Record<string, string> = {
    light: 'bg-white border',
    dark: 'bg-gray-900 border border-gray-800',
    brand: 'bg-purple-700 border border-purple-600',
  };

  if (loading) return <SectionSkeleton rows={3} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Logo Library</h3>
          <p className="text-sm text-muted-foreground">Upload and manage all brand logo variants.</p>
        </div>
          <div className="flex items-center gap-2">
          {/* Preview background toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            {(['light', 'dark', 'brand'] as const).map((bg) => (
              <button
                key={bg}
                onClick={() => setPreviewBg(bg)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  previewBg === bg
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" />
            Upload Logo
          </Button>
        </div>
      </div>

      {/* Logo Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {LOGO_VARIANTS.map((variant) => {
          const logo = logos.find(l => l.variant === variant.value);
          return (
            <Card key={variant.value} className={!logo ? 'border-dashed' : ''}>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{variant.label}</p>
                    <p className="text-xs text-muted-foreground">{variant.description}</p>
                  </div>
                  {logo && (
                    <div className="flex items-center gap-0.5">
                      {logo.signedUrl && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a href={logo.signedUrl} download={logo.fileName} target="_blank" rel="noopener noreferrer">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-purple-500 hover:text-purple-600 hover:bg-purple-50"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>Download</TooltipContent>
                        </Tooltip>
                      )}
                      {logo.source !== 'builtin' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDelete(variant.value)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  )}
                </div>

                {/* Preview */}
                <div className={`rounded-lg flex items-center justify-center h-24 ${bgClasses[previewBg]}`}>
                  {logo?.signedUrl ? (
                    <img
                      src={logo.signedUrl}
                      alt={logo.label}
                      className="max-h-16 max-w-full object-contain"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedVariant(variant.value);
                        setUploadOpen(true);
                      }}
                      className="flex flex-col items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <Upload className="h-5 w-5" />
                      <span className="text-xs">Upload</span>
                    </button>
                  )}
                </div>

                {/* Metadata */}
                {logo && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{logo.fileName}</span>
                    <span>{logo.source === 'builtin' ? 'Built-in pack' : `${(logo.fileSize / 1024).toFixed(0)} KB`}</span>
                  </div>
                )}
                {logo?.usageNotes && (
                  <p className="text-xs text-muted-foreground bg-gray-50 rounded px-2 py-1.5">{logo.usageNotes}</p>
                )}
                {logo?.source === 'builtin' && (
                  <Badge variant="secondary" className="text-[10px]">
                    Included by default
                  </Badge>
                )}
                {logo?.previousVersions && logo.previousVersions.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {logo.previousVersions.length} previous version{logo.previousVersions.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Logo</DialogTitle>
            <DialogDescription>
              Upload a logo variant. If a built-in or uploaded logo already exists for this variant, your upload will replace the visible version and archive the previous uploaded version.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Variant</Label>
              <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOGO_VARIANTS.map(v => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>File</Label>
              <Input
                type="file"
                accept="image/png,image/svg+xml,image/jpeg,application/pdf"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">PNG, SVG, JPG, or PDF. Recommended: SVG or transparent PNG.</p>
            </div>
            <div className="space-y-2">
              <Label>Usage Notes (optional)</Label>
              <Textarea
                value={usageNotes}
                onChange={(e) => setUsageNotes(e.target.value)}
                placeholder="e.g. Minimum width 120px, maintain 10px clear space..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// COLOURS SECTION
// ============================================================================

function ColoursSection({ onUpdate }: { onUpdate: () => void }) {
  const [palette, setPalette] = useState<ColourPalette | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newSwatch, setNewSwatch] = useState<Partial<ColourSwatch>>({
    name: '', hex: '#6d28d9', group: 'primary',
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

  useEffect(() => { loadPalette(); }, [loadPalette]);

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  const getContrastRatio = (hex: string): number => {
    const { r, g, b } = hexToRgb(hex);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance;
  };

  const handleAddSwatch = async () => {
    if (!newSwatch.name || !newSwatch.hex || !palette) return;
    const swatch: ColourSwatch = {
      id: crypto.randomUUID(),
      name: newSwatch.name!,
      hex: newSwatch.hex!,
      rgb: hexToRgb(newSwatch.hex!),
      group: newSwatch.group as ColourSwatch['group'] || 'primary',
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
      swatches: palette.swatches.filter(s => s.id !== id),
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
          <p className="text-sm text-muted-foreground">Define and manage the brand colour palette.</p>
        </div>
        <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Colour
        </Button>
      </div>

      {/* Colour groups */}
      {groups.map((group) => {
        const swatches = palette?.swatches.filter(s => s.group === group) || [];
        if (swatches.length === 0) return null;
        return (
          <div key={group} className="space-y-3">
            <h4 className="text-sm font-medium capitalize text-muted-foreground">{group} Colours</h4>
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
                          {copiedId === swatch.id + '-hex' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
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
                        onClick={() => copyToClipboard(`rgb(${swatch.rgb.r}, ${swatch.rgb.g}, ${swatch.rgb.b})`, swatch.id + '-rgb')}
                      >
                        RGB({swatch.rgb.r}, {swatch.rgb.g}, {swatch.rgb.b})
                        {copiedId === swatch.id + '-rgb' ? <Check className="h-2.5 w-2.5 text-green-500" /> : <Copy className="h-2.5 w-2.5" />}
                      </button>
                      {/* Contrast indicator */}
                      <div className="flex items-center gap-1.5">
                        <div className={`h-4 w-4 rounded text-[8px] font-bold flex items-center justify-center ${textColor}`} style={{ backgroundColor: swatch.hex }}>
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
            <p className="text-xs text-muted-foreground mt-1">Add your brand colours to build a consistent palette.</p>
            <Button size="sm" className="mt-4 bg-purple-600 hover:bg-purple-700" onClick={() => setAddOpen(true)}>
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
                onChange={(e) => setNewSwatch(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Navigate Purple"
              />
            </div>
            <div className="space-y-2">
              <Label>Colour</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={newSwatch.hex || '#6d28d9'}
                  onChange={(e) => setNewSwatch(prev => ({ ...prev, hex: e.target.value }))}
                  className="h-10 w-14 rounded border cursor-pointer"
                />
                <Input
                  value={newSwatch.hex || ''}
                  onChange={(e) => setNewSwatch(prev => ({ ...prev, hex: e.target.value }))}
                  placeholder="#6d28d9"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Group</Label>
              <Select
                value={newSwatch.group || 'primary'}
                onValueChange={(v) => setNewSwatch(prev => ({ ...prev, group: v as ColourSwatch['group'] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <div className="h-12 w-12 rounded-lg border" style={{ backgroundColor: newSwatch.hex }} />
                <div className="space-y-1">
                  <p className="text-sm font-medium">{newSwatch.name || 'Unnamed'}</p>
                  <p className="text-xs font-mono text-muted-foreground">{newSwatch.hex}</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleAddSwatch} disabled={!newSwatch.name || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Add Colour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// TYPOGRAPHY SECTION
// ============================================================================

function TypographySection({ onUpdate }: { onUpdate: () => void }) {
  const [config, setConfig] = useState<TypographyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editFont, setEditFont] = useState({ role: 'heading', family: '', weights: '400,500,700', fallback: 'sans-serif' });

  const loadConfig = useCallback(async () => {
    try {
      const data = await brandApi.getTypography();
      setConfig(data || {
        fonts: [],
        scale: [
          { token: 'h1', label: 'Heading 1', size: '2.25rem', lineHeight: '2.5rem', weight: 700 },
          { token: 'h2', label: 'Heading 2', size: '1.875rem', lineHeight: '2.25rem', weight: 600 },
          { token: 'h3', label: 'Heading 3', size: '1.5rem', lineHeight: '2rem', weight: 600 },
          { token: 'body', label: 'Body', size: '0.875rem', lineHeight: '1.25rem', weight: 400 },
          { token: 'small', label: 'Small', size: '0.75rem', lineHeight: '1rem', weight: 400 },
        ],
        notes: '',
        updatedAt: '',
        updatedBy: '',
      });
    } catch (err) {
      console.error('Failed to load typography:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleAddFont = async () => {
    if (!config || !editFont.family) return;
    const font = {
      id: crypto.randomUUID(),
      role: editFont.role as 'heading' | 'body' | 'mono' | 'display',
      family: editFont.family,
      weights: editFont.weights.split(',').map(w => parseInt(w.trim())).filter(Boolean),
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
      fonts: config.fonts.filter(f => f.id !== id),
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
        <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setEditOpen(true)}>
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
                  <Badge variant="outline" className="text-xs">{roleLabels[font.role] || font.role}</Badge>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => handleDeleteFont(font.id)}>
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
                    <Badge key={w} variant="secondary" className="text-[10px] font-mono">{w}</Badge>
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
              <div key={s.token} className="flex items-baseline justify-between border-b border-dashed pb-2 last:border-0 last:pb-0">
                <div className="flex items-baseline gap-3">
                  <Badge variant="outline" className="font-mono text-[10px] w-12 justify-center">{s.token}</Badge>
                  <span style={{ fontSize: s.size, lineHeight: s.lineHeight, fontWeight: s.weight }}>
                    {s.label}
                  </span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">{s.size} / {s.lineHeight}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Usage Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Usage Notes</CardTitle>
          <CardDescription className="text-xs">Rules and guidelines for typography usage.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config?.notes || ''}
            onChange={(e) => setConfig(prev => prev ? { ...prev, notes: e.target.value } : prev)}
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
              <Select value={editFont.role} onValueChange={(v) => setEditFont(prev => ({ ...prev, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                onChange={(e) => setEditFont(prev => ({ ...prev, family: e.target.value }))}
                placeholder="e.g. Inter, Roboto, Playfair Display"
              />
            </div>
            <div className="space-y-2">
              <Label>Weights (comma-separated)</Label>
              <Input
                value={editFont.weights}
                onChange={(e) => setEditFont(prev => ({ ...prev, weights: e.target.value }))}
                placeholder="400, 500, 700"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Fallback</Label>
              <Input
                value={editFont.fallback}
                onChange={(e) => setEditFont(prev => ({ ...prev, fallback: e.target.value }))}
                placeholder="sans-serif"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleAddFont} disabled={!editFont.family || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Add Font
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// COLLATERAL SECTION
// ============================================================================

function CollateralSection({ onUpdate }: { onUpdate: () => void }) {
  const [items, setItems] = useState<CollateralItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'other', description: '' });
  const [file, setFile] = useState<File | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const loadItems = useCallback(async () => {
    try {
      const data = await brandApi.getCollateral();
      setItems(data);
    } catch (err) {
      console.error('Failed to load collateral:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = useMemo(() => {
    let result = items;
    if (filter !== 'all') result = result.filter(i => i.category === filter);
    const q = search.trim().toLowerCase();
    if (q) result = result.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    return result;
  }, [items, filter, search]);

  const handleUpload = async () => {
    if (!file || !newItem.name) return;
    setUploading(true);
    try {
      const updated = await brandApi.uploadCollateral(file, newItem.name, newItem.category, newItem.description);
      setItems(updated);
      setUploadOpen(false);
      setFile(null);
      setNewItem({ name: '', category: 'other', description: '' });
      onUpdate();
      toast.success('File uploaded');
    } catch (err) {
      console.error('Collateral upload failed:', err);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const updated = await brandApi.deleteCollateral(id);
      setItems(updated);
      onUpdate();
      toast.success('File deleted');
    } catch (err) {
      toast.error('Failed to delete file');
    }
  };

  const getCategoryLabel = (cat: string) => COLLATERAL_CATEGORIES.find(c => c.value === cat)?.label || cat;

  const isImage = (mime: string) => mime.startsWith('image/');

  if (loading) return <SectionSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Brand Collateral</h3>
          <p className="text-sm text-muted-foreground">Letterheads, banners, templates, and other brand assets.</p>
        </div>
        <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-1.5" />
          Upload Asset
        </Button>
      </div>

      {/* Filters */}
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {COLLATERAL_CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Grid */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-sm">No collateral uploaded</p>
            <p className="text-xs text-muted-foreground mt-1">Upload brand assets like letterheads, banners, and templates.</p>
            <Button size="sm" className="mt-4 bg-purple-600 hover:bg-purple-700" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" />
              Upload First Asset
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm font-medium">No matching assets</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <Card key={item.id} className="overflow-hidden group">
              {/* Preview */}
              <div className="h-32 bg-gray-50 flex items-center justify-center border-b overflow-hidden relative">
                {item.signedUrl && isImage(item.mimeType) ? (
                  <img src={item.signedUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <FileText className="h-10 w-10 text-muted-foreground/30" />
                )}
                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  {item.signedUrl && (
                    <div className="contents">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a href={item.signedUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="icon" variant="secondary" className="h-8 w-8">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>Open</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a href={item.signedUrl} download={item.fileName} target="_blank" rel="noopener noreferrer">
                            <Button size="icon" variant="secondary" className="h-8 w-8">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>Download</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 text-red-600"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <CardContent className="pt-3 pb-3 space-y-1">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">{getCategoryLabel(item.category)}</Badge>
                  <span className="text-[10px] text-muted-foreground">{(item.fileSize / 1024).toFixed(0)} KB</span>
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Collateral</DialogTitle>
            <DialogDescription>Add a brand asset to the library.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Asset Name</Label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Email Header Banner - Q1 2026"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newItem.category} onValueChange={(v) => setNewItem(prev => ({ ...prev, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLLATERAL_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={newItem.description}
                onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this asset and its intended usage..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>File</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleUpload} disabled={!file || !newItem.name || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// GUIDELINES SECTION
// ============================================================================

function GuidelinesSection({ onUpdate }: { onUpdate: () => void }) {
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

  useEffect(() => { loadGuidelines(); }, [loadGuidelines]);

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
      setGuidelines(prev => prev ? { ...prev, rules } : null);
      setAddRuleOpen(false);
      setNewRule({ title: '', description: '' });
      onUpdate();
      toast.success('Rule added');
    } catch (err) {
      toast.error('Failed to add rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    const rules = (guidelines?.rules || []).filter(r => r.id !== id);
    try {
      await brandApi.saveGuidelineRules(rules);
      setGuidelines(prev => prev ? { ...prev, rules } : null);
      onUpdate();
      toast.success('Rule removed');
    } catch (err) {
      toast.error('Failed to remove rule');
    }
  };

  const handleSaveVoice = async () => {
    setSaving(true);
    try {
      await brandApi.saveGuidelineVoice(voiceDraft);
      setGuidelines(prev => prev ? { ...prev, voice: voiceDraft } : null);
      setVoiceEditing(false);
      onUpdate();
      toast.success('Brand voice saved');
    } catch (err) {
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
    } catch (err) {
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
          <p className="text-sm text-muted-foreground">Quick-reference rules, brand voice, and downloadable guidelines.</p>
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
                    {pdfUploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
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
              <CardDescription className="text-xs">Key brand rules for quick scanning.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setAddRuleOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No rules defined yet. Add quick-reference brand rules.</p>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg group">
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
              <CardDescription className="text-xs">Tone, terminology, and communication style.</CardDescription>
            </div>
            {!voiceEditing ? (
              <Button size="sm" variant="outline" onClick={() => { setVoiceDraft(voice); setVoiceEditing(true); }}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setVoiceEditing(false)}>Cancel</Button>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={handleSaveVoice} disabled={saving}>
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
                  onChange={(e) => setVoiceDraft(prev => ({ ...prev, tone: e.target.value }))}
                  placeholder="e.g. Professional, approachable, knowledgeable. Avoid jargon unless speaking to industry peers..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Preferred Terminology</Label>
                <Textarea
                  value={voiceDraft.terminology}
                  onChange={(e) => setVoiceDraft(prev => ({ ...prev, terminology: e.target.value }))}
                  placeholder="e.g. Use 'wealth planning' not 'financial planning'. Use 'clients' not 'customers'..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Additional Notes</Label>
                <Textarea
                  value={voiceDraft.notes}
                  onChange={(e) => setVoiceDraft(prev => ({ ...prev, notes: e.target.value }))}
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
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Tone</p>
                      <p className="text-sm">{voice.tone}</p>
                    </div>
                  )}
                  {voice.terminology && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Terminology</p>
                      <p className="text-sm">{voice.terminology}</p>
                    </div>
                  )}
                  {voice.notes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                      <p className="text-sm">{voice.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No brand voice guidelines defined yet.</p>
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
                onChange={(e) => setNewRule(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Minimum logo size: 30mm wide"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={newRule.description}
                onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Additional context or explanation..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRuleOpen(false)}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleAddRule} disabled={!newRule.title || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// SHARED SKELETON
// ============================================================================

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
