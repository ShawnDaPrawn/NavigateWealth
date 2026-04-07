/**
 * Resources Module - Routes
 * Fresh file moved to root to fix bundling issues
 * 
 * Resource management and RSS feed proxy:
 * - RSS feed proxy for external content
 * - Resource library management
 * - External content integration
 */

import { Context, Hono } from 'npm:hono';
import { requireAuth, requireAdmin, requireSuperAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { ResourcesService } from './resources-service.ts';
import {
  CreateResourceSchema,
  UpsertLegalDocumentDraftSchema,
  UpdateResourceSchema,
  RetirementScenarioSchema,
} from './resources-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { AdminAuditService } from './admin-audit-service.ts';

const app = new Hono();
const log = createModuleLogger('resources');
const service = new ResourcesService();

function recordLegalAudit(
  c: Context,
  payload: {
    action: string;
    summary: string;
    entityId: string;
    severity?: 'info' | 'warning' | 'critical';
    metadata?: Record<string, unknown>;
  },
) {
  const actorId = c.get('userId') || 'admin';
  const actorRole = c.get('userRole') || 'admin';

  AdminAuditService.record({
    actorId,
    actorRole,
    category: 'configuration',
    action: payload.action,
    summary: payload.summary,
    severity: payload.severity || 'info',
    entityType: 'legal_document',
    entityId: payload.entityId,
    metadata: payload.metadata,
  }).catch(() => {});
}

// Health check — uses a distinct path to avoid colliding with the resource listing at GET /
app.get('/health', (c) => c.json({ service: 'resources', status: 'active' }));

// ============================================================================
// LEGAL DOCUMENTS — PUBLIC (no auth required)
// ============================================================================

/**
 * GET /resources/legal/:slug
 * Fetch a legal document by its well-known slug.
 * Used by the public-facing Legal & Compliance page.
 */
app.get('/legal/:slug', asyncHandler(async (c) => {
  const slug = c.req.param('slug');

  if (!slug?.trim()) {
    return c.json({ error: 'Slug parameter is required' }, 400);
  }

  const document = await service.getLegalDocumentPublic(slug);

  if (!document) {
    return c.json({ available: false, slug }, 200);
  }

  return c.json({
    available: true,
    slug,
    document,
  });
}));

/**
 * POST /resources/legal/seed
 * Idempotent seeding of all legal document templates.
 * Admin-only.
 */
app.post('/legal/seed', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const registry = Array.isArray(body.documents) ? body.documents : undefined;

  const result = await service.seedLegalDocuments(registry);
  return c.json({ success: true, ...result });
}));

/**
 * GET /resources/admin/legal-documents
 * Admin-only list of the new legal document definitions.
 * Milestone 1 foundation: powers the dedicated legal document admin shell.
 */
app.get('/admin/legal-documents', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const documents = await service.listLegalDocumentDefinitions();
  return c.json({ documents });
}));

/**
 * POST /resources/admin/legal-documents/migrate-priority
 * Create normalized migration drafts for the high-priority legacy legal documents.
 */
app.post('/admin/legal-documents/migrate-priority', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const userId = c.get('userId') || 'admin';
  const result = await service.migratePriorityLegacyLegalDocuments(userId);

  recordLegalAudit(c, {
    action: 'legal_document_priority_migration_started',
    summary: 'Priority legal document migration drafts created',
    entityId: 'priority-legal-migration',
    metadata: result,
  });

  return c.json(result);
}));

/**
 * GET /resources/admin/legal-documents/:slug
 * Admin-only detail view for a single legal document definition plus versions.
 */
app.get('/admin/legal-documents/:slug', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const slug = c.req.param('slug');
  const result = await service.getLegalDocumentAdmin(slug);

  if (!result) {
    return c.json({ error: 'Legal document not found' }, 404);
  }

  return c.json(result);
}));

/**
 * GET /resources/admin/legal-documents/:slug/versions
 * Admin-only version history endpoint.
 */
app.get('/admin/legal-documents/:slug/versions', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const slug = c.req.param('slug');
  const definition = await service.getLegalDocumentDefinition(slug);
  if (!definition) {
    return c.json({ error: 'Legal document not found' }, 404);
  }

  const versions = await service.listLegalDocumentVersions(slug);
  return c.json({ versions });
}));

/**
 * GET /resources/admin/legal-documents/:slug/audit
 * Admin-only audit history for a legal document.
 */
app.get('/admin/legal-documents/:slug/audit', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const slug = c.req.param('slug');
  const definition = await service.getLegalDocumentDefinition(slug);
  if (!definition) {
    return c.json({ error: 'Legal document not found' }, 404);
  }

  const limitParam = Number(c.req.query('limit') || '25');
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(100, limitParam)) : 25;
  const entries = await AdminAuditService.query({
    entityType: 'legal_document',
    entityId: slug,
    limit,
  });

  return c.json({ entries });
}));

