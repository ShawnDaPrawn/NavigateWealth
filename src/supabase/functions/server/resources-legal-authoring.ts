/**
 * Legal documents — draft authoring, publication and legacy migration.
 *
 * The write half of what used to be one 900-line region inside
 * `ResourcesService`. The dependency runs one way only: everything here reads
 * through `resources-legal-read.ts`, and nothing there calls back. That is what
 * made the boundary safe to draw rather than a matter of taste.
 */
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { NotFoundError, ValidationError } from './error.middleware.ts';
import type { LegalDocumentDefinition, LegalDocumentVersion, Resource } from './resources-types.ts';
import {
  LEGAL_DOCUMENTS_REGISTRY,
  LEGAL_MIGRATION_PRIORITY_SLUGS,
} from '../../../shared/legal-documents-registry.ts';
import {
  convertLegacyBlocksToLegalHtml,
  generateId,
  incrementLegalVersion,
  legalDefinitionKey,
  legalVersionKey,
  normalizeLegalDocumentContent,
} from './resources-helpers.ts';
import {
  bootstrapLegalDocumentDefinition,
  getLegacyLegalResource,
  getLegalDocumentAdmin,
  getLegalDocumentDefinition,
  listLegalDocumentVersions,
} from './resources-legal-read.ts';

const log = createModuleLogger('resources-legal-authoring');

export async function createLegalDocumentDraft(
  slug: string,
  input: {
    versionNumber: string;
    effectiveDate?: string | null;
    changeSummary?: string | null;
    sourceHtml: string;
    pdfConfig?: {
      pageSize: 'A4' | 'A3';
      orientation: 'portrait' | 'landscape';
    };
  },
  actorId: string,
) {
  const definition = await getLegalDocumentDefinition(slug);
  if (!definition) {
    throw new NotFoundError('Legal document not found');
  }

  const existingDraft = definition.currentDraftVersionId
    ? ((await kv.get(
        legalVersionKey(slug, definition.currentDraftVersionId),
      )) as LegalDocumentVersion | null)
    : null;

  if (existingDraft) {
    return await updateLegalDocumentDraft(slug, existingDraft.id, input, actorId);
  }

  const normalized = normalizeLegalDocumentContent(input.sourceHtml);
  const now = new Date().toISOString();
  const versionId = generateId();
  const versions = await listLegalDocumentVersions(slug);
  const publishedVersion = definition.currentPublishedVersionId
    ? versions.find((version) => version.id === definition.currentPublishedVersionId) || null
    : null;

  const draftVersion: LegalDocumentVersion = {
    id: versionId,
    documentId: definition.id,
    slug,
    title: definition.title,
    section: definition.section,
    versionNumber:
      input.versionNumber.trim() || incrementLegalVersion(publishedVersion?.versionNumber),
    status: 'draft',
    contentFormat: 'normalized_rich_text',
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    effectiveDate: input.effectiveDate?.trim() || null,
    createdBy: actorId,
    publishedBy: null,
    changeSummary: input.changeSummary?.trim() || null,
    blocks: normalized.blocks,
    sourceHtml: normalized.sourceHtml,
    normalizedContent: normalized.normalizedContent,
    toc: normalized.toc,
    pdfConfig: input.pdfConfig || {
      pageSize: 'A4',
      orientation: 'portrait',
    },
  };

  const nextDefinition: LegalDocumentDefinition = {
    ...definition,
    status: definition.currentPublishedVersionId ? definition.status : 'draft',
    currentDraftVersionId: versionId,
    updatedAt: now,
  };

  await Promise.all([
    kv.set(legalVersionKey(slug, versionId), draftVersion),
    kv.set(legalDefinitionKey(slug), nextDefinition),
  ]);

  return await getLegalDocumentAdmin(slug);
}

