/**
 * Requests Module - Routes
 * 
 * Comprehensive request management system:
 * - Template management and versioning
 * - Request lifecycle workflows
 * - Compliance approval processes
 * - Audit trail tracking
 */

import { Hono } from 'npm:hono';
import type { Context } from 'npm:hono';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { RequestsService } from './requests-service.ts';
import type { RequestStatus, TemplateStatus } from './requests-types.ts';
import {
  CreateRequestTemplateSchema,
  UpdateRequestTemplateSchema,
  CreateRequestSchema,
  UpdateRequestSchema,
  MoveLifecycleSchema,
  ComplianceSignOffSchema,
} from './requests-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const app = new Hono();
const log = createModuleLogger('requests');
const service = new RequestsService();

// Helper to extract user from context
function getUserFromContext(c: Context): { id: string; name: string } {
  // Try to get user from Hono context set by middleware
  const user = c.get('user') as { id: string; user_metadata?: { name?: string } } | undefined;
  if (user) {
    return { id: user.id, name: user.user_metadata?.name || 'Admin User' };
  }
  
  // Fallback for requests without middleware context
  return { id: 'admin-user', name: 'Admin User' };
}

// ============================================================================
// CRITICAL: SPECIFIC ROUTES FIRST
// ============================================================================

/**
 * GET /requests/recent
 * Get recent requests (sorted by creation date)
 */
app.get('/recent', asyncHandler(async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  
  log.info('Fetching recent active requests', { limit });
  
  const allRequests = await service.getAllRequests({});
  
  // Define closed statuses (covering both frontend and backend type variations)
  const closedStatuses = ['closed', 'finalised', 'cancelled', 'completed'];

  // Filter for ACTIVE requests only, sort by creation date, and limit
  const recentRequests = allRequests
    .filter((req) => {
      const status = req.status?.toLowerCase() || '';
      return !closedStatuses.includes(status);
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA; // Descending order (newest first)
    })
    .slice(0, limit);
  
  return c.json({
    success: true,
    data: recentRequests,
    count: recentRequests.length,
  });
}));

/**
 * GET /requests/health
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'requests',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// TEMPLATE ROUTES
// ============================================================================

/**
 * GET /requests/templates
 * List all templates with optional filtering
 */
app.get('/templates', asyncHandler(async (c) => {
  const status = c.req.query('status');
  const category = c.req.query('category');
  
  const filters: { status?: string[]; category?: string[] } = {};
  if (status) filters.status = status.split(',');
  if (category) filters.category = category.split(',');
  
  log.info('Fetching templates', { filters });
  
  const templates = await service.getAllTemplates(filters);
  
  return c.json({
    success: true,
    data: templates,
    count: templates.length,
  });
}));

/**
 * GET /requests/templates/:id
 * Get a single template by ID
 */
app.get('/templates/:id', asyncHandler(async (c) => {
  const templateId = c.req.param('id');
  
  log.info('Fetching template', { templateId });
  
  const template = await service.getTemplateById(templateId);
  
  if (!template) {
    return c.json({
      success: false,
      error: 'Template not found',
    }, 404);
  }
  
  return c.json({
    success: true,
    data: template,
  });
}));

/**
 * POST /requests/templates
 * Create a new template
 */
app.post('/templates', asyncHandler(async (c) => {
  const user = getUserFromContext(c);
  const body = await c.req.json();
  const parsed = CreateRequestTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  log.info('Creating template', { userId: user.id });
  
  const template = await service.createTemplate(parsed.data, user.id, user.name);
  
  return c.json({
    success: true,
    data: template,
    message: 'Template created successfully',
  }, 201);
}));

/**
 * PUT /requests/templates/:id
 * Update an existing template
 */
