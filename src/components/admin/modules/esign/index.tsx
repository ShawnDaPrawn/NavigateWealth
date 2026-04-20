/**
 * E-Signature Module - Standalone Admin Module
 * Allows admins to send documents for e-signature to any user (existing clients or new recipients)
 * 
 * WORKFLOW:
 * 1. Dashboard - Overview of all envelopes
 * 2. Upload Document - Step 1 of creation
 * 3. Add Recipients - Step 2 of creation
 * 4. Prepare Form - Drag/drop fields
 * 5. Send
 */

import React, { useState, Suspense } from 'react';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { 
  ArrowLeft,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { logger } from '../../../../utils/logger';

import { useEnvelopeActions } from './hooks/useEnvelopeActions';
import { EsignDashboard } from './components/EsignDashboard';
import { esignApi } from './api';

import type { EsignEnvelope, SignerFormData, EsignField, EsignTemplateRecord } from './types';
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';

// Heavy wizard / inspector components — lazy-loaded (only rendered on user action)
const DocumentUploadStep = React.lazy(() => import('./components/DocumentUploadStep').then(m => ({ default: m.DocumentUploadStep })));
const RecipientsManager = React.lazy(() => import('./components/RecipientsManager').then(m => ({ default: m.RecipientsManager })));
const PrepareFormStudio = React.lazy(() => import('./components/PrepareFormStudio').then(m => ({ default: m.PrepareFormStudio })));
const EnvelopeInspector = React.lazy(() => import('./components/EnvelopeInspector').then(m => ({ default: m.EnvelopeInspector })));
const TemplatePickerDialog = React.lazy(() => import('./components/TemplatePickerDialog').then(m => ({ default: m.TemplatePickerDialog })));
const SaveAsTemplateDialog = React.lazy(() => import('./components/SaveAsTemplateDialog').then(m => ({ default: m.SaveAsTemplateDialog })));
const BulkSendDialog = React.lazy(() => import('./components/BulkSendDialog').then(m => ({ default: m.BulkSendDialog })));
const PacketsDialog = React.lazy(() => import('./components/PacketsDialog').then(m => ({ default: m.PacketsDialog })));
const NotificationPrefsDialog = React.lazy(() => import('./components/NotificationPrefsDialog').then(m => ({ default: m.NotificationPrefsDialog })));
const WebhooksDialog = React.lazy(() => import('./components/WebhooksDialog').then(m => ({ default: m.WebhooksDialog })));
const RecoveryBinDialog = React.lazy(() => import('./components/RecoveryBinDialog').then(m => ({ default: m.RecoveryBinDialog })));
// P7.3 — searchable global audit log; lazy-loaded when the admin opens it.
const AuditLogDialog = React.lazy(() => import('./components/AuditLogDialog').then(m => ({ default: m.AuditLogDialog })));
// P7.7 — retention policy editor; lazy-loaded.
const RetentionPolicyDialog = React.lazy(() => import('./components/RetentionPolicyDialog').then(m => ({ default: m.RetentionPolicyDialog })));
// P8.6 — Per-firm signer-page branding dialog; lazy-loaded.
const BrandingDialog = React.lazy(() => import('./components/BrandingDialog').then(m => ({ default: m.BrandingDialog })));

function StepFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
    </div>
  );
}

type ViewState = 'dashboard' | 'wizard-upload' | 'wizard-recipients' | 'prepare';

/**
 * P4.1 / P4.3 — Template provenance carried through the wizard.
 * When the user picks a template the picker stamps these onto state so the
 * eventual upload can pin the envelope to the exact template snapshot,
 * and the studio can hydrate the field layout without an extra round-trip.
 */
interface TemplateContext {
  template: EsignTemplateRecord;
  /** Pinned at pick-time so later template edits do not retroactively
   *  rewrite this draft envelope's field layout. */
  version: number;
}

