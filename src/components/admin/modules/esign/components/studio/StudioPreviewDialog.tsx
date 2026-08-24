/**
 * Preview of the document, or of the invitation email.
 *
 *
 * Split out of `PrepareFormStudio.tsx` (1,529 lines), whose `return` held the
 * toolbar, recipient strip, bulk-action bar, canvas and five dialogs together.
 * Presentational — it owns no state.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Eye } from 'lucide-react';
import { PDFViewer } from '../PDFViewer';
import type { EsignEnvelope, EsignField, SignerFormData } from '../../types';
import { SIGNER_COLORS } from '../../constants';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { EmailPreview } from '../EmailPreview';

interface StudioPreviewDialogProps {
  documentUrl: string | undefined;
  eligibleSigners: SignerFormData[];
  envelope: EsignEnvelope;
  fields: EsignField[];
  previewMode: 'doc' | 'email';
  previewSignerEmail: string;
  setPreviewMode: Dispatch<SetStateAction<'doc' | 'email'>>;
  setPreviewSignerEmail: Dispatch<SetStateAction<string>>;
  setShowPreview: Dispatch<SetStateAction<boolean>>;
  showPreview: boolean;
  signers: SignerFormData[];
}

export function StudioPreviewDialog({
  documentUrl,
  eligibleSigners,
  envelope,
  fields,
  previewMode,
  previewSignerEmail,
  setPreviewMode,
  setPreviewSignerEmail,
  setShowPreview,
  showPreview,
  signers,
}: StudioPreviewDialogProps) {
  return (
    <Dialog open={showPreview} onOpenChange={setShowPreview}>
      <DialogContent className="max-w-[1100px] w-[95vw] h-[88vh] p-0 flex flex-col">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-purple-600" />
            Preview as recipient
          </DialogTitle>
          <DialogDescription>
            See the document and email exactly as a recipient will. Choose a specific signer to
            filter the document view to their fields only.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar: signer picker + view-mode tabs. Kept above the content
            so switching modes doesn't reset the chosen signer. */}
        <div className="px-5 py-2 border-b shrink-0 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600">Recipient:</span>
          <Select value={previewSignerEmail} onValueChange={setPreviewSignerEmail}>
            <SelectTrigger className="w-[260px] h-8">
              <SelectValue placeholder="All recipients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All recipients (combined)</SelectItem>
              {eligibleSigners.map((s, idx) => {
                const color = SIGNER_COLORS[idx % SIGNER_COLORS.length].hex;
                return (
                  <SelectItem key={s.email} value={s.email}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: color }}
                      />
                      {s.name}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <div className="ml-auto inline-flex rounded-md border border-gray-200 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setPreviewMode('doc')}
              className={`px-3 py-1.5 ${previewMode === 'doc' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Document
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('email')}
              className={`px-3 py-1.5 border-l border-gray-200 ${previewMode === 'email' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Email
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-gray-100">
          {previewMode === 'doc' ? (
            <PDFViewer
              documentUrl={documentUrl || envelope.document?.url || envelope.documentUrl}
              documentName={envelope.title}
              // Filter to a single signer's fields so the sender sees what
              // that recipient will see — including the gentle reality that
              // a recipient with zero fields gets nothing to do.
              fields={
                previewSignerEmail === '__all__'
                  ? fields
                  : fields.filter((f) => f.signer_id === previewSignerEmail)
              }
              signers={signers}
              showFields={true}
              selectedSignerId={previewSignerEmail === '__all__' ? undefined : previewSignerEmail}
            />
          ) : (
            <EmailPreview
              envelope={{
                title: envelope.title,
                message: envelope.message ?? undefined,
                sender_name: (envelope as { sender_name?: string | null }).sender_name ?? undefined,
                firm_name: (envelope as { firm_name?: string | null }).firm_name ?? undefined,
              }}
              signer={
                previewSignerEmail === '__all__'
                  ? eligibleSigners[0] // best-effort fallback
                  : (eligibleSigners.find((s) => s.email === previewSignerEmail) ??
                    eligibleSigners[0])
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
