/**
 * View Published FNA — the FNA report page.
 * A full page (not a pop-up) with "‹ <category> FNAs", the report title,
 * status and version, and Export PDF / Unpublish in the header; Delete sits
 * under ⋯ and asks first. Renders nothing while `open` is false.
 *
 * Moved from risk-planning-fna/components/ during Phase 8 alignment.
 * This component is FNA-type-agnostic — callers inject the ResultsView
 * component and deleteFn via props.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '../../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { ChevronLeft, Download, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import { PageHeader, useConfirm } from '../../layout/page';
import { exportComponentToPdf } from '../risk-planning-fna/utils/pdfExport';
import { toast } from 'sonner';
import { api, resolveApiEndpoint } from '../../../../utils/api';

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
  /**
   * Loads the FNA when fnaId is provided — FNAConfig.getById, which goes
   * through the type's own API. Preferred over `apiBaseUrl`.
   */
  loadFn?: (fnaId: string) => Promise<Record<string, unknown> | null>;
  /** Legacy: API base URL used to fetch `${apiBaseUrl}/${fnaId}` when no loadFn is given. */
  apiBaseUrl?: string;
  /** Async function to delete the FNA. When omitted and apiBaseUrl is
   *  not provided, the delete button is hidden. */
  deleteFn?: (fnaId: string) => Promise<void>;
  /** Unpublishes the FNA (header "Unpublish", shown when it is published). */
  unpublishFn?: (fnaId: string) => Promise<unknown>;
  /** Called after a successful unpublish. */
  onUnpublished?: () => void;
  /** Back-link text ("Risk planning FNAs"). Defaults to the FNA name in the plural. */
  backLabel?: string;
}

/**
 * Where each FNA type keeps its calculated results: Risk in `calculations`,
 * Tax in `finalResults`, the rest in `results`. A draft made from a client
 * intake has none yet, and the results views are not built for that (Tax's
 * threw), so the dialog says so instead of rendering one.
 */
const RESULT_FIELDS = ['results', 'calculations', 'finalResults'] as const;

function hasCalculatedResults(fna: Record<string, unknown>): boolean {
  return RESULT_FIELDS.some((field) => fna[field] !== null && fna[field] !== undefined);
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
  loadFn,
  apiBaseUrl,
  deleteFn,
  unpublishFn,
  onUnpublished,
  backLabel,
}: ViewPublishedFNADialogProps) {
  const { confirm, confirmDialog } = useConfirm();
  const [fnaData, setFnaData] = useState<Record<string, unknown> | undefined>(
    providedFnaData as Record<string, unknown> | undefined,
  );
  const [isLoading, setIsLoading] = useState(false);

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
      if (loadFn) {
        const loaded = await loadFn(fnaId);
        if (!loaded) throw new Error(`${fnaTypeName} ${fnaId} was not found`);
        setFnaData(loaded);
        return;
      }
      if (!apiBaseUrl) {
        throw new Error(`Cannot fetch FNA: no apiBaseUrl provided for type "${fnaType}"`);
      }

      const endpoint = resolveApiEndpoint(`${apiBaseUrl}/${fnaId}`);
      const result = await api.get<{ data?: Record<string, unknown> } | Record<string, unknown>>(
        endpoint,
      );
      setFnaData(
        (result && typeof result === 'object' && 'data' in result && result.data
          ? result.data
          : result) as Record<string, unknown>,
      );
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
        const endpoint = resolveApiEndpoint(`${apiBaseUrl}/delete/${fnaId}`);
        await api.delete(endpoint);
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

  // ---- Unpublish / export ----

  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const status = (currentStatus || (fnaData?.status as string) || 'draft') as string;
  const statusLabel =
    status === 'published' ? 'Published' : status === 'archived' ? 'Archived' : 'Draft';

  const handleUnpublish = async () => {
    if (!fnaId || !unpublishFn) return;
    const ok = await confirm({
      title: `Unpublish ${fnaTypeName}?`,
      description:
        'It goes back to draft and stops showing on the client record until you publish it again.',
      confirmLabel: 'Unpublish',
    });
    if (!ok) return;
    setIsUnpublishing(true);
    try {
      await unpublishFn(fnaId);
      toast.success(`${fnaTypeName} unpublished`);
      onUnpublished?.();
      setFnaData((prev) => (prev ? { ...prev, status: 'draft' } : prev));
    } catch (err) {
      console.error(`Error unpublishing ${fnaTypeName}:`, err);
      toast.error(`Could not unpublish the ${fnaTypeName}`);
    } finally {
      setIsUnpublishing(false);
    }
  };

  const handleExportPdf = async () => {
    if (!fnaData || !ResultsView) return;
    setIsExporting(true);
    try {
      const clientName = (fnaData.clientName as string) || 'Client';
      const dateStr = new Date().toISOString().split('T')[0];
      await exportComponentToPdf(
        <ResultsView fna={fnaData} results={fnaData} session={fnaData} plan={fnaData} />,
        { printTitle: `${fnaTypeName} - ${clientName} (${dateStr})` },
      );
      toast.success('PDF export complete');
    } catch {
      toast.error('Failed to export the FNA. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const confirmDelete = async () => {
    const ok = await confirm({
      title: `Delete ${fnaTypeName}?`,
      description:
        'Are you sure you want to delete this Financial Needs Analysis? This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) await handleDelete();
  };

  // ---- Render: the FNA report is a page of its own ----

  if (!open) return null;

  const canExport = !!(fnaData && ResultsView && hasCalculatedResults(fnaData));
  const dateValue = (fnaData?.publishedAt || fnaData?.updatedAt || fnaData?.createdAt) as
    string | undefined;
  const description = fnaData
    ? [
        (fnaData.clientName as string) || undefined,
        statusLabel,
        [
          dateValue ? new Date(dateValue).toLocaleDateString('en-ZA') : null,
          fnaData.version ? `version ${fnaData.version as string}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {backLabel ?? `${fnaTypeName}s`}
      </button>

      <PageHeader
        title={fnaTypeName}
        description={description}
        actions={
          fnaData ? (
            <>
              {canExport && (
                <Button variant="outline" onClick={handleExportPdf} disabled={isExporting}>
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden="true" />
                  )}
                  Export PDF
                </Button>
              )}
              {unpublishFn && fnaId && status === 'published' && (
                <Button variant="outline" onClick={handleUnpublish} disabled={isUnpublishing}>
                  {isUnpublishing && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  Unpublish
                </Button>
              )}
              {fnaId && canDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="More actions">
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-700"
                      disabled={isLoading}
                      onSelect={() => void confirmDelete()}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Delete FNA
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9]" aria-hidden="true" />
          </div>
        ) : fnaData && !hasCalculatedResults(fnaData) ? (
          <div className="rounded-xl border border-nw-line bg-white py-12 text-center text-muted-foreground">
            <p className="font-medium text-gray-900">Not calculated yet</p>
            <p className="mt-1 text-sm">
              This draft holds the client&apos;s intake answers. Run the {fnaTypeName} to calculate
              and publish it.
            </p>
          </div>
        ) : fnaData ? (
          ResultsView ? (
            <ResultsView fna={fnaData} results={fnaData} session={fnaData} plan={fnaData} />
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              No results view configured for {fnaTypeName}
            </div>
          )
        ) : (
          <div className="py-12 text-center text-muted-foreground">No FNA data available</div>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}
