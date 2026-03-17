/**
 * Publications Feature - useArticleForm Hook
 * 
 * Hook for managing article form state with validation and auto-save.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { PublicationsAPI } from '../api';
import { generateSlug, calculateReadingTime, validateArticleForm } from '../utils';
import { DEFAULT_ARTICLE, EDITOR_CONFIG } from '../constants';
import type { Article, ArticleFormData, ArticleStatus } from '../types';

interface UseArticleFormOptions {
  article?: Article | null;
  onSuccess?: (article: Article) => void;
  onError?: (error: string) => void;
  autoSave?: boolean;
}

interface UseArticleFormReturn {
  formData: ArticleFormData;
  isDirty: boolean;
  isSaving: boolean;
  errors: string[];
  
  // Form field updates
  updateField: <K extends keyof ArticleFormData>(field: K, value: ArticleFormData[K]) => void;
  updateMultipleFields: (updates: Partial<ArticleFormData>) => void;
  
  // Utilities
  generateSlugFromTitle: () => void;
  calculateReadingTimeFromBody: () => void;
  
  // Actions
  save: () => Promise<Article | null>;
  validate: () => boolean;
  reset: () => void;
}

export function useArticleForm(options: UseArticleFormOptions = {}): UseArticleFormReturn {
  const { article, onSuccess, onError, autoSave = false } = options;
  
  // Initialize form data
  const [formData, setFormData] = useState<ArticleFormData>(() => {
    if (article) {
      return {
        title: article.title,
        subtitle: article.subtitle || '',
        slug: article.slug,
        excerpt: article.excerpt,
        body: article.body || article.content || '',
        category_id: article.category_id,
        type_id: article.type_id,
        feature_image_url: article.hero_image_url || article.featured_image || '',
        thumbnail_image_url: article.thumbnail_image_url || '',
        author_name: article.author_name || '',
        reading_time_minutes: article.reading_time_minutes || 5,
        tags: [],
        status: article.status,
        is_featured: article.is_featured,
        scheduled_publish_at: article.scheduled_for || '',
        meta_title: article.seo_title || '',
        meta_description: article.meta_description || article.seo_description || '',
        press_category: article.press_category || null,
      };
    }
    return DEFAULT_ARTICLE;
  });
  
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  
  // Auto-save timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialFormDataRef = useRef<string>(JSON.stringify(formData));

  // Track if form has changed
  useEffect(() => {
    const currentData = JSON.stringify(formData);
    setIsDirty(currentData !== initialFormDataRef.current);
  }, [formData]);

  // Update single field
  const updateField = useCallback(<K extends keyof ArticleFormData>(
    field: K, 
    value: ArticleFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Update multiple fields at once
  const updateMultipleFields = useCallback((updates: Partial<ArticleFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Generate slug from title
  const generateSlugFromTitle = useCallback(() => {
    if (formData.title) {
      const slug = generateSlug(formData.title);
      updateField('slug', slug);
    }
  }, [formData.title, updateField]);

  // Calculate reading time from body
  const calculateReadingTimeFromBody = useCallback(() => {
    if (formData.body) {
      const minutes = calculateReadingTime(formData.body);
      updateField('reading_time_minutes', minutes);
    }
  }, [formData.body, updateField]);

  // Validate form
  const validate = useCallback((): boolean => {
    const validationErrors = validateArticleForm(formData);
    setErrors(validationErrors);
    return validationErrors.length === 0;
  }, [formData]);

  // Save article
  const save = useCallback(async (): Promise<Article | null> => {
    // Validate first
    if (!validate()) {
      if (onError) {
        onError('Please fix validation errors before saving');
      }
      return null;
    }

    setIsSaving(true);
    setErrors([]);

    try {
      let savedArticle: Article;

      // Prepare API input (mapping formData to what server expects)
      // Server stores body as 'body', image as 'hero_image_url', schedule as 'scheduled_for'
      const apiInput: Record<string, string | number | boolean | null | undefined> = {
        title: formData.title,
        subtitle: formData.subtitle,
        slug: formData.slug,
        excerpt: formData.excerpt,
        body: formData.body,
        category_id: formData.category_id,
        type_id: formData.type_id,
        hero_image_url: formData.feature_image_url,
        thumbnail_image_url: formData.thumbnail_image_url,
        author_name: formData.author_name,
        reading_time_minutes: formData.reading_time_minutes,
        status: formData.status,
        is_featured: formData.is_featured,
        scheduled_for: formData.scheduled_publish_at,
        seo_title: formData.meta_title,
        seo_description: formData.meta_description,
        seo_canonical_url: formData.canonical_url,
        press_category: formData.press_category || null,
      };

      if (article?.id) {
        // Update existing article
        savedArticle = await PublicationsAPI.Articles.updateArticle({
          id: article.id,
          ...apiInput
        });
      } else {
        // Create new article
        savedArticle = await PublicationsAPI.Articles.createArticle(apiInput);
      }

      // Update initial form data to current state
      initialFormDataRef.current = JSON.stringify(formData);
      setIsDirty(false);

      if (onSuccess) {
        onSuccess(savedArticle);
      }

      return savedArticle;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save article';
      setErrors([errorMessage]);
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [article, formData, validate, onSuccess, onError]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave || !isDirty || !article) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      save();
    }, EDITOR_CONFIG.autoSaveInterval);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, isDirty, autoSave, article, save]);

  // Reset form
  const reset = useCallback(() => {
    if (article) {
      setFormData({
        title: article.title,
        subtitle: article.subtitle || '',
        slug: article.slug,
        excerpt: article.excerpt,
        body: article.body || article.content || '',
        category_id: article.category_id,
        type_id: article.type_id,
        feature_image_url: article.hero_image_url || article.featured_image || '',
        thumbnail_image_url: article.thumbnail_image_url || '',
        author_name: article.author_name || '',
        reading_time_minutes: article.reading_time_minutes || 5,
        tags: [],
        status: article.status,
        is_featured: article.is_featured,
        scheduled_publish_at: article.scheduled_for || '',
        meta_title: article.seo_title || '',
        meta_description: article.meta_description || article.seo_description || '',
        press_category: article.press_category || null,
      });
    } else {
      setFormData(DEFAULT_ARTICLE);
    }
    
    initialFormDataRef.current = JSON.stringify(formData);
    setIsDirty(false);
    setErrors([]);
  }, [article]);

  return {
    formData,
    isDirty,
    isSaving,
    errors,
    updateField,
    updateMultipleFields,
    generateSlugFromTitle,
    calculateReadingTimeFromBody,
    save,
    validate,
    reset
  };
}