/**
 * Legal documents workspace.
 *
 * WHAT THIS FILE IS NOW
 * ---------------------
 * It was 1,556 lines holding the entire workspace: date and version helpers,
 * three badges, a version list, an audit trail, a 560-line draft editor, the
 * per-document shell, and this top-level page. Every one of those was already a
 * self-contained function with its own props — they simply shared a file.
 *
 * What stays here is the page itself: the document list, the selection, and the
 * migration summary across all of them.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { ScrollArea } from '../../../../ui/scroll-area';
import { Skeleton } from '../../../../ui/skeleton';
import { FileStack, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { resourcesApi } from '../api';
import { LEGAL_SECTION_LABELS } from '../legal-constants';
import { LEGAL_MIGRATION_PRIORITY_SLUGS } from '../../../../../shared/legal-documents-registry';
import type {
  LegalDocumentDefinitionResponse,
  LegalDocumentMigrationBatchResponse,
} from '../types';
import { resourceKeys } from '../hooks/queryKeys';
import { DetailShell } from './DetailShell';
import { MigrationBadge, RenderModeBadge, StatusBadge } from './LegalDocumentBadges';

export default function LegalDocumentsManager() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: resourceKeys.legalDocuments(),
    queryFn: () => resourcesApi.getLegalDocuments(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!selectedSlug && listQuery.data && listQuery.data.length > 0) {
      setSelectedSlug(listQuery.data[0].slug);
    }
  }, [selectedSlug, listQuery.data]);

  const detailQuery = useQuery({
    queryKey: selectedSlug
      ? resourceKeys.legalDocument(selectedSlug)
      : resourceKeys.legalDocument('unselected'),
    queryFn: () => resourcesApi.getLegalDocument(selectedSlug!),
    enabled: Boolean(selectedSlug),
    staleTime: 5 * 60 * 1000,
  });

  const groupedDocuments = useMemo(() => {
    const docs = listQuery.data || [];
    return docs.reduce<Record<string, LegalDocumentDefinitionResponse[]>>((acc, doc) => {
      const key = doc.section;
      acc[key] = acc[key] || [];
      acc[key].push(doc);
      return acc;
    }, {});
  }, [listQuery.data]);

  const migrationSummary = useMemo(() => {
    const docs = listQuery.data || [];
    const total = docs.length;
    const migrated = docs.filter((doc) => doc.renderMode === 'versioned_document').length;
    const draftReady = docs.filter(
      (doc) => doc.renderMode === 'legacy_resource' && doc.currentDraftVersionId,
    ).length;
    const legacyOnly = total - migrated - draftReady;
    const priorityTotal = docs.filter((doc) =>
      LEGAL_MIGRATION_PRIORITY_SLUGS.includes(doc.slug),
    ).length;
    const priorityOutstanding = docs.filter(
      (doc) =>
        LEGAL_MIGRATION_PRIORITY_SLUGS.includes(doc.slug) &&
        doc.renderMode === 'legacy_resource' &&
        !doc.currentDraftVersionId,
    ).length;

    return {
      total,
      migrated,
      draftReady,
      legacyOnly,
      priorityTotal,
      priorityOutstanding,
    };
  }, [listQuery.data]);

  const migratePriorityMutation = useMutation({
    mutationFn: async (): Promise<LegalDocumentMigrationBatchResponse> =>
      resourcesApi.migratePriorityLegalDocuments(),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocuments() }),
        selectedSlug
          ? queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocument(selectedSlug) })
          : Promise.resolve(),
      ]);

      if (result.failed.length > 0) {
        toast.error('Priority migration finished with some failures', {
          description: `${result.migrated.length} migrated, ${result.skipped.length} skipped, ${result.failed.length} failed.`,
        });
        return;
      }

      toast.success('Priority migration drafts prepared', {
        description: `${result.migrated.length} migrated, ${result.skipped.length} skipped.`,
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to prepare priority migration drafts';
      toast.error('Could not run priority migration', { description: message });
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Legal Documents</CardTitle>
              <CardDescription>
                Migration workspace for moving legacy legal documents into the versioned
                legal-document system.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void migratePriorityMutation.mutateAsync()}
              disabled={
                migratePriorityMutation.isPending || migrationSummary.priorityOutstanding === 0
              }
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {migratePriorityMutation.isPending ? 'Preparing…' : 'Priority Drafts'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-muted-foreground">
            <div>
              Versioned:{' '}
              <span className="font-medium text-gray-900">{migrationSummary.migrated}</span>
            </div>
            <div>
              Draft ready:{' '}
              <span className="font-medium text-gray-900">{migrationSummary.draftReady}</span>
            </div>
            <div>
              Legacy only:{' '}
              <span className="font-medium text-gray-900">{migrationSummary.legacyOnly}</span>
            </div>
            <div>
              Priority remaining:{' '}
              <span className="font-medium text-gray-900">
                {migrationSummary.priorityOutstanding} / {migrationSummary.priorityTotal}
              </span>
            </div>
          </div>
          {listQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[760px] pr-3">
              <div className="space-y-6">
                {Object.entries(groupedDocuments).map(([section, docs]) => (
                  <div key={section} className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {LEGAL_SECTION_LABELS[section as keyof typeof LEGAL_SECTION_LABELS]}
                    </div>
                    <div className="space-y-2">
                      {docs.map((doc) => {
                        const isActive = selectedSlug === doc.slug;
                        return (
                          <Button
                            key={doc.slug}
                            type="button"
                            variant={isActive ? 'default' : 'outline'}
                            className="h-auto w-full justify-start px-3 py-3 text-left"
                            onClick={() => setSelectedSlug(doc.slug)}
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium">{doc.title}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <StatusBadge value={doc.status} />
                                <RenderModeBadge value={doc.renderMode} />
                                <MigrationBadge
                                  state={
                                    doc.renderMode === 'versioned_document'
                                      ? 'migrated'
                                      : doc.currentDraftVersionId
                                        ? 'draft-ready'
                                        : 'legacy-only'
                                  }
                                />
                              </div>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {detailQuery.isLoading ? (
        <Card>
          <CardHeader className="space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </CardContent>
        </Card>
      ) : detailQuery.data ? (
        <DetailShell detail={detailQuery.data} />
      ) : (
        <Card className="min-h-[640px]">
          <CardContent className="flex h-full items-center justify-center py-16 text-center text-muted-foreground">
            <div>
              <FileStack className="mx-auto mb-4 h-10 w-10 opacity-50" />
              <p className="text-lg font-medium">Select a legal document</p>
              <p className="mt-2 text-sm">
                The draft workspace will open here with version metadata, rich editing, and live
                preview.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
