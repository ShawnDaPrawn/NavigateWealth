/**
 * Resources Module - Service Layer
 * Fresh file moved to root to fix bundling issues
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError, NotFoundError, APIError } from './error.middleware.ts';
import type {
  LegalDocumentDefinition,
  LegalDocumentVersion,
  Resource,
  ResourceFilters,
} from './resources-types.ts';
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader, BlobReader, Reader, Writer } from "npm:@zip.js/zip.js";
import {
  LEGAL_DOCUMENTS_BY_SLUG,
  LEGAL_MIGRATION_PRIORITY_SLUGS,
  LEGAL_DOCUMENTS_REGISTRY,
} from '../../../shared/legal-documents-registry.ts';

const log = createModuleLogger('resources-service');

// Helper class to write Zip directly to a Deno file to save memory
class DenoFileWriter {
  private file: Deno.FsFile;
  
  constructor(path: string) {
    this.file = Deno.openSync(path, { write: true, create: true, truncate: true });
  }
  
  async init() {}

  async writeUint8Array(array: Uint8Array) {
    let offset = 0;
    while (offset < array.length) {
      const written = await this.file.write(array.subarray(offset));
      offset += written;
    }
  }
  
  async getData() {
    this.file.close();
    return null;
  }
}

// Helper class to read from Deno file for zip.js to save memory
class DenoFileReader {
  private file: Deno.FsFile;
  public size: number;

  constructor(path: string) {
    this.file = Deno.openSync(path, { read: true });
    this.size = this.file.statSync().size;
  }

  async init() {}

  async readUint8Array(offset: number, length: number): Promise<Uint8Array> {
    await this.file.seek(offset, Deno.SeekMode.Start);
    const buffer = new Uint8Array(length);
    const readBytes = await this.file.read(buffer);
    if (readBytes === null) return new Uint8Array(0);
    return buffer.subarray(0, readBytes);
  }
  
  close() {
      try { this.file.close(); } catch {}
  }
}

// Lazy Supabase Admin Client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

const BUCKET_NAME = 'make-91ed8379-resource-zips';

// Helper to generate unique ID
function generateId(): string {
  return crypto.randomUUID();
}

function legalDefinitionKey(slug: string): string {
  return `legal_document_definition:${slug}`;
}

function legalVersionKey(slug: string, versionId: string): string {
  return `legal_document_version:${slug}:${versionId}`;
}

function incrementLegalVersion(versionNumber?: string | null): string {
  const fallback = '1.0';
  if (!versionNumber) return fallback;

  const match = versionNumber.trim().match(/^(\d+)\.(\d+)$/);
  if (!match) return versionNumber.trim() || fallback;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  return `${major}.${minor + 1}`;
}

function slugifyHeading(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/&nbsp;/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  return normalized || `section-${crypto.randomUUID().slice(0, 8)}`;
}

function sanitizeLegalHtml(sourceHtml: string): string {
  const withoutDangerousTags = sourceHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<\/?[a-z0-9_-]+:[^>]*>/gi, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, '');

  return withoutDangerousTags
    .replace(/\s+xmlns(:[a-z0-9_-]+)?="[^"]*"/gi, '')
    .replace(/\s+xmlns(:[a-z0-9_-]+)?='[^']*'/gi, '')
    .replace(/\s+xml:[a-z0-9_-]+="[^"]*"/gi, '')
    .replace(/\s+xml:[a-z0-9_-]+='[^']*'/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/\s+style="([^"]*)"/gi, (_, styles: string) => {
      const cleaned = styles
        .split(';')
        .map((rule) => rule.trim())
        .filter(Boolean)
        .filter((rule) => {
          const property = rule.split(':')[0]?.trim().toLowerCase() || '';
          return property.length > 0
            && !property.startsWith('mso-')
            && property !== 'tab-stops'
            && property !== 'layout-grid-mode'
            && property !== 'behavior';
        })
        .join('; ');

      return cleaned ? ` style="${cleaned}"` : '';
    })
    .replace(/\s+style='([^']*)'/gi, (_, styles: string) => {
      const cleaned = styles
        .split(';')
        .map((rule) => rule.trim())
        .filter(Boolean)
        .filter((rule) => {
          const property = rule.split(':')[0]?.trim().toLowerCase() || '';
          return property.length > 0
            && !property.startsWith('mso-')
            && property !== 'tab-stops'
            && property !== 'layout-grid-mode'
            && property !== 'behavior';
        })
        .join('; ');

      return cleaned ? ` style='${cleaned}'` : '';
    })
    .replace(/\u00a0/g, ' ')
    .trim();
}

function decodeLegalHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripLegalHtmlTags(value: string): string {
  return decodeLegalHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|section|article|li|tr|td|th|h1|h2|h3|h4|h5|h6)>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function upsertHeadingIdAttribute(attributes: string, id: string): string {
  if (!attributes.trim()) {
    return ` id="${id}"`;
  }

  if (/(\s|^)id\s*=\s*(['"])[^'"]*\2/i.test(attributes)) {
    return attributes.replace(/(\s|^)id\s*=\s*(['"])[^'"]*\2/i, (match, prefix) => `${prefix}id="${id}"`);
  }

  return `${attributes} id="${id}"`;
}

function normalizeLegalDocumentContent(sourceHtml: string) {
  const sanitizedHtml = sanitizeLegalHtml(sourceHtml || '');
  const seenIds = new Set<string>();
  const toc: Array<{ id: string; title: string; level: number }> = [];

  const normalizedHtml = (sanitizedHtml || '<p></p>').replace(
    /<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (_match, levelText: string, attributes: string, innerHtml: string) => {
      const title = stripLegalHtmlTags(innerHtml) || 'Untitled section';
      const level = Number(levelText);
      const existingIdMatch = attributes.match(/(?:\s|^)id\s*=\s*(['"])([^'"]+)\1/i);
      let id = existingIdMatch?.[2]?.trim() || slugifyHeading(title);

      while (seenIds.has(id)) {
        id = `${id}-${seenIds.size + 1}`;
      }

      seenIds.add(id);
      toc.push({ id, title, level });

      const nextAttributes = upsertHeadingIdAttribute(attributes || '', id);
      return `<h${levelText}${nextAttributes}>${innerHtml}</h${levelText}>`;
    },
  ).trim() || '<p></p>';

  const plainText = stripLegalHtmlTags(normalizedHtml);
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;

  return {
    sourceHtml: normalizedHtml,
    normalizedContent: {
      html: normalizedHtml,
      plainText,
      wordCount,
      headingCount: toc.length,
    },
    toc,
    blocks: [
      {
        id: generateId(),
        type: 'text',
        data: { content: normalizedHtml },
      },
    ],
  };
}

function buildLegalTocFromBlocks(blocks: Array<Record<string, unknown>> | undefined) {
  const seenIds = new Set<string>();

  return (blocks || [])
    .filter((block) => block?.type === 'section_header')
    .map((block, index) => {
      const data = (block.data || {}) as Record<string, unknown>;
      const number = typeof data.number === 'string' && data.number.trim() ? `${data.number.trim()} ` : '';
      const title = typeof data.title === 'string' && data.title.trim()
        ? `${number}${data.title.trim()}`.trim()
        : `Section ${index + 1}`;
      let id = slugifyHeading(title);

      while (seenIds.has(id)) {
        id = `${id}-${seenIds.size + 1}`;
      }

      seenIds.add(id);

      return {
        id,
        title,
        level: 2,
      };
    });
}

function escapeLegalHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function convertLegacyBlocksToLegalHtml(blocks: Array<Record<string, unknown>> | undefined, fallbackTitle: string) {
  const legacyBlocks = Array.isArray(blocks) ? blocks : [];
  const html = legacyBlocks
    .map((block, index) => {
      const type = typeof block?.type === 'string' ? block.type : '';
      const data = (block?.data || {}) as Record<string, unknown>;

      if (type === 'section_header') {
        const rawTitle = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : fallbackTitle;
        const number = typeof data.number === 'string' && data.number.trim() ? `${data.number.trim()} ` : '';
        const heading = `${number}${rawTitle}`.trim();
        return `<h2>${escapeLegalHtml(heading)}</h2>`;
      }

      if (type === 'text') {
        return typeof data.content === 'string' && data.content.trim() ? data.content.trim() : '';
      }

      if (type === 'page_break') {
        return '<div class="legal-page-break"></div>';
      }

      if (type === 'signature') {
        const signatories = Array.isArray(data.signatories) ? data.signatories : [];
        const signatureHtml = signatories.map((entry) => {
          const label = typeof entry === 'object' && entry && typeof (entry as Record<string, unknown>).label === 'string'
            ? String((entry as Record<string, unknown>).label)
            : 'Signature';

          return `
            <div class="legal-signature-line">
              <div class="line"></div>
              <span>${escapeLegalHtml(label)}</span>
            </div>
          `;
        }).join('');

        return signatureHtml ? `<div class="legal-signatures">${signatureHtml}</div>` : '';
      }

      if (type === 'field_grid') {
        const fields = Array.isArray(data.fields) ? data.fields : [];
        if (fields.length === 0) return '';

        const rows = fields.map((field) => {
          const label = typeof field === 'object' && field && typeof (field as Record<string, unknown>).label === 'string'
            ? String((field as Record<string, unknown>).label)
            : 'Field';

          return `<tr><th>${escapeLegalHtml(label)}</th><td></td></tr>`;
        }).join('');

        return `<table><tbody>${rows}</tbody></table>`;
      }

      if (type === 'table') {
        const hasRowHeaders = Boolean(data.hasRowHeaders);
        const hasColumnHeaders = Boolean(data.hasColumnHeaders);
        const columnHeaders = Array.isArray(data.columnHeaders) ? data.columnHeaders : [];
        const rowHeaders = Array.isArray(data.rowHeaders) ? data.rowHeaders : [];
        const rows = Array.isArray(data.rows) ? data.rows : [];

        const thead = hasColumnHeaders
          ? `<thead><tr>${hasRowHeaders ? '<th></th>' : ''}${columnHeaders.map((header) => `<th>${escapeLegalHtml(String(header || ''))}</th>`).join('')}</tr></thead>`
          : '';

        const tbody = rows.map((row, rowIndex) => {
          const record = (row || {}) as Record<string, unknown>;
          const cells = Array.isArray(record.cells) ? record.cells : [];
          const rowHeader = hasRowHeaders ? `<th>${escapeLegalHtml(String(rowHeaders[rowIndex] || ''))}</th>` : '';
          return `
            <tr>
              ${rowHeader}
              ${cells.map((cell) => {
                const value = typeof cell === 'object' && cell && typeof (cell as Record<string, unknown>).value === 'string'
                  ? String((cell as Record<string, unknown>).value)
                  : '';
                return `<td>${escapeLegalHtml(value)}</td>`;
              }).join('')}
            </tr>
          `;
        }).join('');

        return `<table>${thead}<tbody>${tbody}</tbody></table>`;
      }

      return index === 0 ? `<p></p>` : '';
    })
    .filter(Boolean)
    .join('\n');

  return html.trim() || `<h1>${escapeLegalHtml(fallbackTitle)}</h1><p></p>`;
}

// Interface for RSS items
interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

// Helper to parse RSS XML to JSON
function parseRSStoJSON(xmlText: string): RSSItem[] {
  try {
    const items: RSSItem[] = [];
    
    // Simple regex-based XML parsing (good enough for RSS)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const matches = xmlText.matchAll(itemRegex);
    
    for (const match of matches) {
      const itemXml = match[1];
      
      const title = itemXml.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const description = itemXml.match(/<description>(.*?)<\/description>/)?.[1] || '';
      const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      const guid = itemXml.match(/<guid.*?>(.*?)<\/guid>/)?.[1] || '';
      
      items.push({
        title: title.trim(),
        link: link.trim(),
        description: description.trim().replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
        pubDate: pubDate.trim(),
        guid: guid.trim(),
      });
    }
    
    return items;
  } catch (error) {
    log.error('Failed to parse RSS XML', error as Error);
    throw new APIError('Failed to parse RSS feed', 500, 'RSS_PARSE_ERROR');
  }
}

export class ResourcesService {
  
  /**
   * Fetch and parse RSS feed
   */
  async fetchRSSFeed(url: string): Promise<RSSItem[]> {
    log.info('Fetching RSS feed', { url });
    
    // Validate URL
    const allowedDomains = ['investing.com', 'za.investing.com', 'www.investing.com'];
    const parsedUrl = new URL(url);
    const isAllowed = allowedDomains.some(domain =>
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
    );
    
    if (!isAllowed) {
      throw new ValidationError('URL domain not allowed');
    }
    
    try {
      // Fetch RSS feed
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        },
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        throw new APIError(
          `Failed to fetch RSS feed: ${response.status} ${response.statusText}`,
          response.status,
          'RSS_FETCH_ERROR'
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
    filtered.sort((a: Resource, b: Resource) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
  // LEGAL DOCUMENTS
  // ============================================================================

  private async bootstrapLegalDocumentDefinition(
    entry: (typeof LEGAL_DOCUMENTS_REGISTRY)[number],
  ): Promise<LegalDocumentDefinition> {
    const pointer = await kv.get(`legal_form:${entry.slug}`);
    const legacyResource = pointer?.resourceId
      ? await kv.get(`resource:${pointer.resourceId}`) as Resource | null
      : null;
    const existing = await kv.get(legalDefinitionKey(entry.slug)) as LegalDocumentDefinition | null;
    if (existing) {
      const needsLegacyLink = legacyResource && existing.legacyResourceId !== legacyResource.id;
      const needsMetadataRefresh = (
        existing.title !== entry.name
        || existing.section !== entry.section
        || existing.description !== entry.description
        || (existing.migrationPriority || 'normal') !== (entry.migrationPriority || 'normal')
      );

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
          await this.bootstrapLegacyLegalDocumentVersion(nextDefinition, legacyResource);
        }
        return (await kv.get(legalDefinitionKey(entry.slug))) as LegalDocumentDefinition;
      }

      if (legacyResource && !existing.currentPublishedVersionId) {
        await this.bootstrapLegacyLegalDocumentVersion(existing, legacyResource);
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
      status: legacyResource ? (legacyResource.status || 'published') : 'draft',
      renderMode: legacyResource ? 'legacy_resource' : 'versioned_document',
      currentPublishedVersionId: null,
      currentDraftVersionId: null,
      legacyResourceId: legacyResource?.id || null,
      createdAt: now,
      updatedAt: now,
    };

    await kv.set(legalDefinitionKey(entry.slug), definition);

    if (legacyResource) {
      await this.bootstrapLegacyLegalDocumentVersion(definition, legacyResource);
    }

    return (await kv.get(legalDefinitionKey(entry.slug))) as LegalDocumentDefinition;
  }

  private async bootstrapLegacyLegalDocumentVersion(
    definition: LegalDocumentDefinition,
    legacyResource: Resource,
  ): Promise<void> {
    const existingVersions = await this.listLegalDocumentVersions(definition.slug);
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

  private async ensureLegalDocumentDefinitions(): Promise<void> {
    for (const entry of LEGAL_DOCUMENTS_REGISTRY) {
      await this.bootstrapLegalDocumentDefinition(entry);
    }
  }

  async listLegalDocumentDefinitions(): Promise<LegalDocumentDefinition[]> {
    let definitions = await kv.listByPrefix('legal_document_definition:') as Array<{
      key: string;
      value: LegalDocumentDefinition;
    }>;

    const existingSlugs = new Set(definitions.map((row) => row.value?.slug).filter(Boolean));
    const missingEntries = LEGAL_DOCUMENTS_REGISTRY.filter((entry) => !existingSlugs.has(entry.slug));

    if (missingEntries.length > 0) {
      for (const entry of missingEntries) {
        await this.bootstrapLegalDocumentDefinition(entry);
      }

      definitions = await kv.listByPrefix('legal_document_definition:') as Array<{
        key: string;
        value: LegalDocumentDefinition;
      }>;
    }

    const sectionOrder = new Map(
      ['legal-notices', 'privacy-data-protection', 'regulatory-disclosures', 'other']
        .map((section, index) => [section, index]),
    );

    return definitions
      .map((row) => row.value)
      .sort((a, b) => {
        const sectionDelta = (sectionOrder.get(a.section) ?? 99) - (sectionOrder.get(b.section) ?? 99);
        if (sectionDelta !== 0) return sectionDelta;
        return a.title.localeCompare(b.title);
      });
  }

  async getLegalDocumentDefinition(slug: string): Promise<LegalDocumentDefinition | null> {
    if (!LEGAL_DOCUMENTS_BY_SLUG[slug]) {
      return null;
    }

    const existing = await kv.get(legalDefinitionKey(slug)) as LegalDocumentDefinition | null;
    if (existing) {
      return existing;
    }

    await this.bootstrapLegalDocumentDefinition(LEGAL_DOCUMENTS_BY_SLUG[slug]);
    return await kv.get(legalDefinitionKey(slug)) as LegalDocumentDefinition | null;
  }

  async listLegalDocumentVersions(slug: string): Promise<LegalDocumentVersion[]> {
    const rows = await kv.listByPrefix(`legal_document_version:${slug}:`) as Array<{
      key: string;
      value: LegalDocumentVersion;
    }>;

    return rows
      .map((row) => row.value)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getLegalDocumentAdmin(slug: string): Promise<{
    definition: LegalDocumentDefinition;
    versions: LegalDocumentVersion[];
    currentPublishedVersion: LegalDocumentVersion | null;
    currentDraftVersion: LegalDocumentVersion | null;
  } | null> {
    const definition = await this.getLegalDocumentDefinition(slug);
    if (!definition) {
      return null;
    }

    const versions = await this.listLegalDocumentVersions(slug);
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

  async createLegalDocumentDraft(
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
    const definition = await this.getLegalDocumentDefinition(slug);
    if (!definition) {
      throw new NotFoundError('Legal document not found');
    }

    const existingDraft = definition.currentDraftVersionId
      ? await kv.get(legalVersionKey(slug, definition.currentDraftVersionId)) as LegalDocumentVersion | null
      : null;

    if (existingDraft) {
      return await this.updateLegalDocumentDraft(slug, existingDraft.id, input, actorId);
    }

    const normalized = normalizeLegalDocumentContent(input.sourceHtml);
    const now = new Date().toISOString();
    const versionId = generateId();
    const versions = await this.listLegalDocumentVersions(slug);
    const publishedVersion = definition.currentPublishedVersionId
      ? versions.find((version) => version.id === definition.currentPublishedVersionId) || null
      : null;

    const draftVersion: LegalDocumentVersion = {
      id: versionId,
      documentId: definition.id,
      slug,
      title: definition.title,
      section: definition.section,
      versionNumber: input.versionNumber.trim() || incrementLegalVersion(publishedVersion?.versionNumber),
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

    return await this.getLegalDocumentAdmin(slug);
  }

  async updateLegalDocumentDraft(
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
    const definition = await this.getLegalDocumentDefinition(slug);
    if (!definition) {
      throw new NotFoundError('Legal document not found');
    }

    const existingVersion = await kv.get(legalVersionKey(slug, versionId)) as LegalDocumentVersion | null;
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
      pdfConfig: input.pdfConfig || existingVersion.pdfConfig || {
        pageSize: 'A4',
        orientation: 'portrait',
      },
      createdBy: existingVersion.createdBy || actorId,
    };

    await Promise.all([
      kv.set(legalVersionKey(slug, versionId), updatedDraft),
      kv.set(legalDefinitionKey(slug), nextDefinition),
    ]);

    return await this.getLegalDocumentAdmin(slug);
  }

  async publishLegalDocumentDraft(
    slug: string,
    versionId: string,
    actorId: string,
  ) {
    const definition = await this.getLegalDocumentDefinition(slug);
    if (!definition) {
      throw new NotFoundError('Legal document not found');
    }

    if (definition.currentDraftVersionId !== versionId) {
      throw new ValidationError('Only the active draft can be published');
    }

    const draftVersion = await kv.get(legalVersionKey(slug, versionId)) as LegalDocumentVersion | null;
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
      throw new ValidationError('Add a meaningful change summary before publishing this legal document');
    }

    const now = new Date().toISOString();
    const writes: Promise<unknown>[] = [];

    if (definition.currentPublishedVersionId && definition.currentPublishedVersionId !== versionId) {
      const previousPublished = await kv.get(
        legalVersionKey(slug, definition.currentPublishedVersionId),
      ) as LegalDocumentVersion | null;

      if (previousPublished) {
        writes.push(kv.set(
          legalVersionKey(slug, previousPublished.id),
          {
            ...previousPublished,
            status: 'archived',
            updatedAt: now,
          } satisfies LegalDocumentVersion,
        ));
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
    return await this.getLegalDocumentAdmin(slug);
  }

  async archiveLegalDocumentVersion(
    slug: string,
    versionId: string,
  ) {
    const definition = await this.getLegalDocumentDefinition(slug);
    if (!definition) {
      throw new NotFoundError('Legal document not found');
    }

    if (definition.currentPublishedVersionId === versionId) {
      throw new ValidationError('Publish a replacement before archiving the current live version');
    }

    if (definition.currentDraftVersionId === versionId) {
      throw new ValidationError('Archive is only available for inactive versions');
    }

    const version = await kv.get(legalVersionKey(slug, versionId)) as LegalDocumentVersion | null;
    if (!version) {
      throw new NotFoundError('Legal document version not found');
    }

    if (version.status === 'archived') {
      return await this.getLegalDocumentAdmin(slug);
    }

    await kv.set(
      legalVersionKey(slug, versionId),
      {
        ...version,
        status: 'archived',
        updatedAt: new Date().toISOString(),
      } satisfies LegalDocumentVersion,
    );

    return await this.getLegalDocumentAdmin(slug);
  }

  async duplicateLegalDocumentVersionToDraft(
    slug: string,
    versionId: string,
    actorId: string,
  ) {
    const definition = await this.getLegalDocumentDefinition(slug);
    if (!definition) {
      throw new NotFoundError('Legal document not found');
    }

    const sourceVersion = await kv.get(legalVersionKey(slug, versionId)) as LegalDocumentVersion | null;
    if (!sourceVersion) {
      throw new NotFoundError('Legal document version not found');
    }

    const now = new Date().toISOString();
    const nextDraftId = generateId();
    const normalizedLegacyCopy = sourceVersion.contentFormat === 'legacy_blocks'
      ? normalizeLegalDocumentContent(convertLegacyBlocksToLegalHtml(sourceVersion.blocks, definition.title))
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
      normalizedContent: normalizedLegacyCopy ? normalizedLegacyCopy.normalizedContent : sourceVersion.normalizedContent,
      toc: normalizedLegacyCopy ? normalizedLegacyCopy.toc : sourceVersion.toc,
      changeSummary: sourceVersion.status === 'published'
        ? `Draft created from published version v${sourceVersion.versionNumber}.${normalizedLegacyCopy ? ' Converted from legacy builder content.' : ''}`
        : `Draft created from version v${sourceVersion.versionNumber}.${normalizedLegacyCopy ? ' Converted from legacy builder content.' : ''}`,
    };

    const writes: Promise<unknown>[] = [
      kv.set(legalVersionKey(slug, nextDraftId), nextDraft),
    ];

    if (definition.currentDraftVersionId) {
      const existingDraft = await kv.get(
        legalVersionKey(slug, definition.currentDraftVersionId),
      ) as LegalDocumentVersion | null;

      if (existingDraft) {
        writes.push(kv.set(
          legalVersionKey(slug, existingDraft.id),
          {
            ...existingDraft,
            status: 'archived',
            updatedAt: now,
          } satisfies LegalDocumentVersion,
        ));
      }
    }

    const nextDefinition: LegalDocumentDefinition = {
      ...definition,
      currentDraftVersionId: nextDraftId,
      updatedAt: now,
    };

    writes.push(kv.set(legalDefinitionKey(slug), nextDefinition));
    await Promise.all(writes);

    return await this.getLegalDocumentAdmin(slug);
  }

  private async getLegacyLegalResource(
    slug: string,
    definition?: LegalDocumentDefinition | null,
  ): Promise<Resource | null> {
    const activeDefinition = definition || await this.getLegalDocumentDefinition(slug);
    if (!activeDefinition) {
      return null;
    }

    if (activeDefinition.legacyResourceId) {
      const linkedResource = await kv.get(`resource:${activeDefinition.legacyResourceId}`) as Resource | null;
      if (linkedResource) {
        return linkedResource;
      }
    }

    const pointer = await kv.get(`legal_form:${slug}`);
    if (!pointer?.resourceId) {
      return null;
    }

    return await kv.get(`resource:${pointer.resourceId}`) as Resource | null;
  }

  async migrateLegacyLegalDocumentToDraft(
    slug: string,
    actorId: string,
  ) {
    const definition = await this.getLegalDocumentDefinition(slug);
    if (!definition) {
      throw new NotFoundError('Legal document not found');
    }

    const currentDraft = definition.currentDraftVersionId
      ? await kv.get(legalVersionKey(slug, definition.currentDraftVersionId)) as LegalDocumentVersion | null
      : null;

    if (currentDraft && currentDraft.contentFormat === 'normalized_rich_text') {
      return await this.getLegalDocumentAdmin(slug);
    }

    const legacyResource = await this.getLegacyLegalResource(slug, definition);
    if (!legacyResource) {
      throw new ValidationError('No legacy legal resource is available to migrate');
    }

    const versions = await this.listLegalDocumentVersions(slug);
    const publishedVersion = definition.currentPublishedVersionId
      ? versions.find((version) => version.id === definition.currentPublishedVersionId) || null
      : null;
    const legacySnapshot = publishedVersion?.contentFormat === 'legacy_blocks' ? publishedVersion : null;
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

    const writes: Promise<unknown>[] = [
      kv.set(legalVersionKey(slug, versionId), draftVersion),
    ];

    if (currentDraft) {
      writes.push(kv.set(
        legalVersionKey(slug, currentDraft.id),
        {
          ...currentDraft,
          status: 'archived',
          updatedAt: now,
        } satisfies LegalDocumentVersion,
      ));
    }

    const nextDefinition: LegalDocumentDefinition = {
      ...definition,
      currentDraftVersionId: versionId,
      updatedAt: now,
    };

    writes.push(kv.set(legalDefinitionKey(slug), nextDefinition));
    await Promise.all(writes);

    return await this.getLegalDocumentAdmin(slug);
  }

  async migratePriorityLegacyLegalDocuments(actorId: string): Promise<{
    migrated: string[];
    skipped: string[];
    failed: Array<{ slug: string; error: string }>;
  }> {
    const migrated: string[] = [];
    const skipped: string[] = [];
    const failed: Array<{ slug: string; error: string }> = [];

    for (const slug of LEGAL_MIGRATION_PRIORITY_SLUGS) {
      try {
        const definition = await this.getLegalDocumentDefinition(slug);
        if (!definition) {
          skipped.push(slug);
          continue;
        }

        if (definition.renderMode === 'versioned_document') {
          skipped.push(slug);
          continue;
        }

        const currentDraft = definition.currentDraftVersionId
          ? await kv.get(legalVersionKey(slug, definition.currentDraftVersionId)) as LegalDocumentVersion | null
          : null;

        if (currentDraft && currentDraft.contentFormat === 'normalized_rich_text') {
          skipped.push(slug);
          continue;
        }

        await this.migrateLegacyLegalDocumentToDraft(slug, actorId);
        migrated.push(slug);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown migration failure';
        failed.push({ slug, error: message });
      }
    }

    return { migrated, skipped, failed };
  }

  /**
   * Get a legal document by slug.
   * Reads the pointer `legal_form:{slug}` → resolves to `resource:{resourceId}`.
   */
  async getLegalDocument(slug: string): Promise<Resource | null> {
    const definition = await this.getLegalDocumentDefinition(slug);
    if (definition?.currentPublishedVersionId) {
      const version = await kv.get(
        legalVersionKey(slug, definition.currentPublishedVersionId),
      ) as LegalDocumentVersion | null;

      if (version && (definition.renderMode === 'versioned_document' || version.contentFormat === 'normalized_rich_text')) {
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

  async getLegalDocumentPublic(slug: string): Promise<{
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
    const definition = await this.getLegalDocumentDefinition(slug);

    if (definition?.currentPublishedVersionId) {
      const version = await kv.get(
        legalVersionKey(slug, definition.currentPublishedVersionId),
      ) as LegalDocumentVersion | null;

      if (version && (definition.renderMode === 'versioned_document' || version.contentFormat === 'normalized_rich_text')) {
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

    const resource = await this.getLegalDocument(slug);
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

  /**
   * Seed all legal documents.
   * Creates a resource entry + pointer for each document in the registry.
   * Idempotent — skips documents that already have a valid pointer.
   *
   * @returns { seeded, skipped, total }
   */
  async seedLegalDocuments(
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
        kv.set(`resource:${resourceId}`, { ...resource, legalSlug: doc.slug, legalSection: doc.section }),
        kv.set(`legal_form:${doc.slug}`, { resourceId, slug: doc.slug, name: doc.name, section: doc.section, createdAt: now }),
      ]);

      await this.bootstrapLegalDocumentDefinition({
        slug: doc.slug,
        name: doc.name,
        section: doc.section as (typeof LEGAL_DOCUMENTS_REGISTRY)[number]['section'],
        description: doc.description,
      });

      seeded++;
      log.info('Legal document seeded', { slug: doc.slug, resourceId });
    }

    log.success('Legal document seeding complete', { seeded, skipped, total: sourceRegistry.length });
    return { seeded, skipped, total: sourceRegistry.length };
  }

  // ============================================================================
  // CALCULATOR SCENARIOS
  // ============================================================================

  /**
   * Save retirement scenario
   */
  async saveRetirementScenario(scenario: Record<string, unknown>): Promise<Record<string, unknown>> {
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
    const scenarios = await kv.getByPrefix(prefix) as Record<string, unknown>[];
    
    // Sort by updated date desc
    scenarios.sort((a, b) => 
      new Date((b.updatedAt as string) || 0).getTime() - new Date((a.updatedAt as string) || 0).getTime()
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

  // ============================================================================
  // ZIP & ENCRYPT TOOLS
  // ============================================================================

  /**
   * Ensure bucket exists
   */
  private async ensureBucket() {
    try {
      const { data: buckets } = await getSupabase().storage.listBuckets();
      const exists = buckets?.some(b => b.name === BUCKET_NAME);
      
      if (!exists) {
        log.info('Creating resource zips bucket', { bucket: BUCKET_NAME });
        await getSupabase().storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: 52428800 // 50MB
        });
      }
    } catch (error) {
      log.error('Bucket check failed', error as Error);
      // Continue anyway, it might exist
    }
  }

  /**
   * Cleanup old zips (> 7 days)
   */
  async cleanupOldZips(): Promise<void> {
    await this.ensureBucket();
    
    try {
      const { data: files } = await getSupabase().storage.from(BUCKET_NAME).list();
      
      if (!files || files.length === 0) return;
      
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const toDelete = files
        .filter(f => f.created_at && new Date(f.created_at) < sevenDaysAgo)
        .map(f => f.name);
        
      if (toDelete.length > 0) {
        log.info('Cleaning up old zips', { count: toDelete.length });
        await getSupabase().storage.from(BUCKET_NAME).remove(toDelete);
      }
    } catch (error) {
      log.error('Cleanup failed', error as Error);
    }
  }

  /**
   * Upload temp file for zip generation
   */
  async uploadTempFile(file: File, subcategory?: string): Promise<{ path: string, url: string }> {
    await this.ensureBucket();
    
    // Create a temp path: temp/{randomId}/{subcategory}/{filename}
    // We keep the structure here to make zipping easier later
    const runId = generateId();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = subcategory ? `${subcategory}/` : '';
    const path = `temp/${runId}/${folder}${safeName}`;
    
    const { data, error } = await getSupabase().storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        upsert: false,
        contentType: file.type
      });
      
    if (error) throw error;
    
    // Get signed URL for the generator to access it (or internal access)
    // Actually, since we are in the same environment, the generator can just download it using the path.
    // But to keep the interface consistent (url based), we generate a signed URL.
    const { data: urlData, error: urlError } = await getSupabase().storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 60 * 60 * 24); // 24 hours
      
    if (urlError) throw urlError;
    
    return { path, url: urlData.signedUrl };
  }

  /**
   * Upload chunk
   */
  async uploadChunk(runId: string, index: number, chunk: File): Promise<{ path: string }> {
    await this.ensureBucket();
    
    const path = `chunks/${runId}/${index}`;
    
    const { error } = await getSupabase().storage
      .from(BUCKET_NAME)
      .upload(path, chunk, {
        upsert: true,
        contentType: 'application/octet-stream'
      });
      
    if (error) throw error;
    
    return { path };
  }

  /**
   * Generate Encrypted Zip
   */
  async generateEncryptedZip(files: Array<{ name: string, url?: string, path?: string, folder?: string, runId?: string, chunkCount?: number }>, password: string): Promise<{ downloadUrl: string }> {
    await this.ensureBucket();
    
    // Create a temporary directory for this process
    const processId = generateId();
    const workDir = `/tmp/${processId}`;
    await Deno.mkdir(workDir, { recursive: true });
    
    const zipFilePath = `${workDir}/archive.zip`;
    
    // Use our custom file writer to stream output to disk
    // This prevents the growing Zip file from consuming all RAM
    // @ts-ignore - ZipWriter expects a specific interface which we roughly satisfy
    const zipWriter = new ZipWriter(new DenoFileWriter(zipFilePath), {
      bufferedWrite: false, // Must be false for large files to stream without pre-buffering
      useWebWorkers: false,
      zip64: false
    });
    
    try {
      log.info(`Generating encrypted zip with ${files.length} files (WorkDir: ${workDir})`);

      // Download all files and add to zip
      for (const file of files) {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          
          // Determine path in zip
          let zipPath = safeName;
          if (file.folder) {
             const cleanFolder = file.folder.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
             zipPath = `${cleanFolder}/${safeName}`;
          }

          let tempFilePath = `${workDir}/${safeName}.tmp`;
          let processingStrategy = 'none';

          // Strategy 0: Chunked Uploads (Reconstruct to Disk)
          if (file.runId && file.chunkCount && file.chunkCount > 0) {
             processingStrategy = 'chunked';
             log.info(`Processing chunked file: ${file.name} (${file.chunkCount} chunks)`);
             
             const tempFile = await Deno.open(tempFilePath, { write: true, create: true });
             let currentValidOffset = 0;
             const chunksToDelete: string[] = [];
             
             try {
                 // Download and append chunks to disk
                 for (let i = 0; i < file.chunkCount; i++) {
                   const chunkPath = `chunks/${file.runId}/${i}`;
                   chunksToDelete.push(chunkPath);
                   
                   // Retry logic for the entire chunk operation
                   let retries = 3;
                   let success = false;
                   let lastError;
                   
                   while (retries > 0 && !success) {
                     try {
                        // 0. Reset to valid state (prevent corruption from partial writes)
                        await tempFile.seek(currentValidOffset, Deno.SeekMode.Start);
                        await tempFile.truncate(currentValidOffset);

                        // 1. Get Signed URL
                        const { data: signData, error: signError } = await getSupabase().storage
                            .from(BUCKET_NAME)
                            .createSignedUrl(chunkPath, 600);
                            
                        if (signError || !signData) throw new Error(`Failed to sign chunk ${i}: ${signError?.message}`);

                        // 2. Fetch Stream
                        const response = await fetch(signData.signedUrl);
                        if (!response.ok || !response.body) throw new Error(`Fetch failed: ${response.status}`);
                        
                        // 3. Write to file manually
                        const reader = response.body.getReader();
                        let chunkBytesWritten = 0;
                        try {
                            while(true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                await tempFile.write(value);
                                chunkBytesWritten += value.length;
                            }
                        } catch (streamErr) {
                            // Cancel stream to free connection immediately
                            await reader.cancel().catch(() => {});
                            throw streamErr;
                        } finally {
                            reader.releaseLock();
                        }
                        
                        // Success! Update valid offset.
                        currentValidOffset += chunkBytesWritten;
                        success = true;
                     } catch (err) {
                       lastError = err;
                       retries--;
                       if (retries > 0) {
                           log.warn(`Chunk ${i} retry (${retries} left)`, err as Error);
                           await new Promise(r => setTimeout(r, 1000));
                       }
                     }
                   }
                   
                   if (!success) throw lastError || new Error(`Failed to download chunk ${i}`);
                 }

                 // Cleanup chunks after all successful downloads
                 // Fire and forget, but batched to save connections
                 if (chunksToDelete.length > 0) {
                    getSupabase().storage.from(BUCKET_NAME).remove(chunksToDelete).catch(e => log.warn('Chunk cleanup failed', e));
                 }
             } finally {
                 // Always close the file handle
                 tempFile.close();
             }
          }
          // Strategy 1: Direct Storage Download (Stream to Disk)
          else if (file.path) {
             processingStrategy = 'storage';
             log.info(`Processing storage file: ${file.path}`);
             
             const tempFile = await Deno.open(tempFilePath, { write: true, create: true });
             
             let retries = 3;
             let success = false;
             let lastError;

             try {
                 while (retries > 0 && !success) {
                     try {
                         // Reset file position
                         await tempFile.seek(0, Deno.SeekMode.Start);
                         await tempFile.truncate(0);

                         // Get signed URL to stream download
                         const { data: signData, error: signError } = await getSupabase().storage
                            .from(BUCKET_NAME)
                            .createSignedUrl(file.path, 600);
                         
                         if (signError || !signData) throw new Error(`Failed to sign file: ${signError?.message}`);

                         const response = await fetch(signData.signedUrl);
                         if (!response.ok || !response.body) throw new Error(`Fetch failed: ${response.status}`);

                         // Stream to temp file
                         const reader = response.body.getReader();
                         try {
                             while(true) {
                                 const { done, value } = await reader.read();
                                 if (done) break;
                                 await tempFile.write(value);
                             }
                         } catch (streamErr) {
                             await reader.cancel().catch(() => {});
                             throw streamErr;
                         } finally {
                             reader.releaseLock();
                         }
                         success = true;
                     } catch (err) {
                         lastError = err;
                         retries--;
                         if (retries > 0) {
                             log.warn(`Storage file retry (${retries} left)`, err as Error);
                             await new Promise(r => setTimeout(r, 1000));
                         }
                     }
                 }
                 
                 if (!success) throw lastError || new Error(`Failed to download storage file: ${file.path}`);
             } finally {
                 tempFile.close();
             }
          }
          // Strategy 2: Fetch URL (Stream to Disk)
          else if (file.url) {
            processingStrategy = 'url';
            log.info(`Processing external file: ${file.url}`);
            
            const tempFile = await Deno.open(tempFilePath, { write: true, create: true });
            
            let retries = 3;
            let success = false;
            let lastError;

            try {
                while (retries > 0 && !success) {
                    try {
                        // Reset file position
                        await tempFile.seek(0, Deno.SeekMode.Start);
                        await tempFile.truncate(0);

                        const response = await fetch(file.url);
                        if (!response.ok || !response.body) throw new Error(`Fetch failed: ${response.status}`);

                        // Stream to temp file
                        const reader = response.body.getReader();
                        try {
                            while(true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                await tempFile.write(value);
                            }
                        } catch (streamErr) {
                            await reader.cancel().catch(() => {});
                            throw streamErr;
                        } finally {
                            reader.releaseLock();
                        }
                        success = true;
                    } catch (err) {
                        lastError = err;
                        retries--;
                        if (retries > 0) {
                            log.warn(`URL file retry (${retries} left)`, err as Error);
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                }
                
                if (!success) throw lastError || new Error(`Failed to download file URL: ${file.url}`);
            } finally {
                tempFile.close();
            }
          }
          
          // Add to Zip if we have a temp file
          try {
             const stat = await Deno.stat(tempFilePath);
             if (stat.isFile) {
                 // Use custom reader to stream from disk (saves RAM)
                 const fileReader = new DenoFileReader(tempFilePath);
                 try {
                    // @ts-ignore - Custom reader matches interface but not class
                    await zipWriter.add(zipPath, fileReader, {
                        level: 0,
                        password: password,
                        zipCrypto: true
                    });
                 } finally {
                    fileReader.close();
                 }
             }
          } catch (e) {
              log.warn(`Failed to add ${file.name} to zip (Strategy: ${processingStrategy})`, e as Error);
          }

        } catch (e) {
          log.error(`Error processing file ${file.name}`, e as Error);
        }
      }
      
      // Finalize Zip (closes the file writer)
      log.info('Finalizing zip...');
      await zipWriter.close();
      
      // Upload Zip from Disk (Streaming)
      const zipName = `secure-archive-${Date.now()}.zip`;
      
      // Retry strategy for upload
      let uploadRetries = 3;
      let uploadSuccess = false;
      let lastUploadError;

      while (uploadRetries > 0 && !uploadSuccess) {
          let zipFileHandle;
          try {
              // Open a fresh handle for each attempt to ensure the stream is fresh
              zipFileHandle = await Deno.open(zipFilePath, { read: true });
              const fileInfo = await zipFileHandle.stat();
              
              if (uploadRetries === 3) {
                  log.info(`Uploading final zip: ${zipName} (${fileInfo.size} bytes)`);
              } else {
                  log.info(`Retrying upload: ${zipName} (Attempt ${4 - uploadRetries})`);
              }

              // Create fresh upload URL each time
              const { data: uploadData, error: signError } = await getSupabase().storage
                .from(BUCKET_NAME)
                .createSignedUploadUrl(zipName);
                
              if (signError || !uploadData) {
                throw new Error(`Failed to create upload URL: ${signError?.message}`);
              }

              // Perform raw PUT request with stream
              const uploadResponse = await fetch(uploadData.signedUrl, {
                method: 'PUT',
                body: zipFileHandle.readable,
                headers: {
                  'Content-Type': 'application/zip',
                  'Content-Length': fileInfo.size.toString(),
                  'x-upsert': 'false',
                },
                duplex: 'half' // Required for streaming bodies
              });

              if (!uploadResponse.ok) {
                const text = await uploadResponse.text();
                throw new Error(`Upload failed: ${uploadResponse.status} ${text}`);
              }
              
              uploadSuccess = true;
          } catch (err) {
              lastUploadError = err;
              uploadRetries--;
              if (uploadRetries > 0) {
                  log.warn(`Upload attempt failed`, err as Error);
                  await new Promise(r => setTimeout(r, 2000));
              }
          } finally {
              // Ensure we close the handle for this attempt
              try { zipFileHandle?.close(); } catch {}
          }
      }

      if (!uploadSuccess) {
          throw lastUploadError || new Error('Upload failed after retries');
      }
      
      // Generate Signed URL for download
      const { data: urlData, error: urlError } = await getSupabase().storage
        .from(BUCKET_NAME)
        .createSignedUrl(zipName, 60 * 60 * 24);
        
      if (urlError) throw urlError;
      
      return { downloadUrl: urlData.signedUrl };
      
    } catch (error) {
      log.error('Zip generation failed', error as Error);
      throw new APIError('Failed to generate encrypted zip', 500, 'ZIP_ERROR');
    } finally {
      // Cleanup /tmp
      try {
        await Deno.remove(workDir, { recursive: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
