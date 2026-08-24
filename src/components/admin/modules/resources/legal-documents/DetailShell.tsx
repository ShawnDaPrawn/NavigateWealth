/**
 * One legal document: its draft, published version and history.
 *
 * Split out of `LegalDocumentsManager.tsx` (1,556 lines), which held the whole
 * workspace — helpers, badges, lists, the draft editor and the shell — in one
 * file. Each piece was already a self-contained function with its own props;
 * this only changes which file it lives in.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Separator } from '../../../../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { FileClock, FileText, History, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { resourcesApi } from '../api';
import type { LegalDocumentDetailResponse } from '../types';
import { resourceKeys } from '../hooks/queryKeys';
import { AuditList } from './AuditList';
import { DraftEditor } from './DraftEditor';
import { MigrationBadge, RenderModeBadge, StatusBadge } from './LegalDocumentBadges';
import { VersionList } from './VersionList';
import { syncLegalDocumentCache } from './legalDocumentCache';
import { formatDate, getMigrationState } from './legalDocumentHelpers';

export function DetailShell({ detail }: { detail: LegalDocumentDetailResponse }) {
  const { definition, currentPublishedVersion, versions } = detail;
  const queryClient = useQueryClient();
  const [actionVersionId, setActionVersionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'draft' | 'published' | 'history'>('draft');
  const migrationState = getMigrationState(detail);
  const auditQuery = useQuery({
    queryKey: [...resourceKeys.legalDocument(definition.slug), 'audit'],
    queryFn: () => resourcesApi.getLegalDocumentAudit(definition.slug),
    staleTime: 60 * 1000,
    enabled: activeTab === 'history',
  });

  const invalidateLegalQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocuments() }),
      queryClient.invalidateQueries({ queryKey: resourceKeys.legalDocument(definition.slug) }),
      queryClient.invalidateQueries({
        queryKey: resourceKeys.legalDocumentVersions(definition.slug),
      }),
      queryClient.invalidateQueries({
        queryKey: [...resourceKeys.legalDocument(definition.slug), 'audit'],
      }),
    ]);
  };

  const publishMutation = useMutation({
    mutationFn: async (versionId: string) => {
      setActionVersionId(versionId);
      return resourcesApi.publishLegalDocumentDraft(definition.slug, versionId);
    },
    onSuccess: async (result) => {
      syncLegalDocumentCache(queryClient, result);
      await invalidateLegalQueries();
      toast.success('Legal document published');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to publish legal document';
      toast.error('Could not publish legal document', { description: message });
    },
    onSettled: () => {
      setActionVersionId(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (versionId: string) => {
      setActionVersionId(versionId);
      return resourcesApi.archiveLegalDocumentVersion(definition.slug, versionId);
    },
    onSuccess: async (result) => {
      syncLegalDocumentCache(queryClient, result);
      await invalidateLegalQueries();
      toast.success('Legal document version archived');
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to archive legal document version';
      toast.error('Could not archive legal document version', { description: message });
    },
    onSettled: () => {
      setActionVersionId(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (versionId: string) => {
      setActionVersionId(versionId);
      return resourcesApi.duplicateLegalDocumentVersion(definition.slug, versionId);
    },
    onSuccess: async (result) => {
      syncLegalDocumentCache(queryClient, result);
      await invalidateLegalQueries();
      toast.success('Draft created from selected version');
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to create draft from version';
      toast.error('Could not create draft copy', { description: message });
    },
    onSettled: () => {
      setActionVersionId(null);
    },
  });

  const migrateMutation = useMutation({
    mutationFn: async () => {
      setActionVersionId('migrate');
      return resourcesApi.migrateLegalDocument(definition.slug);
    },
    onSuccess: async (result) => {
      syncLegalDocumentCache(queryClient, result);
      await invalidateLegalQueries();
      toast.success('Migration draft prepared from the legacy legal document');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to create migration draft';
      toast.error('Could not prepare migration draft', { description: message });
    },
    onSettled: () => {
      setActionVersionId(null);
    },
  });

  return (
    <Card className="min-h-[640px]">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="text-2xl">{definition.title}</CardTitle>
            <CardDescription>{definition.description}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={definition.status} />
            <RenderModeBadge value={definition.renderMode} />
            <MigrationBadge state={migrationState} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'draft' | 'published' | 'history')}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="draft" className="gap-2">
              <FileClock className="h-4 w-4" />
              Draft
            </TabsTrigger>
            <TabsTrigger value="published" className="gap-2">
              <FileText className="h-4 w-4" />
              Live
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draft">
            <DraftEditor detail={detail} />
          </TabsContent>

          <TabsContent value="published" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Live website source</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div>
                    Live renderer:{' '}
                    <span className="font-medium text-gray-900">
                      {definition.renderMode === 'legacy_resource'
                        ? 'Legacy legal resource'
                        : 'Versioned legal document'}
                    </span>
                  </div>
                  <div>
                    Live version:{' '}
                    <span className="font-medium text-gray-900">
                      {currentPublishedVersion
                        ? `v${currentPublishedVersion.versionNumber}`
                        : 'Legacy resource only'}
                    </span>
                  </div>
                  <div>
                    Legacy resource link:{' '}
                    <span className="font-medium text-gray-900">
                      {definition.legacyResourceId || 'Not linked'}
                    </span>
                  </div>
                  <div>
                    Updated:{' '}
                    <span className="font-medium text-gray-900">
                      {formatDate(definition.updatedAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Migration readiness</CardTitle>
                    </div>
                    {definition.renderMode === 'legacy_resource' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void migrateMutation.mutateAsync()}
                        disabled={migrateMutation.isPending || migrationState === 'draft-ready'}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {migrateMutation.isPending
                          ? 'Preparing draft…'
                          : migrationState === 'draft-ready'
                            ? 'Migration draft ready'
                            : 'Create migration draft'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Migration creates a normalized draft from the existing legacy legal document
                    without changing the live public slug.
                  </p>
                  <p>
                    Review the draft, adjust wording or formatting if needed, then publish when you
                    are happy to switch this legal document to the versioned renderer.
                  </p>
                  <div>
                    State:{' '}
                    <span className="font-medium text-gray-900">
                      {migrationState === 'migrated'
                        ? 'Already versioned'
                        : migrationState === 'draft-ready'
                          ? 'Migration draft ready for review'
                          : 'Still using legacy resource'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {currentPublishedVersion ? (
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        v{currentPublishedVersion.versionNumber}
                      </span>
                      <StatusBadge value={currentPublishedVersion.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Published {formatDate(currentPublishedVersion.publishedAt)}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {currentPublishedVersion.contentFormat === 'legacy_blocks'
                      ? 'Legacy snapshot'
                      : 'Normalized content'}
                  </Badge>
                </div>
                <Separator className="my-3" />
                <p className="text-sm text-muted-foreground">
                  {currentPublishedVersion.changeSummary || 'No change summary recorded yet.'}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-muted-foreground">
                No published version is stored in the new legal-document layer yet.
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <VersionList
              definition={definition}
              versions={versions}
              onPublish={(versionId) => void publishMutation.mutateAsync(versionId)}
              onArchive={(versionId) => void archiveMutation.mutateAsync(versionId)}
              onDuplicate={(versionId) => void duplicateMutation.mutateAsync(versionId)}
              actionVersionId={actionVersionId}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Audit trail</CardTitle>
                <CardDescription>
                  Recent create, update, migration, publish, archive, and rollback actions for this
                  legal document.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AuditList entries={auditQuery.data || []} isLoading={auditQuery.isLoading} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
