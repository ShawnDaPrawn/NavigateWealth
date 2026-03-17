/**
 * View Published FNA Dialog
 * Shared modal dialog for viewing any published FNA's results.
 *
 * Moved from risk-planning-fna/components/ during Phase 8 alignment.
 * This component is FNA-type-agnostic — callers inject the ResultsView
 * component and deleteFn via props.
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Button } from '../../../ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../ui/alert-dialog';
import { Loader2, Trash2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

// ==================== TYPES ====================

interface ViewPublishedFNADialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to control dialog visibility */
  onOpenChange: (open: boolean) => void;
  /** Machine-readable FNA type identifier (e.g. 'risk', 'medical') */
  fnaType: string;
  /** Human-readable FNA type name (e.g. 'Risk Planning FNA') */
  fnaTypeName: string;
  /** Pre-loaded FNA data — if provided, skips fetch */
  fnaData?: Record<string, unknown>;
  /** FNA record ID — if provided without fnaData, triggers a fetch */
  fnaId?: string;
  /** Override the displayed status (defaults to fnaData.status) */
  currentStatus?: string;
  /** Callback fired after successful deletion */
  onDeleted?: () => void;
  /**
   * Component to render the FNA results. Receives the FNA data as
   * `fna`, `results`, `session`, and `plan` props for maximum
   * compatibility across module ResultsView signatures.
   */
  ResultsView?: React.ComponentType<Record<string, unknown>>;
  /** API base URL used to fetch the FNA when fnaId is provided */
  apiBaseUrl?: string;
  /** Async function to delete the FNA. When omitted and apiBaseUrl is
   *  not provided, the delete button is hidden. */
  deleteFn?: (fnaId: string) => Promise<void>;
}

// ==================== COMPONENT ====================

export function ViewPublishedFNADialog({
  open,
  onOpenChange,
  fnaType,
  fnaTypeName,
  fnaData: providedFnaData,
  fnaId,
  currentStatus,
  onDeleted,
  ResultsView,
  apiBaseUrl,
  deleteFn,
}: ViewPublishedFNADialogProps) {
  const [fnaData, setFnaData] = useState<Record<string, unknown> | undefined>(
    providedFnaData as Record<string, unknown> | undefined,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ---- Data Loading ----

  useEffect(() => {
    if (open && fnaId && !providedFnaData) {
      loadFNA();
    } else if (providedFnaData) {
      setFnaData(providedFnaData as Record<string, unknown>);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fnaId, providedFnaData, apiBaseUrl]);

  const loadFNA = async (): Promise<void> => {
    if (!fnaId) return;

    setIsLoading(true);
    try {
      if (!apiBaseUrl) {
        throw new Error(
          `Cannot fetch FNA: no apiBaseUrl provided for type "${fnaType}"`,
        );
      }

      const url = `${apiBaseUrl}/${fnaId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to load ${fnaTypeName} (HTTP ${res.status})`);
      }

      const result = await res.json();
      // Handle both { data: ... } and direct object responses
      setFnaData(result.data || result);
    } catch (err) {
      console.error(`Error loading ${fnaTypeName}:`, err);
      toast.error(`Failed to load ${fnaTypeName} details`);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Delete Handler ----

  const canDelete = !!(deleteFn || apiBaseUrl);

  const handleDelete = async () => {
    if (!fnaId) return;

    setIsLoading(true);
    try {
      if (deleteFn) {
        await deleteFn(fnaId);
      } else if (apiBaseUrl) {
        const res = await fetch(`${apiBaseUrl}/delete/${fnaId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });

        if (!res.ok) {
          let errorMessage = `Failed to delete ${fnaTypeName}`;
          try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // Ignore JSON parse failure
          }
          throw new Error(errorMessage);
        }
      }

      toast.success(`${fnaTypeName} deleted successfully`);
      onDeleted?.();
      onOpenChange(false);
    } catch (err) {
      console.error(`Error deleting ${fnaTypeName}:`, err);
      toast.error(`Failed to delete ${fnaTypeName}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Render ----

  return (
    <div className="contents">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!max-w-[1600px] w-[95vw] max-h-[90vh] overflow-y-auto p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-xl font-semibold">
              {fnaTypeName} -{' '}
              {(fnaData?.clientName as string) || 'Client'}
            </DialogTitle>
            {fnaData && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                {fnaData.version && (
                  <span>Version {fnaData.version as string}</span>
                )}
                {fnaData.version && <span>&bull;</span>}
                <span>
                  {(currentStatus || fnaData.status) === 'published'
                    ? 'Published'
                    : 'Draft'}{' '}
                  on{' '}
                  {new Date(
                    (fnaData.publishedAt || fnaData.createdAt) as string,
                  ).toLocaleDateString()}
                </span>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9]" />
              </div>
            ) : fnaData ? (
              ResultsView ? (
                <ResultsView
                  fna={fnaData}
                  results={fnaData}
                  session={fnaData}
                  plan={fnaData}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No results view configured for {fnaTypeName}
                </div>
              )
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No FNA data available
              </div>
            )}
          </div>

          {fnaData && fnaId && canDelete && (
            <div className="mt-6 pt-6 border-t">
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete FNA
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {fnaTypeName}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this Financial Needs Analysis?
              This action cannot be undone. The FNA will be permanently removed
              from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}