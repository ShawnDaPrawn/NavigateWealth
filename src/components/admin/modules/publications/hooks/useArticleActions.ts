/**
 * Publications Feature - useArticleActions Hook
 * 
 * Hook for performing actions on articles (publish, unpublish, delete, etc.).
 */

import { useState, useCallback } from 'react';
import { PublicationsAPI } from '../api';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../constants';
import type { Article, CreateArticleInput, UpdateArticleInput } from '../types';

interface UseArticleActionsOptions {
  onSuccess?: (message: string, article?: Article) => void;
  onError?: (error: string) => void;
  onDelete?: () => void;
}

interface UseArticleActionsReturn {
  isProcessing: boolean;
  
  // Actions
  handleCreate: (data: CreateArticleInput) => Promise<Article | null>;
  handleUpdate: (id: string, data: UpdateArticleInput) => Promise<Article | null>;
  handlePublish: (id: string, notifySubscribers?: boolean) => Promise<Article | null>;
  handleUnpublish: (id: string) => Promise<Article | null>;
  handleSchedule: (id: string, publishAt: string, notifyOnPublish?: boolean) => Promise<Article | null>;
  handleDelete: (id: string) => Promise<boolean>;
  handleArchive: (id: string) => Promise<Article | null>;
  handleDuplicate: (id: string) => Promise<Article | null>; // Note: duplicate not explicitly in API, check later
}

export function useArticleActions(options?: UseArticleActionsOptions): UseArticleActionsReturn {
  const { onSuccess, onError, onDelete } = options || {};
  
  const [isProcessing, setIsProcessing] = useState(false);

  // Create article
  const handleCreate = useCallback(async (data: CreateArticleInput): Promise<Article | null> => {
    setIsProcessing(true);
    
    try {
      const article = await PublicationsAPI.Articles.createArticle(data);
      
      if (onSuccess) {
        onSuccess(SUCCESS_MESSAGES.articleCreated, article);
      }
      
      return article;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.articleCreateFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  // Update article
  const handleUpdate = useCallback(async (id: string, data: UpdateArticleInput): Promise<Article | null> => {
    setIsProcessing(true);
    
    try {
      const article = await PublicationsAPI.Articles.updateArticle({ id, ...data });
      
      if (onSuccess) {
        onSuccess(SUCCESS_MESSAGES.articleUpdated, article);
      }
      
      return article;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.articleUpdateFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  // Publish article
  const handlePublish = useCallback(async (id: string, notifySubscribers?: boolean): Promise<Article | null> => {
    setIsProcessing(true);
    
    try {
      const article = await PublicationsAPI.Articles.publishArticle(id, {
        notify_subscribers: notifySubscribers ?? true,
      });
      
      if (onSuccess) {
        onSuccess(SUCCESS_MESSAGES.articlePublished, article);
      }
      
      return article;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.articlePublishFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  // Unpublish article
  const handleUnpublish = useCallback(async (id: string): Promise<Article | null> => {
    setIsProcessing(true);
    
    try {
      const article = await PublicationsAPI.Articles.unpublishArticle(id);
      
      if (onSuccess) {
        onSuccess(SUCCESS_MESSAGES.articleUnpublished, article);
      }
      
      return article;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.articleUnpublishFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  // Archive article
  const handleArchive = useCallback(async (id: string): Promise<Article | null> => {
    setIsProcessing(true);
    
    try {
      const article = await PublicationsAPI.Articles.archiveArticle(id);
      
      if (onSuccess) {
        // Add message if missing in constants
        onSuccess('Article archived successfully', article);
      }
      
      return article;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to archive article';
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  // Schedule article - Note: API.ts doesn't seem to have scheduleArticle?
  const handleSchedule = useCallback(async (
    id: string, 
    publishAt: string,
    notifyOnPublish?: boolean
  ): Promise<Article | null> => {
    setIsProcessing(true);
    
    try {
       // Assuming updateArticle handles scheduling or we need to add scheduleArticle to API
       // Check API.ts content again. It does NOT have scheduleArticle.
       // It has updateArticle. Maybe we just update scheduled_for field?
      const article = await PublicationsAPI.Articles.updateArticle({
        id,
        scheduled_for: publishAt,
        status: 'scheduled',
        notify_on_publish: notifyOnPublish ?? true,
      });
      
      if (onSuccess) {
        onSuccess(SUCCESS_MESSAGES.articleScheduled, article);
      }
      
      return article;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.articleScheduleFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  // Delete article
  const handleDelete = useCallback(async (id: string): Promise<boolean> => {
    setIsProcessing(true);
    
    try {
      await PublicationsAPI.Articles.deleteArticle(id);
      
      if (onSuccess) {
        onSuccess(SUCCESS_MESSAGES.articleDeleted);
      }
      
      if (onDelete) {
        onDelete();
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.articleDeleteFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError, onDelete]);

  // Duplicate article - Note: API.ts doesn't have duplicateArticle.
  // We might need to implement it as create(get(id)) or add it to API.
  const handleDuplicate = useCallback(async (id: string): Promise<Article | null> => {
    setIsProcessing(true);
    
    try {
      // Fetch original
      const original = await PublicationsAPI.Articles.getArticle(id);
      
      // Create copy
      const { id: _, created_at, updated_at, published_at, ...data } = original;
      const copyData = {
        ...data,
        title: `${data.title} (Copy)`,
        slug: `${data.slug}-copy-${Date.now()}`,
        status: 'draft' as const,
        is_featured: false
      };
      
      const article = await PublicationsAPI.Articles.createArticle(copyData);
      
      if (onSuccess) {
        onSuccess(SUCCESS_MESSAGES.articleDuplicated, article);
      }
      
      return article;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.articleDuplicateFailed;
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [onSuccess, onError]);

  return {
    isProcessing,
    handleCreate,
    handleUpdate,
    handlePublish,
    handleUnpublish,
    handleSchedule,
    handleDelete,
    handleDuplicate,
    handleArchive
  };
}