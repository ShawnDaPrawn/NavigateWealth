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

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Skeleton } from '../../../../ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Search, Sparkles } from 'lucide-react';
import { ErrorState, StatCard, useBreadcrumbTrail } from '../../../layout/page';
import { BackLink } from '../components/BackLink';
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

/** Address key for the open legal document (?legalDoc=<slug>). */
const LEGAL_DOC_PARAM = 'legalDoc';

export default function LegalDocumentsManager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSlug = searchParams.get(LEGAL_DOC_PARAM);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const setSelectedSlug = (slug: string | null) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (slug) params.set(LEGAL_DOC_PARAM, slug);
      else {
        params.delete(LEGAL_DOC_PARAM);
        params.delete('legalView');
      }
      return params;
    });
  };

  const listQuery = useQuery({
    queryKey: resourceKeys.legalDocuments(),
    queryFn: () => resourcesApi.getLegalDocuments(),
    staleTime: 5 * 60 * 1000,
  });

  const openTitle = selectedSlug
    ? (listQuery.data?.find((doc) => doc.slug === selectedSlug)?.title ?? 'Legal document')
    : null;
  useBreadcrumbTrail(
    openTitle
      ? [{ label: 'Legal documents', onClick: () => setSelectedSlug(null) }, { label: openTitle }]
      : [{ label: 'Legal documents' }],
  );

  const detailQuery = useQuery({
    queryKey: selectedSlug
      ? resourceKeys.legalDocument(selectedSlug)
      : resourceKeys.legalDocument('unselected'),
    queryFn: () => resourcesApi.getLegalDocument(selectedSlug!),
    enabled: Boolean(selectedSlug),
    staleTime: 5 * 60 * 1000,
  });

  const groupedDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const docs = (listQuery.data || []).filter(
      (doc) =>
        (groupFilter === 'all' || doc.section === groupFilter) &&
        (!term ||
          doc.title.toLowerCase().includes(term) ||
          (doc.description || '').toLowerCase().includes(term)),
    );
    return docs.reduce<Record<string, LegalDocumentDefinitionResponse[]>>((acc, doc) => {
      const key = doc.section;
      acc[key] = acc[key] || [];
      acc[key].push(doc);
      return acc;
    }, {});
  }, [listQuery.data, search, groupFilter]);

  const sections = useMemo(
    () => [...new Set((listQuery.data || []).map((doc) => doc.section))],
    [listQuery.data],
  );

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

  const sectionLabel = (section: string) =>
    LEGAL_SECTION_LABELS[section as keyof typeof LEGAL_SECTION_LABELS] || section;

  // --- A legal document is a page of its own ---
  if (selectedSlug) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink label="Legal documents" onClick={() => setSelectedSlug(null)} />
        {detailQuery.isLoading ? (
          <Card>
            <CardHeader className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-36 w-full" />
            </CardContent>
          </Card>
        ) : detailQuery.data ? (
          <DetailShell
            detail={detailQuery.data}
            sectionLabel={sectionLabel(detailQuery.data.definition.section)}
          />
        ) : (
          (() => {
            const detailError = detailQuery.error as
              (Error & { statusCode?: number; status?: number }) | null;
            const notFound =
              !detailError ||
              detailError.statusCode === 404 ||
              detailError.status === 404 ||
              /not found/i.test(detailError.message);
            return notFound ? (
              <ErrorState
                title="Legal document not found"
                description="It may have been removed, or the link is out of date. Go back to the list of legal documents."
                onRetry={() => void detailQuery.refetch()}
              />
            ) : (
              <ErrorState
                title="Unable to load this legal document"
                onRetry={() => void detailQuery.refetch()}
                details={detailError.message}
              />
            );
          })()
        )}
      </div>
    );
  }

  const groups = Object.entries(groupedDocuments);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Versioned" value={migrationSummary.migrated} />
        <StatCard label="Draft ready" value={migrationSummary.draftReady} />
        <StatCard label="Legacy only" value={migrationSummary.legacyOnly} />
        <StatCard
          label="Priority remaining"
          value={`${migrationSummary.priorityOutstanding} / ${migrationSummary.priorityTotal}`}
          tone={migrationSummary.priorityOutstanding > 0 ? 'attention' : 'default'}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search
            className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search legal documents"
            aria-label="Search legal documents"
            className="pl-8"
          />
        </div>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-full sm:w-[240px]" aria-label="Group">
            <SelectValue placeholder="Group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {sections.map((section) => (
              <SelectItem key={section} value={section}>
                {sectionLabel(section)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          type="button"
          variant="outline"
          onClick={() => void migratePriorityMutation.mutateAsync()}
          disabled={migratePriorityMutation.isPending || migrationSummary.priorityOutstanding === 0}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {migratePriorityMutation.isPending ? 'Preparing…' : 'Priority drafts'}
        </Button>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <ErrorState
          title="Unable to load legal documents"
          onRetry={() => void listQuery.refetch()}
          details={(listQuery.error as Error | null)?.message}
        />
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-nw-line bg-white px-6 py-12 text-center text-sm text-nw-text-3">
          No legal documents match your search.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(([section, docs]) => (
            <section
              key={section}
              className="overflow-hidden rounded-xl border border-nw-line bg-white"
            >
              <h2 className="border-b border-nw-line px-5 py-3 text-sm font-semibold text-nw-ink">
                {sectionLabel(section)}
              </h2>
              <ul className="divide-y divide-nw-line">
                {docs.map((doc) => (
                  <li key={doc.slug} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-nw-ink">{doc.title}</p>
                      <p className="text-xs text-nw-text-3">{sectionLabel(doc.section)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedSlug(doc.slug)}
                      aria-label={`Open ${doc.title}`}
                    >
                      Open
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
