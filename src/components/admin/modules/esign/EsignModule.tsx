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
 *
 * This file owns the wizard state machine and the handlers. The pure
 * template/envelope ↔ wizard mappings live in ./wizardDerivations; the
 * recipients step's markup in ./components/RecipientsStepView; the dialog
 * layer in ./components/EsignModuleDialogs.
 */

import React, { useState, Suspense } from 'react';
import { toast } from 'sonner';
import { logger } from '../../../../utils/logger';

import { useEnvelopeActions } from './hooks/useEnvelopeActions';
import { EsignDashboard } from './components/EsignDashboard';
import { StepFallback } from './components/StepFallback';
import { RecipientsStepView } from './components/RecipientsStepView';
import { EsignModuleDialogs } from './components/EsignModuleDialogs';
import { esignApi } from './api';
import {
  templateHasSavedDocuments,
  mapTemplateRecipientsToWizard,
  toDraftSignerPayload,
  buildTemplateFieldsForEnvelope,
  attachSignerIndexes,
  toInviteSignerPayload,
  signersFromResumedEnvelope,
  deriveExpiryDays,
  type TemplateContext,
  type TemplateBuilderContext,
} from './wizardDerivations';

import type { EsignEnvelope, SignerFormData, EsignField, EsignTemplateRecord } from './types';
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';

// Heavy wizard / studio components — lazy-loaded (only rendered on user action)
const DocumentUploadStep = React.lazy(() =>
  import('./components/DocumentUploadStep').then((m) => ({ default: m.DocumentUploadStep })),
);
const PrepareFormStudio = React.lazy(() =>
  import('./components/PrepareFormStudio').then((m) => ({ default: m.PrepareFormStudio })),
);

type ViewState = 'dashboard' | 'wizard-upload' | 'wizard-recipients' | 'prepare';

