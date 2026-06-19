/**
 * useRoAModuleChat Hook
 *
 * Drives the AI conversation for a single RoA module. Modelled on useAIChat:
 *   - loads the existing conversation on mount (React Query)
 *   - optimistically appends the user message
 *   - appends the assistant reply and updates status/completion on success
 *   - supports file uploads (base64) and manual completion
 *
 * @module advice-engine/hooks/useRoAModuleChat
 */

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { roaApi } from '../api';
import { adviceEngineKeys } from './queryKeys';
import type {
  RoAConvMessage,
  RoAModuleConversationRecord,
  RoAModuleConversationStatus,
} from '../types';

export interface UseRoAModuleChatParams {
  draftId: string;
  moduleId: string;
}

export interface UseRoAModuleChatReturn {
  messages: RoAConvMessage[];
  status: RoAModuleConversationStatus;
  isComplete: boolean;
  isLoading: boolean;
  conversation: RoAModuleConversationRecord | null;
  sendMessage: (text: string) => Promise<void>;
  uploadFile: (uploadId: string, file: File) => Promise<void>;
  completeModule: () => Promise<void>;
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Read a file as a base64 data URL (mirrors RoAStepModuleDetails).
 */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

function makeTempId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build the React Query key for a single module conversation.
 */
function conversationKey(draftId: string, moduleId: string) {
  return [...adviceEngineKeys.roa.draft(draftId), 'conversation', moduleId] as const;
}

export function useRoAModuleChat({
  draftId,
  moduleId,
}: UseRoAModuleChatParams): UseRoAModuleChatReturn {
  const queryClient = useQueryClient();

  // Local transcript state (seeded from the loaded conversation).
  const [messages, setMessages] = useState<RoAConvMessage[]>([]);
  const [status, setStatus] = useState<RoAModuleConversationStatus>('pending');

  const { data: conversation = null, isLoading } = useQuery({
    queryKey: conversationKey(draftId, moduleId),
    queryFn: async () => {
      const response = await roaApi.getModuleConversation(draftId, moduleId);
      return response.conversation;
    },
    enabled: Boolean(draftId && moduleId),
    staleTime: 30 * 1000,
  });

  // Seed local state when the loaded conversation changes (mount / module switch).
  useEffect(() => {
    if (conversation) {
      setMessages(conversation.messages || []);
      setStatus(conversation.status || 'pending');
    } else {
      setMessages([]);
      setStatus('pending');
    }
  }, [conversation, moduleId, draftId]);

  const applyConversation = useCallback(
    (next: RoAModuleConversationRecord) => {
      setMessages(next.messages || []);
      setStatus(next.status || 'pending');
      queryClient.setQueryData(conversationKey(draftId, moduleId), next);
      // The draft carries moduleConversationStatus/narratives — keep it fresh.
      queryClient.invalidateQueries({ queryKey: adviceEngineKeys.roa.draft(draftId) });
    },
    [draftId, moduleId, queryClient],
  );

  // ==========================================================================
  // Send Message
  // ==========================================================================

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      return roaApi.sendModuleMessage(draftId, moduleId, text);
    },
    onMutate: async (text: string) => {
      const userMessage: RoAConvMessage = {
        id: makeTempId('local-user'),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      if (status === 'pending') setStatus('in_progress');
      return { userMessage };
    },
    onSuccess: (data) => {
      applyConversation(data.conversation);
    },
    onError: (error: Error, _text, context) => {
      // Roll back the optimistic user message.
      if (context?.userMessage) {
        setMessages((prev) => prev.filter((message) => message.id !== context.userMessage.id));
      }
      toast.error(error.message || 'Failed to send message');
    },
  });

  // ==========================================================================
  // Upload File
  // ==========================================================================

  const uploadFileMutation = useMutation({
    mutationFn: async ({ uploadId, file }: { uploadId: string; file: File }) => {
      if (file.size === 0) throw new Error('File is empty.');
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error('Files must be 15 MB or smaller.');
      }
      const bytesBase64 = await readFileAsBase64(file);
      return roaApi.uploadModuleFile(draftId, moduleId, {
        uploadId,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        bytesBase64,
      });
    },
    onSuccess: (data) => {
      applyConversation(data.conversation);
      toast.success(`${data.upload.fileName} attached`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload file');
    },
  });

  // ==========================================================================
  // Complete Module
  // ==========================================================================

  const completeModuleMutation = useMutation({
    mutationFn: async () => {
      return roaApi.completeModule(draftId, moduleId);
    },
    onSuccess: (data) => {
      applyConversation(data.conversation);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to complete module');
    },
  });

  // ==========================================================================
  // Public API
  // ==========================================================================

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed) return;
      await sendMessageMutation.mutateAsync(trimmed);
    },
    [sendMessageMutation],
  );

  const uploadFile = useCallback(
    async (uploadId: string, file: File): Promise<void> => {
      await uploadFileMutation.mutateAsync({ uploadId, file });
    },
    [uploadFileMutation],
  );

  const completeModule = useCallback(async (): Promise<void> => {
    await completeModuleMutation.mutateAsync();
  }, [completeModuleMutation]);

  return {
    messages,
    status,
    isComplete: status === 'complete',
    isLoading:
      isLoading ||
      sendMessageMutation.isPending ||
      uploadFileMutation.isPending ||
      completeModuleMutation.isPending,
    conversation,
    sendMessage,
    uploadFile,
    completeModule,
  };
}
