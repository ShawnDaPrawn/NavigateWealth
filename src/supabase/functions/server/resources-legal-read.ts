/**
 * Legal documents — reads and bootstrap.
 *
 * Split out of `resources-service.ts`, which had grown to 1,725 lines around a
 * single stateless `ResourcesService` class. Every method used `this` only to
 * call a sibling, so the class was a namespace rather than an object, and the
 * regions inside it turned out to be genuinely independent: nothing here calls
 * into `resources-legal-authoring.ts`, only the other way round.
 *
 * "Bootstrap" lives on the read side deliberately. `getLegalDocumentDefinition`
 * and `listLegalDocumentDefinitions` create a definition on first read when the
 * registry knows the slug but the store does not, so reading is what materialises
 * a document — surprising, but it is the existing behaviour and moving it would
 * be a change, not a move.
 */
import * as kv from './kv_store.tsx';
import type {
  LegalDocumentDefinition,
  LegalDocumentRenderMode,
  LegalDocumentVersion,
  Resource,
} from './resources-types.ts';
import {
  LEGAL_DOCUMENTS_BY_SLUG,
  LEGAL_DOCUMENTS_REGISTRY,
} from '../../../shared/legal-documents-registry.ts';
import {
  buildLegalTocFromBlocks,
  generateId,
  legalDefinitionKey,
  legalVersionKey,
} from './resources-helpers.ts';

