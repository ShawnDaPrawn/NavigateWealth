/**
 * useProductSchema — React Query hook for product schema management.
 *
 * The initial schema fetch uses React Query; local field edits remain
 * in useState (legitimate UI state per §11.1).
 *
 * Guidelines §6  — Server state via React Query.
 * Guidelines §11.1 — Local UI state for form editing.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner@2.0.3';
import { productManagementApi } from '../api';
import { ProductCategoryId, ProductField, SaveSchemaRequest } from '../types';
import { DEFAULT_SCHEMAS } from '../defaults';
import { productKeys } from './queryKeys';

export function useProductSchema(selectedCategory: ProductCategoryId | '') {
  const queryClient = useQueryClient();

  // Server state: the persisted schema
  const { data: serverSchema, isLoading } = useQuery({
    queryKey: productKeys.schema(selectedCategory),
    queryFn: async () => {
      if (!selectedCategory) return null;
      try {
        const schema = await productManagementApi.fetchSchema(selectedCategory);
        if (schema && schema.fields) return schema;
      } catch {
        // Fall through to default
      }
      // Fallback to default schema
      const defaultSchema = DEFAULT_SCHEMAS.find(s => s.categoryId === selectedCategory);
      return defaultSchema ? { fields: [...defaultSchema.fields] } : { fields: [] };
    },
    enabled: !!selectedCategory,
    staleTime: 5 * 60 * 1000,
  });

  // Local UI state: editable fields and dirty tracking
  const [currentFields, setCurrentFields] = useState<ProductField[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync server → local whenever the query data changes
  useEffect(() => {
    if (serverSchema?.fields) {
      setCurrentFields(serverSchema.fields);
      setHasUnsavedChanges(false);
    } else if (!selectedCategory) {
      setCurrentFields([]);
      setHasUnsavedChanges(false);
    }
  }, [serverSchema, selectedCategory]);

  const saveSchema = useCallback(async () => {
    if (!selectedCategory) return false;

    const toastId = toast.loading('Saving structure...');
    try {
      const payload: SaveSchemaRequest = {
        categoryId: selectedCategory,
        fields: currentFields,
      };
      await productManagementApi.saveSchema(payload);
      await queryClient.invalidateQueries({ queryKey: productKeys.schema(selectedCategory) });
      setHasUnsavedChanges(false);
      toast.success('Product structure saved', { id: toastId });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes';
      toast.error(msg, { id: toastId });
      return false;
    }
  }, [selectedCategory, currentFields, queryClient]);

  const updateFields = useCallback((newFields: ProductField[]) => {
    setCurrentFields(newFields);
    setHasUnsavedChanges(true);
  }, []);

  const reloadSchema = useCallback(async () => {
    if (selectedCategory) {
      await queryClient.invalidateQueries({ queryKey: productKeys.schema(selectedCategory) });
    }
  }, [selectedCategory, queryClient]);

  return {
    currentFields,
    isLoading,
    hasUnsavedChanges,
    saveSchema,
    updateFields,
    reloadSchema,
  };
}
