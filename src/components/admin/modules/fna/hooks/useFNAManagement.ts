/**
 * useFNAManagement Hook
 * Reusable hook for managing FNA state and operations across all FNA types
 *
 * Moved from /hooks/useFNAManagement.ts during module restructure (Step 4).
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner@2.0.3';
import type { FNAConfig } from '../../../profile-sections/fna-config';

interface UseFNAManagementOptions {
  config: FNAConfig | null;
  clientId: string;
  enabled?: boolean; // Whether to auto-load on mount
}

export function useFNAManagement({ config, clientId, enabled = true }: UseFNAManagementOptions) {
  const [fna, setFna] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /**
   * Load latest published FNA
   */
  const loadFNA = useCallback(async () => {
    if (!enabled || !config) return;

    try {
      setLoading(true);
      const latestFNA = await config.getLatestPublished(clientId);
      setFna(latestFNA);
    } catch (error: unknown) {
      console.error(`Error loading latest ${config.name}:`, error);
      // Don't show error toast for "not found" - it's normal if no FNA exists yet
      setFna(null);
    } finally {
      setLoading(false);
    }
  }, [config, clientId, enabled]);

  /**
   * Auto-load on mount
   */
  useEffect(() => {
    loadFNA();
  }, [loadFNA]);

  /**
   * Handle opening wizard to create/edit FNA
   */
  const handleRunFNA = useCallback(() => {
    setWizardOpen(true);
  }, []);

  /**
   * Handle FNA completion from wizard
   */
  const handleFNAComplete = useCallback(
    (fnaId: string) => {
      if (!config) return;
      console.log(`${config.name} completed:`, fnaId);
      loadFNA();
      toast.success(`${config.name} completed successfully`);
    },
    [config, loadFNA]
  );

  /**
   * Handle edit FNA (opens wizard with existing data)
   */
  const handleEditFNA = useCallback(() => {
    setWizardOpen(true);
  }, []);

  /**
   * Handle delete FNA
   */
  const handleDeleteFNA = useCallback(async () => {
    if (!fna || !config) return;

    setDeleting(true);
    const toastId = toast.loading(`Deleting ${config.name}...`);

    try {
      await config.deleteFNA(fna.id);
      toast.success(`${config.name} deleted successfully`, { id: toastId });
      setDeleteDialogOpen(false);
      setFna(null);
      await loadFNA(); // Reload to confirm deletion
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : `Failed to delete ${config.name}`;
      console.error(`Error deleting ${config.name}:`, error);
      toast.error(errorMessage, { id: toastId });
    } finally {
      setDeleting(false);
    }
  }, [fna, config, loadFNA]);

  /**
   * Handle publish FNA (called from PublishFNADialog)
   */
  const handlePublishFNA = useCallback(
    async (fnaId: string) => {
      if (!config) return;
      await config.publishFNA(fnaId);
      loadFNA();
    },
    [config, loadFNA]
  );

  /**
   * Handle unpublish FNA (called from PublishFNADialog)
   */
  const handleUnpublishFNA = useCallback(
    async (fnaId: string) => {
      if (!config) return;
      await config.unpublishFNA(fnaId);
      loadFNA();
    },
    [config, loadFNA]
  );

  return {
    // State
    fna,
    loading,
    wizardOpen,
    deleteDialogOpen,
    publishDialogOpen,
    deleting,

    // Actions
    setWizardOpen,
    setDeleteDialogOpen,
    setPublishDialogOpen,
    handleRunFNA,
    handleFNAComplete,
    handleEditFNA,
    handleDeleteFNA,
    handlePublishFNA,
    handleUnpublishFNA,
    loadFNA,
  };
}
