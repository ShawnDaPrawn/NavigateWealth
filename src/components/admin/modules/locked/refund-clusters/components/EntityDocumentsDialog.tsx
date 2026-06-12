/**
 * Documents dialog for a refund-cluster entity.
 *
 * Shows the required verification/identity document slots for the entity
 * type (sole proprietor vs company), with upload, view (signed URL) and
 * delete actions. The server validates file type/size and audits every
 * upload, view and deletion.
 */

import { useRef, useState } from 'react';
import { ExternalLink, FileText, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../../ui/alert-dialog';
import {
  ALLOWED_FILE_ACCEPT,
  MAX_FILE_BYTES,
  documentTypeLabel,
  documentTypesFor,
} from '../constants';
import { entityDisplayName } from '../formState';
import {
  useDeleteDocument,
  useEntityDocuments,
  useUploadDocument,
  useViewDocument,
} from '../hooks/useRefundClusters';
import type { RefundEntity, RefundEntityDocument } from '../types';

interface EntityDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: RefundEntity | null;
}

export function EntityDocumentsDialog({ open, onOpenChange, entity }: EntityDocumentsDialogProps) {
  const { data: documents = [], isLoading } = useEntityDocuments(
    entity?.clusterId ?? '',
    open ? (entity?.id ?? null) : null,
  );
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const view = useViewDocument();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RefundEntityDocument | null>(null);

  if (!entity) return null;

  const slots = documentTypesFor(entity.entityType);
  const docsByType = new Map<string, RefundEntityDocument[]>();
  for (const doc of documents) {
    const list = docsByType.get(doc.documentType) ?? [];
    list.push(doc);
    docsByType.set(doc.documentType, list);
  }

  const startUpload = (documentType: string) => {
    setPendingType(documentType);
    fileInputRef.current?.click();
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingType) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('File too large', { description: 'The maximum file size is 10MB.' });
      return;
    }
    upload.mutate({
      clusterId: entity.clusterId,
      entityId: entity.id,
      documentType: pendingType,
      file,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documents — {entityDisplayName(entity)}</DialogTitle>
            <DialogDescription>
              Upload supporting documents (PDF, JPEG or PNG, max 10MB). Files are stored in a
              private bucket and every view is audit-logged.
            </DialogDescription>
          </DialogHeader>

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_FILE_ACCEPT}
            className="hidden"
            onChange={handleFileChosen}
            aria-label="Choose document file"
          />

          <div className="space-y-3">
            {slots.map((slot) => {
              const slotDocs = docsByType.get(slot.value) ?? [];
              return (
                <div key={slot.value} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{slot.label}</span>
                      {slotDocs.length > 0 ? (
                        <Badge variant="secondary">
                          {slotDocs.length} file{slotDocs.length === 1 ? '' : 's'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Missing</Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => startUpload(slot.value)}
                      disabled={upload.isPending}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      {upload.isPending && pendingType === slot.value ? 'Uploading…' : 'Upload'}
                    </Button>
                  </div>
                  {slotDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-2 text-sm bg-muted/40 rounded px-2 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{doc.fileName}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`View ${doc.fileName}`}
                          onClick={() =>
                            view.mutate({
                              clusterId: entity.clusterId,
                              entityId: entity.id,
                              docId: doc.id,
                            })
                          }
                          disabled={view.isPending}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${doc.fileName}`}
                          onClick={() => setDeleteTarget(doc)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {isLoading && <p className="text-sm text-muted-foreground">Loading documents…</p>}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget &&
                `"${deleteTarget.fileName}" (${documentTypeLabel(
                  entity.entityType,
                  deleteTarget.documentType,
                )}) will be permanently removed. This action is audit-logged.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  remove.mutate({
                    clusterId: entity.clusterId,
                    entityId: entity.id,
                    docId: deleteTarget.id,
                  });
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
