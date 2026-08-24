/**
 * The version list for one legal document.
 *
 * Split out of `LegalDocumentsManager.tsx` (1,556 lines), which held the whole
 * workspace — helpers, badges, lists, the draft editor and the shell — in one
 * file. Each piece was already a self-contained function with its own props;
 * this only changes which file it lives in.
 */
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Separator } from '../../../../ui/separator';
import { Archive, Copy } from 'lucide-react';
import type { LegalDocumentDefinitionResponse, LegalDocumentVersionResponse } from '../types';
import { StatusBadge } from './LegalDocumentBadges';
import { formatDate } from './legalDocumentHelpers';

export function VersionList({
  definition,
  versions,
  onPublish,
  onArchive,
  onDuplicate,
  actionVersionId,
}: {
  definition: LegalDocumentDefinitionResponse;
  versions: LegalDocumentVersionResponse[];
  onPublish: (versionId: string) => void;
  onArchive: (versionId: string) => void;
  onDuplicate: (versionId: string) => void;
  actionVersionId: string | null;
}) {
  if (versions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-muted-foreground">
        No versions yet. Saving your first legal draft will start the new version history here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((version) => (
        <div key={version.id} className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">v{version.versionNumber}</span>
                <StatusBadge value={version.status} />
                <Badge variant="outline">
                  {version.contentFormat === 'legacy_blocks' ? 'Legacy snapshot' : 'Normalized'}
                </Badge>
                {definition.currentPublishedVersionId === version.id && (
                  <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                    Live
                  </Badge>
                )}
                {definition.currentDraftVersionId === version.id && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    Active draft
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Created {formatDate(version.createdAt)}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Published: {formatDate(version.publishedAt)}</div>
              <div>Effective: {formatDate(version.effectiveDate)}</div>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            <div>Created by: {version.createdBy || 'Unknown'}</div>
            <div>Published by: {version.publishedBy || 'Not published'}</div>
            <div className="md:col-span-2">
              Change summary: {version.changeSummary || 'No summary recorded yet.'}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {definition.currentDraftVersionId === version.id ? (
              <Button
                type="button"
                size="sm"
                onClick={() => onPublish(version.id)}
                disabled={actionVersionId === version.id}
              >
                {actionVersionId === version.id ? 'Publishing…' : 'Publish Draft'}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onDuplicate(version.id)}
                disabled={actionVersionId === version.id}
              >
                <Copy className="mr-2 h-4 w-4" />
                {actionVersionId === version.id ? 'Creating draft…' : 'Create Draft Copy'}
              </Button>
            )}

            {definition.currentPublishedVersionId !== version.id &&
              definition.currentDraftVersionId !== version.id &&
              version.status !== 'archived' && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onArchive(version.id)}
                  disabled={actionVersionId === version.id}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  {actionVersionId === version.id ? 'Archiving…' : 'Archive'}
                </Button>
              )}
          </div>
        </div>
      ))}
    </div>
  );
}