/**
 * POST /resources/admin/legal-documents/:slug/migrate
 * Create a normalized migration draft from the legacy legal resource for review.
 */
app.post('/admin/legal-documents/:slug/migrate', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const slug = c.req.param('slug');
  const userId = c.get('userId') || 'admin';
  const result = await service.migrateLegacyLegalDocumentToDraft(slug, userId);

  recordLegalAudit(c, {
    action: 'legal_document_migration_draft_created',
    summary: `Legacy legal document migrated to draft: ${slug}`,
    entityId: slug,
    metadata: {
      draftVersionId: result?.currentDraftVersion?.id || null,
      publishedVersionId: result?.currentPublishedVersion?.id || null,
    },
  });

  return c.json(result);
}));

/**
 * POST /resources/admin/legal-documents/:slug/drafts
 * Create the active draft for a legal document.
 */
app.post('/admin/legal-documents/:slug/drafts', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const slug = c.req.param('slug');
  const userId = c.get('userId') || 'admin';
  const body = await c.req.json();
  const parsed = UpsertLegalDocumentDraftSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  const result = await service.createLegalDocumentDraft(slug, parsed.data, userId);
  recordLegalAudit(c, {
    action: 'legal_document_draft_created',
    summary: `Legal document draft created: ${slug}`,
    entityId: slug,
    metadata: {
      draftVersionId: result?.currentDraftVersion?.id || null,
      versionNumber: result?.currentDraftVersion?.versionNumber || parsed.data.versionNumber,
    },
  });
  return c.json(result);
}));

/**
 * PUT /resources/admin/legal-documents/:slug/versions/:versionId
 * Update the active draft version content and metadata.
 */
app.put('/admin/legal-documents/:slug/versions/:versionId', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const slug = c.req.param('slug');
  const versionId = c.req.param('versionId');
  const userId = c.get('userId') || 'admin';
  const body = await c.req.json();
  const parsed = UpsertLegalDocumentDraftSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  const result = await service.updateLegalDocumentDraft(slug, versionId, parsed.data, userId);
  recordLegalAudit(c, {
    action: 'legal_document_draft_updated',
    summary: `Legal document draft updated: ${slug}`,
    entityId: slug,
    metadata: {
      draftVersionId: versionId,
      versionNumber: parsed.data.versionNumber,
    },
  });
  return c.json(result);
}));

/**
 * POST /resources/admin/legal-documents/:slug/versions/:versionId/publish
 * Publish the active legal draft and switch the public slug to the versioned renderer.
 */
app.post('/admin/legal-documents/:slug/versions/:versionId/publish', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const slug = c.req.param('slug');
  const versionId = c.req.param('versionId');
  const userId = c.get('userId') || 'admin';

  const result = await service.publishLegalDocumentDraft(slug, versionId, userId);

  recordLegalAudit(c, {
    action: 'legal_document_published',
    summary: `Legal document published: ${slug}`,
    entityId: slug,
    metadata: { versionId },
  });

  return c.json(result);
}));

/**
 * POST /resources/admin/legal-documents/:slug/versions/:versionId/archive
 * Archive an inactive legal document version.
 */
app.post('/admin/legal-documents/:slug/versions/:versionId/archive', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const slug = c.req.param('slug');
  const versionId = c.req.param('versionId');
  const userId = c.get('userId') || 'admin';

  const result = await service.archiveLegalDocumentVersion(slug, versionId);

  recordLegalAudit(c, {
    action: 'legal_document_version_archived',
    summary: `Legal document version archived: ${slug}`,
    entityId: slug,
    metadata: { versionId },
  });

  return c.json(result);
}));

/**
 * POST /resources/admin/legal-documents/:slug/versions/:versionId/duplicate
 * Create a fresh working draft from any existing legal document version.
 */
app.post('/admin/legal-documents/:slug/versions/:versionId/duplicate', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const slug = c.req.param('slug');
  const versionId = c.req.param('versionId');
  const userId = c.get('userId') || 'admin';

  const result = await service.duplicateLegalDocumentVersionToDraft(slug, versionId, userId);

  recordLegalAudit(c, {
    action: 'legal_document_version_duplicated',
    summary: `Legal document draft created from version: ${slug}`,
    entityId: slug,
    metadata: { versionId },
  });

  return c.json(result);
}));

// ============================================================================
// RSS PROXY (Public)
// ============================================================================

/**
 * GET /resources/rss-proxy
 * Proxy RSS feeds and convert to JSON
 * Public endpoint for market data
 */
