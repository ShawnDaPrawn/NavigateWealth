/**
 * "Request Media Materials" — the Navigator version of the live
 * MediaAccessModal. Same copy, same mailto request (subject "Media kit
 * request") to the one public mailbox in companyFacts.ts.
 */
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Mail, Newspaper } from 'lucide-react';
import { COMPANY } from '@/config/companyFacts';
import { CompanyDialog } from './CompanyDialog';

interface MediaKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaKitDialog({ open, onOpenChange }: MediaKitDialogProps) {
  const requestHref = `mailto:${COMPANY.email}?subject=${encodeURIComponent('Media kit request')}`;
  return (
    <CompanyDialog open={open} onOpenChange={onOpenChange}>
      <div className="nwco-dialog-body">
        <div className="nwco-dialog-head">
          <span className="nwco-dialog-icon nwco-dialog-icon--round" aria-hidden="true">
            <Newspaper size={26} strokeWidth={1.75} />
          </span>
          <Dialog.Title className="nwco-dialog-title">Request Media Materials</Dialog.Title>
          <Dialog.Description className="nwco-dialog-lead">
            Our media materials are sent on request, so we know who is using them.
          </Dialog.Description>
        </div>
        <div className="nwco-kit-box">
          <h3 className="nwco-kit-h">
            <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
            How to Request
          </h3>
          <p>
            Email us with your organisation and the materials you need: logo and brand guidelines,
            founder photos, or the company fact sheet.
          </p>
          <dl className="nwco-kit-contacts">
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>
                <a href={COMPANY.phone.tel}>{COMPANY.phone.display}</a>
              </dd>
            </div>
          </dl>
          <p className="nwco-kit-note">
            Please include your organisation, purpose for media materials, and specific assets
            needed in your request.
          </p>
        </div>
        <div className="nwco-dialog-actions">
          <a className="nw-btn" href={requestHref}>
            Email Your Request
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </a>
          <Dialog.Close className="nw-outline">Close</Dialog.Close>
        </div>
        <p className="nwco-dialog-foot">Response time: within 24 hours on business days</p>
      </div>
    </CompanyDialog>
  );
}
