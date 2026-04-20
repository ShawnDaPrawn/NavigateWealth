/**
 * useEnvelopeActions Hook
 * React hook for envelope actions (upload, send, sign, etc.)
 */

import { useState } from 'react';
import { esignApi } from '../api';
import { logger } from '../../../../../utils/logger';
import type {
  UploadDocumentRequest,
  SendInvitesRequest,
  SubmitSignatureRequest,
  RejectSigningRequest,
  SaveTemplateRequest,
  EsignEnvelope,
  EsignField,
} from '../types';

interface UseEnvelopeActionsReturn {
  uploading: boolean;
  uploadError: string | null;
  uploadDocument: (request: UploadDocumentRequest) => Promise<EsignEnvelope | null>;
  
  sending: boolean;
  sendError: string | null;
  sendInvites: (envelopeId: string, request: SendInvitesRequest) => Promise<boolean>;
  
  signing: boolean;
  signError: string | null;
  submitSignature: (envelopeId: string, request: SubmitSignatureRequest) => Promise<boolean>;
  
  rejecting: boolean;
  rejectError: string | null;
  rejectSigning: (envelopeId: string, request: RejectSigningRequest) => Promise<boolean>;
  
  savingTemplate: boolean;
  templateError: string | null;
  saveAsTemplate: (envelopeId: string, request: SaveTemplateRequest) => Promise<boolean>;
  
  savingFields: boolean;
  saveFieldsError: string | null;
  saveFields: (envelopeId: string, fields: EsignField[]) => Promise<boolean>;

  deleting: boolean;
  deleteError: string | null;
  deleteEnvelope: (envelopeId: string) => Promise<boolean>;
  
  voiding: boolean;
  voidError: string | null;
  voidEnvelope: (envelopeId: string, reason?: string) => Promise<boolean>;

  downloading: boolean;
  downloadDocument: (envelopeId: string, filename?: string) => Promise<void>;
}

