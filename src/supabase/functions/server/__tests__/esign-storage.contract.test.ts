/**
 * esign-storage.ts — contract tests
 * =================================
 *
 * The storage layer under the e-signature evidence chain: where the original
 * document, the signature images, the completion certificate and the signer
 * attachments actually live. Under ECTA the stored artifact *is* the evidence,
 * so the properties worth pinning are the ones that protect it — the exact
 * object paths, whether an upload is allowed to overwrite what is already
 * there, and the guards that stop a signer writing outside their own prefix.
 *
 * Only the Supabase storage client is stubbed, by an in-memory bucket store
 * that records the options each call was made with. Everything else — path
 * construction, MIME and size gating, filename sanitisation, hashing, PDF
 * sniffing — is the real code.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type StoredObject = { body: Uint8Array; contentType?: string; upsert?: boolean };

const { store } = vi.hoisted(() => {
  // `getSupabase()` reads Deno.env at call time, so the global has to exist
  // before the module under test is imported.
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (key: string) => `test-${key}` },
  };
  return {
    store: {
      buckets: new Map<string, Map<string, StoredObject>>(),
      created: [] as Array<{ name: string; options: Record<string, unknown> }>,
      signedUrlCalls: [] as Array<{ bucket: string; path: string; expiresIn: number }>,
      uploadCalls: [] as Array<{ bucket: string; path: string; options: Record<string, unknown> }>,
      removeCalls: [] as Array<{ bucket: string; paths: string[] }>,
      /** Buckets that listBuckets() should claim already exist. */
      existing: new Set<string>(),
      listBucketsError: null as { message: string } | null,
      createBucketError: null as { message: string } | null,
      createBucketThrows: false,
      uploadError: null as { message: string } | null,
      uploadThrows: false,
      downloadError: null as { message: string } | null,
      downloadThrows: false,
      signedUrlError: null as { message: string } | null,
      removeError: null as { message: string } | null,
    },
  };
});

vi.mock('../stderr-logger.ts', async () => {
  const { makeLoggerMock } = await import('./helpers/contract-harness.ts');
  return makeLoggerMock();
});

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    storage: {
      listBuckets: async () =>
        store.listBucketsError
          ? { data: null, error: store.listBucketsError }
          : { data: [...store.existing].map((name) => ({ name })), error: null },
      createBucket: async (name: string, options: Record<string, unknown>) => {
        if (store.createBucketThrows) throw new Error('network down');
        store.created.push({ name, options });
        if (store.createBucketError) return { error: store.createBucketError };
        store.existing.add(name);
        return { error: null };
      },
      from: (bucket: string) => ({
        upload: async (path: string, body: Uint8Array, options: Record<string, unknown>) => {
          if (store.uploadThrows) throw new Error('socket closed');
          store.uploadCalls.push({ bucket, path, options });
          if (store.uploadError) return { error: store.uploadError };
          const objects = store.buckets.get(bucket) ?? new Map<string, StoredObject>();
          if (objects.has(path) && options.upsert !== true) {
            return { error: { message: 'The resource already exists' } };
          }
          objects.set(path, {
            body,
            contentType: options.contentType as string,
            upsert: options.upsert as boolean,
          });
          store.buckets.set(bucket, objects);
          return { error: null };
        },
        download: async (path: string) => {
          if (store.downloadThrows) throw new Error('socket closed');
          if (store.downloadError) return { data: null, error: store.downloadError };
          const object = store.buckets.get(bucket)?.get(path);
          if (!object) return { data: null, error: { message: 'Object not found' } };
          return { data: new Blob([object.body as unknown as BlobPart]), error: null };
        },
        createSignedUrl: async (path: string, expiresIn: number) => {
          store.signedUrlCalls.push({ bucket, path, expiresIn });
          if (store.signedUrlError) return { data: null, error: store.signedUrlError };
          return {
            data: { signedUrl: `https://storage.test/${bucket}/${path}?exp=${expiresIn}` },
            error: null,
          };
        },
        remove: async (paths: string[]) => {
          store.removeCalls.push({ bucket, paths });
          if (store.removeError) return { error: store.removeError };
          const objects = store.buckets.get(bucket);
          paths.forEach((path) => objects?.delete(path));
          return { error: null };
        },
      }),
    },
  }),
}));

