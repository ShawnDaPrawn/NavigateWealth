/**
 * CommunicationDetailDialog — View Communication Details
 *
 * Displays full communication content, metadata, attachments,
 * and provides a delete action.
 */

import DOMPurify from 'dompurify';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../../ui/dialog';
import { User, Clock, Paperclip, FileText, Send, Trash2, Users, AlertTriangle } from 'lucide-react';
import type { CommunicationLog, AttachmentFile } from '../../../communication';

export interface CommunicationDetailDialogProps {
  communication: CommunicationLog | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function CommunicationDetailDialog({
  communication,
  onClose,
  onDelete,
}: CommunicationDetailDialogProps) {
  if (!communication) return null;

  const handleDownload = (att: AttachmentFile) => {
    if (att.url) {
      window.open(att.url, '_blank');
    } else if ((att as AttachmentFile & { content?: string }).content) {
      const link = document.createElement('a');
      link.href = (att as AttachmentFile & { content?: string }).content!;
      link.download = att.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const hasDownload = (att: AttachmentFile): boolean => {
    return !!(att.url || (att as AttachmentFile & { content?: string }).content);
  };

  return (
    <Dialog open={!!communication} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] overflow-y-auto">
        <div className="contents">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {communication.subject}
            </DialogTitle>
            <div className="flex flex-col gap-1 pt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>
                  From: <strong>{communication.sender_name || 'Navigate Wealth Admin'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {new Date(communication.created_at).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {communication.cc && communication.cc.length > 0 && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="break-words">
                    CC: <strong>{communication.cc.join(', ')}</strong>
                  </span>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {/* Delivery failure — the admin needs to know the email did not land */}
            {(communication.email_status === 'failed' ||
              communication.email_status === 'rejected') && (
              <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">
                    {communication.email_status === 'rejected'
                      ? 'The email provider rejected this message'
                      : 'The email could not be delivered'}
                  </p>
                  {communication.email_error && (
                    <p className="mt-1 break-words">{communication.email_error}</p>
                  )}
                  <p className="mt-1 text-red-700">
                    It is still available to the client in their portal inbox.
                  </p>
                </div>
              </div>
            )}

            {/* Body */}
            <div className="prose prose-sm max-w-none p-4 bg-slate-50 rounded-md border text-slate-800">
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(communication.content || communication.body || ''),
                }}
              />
            </div>

            {/* Attachments */}
            {communication.attachments && communication.attachments.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments ({communication.attachments.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {communication.attachments.map((att: AttachmentFile, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-white rounded-md border text-sm hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-slate-100 rounded text-slate-500">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate" title={att.name}>
                            {att.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(att.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      {hasDownload(att) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 text-slate-500"
                          onClick={() => handleDownload(att)}
                        >
                          <Send className="h-4 w-4 rotate-45" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex gap-2">
                <Badge variant="secondary">{communication.category}</Badge>
                {communication.sent_via_email && <Badge variant="outline">Email</Badge>}
                {(communication.email_status === 'failed' ||
                  communication.email_status === 'rejected') && (
                  <Badge variant="destructive">
                    {communication.email_status === 'rejected' ? 'Email rejected' : 'Email failed'}
                  </Badge>
                )}
                <Badge variant="outline">Portal</Badge>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => {
                  onClose();
                  onDelete(communication.id);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
