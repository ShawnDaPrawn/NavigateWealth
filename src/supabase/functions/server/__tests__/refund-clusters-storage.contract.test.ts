/**
 * locked/refund-clusters-routes.ts — Storage Contract
 * ==================================================
 *
 * The storage half of the refund-clusters route contract; the authorization and
 * audit matrix lives in `refund-clusters-routes.contract.test.ts`, and both
 * share `helpers/refund-clusters-harness.ts`.
 *
 * What this file protects:
 *
 *   - **Upload validation.** MIME type and file extension must BOTH be on the
 *     allowlist, which is the polyglot defence: a file declared
 *     `application/pdf` but named `.svg` renders as SVG (and runs its script)
 *     when a browser is handed the signed URL. Loosening the check to
 *     either-one-passes is a one-character change.
 *   - **Storage paths.** Objects are scoped to `cluster/entity/type/` and the
 *     filename is sanitised, so a crafted filename cannot walk into another
 *     cluster's folder.
 *   - **Delete ordering.** Every delete removes the stored FILES before dropping
 *     the records that hold their paths, because the path lives only in the
 *     metadata: drop it first and a failed file delete leaves an un-deletable
 *     copy of a client's ID document that nothing can ever name again. The
 *     invoice REPLACE path inverts this deliberately (upload first, so a failed
 *     upload never destroys the invoice the user still has). Both orderings are
 *     pinned, because both are the kind of thing a refactor "tidies" away.
 *   - **Signed URLs.** Five-minute TTL on links to private tax documents.
 *   - **Password reveal.** The narrowest route in the module: account-name
 *     validation before any decryption, and service statuses passed through
 *     rather than flattened to 500.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import {
  DEFAULT_TEST_USER,
  alignFileGlobal,
  multipart,
  request,
  type RequestOptions,
} from './helpers/contract-harness.ts';
import {
  BUCKET,
  CLUSTER,
  DOC,
  ENTITY,
  MAX_UPLOAD_BYTES,
  OLD_INVOICE_PATH,
  ROUTES,
  TXN,
  auditRecord,
  doc,
  invoiced,
  pdfUpload,
  resetRefundClusterMocks,
  storage,
  svc,
  txn,
  type Route,
} from './helpers/refund-clusters-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../locked/refund-clusters-service.ts', async () => ({
  RefundClustersService: (await import('./helpers/refund-clusters-harness.ts')).svc,
}));

vi.mock('../admin-audit-service.ts', async () => ({
  AdminAuditService: {
    record: (await import('./helpers/refund-clusters-harness.ts')).auditRecord,
  },
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', async () =>
  (await import('./helpers/refund-clusters-harness.ts')).makeSupabaseMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.mock('../quality-issues-runtime-server.ts', () => ({ scheduleRuntimeServerIssue: vi.fn() }));

/**
 * Role-aware stand-in for the real `requireSuperAdmin`, mirroring its two
 * decisions exactly: no credential → 401, wrong role → 403 with the shipped
 * code, and BOTH accepted spellings of super admin pass. Anything looser here
 * would make the authorization table vacuous.
 */
vi.mock('../auth-mw.ts', async () => ({
  requireSuperAdmin: (await import('./helpers/contract-harness.ts')).makeRoleGate(
    ['super_admin', 'super-admin'],
    'FORBIDDEN_SUPER_ADMIN',
  ),
}));

const app = (await import('../locked/refund-clusters-routes.ts')).default;

/** See `contract-harness.ts` for why the `File` global has to be realigned. */
beforeAll(async () => {
  await alignFileGlobal();
});

const req = (path: string, opts: RequestOptions = {}) =>
  request(app, path, { as: 'super_admin', ...opts });

const call = (r: Route, opts: RequestOptions = {}) =>
  req(r.path, {
    method: r.method,
    ...(r.form ? { form: pdfUpload() } : r.body !== undefined ? { body: r.body } : {}),
    ...opts,
  });

beforeEach(() => {
  vi.clearAllMocks();
  resetRefundClusterMocks();
});

// ============================================================================
// UPLOAD VALIDATION — what may be stored, and where it lands
// ============================================================================

