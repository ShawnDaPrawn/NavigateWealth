/**
 * useRoADraft Hook
 * 
 * Hook for Record of Advice (RoA) draft management.
 * Handles CRUD operations, auto-save, and module management.
 * 
 * @module advice-engine/hooks/useRoADraft
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roaApi } from '../api';
import { adviceEngineKeys } from './queryKeys';
import { getFallbackRuntimeModules, moduleContractToRuntimeModule } from '../roaModuleRuntime';
import type {
  RoADraft,
  RoAModule,
  UseRoADraftOptions,
  UseRoADraftReturn,
} from '../types';

/**
 * Default auto-save delay (ms)
 */
const DEFAULT_AUTO_SAVE_DELAY = 2000;

/**
 * Hook for RoA draft management
 * 
 * @param options - Configuration options
 * @returns Draft state and actions
 * 
 * @example
 * const {
 *   draft,
 *   isLoading,
 *   isSaving,
 *   saveDraft,
 *   submitDraft,
 *   updateDraft,
 *   modules
 * } = useRoADraft({
 *   draftId: 'draft-123',
 *   autoSave: true,
 *   autoSaveDelay: 2000
 * });
 * 
 * // Update draft
 * updateDraft({ selectedModules: ['life-insurance'] });
 * 
 * // Manual save
 * await saveDraft({ moduleData: {...} });
 * 
 * // Submit
 * await submitDraft();
 */
export function useRoADraft(options: UseRoADraftOptions = {}): UseRoADraftReturn {
  const {
    draftId,
    autoSave = true,
    autoSaveDelay = DEFAULT_AUTO_SAVE_DELAY,
  } = options;

  // State
  const [localDraft, setLocalDraft] = useState<RoADraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalDraft(null);
    setError(null);
  }, [draftId]);

  // Refs
  const autoSaveTimerRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  // ============================================================================
  // Fetch Draft
  // ============================================================================

  const {
    data: fetchedDraft,
    isLoading: isLoadingDraft,
    error: fetchError,
  } = useQuery({
    queryKey: adviceEngineKeys.roa.draft(draftId || ''),
    queryFn: async () => {
      if (!draftId) return null;
      return await roaApi.getDraft(draftId);
    },
    enabled: !!draftId,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Sync fetched draft with local state
  useEffect(() => {
    if (fetchedDraft && !localDraft) {
      setLocalDraft(fetchedDraft);
    }
  }, [fetchedDraft, localDraft]);

  // ============================================================================
  // Fetch Modules
  // ============================================================================

  const { data: modules = [] } = useQuery({
    queryKey: adviceEngineKeys.roa.moduleContracts({ status: 'active' }),
    queryFn: async () => {
      const contracts = await roaApi.getModuleContracts({ status: 'active' });
      const runtimeModules = contracts.map(moduleContractToRuntimeModule);
      return runtimeModules.length > 0 ? runtimeModules : getFallbackRuntimeModules();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (modules rarely change)
    refetchOnMount: false, // RoA module definitions are stable reference data
  });

  // ============================================================================
  // Save Draft Mutation
  // ============================================================================

  const saveDraftMutation = useMutation({
    mutationFn: async (data: Partial<RoADraft>) => {
      return await roaApi.saveDraft(localDraft?.id || null, data);
    },
    onSuccess: (savedDraft) => {
      setLocalDraft(savedDraft);
      setError(null);
      
      // Update cache
      queryClient.setQueryData(adviceEngineKeys.roa.draft(savedDraft.id), savedDraft);
    },
    onError: (error: Error) => {
      console.error('Failed to save draft:', error);
      setError(error.message);
    },
  });

  // ============================================================================
  // Submit Draft Mutation
  // ============================================================================

  const submitDraftMutation = useMutation({
    mutationFn: async () => {
      if (!localDraft?.id) {
        throw new Error('No draft to submit');
      }
      return await roaApi.submitDraft(localDraft.id);
    },
    onSuccess: (submittedDraft) => {
      setLocalDraft(submittedDraft);
      setError(null);
      
      // Update cache
      queryClient.setQueryData(adviceEngineKeys.roa.draft(submittedDraft.id), submittedDraft);
      
      // Invalidate drafts list
      queryClient.invalidateQueries({ queryKey: adviceEngineKeys.roa.drafts() });
    },
    onError: (error: Error) => {
      console.error('Failed to submit draft:', error);
      setError(error.message);
    },
  });

  // ============================================================================
  // Auto-Save Logic
  // ============================================================================

  useEffect(() => {
    if (autoSave && localDraft && localDraft.id) {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set new auto-save timer
      autoSaveTimerRef.current = window.setTimeout(() => {
        saveDraftMutation.mutate({
          selectedModules: localDraft.selectedModules,
          moduleData: localDraft.moduleData,
          moduleOutputs: localDraft.moduleOutputs,
          moduleEvidence: localDraft.moduleEvidence,
          clientId: localDraft.clientId,
          clientData: localDraft.clientData,
        });
      }, autoSaveDelay);
    }

    // Cleanup
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [localDraft, autoSave, autoSaveDelay]);

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Update draft locally (triggers auto-save)
   */
  const updateDraft = useCallback((updates: Partial<RoADraft>) => {
    setLocalDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...updates,
        updatedAt: new Date(),
      };
    });
  }, []);

  /**
   * Save draft manually
   */
  const saveDraft = useCallback(
    async (data: Partial<RoADraft>): Promise<void> => {
      await saveDraftMutation.mutateAsync(data);
    },
    [saveDraftMutation]
  );

  /**
   * Submit draft (finalize)
   */
  const submitDraft = useCallback(async (): Promise<void> => {
    await submitDraftMutation.mutateAsync();
  }, [submitDraftMutation]);

  /**
   * Create new draft
   */
  const createNewDraft = useCallback(() => {
    const newDraft: RoADraft = {
      id: `draft-${Date.now()}`,
      selectedModules: [],
      moduleData: {},
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    setLocalDraft(newDraft);
  }, []);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    draft: localDraft,
    isLoading: isLoadingDraft,
    isSaving: saveDraftMutation.isPending,
    error: error || (fetchError ? String(fetchError) : null),
    saveDraft,
    submitDraft,
    modules,
    updateDraft,
    createNewDraft,
  };
}