app.get('/rss-proxy', asyncHandler(async (c) => {
  const url = c.req.query('url');
  
  if (!url) {
    return c.json({ error: 'URL parameter is required' }, 400);
  }
  
  log.info('RSS proxy request', { url });
  
  const items = await service.fetchRSSFeed(url);
  
  return c.json({ items, count: items.length });
}));

// ============================================================================
// RESOURCE LIBRARY (Admin)
// ============================================================================

/**
 * GET /resources
 * Get all resources
 * Available to all authenticated users
 */
app.get('/', requireAuth, asyncHandler(async (c) => {
  const category = c.req.query('category');
  
  const resources = await service.getAllResources({ category });
  
  return c.json({ resources });
}));

/**
 * POST /resources
 * Create new resource
 * Available to authenticated users
 */
app.post('/', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = CreateResourceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  log.info('Creating resource', { userId });
  
  const resource = await service.createResource(parsed.data);
  
  log.success('Resource created', { resourceId: resource.id });

  // Audit trail (non-blocking — §12.2)
  AdminAuditService.record({
    actorId: userId,
    actorRole: 'admin',
    category: 'configuration',
    action: 'resource_created',
    summary: `Resource created: ${parsed.data.title || resource.id}`,
    severity: 'info',
    entityType: 'resource',
    entityId: resource.id,
  }).catch(() => {});
  
  return c.json({ resource });
}));

/**
 * PUT /resources/:id
 * Update resource
 * Available to authenticated users
 */
app.put('/:id', requireAuth, asyncHandler(async (c) => {
  const resourceId = c.req.param('id');
  const body = await c.req.json();
  const parsed = UpdateResourceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  const resource = await service.updateResource(resourceId, parsed.data);

  // Audit trail (non-blocking — §12.2)
  const userId = c.get('userId');
  AdminAuditService.record({
    actorId: userId,
    actorRole: 'admin',
    category: 'configuration',
    action: 'resource_updated',
    summary: `Resource updated`,
    severity: 'info',
    entityType: 'resource',
    entityId: resourceId,
  }).catch(() => {});
  
  return c.json({ resource });
}));

/**
 * DELETE /resources/:id
 * Delete resource
 */
app.delete('/:id', requireSuperAdmin, asyncHandler(async (c) => {
  const resourceId = c.req.param('id');
  
  await service.deleteResource(resourceId);

  // Audit trail (non-blocking — §12.2)
  const userId = c.get('userId');
  AdminAuditService.record({
    actorId: userId || 'super_admin',
    actorRole: 'super_admin',
    category: 'configuration',
    action: 'resource_deleted',
    summary: `Resource deleted`,
    severity: 'warning',
    entityType: 'resource',
    entityId: resourceId,
  }).catch(() => {});
  
  return c.json({ success: true });
}));

// ============================================================================
// DUPLICATE (Admin)
// ============================================================================

/**
 * POST /resources/:id/duplicate
 * Duplicate an existing resource
 */
app.post('/:id/duplicate', requireAuth, asyncHandler(async (c) => {
  const resourceId = c.req.param('id');
  const userId = c.get('userId');
  
  log.info('Duplicating resource', { resourceId, userId });
  
  const resource = await service.duplicateResource(resourceId);
  
  log.success('Resource duplicated', { originalId: resourceId, newId: resource.id });

  // Audit trail (non-blocking — §12.2)
  AdminAuditService.record({
    actorId: userId,
    actorRole: 'admin',
    category: 'configuration',
    action: 'resource_duplicated',
    summary: `Resource duplicated from ${resourceId}`,
    severity: 'info',
    entityType: 'resource',
    entityId: resource.id,
  }).catch(() => {});
  
  return c.json({ resource });
}));

/**
 * PATCH /resources/:id/status
 * Update resource status (draft/published/archived)
 */
app.patch('/:id/status', requireAuth, asyncHandler(async (c) => {
  const resourceId = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();
  const { status } = body;
  
  if (!status || !['draft', 'published', 'archived'].includes(status)) {
    return c.json({ error: 'Invalid status. Must be draft, published, or archived.' }, 400);
  }
  
  log.info('Updating resource status', { resourceId, status, userId });
  
  const resource = await service.updateResource(resourceId, { status });
  
  log.success('Resource status updated', { resourceId, status });

  // Audit trail (non-blocking — §12.2)
  AdminAuditService.record({
    actorId: userId,
    actorRole: 'admin',
    category: 'configuration',
    action: 'resource_status_changed',
    summary: `Resource status changed to ${status}`,
    severity: 'info',
    entityType: 'resource',
    entityId: resourceId,
  }).catch(() => {});
  
  return c.json({ resource });
}));