export async function updateLegalDocumentDraft(
  slug: string,
  versionId: string,
  input: {
    versionNumber: string;
    effectiveDate?: string | null;
    changeSummary?: string | null;
    sourceHtml: string;
    pdfConfig?: {
      pageSize: 'A4' | 'A3';
      orientation: 'portrait' | 'landscape';
    };
  },
  actorId: string,
) {
  const definition = await getLegalDocumentDefinition(slug);
  if (!definition) {
    throw new NotFoundError('Legal document not found');
  }

  const existingVersion = (await kv.get(
    legalVersionKey(slug, versionId),
  )) as LegalDocumentVersion | null;
  if (!existingVersion || existingVersion.status !== 'draft') {
    throw new ValidationError('Only draft legal document versions can be updated');
  }

  if (definition.currentDraftVersionId && definition.currentDraftVersionId !== versionId) {
    throw new ValidationError('This draft is no longer the active working draft');
  }

  const normalized = normalizeLegalDocumentContent(input.sourceHtml);
  const now = new Date().toISOString();
  const nextDefinition: LegalDocumentDefinition = {
    ...definition,
    currentDraftVersionId: versionId,
    updatedAt: now,
  };

  const updatedDraft: LegalDocumentVersion = {
    ...existingVersion,
    title: definition.title,
    section: definition.section,
    versionNumber: input.versionNumber.trim() || existingVersion.versionNumber,
    updatedAt: now,
    effectiveDate: input.effectiveDate?.trim() || null,
    changeSummary: input.changeSummary?.trim() || null,
    blocks: normalized.blocks,
    sourceHtml: normalized.sourceHtml,
    normalizedContent: normalized.normalizedContent,
    toc: normalized.toc,
    pdfConfig: input.pdfConfig ||
      existingVersion.pdfConfig || {
        pageSize: 'A4',
        orientation: 'portrait',
      },
    createdBy: existingVersion.createdBy || actorId,
  };

  await Promise.all([
    kv.set(legalVersionKey(slug, versionId), updatedDraft),
    kv.set(legalDefinitionKey(slug), nextDefinition),
  ]);

  return await getLegalDocumentAdmin(slug);
}

export async function publishLegalDocumentDraft(slug: string, versionId: string, actorId: string) {
  const definition = await getLegalDocumentDefinition(slug);
  if (!definition) {
    throw new NotFoundError('Legal document not found');
  }

  if (definition.currentDraftVersionId !== versionId) {
    throw new ValidationError('Only the active draft can be published');
  }

  const draftVersion = (await kv.get(
    legalVersionKey(slug, versionId),
  )) as LegalDocumentVersion | null;
  if (!draftVersion || draftVersion.status !== 'draft') {
    throw new ValidationError('Legal draft not found');
  }

  if (draftVersion.contentFormat !== 'normalized_rich_text') {
    throw new ValidationError('Only normalized legal drafts can be published');
  }

  if (!draftVersion.sourceHtml?.trim()) {
    throw new ValidationError('Legal draft content is required before publishing');
  }

  if (!draftVersion.effectiveDate?.trim()) {
    throw new ValidationError('An effective date is required before publishing a legal document');
  }

  if (!draftVersion.changeSummary?.trim() || draftVersion.changeSummary.trim().length < 12) {
    throw new ValidationError(
      'Add a meaningful change summary before publishing this legal document',
    );
  }

  const now = new Date().toISOString();
  const writes: Promise<unknown>[] = [];

  if (definition.currentPublishedVersionId && definition.currentPublishedVersionId !== versionId) {
    const previousPublished = (await kv.get(
      legalVersionKey(slug, definition.currentPublishedVersionId),
    )) as LegalDocumentVersion | null;

    if (previousPublished) {
      writes.push(
        kv.set(legalVersionKey(slug, previousPublished.id), {
          ...previousPublished,
          status: 'archived',
          updatedAt: now,
        } satisfies LegalDocumentVersion),
      );
    }
  }

  const publishedVersion: LegalDocumentVersion = {
    ...draftVersion,
    status: 'published',
    updatedAt: now,
    publishedAt: now,
    publishedBy: actorId,
  };

  const nextDefinition: LegalDocumentDefinition = {
    ...definition,
    status: 'published',
    renderMode: 'versioned_document',
    currentPublishedVersionId: versionId,
    currentDraftVersionId: null,
    updatedAt: now,
  };

  writes.push(
    kv.set(legalVersionKey(slug, versionId), publishedVersion),
    kv.set(legalDefinitionKey(slug), nextDefinition),
  );

  await Promise.all(writes);
  return await getLegalDocumentAdmin(slug);
}

export async function archiveLegalDocumentVersion(slug: string, versionId: string) {
  const definition = await getLegalDocumentDefinition(slug);
  if (!definition) {
    throw new NotFoundError('Legal document not found');
  }

  if (definition.currentPublishedVersionId === versionId) {
    throw new ValidationError('Publish a replacement before archiving the current live version');
  }

  if (definition.currentDraftVersionId === versionId) {
    throw new ValidationError('Archive is only available for inactive versions');
  }

  const version = (await kv.get(legalVersionKey(slug, versionId))) as LegalDocumentVersion | null;
  if (!version) {
    throw new NotFoundError('Legal document version not found');
  }

  if (version.status === 'archived') {
    return await getLegalDocumentAdmin(slug);
  }

  await kv.set(legalVersionKey(slug, versionId), {
    ...version,
    status: 'archived',
    updatedAt: new Date().toISOString(),
  } satisfies LegalDocumentVersion);

  return await getLegalDocumentAdmin(slug);
}

