/**
 * E-Signature Mutation Hooks
 * Navigate Wealth Admin Dashboard
 *
 * React Query mutation hooks for E-Signature create, update, and delete operations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { esignApi } from '../api';
import { esignKeys } from './useEnvelopesQuery';
import { logger } from '../../../../../utils/logger';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../constants';
// P8.5 — All write paths route their failure toasts through `toastError`
// so the user gets a "Retry" affordance for transient network blips
// without having to reopen the dialog.
import { toastError } from '../utils/toastWithRetry';
import type {
  UploadDocumentRequest,
  SendInvitesRequest,
  SubmitSignatureRequest,
  RejectSigningRequest,
  SaveTemplateRequest,
  EsignField,
} from '../types';

// ============================================================================
// ENVELOPE MUTATIONS
// ============================================================================

/**
 * Hook to upload a document and create an envelope
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const { mutate: uploadDocument, isPending } = useUploadDocument();
 *
 * uploadDocument({
 *   files: [pdfFile],
 *   context: {
 *     clientId: 'client-123',
 *     title: 'Service Agreement',
 *     message: 'Please review and sign',
 *     expiryDays: 30,
 *   }
 * });
 * ```
 */
export function useUploadDocument() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (request: UploadDocumentRequest) => {
      logger.debug('[E-Sign Mutation] Uploading document...');
      return esignApi.uploadDocument(request);
    },
    onSuccess: (data, variables) => {
      logger.info('[E-Sign Mutation] Document uploaded successfully');

      queryClient.invalidateQueries({ queryKey: esignKeys.envelopes() });

      if (variables.context.clientId) {
        queryClient.invalidateQueries({
          queryKey: esignKeys.clientEnvelopes(variables.context.clientId),
        });
      }

      toast.success(SUCCESS_MESSAGES.ENVELOPE_CREATED);
    },
    onError: (error: Error, variables) => {
      console.error('❌ [E-Sign Mutation] Failed to upload document:', error);
      toastError(ERROR_MESSAGES.UPLOAD_FAILED, error, {
        id: 'esign-upload-failed',
        retry: () => mutation.mutate(variables),
      });
    },
  });
  return mutation;
}

/**
 * Hook to save fields for an envelope
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const { mutate: saveFields, isPending } = useSaveFields();
 *
 * saveFields({
 *   envelopeId: 'envelope-123',
 *   fields: [...],
 * });
 * ```
 */
export function useSaveFields() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ envelopeId, fields }: { envelopeId: string; fields: EsignField[] }) => {
      logger.debug('[E-Sign Mutation] Saving fields for envelope', { envelopeId });
      return esignApi.saveFields(envelopeId, fields);
    },
    onSuccess: (data, variables) => {
      logger.info('[E-Sign Mutation] Fields saved successfully');
      queryClient.invalidateQueries({
        queryKey: esignKeys.envelope(variables.envelopeId),
      });
      toast.success(SUCCESS_MESSAGES.FIELDS_SAVED);
    },
    onError: (error: Error, variables) => {
      console.error('❌ [E-Sign Mutation] Failed to save fields:', error);
      toastError(ERROR_MESSAGES.FIELDS_FAILED, error, {
        id: `esign-savefields-${variables.envelopeId}`,
        retry: () => mutation.mutate(variables),
      });
    },
  });
  return mutation;
}

/**
 * Hook to send invitations to signers
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const { mutate: sendInvites, isPending } = useSendInvites();
 *
 * sendInvites({
 *   envelopeId: 'envelope-123',
 *   request: {
 *     signers: [
 *       { name: 'John Doe', email: 'john@example.com', otpRequired: true }
 *     ],
 *     expiryDays: 30,
 *     message: 'Please sign this document',
 *   }
 * });
 * ```
 */
export function useSendInvites() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({
      envelopeId,
      request,
    }: {
      envelopeId: string;
      request: SendInvitesRequest;
    }) => {
      logger.debug('[E-Sign Mutation] Sending invitations for envelope', { envelopeId });
      return esignApi.sendInvites(envelopeId, request);
    },
    onSuccess: (data, variables) => {
      logger.info('[E-Sign Mutation] Invitations sent successfully');
      queryClient.invalidateQueries({ queryKey: esignKeys.envelopes() });
      queryClient.invalidateQueries({
        queryKey: esignKeys.envelope(variables.envelopeId),
      });
      toast.success(SUCCESS_MESSAGES.ENVELOPE_SENT);
    },
    onError: (error: Error, variables) => {
      console.error('❌ [E-Sign Mutation] Failed to send invitations:', error);
      toastError(ERROR_MESSAGES.SEND_FAILED, error, {
        id: `esign-send-${variables.envelopeId}`,
        retry: () => mutation.mutate(variables),
      });
    },
  });
  return mutation;
}

/**
 * Hook to void an envelope
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const { mutate: voidEnvelope, isPending } = useVoidEnvelope();
 *
 * voidEnvelope('envelope-123');
 * ```
 */
