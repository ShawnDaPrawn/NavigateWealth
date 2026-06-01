import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/tooltip';
import { Upload, FileText, Search, Download, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { brandApi, LOGO_THEME_GROUPS, LOGO_VARIANTS } from './brand-api';
import type { LogoEntry, LogoAssetFormat } from './brand-api';
import { SectionSkeleton } from './CorporateIdentitySkeleton';

const LOGO_UPLOAD_FIELDS: Array<{
  format: LogoAssetFormat;
  label: string;
  accept: string;
  helper: string;
}> = [
  {
    format: 'png',
    label: 'PNG',
    accept: 'image/png',
    helper: 'Used for the live card and modal preview.',
  },
  {
    format: 'jpeg',
    label: 'JPEG',
    accept: 'image/jpeg,image/jpg',
    helper: 'Optional flat export for sharing.',
  },
  {
    format: 'svg',
    label: 'SVG',
    accept: 'image/svg+xml',
    helper: 'Optional vector master for scaling.',
  },
  {
    format: 'pdf',
    label: 'PDF',
    accept: 'application/pdf',
    helper: 'Optional print or approval file.',
  },
];

const TRANSPARENT_PREVIEW_STYLE: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  backgroundImage: `
    linear-gradient(45deg, rgba(148,163,184,0.18) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(148,163,184,0.18) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(148,163,184,0.18) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(148,163,184,0.18) 75%)
  `,
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
  backgroundSize: '20px 20px',
};

