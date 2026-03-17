/**
 * Resources Module - Service Layer
 * Fresh file moved to root to fix bundling issues
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError, NotFoundError, APIError } from './error.middleware.ts';
import type { Resource, ResourceFilters } from './resources-types.ts';
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader, BlobReader, Reader, Writer } from "npm:@zip.js/zip.js";

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

  /**
   * Get a legal document by slug.
   * Reads the pointer `legal_form:{slug}` → resolves to `resource:{resourceId}`.
   */
  async getLegalDocument(slug: string): Promise<Resource | null> {
    const pointer = await kv.get(`legal_form:${slug}`);
    if (!pointer || !pointer.resourceId) {
      return null;
    }

    const resource = await kv.get(`resource:${pointer.resourceId}`);
    return resource || null;
  }

  /**
   * Seed all legal documents.
   * Creates a resource entry + pointer for each document in the registry.
   * Idempotent — skips documents that already have a valid pointer.
   *
   * @returns { seeded, skipped, total }
   */
  async seedLegalDocuments(
    registry: Array<{ slug: string; name: string; section: string; description: string }>,
  ): Promise<{ seeded: number; skipped: number; total: number }> {
    let seeded = 0;
    let skipped = 0;

    for (const doc of registry) {
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

      seeded++;
      log.info('Legal document seeded', { slug: doc.slug, resourceId });
    }

    log.success('Legal document seeding complete', { seeded, skipped, total: registry.length });
    return { seeded, skipped, total: registry.length };
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