export async function duplicateLegalDocumentVersionToDraft(
  slug: string,
  versionId: string,
  actorId: string,
) {
  const definition = await getLegalDocumentDefinition(slug);
  if (!definition) {
    throw new NotFoundError('Legal document not found');
  }

  const sourceVersion = (await kv.get(
    legalVersionKey(slug, versionId),
  )) as LegalDocumentVersion | null;
  if (!sourceVersion) {
    throw new NotFoundError('Legal document version not found');
  }

  const now = new Date().toISOString();
  const nextDraftId = generateId();
  const normalizedLegacyCopy =
    sourceVersion.contentFormat === 'legacy_blocks'
      ? normalizeLegalDocumentContent(
          convertLegacyBlocksToLegalHtml(sourceVersion.blocks, definition.title),
        )
      : null;
  const nextDraft: LegalDocumentVersion = {
    ...sourceVersion,
    id: nextDraftId,
    status: 'draft',
    contentFormat: normalizedLegacyCopy ? 'normalized_rich_text' : sourceVersion.contentFormat,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    publishedBy: null,
    createdBy: actorId,
    blocks: normalizedLegacyCopy ? normalizedLegacyCopy.blocks : sourceVersion.blocks,
    sourceHtml: normalizedLegacyCopy ? normalizedLegacyCopy.sourceHtml : sourceVersion.sourceHtml,
    normalizedContent: normalizedLegacyCopy
      ? normalizedLegacyCopy.normalizedContent
      : sourceVersion.normalizedContent,
    toc: normalizedLegacyCopy ? normalizedLegacyCopy.toc : sourceVersion.toc,
    changeSummary:
      sourceVersion.status === 'published'
        ? `Draft created from published version v${sourceVersion.versionNumber}.${normalizedLegacyCopy ? ' Converted from legacy builder content.' : ''}`
        : `Draft created from version v${sourceVersion.versionNumber}.${normalizedLegacyCopy ? ' Converted from legacy builder content.' : ''}`,
  };

  const writes: Promise<unknown>[] = [kv.set(legalVersionKey(slug, nextDraftId), nextDraft)];

  if (definition.currentDraftVersionId) {
    const existingDraft = (await kv.get(
      legalVersionKey(slug, definition.currentDraftVersionId),
    )) as LegalDocumentVersion | null;

    if (existingDraft) {
      writes.push(
        kv.set(legalVersionKey(slug, existingDraft.id), {
          ...existingDraft,
          status: 'archived',
          updatedAt: now,
        } satisfies LegalDocumentVersion),
      );
    }
  }

  const nextDefinition: LegalDocumentDefinition = {
    ...definition,
    currentDraftVersionId: nextDraftId,
    updatedAt: now,
  };

  writes.push(kv.set(legalDefinitionKey(slug), nextDefinition));
  await Promise.all(writes);

  return await getLegalDocumentAdmin(slug);
}

export async function migrateLegacyLegalDocumentToDraft(slug: string, actorId: string) {
  const definition = await getLegalDocumentDefinition(slug);
  if (!definition) {
    throw new NotFoundError('Legal document not found');
  }

  const currentDraft = definition.currentDraftVersionId
    ? ((await kv.get(
        legalVersionKey(slug, definition.currentDraftVersionId),
      )) as LegalDocumentVersion | null)
    : null;

  if (currentDraft && currentDraft.contentFormat === 'normalized_rich_text') {
    return await getLegalDocumentAdmin(slug);
  }

  const legacyResource = await getLegacyLegalResource(slug, definition);
  if (!legacyResource) {
    throw new ValidationError('No legacy legal resource is available to migrate');
  }

  const versions = await listLegalDocumentVersions(slug);
  const publishedVersion = definition.currentPublishedVersionId
    ? versions.find((version) => version.id === definition.currentPublishedVersionId) || null
    : null;
  const legacySnapshot =
    publishedVersion?.contentFormat === 'legacy_blocks' ? publishedVersion : null;
  const htmlSource = convertLegacyBlocksToLegalHtml(
    legacySnapshot?.blocks?.length ? legacySnapshot.blocks : legacyResource.blocks,
    definition.title,
  );
  const normalized = normalizeLegalDocumentContent(htmlSource);
  const now = new Date().toISOString();
  const versionId = generateId();

  const draftVersion: LegalDocumentVersion = {
    id: versionId,
    documentId: definition.id,
    slug,
    title: definition.title,
    section: definition.section,
    versionNumber: legacySnapshot?.versionNumber || legacyResource.version || '1.0',
    status: 'draft',
    contentFormat: 'normalized_rich_text',
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    effectiveDate: legacySnapshot?.effectiveDate || null,
    createdBy: actorId,
    publishedBy: null,
    changeSummary: 'Migration draft created from the legacy legal resource.',
    blocks: normalized.blocks,
    sourceHtml: normalized.sourceHtml,
    normalizedContent: normalized.normalizedContent,
    toc: normalized.toc,
    pdfConfig: legacySnapshot?.pdfConfig || {
      pageSize: 'A4',
      orientation: 'portrait',
    },
  };

  const writes: Promise<unknown>[] = [kv.set(legalVersionKey(slug, versionId), draftVersion)];

  if (currentDraft) {
    writes.push(
      kv.set(legalVersionKey(slug, currentDraft.id), {
        ...currentDraft,
        status: 'archived',
        updatedAt: now,
      } satisfies LegalDocumentVersion),
    );
  }

  const nextDefinition: LegalDocumentDefinition = {
    ...definition,
    currentDraftVersionId: versionId,
    updatedAt: now,
  };

  writes.push(kv.set(legalDefinitionKey(slug), nextDefinition));
  await Promise.all(writes);

  return await getLegalDocumentAdmin(slug);
}

