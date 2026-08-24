/**
 * Resources module — service layer.
 *
 * WHAT THIS FILE IS NOW
 * ---------------------
 * `ResourcesService` was a single 1,725-line class. It had no constructor and
 * no fields: every `this.` in it was a call to a sibling method, which made it
 * a namespace wearing a class's clothes. The three large regions inside it —
 * legal document reads, legal authoring, and the zip tools — turned out to
 * share nothing across their boundaries, so they now live in their own modules.
 *
 * What stays here is what did not belong to any of them: the RSS reader,
 * resource CRUD, and the calculator scenario store.
 *
 * WHY THE REST IS ASSIGNED RATHER THAN WRAPPED
 * -------------------------------------------
 * The moved functions are attached below as class fields rather than wrapped in
 * forwarding methods. `resources-routes.ts` constructs one instance and calls
 * `service.method(...)`, which behaves identically either way, and the
 * assignment form cannot drift from the implementation's signature the way a
 * hand-written forwarder can. `resources-service.characterization.test.ts` pins
 * that every routed name is still a callable function on an instance, and reads
 * the list of names off `resources-routes.ts` rather than keeping its own copy.
 *
 * One deletion, not a move: `ensureLegalDocumentDefinitions` was a private
 * method with no caller anywhere in the repository. It is gone.
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError, NotFoundError, APIError } from './error.middleware.ts';
import type { Resource, ResourceFilters } from './resources-types.ts';
import { generateId, parseRSStoJSON, type RSSItem } from './resources-helpers.ts';
import {
  getLegalDocument,
  getLegalDocumentAdmin,
  getLegalDocumentDefinition,
  getLegalDocumentPublic,
  listLegalDocumentDefinitions,
  listLegalDocumentVersions,
} from './resources-legal-read.ts';
import {
  archiveLegalDocumentVersion,
  createLegalDocumentDraft,
  duplicateLegalDocumentVersionToDraft,
  migrateLegacyLegalDocumentToDraft,
  migratePriorityLegacyLegalDocuments,
  publishLegalDocumentDraft,
  seedLegalDocuments,
  updateLegalDocumentDraft,
} from './resources-legal-authoring.ts';
import {
  cleanupOldZips,
  generateEncryptedZip,
  uploadChunk,
  uploadTempFile,
} from './resources-zip-service.ts';

const log = createModuleLogger('resources-service');

export class ResourcesService {
  /**
   * Fetch and parse RSS feed
   */
  async fetchRSSFeed(url: string): Promise<RSSItem[]> {
    log.info('Fetching RSS feed', { url });

    // Validate URL
    const allowedDomains = ['investing.com', 'za.investing.com', 'www.investing.com'];
    const parsedUrl = new URL(url);
    const isAllowed = allowedDomains.some(
      (domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`),
    );

    if (!isAllowed) {
      throw new ValidationError('URL domain not allowed');
    }

    try {
      // Fetch RSS feed
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new APIError(
          `Failed to fetch RSS feed: ${response.status} ${response.statusText}`,
          response.status,
          'RSS_FETCH_ERROR',
        );
      }

      const xmlText = await response.text();
      log.info('RSS feed fetched', { bytes: xmlText.length });

      // Parse to JSON
      const items = parseRSStoJSON(xmlText);

      log.success('RSS feed parsed', { items: items.length });

      return items;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof APIError) {
        throw error;
      }
      log.error('RSS feed fetch failed', error as Error);
      throw new APIError('Failed to fetch RSS feed', 500, 'RSS_FETCH_ERROR');
    }
  }

  /**
   * Get all resources
   */
  async getAllResources(filters?: Partial<ResourceFilters>): Promise<Resource[]> {
    const resources = await kv.getByPrefix('resource:');

    if (!resources || resources.length === 0) {
      return [];
    }

    let filtered = resources;

    // Apply category filter
    if (filters?.category) {
      filtered = filtered.filter((r: Resource) => r.category === filters.category);
    }

    // Sort by created date (newest first)
    filtered.sort(
      (a: Resource, b: Resource) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return filtered;
  }

  /**
   * Create resource
   */
  async createResource(data: Partial<Resource>): Promise<Resource> {
    const resourceId = generateId();

    const resource: Resource = {
      id: resourceId,
      title: data.title!,
      description: data.description,
      category: data.category || 'General',
      url: data.url,
      fileUrl: data.fileUrl,
      createdAt: new Date().toISOString(),
      blocks: data.blocks,
      clientTypes: data.clientTypes,
      version: data.version || '1.0',
      letterMeta: data.letterMeta,
    };

    await kv.set(`resource:${resourceId}`, resource);

    log.success('Resource created', { resourceId });

    return resource;
  }

  /**
   * Update resource
   */
  async updateResource(resourceId: string, updates: Partial<Resource>): Promise<Resource> {
    const resource = await kv.get(`resource:${resourceId}`);

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    Object.assign(resource, updates);

    await kv.set(`resource:${resourceId}`, resource);

    log.success('Resource updated', { resourceId });

    return resource;
  }

  /**
   * Delete resource
   */
  async deleteResource(resourceId: string): Promise<void> {
    await kv.del(`resource:${resourceId}`);

    log.success('Resource deleted', { resourceId });
  }

  /**
   * Duplicate resource
   * Creates a copy with a new ID, "Copy of" prefix, and draft status.
   * §14.1 — Non-destructive operation, creates new entry only.
   */
  async duplicateResource(resourceId: string): Promise<Resource> {
    const original = await kv.get(`resource:${resourceId}`);

    if (!original) {
      throw new NotFoundError('Resource not found');
    }

    const newId = generateId();
    const now = new Date().toISOString();

    const duplicate: Resource = {
      ...original,
      id: newId,
      title: `Copy of ${original.title}`,
      status: 'draft',
      createdAt: now,
    };

    await kv.set(`resource:${newId}`, duplicate);

    log.success('Resource duplicated', { originalId: resourceId, newId });

    return duplicate;
  }

  // ============================================================================
  // CALCULATOR SCENARIOS
  // ============================================================================

  /**
   * Save retirement scenario
   */
  async saveRetirementScenario(
    scenario: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!scenario.id) {
      scenario.id = generateId();
    }
    if (!scenario.createdAt) {
      scenario.createdAt = new Date().toISOString();
    }
    scenario.updatedAt = new Date().toISOString();

    const key = `calculator:retirement:client:${scenario.clientId}:${scenario.id}`;
    await kv.set(key, scenario);

    log.success('Retirement scenario saved', { id: scenario.id, clientId: scenario.clientId });
    return scenario;
  }

  /**
   * Get retirement scenarios for client
   */
  async getRetirementScenarios(clientId: string): Promise<Record<string, unknown>[]> {
    const prefix = `calculator:retirement:client:${clientId}`;
    const scenarios = (await kv.getByPrefix(prefix)) as Record<string, unknown>[];

    // Sort by updated date desc
    scenarios.sort(
      (a, b) =>
        new Date((b.updatedAt as string) || 0).getTime() -
        new Date((a.updatedAt as string) || 0).getTime(),
    );

    return scenarios;
  }

  /**
   * Delete retirement scenario
   */
  async deleteRetirementScenario(clientId: string, scenarioId: string): Promise<void> {
    const key = `calculator:retirement:client:${clientId}:${scenarioId}`;
    await kv.del(key);
    log.success('Retirement scenario deleted', { id: scenarioId, clientId });
  }

  // ==========================================================================
  // LEGAL DOCUMENTS — implementations in resources-legal-read.ts
  // ==========================================================================

  listLegalDocumentDefinitions = listLegalDocumentDefinitions;
  getLegalDocumentDefinition = getLegalDocumentDefinition;
  listLegalDocumentVersions = listLegalDocumentVersions;
  getLegalDocumentAdmin = getLegalDocumentAdmin;
  getLegalDocument = getLegalDocument;
  getLegalDocumentPublic = getLegalDocumentPublic;

  // ==========================================================================
  // LEGAL AUTHORING — implementations in resources-legal-authoring.ts
  // ==========================================================================

  createLegalDocumentDraft = createLegalDocumentDraft;
  updateLegalDocumentDraft = updateLegalDocumentDraft;
  publishLegalDocumentDraft = publishLegalDocumentDraft;
  archiveLegalDocumentVersion = archiveLegalDocumentVersion;
  duplicateLegalDocumentVersionToDraft = duplicateLegalDocumentVersionToDraft;
  migrateLegacyLegalDocumentToDraft = migrateLegacyLegalDocumentToDraft;
  migratePriorityLegacyLegalDocuments = migratePriorityLegacyLegalDocuments;
  seedLegalDocuments = seedLegalDocuments;

  // ==========================================================================
  // ZIP & ENCRYPT TOOLS — implementations in resources-zip-service.ts
  // ==========================================================================

  cleanupOldZips = cleanupOldZips;
  uploadTempFile = uploadTempFile;
  uploadChunk = uploadChunk;
  generateEncryptedZip = generateEncryptedZip;
}
