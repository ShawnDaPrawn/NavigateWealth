/**
 * Product Management Module - Routes
 * 
 * Product catalog and provider management:
 * - Provider management
 * - Product catalog
 * - Product integrations
 * - Product uploads
 */

import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
// Fixed import path - service should be in root now or we need to find where it is
import { ProductManagementService } from './product-management-service.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import {
  CreateProviderSchema,
  UpdateProviderSchema,
  CreateProductSchema,
  UpdateProductSchema,
  CreateIntegrationSchema,
} from './product-management-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const app = new Hono();
const log = createModuleLogger('product-management');
const service = new ProductManagementService();

// ============================================================================
// PROVIDERS
// ============================================================================

/**
 * GET /product-management/providers
 * Get all providers
 */
app.get('/providers', requireAuth, asyncHandler(async (c) => {
  const providers = await service.getAllProviders();
  
  return c.json({ providers });
}));

/**
 * POST /product-management/providers
 * Create new provider
 */
app.post('/providers', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const body = await c.req.json();
  const parsed = CreateProviderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  log.info('Creating provider', { adminUserId, providerName: parsed.data.name });
  
  const provider = await service.createProvider(parsed.data);
  
  log.success('Provider created', { providerId: provider.id });

  // Audit trail (non-blocking — §12.2)
  AdminAuditService.record({
    actorId: adminUserId,
    actorRole: c.get('userRole') || 'admin',
    category: 'configuration',
    action: 'provider_created',
    summary: `Provider created: ${parsed.data.name}`,
    severity: 'info',
    entityType: 'provider',
    entityId: provider.id,
  }).catch(() => {});

  return c.json({ provider }, 201);
}));

/**
 * POST /product-management/providers/migrate
 * Migrate legacy providers
 */
app.post('/providers/migrate', requireAdmin, asyncHandler(async (c) => {
  const result = await service.migrateLegacyProviders();
  return c.json(result);
}));

/**
 * PUT /product-management/providers/:id
 * Update provider
 */
app.put('/providers/:id', requireAdmin, asyncHandler(async (c) => {
  const providerId = c.req.param('id');
  const body = await c.req.json();
  const parsed = UpdateProviderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  const provider = await service.updateProvider(providerId, parsed.data);

  AdminAuditService.record({
    actorId: c.get('userId') || 'admin',
    actorRole: c.get('userRole') || 'admin',
    category: 'configuration',
    action: 'provider_updated',
    summary: `Provider updated`,
    severity: 'info',
    entityType: 'provider',
    entityId: providerId,
  }).catch(() => {});

  return c.json({ provider });
}));

/**
 * DELETE /product-management/providers/:id
 * Delete provider
 */
app.delete('/providers/:id', requireAdmin, asyncHandler(async (c) => {
  const providerId = c.req.param('id');
  
  await service.deleteProvider(providerId);

  AdminAuditService.record({
    actorId: c.get('userId') || 'admin',
    actorRole: c.get('userRole') || 'admin',
    category: 'configuration',
    action: 'provider_deleted',
    summary: `Provider deleted`,
    severity: 'warning',
    entityType: 'provider',
    entityId: providerId,
  }).catch(() => {});

  return c.json({ success: true });
}));

// ============================================================================
// PRODUCTS
// ============================================================================

/**
 * GET /product-management/products
 * Get all products
 */
app.get('/products', requireAuth, asyncHandler(async (c) => {
  const filters = {
    providerId: c.req.query('providerId'),
    category: c.req.query('category'),
    active: c.req.query('active') === 'true',
  };
  
  const products = await service.getAllProducts(filters);
  
  return c.json({ products });
}));

/**
 * GET /product-management/products/:id
 * Get product by ID
 */
app.get('/products/:id', requireAuth, asyncHandler(async (c) => {
  const productId = c.req.param('id');
  
  const product = await service.getProductById(productId);
  
  return c.json({ product });
}));

/**
 * POST /product-management/products
 * Create new product
 */
app.post('/products', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const body = await c.req.json();
  const parsed = CreateProductSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  log.info('Creating product', { adminUserId, productName: parsed.data.name });
  
  const product = await service.createProduct(parsed.data);
  
  log.success('Product created', { productId: product.id });

  AdminAuditService.record({
    actorId: adminUserId,
    actorRole: c.get('userRole') || 'admin',
    category: 'configuration',
    action: 'product_created',
    summary: `Product created: ${parsed.data.name}`,
    severity: 'info',
    entityType: 'product',
    entityId: product.id,
  }).catch(() => {});

  return c.json({ product }, 201);
}));

/**
 * PUT /product-management/products/:id
 * Update product
 */
app.put('/products/:id', requireAdmin, asyncHandler(async (c) => {
  const productId = c.req.param('id');
  const body = await c.req.json();
  const parsed = UpdateProductSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  const product = await service.updateProduct(productId, parsed.data);

  AdminAuditService.record({
    actorId: c.get('userId') || 'admin',
    actorRole: c.get('userRole') || 'admin',
    category: 'configuration',
    action: 'product_updated',
    summary: `Product updated`,
    severity: 'info',
    entityType: 'product',
    entityId: productId,
  }).catch(() => {});

  return c.json({ product });
}));

/**
 * DELETE /product-management/products/:id
 * Delete product
 */
app.delete('/products/:id', requireAdmin, asyncHandler(async (c) => {
  const productId = c.req.param('id');
  
  await service.deleteProduct(productId);

  AdminAuditService.record({
    actorId: c.get('userId') || 'admin',
    actorRole: c.get('userRole') || 'admin',
    category: 'configuration',
    action: 'product_deleted',
    summary: `Product deleted`,
    severity: 'warning',
    entityType: 'product',
    entityId: productId,
  }).catch(() => {});

  return c.json({ success: true });
}));

// ============================================================================
// INTEGRATIONS
// ============================================================================

/**
 * GET /product-management/integrations
 * Get all integrations
 */
app.get('/integrations', requireAdmin, asyncHandler(async (c) => {
  const integrations = await service.getAllIntegrations();
  
  return c.json({ integrations });
}));

/**
 * POST /product-management/integrations
 * Create integration
 */
app.post('/integrations', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const body = await c.req.json();
  const parsed = CreateIntegrationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  log.info('Creating integration', { adminUserId });
  
  const integration = await service.createIntegration(parsed.data);
  
  log.success('Integration created', { integrationId: integration.id });
  
  return c.json({ integration }, 201);
}));

/**
 * POST /product-management/integrations/:id/sync
 * Sync integration data
 */
app.post('/integrations/:id/sync', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const integrationId = c.req.param('id');
  
  log.info('Syncing integration', { adminUserId, integrationId });
  
  const result = await service.syncIntegration(integrationId);
  
  log.success('Integration synced', { integrationId });
  
  return c.json(result);
}));

// ============================================================================
// PRODUCT UPLOAD
// ============================================================================

/**
 * POST /product-management/upload
 * Upload product data (CSV/Excel)
 */
app.post('/upload', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  
  log.info('Uploading product data', { adminUserId, fileName: file?.name });
  
  const result = await service.uploadProducts(file);
  
  log.success('Products uploaded', { count: result.count });
  
  return c.json(result);
}));

export default app;