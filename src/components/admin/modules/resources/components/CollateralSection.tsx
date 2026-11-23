import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Upload, FileText, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { brandApi, COLLATERAL_CATEGORIES } from './brand-api';
import type { CollateralItem } from './brand-api';
import { SectionSkeleton } from './CorporateIdentitySkeleton';
import { DsButton, DsChipSelect, DsState, useConfirm, ErrorState } from '../../../layout/page';

export function CollateralSection({ onUpdate }: { onUpdate: () => void }) {
  const { confirm: askConfirm, confirmDialog } = useConfirm();
  const [items, setItems] = useState<CollateralItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      console.error('Failed to load collateral:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filtered = useMemo(() => {
    let result = items;
    if (filter !== 'all') result = result.filter((i) => i.category === filter);
    const q = search.trim().toLowerCase();
    if (q)
      result = result.filter(
        (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
      );
    return result;
  }, [items, filter, search]);

  const handleUpload = async () => {
    if (!file || !newItem.name) return;
    setUploading(true);
    try {
      const updated = await brandApi.uploadCollateral(
        file,
        newItem.name,
        newItem.category,
        newItem.description,
      );
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
    const ok = await askConfirm({
      title: 'Delete this file?',
      description: 'It is removed from the brand library for everyone.',
      confirmLabel: 'Delete file',
      destructive: true,
    });
    if (!ok) return;
    try {
      const updated = await brandApi.deleteCollateral(id);
      setItems(updated);
      onUpdate();
      toast.success('File deleted');
    } catch (_err) {
      toast.error('Failed to delete file');
    }
  };

  const getCategoryLabel = (cat: string) =>
    COLLATERAL_CATEGORIES.find((c) => c.value === cat)?.label || cat;

  const isImage = (mime: string) => mime.startsWith('image/');

  if (loading) return <SectionSkeleton rows={4} />;
  if (loadError) {
    return (
      <ErrorState
        title="Unable to load collateral"
        onRetry={() => void loadItems()}
        details={loadError}
      />
    );
  }

  return (
    // RE-CI-Collateral: one "Brand collateral" card, upload in its header
    <section className="ds-card overflow-hidden">
      <div className="ds-card-h">
        <h3>Brand collateral</h3>
        <DsButton size="sm" variant="primary" onClick={() => setUploadOpen(true)}>
          Upload collateral
        </DsButton>
      </div>

      {items.length > 0 && (
        <div className="ds-toolbar flex-wrap">
          <input
            className="ds-input w-full sm:w-auto sm:min-w-[240px]"
            placeholder="Search assets…"
            aria-label="Search assets"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <DsChipSelect
            label="Category"
            anyLabel="All categories"
            value={filter}
            options={COLLATERAL_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            onChange={setFilter}
          />
        </div>
      )}

      {items.length === 0 ? (
        <DsState title="No collateral yet" className="min-h-[220px]">
          Brochures, presentation templates and letterheads live here.
        </DsState>
      ) : filtered.length === 0 ? (
        <DsState title="No matching assets" />
      ) : (
        <div className="ds-card-b grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col overflow-hidden rounded-[10px] border border-nw-line bg-white"
            >
              <div className="flex h-32 items-center justify-center overflow-hidden border-b border-nw-line bg-[#fbfaf7]">
                {item.signedUrl && isImage(item.mimeType) ? (
                  <img
                    src={item.signedUrl}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <FileText className="h-10 w-10 text-nw-text-3/40" aria-hidden="true" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <b className="truncate text-[13.5px] font-medium text-nw-ink">{item.name}</b>
                <span className="ds-meta">
                  {getCategoryLabel(item.category)} · {(item.fileSize / 1024).toFixed(0)} KB
                </span>
                {item.description && (
                  <span className="ds-meta line-clamp-2">{item.description}</span>
                )}
                <div className="mt-auto flex flex-wrap gap-1 pt-1.5">
                  {item.signedUrl && (
                    <>
                      <a
                        className="ds-btn ds-btn-sm"
                        href={item.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open
                      </a>
                      <a
                        className="ds-btn ds-btn-sm"
                        href={item.signedUrl}
                        download={item.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                      </a>
                    </>
                  )}
                  <DsButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </DsButton>
                </div>
              </div>
            </div>
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
                onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Email Header Banner - Q1 2026"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={newItem.category}
                onValueChange={(v) => setNewItem((prev) => ({ ...prev, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLLATERAL_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={newItem.description}
                onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
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
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleUpload}
              disabled={!file || !newItem.name || uploading}
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
      {confirmDialog}
    </section>
  );
}