app.put('/templates/:id', asyncHandler(async (c) => {
  const user = getUserFromContext(c);
  const templateId = c.req.param('id');
  const body = await c.req.json();
  const parsed = UpdateRequestTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  log.info('Updating template', { userId: user.id, templateId });
  
  const data = parsed.data as Record<string, unknown>;
  const createNewVersion = data.createNewVersion === true;
  delete data.createNewVersion;
  
  const template = await service.updateTemplate(
    templateId,
    data,
    user.id,
    user.name,
    createNewVersion
  );
  
  return c.json({
    success: true,
    data: template,
    message: createNewVersion ? 'New template version created' : 'Template updated successfully',
  });
}));

/**
 * POST /requests/templates/:id/duplicate
 * Duplicate a template
 */
app.post('/templates/:id/duplicate', asyncHandler(async (c) => {
  const user = getUserFromContext(c);
  const templateId = c.req.param('id');
  
  log.info('Duplicating template', { userId: user.id, templateId });
  
  const template = await service.duplicateTemplate(templateId, user.id, user.name);
  
  return c.json({
    success: true,
    data: template,
    message: 'Template duplicated successfully',
  }, 201);
}));

/**
 * DELETE /requests/templates/:id
 * Archive a template
 */
app.delete('/templates/:id', asyncHandler(async (c) => {
  const user = getUserFromContext(c);
  const templateId = c.req.param('id');
  
  log.info('Archiving template', { userId: user.id, templateId });
  
  const template = await service.archiveTemplate(templateId, user.id, user.name);
  
  return c.json({
    success: true,
    data: template,
    message: 'Template archived successfully',
  });
}));

// ============================================================================
// REQUEST LIST/CREATE ROUTES
// ============================================================================

/**
 * GET /requests
 * List all requests with optional filtering
 */
const listRequestsHandler = asyncHandler(async (c) => {
  const status = c.req.query('status');
  const templateId = c.req.query('templateId');
  const clientId = c.req.query('clientId');
  const assigneeId = c.req.query('assigneeId');
  
  const filters: { status?: RequestStatus[]; templateId?: string; clientId?: string; assigneeId?: string } = {};
  if (status) filters.status = status.split(',') as RequestStatus[];
  if (templateId) filters.templateId = templateId;
  if (clientId) filters.clientId = clientId;
  if (assigneeId) filters.assigneeId = assigneeId;
  
  log.info('Fetching requests', { filters });
  
  const requests = await service.getAllRequests(filters);
  
  return c.json({
    success: true,
    data: requests,
    count: requests.length,
  });
});

// Explicitly handle root path variations
app.get('/', listRequestsHandler);

/**
 * POST /requests
 * Create a new request from a template
 */
const createRequestHandler = asyncHandler(async (c) => {
  const user = getUserFromContext(c);
  const body = await c.req.json();
  const parsed = CreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  log.info('Creating request', { userId: user.id, templateId: parsed.data.templateId });
  
  const request = await service.createRequest(
    parsed.data.templateId,
    {
      clientId: parsed.data.clientId,
      clientName: parsed.data.clientName,
      requestDetails: parsed.data.requestDetails || {},
      assignees: parsed.data.assignees,
      priority: parsed.data.priority,
    },
    user.id,
    user.name
  );
  
  return c.json({
    success: true,
    data: request,
    message: 'Request created successfully',
  }, 201);
});

app.post('/', createRequestHandler);

/**
 * GET /requests/:id
 * Get a single request by ID
 */
app.get('/:id', asyncHandler(async (c) => {
  const requestId = c.req.param('id');
  
  // Skip if requestId matches specific known paths that might get here by mistake
  if (requestId === 'health' || requestId === 'templates' || requestId === 'recent') {
    log.warn('Incorrectly routed to /:id handler', { requestId });
    return c.notFound();
  }
  
  log.info('Fetching request', { requestId });
  
  const request = await service.getRequestById(requestId);
  
  if (!request) {
    return c.json({
      success: false,
      error: 'Request not found',
    }, 404);
  }
  
  return c.json({
    success: true,
    data: request,
  });
}));