// ============================================================================
// CALCULATORS (Admin)
// ============================================================================

/**
 * GET /resources/calculators/retirement/scenarios/:clientId
 * Get retirement scenarios for a client
 */
app.get('/calculators/retirement/scenarios/:clientId', requireAuth, asyncHandler(async (c) => {
  const clientId = c.req.param('clientId');
  const scenarios = await service.getRetirementScenarios(clientId);
  return c.json({ scenarios });
}));

/**
 * POST /resources/calculators/retirement/scenarios
 * Save retirement scenario
 */
app.post('/calculators/retirement/scenarios', requireAuth, asyncHandler(async (c) => {
  const body = await c.req.json();
  const parsed = RetirementScenarioSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  const scenario = await service.saveRetirementScenario(parsed.data);
  return c.json({ scenario });
}));

/**
 * DELETE /resources/calculators/retirement/scenarios/:clientId/:scenarioId
 * Delete retirement scenario
 */
app.delete('/calculators/retirement/scenarios/:clientId/:scenarioId', requireAuth, asyncHandler(async (c) => {
  const clientId = c.req.param('clientId');
  const scenarioId = c.req.param('scenarioId');
  
  await service.deleteRetirementScenario(clientId, scenarioId);
  return c.json({ success: true });
}));

// ============================================================================
// TOOLS (Zip & Encrypt)
// ============================================================================

/**
 * POST /resources/zip-encrypt
 * Generate an encrypted zip file from a list of resources
 * Files are auto-deleted after 7 days
 */
app.post('/zip-encrypt', requireAuth, asyncHandler(async (c) => {
  const body = await c.req.json();
  const { files, password } = body;
  
  if (!files || !Array.isArray(files) || files.length === 0) {
    return c.json({ error: 'Files array is required' }, 400);
  }
  
  if (!password || password.length < 4) {
    return c.json({ error: 'Password is required (min 4 chars)' }, 400);
  }
  
  // Cleanup old files first (fire and forget)
  service.cleanupOldZips().catch(err => log.error('Cleanup failed', err));
  
  const result = await service.generateEncryptedZip(files, password);
  
  return c.json(result);
}));

/**
 * POST /resources/zip-encrypt/upload-chunk
 * Upload file chunk (bypasses 6MB body limit by chunking)
 */
app.post('/zip-encrypt/upload-chunk', requireAuth, asyncHandler(async (c) => {
  const body = await c.req.parseBody();
  const chunk = body['chunk'];
  const runId = body['runId'] as string;
  const index = parseInt(body['index'] as string);

  if (!chunk || !(chunk instanceof File)) {
    return c.json({ error: 'Chunk is required' }, 400);
  }
  if (!runId || isNaN(index)) {
    return c.json({ error: 'RunId and index are required' }, 400);
  }

  const result = await service.uploadChunk(runId, index, chunk);
  return c.json(result);
}));

// ============================================================================
// TRAINING (Sub-route)
// ============================================================================

/**
 * GET /resources/training
 * Get training resources (alias/filter for resources)
 */
app.get('/training', requireAuth, asyncHandler(async (c) => {
  const type = c.req.query('type');
  const category = c.req.query('category');
  const search = c.req.query('search');
  
  // Fetch all resources
  const resources = await service.getAllResources({ category });
  
  // Map to TrainingResource shape and filter
  // This is a simplified mapping to satisfy the frontend interface
  const trainingResources = resources
    .filter(r => {
        // Filter by search term if provided
        if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    })
    .map(r => ({
      id: r.id,
      title: r.title,
      type: (r.fileUrl || r.url) ? 'document' : 'video', // Simple heuristic
      category: r.category,
      duration: '5 min',
      description: r.description || '',
      difficulty: 'Beginner',
      views: 0,
      rating: 0,
      lastUpdated: r.createdAt,
      thumbnailUrl: '',
      url: r.fileUrl || r.url,
      tags: []
    }));
    
  return c.json(trainingResources);
}));

// ============================================================================
// KNOWLEDGE BASE (Sub-route)
// ============================================================================

/**
 * GET /resources/knowledge
 * Get knowledge base articles
 */
app.get('/knowledge', requireAuth, asyncHandler(async (c) => {
  const resources = await service.getAllResources({ category: 'Knowledge Base' });
  
  const articles = resources.map(r => ({
      id: r.id,
      title: r.title,
      category: r.category,
      description: r.description || '',
      tags: [],
      views: 0,
      helpful: 0,
      lastUpdated: r.createdAt,
      content: '',
      author: 'System'
  }));
  
  return c.json(articles);
}));

export default app;
