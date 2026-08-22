/**
 * The full-size preview dialog.
 *
 * Split out of `EmailSignatureGenerator.tsx` (1,640 lines). Presentational —
 * it owns no state; everything it needs arrives as a prop.
 */
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../../ui/dialog';
import { Check, Copy, Download, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { type SignatureData, TEMPLATES } from './signatureModel';

interface PreviewDialogProps {
  data: SignatureData;
  template: string;
  copied: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signatureHtml: string;
  onCopyHtml: () => void;
  onDownloadHtml: () => void;
}

export function PreviewDialog({
  data,
  template,
  copied,
  open,
  onOpenChange,
  signatureHtml,
  onCopyHtml,
  onDownloadHtml,
}: PreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-purple-500" />
            Full Email Preview
            <Badge variant="secondary" className="text-[10px] ml-2">
              {TEMPLATES.find((t) => t.id === template)?.name}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            {/* Email chrome */}
            <div className="bg-muted/30 border-b px-5 py-3.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-4 text-xs text-muted-foreground font-mono">New Message</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-12">From:</span>
                  <span className="font-medium">
                    {data.fullName} &lt;{data.email || 'email@navigatewealth.co.za'}&gt;
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-12">To:</span>
                  <span className="text-muted-foreground">client@example.com</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-12">Subject:</span>
                  <span>Your Financial Plan Review</span>
                </div>
              </div>
            </div>
            {/* Email body */}
            <div className="px-6 py-6">
              <div className="text-sm text-gray-500 space-y-3 mb-8 leading-relaxed">
                <p>Dear Client,</p>
                <p>
                  Thank you for our meeting earlier today. I have reviewed your current financial
                  portfolio and prepared an updated plan based on our discussion.
                </p>
                <p>
                  Please find the updated documents attached for your review. Should you have any
                  questions, please do not hesitate to contact me.
                </p>
                <p>Kind regards,</p>
              </div>
              <div className="border-t border-dashed border-gray-200 my-6" />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.35, ease: 'easeOut' }}
                dangerouslySetInnerHTML={{ __html: signatureHtml }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={onDownloadHtml}>
            <Download className="h-4 w-4 mr-1.5" />
            Download
          </Button>
          <Button className="bg-purple-600 hover:bg-purple-700" onClick={onCopyHtml}>
            {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
            {copied ? 'Copied!' : 'Copy HTML'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
