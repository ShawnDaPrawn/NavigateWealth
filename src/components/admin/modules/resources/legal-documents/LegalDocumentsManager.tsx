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

import { Card, CardContent, CardHeader } from '../../../../ui/card';

import { Skeleton } from '../../../../ui/skeleton';
import {
  DsButton,
  DsChipSelect,
  ErrorState,
  StatCard,
  useBreadcrumbTrail,
} from '../../../layout/page';
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
import { ModePill, StatusBadge } from './LegalDocumentBadges';

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
      <div className="ds-stats">
        <StatCard label="Versioned" value={migrationSummary.migrated} />
        <StatCard label="Draft ready" value={migrationSummary.draftReady} />
        <StatCard label="Legacy only" value={migrationSummary.legacyOnly} />
        <StatCard
          label="Priority remaining"
          value={`${migrationSummary.priorityOutstanding} / ${migrationSummary.priorityTotal}`}
          tone={migrationSummary.priorityOutstanding > 0 ? 'attention' : 'default'}
        />
      </div>

      <section className="ds-card overflow-hidden">
        {/* RE-Legal: search, Group chip and Priority drafts in the card's toolbar */}
        <div className="ds-toolbar flex-wrap">
          <input
            className="ds-input w-full sm:w-auto sm:min-w-[260px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search legal documents…"
            aria-label="Search legal documents"
          />
          <DsChipSelect
            label="Group"
            anyLabel="All groups"
            value={groupFilter}
            options={sections.map((section) => ({ value: section, label: sectionLabel(section) }))}
            onChange={setGroupFilter}
          />
          <button
            type="button"
            className="ds-chip"
            onClick={() => void migratePriorityMutation.mutateAsync()}
            disabled={
              migratePriorityMutation.isPending || migrationSummary.priorityOutstanding === 0
            }
          >
            {migratePriorityMutation.isPending ? 'Preparing…' : 'Priority drafts'}
          </button>
        </div>

        {listQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : listQuery.isError ? (
          <div className="p-4">
            <ErrorState
              title="Unable to load legal documents"
              onRetry={() => void listQuery.refetch()}
              details={(listQuery.error as Error | null)?.message}
            />
          </div>
        ) : groups.length === 0 ? (
          <div className="ds-card-b text-center">
            <span className="ds-meta">No legal documents match your search.</span>
          </div>
        ) : (
          <ul>
            {groups.flatMap(([, docs]) =>
              docs.map((doc) => (
                <li key={doc.slug} className="ds-todo-row flex-wrap sm:flex-nowrap">
                  <div className="grow min-w-0">
                    <b className="block truncate text-[13.5px] font-medium text-nw-ink">
                      {doc.title}
                    </b>
                    <span className="ds-meta">{sectionLabel(doc.section)}</span>
                  </div>
                  <StatusBadge value={doc.status} />
                  <ModePill
                    renderMode={doc.renderMode}
                    draftReady={Boolean(doc.currentDraftVersionId)}
                  />
                  <DsButton
                    size="sm"
                    onClick={() => setSelectedSlug(doc.slug)}
                    aria-label={`Open ${doc.title}`}
                  >
                    Open
                  </DsButton>
                </li>
              )),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