export async function migratePriorityLegacyLegalDocuments(actorId: string): Promise<{
  migrated: string[];
  skipped: string[];
  failed: Array<{ slug: string; error: string }>;
}> {
  const migrated: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ slug: string; error: string }> = [];

  for (const slug of LEGAL_MIGRATION_PRIORITY_SLUGS) {
    try {
      const definition = await getLegalDocumentDefinition(slug);
      if (!definition) {
        skipped.push(slug);
        continue;
      }

      if (definition.renderMode === 'versioned_document') {
        skipped.push(slug);
        continue;
      }

      const currentDraft = definition.currentDraftVersionId
        ? ((await kv.get(
            legalVersionKey(slug, definition.currentDraftVersionId),
          )) as LegalDocumentVersion | null)
        : null;

      if (currentDraft && currentDraft.contentFormat === 'normalized_rich_text') {
        skipped.push(slug);
        continue;
      }

      await migrateLegacyLegalDocumentToDraft(slug, actorId);
      migrated.push(slug);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown migration failure';
      failed.push({ slug, error: message });
    }
  }

  return { migrated, skipped, failed };
}

/**
 * Seed all legal documents.
 * Creates a resource entry + pointer for each document in the registry.
 * Idempotent — skips documents that already have a valid pointer.
 *
 * @returns { seeded, skipped, total }
 */
export async function seedLegalDocuments(
  registry?: Array<{ slug: string; name: string; section: string; description: string }>,
): Promise<{ seeded: number; skipped: number; total: number }> {
  const sourceRegistry = registry && registry.length > 0 ? registry : LEGAL_DOCUMENTS_REGISTRY;
  let seeded = 0;
  let skipped = 0;

  for (const doc of sourceRegistry) {
    // Check if pointer already exists with a valid resource
    const existing = await kv.get(`legal_form:${doc.slug}`);
    if (existing?.resourceId) {
      const existingResource = await kv.get(`resource:${existing.resourceId}`);
      if (existingResource) {
        skipped++;
        continue;
      }
    }

    const resourceId = generateId();
    const now = new Date().toISOString();

    // Default template blocks: title + effective date + placeholder body
    const blocks = [
      {
        id: `${resourceId}-h`,
        type: 'section_header',
        data: { number: '', title: doc.name.toUpperCase() },
      },
      {
        id: `${resourceId}-t`,
        type: 'text',
        data: {
          content: `<p><strong>Effective Date:</strong> [Date to be inserted]</p><p>This document is managed by Navigate Wealth. Content will be populated by the compliance team via the Form Builder.</p>`,
        },
      },
    ];

    const resource: Resource = {
      id: resourceId,
      title: doc.name,
      description: doc.description,
      category: 'Legal',
      createdAt: now,
      blocks,
      clientTypes: ['Universal'],
      version: '1.0',
    };

    // Write both entries together (multi-entry consistency per §5.4)
    await Promise.all([
      kv.set(`resource:${resourceId}`, {
        ...resource,
        legalSlug: doc.slug,
        legalSection: doc.section,
      }),
      kv.set(`legal_form:${doc.slug}`, {
        resourceId,
        slug: doc.slug,
        name: doc.name,
        section: doc.section,
        createdAt: now,
      }),
    ]);

    await bootstrapLegalDocumentDefinition({
      slug: doc.slug,
      name: doc.name,
      section: doc.section as (typeof LEGAL_DOCUMENTS_REGISTRY)[number]['section'],
      description: doc.description,
    });

    seeded++;
    log.info('Legal document seeded', { slug: doc.slug, resourceId });
  }

  log.success('Legal document seeding complete', {
    seeded,
    skipped,
    total: sourceRegistry.length,
  });
  return { seeded, skipped, total: sourceRegistry.length };
}