const DOC_UPLOAD = `/${CLUSTER}/entities/${ENTITY}/documents`;
const INVOICE_UPLOAD = `/${CLUSTER}/entities/${ENTITY}/transactions/${TXN}/invoice`;

describe('upload validation', () => {
  it.each([
    ['application/pdf', 'x.pdf'],
    ['image/jpeg', 'x.jpg'],
    ['image/jpeg', 'x.jpeg'],
    ['image/png', 'x.png'],
    ['image/jpg', 'x.jpg'],
    ['application/pdf', 'X.PDF'],
  ])('accepts %s named %s', async (type, filename) => {
    const res = await req(DOC_UPLOAD, { method: 'POST', form: pdfUpload({ type, filename }) });
    expect(res.status).toBe(201);
  });

  it.each([
    ['text/html', 'evil.html'],
    ['application/javascript', 'evil.js'],
    ['application/octet-stream', 'payload.bin'],
    ['image/svg+xml', 'logo.svg'],
    ['application/x-msdownload', 'setup.exe'],
    ['', 'noextension'],
  ])('rejects %s named %s', async (type, filename) => {
    const res = await req(DOC_UPLOAD, { method: 'POST', form: pdfUpload({ type, filename }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Only PDF, JPEG and PNG files are allowed');
    expect(storage.upload).not.toHaveBeenCalled();
  });

  /**
   * The MIME type and the extension must BOTH be on the allowlist — the check
   * is an OR over the two failures, not an AND over the two successes. That is
   * the polyglot defence: a file declared `application/pdf` but named `.svg`
   * renders as SVG (and runs its script) when a browser is handed the signed
   * URL, and a file named `.pdf` but served as `text/html` does the same.
   * Loosening this to either-one-passes is a one-character change.
   */
  it.each([
    ['declared PDF, named .svg', 'application/pdf', 'invoice.svg'],
    ['declared PDF, named .html', 'application/pdf', 'invoice.html'],
    ['declared HTML, named .pdf', 'text/html', 'invoice.pdf'],
    ['declared SVG, named .png', 'image/svg+xml', 'logo.png'],
  ])('rejects a %s mismatch', async (_label, type, filename) => {
    const res = await req(DOC_UPLOAD, { method: 'POST', form: pdfUpload({ type, filename }) });
    expect(res.status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects a file over the 10MB limit', async () => {
    const res = await req(DOC_UPLOAD, {
      method: 'POST',
      form: pdfUpload({ bytes: 'x'.repeat(MAX_UPLOAD_BYTES + 1) }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('File exceeds the 10MB limit');
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('accepts a file exactly at the 10MB limit', async () => {
    // The comparison is `>` — a file of exactly 10MB is allowed. Pinned so a
    // change to `>=` is a test failure rather than a support ticket.
    const res = await req(DOC_UPLOAD, {
      method: 'POST',
      form: pdfUpload({ bytes: 'x'.repeat(MAX_UPLOAD_BYTES) }),
    });
    expect(res.status).toBe(201);
  });

  it('requires a documentType', async () => {
    const res = await req(DOC_UPLOAD, { method: 'POST', form: pdfUpload({ documentType: '' }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('documentType is required');
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it.each([
    ['document', DOC_UPLOAD],
    ['invoice', INVOICE_UPLOAD],
  ])('rejects a %s request with no file part', async (_label, path) => {
    const res = await req(path, {
      method: 'POST',
      form: multipart([{ name: 'documentType', value: 'vat' }]),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('No file uploaded');
  });

  it('rejects a text field posing as the file part', async () => {
    // `body['file']` is a string when the part carries no filename. The route
    // guards with `instanceof File`; a truthiness check alone would let a
    // caller drive `file.name`/`file.type` off a plain string.
    const res = await req(DOC_UPLOAD, {
      method: 'POST',
      form: multipart([
        { name: 'file', value: 'not-a-file' },
        { name: 'documentType', value: 'vat' },
      ]),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('No file uploaded');
  });

  it('refuses to upload into an entity that does not exist', async () => {
    // Checked BEFORE the upload, so a bad entity id cannot create a folder.
    svc.getEntityRaw.mockResolvedValue(null);
    const res = await req(DOC_UPLOAD, { method: 'POST', form: pdfUpload() });
    expect(res.status).toBe(404);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(svc.saveDocument).not.toHaveBeenCalled();
  });
});

describe('storage paths', () => {
  it('scopes a document to its cluster, entity and document type', async () => {
    await req(DOC_UPLOAD, {
      method: 'POST',
      form: pdfUpload({ filename: 'vat201.pdf', documentType: 'vat_return' }),
    });
    const [path, , options] = storage.upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${CLUSTER}/${ENTITY}/vat_return/\\d+_vat201\\.pdf$`));
    // `upsert: false` keeps a second upload from overwriting the first — the
    // timestamp prefix already makes every path unique, and a collision that
    // silently replaced a stored tax document would be unrecoverable.
    expect(options).toMatchObject({ contentType: 'application/pdf', upsert: false });
  });

  it('cannot be walked out of its folder by a crafted filename', async () => {
    // `../../` passes the extension and MIME checks untouched — the sanitiser
    // is the only thing standing between a crafted filename and another
    // cluster's folder. It keeps dots (extensions need them) and strips the
    // separator, which is the half that carries the traversal: what is left is
    // a literal object name, not a walk. The invariant is therefore about
    // SEGMENTS, not about the string `..`.
    await req(DOC_UPLOAD, {
      method: 'POST',
      form: pdfUpload({ filename: '../../other-cluster/steal.pdf' }),
    });
    const [path] = storage.upload.mock.calls[0];
    const segments = path.split('/');
    expect(segments.slice(0, 3)).toEqual([CLUSTER, ENTITY, 'vat']);
    expect(segments).toHaveLength(4);
    expect(segments[3]).not.toContain('/');
    expect(path).not.toContain('other-cluster/');
  });

  it.each([
    ['a POSIX separator', 'a/b.pdf'],
    ['a Windows separator', 'a\\b.pdf'],
    ['a leading slash', '/etc/passwd.pdf'],
    ['a null byte', 'a\u0000b.pdf'],
    ['a percent-encoded separator', 'a%2Fb.pdf'],
  ])('strips %s from the stored object name', async (_label, filename) => {
    await req(DOC_UPLOAD, { method: 'POST', form: pdfUpload({ filename }) });
    const [path] = storage.upload.mock.calls[0];
    expect(path.split('/')).toHaveLength(4);
    expect(path.startsWith(`${CLUSTER}/${ENTITY}/vat/`)).toBe(true);
  });

  it('scopes an invoice to its transaction', async () => {
    await req(INVOICE_UPLOAD, { method: 'POST', form: pdfUpload({ filename: 'inv.pdf' }) });
    const [path] = storage.upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${CLUSTER}/${ENTITY}/transactions/${TXN}/\\d+_inv\\.pdf$`));
  });

  it('records the untouched original filename alongside the sanitised path', async () => {
    // The user should still see "VAT 201 (2026).pdf" on download even though
    // the stored path cannot contain spaces or parentheses.
    await req(DOC_UPLOAD, { method: 'POST', form: pdfUpload({ filename: 'VAT 201 (2026).pdf' }) });
    expect(svc.saveDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'VAT 201 (2026).pdf', uploadedBy: DEFAULT_TEST_USER }),
    );
    const [path] = storage.upload.mock.calls[0];
    expect(path).toMatch(/VAT_201__2026_\.pdf$/);
  });

  it('writes every object into the private refund-clusters bucket', async () => {
    await req(DOC_UPLOAD, { method: 'POST', form: pdfUpload() });
    expect(storage.bucketArg).toHaveBeenCalledWith(BUCKET);
    expect(storage.bucketArg.mock.calls.every(([b]) => b === BUCKET)).toBe(true);
  });

  it('creates the bucket private and type-restricted on first use', async () => {
    storage.listBuckets.mockResolvedValue({ data: [] });
    await req(DOC_UPLOAD, { method: 'POST', form: pdfUpload() });
    expect(storage.createBucket).toHaveBeenCalledWith(BUCKET, {
      // A public bucket here means every stored tax return, ID document and
      // bank statement is readable by URL without any authentication at all.
      public: false,
      fileSizeLimit: MAX_UPLOAD_BYTES,
      allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
    });
  });

  it('does not recreate a bucket that already exists', async () => {
    await req(DOC_UPLOAD, { method: 'POST', form: pdfUpload() });
    expect(storage.createBucket).not.toHaveBeenCalled();
  });

  it.each([
    ['document', DOC_UPLOAD],
    ['invoice', INVOICE_UPLOAD],
  ])('reports a failed %s upload as a 500 and stores no metadata', async (_l, path) => {
    storage.upload.mockResolvedValue({ error: { message: 'quota exceeded' } });
    const res = await req(path, { method: 'POST', form: pdfUpload() });
    expect(res.status).toBe(500);
    expect(svc.saveDocument).not.toHaveBeenCalled();
    expect(svc.attachTransactionInvoice).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });
});

// ============================================================================
// DELETE ORDERING — storage first, metadata only once storage confirms
// ============================================================================

/**
 * Every delete in this module removes the stored FILES before dropping the
 * records that hold their paths. The reason is stated in the module and is
 * worth restating: the storage path lives only in the metadata, so dropping
 * metadata first and then failing to delete the file leaves an orphan that
 * nothing in the system can ever name again — an un-deletable copy of a
 * client's ID document and bank statements. Reversing these two lines is a
 * plausible "cleanup" and costs nothing visible at the time.
 */
describe('delete ordering', () => {
  const order = (m: { mock: { invocationCallOrder: number[] } }) => m.mock.invocationCallOrder[0];

  it('removes cluster files before deleting the cluster', async () => {
    svc.listClusterDocuments.mockResolvedValue([doc({ storagePath: 'p/doc.pdf' })]);
    svc.listClusterTransactions.mockResolvedValue([invoiced('p/inv.pdf')]);
    const res = await req(`/${CLUSTER}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(storage.remove).toHaveBeenCalledWith(['p/doc.pdf', 'p/inv.pdf']);
    expect(order(storage.remove)).toBeLessThan(order(svc.deleteCluster));
  });

  it('keeps the cluster when its files cannot be removed', async () => {
    svc.listClusterDocuments.mockResolvedValue([doc({ storagePath: 'p/doc.pdf' })]);
    storage.remove.mockResolvedValue({ error: { message: 'storage down' } });
    const res = await req(`/${CLUSTER}`, { method: 'DELETE' });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(
      'Failed to remove stored documents — cluster not deleted',
    );
    expect(svc.deleteCluster).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('skips storage entirely for a cluster with no files', async () => {
    const res = await req(`/${CLUSTER}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(storage.remove).not.toHaveBeenCalled();
    expect(svc.deleteCluster).toHaveBeenCalled();
  });

  it('removes entity files before deleting the entity records', async () => {
    svc.listDocuments.mockResolvedValue([doc({ storagePath: 'e/doc.pdf' })]);
    svc.listTransactions.mockResolvedValue([invoiced('e/inv.pdf')]);
    const res = await req(`/${CLUSTER}/entities/${ENTITY}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(storage.remove).toHaveBeenCalledWith(['e/doc.pdf', 'e/inv.pdf']);
    expect(order(storage.remove)).toBeLessThan(order(svc.deleteEntityRecords));
  });

  it('keeps the entity when its files cannot be removed', async () => {
    svc.listDocuments.mockResolvedValue([doc({ storagePath: 'e/doc.pdf' })]);
    storage.remove.mockResolvedValue({ error: { message: 'storage down' } });
    const res = await req(`/${CLUSTER}/entities/${ENTITY}`, { method: 'DELETE' });
    expect(res.status).toBe(500);
    expect(svc.deleteEntityRecords).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('counts only invoices that exist when collecting entity paths', async () => {
    // `flatMap(t => t.invoice ? [t.invoice.storagePath] : [])` — a transaction
    // with no invoice must contribute nothing, not `undefined`. A stray
    // undefined in the remove list fails the whole batch delete.
    svc.listDocuments.mockResolvedValue([]);
    svc.listTransactions.mockResolvedValue([txn(), invoiced('e/inv.pdf'), txn()]);
    await req(`/${CLUSTER}/entities/${ENTITY}`, { method: 'DELETE' });
    expect(storage.remove).toHaveBeenCalledWith(['e/inv.pdf']);
  });

  it('removes the file before dropping a document record', async () => {
    const res = await req(`/${CLUSTER}/entities/${ENTITY}/documents/${DOC}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(storage.remove).toHaveBeenCalledWith([doc().storagePath]);
    expect(order(storage.remove)).toBeLessThan(order(svc.deleteDocument));
  });

  it('keeps the document record when the file cannot be removed', async () => {
    storage.remove.mockResolvedValue({ error: { message: 'storage down' } });
    const res = await req(`/${CLUSTER}/entities/${ENTITY}/documents/${DOC}`, { method: 'DELETE' });
    expect(res.status).toBe(500);
    expect(svc.deleteDocument).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('removes the invoice before dropping a transaction record', async () => {
    const res = await req(`/${CLUSTER}/entities/${ENTITY}/transactions/${TXN}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    expect(order(storage.remove)).toBeLessThan(order(svc.deleteTransaction));
  });

  it('keeps the transaction when its invoice cannot be removed', async () => {
    storage.remove.mockResolvedValue({ error: { message: 'storage down' } });
    const res = await req(`/${CLUSTER}/entities/${ENTITY}/transactions/${TXN}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(500);
    expect(svc.deleteTransaction).not.toHaveBeenCalled();
  });

  it('deletes a transaction with no invoice without touching storage', async () => {
    svc.getTransaction.mockResolvedValue(txn());
    const res = await req(`/${CLUSTER}/entities/${ENTITY}/transactions/${TXN}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    expect(storage.remove).not.toHaveBeenCalled();
    expect(svc.deleteTransaction).toHaveBeenCalled();
  });

  it('keeps the invoice metadata when the file cannot be removed', async () => {
    storage.remove.mockResolvedValue({ error: { message: 'storage down' } });
    const res = await req(`/${CLUSTER}/entities/${ENTITY}/transactions/${TXN}/invoice`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(500);
    expect(svc.removeTransactionInvoice).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });
});

// ============================================================================
// INVOICE REPLACE — the one place the ordering is deliberately inverted
// ============================================================================

describe('invoice replacement', () => {
  it('persists the new invoice before removing the one it replaces', async () => {
    const res = await req(INVOICE_UPLOAD, {
      method: 'POST',
      form: pdfUpload({ filename: 'n.pdf' }),
    });
    expect(res.status).toBe(201);
    // Inverted on purpose: a failed upload must never destroy the invoice the
    // user still has. The new file is uploaded to a unique path and its
    // metadata saved FIRST; only then is the old object cleaned up.
    expect(svc.attachTransactionInvoice.mock.invocationCallOrder[0]).toBeLessThan(
      storage.remove.mock.invocationCallOrder[0],
    );
    expect(storage.remove).toHaveBeenCalledWith([OLD_INVOICE_PATH]);
  });

  it('leaves the existing invoice intact when the replacement fails to upload', async () => {
    storage.upload.mockResolvedValue({ error: { message: 'quota exceeded' } });
    const res = await req(INVOICE_UPLOAD, { method: 'POST', form: pdfUpload() });
    expect(res.status).toBe(500);
    expect(svc.attachTransactionInvoice).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('still succeeds when the replaced file cannot be cleaned up', async () => {
    // An orphaned old object is a housekeeping problem; failing the request
    // would be a data problem, because the new invoice is already saved.
    storage.remove.mockResolvedValue({ error: { message: 'storage down' } });
    const res = await req(INVOICE_UPLOAD, { method: 'POST', form: pdfUpload() });
    expect(res.status).toBe(201);
    expect(svc.attachTransactionInvoice).toHaveBeenCalled();
    expect(auditRecord).toHaveBeenCalledTimes(1);
  });

  it('does not remove anything when the transaction had no invoice', async () => {
    svc.getTransaction.mockResolvedValue(txn());
    const res = await req(INVOICE_UPLOAD, { method: 'POST', form: pdfUpload() });
    expect(res.status).toBe(201);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('refuses to attach an invoice to a transaction that does not exist', async () => {
    svc.getTransaction.mockResolvedValue(null);
    const res = await req(INVOICE_UPLOAD, { method: 'POST', form: pdfUpload() });
    expect(res.status).toBe(404);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('records the uploader and the byte count with the invoice metadata', async () => {
    await req(INVOICE_UPLOAD, {
      method: 'POST',
      user: 'sa-99',
      form: pdfUpload({ bytes: 'abcdef' }),
    });
    expect(svc.attachTransactionInvoice).toHaveBeenCalledWith(
      ENTITY,
      TXN,
      expect.objectContaining({
        fileName: 'invoice.pdf',
        contentType: 'application/pdf',
        sizeBytes: 6,
        uploadedBy: 'sa-99',
      }),
    );
  });
});

// ============================================================================
// SIGNED URLS — short-lived links to private objects
// ============================================================================

const DOC_URL = `/${CLUSTER}/entities/${ENTITY}/documents/${DOC}/url`;
const INVOICE_URL = `/${CLUSTER}/entities/${ENTITY}/transactions/${TXN}/invoice/url`;

describe('signed urls', () => {
  it.each([
    ['document', DOC_URL, doc().storagePath],
    ['invoice', INVOICE_URL, `${CLUSTER}/${ENTITY}/transactions/${TXN}/1_old.pdf`],
  ])('issues a five-minute link to the stored %s', async (_label, path, storagePath) => {
    const res = await req(path);
    expect(res.status).toBe(200);
    // 300 seconds. A long-lived link to a decrypted tax document is a
    // credential that outlives the session it was issued in; the TTL is the
    // only thing bounding that, so it is pinned rather than assumed.
    expect(storage.createSignedUrl).toHaveBeenCalledWith(storagePath, 300);
    expect((await res.json()).url).toBe('https://signed/x.pdf');
  });

  it('returns the original filename with the link', async () => {
    svc.getDocument.mockResolvedValue(doc({ fileName: 'VAT 201 (2026).pdf' }));
    const res = await req(DOC_URL);
    expect(await res.json()).toMatchObject({ fileName: 'VAT 201 (2026).pdf' });
  });

  it.each([
    ['document', DOC_URL, 'Failed to create document link'],
    ['invoice', INVOICE_URL, 'Failed to create invoice link'],
  ])('reports a failed %s link as a 500', async (_label, path, message) => {
    storage.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'nope' } });
    const res = await req(path);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(message);
    // A failed link is not an access event — nothing was read.
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it.each([DOC_URL, INVOICE_URL])(
    'treats a successful call with no url as a failure (%s)',
    async (path) => {
      // `if (error || !data?.signedUrl)` — the client can resolve without an
      // error and without a URL. Dropping the second half of that condition
      // would hand the SPA `url: undefined` and a 200.
      storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: '' }, error: null });
      const res = await req(path);
      expect(res.status).toBe(500);
    },
  );

  it('does not issue a link for a document that does not exist', async () => {
    svc.getDocument.mockResolvedValue(null);
    const res = await req(DOC_URL);
    expect(res.status).toBe(404);
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing transaction', null],
    ['a transaction with no invoice', txn()],
  ])('does not issue an invoice link for %s', async (_label, value) => {
    svc.getTransaction.mockResolvedValue(value);
    const res = await req(INVOICE_URL);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Invoice not found');
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });
});

// ============================================================================
// PASSWORD REVEAL — the narrowest, loudest route in the module
// ============================================================================

const EFILING_REVEAL = `/${CLUSTER}/entities/${ENTITY}/efiling-password/reveal`;
const BANK_REVEAL = `/${CLUSTER}/entities/${ENTITY}/bank-password/reveal`;

describe('password reveal', () => {
  it('returns the decrypted eFiling password to a super admin', async () => {
    const res = await req(EFILING_REVEAL, { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, password: 'efiling-secret' });
  });

  it.each(['primary', 'secondary'])('reveals the %s bank account password', async (account) => {
    const res = await req(BANK_REVEAL, { method: 'POST', body: { account } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, password: 'bank-secret' });
    expect(svc.revealBankPassword).toHaveBeenCalledWith(CLUSTER, ENTITY, account);
  });

  it.each([
    ['a third account name', { account: 'tertiary' }],
    ['no account at all', {}],
    ['a null account', { account: null }],
    ['a numeric account', { account: 1 }],
    ['an array', { account: ['primary'] }],
    ['the string "true"', { account: 'true' }],
  ])('refuses to decrypt anything given %s', async (_label, body) => {
    const res = await req(BANK_REVEAL, { method: 'POST', body });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("account must be 'primary' or 'secondary'");
    // Validated before the call, so an unrecognised account name never
    // decrypts a password "just in case".
    expect(svc.revealBankPassword).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('treats an unparseable body as a missing account rather than a crash', async () => {
    // `c.req.json().catch(() => ({}))` — malformed JSON must land on the 400,
    // not on the error handler's 500.
    const res = await app.request(BANK_REVEAL, {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
    expect(svc.revealBankPassword).not.toHaveBeenCalled();
  });

  it('passes the path ids through to the service unchanged', async () => {
    // The service re-checks that the entity belongs to the cluster; handing it
    // the wrong pair, or dropping the cluster id, would defeat that check.
    await req(EFILING_REVEAL, { method: 'POST' });
    expect(svc.revealEfilingPassword).toHaveBeenCalledWith(CLUSTER, ENTITY);
  });

  it.each([
    ['eFiling', EFILING_REVEAL, undefined, 'revealEfilingPassword'],
    ['bank', BANK_REVEAL, { account: 'primary' }, 'revealBankPassword'],
  ] as const)('surfaces a missing %s secret as the service status', async (_l, path, body, fn) => {
    svc[fn].mockRejectedValue(Object.assign(new Error('No password stored'), { status: 404 }));
    const res = await req(path, { method: 'POST', body });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('No password stored');
    expect(auditRecord).not.toHaveBeenCalled();
  });
});

// ============================================================================
// ERROR MAPPING — a service status must not become a blanket 500
// ============================================================================

/**
 * `errStatus` reads `error.status` and falls back to 500. The routes below
 * catch their own errors rather than leaning on `asyncHandler`, so a dropped
 * `errStatus` call turns every "not found" and every validation refusal into a
 * 500 — which the SPA treats as a transient failure and retries. That is the
 * same class of bug as the wills-route 403-reported-as-500 fixed in #237.
 */
describe('service error mapping', () => {
  const MAPPED: [string, string, Route][] = [
    ['updateCluster', 'update cluster', ROUTES[2]],
    ['deleteCluster', 'delete cluster', ROUTES[3]],
    ['createEntity', 'create entity', ROUTES[5]],
    ['updateEntity', 'update entity', ROUTES[6]],
    ['createTransaction', 'create transaction', ROUTES[15]],
    ['updateTransaction', 'update transaction', ROUTES[16]],
    ['createManager', 'create manager', ROUTES[22]],
    ['updateManager', 'update manager', ROUTES[23]],
    ['deleteManager', 'delete manager', ROUTES[24]],
  ];

  it.each(MAPPED)('%s passes a 404 through as a 404', async (fn, _label, route) => {
    (svc as Record<string, ReturnType<typeof vi.fn>>)[fn].mockRejectedValue(
      Object.assign(new Error('Not found'), { status: 404 }),
    );
    const res = await call(route);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Not found');
  });

  it.each(MAPPED)('%s passes a 400 through as a 400', async (fn, _label, route) => {
    (svc as Record<string, ReturnType<typeof vi.fn>>)[fn].mockRejectedValue(
      Object.assign(new Error('name is required'), { status: 400 }),
    );
    const res = await call(route);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('name is required');
  });

  it.each(MAPPED)('%s falls back to 500 for an unclassified error', async (fn, _label, route) => {
    (svc as Record<string, ReturnType<typeof vi.fn>>)[fn].mockRejectedValue(new Error('boom'));
    const res = await call(route);
    expect(res.status).toBe(500);
  });

  it.each(MAPPED)('%s writes no audit entry when it fails', async (fn, _label, route) => {
    (svc as Record<string, ReturnType<typeof vi.fn>>)[fn].mockRejectedValue(
      Object.assign(new Error('Not found'), { status: 404 }),
    );
    await call(route);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('returns 404 for a cluster that does not exist, without listing entities', async () => {
    svc.getCluster.mockResolvedValue(null);
    const res = await req(`/${CLUSTER}`);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Cluster not found');
    expect(svc.listEntities).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('reaches the error handler for a route with no local catch', async () => {
    // `GET /` has no try/catch — the shared `asyncHandler` envelope owns it.
    svc.listClusters.mockRejectedValue(new Error('kv unavailable'));
    const res = await req('/');
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