export async function bootstrapLegalDocumentDefinition(
  entry: (typeof LEGAL_DOCUMENTS_REGISTRY)[number],
): Promise<LegalDocumentDefinition> {
  const pointer = await kv.get(`legal_form:${entry.slug}`);
  const legacyResource = pointer?.resourceId
    ? ((await kv.get(`resource:${pointer.resourceId}`)) as Resource | null)
    : null;
  const existing = (await kv.get(legalDefinitionKey(entry.slug))) as LegalDocumentDefinition | null;
  if (existing) {
    const needsLegacyLink = legacyResource && existing.legacyResourceId !== legacyResource.id;
    const needsMetadataRefresh =
      existing.title !== entry.name ||
      existing.section !== entry.section ||
      existing.description !== entry.description ||
      (existing.migrationPriority || 'normal') !== (entry.migrationPriority || 'normal');

    if (needsLegacyLink || needsMetadataRefresh) {
      const nextDefinition: LegalDocumentDefinition = {
        ...existing,
        title: entry.name,
        section: entry.section,
        description: entry.description,
        migrationPriority: entry.migrationPriority || 'normal',
        status: existing.status,
        renderMode: existing.renderMode,
        legacyResourceId: legacyResource?.id || existing.legacyResourceId,
        updatedAt: new Date().toISOString(),
      };

      await kv.set(legalDefinitionKey(entry.slug), nextDefinition);
      if (legacyResource) {
        await bootstrapLegacyLegalDocumentVersion(nextDefinition, legacyResource);
      }
      return (await kv.get(legalDefinitionKey(entry.slug))) as LegalDocumentDefinition;
    }

    if (legacyResource && !existing.currentPublishedVersionId) {
      await bootstrapLegacyLegalDocumentVersion(existing, legacyResource);
      return (await kv.get(legalDefinitionKey(entry.slug))) as LegalDocumentDefinition;
    }

    return existing;
  }

  const now = new Date().toISOString();

  const definition: LegalDocumentDefinition = {
    id: generateId(),
    slug: entry.slug,
    title: entry.name,
    section: entry.section,
    description: entry.description,
    migrationPriority: entry.migrationPriority || 'normal',
    status: legacyResource ? legacyResource.status || 'published' : 'draft',
    renderMode: legacyResource ? 'legacy_resource' : 'versioned_document',
    currentPublishedVersionId: null,
    currentDraftVersionId: null,
    legacyResourceId: legacyResource?.id || null,
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(legalDefinitionKey(entry.slug), definition);

  if (legacyResource) {
    await bootstrapLegacyLegalDocumentVersion(definition, legacyResource);
  }

  return (await kv.get(legalDefinitionKey(entry.slug))) as LegalDocumentDefinition;
}

async function bootstrapLegacyLegalDocumentVersion(
  definition: LegalDocumentDefinition,
  legacyResource: Resource,
): Promise<void> {
  const existingVersions = await listLegalDocumentVersions(definition.slug);
  if (existingVersions.length > 0) {
    return;
  }

  const versionId = generateId();
  const createdAt = legacyResource.createdAt || new Date().toISOString();
  const version: LegalDocumentVersion = {
    id: versionId,
    documentId: definition.id,
    slug: definition.slug,
    title: legacyResource.title || definition.title,
    section: definition.section,
    versionNumber: legacyResource.version || '1.0',
    status: 'published',
    contentFormat: 'legacy_blocks',
    createdAt,
    updatedAt: createdAt,
    publishedAt: createdAt,
    effectiveDate: null,
    createdBy: 'legacy-resource-bootstrap',
    publishedBy: 'legacy-resource-bootstrap',
    changeSummary: 'Bootstrapped from legacy legal resource.',
    blocks: Array.isArray(legacyResource.blocks) ? legacyResource.blocks : [],
    sourceHtml: null,
    normalizedContent: null,
    toc: [],
    pdfConfig: {
      pageSize: 'A4',
      orientation: 'portrait',
    },
  };

  const nextDefinition: LegalDocumentDefinition = {
    ...definition,
    status: 'published',
    currentPublishedVersionId: versionId,
    updatedAt: new Date().toISOString(),
    legacyResourceId: legacyResource.id,
  };

  await Promise.all([
    kv.set(legalVersionKey(definition.slug, versionId), version),
    kv.set(legalDefinitionKey(definition.slug), nextDefinition),
  ]);
}

export async function listLegalDocumentDefinitions(): Promise<LegalDocumentDefinition[]> {
  let definitions = (await kv.listByPrefix('legal_document_definition:')) as Array<{
    key: string;
    value: LegalDocumentDefinition;
  }>;

  const existingSlugs = new Set(definitions.map((row) => row.value?.slug).filter(Boolean));
  const missingEntries = LEGAL_DOCUMENTS_REGISTRY.filter((entry) => !existingSlugs.has(entry.slug));

  if (missingEntries.length > 0) {
    for (const entry of missingEntries) {
      await bootstrapLegalDocumentDefinition(entry);
    }

    definitions = (await kv.listByPrefix('legal_document_definition:')) as Array<{
      key: string;
      value: LegalDocumentDefinition;
    }>;
  }

  const sectionOrder = new Map(
    ['legal-notices', 'privacy-data-protection', 'regulatory-disclosures', 'other'].map(
      (section, index) => [section, index],
    ),
  );

  return definitions
    .map((row) => row.value)
    .sort((a, b) => {
      const sectionDelta =
        (sectionOrder.get(a.section) ?? 99) - (sectionOrder.get(b.section) ?? 99);
      if (sectionDelta !== 0) return sectionDelta;
      return a.title.localeCompare(b.title);
    });
}

export async function getLegalDocumentDefinition(
  slug: string,
): Promise<LegalDocumentDefinition | null> {
  if (!LEGAL_DOCUMENTS_BY_SLUG[slug]) {
    return null;
  }

  const existing = (await kv.get(legalDefinitionKey(slug))) as LegalDocumentDefinition | null;
  if (existing) {
    return existing;
  }

  await bootstrapLegalDocumentDefinition(LEGAL_DOCUMENTS_BY_SLUG[slug]);
  return (await kv.get(legalDefinitionKey(slug))) as LegalDocumentDefinition | null;
}

export async function listLegalDocumentVersions(slug: string): Promise<LegalDocumentVersion[]> {
  const rows = (await kv.listByPrefix(`legal_document_version:${slug}:`)) as Array<{
    key: string;
    value: LegalDocumentVersion;
  }>;

  return rows
    .map((row) => row.value)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getLegalDocumentAdmin(slug: string): Promise<{
  definition: LegalDocumentDefinition;
  versions: LegalDocumentVersion[];
  currentPublishedVersion: LegalDocumentVersion | null;
  currentDraftVersion: LegalDocumentVersion | null;
} | null> {
  const definition = await getLegalDocumentDefinition(slug);
  if (!definition) {
    return null;
  }

  const versions = await listLegalDocumentVersions(slug);
  const currentPublishedVersion = definition.currentPublishedVersionId
    ? versions.find((version) => version.id === definition.currentPublishedVersionId) || null
    : null;
  const currentDraftVersion = definition.currentDraftVersionId
    ? versions.find((version) => version.id === definition.currentDraftVersionId) || null
    : null;

  return {
    definition,
    versions,
    currentPublishedVersion,
    currentDraftVersion,
  };
}

export async function getLegacyLegalResource(
  slug: string,
  definition?: LegalDocumentDefinition | null,
): Promise<Resource | null> {
  const activeDefinition = definition || (await getLegalDocumentDefinition(slug));
  if (!activeDefinition) {
    return null;
  }

  if (activeDefinition.legacyResourceId) {
    const linkedResource = (await kv.get(
      `resource:${activeDefinition.legacyResourceId}`,
    )) as Resource | null;
    if (linkedResource) {
      return linkedResource;
    }
  }

  const pointer = await kv.get(`legal_form:${slug}`);
  if (!pointer?.resourceId) {
    return null;
  }

  return (await kv.get(`resource:${pointer.resourceId}`)) as Resource | null;
}

/**
 * Get a legal document by slug.
 * Reads the pointer `legal_form:{slug}` → resolves to `resource:{resourceId}`.
 */
export async function getLegalDocument(slug: string): Promise<Resource | null> {
  const definition = await getLegalDocumentDefinition(slug);
  if (definition?.currentPublishedVersionId) {
    const version = (await kv.get(
      legalVersionKey(slug, definition.currentPublishedVersionId),
    )) as LegalDocumentVersion | null;

    if (
      version &&
      (definition.renderMode === 'versioned_document' ||
        version.contentFormat === 'normalized_rich_text')
    ) {
      return {
        id: version.id,
        title: version.title,
        description: definition.description,
        category: 'Legal',
        createdAt: version.updatedAt,
        blocks: version.blocks,
        clientTypes: ['Universal'],
        version: version.versionNumber,
        status: version.status,
      };
    }
  }

  const pointer = await kv.get(`legal_form:${slug}`);
  if (!pointer || !pointer.resourceId) {
    return null;
  }

  const resource = await kv.get(`resource:${pointer.resourceId}`);
  return resource || null;
}

export async function getLegalDocumentPublic(slug: string): Promise<{
  id: string;
  title: string;
  description?: string;
  blocks: Record<string, unknown>[];
  version: string;
  updatedAt: string;
  effectiveDate: string | null;
  section: string | null;
  toc: Array<{ id: string; title: string; level: number }>;
  contentHtml: string | null;
  renderMode: LegalDocumentRenderMode;
  pdfConfig: {
    pageSize: 'A4' | 'A3';
    orientation: 'portrait' | 'landscape';
  };
} | null> {
  const definition = await getLegalDocumentDefinition(slug);

  if (definition?.currentPublishedVersionId) {
    const version = (await kv.get(
      legalVersionKey(slug, definition.currentPublishedVersionId),
    )) as LegalDocumentVersion | null;

    if (
      version &&
      (definition.renderMode === 'versioned_document' ||
        version.contentFormat === 'normalized_rich_text')
    ) {
      return {
        id: version.id,
        title: version.title,
        description: definition.description,
        blocks: version.blocks || [],
        version: version.versionNumber,
        updatedAt: version.updatedAt,
        effectiveDate: version.effectiveDate || null,
        section: definition.section,
        toc: version.toc || [],
        contentHtml: version.sourceHtml || null,
        renderMode: 'versioned_document',
        pdfConfig: version.pdfConfig || {
          pageSize: 'A4',
          orientation: 'portrait',
        },
      };
    }
  }

  const resource = await getLegalDocument(slug);
  if (!resource) {
    return null;
  }

  const blocks = Array.isArray(resource.blocks) ? resource.blocks : [];

  return {
    id: resource.id,
    title: resource.title,
    description: resource.description,
    blocks,
    version: resource.version || '1.0',
    updatedAt: resource.createdAt,
    effectiveDate: null,
    section: definition?.section || LEGAL_DOCUMENTS_BY_SLUG[slug]?.section || null,
    toc: buildLegalTocFromBlocks(blocks),
    contentHtml: null,
    renderMode: definition?.renderMode || 'legacy_resource',
    pdfConfig: {
      pageSize: 'A4',
      orientation: 'portrait',
    },
  };
}
