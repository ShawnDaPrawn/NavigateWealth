/**
 * E-Signature Mutation Hooks
 * Navigate Wealth Admin Dashboard
 * 
 * React Query mutation hooks for E-Signature create, update, and delete operations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { esignApi } from '../api';
import { esignKeys } from './useEnvelopesQuery';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../constants';
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

  return useMutation({
    mutationFn: async (request: UploadDocumentRequest) => {
      console.log('📤 [E-Sign Mutation] Uploading document...');
      return esignApi.uploadDocument(request);
    },
    onSuccess: (data, variables) => {
      console.log('✅ [E-Sign Mutation] Document uploaded successfully');
      
      // Invalidate all envelope lists
      queryClient.invalidateQueries({ queryKey: esignKeys.envelopes() });
      
      // If clientId provided, invalidate client-specific envelopes
      if (variables.context.clientId) {
        queryClient.invalidateQueries({ 
          queryKey: esignKeys.clientEnvelopes(variables.context.clientId) 
        });
      }
      
      toast.success(SUCCESS_MESSAGES.ENVELOPE_CREATED);
    },
    onError: (error: Error) => {
      console.error('❌ [E-Sign Mutation] Failed to upload document:', error);
      toast.error(`${ERROR_MESSAGES.UPLOAD_FAILED}: ${error.message}`);
    },
  });
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

  return useMutation({
    mutationFn: async ({ envelopeId, fields }: { envelopeId: string; fields: EsignField[] }) => {
      console.log('💾 [E-Sign Mutation] Saving fields for envelope:', envelopeId);
      return esignApi.saveFields(envelopeId, fields);
    },
    onSuccess: (data, variables) => {
      console.log('✅ [E-Sign Mutation] Fields saved successfully');
      
      // Invalidate specific envelope
      queryClient.invalidateQueries({ 
        queryKey: esignKeys.envelope(variables.envelopeId) 
      });
      
      toast.success(SUCCESS_MESSAGES.FIELDS_SAVED);
    },
    onError: (error: Error) => {
      console.error('❌ [E-Sign Mutation] Failed to save fields:', error);
      toast.error(`${ERROR_MESSAGES.FIELDS_FAILED}: ${error.message}`);
    },
  });
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

  return useMutation({
    mutationFn: async ({ envelopeId, request }: { envelopeId: string; request: SendInvitesRequest }) => {
      console.log('📧 [E-Sign Mutation] Sending invitations for envelope:', envelopeId);
      return esignApi.sendInvites(envelopeId, request);
    },
    onSuccess: (data, variables) => {
      console.log('✅ [E-Sign Mutation] Invitations sent successfully');
      
      // Invalidate envelope lists and specific envelope
      queryClient.invalidateQueries({ queryKey: esignKeys.envelopes() });
      queryClient.invalidateQueries({ 
        queryKey: esignKeys.envelope(variables.envelopeId) 
      });
      
      toast.success(SUCCESS_MESSAGES.ENVELOPE_SENT);
    },
    onError: (error: Error) => {
      console.error('❌ [E-Sign Mutation] Failed to send invitations:', error);
      toast.error(`${ERROR_MESSAGES.SEND_FAILED}: ${error.message}`);
    },
  });
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

  return useMutation({
    mutationFn: async (envelopeId: string) => {
      console.log('🚫 [E-Sign Mutation] Voiding envelope:', envelopeId);
      return esignApi.voidEnvelope(envelopeId);
    },
    onSuccess: (data, envelopeId) => {
      console.log('✅ [E-Sign Mutation] Envelope voided successfully');
      
      // Invalidate envelope lists and specific envelope
      queryClient.invalidateQueries({ queryKey: esignKeys.envelopes() });
      queryClient.invalidateQueries({ queryKey: esignKeys.envelope(envelopeId) });
      
      toast.success(SUCCESS_MESSAGES.ENVELOPE_VOIDED);
    },
    onError: (error: Error) => {
      console.error('❌ [E-Sign Mutation] Failed to void envelope:', error);
      toast.error(`${ERROR_MESSAGES.VOID_FAILED}: ${error.message}`);
    },
  });
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ envelopeId, request }: { envelopeId: string; request: SaveTemplateRequest }) => {
      console.log('💾 [E-Sign Mutation] Saving envelope as template:', envelopeId);
      return esignApi.saveAsTemplate(envelopeId, request);
    },
    onSuccess: () => {
      console.log('✅ [E-Sign Mutation] Template saved successfully');
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
      console.log('📱 [E-Sign Mutation] Sending OTP to signer:', signerId);
      return esignApi.sendOTP(envelopeId, signerId);
    },
    onSuccess: () => {
      console.log('✅ [E-Sign Mutation] OTP sent successfully');
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
    mutationFn: async ({ envelopeId, request }: { envelopeId: string; request: SubmitSignatureRequest }) => {
      console.log('✍️ [E-Sign Mutation] Submitting signature for envelope:', envelopeId);
      return esignApi.submitSignature(envelopeId, request);
    },
    onSuccess: (data, variables) => {
      console.log('✅ [E-Sign Mutation] Signature submitted successfully');
      
      // Invalidate envelope lists and specific envelope
      queryClient.invalidateQueries({ queryKey: esignKeys.envelopes() });
      queryClient.invalidateQueries({ 
        queryKey: esignKeys.envelope(variables.envelopeId) 
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
    mutationFn: async ({ envelopeId, request }: { envelopeId: string; request: RejectSigningRequest }) => {
      console.log('❌ [E-Sign Mutation] Rejecting signing for envelope:', envelopeId);
      return esignApi.rejectSigning(envelopeId, request);
    },
    onSuccess: (data, variables) => {
      console.log('✅ [E-Sign Mutation] Signing rejected');
      
      // Invalidate envelope lists and specific envelope
      queryClient.invalidateQueries({ queryKey: esignKeys.envelopes() });
      queryClient.invalidateQueries({ 
        queryKey: esignKeys.envelope(variables.envelopeId) 
      });
      
      toast.info('Signing rejected');
    },
    onError: (error: Error) => {
      console.error('❌ [E-Sign Mutation] Failed to reject signing:', error);
      toast.error(`Failed to reject: ${error.message}`);
    },
  });
}