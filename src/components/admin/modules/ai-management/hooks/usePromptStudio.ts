import { useMutation, useQuery } from '@tanstack/react-query';
import type { PromptContext, PromptVersion } from '../types';
import { promptApi } from '../api';

type PromptBundle = {
  active: string | null;
  draft: string | null;
  versions: PromptVersion[];
};

export function usePromptBundle(agentId: string, context: PromptContext) {
  return useQuery({
    queryKey: ['ai-management', 'prompt-bundle', agentId, context],
    queryFn: () => promptApi.getBundle(agentId, context) as Promise<PromptBundle>,
    enabled: Boolean(agentId && context),
  });
}

export function useSaveDraftPrompt() {
  return useMutation({
    mutationFn: async (input: { agentId: string; context: PromptContext; prompt: string }) => {
      await promptApi.saveDraft(input.agentId, input.context, input.prompt);
      return { success: true } as const;
    },
  });
}

export function usePublishPrompt() {
  return useMutation({
    mutationFn: async (input: { agentId: string; context: PromptContext }) => {
      const version = await promptApi.publish(input.agentId, input.context);
      return { version };
    },
  });
}

export function useRollbackPrompt() {
  return useMutation({
    mutationFn: async (input: { agentId: string; context: PromptContext; versionId: string }) => {
      const version = await promptApi.rollback(input.agentId, input.context, input.versionId);
      return { version };
    },
  });
}

export function useSeedPrompt() {
  return useMutation({
    mutationFn: async (input: { agentId: string; context: PromptContext; seedPrompt: string }) => {
      const bundle = await promptApi.seedIfMissing(input.agentId, input.context, input.seedPrompt);
      return bundle;
    },
  });
}

