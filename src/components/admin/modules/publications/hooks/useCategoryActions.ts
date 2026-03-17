/**
 * Publications Feature - useCategoryActions Hook
 * 
 * Hook for performing CRUD actions on categories.
 */

import { useState, useCallback } from 'react';
import { PublicationsAPI } from '../api';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../constants';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '../types';

interface UseCategoryActionsOptions {
  onSuccess?: (message: string, category?: Category) => void;
  onError?: (error: string) => void;
  onDelete?: () => void;
}

interface UseCategoryActionsReturn {
  isProcessing: boolean;
  
  // Actions
  handleCreate: (data: CreateCategoryInput) => Promise<Category | null>;
  handleUpdate: (id: string, data: Partial<CreateCategoryInput>) => Promise<Category | null>;
  handleDelete: (id: string) => Promise<boolean>;
  handleToggleActive: (category: Category) => Promise<Category | null>;
  handleReorder: (categories: Category[]) => Promise<boolean>;
}

export function useCategoryActions(options?: UseCategoryActionsOptions): UseCategoryActionsReturn {
  const { onSuccess, onError, onDelete } = options || {};
  
  const [isProcessing, setIsProcessing] = useState(false);

  // Create category
  const handleCreate = useCallback(async (data: CreateCategoryInput): Promise<Category | null> => {
    setIsProcessing(true);
    
    try {
      const category = await PublicationsAPI.Categories.createCategory(data);
      
      if (onSuccess) {
        onSuccess(SUCCESS_MESSAGES.categoryCreated, category);
      }
      
      return category;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.categoryCreateFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  // Update category
  const handleUpdate = useCallback(async (
    id: string, 
    data: Partial<CreateCategoryInput>
  ): Promise<Category | null> => {
    setIsProcessing(true);
    
    try {
      const category = await PublicationsAPI.Categories.updateCategory({ id, ...data });
      
      if (onSuccess) {
        onSuccess(SUCCESS_MESSAGES.categoryUpdated, category);
      }
      
      return category;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.categoryUpdateFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  // Delete category
  const handleDelete = useCallback(async (id: string): Promise<boolean> => {
    setIsProcessing(true);
    
    try {
      await PublicationsAPI.Categories.deleteCategory(id);
      
      if (onSuccess) {
        onSuccess(SUCCESS_MESSAGES.categoryDeleted);
      }
      
      if (onDelete) {
        onDelete();
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.categoryDeleteFailed;
      
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
    category: Category
  ): Promise<Category | null> => {
    setIsProcessing(true);
    
    try {
      const updated = await PublicationsAPI.Categories.updateCategory({
        id: category.id,
        is_active: !category.is_active
      });
      
      if (onSuccess) {
        const message = updated.is_active 
          ? 'Category activated' 
          : 'Category deactivated';
        onSuccess(message, updated);
      }
      
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.categoryUpdateFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  // Reorder categories
  const handleReorder = useCallback(async (categories: Category[]): Promise<boolean> => {
    setIsProcessing(true);
    
    try {
      const updates = categories.map((cat, index) => ({
        id: cat.id,
        sort_order: index
      }));
      
      await PublicationsAPI.Categories.reorderCategories(updates);
      
      if (onSuccess) {
        onSuccess('Categories reordered successfully');
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.categoryUpdateFailed;
      
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