export function LogosSection({ onUpdate }: { onUpdate: () => void }) {
  const createEmptyUploadFiles = (): Partial<Record<LogoAssetFormat, File | null>> => ({
    png: null,
    jpeg: null,
    svg: null,
    pdf: null,
  });

  const [logos, setLogos] = useState<LogoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string>(LOGO_VARIANTS[0].value);
  const [isUploadSlotLocked, setIsUploadSlotLocked] = useState(false);
  const [usageNotes, setUsageNotes] = useState('');
  const [uploadFiles, setUploadFiles] =
    useState<Partial<Record<LogoAssetFormat, File | null>>>(createEmptyUploadFiles);
  const [uploading, setUploading] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<{
    logo: LogoEntry;
    variant: (typeof LOGO_VARIANTS)[number];
  } | null>(null);

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

  useEffect(() => {
    loadLogos();
  }, [loadLogos]);

  const logosByVariant = useMemo(() => new Map(logos.map((logo) => [logo.variant, logo])), [logos]);

  const selectedVariantConfig = useMemo(
    () => LOGO_VARIANTS.find((variant) => variant.value === selectedVariant) ?? LOGO_VARIANTS[0],
    [selectedVariant],
  );

  const openUploadDialog = useCallback(
    (variant: string, options?: { lockSlot?: boolean }) => {
      const existingLogo = logosByVariant.get(variant as LogoEntry['variant']);
      setSelectedVariant(variant);
      setUploadFiles(createEmptyUploadFiles());
      setUsageNotes(existingLogo?.usageNotes ?? '');
      setIsUploadSlotLocked(options?.lockSlot ?? false);
      setUploadOpen(true);
    },
    [logosByVariant],
  );

  const handleUpload = async () => {
    const hasSelectedFile = Object.values(uploadFiles).some(Boolean);
    if (!hasSelectedFile) return;
    setUploading(true);
    try {
      const variantLabel =
        LOGO_VARIANTS.find((v) => v.value === selectedVariant)?.label || selectedVariant;
      const updated = await brandApi.uploadLogo(
        uploadFiles,
        selectedVariant,
        variantLabel,
        usageNotes,
      );
      setLogos(updated);
      setUploadOpen(false);
      setUploadFiles(createEmptyUploadFiles());
      setIsUploadSlotLocked(false);
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

  const handleUploadDialogChange = (open: boolean) => {
    setUploadOpen(open);
    if (!open) {
      setUploadFiles(createEmptyUploadFiles());
      setIsUploadSlotLocked(false);
    }
  };

  const renderLogoPreview = (logo: LogoEntry | undefined, emptyLabel: string) => {
    if (!logo) {
      return (
        <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
          <Upload className="h-5 w-5" />
          <span className="text-xs">{emptyLabel}</span>
        </div>
      );
    }

    if (logo.signedUrl && logo.mimeType.startsWith('image/')) {
      return (
        <div
          className="flex h-full w-full items-center justify-center rounded-lg p-3"
          style={TRANSPARENT_PREVIEW_STYLE}
        >
          <img
            src={logo.signedUrl}
            alt={logo.label}
            className="max-h-20 max-w-full object-contain drop-shadow-[0_6px_16px_rgba(15,23,42,0.18)]"
          />
        </div>
      );
    }

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-slate-600">
        <FileText className="h-6 w-6" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {logo.mimeType === 'application/pdf' ? 'PDF Asset' : 'Preview unavailable'}
        </span>
        <span className="text-[11px] text-muted-foreground">{logo.fileName}</span>
      </div>
    );
  };

  if (loading) return <SectionSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Logo Library</h3>
          <p className="text-sm text-muted-foreground">
            Manage each logo slot by theme, including quick preview, detailed preview, download, and
            replacement uploads.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-purple-600 hover:bg-purple-700"
          onClick={() => openUploadDialog(LOGO_VARIANTS[0].value)}
        >
          <Upload className="h-4 w-4 mr-1.5" />
          Upload Asset
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {LOGO_THEME_GROUPS.map((themeGroup) => {
          const themeVariants = LOGO_VARIANTS.filter(
            (variant) => variant.theme === themeGroup.value,
          );
          return (
            <Card key={themeGroup.value}>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">{themeGroup.label}</CardTitle>
                <CardDescription>{themeGroup.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {themeVariants.map((variant) => {
                    const logo = logosByVariant.get(variant.value);
                    return (
                      <Card key={variant.value} className={!logo ? 'border-dashed' : ''}>
                        <CardContent className="pt-4 pb-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{variant.label}</p>
                              <p className="text-xs text-muted-foreground">{variant.description}</p>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              {logo && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                      onClick={() => setPreviewTarget({ logo, variant })}
                                    >
                                      <Search className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Preview</TooltipContent>
                                </Tooltip>
                              )}
                              {logo?.signedUrl && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <a
                                      href={logo.signedUrl}
                                      download={logo.fileName}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
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
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                    onClick={() =>
                                      openUploadDialog(variant.value, { lockSlot: true })
                                    }
                                  >
                                    <Upload className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{logo ? 'Replace' : 'Upload'}</TooltipContent>
                              </Tooltip>
                              {logo && (
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
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              logo
                                ? setPreviewTarget({ logo, variant })
                                : openUploadDialog(variant.value, { lockSlot: true })
                            }
                            className="w-full rounded-lg flex items-center justify-center h-28 transition-colors"
                          >
                            {renderLogoPreview(logo, `Upload ${variant.label}`)}
                          </button>

                          {logo ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground gap-3">
                                <span className="truncate">{logo.fileName}</span>
                                <span className="flex-shrink-0">{`${(logo.fileSize / 1024).toFixed(0)} KB`}</span>
                              </div>
                              {logo.assets?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {logo.assets.map((asset) => (
                                    <Badge
                                      key={`${logo.id}-${asset.format}`}
                                      variant="outline"
                                      className="text-[10px] uppercase"
                                    >
                                      {asset.format}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {logo.usageNotes && (
                                <p className="text-xs text-muted-foreground bg-gray-50 rounded px-2 py-1.5">
                                  {logo.usageNotes}
                                </p>
                              )}
                              {logo.previousVersions && logo.previousVersions.length > 0 && (
                                <Badge variant="outline" className="text-[10px]">
                                  {logo.previousVersions.length} previous version
                                  {logo.previousVersions.length > 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              No file uploaded yet. Use the upload action to add this theme asset.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={handleUploadDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Logo Asset</DialogTitle>
            <DialogDescription>
              {isUploadSlotLocked
                ? `Upload files for ${selectedVariantConfig.label}. You already picked the slot, so this upload will stay locked to it.`
                : `Upload files for ${selectedVariantConfig.label}. Choose the slot here only when you start from the generic upload button.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isUploadSlotLocked ? (
              <div className="rounded-lg border bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Upload Slot</p>
                <p className="text-sm font-medium">{`${selectedVariantConfig.theme === 'light' ? 'Light' : 'Dark'} - ${selectedVariantConfig.label}`}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Upload Slot</Label>
                <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOGO_VARIANTS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {`${v.theme === 'light' ? 'Light' : 'Dark'} - ${v.label}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              {LOGO_UPLOAD_FIELDS.map((field) => (
                <div key={field.format} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Input
                    type="file"
                    accept={field.accept}
                    onChange={(e) =>
                      setUploadFiles((current) => ({
                        ...current,
                        [field.format]: e.target.files?.[0] || null,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">{field.helper}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Transparent PNG is used for the card preview whenever one is provided.
            </p>
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
            <Button variant="outline" onClick={() => handleUploadDialogChange(false)}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleUpload}
              disabled={!Object.values(uploadFiles).some(Boolean) || uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detailed Preview Dialog */}
      <Dialog
        open={!!previewTarget}
        onOpenChange={(open) => {
          if (!open) setPreviewTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          {previewTarget && (
            <>
              <DialogHeader>
                <DialogTitle>{`${previewTarget.variant.theme === 'light' ? 'Light Theme' : 'Dark Theme'} - ${previewTarget.variant.label}`}</DialogTitle>
                <DialogDescription>{previewTarget.variant.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-xl min-h-[360px] p-8" style={TRANSPARENT_PREVIEW_STYLE}>
                  <div className="flex min-h-[296px] items-center justify-center rounded-xl border border-slate-200 bg-white/70 p-8 backdrop-blur-sm">
                    {previewTarget.logo.signedUrl &&
                    previewTarget.logo.mimeType.startsWith('image/') ? (
                      <img
                        src={previewTarget.logo.signedUrl}
                        alt={previewTarget.logo.label}
                        className="max-h-[320px] max-w-full object-contain drop-shadow-[0_8px_24px_rgba(15,23,42,0.2)]"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-center text-slate-600">
                        <FileText className="h-10 w-10" />
                        <p className="text-sm font-medium">{previewTarget.logo.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          This asset type does not render inline here. Use the download action
                          below.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      File
                    </p>
                    <p className="font-medium break-all">{previewTarget.logo.fileName}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Size
                    </p>
                    <p className="font-medium">{`${(previewTarget.logo.fileSize / 1024).toFixed(0)} KB`}</p>
                  </div>
                </div>
                {previewTarget.logo.usageNotes && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Usage Notes
                    </p>
                    <p className="text-sm text-muted-foreground">{previewTarget.logo.usageNotes}</p>
                  </div>
                )}
                {previewTarget.logo.assets?.length > 0 && (
                  <div className="rounded-lg border p-3 space-y-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Available Files
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {previewTarget.logo.assets.map((asset) =>
                        asset.signedUrl ? (
                          <a
                            key={`${previewTarget.logo.id}-${asset.format}`}
                            href={asset.signedUrl}
                            download={asset.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm" className="uppercase">
                              <Download className="h-4 w-4 mr-1.5" />
                              {asset.format}
                            </Button>
                          </a>
                        ) : null,
                      )}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                {previewTarget.logo.signedUrl && (
                  <a
                    href={previewTarget.logo.signedUrl}
                    download={previewTarget.logo.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-1.5" />
                      Download
                    </Button>
                  </a>
                )}
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    openUploadDialog(previewTarget.variant.value, { lockSlot: true });
                    setPreviewTarget(null);
                  }}
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  Replace
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
