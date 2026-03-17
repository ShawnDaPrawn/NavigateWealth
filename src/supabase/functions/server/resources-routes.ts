/**
 * Resources Module - Routes
 * Fresh file moved to root to fix bundling issues
 * 
 * Resource management and RSS feed proxy:
 * - RSS feed proxy for external content
 * - Resource library management
 * - External content integration
 */

import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin, requireSuperAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { ResourcesService } from './resources-service.ts';
import {
  CreateResourceSchema,
  UpdateResourceSchema,
  RetirementScenarioSchema,
} from './resources-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { AdminAuditService } from './admin-audit-service.ts';

const app = new Hono();
const log = createModuleLogger('resources');
const service = new ResourcesService();

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

  const resource = await service.getLegalDocument(slug);

  if (!resource) {
    return c.json({ available: false, slug }, 200);
  }

  return c.json({
    available: true,
    slug,
    document: {
      id: resource.id,
      title: resource.title,
      description: resource.description,
      blocks: resource.blocks || [],
      version: resource.version,
      updatedAt: resource.createdAt, // createdAt serves as last-modified for KV resources
    },
  });
}));

/**
 * POST /resources/legal/seed
 * Idempotent seeding of all legal document templates.
 * Admin-only.
 */
app.post('/legal/seed', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const body = await c.req.json();
  const registry = body.documents;

  if (!registry || !Array.isArray(registry)) {
    return c.json({ error: 'Request body must contain a "documents" array' }, 400);
  }

  const result = await service.seedLegalDocuments(registry);
  return c.json({ success: true, ...result });
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