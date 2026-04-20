/**
 * P3.3 — Page Manager Dialog
 * ============================================================================
 * Sender-side UI for reordering, deleting, and rotating pages of the
 * uploaded PDF *before* sending. Operates on a transformation manifest
 * (see `esign-pdf-transform.ts`) so the original PDF is preserved on disk
 * for audit purposes.
 *
 * Rendering: we use pdfjs-dist client-side to render thumbnails of each
 * page from the original document URL. Drag-and-drop reordering uses
 * @hello-pangea/dnd to match the rest of the admin module's DnD style.
 *
 * The dialog is a controlled component — state lives here, the parent
 * studio just opens/closes it and reacts to the `onApplied` callback when
 * the sender saves.
 * ============================================================================
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, RotateCw, Loader2, AlertTriangle, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { ScrollArea } from '../../../../ui/scroll-area';
import { toast } from 'sonner';
import { esignApi, type PageManifestPayload } from '../api';

interface PageManagerDialogProps {
  open: boolean;
  onClose: () => void;
  envelopeId: string;
  /** Source PDF URL — used to render thumbnails. */
  documentUrl: string;
  /** Original page count of the source PDF. */
  sourcePageCount: number;
  /** Called after the sender successfully saves a manifest. */
  onApplied?: (newPageCount: number, pageMap: Record<number, number | null>) => void;
}

interface PageEntry {
  /** 1-based source page index. */
  sourcePage: number;
  /** Rotation applied on output. */
  rotation: 0 | 90 | 180 | 270;
  /** Stable key for DnD — survives reorder. */
  uid: string;
}