export function useEnvelopeActions(): UseEnvelopeActionsReturn {
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Send state
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Sign state
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  // Reject state
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Template state
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Void state
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Download state
  const [downloading, setDownloading] = useState(false);

  // ==================== UPLOAD DOCUMENT ====================

  const uploadDocument = async (
    request: UploadDocumentRequest
  ): Promise<EsignEnvelope | null> => {
    setUploading(true);
    setUploadError(null);

    try {
      if (request.files && request.files.length > 0) {
        logger.debug('📤 Uploading documents:', request.files.map(f => f.name).join(', '));
      } else {
        logger.error('📤 Upload aborted: No files provided in request');
        setUploadError('No files provided. Please select at least one document.');
        return null;
      }
      const response = await esignApi.uploadDocument(request);
      logger.debug('✅ Document uploaded successfully');
      // P3.1 + P3.2 — attach autodetect candidates onto the envelope so
      // the studio can pick them up without a second roundtrip. The
      // property is purged from the envelope on subsequent GETs.
      return {
        ...response.envelope,
        field_candidates: response.field_candidates ?? [],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      logger.error('❌ Upload error:', errorMessage);
      setUploadError(errorMessage);
      return null;
    } finally {
      setUploading(false);
    }
  };

  // ==================== SEND INVITES ====================

  const sendInvites = async (
    envelopeId: string,
    request: SendInvitesRequest
  ): Promise<boolean> => {
    setSending(true);
    setSendError(null);

    try {
      logger.debug('📧 Sending invites for envelope:', envelopeId);
      await esignApi.sendInvites(envelopeId, request);
      logger.debug('✅ Invites sent successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invites';
      logger.error('❌ Send error:', errorMessage);
      setSendError(errorMessage);
      return false;
    } finally {
      setSending(false);
    }
  };

  // ==================== SUBMIT SIGNATURE ====================

  const submitSignature = async (
    envelopeId: string,
    request: SubmitSignatureRequest
  ): Promise<boolean> => {
    setSigning(true);
    setSignError(null);

    try {
      logger.debug('✍️ Submitting signature for envelope:', envelopeId);
      await esignApi.submitSignature(envelopeId, request);
      logger.debug('✅ Signature submitted successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit signature';
      logger.error('❌ Sign error:', errorMessage);
      setSignError(errorMessage);
      return false;
    } finally {
      setSigning(false);
    }
  };

  // ==================== REJECT SIGNING ====================

  const rejectSigning = async (
    envelopeId: string,
    request: RejectSigningRequest
  ): Promise<boolean> => {
    setRejecting(true);
    setRejectError(null);

    try {
      logger.debug('❌ Rejecting signing for envelope:', envelopeId);
      await esignApi.rejectSigning(envelopeId, request);
      logger.debug('✅ Rejection recorded successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject signing';
      logger.error('❌ Reject error:', errorMessage);
      setRejectError(errorMessage);
      return false;
    } finally {
      setRejecting(false);
    }
  };

  // ==================== SAVE AS TEMPLATE ====================

  const saveAsTemplate = async (
    envelopeId: string,
    request: SaveTemplateRequest
  ): Promise<boolean> => {
    setSavingTemplate(true);
    setTemplateError(null);

    try {
      logger.debug('💾 Saving envelope as template:', envelopeId);
      await esignApi.saveAsTemplate(envelopeId, request);
      logger.debug('✅ Template saved successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save template';
      logger.error('❌ Template error:', errorMessage);
      setTemplateError(errorMessage);
      return false;
    } finally {
      setSavingTemplate(false);
    }
  };

  // ==================== SAVE FIELDS ====================

  const [savingFields, setSavingFields] = useState(false);
  const [saveFieldsError, setSaveFieldsError] = useState<string | null>(null);

  const saveFields = async (
    envelopeId: string,
    fields: EsignField[]
  ): Promise<boolean> => {
    setSavingFields(true);
    setSaveFieldsError(null);

    try {
      logger.debug('💾 Saving fields for envelope:', envelopeId);
      await esignApi.saveFields(envelopeId, fields);
      logger.debug('✅ Fields saved successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save fields';
      logger.error('❌ Save fields error:', errorMessage);
      setSaveFieldsError(errorMessage);
      return false;
    } finally {
      setSavingFields(false);
    }
  };

  // ==================== DELETE ENVELOPE ====================

  const deleteEnvelope = async (envelopeId: string): Promise<boolean> => {
    setDeleting(true);
    setDeleteError(null);

    try {
      logger.debug('🗑️ Deleting envelope:', envelopeId);
      await esignApi.deleteEnvelope(envelopeId);
      logger.debug('✅ Envelope deleted successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete envelope';
      logger.error('❌ Delete error:', errorMessage);
      setDeleteError(errorMessage);
      return false;
    } finally {
      setDeleting(false);
    }
  };

  // ==================== VOID ENVELOPE ====================

  const voidEnvelope = async (
    envelopeId: string,
    reason?: string
  ): Promise<boolean> => {
    setVoiding(true);
    setVoidError(null);

    try {
      logger.debug('🚫 Voiding envelope:', envelopeId);
      await esignApi.voidEnvelope(envelopeId, reason);
      logger.debug('✅ Envelope voided successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to void envelope';
      logger.error('❌ Void error:', errorMessage);
      setVoidError(errorMessage);
      return false;
    } finally {
      setVoiding(false);
    }
  };

  // ==================== DOWNLOAD DOCUMENT ====================

  const downloadDocument = async (envelopeId: string, filename?: string): Promise<void> => {
    setDownloading(true);
    try {
      await esignApi.downloadDocument(envelopeId, filename);
    } catch (err) {
      logger.error('❌ Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  return {
    uploading,
    uploadError,
    uploadDocument,
    
    sending,
    sendError,
    sendInvites,
    
    signing,
    signError,
    submitSignature,
    
    rejecting,
    rejectError,
    rejectSigning,
    
    savingTemplate,
    templateError,
    saveAsTemplate,
    
    savingFields,
    saveFieldsError,
    saveFields,

    deleting,
    deleteError,
    deleteEnvelope,
    
    voiding,
    voidError,
    voidEnvelope,

    downloading,
    downloadDocument,
  };
}