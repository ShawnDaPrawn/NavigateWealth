/**
 * Publications Feature - useTypeActions Hook
 * 
 * Hook for performing CRUD actions on article types.
 */

import { useState, useCallback } from 'react';
import { PublicationsAPI } from '../api';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../constants';
import type { ContentType, CreateContentTypeInput, UpdateContentTypeInput } from '../types';

interface UseTypeActionsOptions {
  onSuccess?: (message: string, type?: ContentType) => void;
  onError?: (error: string) => void;
  onDelete?: () => void;
}

interface UseTypeActionsReturn {
  isProcessing: boolean;
  
  // Actions
  handleCreate: (data: CreateContentTypeInput) => Promise<ContentType | null>;
  handleUpdate: (id: string, data: Partial<CreateContentTypeInput>) => Promise<ContentType | null>;
  handleDelete: (id: string) => Promise<boolean>;
  handleToggleActive: (type: ContentType) => Promise<ContentType | null>;
  handleReorder: (types: ContentType[]) => Promise<boolean>;
}

export function useTypeActions(options?: UseTypeActionsOptions): UseTypeActionsReturn {
  const { onSuccess, onError, onDelete } = options || {};
  
  const [isProcessing, setIsProcessing] = useState(false);

  // Create type
  const handleCreate = useCallback(async (data: CreateContentTypeInput): Promise<ContentType | null> => {
    setIsProcessing(true);
    
    try {
      const type = await PublicationsAPI.Types.createType(data);
      
      if (onSuccess) {
        onSuccess(SUCCESS_MESSAGES.typeCreated, type);
      }
      
      return type;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.typeCreateFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  // Update type
  const handleUpdate = useCallback(async (
    id: string, 
    data: Partial<CreateContentTypeInput>
  ): Promise<ContentType | null> => {
    setIsProcessing(true);
    
    try {
      const type = await PublicationsAPI.Types.updateType({ id, ...data });
      
      if (onSuccess) {
        onSuccess(SUCCESS_MESSAGES.typeUpdated, type);
      }
      
      return type;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.typeUpdateFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  // Delete type
  const handleDelete = useCallback(async (id: string): Promise<boolean> => {
    setIsProcessing(true);
    
    try {
      await PublicationsAPI.Types.deleteType(id);
      
      if (onSuccess) {
        onSuccess(SUCCESS_MESSAGES.typeDeleted);
      }
      
      if (onDelete) {
        onDelete();
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.typeDeleteFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError, onDelete]);

  // Toggle active status
  const handleToggleActive = useCallback(async (
    type: ContentType
  ): Promise<ContentType | null> => {
    setIsProcessing(true);
    
    try {
      const updated = await PublicationsAPI.Types.updateType({
        id: type.id,
        is_active: !type.is_active
      });
      
      if (onSuccess) {
        const message = updated.is_active 
          ? 'Type activated' 
          : 'Type deactivated';
        onSuccess(message, updated);
      }
      
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.typeUpdateFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  // Reorder types
  const handleReorder = useCallback(async (types: ContentType[]): Promise<boolean> => {
    setIsProcessing(true);
    
    try {
      const updates = types.map((type, index) => ({
        id: type.id,
        sort_order: index
      }));
      
      await PublicationsAPI.Types.reorderTypes(updates);
      
      if (onSuccess) {
        onSuccess('Types reordered successfully');
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.typeUpdateFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  return {
    isProcessing,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleToggleActive,
    handleReorder
  };
}