export function PageManagerDialog({
  open,
  onClose,
  envelopeId,
  documentUrl,
  sourcePageCount,
  onApplied,
}: PageManagerDialogProps) {
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  // Cache the existing manifest so cancelling restores it on next open.
  const initialManifestRef = useRef<PageManifestPayload | null>(null);

  // ── Load existing manifest (if any) on open ──
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const { manifest } = await esignApi.getPageManifest(envelopeId);
        if (cancelled) return;
        initialManifestRef.current = manifest;
        if (manifest) {
          setPages(
            manifest.pages.map((p, i) => ({
              sourcePage: p.sourcePage,
              rotation: p.rotation,
              uid: `p-${i}-${p.sourcePage}-${Date.now()}`,
            })),
          );
        } else {
          // Identity manifest — original order, no rotation.
          setPages(
            Array.from({ length: sourcePageCount }, (_, i) => ({
              sourcePage: i + 1,
              rotation: 0 as const,
              uid: `p-${i + 1}-${Date.now()}`,
            })),
          );
        }
      } catch (err) {
        toast.error('Failed to load page manifest');
        // eslint-disable-next-line no-console
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, envelopeId, sourcePageCount]);

  // ── Render thumbnails on open ──
  useEffect(() => {
    if (!open || !documentUrl) return;
    let cancelled = false;
    setLoadingThumbs(true);
    void (async () => {
      try {
        // Lazy-import pdfjs — heavy module, no need on first paint.
        // @ts-ignore — pdfjs-dist's legacy build provides a worker-free entry.
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        // @ts-ignore — disable the worker so we don't have to ship one.
        pdfjs.GlobalWorkerOptions.workerSrc = '';
        const loadingTask = pdfjs.getDocument({ url: documentUrl, isEvalSupported: false });
        const doc = await loadingTask.promise;
        const out: Record<number, string> = {};
        for (let p = 1; p <= doc.numPages; p++) {
          if (cancelled) return;
          const page = await doc.getPage(p);
          const viewport = page.getViewport({ scale: 0.25 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          out[p] = canvas.toDataURL('image/png');
        }
        if (!cancelled) setThumbnails(out);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Thumbnail render failed:', err);
      } finally {
        if (!cancelled) setLoadingThumbs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, documentUrl]);

  const isModified = useMemo(() => {
    const initial = initialManifestRef.current;
    if (!initial) {
      return !pages.every((p, i) => p.sourcePage === i + 1 && p.rotation === 0);
    }
    if (initial.pages.length !== pages.length) return true;
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].sourcePage !== initial.pages[i].sourcePage) return true;
      if (pages[i].rotation !== initial.pages[i].rotation) return true;
    }
    return false;
  }, [pages]);

  // ── Mutations ──
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const next = [...pages];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setPages(next);
  };

  const rotatePage = (uid: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.uid === uid ? { ...p, rotation: (((p.rotation + 90) % 360) as 0 | 90 | 180 | 270) } : p,
      ),
    );
  };

  const removePage = (uid: string) => setPages((prev) => prev.filter((p) => p.uid !== uid));

  const handleSave = async () => {
    if (pages.length === 0) {
      toast.error('Envelope must contain at least one page.');
      return;
    }
    setSaving(true);
    try {
      const manifest: PageManifestPayload = {
        version: 1,
        pages: pages.map((p) => ({ sourcePage: p.sourcePage, rotation: p.rotation })),
      };
      await esignApi.savePageManifest(envelopeId, manifest);
      // Build pageMap (old → new). First occurrence wins.
      const pageMap: Record<number, number | null> = {};
      for (let p = 1; p <= sourcePageCount; p++) pageMap[p] = null;
      pages.forEach((p, i) => {
        if (pageMap[p.sourcePage] == null) pageMap[p.sourcePage] = i + 1;
      });
      onApplied?.(pages.length, pageMap);
      toast.success('Page changes saved');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save page changes';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const manifest: PageManifestPayload = {
        version: 1,
        pages: pages.map((p) => ({ sourcePage: p.sourcePage, rotation: p.rotation })),
      };
      const { url } = await esignApi.materializePagePreview(envelopeId, manifest);
      setPreviewUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Preview failed';
      toast.error(msg);
    } finally {
      setPreviewing(false);
    }
  };

  const handleReset = () => {
    setPages(
      Array.from({ length: sourcePageCount }, (_, i) => ({
        sourcePage: i + 1,
        rotation: 0 as const,
        uid: `reset-${i + 1}-${Date.now()}`,
      })),
    );
  };

  // Pages dropped from the original — surfaced as a small warning so the
  // sender knows fields placed on those pages will be removed at send-time.
  const droppedSourcePages = useMemo(() => {
    const present = new Set(pages.map((p) => p.sourcePage));
    const missing: number[] = [];
    for (let p = 1; p <= sourcePageCount; p++) if (!present.has(p)) missing.push(p);
    return missing;
  }, [pages, sourcePageCount]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-5 py-3 border-b">
          <DialogTitle>Manage pages</DialogTitle>
          <DialogDescription>
            Drag to reorder · click rotate · delete pages you don't need. The original PDF stays
            on file for audit.
          </DialogDescription>
        </DialogHeader>

        {droppedSourcePages.length > 0 && (
          <div className="mx-5 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-amber-900">
                {droppedSourcePages.length} source page{droppedSourcePages.length === 1 ? '' : 's'}{' '}
                will be removed
              </div>
              <div className="text-xs text-amber-700/80">
                Pages {droppedSourcePages.slice(0, 8).join(', ')}
                {droppedSourcePages.length > 8 && '…'}. Any fields placed on these pages will be
                dropped at send-time.
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 px-5 py-3">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="pages" direction="horizontal" type="page">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
                >
                  <AnimatePresence>
                    {pages.map((p, index) => (
                      <Draggable key={p.uid} draggableId={p.uid} index={index}>
                        {(prov, snap) => (
                          <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            className={`group relative bg-white border rounded-lg overflow-hidden shadow-sm transition ${
                              snap.isDragging ? 'ring-2 ring-purple-500 shadow-lg' : 'hover:shadow-md'
                            }`}
                          >
                            <div className="aspect-[1/1.4] bg-gray-100 flex items-center justify-center overflow-hidden">
                              {thumbnails[p.sourcePage] ? (
                                <img
                                  src={thumbnails[p.sourcePage]}
                                  alt={`Page ${p.sourcePage}`}
                                  style={{ transform: `rotate(${p.rotation}deg)` }}
                                  className="max-w-full max-h-full object-contain transition-transform"
                                />
                              ) : (
                                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                              )}
                            </div>
                            <div className="px-2 py-1.5 text-xs flex items-center justify-between border-t bg-white">
                              <span className="text-gray-600">
                                #{index + 1} <span className="text-gray-400">(src {p.sourcePage})</span>
                              </span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button
                                  type="button"
                                  onClick={() => rotatePage(p.uid)}
                                  className="p-1 rounded hover:bg-gray-100 text-gray-600"
                                  title="Rotate 90°"
                                >
                                  <RotateCw className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removePage(p.uid)}
                                  className="p-1 rounded hover:bg-red-50 text-red-600"
                                  title="Delete page"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </Draggable>
                    ))}
                  </AnimatePresence>
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {loadingThumbs && (
            <div className="text-xs text-gray-500 mt-3">Rendering thumbnails…</div>
          )}
        </ScrollArea>

        {/* Preview pane — shown only after the sender hits Preview. */}
        {previewUrl && (
          <div className="mx-5 mb-3 border rounded overflow-hidden bg-gray-50">
            <div className="px-3 py-1.5 text-xs text-gray-600 border-b flex items-center justify-between">
              <span>Materialised preview</span>
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="text-gray-500 hover:text-gray-800"
              >
                Close preview
              </button>
            </div>
            <iframe
              src={previewUrl}
              title="Materialised preview"
              className="w-full h-64 bg-white"
            />
          </div>
        )}

        <DialogFooter className="px-5 py-3 border-t flex flex-row items-center gap-2">
          <Button variant="ghost" onClick={handleReset} disabled={saving}>
            Reset to original
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={saving || previewing || !isModified}
          >
            {previewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
            Preview
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !isModified}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
