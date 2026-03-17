/**
 * Product Management Module - Service Layer
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { ValidationError, NotFoundError } from './error.middleware.ts';
import type {
  Provider,
  Product,
  Integration,
  ProductFilters,
} from './product-management-types.ts';

const log = createModuleLogger('product-management-service');

// Helper to generate unique ID
function generateId(): string {
  return crypto.randomUUID();
}

export class ProductManagementService {
  
  // ========================================================================
  // PROVIDERS
  // ========================================================================
  
  /**
   * Get all providers
   *
   * Normalises legacy camelCase fields (categoryIds, logoUrl) to the canonical
   * snake_case shape (category_ids, logo_url) so that all downstream consumers
   * — including the PolicyFormDialog — receive consistent data regardless of
   * when/how the provider was originally created.
   */
  async getAllProviders(): Promise<Provider[]> {
    const providers = await kv.getByPrefix('provider:');
    
    if (!providers || providers.length === 0) {
      return [];
    }
    
    // Normalise legacy camelCase fields → canonical snake_case
    const normalised: Provider[] = providers.map((p: Record<string, unknown>) => ({
      ...p,
      // Belt-and-suspenders: accept both legacy camelCase and canonical snake_case
      category_ids: (p.category_ids as string[] | undefined) || (p.categoryIds as string[] | undefined) || [],
      logo_url: (p.logo_url as string | undefined) || (p.logoUrl as string | undefined) || undefined,
      contact_email: (p.contact_email as string | undefined) || (p.contactEmail as string | undefined) || undefined,
      contact_phone: (p.contact_phone as string | undefined) || (p.contactPhone as string | undefined) || undefined,
      is_active: p.is_active !== undefined ? p.is_active : (p.isActive !== undefined ? p.isActive : true),
    } as Provider));
    
    // Sort by name
    normalised.sort((a: Provider, b: Provider) => (a.name || '').localeCompare(b.name || ''));
    
    return normalised;
  }
  
  /**
   * Create provider
   */
  async createProvider(data: Partial<Provider>): Promise<Provider> {
    const providerId = generateId();
    const timestamp = new Date().toISOString();
    
    const provider: Provider = {
      id: providerId,
      name: data.name!,
      code: data.code!,
      type: data.type || 'insurance',
      description: data.description,
      category_ids: data.category_ids || [],
      logo_url: data.logo_url,
      website: data.website,
      contact_email: data.contact_email,
      contact_phone: data.contact_phone,
      is_active: data.is_active !== false,
      created_at: timestamp,
      updated_at: timestamp,
    };
    
    await kv.set(`provider:${providerId}`, provider);
    
    log.success('Provider created', { providerId, name: provider.name });
    
    return provider;
  }
  
  /**
   * Update provider
   *
   * Normalises legacy camelCase fields on write so that updated records
   * are always stored in the canonical snake_case shape.
   */
  async updateProvider(providerId: string, updates: Partial<Provider>): Promise<Provider> {
    const raw = await kv.get(`provider:${providerId}`);
    
    if (!raw) {
      throw new NotFoundError('Provider not found');
    }
    
    // Merge updates into existing data
    const merged = { ...raw, ...updates };
    
    // Normalise legacy camelCase → canonical snake_case and remove stale keys
    const provider: Provider = {
      id: merged.id,
      name: merged.name,
      code: merged.code,
      type: merged.type || 'other',
      description: merged.description,
      category_ids: merged.category_ids || merged.categoryIds || [],
      logo_url: merged.logo_url || merged.logoUrl || undefined,
      website: merged.website,
      contact_email: merged.contact_email || merged.contactEmail || undefined,
      contact_phone: merged.contact_phone || merged.contactPhone || undefined,
      is_active: merged.is_active !== undefined ? merged.is_active : (merged.isActive !== undefined ? merged.isActive : true),
      created_at: merged.created_at || merged.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    await kv.set(`provider:${providerId}`, provider);
    
    log.success('Provider updated', { providerId });
    
    return provider;
  }
  
  /**
   * Delete provider
   */
  async deleteProvider(providerId: string): Promise<void> {
    await kv.del(`provider:${providerId}`);
    
    log.success('Provider deleted', { providerId });
  }
  
  // ========================================================================
  // PRODUCTS
  // ========================================================================
  
  /**
   * Get all products
   */
  async getAllProducts(filters?: Partial<ProductFilters>): Promise<Product[]> {
    const products = await kv.getByPrefix('product:');
    
    if (!products || products.length === 0) {
      return [];
    }
    
    let filtered = products;
    
    // Apply filters
    if (filters?.providerId) {
      filtered = filtered.filter((p: Product) => p.provider_id === filters.providerId);
    }
    
    if (filters?.category) {
      filtered = filtered.filter((p: Product) => p.category === filters.category);
    }
    
    if (filters?.active !== undefined) {
      filtered = filtered.filter((p: Product) => p.is_active === filters.active);
    }
    
    // Sort by name
    filtered.sort((a: Product, b: Product) => a.name.localeCompare(b.name));
    
    return filtered;
  }
  
  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<Product> {
    const product = await kv.get(`product:${productId}`);
    
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    
    return product;
  }
  
  /**
   * Create product
   */
  async createProduct(data: Partial<Product>): Promise<Product> {
    const productId = generateId();
    const timestamp = new Date().toISOString();
    
    const product: Product = {
      id: productId,
      provider_id: data.provider_id!,
      name: data.name!,
      code: data.code!,
      category: data.category!,
      description: data.description,
      features: data.features || [],
      pricing: data.pricing,
      is_active: data.is_active !== false,
      metadata: data.metadata || {},
      created_at: timestamp,
      updated_at: timestamp,
    };
    
    await kv.set(`product:${productId}`, product);
    
    log.success('Product created', { productId, name: product.name });
    
    return product;
  }
  
  /**
   * Update product
   */
  async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
    const product = await this.getProductById(productId);
    
    Object.assign(product, updates);
    product.updated_at = new Date().toISOString();
    
    await kv.set(`product:${productId}`, product);
    
    log.success('Product updated', { productId });
    
    return product;
  }
  
  /**
   * Delete product
   */
  async deleteProduct(productId: string): Promise<void> {
    await kv.del(`product:${productId}`);
    
    log.success('Product deleted', { productId });
  }
  
  // ========================================================================
  // INTEGRATIONS
  // ========================================================================
  
  /**
   * Get all integrations
   */
  async getAllIntegrations(): Promise<Integration[]> {
    const integrations = await kv.getByPrefix('integration:');
    
    if (!integrations || integrations.length === 0) {
      return [];
    }
    
    // Sort by name
    integrations.sort((a: Integration, b: Integration) => a.name.localeCompare(b.name));
    
    return integrations;
  }
  
  /**
   * Create integration
   */
  async createIntegration(data: Partial<Integration>): Promise<Integration> {
    const integrationId = generateId();
    const timestamp = new Date().toISOString();
    
    const integration: Integration = {
      id: integrationId,
      name: data.name!,
      type: data.type!,
      provider_id: data.provider_id,
      config: data.config || {},
      is_active: data.is_active !== false,
      last_sync: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    
    await kv.set(`integration:${integrationId}`, integration);
    
    log.success('Integration created', { integrationId, name: integration.name });
    
    return integration;
  }
  
  /**
   * Sync integration data
   */
  async syncIntegration(integrationId: string): Promise<{ success: boolean; message: string }> {
    const integration = await kv.get(`integration:${integrationId}`);
    
    if (!integration) {
      throw new NotFoundError('Integration not found');
    }
    
    // TODO: Implement actual integration sync logic
    // This would call external APIs, fetch product data, etc.
    
    integration.last_sync = new Date().toISOString();
    integration.updated_at = new Date().toISOString();
    
    await kv.set(`integration:${integrationId}`, integration);
    
    log.success('Integration synced', { integrationId });
    
    return {
      success: true,
      message: 'Integration sync completed successfully',
    };
  }
  
  // ========================================================================
  // PRODUCT UPLOAD
  // ========================================================================
  
  /**
   * Upload products from file
   */
  async uploadProducts(file: File): Promise<{ success: boolean; count: number }> {
    if (!file) {
      throw new ValidationError('File is required');
    }
    
    // TODO: Implement CSV/Excel parsing
    // For now, return placeholder
    
    log.info('Processing product upload', { fileName: file.name, size: file.size });
    
    return {
      success: true,
      count: 0,
    };
  }

  /**
   * Migrate legacy providers from config:providers_list
   */
  async migrateLegacyProviders(): Promise<{ migrated: number; skipped: number; errors: string[] }> {
    const legacyProviders = await kv.get('config:providers_list') as unknown[];
    
    if (!legacyProviders || !Array.isArray(legacyProviders)) {
      return { migrated: 0, skipped: 0, errors: ['No legacy providers found'] };
    }

    let migrated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const p of legacyProviders) {
      try {
        // Check if exists in new system
        // We use the OLD ID to preserve config mapping compatibility
        const existing = await kv.get(`provider:${p.id}`);
        
        if (existing) {
          skipped++;
          continue;
        }

        const timestamp = new Date().toISOString();
        const newProvider: Provider = {
          id: p.id, // KEEP OLD ID
          name: p.name,
          code: p.id, // Use ID as code
          type: 'other', // Default type since legacy didn't have it
          description: p.description,
          category_ids: p.categoryIds || [], // Map camelCase to snake_case
          logo_url: p.logoUrl, // Map camelCase to snake_case
          is_active: true,
          created_at: timestamp,
          updated_at: timestamp,
        };

        await kv.set(`provider:${p.id}`, newProvider);
        migrated++;
        log.info(`Migrated provider: ${p.name} (${p.id})`);
      } catch (e) {
        const msg = getErrMsg(e);
        errors.push(`Failed to migrate ${p.id}: ${msg}`);
        log.error(`Migration failed for ${p.id}`, e);
      }
    }

    return { migrated, skipped, errors };
  }
}