export function EsignModule() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [selectedEnvelope, setSelectedEnvelope] = useState<EsignEnvelope | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [resumingEnvelopeId, setResumingEnvelopeId] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateContext, setTemplateContext] = useState<TemplateContext | null>(null);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [packetsOpen, setPacketsOpen] = useState(false);
  const [notificationPrefsOpen, setNotificationPrefsOpen] = useState(false);
  const [webhooksOpen, setWebhooksOpen] = useState(false);
  const [recoveryBinOpen, setRecoveryBinOpen] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [brandingOpen, setBrandingOpen] = useState(false);
  const { canDo } = useCurrentUserPermissions();

  const canCreate = canDo('esign', 'create');
  const canSend = canDo('esign', 'send');
  const canDelete = canDo('esign', 'delete');

  // Wizard State
  const [wizardData, setWizardData] = useState<{
    files: File[];
    title: string;
    message: string;
    expiryDays: number;
    signers: SignerFormData[];
  }>({
    files: [],
    title: '',
    message: '',
    expiryDays: 30,
    signers: [],
  });

  // Prepare State
  const [activeEnvelope, setActiveEnvelope] = useState<EsignEnvelope | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [pendingEnvelopes, setPendingEnvelopes] = useState<EsignEnvelope[]>([]);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);

  const { 
    uploadDocument, 
    sendInvites, 
    voidEnvelope,
    deleteEnvelope,
    saveFields,
    downloadDocument,
    uploading, 
    sending,
    savingFields
  } = useEnvelopeActions();

  // ==================== NAVIGATION HANDLERS ====================

  const resetWizardState = () => {
    setWizardData({
      files: [],
      title: '',
      message: '',
      expiryDays: 30,
      signers: [],
    });
    setActiveEnvelope(null);
    setDocumentUrl(null);
    setPendingEnvelopes([]);
    setTemplateContext(null);
  };

  const handleStartNew = () => {
    if (!canCreate) return;
    // Reset wizard AND any stale prepare state from a previous session.
    // Without these resets, the "draft re-use" guard in handleRecipientsNext
    // would incorrectly latch onto the previous envelope and skip uploading
    // the new document, OR the smart-back logic would send the user back to
    // a stale wizard step.
    resetWizardState();
    // P4.1 / P4.3 — open the template picker first. The picker offers
    // either "Start from scratch" (jumps straight to the upload step) or
    // "Use template" (pre-populates recipients/message/expiry and pins
    // the envelope to the template snapshot).
    setTemplatePickerOpen(true);
  };

  const handleStartBlank = () => {
    setTemplateContext(null);
    setView('wizard-upload');
  };

  /**
   * P4.1 / P4.3 — User picked a template. Capture the template + pinned
   * version, hydrate wizardData with the template's recipients (slot
   * placeholders the user will fill in), default message, and expiry, then
   * jump straight to the document upload step.
   *
   * Field positions are NOT applied here — they are stamped onto the
   * envelope after the document has been uploaded (see template hydration
   * inside `handleRecipientsNext`).
   */
  const handleSelectTemplate = (template: EsignTemplateRecord) => {
    const version = template.version ?? 1;
    setTemplateContext({ template, version });
    // Map template recipients → SignerFormData slots. Names default to
    // the template's recipient name (e.g. "Client", "Adviser") so the
    // user just has to fill in the email; this is the express-wizard win.
    const signers: SignerFormData[] = template.recipients.map((r, idx) => ({
      name: r.name || '',
      email: r.email || '',
      role: r.role || 'Signer',
      order: r.order ?? idx + 1,
      otpRequired: r.otpRequired ?? false,
      accessCode: r.accessCode,
      clientId: undefined,
      isSystemClient: false,
    }));
    setWizardData({
      files: [],
      title: template.name,
      message: template.defaultMessage || '',
      expiryDays: template.defaultExpiryDays ?? 30,
      signers,
    });
    setView('wizard-upload');
  };

  const handleUploadNext = (files: File[], title: string, message: string, expiryDays: number) => {
    setWizardData(prev => ({
      ...prev,
      files,
      title,
      message,
      expiryDays
    }));
    setView('wizard-recipients');
  };

  /**
   * P4.1 / P4.3 — Materialise an envelope from the wizard state.
   * Uploads the document(s), persists draft signers, and (when a
   * template was selected) hydrates the template's field layout onto
   * the envelope. Returns the created envelope and the hydrated
   * fields so callers can decide whether to navigate to the studio
   * (standard wizard) or send immediately (express wizard).
   *
   * Also handles the idempotent re-use case: if `activeEnvelope` is
   * already a draft from this session, no new upload happens.
   */
  const materialiseEnvelopeFromWizard = async (): Promise<{
    envelope: EsignEnvelope;
    fields: EsignField[];
  } | null> => {
    if (wizardData.signers.length === 0) {
      toast.error('Please add at least one recipient.');
      return null;
    }

    if (activeEnvelope?.id && activeEnvelope.status === 'draft') {
      try {
        await esignApi.saveDraftSigners(
          activeEnvelope.id,
          wizardData.signers.map((s, idx) => ({
            name: s.name,
            email: s.email,
            phone: s.phone,
            role: s.role || 'Signer',
            order: s.order ?? idx + 1,
            otpRequired: s.otpRequired,
            accessCode: s.accessCode,
            clientId: s.clientId,
            isSystemClient: s.isSystemClient,
            smsOptIn: s.smsOptIn,
          })),
        );
      } catch (draftErr) {
        logger.warn('Failed to update draft signers on existing envelope (non-critical):', draftErr);
      }
      return { envelope: activeEnvelope, fields: activeEnvelope.fields ?? [] };
    }

    if (!wizardData.files || wizardData.files.length === 0) {
      toast.error('No documents found. Please go back and upload at least one document.');
      logger.error('materialiseEnvelopeFromWizard aborted: wizardData.files is empty', {
        filesValue: wizardData.files,
      });
      return null;
    }

    const primarySystemSigner = wizardData.signers.find(s => s.isSystemClient && s.clientId);
    const clientId = primarySystemSigner?.clientId;

    const result = await uploadDocument({
      files: wizardData.files,
      context: {
        clientId,
        title: wizardData.title,
        message: wizardData.message,
        expiresAt: new Date(Date.now() + wizardData.expiryDays * 24 * 60 * 60 * 1000).toISOString(),
        templateId: templateContext?.template.id,
        templateVersion: templateContext?.version,
      },
    });

    if (!result || !result.id) {
      throw new Error('Failed to create envelope');
    }

    setPendingEnvelopes([]);
    setActiveEnvelope(result);

    const url = result.document?.url || result.documentUrl;
    if (url) setDocumentUrl(url);

    try {
      await esignApi.saveDraftSigners(result.id, wizardData.signers.map((s, idx) => ({
        name: s.name,
        email: s.email,
        phone: s.phone,
        role: s.role || 'Signer',
        order: s.order ?? idx + 1,
        otpRequired: s.otpRequired,
        accessCode: s.accessCode,
        clientId: s.clientId,
        isSystemClient: s.isSystemClient,
        smsOptIn: s.smsOptIn,
      })));
    } catch (draftErr) {
      logger.warn('Failed to persist draft signers (non-critical):', draftErr);
    }

    let hydratedFields: EsignField[] = [];
    if (templateContext && templateContext.template.fields.length > 0) {
      try {
        const nowIso = new Date().toISOString();
        const docId = result.document?.id ?? (result as { documentId?: string }).documentId;
        hydratedFields = templateContext.template.fields
          .map((tf, idx) => {
            const recipient = wizardData.signers[tf.recipientIndex];
            if (!recipient) return null;
            const field: EsignField = {
              id: `tpl-${result.id}-${idx}`,
              envelope_id: result.id,
              document_id: docId,
              signer_id: recipient.email,
              type: tf.type,
              page: tf.page,
              x: tf.x,
              y: tf.y,
              width: tf.width,
              height: tf.height,
              required: tf.required,
              metadata: tf.metadata ?? {},
              created_at: nowIso,
              updated_at: nowIso,
            };
            return field;
          })
          .filter((f): f is EsignField => f !== null);

        if (hydratedFields.length > 0) {
          await saveFields(result.id, hydratedFields);
          setActiveEnvelope({ ...result, fields: hydratedFields });
        }
      } catch (hydrateErr) {
        logger.warn('Failed to hydrate template fields (non-critical):', hydrateErr);
      }
    }

    return { envelope: { ...result, fields: hydratedFields }, fields: hydratedFields };
  };

  const handleRecipientsNext = async () => {
    if (wizardData.signers.length === 0) {
      toast.error('Please add at least one recipient.');
      return;
    }

    // ===================================================================
    // IDEMPOTENT BRANCH — re-using an existing draft
    // ===================================================================
    // If we already created an envelope for this wizard session (i.e. the
    // user clicked Next, went Back to recipients, and is now clicking Next
    // again), DO NOT upload again — that creates the duplicate-draft bug.
    // Instead: persist any updated signer config on the existing draft and
    // navigate straight to the prepare studio. The previously-saved fields
    // are still attached to this envelope, so "Continue Editing" later will
    // also find them.
    if (activeEnvelope?.id && activeEnvelope.status === 'draft') {
      try {
        await esignApi.saveDraftSigners(
          activeEnvelope.id,
          wizardData.signers.map((s, idx) => ({
            name: s.name,
            email: s.email,
            phone: s.phone,
            role: s.role || 'Signer',
            order: s.order ?? idx + 1,
            otpRequired: s.otpRequired,
            accessCode: s.accessCode,
            clientId: s.clientId,
            isSystemClient: s.isSystemClient,
            smsOptIn: s.smsOptIn,
          })),
        );
      } catch (draftErr) {
        logger.warn('Failed to update draft signers on existing envelope (non-critical):', draftErr);
      }
      setView('prepare');
      return;
    }

    // ===================================================================
    // FRESH UPLOAD BRANCH — first time through the wizard
    // ===================================================================
    try {
      const out = await materialiseEnvelopeFromWizard();
      if (!out) return;

      const sourceMsg = templateContext
        ? `Template "${templateContext.template.name}" applied — ${out.fields.length} field(s) placed.`
        : (wizardData.files.length > 1
          ? `${wizardData.files.length} documents merged! Proceeding to prepare the form fields.`
          : 'Document uploaded! Now prepare the form fields.');
      toast.success(sourceMsg);

      setView('prepare');
    } catch (error: unknown) {
      logger.error('Failed to create envelope:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
    }
  };

  const handleSaveFields = async (fields: EsignField[]) => {
    if (!activeEnvelope) return;
    
    try {
       await saveFields(activeEnvelope.id, fields);
       setActiveEnvelope({ ...activeEnvelope, fields });
       toast.success('Fields saved successfully');
    } catch (err) {
       logger.error(err);
       toast.error('Failed to save fields');
    }
  };

  const handleSend = async (currentFields?: EsignField[]) => {
    if (!activeEnvelope) return;

    // Use passed fields if provided (handles race condition), otherwise use state
    const fieldsToUse = currentFields || activeEnvelope.fields || [];

    try {
      // Map fields to include signerIndex for the backend
      // fieldsToUse contains fields where signer_id is the signer's email
      const fieldsForInvite = fieldsToUse.map(f => {
         const signerIndex = wizardData.signers.findIndex(s => s.email === f.signer_id);
         return {
            ...f,
            signerIndex: signerIndex >= 0 ? signerIndex : 0 
         };
      });

      await sendInvites(activeEnvelope.id, { 
         signers: wizardData.signers.map(s => ({
            name: s.name,
            email: s.email,
            phone: s.phone,
            role: s.role,
            order: s.order,
            otpRequired: s.otpRequired,
            accessCode: s.accessCode,
            clientId: s.clientId,
            smsOptIn: s.smsOptIn,
         })),
         fields: fieldsForInvite,
         message: wizardData.message,
         expiryDays: wizardData.expiryDays
      });
      toast.success('Document sent for signature!');

      // All done — clear all wizard/prepare state so the next
      // "Start New Envelope" or "Continue Editing" begins clean.
      resetWizardState();
      setRefreshTrigger(prev => prev + 1);
      setView('dashboard');
    } catch (error: unknown) {
      logger.error('Failed to send:', error);
      toast.error('Failed to send envelope');
    }
  };

  /**
   * P4.3 — Express send. From the recipients step, when the wizard
   * was started from a template that already has all field positions
   * placed, the user can skip the prepare studio and dispatch the
   * envelope in one click. We materialise (upload + hydrate fields)
   * then immediately invoke `handleSend` with the hydrated fields.
   *
   * Validation: every recipient must have a non-empty email and the
   * template must contain at least one field.
   */
  const handleExpressSend = async () => {
    if (!templateContext) {
      toast.error('Express send requires a template.');
      return;
    }
    if (!canSend) {
      toast.error('You do not have permission to send envelopes.');
      return;
    }
    const missingEmail = wizardData.signers.find(s => !s.email?.trim());
    if (missingEmail) {
      toast.error('Each recipient needs an email before express send.');
      return;
    }
    if (templateContext.template.fields.length === 0) {
      toast.error('This template has no field placements — open the studio to place fields first.');
      return;
    }

    try {
      const out = await materialiseEnvelopeFromWizard();
      if (!out) return;

      // The active envelope is now set in state, but `handleSend` reads
      // from state — pass the hydrated fields explicitly to dodge the
      // setActiveEnvelope race.
      await handleSend(out.fields);
    } catch (error: unknown) {
      logger.error('Express send failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send envelope');
    }
  };

  const handleViewEnvelope = (envelope: EsignEnvelope) => {
    setSelectedEnvelope(envelope);
    setDetailsDialogOpen(true);
  };

  const handleDownloadDocument = (envelopeId: string) => {
     // Try to use title from selected envelope if it matches
     const filename = selectedEnvelope?.id === envelopeId 
       ? `${selectedEnvelope.title}.pdf` 
       : 'document.pdf';
     
     downloadDocument(envelopeId, filename);
  };

  // ==================== RESUME DRAFT PREPARE ====================

  /**
   * Resumes the prepare-form stage for a draft envelope that was previously
   * abandoned. Fetches the full envelope (with signers, fields), obtains a
   * fresh document URL, populates wizard state, and navigates to 'prepare'.
   */
  const handleResumePrepare = async (envelope: EsignEnvelope) => {
    if (resumingEnvelopeId) return; // prevent double-click
    setResumingEnvelopeId(envelope.id);

    try {
      // 1. Fetch full envelope data (signers + fields)
      const fullEnvelope = await esignApi.getEnvelope(envelope.id);
      if (!fullEnvelope || !fullEnvelope.id) {
        throw new Error('Envelope not found or could not be loaded');
      }

      // 2. Get a fresh presigned document URL
      let docUrl: string | null = null;
      try {
        const urlResponse = await esignApi.getDocumentUrl(fullEnvelope.id);
        docUrl = urlResponse?.url || null;
      } catch {
        // Fallback: try envelope-level URL
        docUrl = fullEnvelope.document?.url || fullEnvelope.documentUrl || null;
      }

      if (!docUrl) {
        toast.error('Could not load the document for this envelope. The file may have expired.');
        return;
      }

      // 3. Reconstruct signers from the best available source:
      //    a) Real signer records (created during invite flow — present if envelope was sent)
      //    b) draft_signers stored on the envelope record (persisted when moving recipients → prepare)
      //    c) Empty array (shouldn't happen for a properly created draft)
      let signers: SignerFormData[] = [];

      const realSigners = fullEnvelope.signers || [];
      const draftSigners = fullEnvelope.draft_signers || [];

      if (realSigners.length > 0) {
        // Sent envelopes or envelopes that already went through invite
        signers = realSigners.map((s: { name: string; email: string; role?: string; order?: number; otp_required?: boolean; requires_otp?: boolean; access_code?: string; client_id?: string }) => ({
          name: s.name,
          email: s.email,
          role: s.role || 'Signer',
          order: s.order,
          otpRequired: s.otp_required ?? s.requires_otp ?? false,
          accessCode: s.access_code || undefined,
          clientId: s.client_id || undefined,
          isSystemClient: !!s.client_id,
        }));
      } else if (draftSigners.length > 0) {
        // Draft envelope resumed via "Continue Editing" — signers not yet
        // created as real records, but persisted as lightweight form data
        signers = draftSigners.map((s: { name: string; email: string; role?: string; order?: number; otpRequired?: boolean; accessCode?: string; clientId?: string; isSystemClient?: boolean }) => ({
          name: s.name,
          email: s.email,
          role: s.role || 'Signer',
          order: s.order,
          otpRequired: s.otpRequired ?? false,
          accessCode: s.accessCode || undefined,
          clientId: s.clientId || undefined,
          isSystemClient: s.isSystemClient ?? !!s.clientId,
        }));
        logger.info(`Restored ${signers.length} draft signer(s) for envelope ${fullEnvelope.id}`);
      } else {
        logger.warn(`No signers or draft_signers found for envelope ${fullEnvelope.id} — prepare studio will have no recipients`);
      }

      // 4. Populate wizard data and prepare state.
      //    CRITICAL: reset `files` to []. If a previous "Start New" session
      //    left files in state, the smart-back from prepare would otherwise
      //    drop the user into the recipients wizard for a stale envelope and
      //    "Next" would create a duplicate draft (the very bug we're fixing).
      //    Also derive expiryDays from the envelope so the value is correct
      //    if the user re-sends from the prepare studio.
      const expiresAtIso = (fullEnvelope as { expires_at?: string; expiresAt?: string }).expires_at
        ?? (fullEnvelope as { expiresAt?: string }).expiresAt;
      let expiryDays = 30;
      if (expiresAtIso) {
        const diffMs = new Date(expiresAtIso).getTime() - Date.now();
        const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
        if (Number.isFinite(diffDays) && diffDays > 0) expiryDays = diffDays;
      }

      setWizardData({
        files: [],
        title: fullEnvelope.title,
        message: fullEnvelope.message || '',
        expiryDays,
        signers,
      });
      setActiveEnvelope(fullEnvelope);
      setDocumentUrl(docUrl);

      // 5. Close the inspector if open
      setDetailsDialogOpen(false);

      // 6. Navigate to prepare view
      setView('prepare');
      toast.success('Draft loaded — continue placing fields.');
    } catch (error: unknown) {
      logger.error('Failed to resume draft envelope:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load draft envelope');
    } finally {
      setResumingEnvelopeId(null);
    }
  };

  // ==================== RENDER ====================

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* View Content */}
      {view === 'prepare' && activeEnvelope ? (
        <Suspense fallback={<StepFallback />}>
          <PrepareFormStudio
            envelope={activeEnvelope}
            signers={wizardData.signers}
            onBack={() => {
              // If we have wizard files, we came from the normal wizard flow — go back to recipients.
              // If no files (resumed draft), go back to dashboard and clear
              // the active envelope so subsequent "Start New" doesn't reuse it.
              if (wizardData.files.length > 0) {
                setView('wizard-recipients');
              } else {
                setActiveEnvelope(null);
                setDocumentUrl(null);
                setView('dashboard');
                setRefreshTrigger(prev => prev + 1);
              }
            }}
            onSaveFields={handleSaveFields}
            onSendForSignature={handleSend}
            onSignersChange={(next) => {
              // Phase 2: keep the wizard's signer list in sync with edits
              // performed via the studio's Recipients side-sheet so the
              // legend, "Placing fields for" picker, and properties panel
              // all reflect the change without a remount.
              setWizardData((prev) => ({ ...prev, signers: next }));
              setRefreshTrigger((p) => p + 1);
            }}
            onEnvelopeUpdated={(updated) => {
              // Phase 2: a settings save returns the latest envelope; mirror
              // it locally so the title in the toolbar updates instantly and
              // the dashboard cache picks up the diff on next visit.
              setActiveEnvelope(updated);
              setRefreshTrigger((p) => p + 1);
            }}
            saving={savingFields}
            sending={sending}
            documentUrl={documentUrl || undefined}
          />
        </Suspense>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          
          {view === 'dashboard' && (
            <EsignDashboard 
              onCreateNew={handleStartNew}
              onViewEnvelope={handleViewEnvelope}
              onResumePrepare={handleResumePrepare}
              resumingEnvelopeId={resumingEnvelopeId}
              onUseTemplate={(template) => {
                if (!canCreate) return;
                resetWizardState();
                handleSelectTemplate(template);
              }}
              onBulkSend={canSend ? () => setBulkSendOpen(true) : undefined}
              onPackets={canSend ? () => setPacketsOpen(true) : undefined}
              onNotificationPrefs={() => setNotificationPrefsOpen(true)}
              onWebhooks={canSend ? () => setWebhooksOpen(true) : undefined}
              onRecoveryBin={canDelete ? () => setRecoveryBinOpen(true) : undefined}
              onAuditLog={() => setAuditLogOpen(true)}
              onRetentionPolicy={canDelete ? () => setRetentionOpen(true) : undefined}
              onBranding={canCreate ? () => setBrandingOpen(true) : undefined}
              refreshTrigger={refreshTrigger}
            />
          )}

          {view === 'wizard-upload' && (
            <Suspense fallback={<StepFallback />}>
              <DocumentUploadStep
                onNext={handleUploadNext}
                onCancel={() => setView('dashboard')}
                initialData={{
                   files: wizardData.files,
                   title: wizardData.title,
                   message: wizardData.message,
                   expiryDays: wizardData.expiryDays
                }}
              />
            </Suspense>
          )}

          {view === 'wizard-recipients' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-900">Add Recipients</h2>
                <p className="text-sm text-gray-500">Who needs to sign these documents?</p>
              </div>

              {/* P4.3 — Express-send banner. When the wizard is using a
                  template that already has a complete field layout, surface
                  a clear shortcut so the user can skip the studio. */}
              {templateContext && templateContext.template.fields.length > 0 && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-purple-100 flex items-center justify-center shrink-0">
                    <ArrowRight className="h-4 w-4 text-purple-700" />
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-gray-900">
                      Express send from "{templateContext.template.name}"
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This template already has {templateContext.template.fields.length} field
                      {templateContext.template.fields.length === 1 ? '' : 's'} placed. Fill in
                      recipient emails, then send directly without opening the field studio.
                    </p>
                  </div>
                </div>
              )}

              <Card>
                <CardContent className="p-6">
                  <Suspense fallback={<StepFallback />}>
                    <RecipientsManager
                      signers={wizardData.signers}
                      onChange={(signers) => setWizardData(prev => ({ ...prev, signers }))}
                    />
                  </Suspense>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setView('wizard-upload')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  {templateContext && templateContext.template.fields.length > 0 && canSend && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleExpressSend}
                      disabled={uploading || sending}
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                    >
                      {uploading || sending ? (
                        <div className="contents">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending…
                        </div>
                      ) : (
                        <div className="contents">
                          Send now (express)
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </div>
                      )}
                    </Button>
                  )}
                  <Button
                    onClick={handleRecipientsNext}
                    disabled={uploading}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {uploading ? (
                      <div className="contents">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating Envelope...
                      </div>
                    ) : (
                      <div className="contents">
                        Next: Prepare Fields
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* P4.1 / P4.3 — Template picker is shown when starting a new
          envelope. "Start blank" jumps to the upload step; "Use
          template" pre-fills recipients/message/expiry and pins the
          template on the eventual envelope. */}
      {templatePickerOpen && (
        <Suspense fallback={null}>
          <TemplatePickerDialog
            open={templatePickerOpen}
            onOpenChange={setTemplatePickerOpen}
            onStartBlank={handleStartBlank}
            onSelectTemplate={(template) => handleSelectTemplate(template)}
          />
        </Suspense>
      )}

      {/* P4.7 — Bulk send dialog. Mounted lazily; the dialog drives the
          campaign + per-row dispatch loop on the client side. */}
      {bulkSendOpen && (
        <Suspense fallback={null}>
          <BulkSendDialog
            open={bulkSendOpen}
            onOpenChange={setBulkSendOpen}
            onCompleted={() => setRefreshTrigger((prev) => prev + 1)}
          />
        </Suspense>
      )}

      {/* P4.8 — Packet workflows dialog (author packets, start runs,
          monitor live chains). */}
      {packetsOpen && (
        <Suspense fallback={null}>
          <PacketsDialog
            open={packetsOpen}
            onOpenChange={setPacketsOpen}
            onCompleted={() => setRefreshTrigger((prev) => prev + 1)}
          />
        </Suspense>
      )}

      {/* P5.2 — Sender notification preferences dialog. */}
      {notificationPrefsOpen && (
        <Suspense fallback={null}>
          <NotificationPrefsDialog
            open={notificationPrefsOpen}
            onOpenChange={setNotificationPrefsOpen}
          />
        </Suspense>
      )}

      {/* P5.4 — Webhook management dialog (endpoints, recent deliveries, DLQ). */}
      {webhooksOpen && (
        <Suspense fallback={null}>
          <WebhooksDialog
            open={webhooksOpen}
            onOpenChange={setWebhooksOpen}
          />
        </Suspense>
      )}

      {/* P6.8 — Recovery Bin. Lists soft-deleted envelopes and offers
          restore / immediate purge for the 90-day retention window. */}
      {recoveryBinOpen && (
        <Suspense fallback={null}>
          <RecoveryBinDialog
            open={recoveryBinOpen}
            onOpenChange={setRecoveryBinOpen}
            onChanged={() => setRefreshTrigger((prev) => prev + 1)}
          />
        </Suspense>
      )}

      {/* P7.3 — Global audit log search across the firm. */}
      {auditLogOpen && (
        <Suspense fallback={null}>
          <AuditLogDialog
            open={auditLogOpen}
            onOpenChange={setAuditLogOpen}
            onOpenEnvelope={(envelopeId) => {
              esignApi.getEnvelope(envelopeId)
                .then((env) => {
                  if (env) {
                    setSelectedEnvelope(env);
                    setDetailsDialogOpen(true);
                  }
                })
                .catch((err) => logger.warn('Failed to open envelope from audit log', err));
            }}
          />
        </Suspense>
      )}

      {/* P7.7 — Retention policy editor. */}
      {retentionOpen && (
        <Suspense fallback={null}>
          <RetentionPolicyDialog
            open={retentionOpen}
            onOpenChange={setRetentionOpen}
          />
        </Suspense>
      )}

      {/* P8.6 — Per-firm signer-page branding editor. */}
      {brandingOpen && (
        <Suspense fallback={null}>
          <BrandingDialog
            open={brandingOpen}
            onOpenChange={setBrandingOpen}
          />
        </Suspense>
      )}

      {/* Details Modal */}
      {selectedEnvelope && (
        <Suspense fallback={<StepFallback />}>
          <EnvelopeInspector
            envelope={selectedEnvelope}
            open={detailsDialogOpen}
            onOpenChange={setDetailsDialogOpen}
            onDownloadDocument={handleDownloadDocument}
            onResumePrepare={canCreate ? handleResumePrepare : undefined}
            resumingEnvelopeId={resumingEnvelopeId}
            onVoidEnvelope={canSend ? async (id, reason) => {
               await voidEnvelope(id, reason);
               setDetailsDialogOpen(false);
               setRefreshTrigger(prev => prev + 1);
               toast.success('Voided successfully');
            } : undefined}
            onDeleteEnvelope={canDelete ? async (id) => {
               await deleteEnvelope(id);
               setDetailsDialogOpen(false);
               setRefreshTrigger(prev => prev + 1);
               // P6.8 — soft delete: signal to the user that this is
               // recoverable, so they feel safe discarding without
               // reaching for "Are you sure?" guardrails.
               toast.success('Envelope moved to Recovery Bin (restorable for 90 days).');
            } : undefined}
          />
        </Suspense>
      )}
    </div>
  );
}

// ============================================================================
// Public barrel exports — only what external consumers actually import
// EsignTab in client-management imports useEnvelopes from this barrel.
// All other imports go directly to submodules (e.g. ../../esign/types).
// ============================================================================

export { useEnvelopes } from './hooks';