/**
 * PUT /requests/:id
 * Update a request
 */
app.put('/:id', asyncHandler(async (c) => {
  const user = getUserFromContext(c);
  const requestId = c.req.param('id');
  const body = await c.req.json();
  const parsed = UpdateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  log.info('Updating request', { userId: user.id, requestId });
  
  const request = await service.updateRequest(requestId, parsed.data, user.id, user.name);
  
  return c.json({
    success: true,
    data: request,
    message: 'Request updated successfully',
  });
}));

/**
 * DELETE /requests/:id
 * Delete a request
 */
app.delete('/:id', asyncHandler(async (c) => {
  const user = getUserFromContext(c);
  const requestId = c.req.param('id');
  
  log.info('Deleting request', { userId: user.id, requestId });
  
  await service.deleteRequest(requestId, user.id, user.name);
  
  return c.json({
    success: true,
    message: 'Request deleted successfully',
  });
}));

/**
 * PATCH /requests/:id/lifecycle
 * Move request to a different lifecycle stage
 */
app.patch('/:id/lifecycle', asyncHandler(async (c) => {
  const user = getUserFromContext(c);
  const requestId = c.req.param('id');
  const body = await c.req.json();
  const parsed = MoveLifecycleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  log.info('Moving lifecycle stage', { userId: user.id, requestId, targetStageId: parsed.data.targetStageId });
  
  const request = await service.moveLifecycleStage(
    requestId,
    parsed.data.targetStageId,
    user.id,
    user.name,
    parsed.data.notes
  );
  
  return c.json({
    success: true,
    data: request,
    message: 'Lifecycle stage updated successfully',
  });
}));

/**
 * PATCH /requests/:id/compliance
 * Update compliance approval status
 */
app.patch('/:id/compliance', asyncHandler(async (c) => {
  const user = getUserFromContext(c);
  const requestId = c.req.param('id');
  const body = await c.req.json();
  
  log.info('Updating compliance approval', { userId: user.id, requestId });
  
  const request = await service.updateRequest(
    requestId,
    { complianceApproval: body.complianceApproval },
    user.id,
    user.name
  );
  
  return c.json({
    success: true,
    data: request,
    message: 'Compliance approval updated successfully',
  });
}));

/**
 * PATCH /requests/:id/sign-off
 * Compliance sign-off (approve/reject)
 */
app.patch('/:id/sign-off', asyncHandler(async (c) => {
  const user = getUserFromContext(c);
  const requestId = c.req.param('id');
  const body = await c.req.json();
  const parsed = ComplianceSignOffSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  log.info('Updating compliance sign-off', { userId: user.id, requestId, outcome: parsed.data.outcome });
  
  const request = await service.updateComplianceSignOff(
    requestId,
    parsed.data.outcome,
    user.id,
    user.name,
    parsed.data.deficiencies
  );
  
  return c.json({
    success: true,
    data: request,
    message: 'Compliance sign-off updated successfully',
  });
}));

/**
 * PATCH /requests/:id/finalise
 * Finalise a request
 */
app.patch('/:id/finalise', asyncHandler(async (c) => {
  const user = getUserFromContext(c);
  const requestId = c.req.param('id');
  
  log.info('Finalising request', { userId: user.id, requestId });
  
  const request = await service.finaliseRequest(requestId, user.id, user.name);
  
  return c.json({
    success: true,
    data: request,
    message: 'Request finalised successfully',
  });
}));

/**
 * GET /requests/:id/audit-log
 * Get audit log for a request
 */
app.get('/:id/audit-log', asyncHandler(async (c) => {
  const requestId = c.req.param('id');
  
  log.info('Fetching audit log', { requestId });
  
  const auditLog = await service.getAuditLog(requestId);
  
  return c.json({
    success: true,
    data: auditLog,
    count: auditLog.length,
  });
}));

export default app;