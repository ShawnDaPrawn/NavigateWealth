import { useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { Checkbox } from '../../../../ui/checkbox';
import { FileText, Mail, RefreshCw } from 'lucide-react';

/** Confirm deletion of a single document. */
export function DeleteDocumentDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Document</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this document? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Confirm deletion of a whole document pack (and its `count` documents). */
export function DeletePackDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Document Pack</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this pack? This will delete all <strong>{count}</strong>{' '}
            documents in it.
            <br />
            <br />
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete Pack
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Resend a document pack to the client with a WYSIWYG message. */
export function ResendPackDialog({
  open,
  onOpenChange,
  message,
  onMessageChange,
  ccAdmin,
  onCcAdminChange,
  sending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onMessageChange: (value: string) => void;
  ccAdmin: boolean;
  onCcAdminChange: (value: boolean) => void;
  sending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resend Document Pack</DialogTitle>
          <DialogDescription>Resend this document pack to the client via email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Message to Client</Label>
            <div className="h-64 mb-12">
              <ReactQuill
                value={message}
                onChange={onMessageChange}
                theme="snow"
                placeholder="Enter a message to the client..."
                style={{ height: '200px' }}
              />
            </div>
            <p className="text-xs text-muted-foreground pt-4">
              This message will be included in the email body. The documents will be attached as an
              encrypted ZIP file.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="cc-admin-resend"
              checked={ccAdmin}
              onCheckedChange={(checked) => onCcAdminChange(checked as boolean)}
            />
            <Label
              htmlFor="cc-admin-resend"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              CC info@navigatewealth.co
            </Label>
          </div>

          <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
            <span className="font-semibold">Secure attachment</span> — the documents are attached as
            an encrypted ZIP file. Password: the client&apos;s ID number.
          </p>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={sending}
            className="bg-[#6d28d9] hover:bg-[#5b21b6]"
          >
            {sending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Post-upload prompt: skip, or proceed to notify the client by email. */
export function UploadSuccessDialog({
  open,
  onOpenChange,
  uploadedCount,
  onSkip,
  onNotify,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadedCount: number;
  onSkip: () => void;
  onNotify: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 bg-green-100 rounded-full">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            Documents Uploaded Successfully
          </DialogTitle>
          <DialogDescription>
            {uploadedCount} document(s) have been added to the client's profile.
            <br />
            <br />
            Would you like to email the client to notify them?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onSkip}>
            Skip
          </Button>
          <Button onClick={onNotify} className="bg-[#6d28d9] hover:bg-[#5b21b6]">
            <Mail className="h-4 w-4 mr-2" />
            Yes, Notify Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Compose the client notification email (WYSIWYG) after an upload. */
export function EmailComposeDialog({
  open,
  onOpenChange,
  message,
  onMessageChange,
  ccAdmin,
  onCcAdminChange,
  sending,
  onSend,
  documents,
  selectedIds = [],
  onSelectedIdsChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onMessageChange: (value: string) => void;
  ccAdmin: boolean;
  onCcAdminChange: (value: boolean) => void;
  sending: boolean;
  onSend: () => void;
  /** When given, the adviser picks which documents to attach. */
  documents?: { id: string; title: string; meta?: string }[];
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
}) {
  const [attempted, setAttempted] = useState(false);
  const picking = !!documents && !!onSelectedIdsChange;
  const noneChosen = picking && selectedIds.length === 0;
  const toggle = (id: string) =>
    onSelectedIdsChange?.(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    );
  const handleSend = () => {
    setAttempted(true);
    if (noneChosen) return;
    onSend();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setAttempted(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email documents to client</DialogTitle>
          <DialogDescription>
            Notify the client that new documents have been added to their profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {picking && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Documents to attach{' '}
                <span className="font-normal text-nw-text-3">· {selectedIds.length} selected</span>
              </legend>
              {documents.length === 0 ? (
                <p className="text-sm text-nw-text-3">This client has no documents to attach.</p>
              ) : (
                <ul
                  className={`max-h-48 divide-y overflow-y-auto rounded-lg border ${
                    attempted && noneChosen ? 'border-red-400' : 'border-nw-line'
                  }`}
                  aria-invalid={attempted && noneChosen}
                >
                  {documents.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        id={`email-doc-${doc.id}`}
                        checked={selectedIds.includes(doc.id)}
                        onCheckedChange={() => toggle(doc.id)}
                      />
                      <Label htmlFor={`email-doc-${doc.id}`} className="min-w-0 flex-1 font-normal">
                        <span className="block truncate text-sm text-nw-ink">{doc.title}</span>
                        {doc.meta && (
                          <span className="block text-xs text-nw-text-3">{doc.meta}</span>
                        )}
                      </Label>
                    </li>
                  ))}
                </ul>
              )}
              {attempted && noneChosen && (
                <p className="text-xs text-red-700">Choose at least one document to attach</p>
              )}
            </fieldset>
          )}

          <div className="space-y-2">
            <Label>Custom message</Label>
            <div className="h-64 mb-12">
              <ReactQuill
                value={message}
                onChange={onMessageChange}
                theme="snow"
                placeholder="Enter a personal message to the client..."
                style={{ height: '200px' }}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-4">
            <Checkbox
              id="cc-admin"
              checked={ccAdmin}
              onCheckedChange={(checked) => onCcAdminChange(checked as boolean)}
            />
            <Label
              htmlFor="cc-admin"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              CC info@navigatewealth.co
            </Label>
          </div>

          <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
            <span className="font-semibold">Secure attachment</span> — the documents are attached as
            an encrypted ZIP file. Password: the client&apos;s ID number.
          </p>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <div className="contents">
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </div>
            ) : (
              <div className="contents">
                <Mail className="h-4 w-4 mr-2" />
                Send email
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
