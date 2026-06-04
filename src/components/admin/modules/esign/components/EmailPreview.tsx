/**
 * EmailPreview — P2.5 2.10
 * ---------------------------------------------------------------------------
 * Renders a static, branded mock of the invitation email so a sender can
 * visually verify the subject, salutation, document title, and personal
 * message before clicking Send. Deliberately read-only and self-contained so
 * it can be lifted out into Storybook later.
 *
 * Extracted from PrepareFormStudio.tsx (Phase 6b god-file split).
 */

/** Narrow signer shape needed by this component (avoids EsignSigner dep). */
export interface EsignSignerPreview {
  name: string;
  email: string;
  role?: string;
}

export interface EmailPreviewProps {
  // Structural subset — pulls only the optional fields we render. We use a
  // narrow type rather than `EsignEnvelope` so EmailPreview is reusable from
  // tests and Storybook with a hand-built fixture.
  envelope: {
    title?: string;
    message?: string;
    sender_name?: string;
    firm_name?: string;
  };
  signer?: EsignSignerPreview;
}

export function EmailPreview({ envelope, signer }: EmailPreviewProps) {
  const senderName = envelope.sender_name || envelope.firm_name || 'Your adviser';
  const signerName = signer?.name || 'Recipient';
  const title = envelope.title || 'document';
  const subject = `${senderName} sent you "${title}" to sign`;
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-[640px] mx-auto bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 text-xs text-gray-600 space-y-1">
          <div>
            <span className="font-medium text-gray-700">From:</span> {senderName}{' '}
            &lt;noreply@navigatewealth.co&gt;
          </div>
          <div>
            <span className="font-medium text-gray-700">To:</span> {signerName} &lt;
            {signer?.email || 'recipient@example.com'}&gt;
          </div>
          <div>
            <span className="font-medium text-gray-700">Subject:</span> {subject}
          </div>
        </div>
        <div className="px-6 py-8 text-gray-800">
          <div className="text-2xl font-semibold text-gray-900 mb-1">Navigate Wealth</div>
          <div className="text-xs text-gray-500 mb-6">Secure document signing</div>

          <p className="mb-4">Hi {signerName},</p>

          <p className="mb-4">
            <span className="font-medium">{senderName}</span> has sent you the document{' '}
            <span className="font-medium">"{title}"</span> to review and sign.
          </p>

          {envelope.message && (
            <div className="border-l-4 border-purple-300 bg-purple-50/60 px-4 py-3 mb-5 text-sm text-gray-700 whitespace-pre-wrap">
              {envelope.message}
            </div>
          )}

          <div className="flex justify-center my-6">
            <span className="inline-block px-6 py-3 rounded-md bg-purple-600 text-white font-medium">
              Review and sign
            </span>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            This link is unique to you. Please do not forward this email.
          </p>

          <hr className="my-6 border-gray-200" />
          <p className="text-xs text-gray-500">
            If you weren&apos;t expecting this, you can safely ignore the email or contact{' '}
            {senderName} directly.
          </p>
        </div>
      </div>
    </div>
  );
}
