/**
 * CommunicationTab - Admin Portal
 * Publish communications to clients from the admin/adviser dashboard
 * Located in: Manage Client Drawer → Communication Tab
 *
 * Decomposed into focused sub-components per §7 / §4.1:
 *   - ComposeForm — Rich text compose UI with attachments
 *   - HistoryDialog — Filterable, virtualized communication history
 *   - CommunicationDetailDialog — Full communication view
 *   - DeleteConfirmDialog — Destructive action confirmation
 */

import React, { useState, useCallback } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Client } from '../types';
// Cross-module dependency: client-management → communication (public API surface)
// Justified: CommunicationTab displays per-client communication history and compose UI.
// Types and API are the communication module's public contract per §4.1.
import { communicationApi } from '../../communication/api';
import { CommunicationLog, SendMessageResponse, AttachmentFile } from '../../communication/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { clientKeys } from '../hooks/queryKeys';

// Sub-components
import { ComposeForm, type ComposePayload } from './communication/ComposeForm';
import { HistoryDialog } from './communication/HistoryDialog';
import { CommunicationDetailDialog } from './communication/CommunicationDetailDialog';
import { DeleteConfirmDialog } from './communication/DeleteConfirmDialog';

interface CommunicationTabProps {
  client: Client;
}

export function CommunicationTab({ client }: CommunicationTabProps) {
  const queryClient = useQueryClient();

  // Dialog state
  const [viewingCommunication, setViewingCommunication] = useState<CommunicationLog | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null,
  });
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // Feedback state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Key for remounting ComposeForm after successful send
  const [composeKey, setComposeKey] = useState(0);

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const { data: communications = [], isLoading, refetch } = useQuery({
    queryKey: clientKeys.communicationLogs(client.id),
    queryFn: () => communicationApi.getClientLogs(client.id),
    enabled: !!client.id,
  });

  // ── File Upload Helper ────────────────────────────────────────────────────

  const uploadToDocuments = async (file: File, index: number, subject: string, totalFiles: number): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    let titleToUse = file.name.replace(/\.[^/.]+$/, '');
    if (totalFiles > 1) {
      titleToUse = `${subject || 'Communication Attachment'} (${index + 1})`;
    } else if (subject) {
      titleToUse = `${subject} - ${file.name}`;
    }

    formData.append('title', titleToUse);
    formData.append('productCategory', 'General');
    formData.append('uploadedBy', 'admin');
    formData.append('isHidden', 'true');

    if (totalFiles > 1) {
      formData.append('packId', `comm_${Date.now()}`);
      formData.append('packTitle', subject || 'Communication Attachments');
    }

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${client.id}/upload`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to upload ${file.name}`);
    }

    const data = await response.json();
    return data.document.id;
  };

  const convertFileToAttachment = (file: File): Promise<AttachmentFile> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          content: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    });
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  const sendMutation = useMutation({
    mutationFn: async (payload: ComposePayload) => {
      setError(null);
      setSuccess(null);

      const ccList: string[] = [];
      if (payload.ccAdmin) ccList.push('info@navigatewealth.co');
      if (payload.additionalCc) {
        const extras = payload.additionalCc.split(',').map(e => e.trim()).filter(Boolean);
        ccList.push(...extras);
      }

      // Path 1: Encrypted Attachments (via Documents Module)
      if (payload.encryptAttachments && payload.attachments.length > 0) {
        const clientIdNumber =
          client.idNumber ||
          client.profile?.personalInformation?.idNumber ||
          client.personalInformation?.idNumber;

        if (!clientIdNumber) {
          throw new Error('Client ID number is required for encryption. Please update client profile.');
        }

        const docIds = await Promise.all(
          payload.attachments.map((file, i) =>
            uploadToDocuments(file, i, payload.subject, payload.attachments.length)
          )
        );

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${client.id}/email`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              documentIds: docIds,
              email: client.email,
              idNumber: clientIdNumber,
              customMessage: payload.message,
              subject: payload.subject,
              isHtml: true,
              ccAdmin: payload.ccAdmin,
              cc: ccList,
              source: 'communication_tab',
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send encrypted communication');
        }

        return { success: true, messageId: 'encrypted-doc-send' } as SendMessageResponse;
      }

      // Path 2: Standard Communication (Direct Message)
      const base64Attachments = await Promise.all(payload.attachments.map(convertFileToAttachment));

      return communicationApi.sendDirectMessage({
        clientId: client.id,
        subject: payload.subject,
        message: payload.message,
        category: payload.category,
        priority: payload.priority,
        sendEmail: payload.sendEmail,
        clientEmail: client.email,
        attachments: base64Attachments,
        cc: ccList,
      });
    },
    onSuccess: () => {
      setSuccess('Communication sent successfully');
      toast.success('Communication sent successfully');

      queryClient.invalidateQueries({ queryKey: clientKeys.communicationLogs(client.id) });
      refetch();

      // Remount ComposeForm to reset its internal state
      setComposeKey(prev => prev + 1);

      setTimeout(() => setSuccess(null), 5000);
    },
    onError: (err: Error) => {
      const msg = `Failed to send: ${err.message}`;
      setError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await communicationApi.deleteLog(id);
    },
    onSuccess: () => {
      toast.success('Communication deleted');
      queryClient.invalidateQueries({ queryKey: clientKeys.communicationLogs(client.id) });
      refetch();
      if (viewingCommunication) setViewingCommunication(null);
    },
    onError: (err: unknown) => {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleSend = useCallback(
    (payload: ComposePayload) => {
      if (!payload.subject.trim()) {
        const msg = 'Please enter a subject';
        setError(msg);
        toast.error(msg);
        return;
      }
      const text = payload.message.replace(/<[^>]*>/g, '').trim();
      if (!text) {
        const msg = 'Please enter a message';
        setError(msg);
        toast.error(msg);
        return;
      }
      sendMutation.mutate(payload);
    },
    [sendMutation]
  );

  const handleDeleteRequest = useCallback((id: string) => {
    setDeleteConfirmation({ isOpen: true, id });
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirmation.id) {
      deleteMutation.mutate(deleteConfirmation.id);
    }
    setDeleteConfirmation({ isOpen: false, id: null });
  }, [deleteConfirmation.id, deleteMutation]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <style>{`
        .ql-container {
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
          font-size: 14px;
          font-family: inherit;
        }
        .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          background-color: #f9fafb;
        }
        .ql-editor {
          min-h: 150px;
        }
      `}</style>

      {/* Feedback */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 bg-green-50 text-green-900 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {/* Compose */}
      <ComposeForm
        key={composeKey}
        clientFirstName={client.firstName}
        clientLastName={client.lastName}
        clientId={client.id}
        clientEmail={client.email}
        clientIdNumber={
          client.idNumber ||
          client.profile?.personalInformation?.idNumber ||
          client.personalInformation?.idNumber
        }
        onSend={handleSend}
        isSending={sendMutation.isPending}
        onViewHistory={() => setHistoryDialogOpen(true)}
      />

      {/* History */}
      <HistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        communications={communications}
        isLoading={isLoading}
        onViewDetail={setViewingCommunication}
        onDelete={handleDeleteRequest}
      />

      {/* Detail */}
      <CommunicationDetailDialog
        communication={viewingCommunication}
        onClose={() => setViewingCommunication(null)}
        onDelete={handleDeleteRequest}
      />

      {/* Delete Confirm */}
      <DeleteConfirmDialog
        open={deleteConfirmation.isOpen}
        onOpenChange={(open) => !open && setDeleteConfirmation({ isOpen: false, id: null })}
        onConfirm={handleConfirmDelete}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}