import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
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
import {
  Upload,
  Search,
  FolderOpen,
  FileText,
  ExternalLink,
  Download,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { brandApi, COLLATERAL_CATEGORIES } from './brand-api';
import type { CollateralItem } from './brand-api';
import { SectionSkeleton } from './CorporateIdentitySkeleton';

export function CollateralSection({ onUpdate }: { onUpdate: () => void }) {
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
    try {
      const updated = await brandApi.deleteCollateral(id);
      setItems(updated);
      onUpdate();
      toast.success('File deleted');
    } catch (err) {
      toast.error('Failed to delete file');
    }
  };

  const getCategoryLabel = (cat: string) =>
    COLLATERAL_CATEGORIES.find((c) => c.value === cat)?.label || cat;

  const isImage = (mime: string) => mime.startsWith('image/');

  if (loading) return <SectionSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Brand Collateral</h3>
          <p className="text-sm text-muted-foreground">
            Letterheads, banners, templates, and other brand assets.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-purple-600 hover:bg-purple-700"
          onClick={() => setUploadOpen(true)}
        >
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
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {COLLATERAL_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
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
            <p className="text-xs text-muted-foreground mt-1">
              Upload brand assets like letterheads, banners, and templates.
            </p>
            <Button
              size="sm"
              className="mt-4 bg-purple-600 hover:bg-purple-700"
              onClick={() => setUploadOpen(true)}
            >
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
                  <img
                    src={item.signedUrl}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain"
                  />
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
                          <a
                            href={item.signedUrl}
                            download={item.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
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
                  <Badge variant="outline" className="text-[10px]">
                    {getCategoryLabel(item.category)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {(item.fileSize / 1024).toFixed(0)} KB
                  </span>
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
    </div>
  );
}