import {
  ATTACHMENT_ALLOWED_MIME,
  ATTACHMENT_MAX_BYTES,
  calculateHash,
  deleteDocument,
  downloadAttachment,
  downloadCertificate,
  downloadDocument,
  extractPageCount,
  getAttachmentUrl,
  getCertificateUrl,
  getDocumentUrl,
  getSignatureUrl,
  initializeStorageBuckets,
  uploadAttachment,
  uploadCertificate,
  uploadDocument,
  uploadSignature,
  uploadSignedDocument,
  validateDocument,
} from '../esign-storage.ts';

const DOCUMENTS = 'make-91ed8379-esign-documents';
const SIGNATURES = 'make-91ed8379-esign-signatures';
const CERTIFICATES = 'make-91ed8379-esign-certificates';
const ATTACHMENTS = 'make-91ed8379-esign-attachments';

const bytes = (text: string) => new TextEncoder().encode(text);

/** A buffer that passes validateDocument's 1KB floor with a real PDF header. */
const pdfBuffer = (body = '') => bytes(`%PDF-1.7\n${body}${'%'.repeat(1024)}`);

const put = (bucket: string, path: string, body: Uint8Array) => {
  const objects = store.buckets.get(bucket) ?? new Map<string, StoredObject>();
  objects.set(path, { body });
  store.buckets.set(bucket, objects);
};

const lastUpload = () => store.uploadCalls[store.uploadCalls.length - 1];

beforeEach(() => {
  store.buckets.clear();
  store.created.length = 0;
  store.signedUrlCalls.length = 0;
  store.uploadCalls.length = 0;
  store.removeCalls.length = 0;
  store.existing.clear();
  store.listBucketsError = null;
  store.createBucketError = null;
  store.createBucketThrows = false;
  store.uploadError = null;
  store.uploadThrows = false;
  store.downloadError = null;
  store.downloadThrows = false;
  store.signedUrlError = null;
  store.removeError = null;
});

