/**
 * The centred dialog the company pages use (the CV form on Careers, the media
 * kit on Press). Radix Dialog handles focus trapping, Escape, the scrim and
 * scroll locking; focus returns to the button that opened it. The portal lands
 * outside the page's `.nw-site` wrapper, so the dialog carries the class.
 */
import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import '../styles/navigator.css';
import '../styles/company.css';

interface CompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function CompanyDialog({ open, onOpenChange, children }: CompanyDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <div className="nw-site nwco-dialog">
          <Dialog.Overlay className="nwco-scrim" />
          <Dialog.Content className="nwco-dialog-panel">
            <Dialog.Close className="nwco-x" aria-label="Close">
              <X size={18} strokeWidth={1.75} aria-hidden="true" />
            </Dialog.Close>
            {children}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