export function useVoidEnvelope() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (envelopeId: string) => {
      logger.debug('[E-Sign Mutation] Voiding envelope', { envelopeId });
      return esignApi.voidEnvelope(envelopeId);
    },
    onSuccess: (data, envelopeId) => {
      logger.info('[E-Sign Mutation] Envelope voided successfully');
      queryClient.invalidateQueries({ queryKey: esignKeys.envelopes() });
      queryClient.invalidateQueries({ queryKey: esignKeys.envelope(envelopeId) });
      toast.success(SUCCESS_MESSAGES.ENVELOPE_VOIDED);
    },
    onError: (error: Error, envelopeId) => {
      console.error('❌ [E-Sign Mutation] Failed to void envelope:', error);
      toastError(ERROR_MESSAGES.VOID_FAILED, error, {
        id: `esign-void-${envelopeId}`,
        retry: () => mutation.mutate(envelopeId),
      });
    },
  });
  return mutation;
}

/**
 * Hook to save envelope as template
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const { mutate: saveAsTemplate, isPending } = useSaveAsTemplate();
 *
 * saveAsTemplate({
 *   envelopeId: 'envelope-123',
 *   request: {
 *     name: 'Service Agreement Template',
 *     description: 'Standard service agreement for new clients',
 *   }
 * });
 * ```
 */
export function useSaveAsTemplate() {
  return useMutation({
    mutationFn: async ({
      envelopeId,
      request,
    }: {
      envelopeId: string;
      request: SaveTemplateRequest;
    }) => {
      logger.debug('[E-Sign Mutation] Saving envelope as template', { envelopeId });
      return esignApi.saveAsTemplate(envelopeId, request);
    },
    onSuccess: () => {
      logger.info('[E-Sign Mutation] Template saved successfully');
      toast.success(SUCCESS_MESSAGES.TEMPLATE_SAVED);
    },
    onError: (error: Error) => {
      console.error('❌ [E-Sign Mutation] Failed to save template:', error);
      toast.error(`${ERROR_MESSAGES.TEMPLATE_FAILED}: ${error.message}`);
    },
  });
}

// ============================================================================
// SIGNER MUTATIONS
// ============================================================================

/**
 * Hook to send OTP to a signer
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const { mutate: sendOTP, isPending } = useSendOTP();
 *
 * sendOTP({
 *   envelopeId: 'envelope-123',
 *   signerId: 'signer-456',
 * });
 * ```
 */
export function useSendOTP() {
  return useMutation({
    mutationFn: async ({ envelopeId, signerId }: { envelopeId: string; signerId: string }) => {
      logger.debug('[E-Sign Mutation] Sending OTP to signer', { signerId });
      return esignApi.sendOTP(envelopeId, signerId);
    },
    onSuccess: () => {
      logger.info('[E-Sign Mutation] OTP sent successfully');
      toast.success(SUCCESS_MESSAGES.OTP_SENT);
    },
    onError: (error: Error) => {
      console.error('❌ [E-Sign Mutation] Failed to send OTP:', error);
      toast.error(`${ERROR_MESSAGES.OTP_SEND_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to submit a signature
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const { mutate: submitSignature, isPending } = useSubmitSignature();
 *
 * submitSignature({
 *   envelopeId: 'envelope-123',
 *   request: {
 *     signerId: 'signer-456',
 *     signatureDataUrl: 'data:image/png;base64,...',
 *     consentAccepted: true,
 *   }
 * });
 * ```
 */
export function useSubmitSignature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      envelopeId,
      request,
    }: {
      envelopeId: string;
      request: SubmitSignatureRequest;
    }) => {
      logger.debug('[E-Sign Mutation] Submitting signature for envelope', { envelopeId });
      return esignApi.submitSignature(envelopeId, request);
    },
    onSuccess: (data, variables) => {
      logger.info('[E-Sign Mutation] Signature submitted successfully');

      // Invalidate envelope lists and specific envelope
      queryClient.invalidateQueries({ queryKey: esignKeys.envelopes() });
      queryClient.invalidateQueries({
        queryKey: esignKeys.envelope(variables.envelopeId),
      });

      toast.success(SUCCESS_MESSAGES.SIGNATURE_SUBMITTED);
    },
    onError: (error: Error) => {
      console.error('❌ [E-Sign Mutation] Failed to submit signature:', error);
      toast.error(`${ERROR_MESSAGES.SIGNATURE_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to reject signing
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const { mutate: rejectSigning, isPending } = useRejectSigning();
 *
 * rejectSigning({
 *   envelopeId: 'envelope-123',
 *   request: {
 *     signerId: 'signer-456',
 *     reason: 'Terms not acceptable',
 *   }
 * });
 * ```
 */
export function useRejectSigning() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      envelopeId,
      request,
    }: {
      envelopeId: string;
      request: RejectSigningRequest;
    }) => {
      logger.debug('[E-Sign Mutation] Rejecting signing for envelope', { envelopeId });
      return esignApi.rejectSigning(envelopeId, request);
    },
    onSuccess: (data, variables) => {
      logger.info('[E-Sign Mutation] Signing rejected');

      // Invalidate envelope lists and specific envelope
      queryClient.invalidateQueries({ queryKey: esignKeys.envelopes() });
      queryClient.invalidateQueries({
        queryKey: esignKeys.envelope(variables.envelopeId),
      });

      toast.info('Signing rejected');
    },
    onError: (error: Error) => {
      console.error('❌ [E-Sign Mutation] Failed to reject signing:', error);
      toast.error(`Failed to reject: ${error.message}`);
    },
  });
}
