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

function StepFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
    </div>
  );
}

type ViewState = 'dashboard' | 'wizard-upload' | 'wizard-recipients' | 'prepare';

export function EsignModule() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [selectedEnvelope, setSelectedEnvelope] = useState<EsignEnvelope | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [resumingEnvelopeId, setResumingEnvelopeId] = useState<string | null>(null);
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

  const handleStartNew = () => {
    if (!canCreate) return;
    // Reset wizard
    setWizardData({
      files: [],
      title: '',
      message: '',
      expiryDays: 30,
      signers: [],
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

  const handleRecipientsNext = async () => {
    if (wizardData.signers.length === 0) {
      toast.error('Please add at least one recipient.');
      return;
    }

    // Defensive guard: ensure files were not lost between wizard steps
    if (!wizardData.files || wizardData.files.length === 0) {
      toast.error('No documents found. Please go back and upload at least one document.');
      logger.error('handleRecipientsNext aborted: wizardData.files is empty or undefined', {
        filesValue: wizardData.files,
      });
      return;
    }

    try {
      // Determine the primary client ID from system client signers (if any)
      const primarySystemSigner = wizardData.signers.find(s => s.isSystemClient && s.clientId);
      const clientId = primarySystemSigner?.clientId;

      // Create single envelope for ALL files (backend merges them)
      const result = await uploadDocument({
        files: wizardData.files,
        context: {
          clientId,
          title: wizardData.title,
          message: wizardData.message,
          expiresAt: new Date(Date.now() + wizardData.expiryDays * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      if (!result || !result.id) {
        throw new Error('Failed to create envelope');
      }

      // Set active envelope (no queue needed as all files are merged)
      setPendingEnvelopes([]);
      setActiveEnvelope(result);
      
      const url = result.document?.url || result.documentUrl;
      if (url) {
        setDocumentUrl(url);
      }

      // Persist signer configuration on the draft envelope so it survives
      // page reloads and the "Continue Editing" resume flow.
      try {
        await esignApi.saveDraftSigners(result.id, wizardData.signers.map((s, idx) => ({
          name: s.name,
          email: s.email,
          role: s.role || 'Signer',
          order: s.order ?? idx + 1,
          otpRequired: s.otpRequired,
          accessCode: s.accessCode,
          clientId: s.clientId,
          isSystemClient: s.isSystemClient,
        })));
      } catch (draftErr) {
        // Non-critical: the prepare flow will still work from local state.
        // It only matters for the "Continue Editing" resume flow.
        logger.warn('Failed to persist draft signers (non-critical):', draftErr);
      }

      toast.success(wizardData.files.length > 1 
        ? `${wizardData.files.length} documents merged! Proceeding to prepare the form fields.` 
        : 'Document uploaded! Now prepare the form fields.');
      
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
            role: s.role,
            order: s.order,
            otpRequired: s.otpRequired,
            accessCode: s.accessCode,
            clientId: s.clientId,
         })),
         fields: fieldsForInvite,
         message: wizardData.message,
         expiryDays: wizardData.expiryDays
      });
      toast.success('Document sent for signature!');
      
      // All done - Route back to dashboard immediately
      setView('dashboard');
    } catch (error: unknown) {
      logger.error('Failed to send:', error);
      toast.error('Failed to send envelope');
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

      // 4. Populate wizard data and prepare state
      setWizardData(prev => ({
        ...prev,
        title: fullEnvelope.title,
        message: fullEnvelope.message || '',
        signers,
      }));
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
              // If no files (resumed draft), go back to dashboard.
              if (wizardData.files.length > 0) {
                setView('wizard-recipients');
              } else {
                setView('dashboard');
                setRefreshTrigger(prev => prev + 1);
              }
            }}
            onSaveFields={handleSaveFields}
            onSendForSignature={handleSend}
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
          )}
        </div>
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
               toast.success('Envelope discarded successfully');
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