describe('initializeStorageBuckets', () => {
  it('creates all four buckets private, with per-bucket MIME allow-lists', async () => {
    await initializeStorageBuckets();

    expect(store.created.map((c) => c.name)).toEqual([
      DOCUMENTS,
      SIGNATURES,
      CERTIFICATES,
      ATTACHMENTS,
    ]);
    // Private is the whole point: a public bucket would put signed client
    // documents on a guessable URL.
    expect(store.created.every((c) => c.options.public === false)).toBe(true);
    expect(store.created.every((c) => c.options.fileSizeLimit === 50 * 1024 * 1024)).toBe(true);

    const byName = Object.fromEntries(store.created.map((c) => [c.name, c.options]));
    expect(byName[SIGNATURES].allowedMimeTypes).toEqual(['image/png', 'image/jpeg']);
    expect(byName[CERTIFICATES].allowedMimeTypes).toEqual(['application/pdf']);
    // The attachments bucket is the one a signer can write to, so its list is
    // images and PDFs only — no Office formats, which the documents bucket takes.
    expect(byName[ATTACHMENTS].allowedMimeTypes).toEqual([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/heic',
      'image/heif',
      'image/webp',
    ]);
    expect(byName[DOCUMENTS].allowedMimeTypes).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  it('leaves an existing bucket alone', async () => {
    store.existing.add(DOCUMENTS);

    await initializeStorageBuckets();

    expect(store.created.map((c) => c.name)).not.toContain(DOCUMENTS);
    expect(store.created).toHaveLength(3);
  });

  it('treats an "already exists" creation error as success', async () => {
    // Two Edge Function instances booting at once both try to create; the loser
    // must not fail the boot.
    store.createBucketError = { message: 'The resource already exists' };

    await expect(initializeStorageBuckets()).resolves.toBeUndefined();
    expect(store.created).toHaveLength(4);
  });

  it('still attempts creation when the bucket listing fails', async () => {
    store.listBucketsError = { message: 'service unavailable' };

    await initializeStorageBuckets();

    expect(store.created).toHaveLength(4);
  });

  it('carries on to the remaining buckets when one throws', async () => {
    store.createBucketThrows = true;

    await expect(initializeStorageBuckets()).resolves.toBeUndefined();
  });
});

describe('uploadDocument', () => {
  it('keys the object by firm and document id, keeping the file extension', async () => {
    const result = await uploadDocument('firm-1', 'doc-1', pdfBuffer(), 'Mandate.PDF');

    expect(result).toEqual({ path: 'firm-1/doc-1.pdf', error: null });
    expect(lastUpload()).toMatchObject({
      bucket: DOCUMENTS,
      path: 'firm-1/doc-1.pdf',
      options: { contentType: 'application/pdf', upsert: false },
    });
  });

  it('refuses to overwrite an existing document', async () => {
    // `upsert: false` is what makes the stored original immutable. Replacing it
    // would invalidate the hash recorded against the envelope.
    await uploadDocument('firm-1', 'doc-1', pdfBuffer('first'), 'a.pdf');

    const second = await uploadDocument('firm-1', 'doc-1', pdfBuffer('second'), 'a.pdf');

    expect(second.path).toBe('');
    expect(second.error).toMatch(/already exists/);
  });

  it('uses the whole filename as the extension when there is no dot', async () => {
    // `'mandate'.split('.').pop()` is `'mandate'`, which is truthy, so the
    // `|| 'pdf'` fallback never fires for a dotless name — only for a name that
    // ends in a bare dot. Cosmetic today (the object key is internal and the
    // stored path is what gets read back) but pinned as what actually happens
    // rather than what the fallback looks like it promises.
    await expect(uploadDocument('firm-1', 'doc-1', pdfBuffer(), 'mandate')).resolves.toMatchObject({
      path: 'firm-1/doc-1.mandate',
    });
    await expect(uploadDocument('firm-1', 'doc-2', pdfBuffer(), 'mandate.')).resolves.toMatchObject(
      { path: 'firm-1/doc-2.pdf' },
    );
  });

  it('reports the storage error rather than a bare failure', async () => {
    store.uploadError = { message: 'Payload too large' };

    await expect(uploadDocument('firm-1', 'doc-1', pdfBuffer(), 'a.pdf')).resolves.toEqual({
      path: '',
      error: 'Payload too large',
    });
  });

  it('survives a thrown transport error', async () => {
    store.uploadThrows = true;

    const result = await uploadDocument('firm-1', 'doc-1', pdfBuffer(), 'a.pdf');

    expect(result.path).toBe('');
    expect(result.error).toContain('socket closed');
  });
});

describe('the other upload paths', () => {
  it('stores one signature per signer per envelope, and lets a re-sign replace it', async () => {
    // upsert: true here is deliberate and different from documents: a signer who
    // redraws their signature before submitting replaces the image.
    const result = await uploadSignature('env-1', 'signer-1', bytes('png'));

    expect(result).toEqual({ path: 'env-1/signer-1_signature.png', error: null });
    expect(lastUpload().options).toMatchObject({ contentType: 'image/png', upsert: true });
    await expect(uploadSignature('env-1', 'signer-1', bytes('png2'))).resolves.toMatchObject({
      error: null,
    });
  });

  it('stores one certificate per envelope', async () => {
    const result = await uploadCertificate('env-1', pdfBuffer());

    expect(result).toEqual({ path: 'env-1/certificate.pdf', error: null });
    expect(lastUpload()).toMatchObject({
      bucket: CERTIFICATES,
      options: { contentType: 'application/pdf', upsert: true },
    });
  });

  it('files the signed document under a completed/ prefix in the documents bucket', async () => {
    const result = await uploadSignedDocument('env-1', pdfBuffer());

    expect(result).toEqual({
      path: 'completed/env-1/signed_document.pdf',
      error: null,
    });
    // The returned path must be the one actually written, or the envelope stores
    // a pointer to nothing.
    expect(lastUpload()).toMatchObject({
      bucket: DOCUMENTS,
      path: 'completed/env-1/signed_document.pdf',
    });
  });

  it('reports upload errors on the certificate and signed-document paths too', async () => {
    store.uploadError = { message: 'quota exceeded' };

    await expect(uploadCertificate('env-1', pdfBuffer())).resolves.toEqual({
      path: '',
      error: 'quota exceeded',
    });
    await expect(uploadSignedDocument('env-1', pdfBuffer())).resolves.toEqual({
      path: '',
      error: 'quota exceeded',
    });
    await expect(uploadSignature('env-1', 's-1', bytes('x'))).resolves.toEqual({
      path: '',
      error: 'quota exceeded',
    });
  });
});

describe('uploadAttachment', () => {
  const okMime = 'image/png';

  it('accepts an allowed type and namespaces the object by envelope', async () => {
    const result = await uploadAttachment('env-1', 'att-1', 'proof.png', bytes('png'), okMime);

    expect(result).toEqual({ path: 'env-1/att-1-proof.png', error: null });
    expect(lastUpload()).toMatchObject({
      bucket: ATTACHMENTS,
      options: { contentType: okMime, upsert: false },
    });
  });

  it('rejects a type outside the allow-list without touching storage', async () => {
    const result = await uploadAttachment(
      'env-1',
      'att-1',
      'payload.svg',
      bytes('<svg/>'),
      'image/svg+xml',
    );

    expect(result).toEqual({ path: '', error: 'Unsupported attachment type: image/svg+xml' });
    // Failing before the request is the point — an SVG is script-bearing markup
    // and must never reach a bucket a signed URL can serve.
    expect(store.uploadCalls).toHaveLength(0);
  });

  it('holds the allow-list to images and PDFs', async () => {
    expect([...ATTACHMENT_ALLOWED_MIME].sort()).toEqual([
      'application/pdf',
      'image/heic',
      'image/heif',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    expect(ATTACHMENT_ALLOWED_MIME.has('image/svg+xml')).toBe(false);
    expect(ATTACHMENT_ALLOWED_MIME.has('text/html')).toBe(false);
  });

  it('rejects an oversized attachment without touching storage', async () => {
    const result = await uploadAttachment(
      'env-1',
      'att-1',
      'huge.pdf',
      new Uint8Array(ATTACHMENT_MAX_BYTES + 1),
      'application/pdf',
    );

    expect(result).toEqual({ path: '', error: 'Attachment exceeds 25MB limit' });
    expect(store.uploadCalls).toHaveLength(0);
  });

  it('accepts an attachment exactly at the cap', async () => {
    const result = await uploadAttachment(
      'env-1',
      'att-1',
      'exact.pdf',
      new Uint8Array(ATTACHMENT_MAX_BYTES),
      'application/pdf',
    );

    expect(result.error).toBeNull();
  });

  it('strips path traversal out of the filename', async () => {
    const result = await uploadAttachment(
      'env-1',
      'att-1',
      '../../other-envelope/steal.png',
      bytes('png'),
      okMime,
    );

    // Every path-significant character is replaced, so the object cannot escape
    // the envelope's own prefix.
    expect(result.path).toBe('env-1/att-1-.._.._other-envelope_steal.png');
    expect(result.path.split('/')).toHaveLength(2);
    expect(result.path.startsWith('env-1/')).toBe(true);
  });

  it('replaces anything outside a safe character class', async () => {
    const result = await uploadAttachment(
      'env-1',
      'att-1',
      'ID проверка (2026)*.png',
      bytes('png'),
      okMime,
    );

    expect(result.path).toBe('env-1/att-1-ID___________2026__.png');
  });

  it('truncates a very long filename', async () => {
    const result = await uploadAttachment(
      'env-1',
      'att-1',
      `${'a'.repeat(200)}.png`,
      bytes('png'),
      okMime,
    );

    const safeName = result.path.slice('env-1/att-1-'.length);
    expect(safeName).toHaveLength(80);
  });

  it('reports the storage error and survives a thrown one', async () => {
    store.uploadError = { message: 'bucket missing' };
    await expect(
      uploadAttachment('env-1', 'att-1', 'a.png', bytes('png'), okMime),
    ).resolves.toEqual({ path: '', error: 'bucket missing' });

    store.uploadError = null;
    store.uploadThrows = true;
    const thrown = await uploadAttachment('env-1', 'att-1', 'a.png', bytes('png'), okMime);
    expect(thrown.error).toContain('socket closed');
  });
});

describe('downloads', () => {
  it('returns the stored bytes for each bucket', async () => {
    put(DOCUMENTS, 'firm-1/doc-1.pdf', bytes('document'));
    put(CERTIFICATES, 'env-1/certificate.pdf', bytes('certificate'));
    put(ATTACHMENTS, 'env-1/att-1-proof.png', bytes('attachment'));

    // Decoded rather than compared as Uint8Arrays: a view that came back
    // through a Blob is not `toEqual` a locally-constructed one under jsdom,
    // and the bytes are what matter here.
    const text = async (buffer: Uint8Array | null) =>
      buffer === null ? null : new TextDecoder().decode(buffer);

    await expect(text(await downloadDocument('firm-1/doc-1.pdf'))).resolves.toBe('document');
    await expect(text(await downloadCertificate('env-1/certificate.pdf'))).resolves.toBe(
      'certificate',
    );
    await expect(text(await downloadAttachment('env-1/att-1-proof.png'))).resolves.toBe(
      'attachment',
    );
  });

  it('returns null for a missing object rather than throwing', async () => {
    await expect(downloadDocument('nope')).resolves.toBeNull();
    await expect(downloadCertificate('nope')).resolves.toBeNull();
    await expect(downloadAttachment('nope')).resolves.toBeNull();
  });

  it('returns null when the transport throws', async () => {
    store.downloadThrows = true;

    await expect(downloadDocument('firm-1/doc-1.pdf')).resolves.toBeNull();
    await expect(downloadCertificate('env-1/certificate.pdf')).resolves.toBeNull();
    await expect(downloadAttachment('env-1/a.png')).resolves.toBeNull();
  });
});

describe('signed URLs', () => {
  it('signs each bucket for one hour', async () => {
    await getDocumentUrl('firm-1/doc-1.pdf');
    await getSignatureUrl('env-1/signer-1_signature.png');
    await getCertificateUrl('env-1/certificate.pdf');
    await getAttachmentUrl('env-1/att-1-proof.png');

    expect(store.signedUrlCalls).toEqual([
      { bucket: DOCUMENTS, path: 'firm-1/doc-1.pdf', expiresIn: 3600 },
      { bucket: SIGNATURES, path: 'env-1/signer-1_signature.png', expiresIn: 3600 },
      { bucket: CERTIFICATES, path: 'env-1/certificate.pdf', expiresIn: 3600 },
      { bucket: ATTACHMENTS, path: 'env-1/att-1-proof.png', expiresIn: 3600 },
    ]);
  });

  it('returns the signed URL it was given', async () => {
    await expect(getDocumentUrl('firm-1/doc-1.pdf')).resolves.toBe(
      `https://storage.test/${DOCUMENTS}/firm-1/doc-1.pdf?exp=3600`,
    );
  });

  it('returns null rather than a broken link when signing fails', async () => {
    store.signedUrlError = { message: 'object not found' };

    await expect(getDocumentUrl('x')).resolves.toBeNull();
    await expect(getSignatureUrl('x')).resolves.toBeNull();
    await expect(getCertificateUrl('x')).resolves.toBeNull();
    await expect(getAttachmentUrl('x')).resolves.toBeNull();
  });
});

describe('deleteDocument', () => {
  it('removes the object and reports success', async () => {
    put(DOCUMENTS, 'firm-1/doc-1.pdf', pdfBuffer());

    await expect(deleteDocument('firm-1/doc-1.pdf')).resolves.toBe(true);
    expect(store.removeCalls).toEqual([{ bucket: DOCUMENTS, paths: ['firm-1/doc-1.pdf'] }]);
    expect(store.buckets.get(DOCUMENTS)?.has('firm-1/doc-1.pdf')).toBe(false);
  });

  it('reports failure rather than claiming a delete that did not happen', async () => {
    store.removeError = { message: 'permission denied' };

    await expect(deleteDocument('firm-1/doc-1.pdf')).resolves.toBe(false);
  });
});

describe('calculateHash', () => {
  it('produces the standard SHA-256 hex digest', async () => {
    // Known-answer test rather than a self-consistent one: the stored hash is
    // the evidence that a signed document has not been altered, so it has to be
    // a real SHA-256 that an auditor can reproduce with any other tool.
    await expect(calculateHash(bytes('abc'))).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    await expect(calculateHash(new Uint8Array(0))).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('changes completely for a one-byte difference', async () => {
    const [a, b] = await Promise.all([calculateHash(bytes('abc')), calculateHash(bytes('abd'))]);

    expect(a).not.toBe(b);
  });
});

describe('extractPageCount', () => {
  it('counts page objects and ignores the /Pages tree node', async () => {
    const pdf = bytes(
      '%PDF-1.7\n/Type /Pages /Count 3\n/Type /Page /X\n/Type/Page /Y\n/Type /Page /Z\n',
    );

    expect(extractPageCount(pdf)).toBe(3);
  });

  it('defaults to one page when it cannot tell', async () => {
    // Better to record one page than zero: a zero would make the signing view
    // render nothing at all.
    expect(extractPageCount(bytes('not a pdf'))).toBe(1);
    expect(extractPageCount(new Uint8Array(0))).toBe(1);
  });

  it('does not count a page object that ends the buffer', async () => {
    // The regex requires a character after "/Page", so a document whose final
    // bytes are the page object undercounts. Pinned as a known limitation of
    // the deliberately-basic sniffer rather than presented as correct.
    expect(extractPageCount(bytes('/Type /Page'))).toBe(1);
  });
});

describe('validateDocument', () => {
  it('accepts a real PDF', () => {
    expect(validateDocument(pdfBuffer(), 'mandate.pdf')).toEqual({ valid: true });
  });

  it('rejects a file too small to be a document', () => {
    expect(validateDocument(bytes('%PDF-1.7'), 'tiny.pdf')).toEqual({
      valid: false,
      error: 'Invalid file: File too small',
    });
  });

  it('rejects a .pdf that is not a PDF', () => {
    const disguised = bytes(`<html>${'x'.repeat(1024)}</html>`);

    expect(validateDocument(disguised, 'mandate.pdf')).toEqual({
      valid: false,
      error: 'Invalid PDF file: Missing PDF header',
    });
  });

  it('rejects an extension outside pdf, doc and docx', () => {
    expect(validateDocument(new Uint8Array(2048), 'script.exe')).toEqual({
      valid: false,
      error: 'Unsupported file type. Only PDF and Word documents are allowed.',
    });
    expect(validateDocument(new Uint8Array(2048), 'noextension')).toMatchObject({ valid: false });
  });

  it('accepts anything at all under a .docx name, which is worth knowing', () => {
    // There is no content check for Word documents — only the extension and the
    // 1KB floor. The upload route then labels whatever arrives as
    // `application/pdf` when it stores it, so the bucket's MIME allow-list does
    // not catch it either. Pinned because it is the current behaviour, not
    // because it is right; tightening it is a product decision about whether
    // Word uploads are still a supported path.
    expect(validateDocument(new Uint8Array(2048), 'anything.docx')).toEqual({ valid: true });
    expect(validateDocument(new Uint8Array(2048), 'anything.doc')).toEqual({ valid: true });
  });

  it('is case-insensitive about the extension', () => {
    expect(validateDocument(pdfBuffer(), 'MANDATE.PDF')).toEqual({ valid: true });
  });
});
