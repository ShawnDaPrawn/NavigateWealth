/**
 * Keeping React Query's legal-document caches in step after a mutation.
 *
 * Split out of `LegalDocumentsManager.tsx` (1,556 lines), which held the whole
 * workspace — helpers, badges, lists, the draft editor and the shell — in one
 * file. Each piece was already a self-contained function with its own props;
 * this only changes which file it lives in.
 */
import { useQueryClient } from '@tanstack/react-query';
import type { LegalDocumentDefinitionResponse, LegalDocumentDetailResponse } from '../types';
import { resourceKeys } from '../hooks/queryKeys';

export function syncLegalDocumentCache(
  queryClient: ReturnType<typeof useQueryClient>,
  detail: LegalDocumentDetailResponse,
) {
  queryClient.setQueryData(resourceKeys.legalDocument(detail.definition.slug), detail);
  queryClient.setQueryData(
    resourceKeys.legalDocumentVersions(detail.definition.slug),
    detail.versions,
  );
  queryClient.setQueryData<LegalDocumentDefinitionResponse[] | undefined>(
    resourceKeys.legalDocuments(),
    (existing) => {
      if (!existing) return [detail.definition];
      const next = existing.map((item) =>
        item.slug === detail.definition.slug ? detail.definition : item,
      );
      return next.some((item) => item.slug === detail.definition.slug)
        ? next
        : [...next, detail.definition];
    },
  );
}