export function EsignModule() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [selectedEnvelope, setSelectedEnvelope] = useState<EsignEnvelope | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [resumingEnvelopeId, setResumingEnvelopeId] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateContext, setTemplateContext] = useState<TemplateContext | null>(null);
  const [templateBuilder, setTemplateBuilder] = useState<TemplateBuilderContext | null>(null);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [packetsOpen, setPacketsOpen] = useState(false);
  const [notificationPrefsOpen, setNotificationPrefsOpen] = useState(false);
  const [webhooksOpen, setWebhooksOpen] = useState(false);
  const [recoveryBinOpen, setRecoveryBinOpen] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [autoPopulateSuggestedFields, setAutoPopulateSuggestedFields] = useState(true);
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
  const [_pendingEnvelopes, setPendingEnvelopes] = useState<EsignEnvelope[]>([]);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const {
    uploadDocument,
    sendInvites,
    voidEnvelope,
    deleteEnvelope,
    saveFields,
    downloadDocument,
    uploading,
    sending,
    savingFields,
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
    setTemplateBuilder(null);
    setAutoPopulateSuggestedFields(true);
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

  const syncDraftSigners = async (envelopeId: string, signers: SignerFormData[]) => {
    await esignApi.saveDraftSigners(envelopeId, toDraftSignerPayload(signers));
  };

  const hydrateTemplateFieldsOntoEnvelope = async (params: {
    envelope: EsignEnvelope;
    template: EsignTemplateRecord;
    signers: SignerFormData[];
    documentMap?: Record<string, string>;
  }): Promise<EsignField[]> => {
    const fields = buildTemplateFieldsForEnvelope(params);

    if (fields.length > 0) {
      await saveFields(params.envelope.id, fields);
      setActiveEnvelope({ ...params.envelope, fields });
    }

    return fields;
  };

  const materialiseTemplateDraftForWizard = async (
    template: EsignTemplateRecord,
    options?: { campaignId?: string; packetRunId?: string; packetStepIndex?: number },
  ): Promise<{
    envelope: EsignEnvelope;
    fields: EsignField[];
    documentMap: Record<string, string>;
  }> => {
    const primarySystemSigner = wizardData.signers.find(
      (signer) => signer.isSystemClient && signer.clientId,
    );
    const clientId = primarySystemSigner?.clientId;
    const result = await esignApi.materialiseTemplateDraft({
      templateId: template.id,
      title: wizardData.title || template.name,
      message: wizardData.message,
      expiryDays: wizardData.expiryDays,
      clientId,
      campaignId: options?.campaignId,
      packetRunId: options?.packetRunId,
      packetStepIndex: options?.packetStepIndex,
    });

    setPendingEnvelopes([]);
    setActiveEnvelope(result.envelope);
    const url = result.envelope.document?.url || result.envelope.documentUrl;
    if (url) setDocumentUrl(url);

    try {
      await syncDraftSigners(result.envelope.id, wizardData.signers);
    } catch (draftErr) {
      logger.warn('Failed to persist draft signers on template draft (non-critical):', {
        error: draftErr,
      });
    }

    const hydratedFields = await hydrateTemplateFieldsOntoEnvelope({
      envelope: result.envelope,
      template,
      signers: wizardData.signers,
      documentMap: result.documentMap,
    });

    return {
      envelope: { ...result.envelope, fields: hydratedFields },
      fields: hydratedFields,
      documentMap: result.documentMap,
    };
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
    setWizardData({
      files: [],
      title: template.name,
      message: template.defaultMessage || '',
      expiryDays: template.defaultExpiryDays ?? 30,
      signers: mapTemplateRecipientsToWizard(template),
    });
    setView(templateHasSavedDocuments(template) ? 'wizard-recipients' : 'wizard-upload');
  };

  const handleUploadNext = (files: File[], title: string, message: string, expiryDays: number) => {
    setWizardData((prev) => ({
      ...prev,
      files,
      title,
      message,
      expiryDays,
    }));
    setView('wizard-recipients');
  };

  const handleStartTemplateBuilder = (seed: {
    name: string;
    description?: string;
    category?: string;
  }) => {
    if (!canCreate) return;
    resetWizardState();
    setTemplateBuilder({
      mode: 'create',
      name: seed.name,
      description: seed.description,
      category: seed.category,
    });
    setTemplateContext({
      version: 1,
      template: {
        id: 'template-builder-draft',
        name: seed.name,
        description: seed.description,
        category: seed.category,
        signingMode: 'sequential',
        defaultExpiryDays: 30,
        recipients: [],
        documents: [],
        fields: [],
        usageCount: 0,
        version: 1,
        createdBy: 'template-builder',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    setWizardData({
      files: [],
      title: seed.name,
      message: '',
      expiryDays: 30,
      signers: [],
    });
    setView('wizard-upload');
  };

  const handleConfigureTemplate = async (template: EsignTemplateRecord) => {
    if (!canCreate) return;

    resetWizardState();
    setTemplateBuilder({
      mode: 'edit',
      templateId: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
    });
    setTemplateContext({ template, version: template.version ?? 1 });
    setWizardData({
      files: [],
      title: template.name,
      message: template.defaultMessage || '',
      expiryDays: template.defaultExpiryDays ?? 30,
      signers: mapTemplateRecipientsToWizard(template),
    });

    if (!templateHasSavedDocuments(template)) {
      setView('wizard-upload');
      return;
    }

    try {
      await materialiseTemplateDraftForWizard(template);
      setView('prepare');
      toast.success(`Template "${template.name}" loaded for editing.`);
    } catch (error: unknown) {
      logger.error('Failed to open template builder:', error);
      resetWizardState();
      toast.error(error instanceof Error ? error.message : 'Failed to load template builder');
    }
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
        await syncDraftSigners(activeEnvelope.id, wizardData.signers);
      } catch (draftErr) {
        logger.warn('Failed to update draft signers on existing envelope (non-critical):', {
          error: draftErr,
        });
      }
      return { envelope: activeEnvelope, fields: activeEnvelope.fields ?? [] };
    }

    if (templateContext && templateHasSavedDocuments(templateContext.template)) {
      return materialiseTemplateDraftForWizard(templateContext.template);
    }

    if (!wizardData.files || wizardData.files.length === 0) {
      toast.error('No documents found. Please go back and upload at least one document.');
      logger.error('materialiseEnvelopeFromWizard aborted: wizardData.files is empty', {
        filesValue: wizardData.files,
      });
      return null;
    }

    const primarySystemSigner = wizardData.signers.find((s) => s.isSystemClient && s.clientId);
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
      await syncDraftSigners(result.id, wizardData.signers);
    } catch (draftErr) {
      logger.warn('Failed to persist draft signers (non-critical):', { error: draftErr });
    }

    let hydratedFields: EsignField[] = [];
    if (templateContext && templateContext.template.fields.length > 0) {
      try {
        hydratedFields = await hydrateTemplateFieldsOntoEnvelope({
          envelope: result,
          template: templateContext.template,
          signers: wizardData.signers,
        });
      } catch (hydrateErr) {
        logger.warn('Failed to hydrate template fields (non-critical):', { error: hydrateErr });
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
        await syncDraftSigners(activeEnvelope.id, wizardData.signers);
      } catch (draftErr) {
        logger.warn('Failed to update draft signers on existing envelope (non-critical):', {
          error: draftErr,
        });
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

      const sourceMsg = templateBuilder
        ? 'Template draft ready - place the reusable fields and save it.'
        : templateContext
          ? `Template "${templateContext.template.name}" applied - ${out.fields.length} field(s) placed.`
          : wizardData.files.length > 1
            ? `${wizardData.files.length} documents merged! Proceeding to prepare the form fields.`
            : 'Document uploaded! Now prepare the form fields.';
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
      logger.error('Failed to save esign fields', err);
      toast.error('Failed to save fields');
    }
  };

  const handleSend = async (currentFields?: EsignField[]) => {
    if (!activeEnvelope) return;

    // Use passed fields if provided (handles race condition), otherwise use state
    const fieldsToUse = currentFields || activeEnvelope.fields || [];

    try {
      // fieldsToUse contains fields where signer_id is the signer's email;
      // the backend wants each field stamped with the signer's index.
      const fieldsForInvite = attachSignerIndexes(fieldsToUse, wizardData.signers);

      await sendInvites(activeEnvelope.id, {
        signers: toInviteSignerPayload(wizardData.signers),
        fields: fieldsForInvite,
        message: wizardData.message,
        expiryDays: wizardData.expiryDays,
      });
      toast.success('Document sent for signature!');

      // All done — clear all wizard/prepare state so the next
      // "Start New Envelope" or "Continue Editing" begins clean.
      resetWizardState();
      setRefreshTrigger((prev) => prev + 1);
      setView('dashboard');
    } catch (error: unknown) {
      logger.error('Failed to send:', error);
      toast.error('Failed to send envelope');
    }
  };

  const handleSaveTemplate = async (currentFields?: EsignField[]) => {
    if (!activeEnvelope || !templateBuilder) return;

    const fieldsToUse = currentFields || activeEnvelope.fields || [];
    if (fieldsToUse.length === 0) {
      toast.error('Place at least one field before saving this template.');
      return;
    }

    setSavingTemplate(true);
    try {
      const templateName = (
        activeEnvelope.title ||
        templateBuilder.name ||
        wizardData.title
      ).trim();
      const payload = {
        name: templateName,
        description: templateBuilder.description,
        category: templateBuilder.category,
      };

      const result =
        templateBuilder.mode === 'edit' && templateBuilder.templateId
          ? await esignApi.syncTemplateFromEnvelope({
              templateId: templateBuilder.templateId,
              envelopeId: activeEnvelope.id,
              ...payload,
            })
          : await esignApi.createTemplate({
              ...payload,
              fromEnvelopeId: activeEnvelope.id,
            });

      if (canDelete) {
        try {
          await deleteEnvelope(activeEnvelope.id);
        } catch (cleanupErr) {
          logger.warn('Template builder draft cleanup failed (non-critical):', {
            error: cleanupErr,
          });
        }
      }

      toast.success(
        templateBuilder.mode === 'edit'
          ? `Template "${result.template.name}" updated.`
          : `Template "${result.template.name}" created.`,
      );
      resetWizardState();
      setRefreshTrigger((prev) => prev + 1);
      setView('dashboard');
    } catch (error: unknown) {
      logger.error('Failed to save template:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save template');
    } finally {
      setSavingTemplate(false);
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
    const missingEmail = wizardData.signers.find((s) => !s.email?.trim());
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
    const filename =
      selectedEnvelope?.id === envelopeId ? `${selectedEnvelope.title}.pdf` : 'document.pdf';

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

      // 3. Reconstruct signers (real records first, then draft_signers)
      const signers = signersFromResumedEnvelope(fullEnvelope);

      // 4. Populate wizard data and prepare state.
      //    CRITICAL: reset `files` to []. If a previous "Start New" session
      //    left files in state, the smart-back from prepare would otherwise
      //    drop the user into the recipients wizard for a stale envelope and
      //    "Next" would create a duplicate draft (the very bug we're fixing).
      //    Also derive expiryDays from the envelope so the value is correct
      //    if the user re-sends from the prepare studio.
      const expiresAtIso =
        (fullEnvelope as { expires_at?: string; expiresAt?: string }).expires_at ??
        (fullEnvelope as { expiresAt?: string }).expiresAt;
      const expiryDays = deriveExpiryDays(expiresAtIso, Date.now(), 30);

      setTemplateBuilder(null);
      setTemplateContext(null);
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
            autoPopulateSuggestedFields={autoPopulateSuggestedFields}
            onBack={() => {
              // If we have wizard files, we came from the normal wizard flow — go back to recipients.
              // If no files (resumed draft), go back to dashboard and clear
              // the active envelope so subsequent "Start New" doesn't reuse it.
              if (wizardData.files.length > 0 || templateContext || templateBuilder) {
                setView('wizard-recipients');
              } else {
                setActiveEnvelope(null);
                setDocumentUrl(null);
                setView('dashboard');
                setRefreshTrigger((prev) => prev + 1);
              }
            }}
            onSaveFields={handleSaveFields}
            onSendForSignature={templateBuilder ? handleSaveTemplate : handleSend}
            sendActionLabel={templateBuilder ? 'Save Template' : 'Send'}
            sendActionBusyLabel={templateBuilder ? 'Saving template...' : 'Sending...'}
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
              const expiresAtIso =
                (updated as { expires_at?: string; expiresAt?: string }).expires_at ??
                (updated as { expiresAt?: string }).expiresAt;
              const expiryDays = deriveExpiryDays(
                expiresAtIso,
                new Date(updated.created_at).getTime(),
                wizardData.expiryDays,
              );
              setWizardData((prev) => ({
                ...prev,
                title: updated.title,
                message: updated.message || '',
                expiryDays,
              }));
              setRefreshTrigger((p) => p + 1);
            }}
            saving={savingFields}
            sending={templateBuilder ? savingTemplate : sending}
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
              onStartTemplateBuilder={handleStartTemplateBuilder}
              onConfigureTemplate={handleConfigureTemplate}
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
                onCancel={() => {
                  resetWizardState();
                  setView('dashboard');
                }}
                initialData={{
                  files: wizardData.files,
                  title: wizardData.title,
                  message: wizardData.message,
                  expiryDays: wizardData.expiryDays,
                }}
              />
            </Suspense>
          )}

          {view === 'wizard-recipients' && (
            <RecipientsStepView
              signers={wizardData.signers}
              onSignersChange={(signers) => setWizardData((prev) => ({ ...prev, signers }))}
              templateContext={templateContext}
              isTemplateBuilder={!!templateBuilder}
              canSend={canSend}
              autoPopulateSuggestedFields={autoPopulateSuggestedFields}
              onAutoPopulateChange={setAutoPopulateSuggestedFields}
              uploading={uploading}
              sending={sending}
              onBack={() => {
                if (
                  wizardData.files.length > 0 ||
                  (templateBuilder && !templateHasSavedDocuments(templateContext?.template))
                ) {
                  setView('wizard-upload');
                } else {
                  resetWizardState();
                  setView('dashboard');
                }
              }}
              onExpressSend={handleExpressSend}
              onNext={handleRecipientsNext}
            />
          )}
        </div>
      )}

      <EsignModuleDialogs
        templatePickerOpen={templatePickerOpen}
        onTemplatePickerOpenChange={setTemplatePickerOpen}
        onStartBlank={handleStartBlank}
        onSelectTemplate={handleSelectTemplate}
        bulkSendOpen={bulkSendOpen}
        onBulkSendOpenChange={setBulkSendOpen}
        packetsOpen={packetsOpen}
        onPacketsOpenChange={setPacketsOpen}
        notificationPrefsOpen={notificationPrefsOpen}
        onNotificationPrefsOpenChange={setNotificationPrefsOpen}
        webhooksOpen={webhooksOpen}
        onWebhooksOpenChange={setWebhooksOpen}
        recoveryBinOpen={recoveryBinOpen}
        onRecoveryBinOpenChange={setRecoveryBinOpen}
        auditLogOpen={auditLogOpen}
        onAuditLogOpenChange={setAuditLogOpen}
        retentionOpen={retentionOpen}
        onRetentionOpenChange={setRetentionOpen}
        brandingOpen={brandingOpen}
        onBrandingOpenChange={setBrandingOpen}
        onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
        onInspectEnvelope={handleViewEnvelope}
        selectedEnvelope={selectedEnvelope}
        detailsDialogOpen={detailsDialogOpen}
        onDetailsOpenChange={setDetailsDialogOpen}
        onDownloadDocument={handleDownloadDocument}
        onResumePrepare={canCreate ? handleResumePrepare : undefined}
        resumingEnvelopeId={resumingEnvelopeId}
        onVoidEnvelope={
          canSend
            ? async (id, reason) => {
                await voidEnvelope(id, reason);
                setDetailsDialogOpen(false);
                setRefreshTrigger((prev) => prev + 1);
                toast.success('Voided successfully');
              }
            : undefined
        }
        onDeleteEnvelope={
          canDelete
            ? async (id) => {
                await deleteEnvelope(id);
                setDetailsDialogOpen(false);
                setRefreshTrigger((prev) => prev + 1);
                // P6.8 — soft delete: signal to the user that this is
                // recoverable, so they feel safe discarding without
                // reaching for "Are you sure?" guardrails.
                toast.success('Envelope moved to Recovery Bin (restorable for 90 days).');
              }
            : undefined
        }
      />
    </div>
  );
}
