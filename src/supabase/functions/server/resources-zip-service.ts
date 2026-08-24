/**
 * Resource zip generation, chunked upload and temp-file storage.
 *
 * Moved wholesale out of `resources-service.ts`. This region owned the only
 * Supabase Storage access in the file — `getSupabase` and `BUCKET_NAME` are
 * referenced nowhere else — so it takes them with it, along with the two
 * streaming file adapters that exist to keep whole archives out of memory.
 *
 * `ensureBucket` stays module-private: it was private on the class and no
 * caller outside this file ever needed it.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { ZipWriter } from 'npm:@zip.js/zip.js';
import { createModuleLogger } from './stderr-logger.ts';
import { APIError } from './error.middleware.ts';
import { generateId } from './resources-helpers.ts';
import { assertPublicHttpUrlResolved } from './ssrf-guard.ts';

const log = createModuleLogger('resources-zip');

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
    try {
      this.file.close();
    } catch {
      // intentionally empty
    }
  }
}

// Lazy Supabase Admin Client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');

const BUCKET_NAME = 'make-91ed8379-resource-zips';

/**
 * Ensure bucket exists
 */
async function ensureBucket() {
  try {
    const { data: buckets } = await getSupabase().storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!exists) {
      log.info('Creating resource zips bucket', { bucket: BUCKET_NAME });
      await getSupabase().storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
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
export async function cleanupOldZips(): Promise<void> {
  await ensureBucket();

  try {
    const { data: files } = await getSupabase().storage.from(BUCKET_NAME).list();

    if (!files || files.length === 0) return;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const toDelete = files
      .filter((f) => f.created_at && new Date(f.created_at) < sevenDaysAgo)
      .map((f) => f.name);

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
export async function uploadTempFile(
  file: File,
  subcategory?: string,
): Promise<{ path: string; url: string }> {
  await ensureBucket();

  // Create a temp path: temp/{randomId}/{subcategory}/{filename}
  // We keep the structure here to make zipping easier later
  const runId = generateId();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const folder = subcategory ? `${subcategory}/` : '';
  const path = `temp/${runId}/${folder}${safeName}`;

  const { error } = await getSupabase().storage.from(BUCKET_NAME).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });

  if (error) throw error;

  // Get signed URL for the generator to access it (or internal access)
  // Actually, since we are in the same environment, the generator can just download it using the path.
  // But to keep the interface consistent (url based), we generate a signed URL.
  const { data: urlData, error: urlError } = await getSupabase()
    .storage.from(BUCKET_NAME)
    .createSignedUrl(path, 60 * 60 * 24); // 24 hours

  if (urlError) throw urlError;

  return { path, url: urlData.signedUrl };
}

/**
 * Upload chunk
 */
export async function uploadChunk(
  runId: string,
  index: number,
  chunk: File,
): Promise<{ path: string }> {
  await ensureBucket();

  const path = `chunks/${runId}/${index}`;

  const { error } = await getSupabase().storage.from(BUCKET_NAME).upload(path, chunk, {
    upsert: true,
    contentType: 'application/octet-stream',
  });

  if (error) throw error;

  return { path };
}

/**
 * Generate Encrypted Zip
 */
export async function generateEncryptedZip(
  files: Array<{
    name: string;
    url?: string;
    path?: string;
    folder?: string;
    runId?: string;
    chunkCount?: number;
  }>,
  password: string,
): Promise<{ downloadUrl: string }> {
  const MAX_EXTERNAL_FILE_BYTES = 25 * 1024 * 1024;
  const MAX_EXTERNAL_TOTAL_BYTES = 100 * 1024 * 1024;
  let externalTotalBytes = 0;

  await ensureBucket();

  // Create a temporary directory for this process
  const processId = generateId();
  const workDir = `/tmp/${processId}`;
  await Deno.mkdir(workDir, { recursive: true });

  const zipFilePath = `${workDir}/archive.zip`;

  // Use our custom file writer to stream output to disk
  // This prevents the growing Zip file from consuming all RAM
  // @ts-expect-error - ZipWriter expects a specific interface which we roughly satisfy
  const zipWriter = new ZipWriter(new DenoFileWriter(zipFilePath), {
    bufferedWrite: false, // Must be false for large files to stream without pre-buffering
    useWebWorkers: false,
    zip64: false,
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

        const tempFilePath = `${workDir}/${safeName}.tmp`;
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
                  const { data: signData, error: signError } = await getSupabase()
                    .storage.from(BUCKET_NAME)
                    .createSignedUrl(chunkPath, 600);

                  if (signError || !signData)
                    throw new Error(`Failed to sign chunk ${i}: ${signError?.message}`);

                  // 2. Fetch Stream
                  const response = await fetch(signData.signedUrl);
                  if (!response.ok || !response.body)
                    throw new Error(`Fetch failed: ${response.status}`);

                  // 3. Write to file manually
                  const reader = response.body.getReader();
                  let chunkBytesWritten = 0;
                  try {
                    while (true) {
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
                    log.warn(`Chunk ${i} retry (${retries} left)`, { error: String(err) });
                    await new Promise((r) => setTimeout(r, 1000));
                  }
                }
              }

              if (!success) throw lastError || new Error(`Failed to download chunk ${i}`);
            }

            // Cleanup chunks after all successful downloads
            // Fire and forget, but batched to save connections
            if (chunksToDelete.length > 0) {
              getSupabase()
                .storage.from(BUCKET_NAME)
                .remove(chunksToDelete)
                .catch((e) => log.warn('Chunk cleanup failed', { error: String(e) }));
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
                const { data: signData, error: signError } = await getSupabase()
                  .storage.from(BUCKET_NAME)
                  .createSignedUrl(file.path, 600);

                if (signError || !signData)
                  throw new Error(`Failed to sign file: ${signError?.message}`);

                const response = await fetch(signData.signedUrl);
                if (!response.ok || !response.body)
                  throw new Error(`Fetch failed: ${response.status}`);

                // Stream to temp file
                const reader = response.body.getReader();
                try {
                  while (true) {
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
                  log.warn(`Storage file retry (${retries} left)`, { error: String(err) });
                  await new Promise((r) => setTimeout(r, 1000));
                }
              }
            }

            if (!success)
              throw lastError || new Error(`Failed to download storage file: ${file.path}`);
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

                await assertPublicHttpUrlResolved(file.url);
                const response = await fetch(file.url, { redirect: 'manual' });
                if (!response.ok || !response.body)
                  throw new Error(`Fetch failed: ${response.status}`);
                const declaredLength = Number(response.headers.get('content-length') || 0);
                if (
                  declaredLength > MAX_EXTERNAL_FILE_BYTES ||
                  externalTotalBytes + declaredLength > MAX_EXTERNAL_TOTAL_BYTES
                ) {
                  throw new Error('External file exceeds download size limit');
                }

                // Stream to temp file
                const reader = response.body.getReader();
                let downloadedBytes = 0;
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    downloadedBytes += value.length;
                    if (
                      downloadedBytes > MAX_EXTERNAL_FILE_BYTES ||
                      externalTotalBytes + downloadedBytes > MAX_EXTERNAL_TOTAL_BYTES
                    ) {
                      await reader.cancel();
                      throw new Error('External file exceeds download size limit');
                    }
                    await tempFile.write(value);
                  }
                } catch (streamErr) {
                  await reader.cancel().catch(() => {});
                  throw streamErr;
                } finally {
                  reader.releaseLock();
                }
                externalTotalBytes += downloadedBytes;
                success = true;
              } catch (err) {
                lastError = err;
                retries--;
                if (retries > 0) {
                  log.warn(`URL file retry (${retries} left)`, { error: String(err) });
                  await new Promise((r) => setTimeout(r, 1000));
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
              // @ts-expect-error - Custom reader matches interface but not class
              await zipWriter.add(zipPath, fileReader, {
                level: 0,
                password: password,
                zipCrypto: true,
              });
            } finally {
              fileReader.close();
            }
          }
        } catch (e) {
          log.warn(`Failed to add ${file.name} to zip (Strategy: ${processingStrategy})`, {
            error: String(e),
          });
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
        const { data: uploadData, error: signError } = await getSupabase()
          .storage.from(BUCKET_NAME)
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
          duplex: 'half', // Required for streaming bodies
        } as RequestInit);

        if (!uploadResponse.ok) {
          const text = await uploadResponse.text();
          throw new Error(`Upload failed: ${uploadResponse.status} ${text}`);
        }

        uploadSuccess = true;
      } catch (err) {
        lastUploadError = err;
        uploadRetries--;
        if (uploadRetries > 0) {
          log.warn(`Upload attempt failed`, { error: String(err) });
          await new Promise((r) => setTimeout(r, 2000));
        }
      } finally {
        // Ensure we close the handle for this attempt
        try {
          zipFileHandle?.close();
        } catch {
          // intentionally empty
        }
      }
    }

    if (!uploadSuccess) {
      throw lastUploadError || new Error('Upload failed after retries');
    }

    // Generate Signed URL for download
    const { data: urlData, error: urlError } = await getSupabase()
      .storage.from(BUCKET_NAME)
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
