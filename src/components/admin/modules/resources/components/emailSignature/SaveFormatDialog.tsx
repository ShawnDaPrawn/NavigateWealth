/**
 * The dialog that names and stores the current field values.
 *
 * Split out of `EmailSignatureGenerator.tsx` (1,640 lines). Presentational —
 * it owns no state; everything it needs arrives as a prop.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Bookmark } from 'lucide-react';
import { type SignatureData, TEMPLATES } from './signatureModel';

interface SaveFormatDialogProps {
  data: SignatureData;
  template: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatName: string;
  setFormatName: Dispatch<SetStateAction<string>>;
  logoSrc: string;
  onSaveFormat: () => void;
}

export function SaveFormatDialog({
  data,
  template,
  open,
  onOpenChange,
  formatName,
  setFormatName,
  logoSrc,
  onSaveFormat,
}: SaveFormatDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-purple-500" />
            Save Signature Format
          </DialogTitle>
          <DialogDescription>
            Save the current branding settings — template, colours, logo, disclaimer, and social
            links — as a reusable format. Personal details (name, email, phone) are not saved.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Preview of what's being saved */}
          <div className="rounded-lg border bg-gray-50 p-3 space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Format preview
            </p>
            <div className="flex items-center gap-2.5">
              <div
                className="h-5 w-5 rounded-full ring-2 ring-white shadow-sm shrink-0"
                style={{ backgroundColor: data.primaryColour }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium capitalize">
                  {TEMPLATES.find((t) => t.id === template)?.name} template
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">{data.primaryColour}</p>
              </div>
              <div className="h-8 w-12 rounded border bg-white flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={logoSrc}
                  alt="logo"
                  className="max-h-full max-w-full object-contain p-0.5"
                />
              </div>
            </div>
          </div>

          {/* Format name input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Format name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formatName}
              onChange={(e) => setFormatName(e.target.value)}
              placeholder='e.g. "Navigate Dark", "Adviser Standard"'
              className="h-9"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveFormat();
              }}
            />
            <p className="text-[10px] text-muted-foreground">
              This name will appear in the Saved Formats panel for quick loading.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-purple-600 hover:bg-purple-700"
            onClick={onSaveFormat}
            disabled={!formatName.trim()}
          >
            <Bookmark className="h-3.5 w-3.5 mr-1.5" />
            Save Format
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
