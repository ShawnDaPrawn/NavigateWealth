/**
 * PressKitDialog — "Request Media Materials": how to ask for the media kit.
 *
 * The same content and the same pre-addressed email as the live page's
 * MediaAccessModal, drawn as the "Press" board draws it. The dialog is Radix:
 * focus is trapped while it is open, Escape and a click on the backdrop close
 * it, and focus goes back to whichever button opened it (several do, so the
 * page passes the opener in). Radix portals it to <body>, outside the page's
 * `.nw-site` wrapper, so the portal carries its own wrapper for the scoped
 * styles, as PartnerWall's does.
 */
import type { RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { PressIcon } from './PressIcons';
import '../styles/press.css';

interface PressKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opened the dialog, to take focus back on close. */
  returnFocusTo: RefObject<HTMLElement | null>;
  email: string;
  phone: string;
  /** mailto: link with the subject filled in. */
  requestHref: string;
}

export function PressKitDialog({
  open,
  onOpenChange,
  returnFocusTo,
  email,
  phone,
  requestHref,
}: PressKitDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <div className="nw-site nw-base nwpr2">
          <Dialog.Overlay className="nwpr2-overlay">
            <Dialog.Content
              className="nwpr2-dialog"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                returnFocusTo.current?.focus();
              }}
            >
              <Dialog.Close className="nwpr2-close" aria-label="Close">
                <PressIcon name="close" size={18} />
              </Dialog.Close>
              <div className="nwpr2-dialog-head">
                <span className="nwpr2-dialog-icon" aria-hidden="true">
                  <PressIcon name="newspaper" size={26} />
                </span>
                <Dialog.Title className="nwpr2-dialog-title">Request Media Materials</Dialog.Title>
                <Dialog.Description className="nwpr2-dialog-desc">
                  Our media materials are sent on request, so we know who is using them.
                </Dialog.Description>
              </div>
              <div className="nwpr2-howto">
                <h3 className="nwpr2-howto-title">
                  <PressIcon name="mail" size={18} stroke="#0D1626" />
                  How to Request
                </h3>
                <p className="nwpr2-howto-text">
                  Email us with your organisation and the materials you need: logo and brand
                  guidelines, founder photos, or the company fact sheet.
                </p>
                <div className="nwpr2-howto-grid">
                  <div className="nwpr2-howto-cell">
                    <p className="nwpr2-howto-l">Email</p>
                    <p className="nwpr2-howto-v nwpr2-howto-v--strong">{email}</p>
                  </div>
                  <div className="nwpr2-howto-cell">
                    <p className="nwpr2-howto-l">Phone</p>
                    <p className="nwpr2-howto-v">{phone}</p>
                  </div>
                </div>
                <p className="nwpr2-howto-note">
                  Please include your organization, purpose for media materials, and specific assets
                  needed in your request.
                </p>
              </div>
              <div className="nwpr2-dialog-actions">
                <a className="nw-btn" href={requestHref}>
                  Email Your Request <PressIcon name="arrowRight" size={16} />
                </a>
                <Dialog.Close className="nw-outline">Close</Dialog.Close>
              </div>
              <p className="nwpr2-dialog-foot">Response time: within 24 hours on business days</p>
            </Dialog.Content>
          </Dialog.Overlay>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
