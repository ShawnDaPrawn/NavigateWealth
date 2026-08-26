/**
 * Fixtures and stubs shared by the locked/refund-clusters route contract suites.
 * =============================================================================
 *
 * The module under test has 25 routes across five resources, and the suites are
 * split by concern (the authorization/audit matrix in one file, storage
 * behaviour in another) to stay inside the repo's 1000-line file budget. Both
 * need the same service stub, the same storage stub and the same route table —
 * and the route table in particular must be ONE list, because its whole job is
 * to make a route that is missing from it visible.
 *
 * @module __tests__/helpers/refund-clusters-harness
 */
import { vi } from 'vitest';
import { multipart } from './contract-harness.ts';

export const CLUSTER = 'cl-1';
export const ENTITY = 'en-1';
export const DOC = 'doc-1';
export const TXN = 'tx-1';
export const MANAGER = 'mg-1';
export const BUCKET = 'make-91ed8379-refund-clusters';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Every method the routes call on `RefundClustersService`. */
export const svc = {
  listClusters: vi.fn(),
  getCluster: vi.fn(),
  createCluster: vi.fn(),
  updateCluster: vi.fn(),
  deleteCluster: vi.fn(),
  listEntities: vi.fn(),
  getEntityRaw: vi.fn(),
  createEntity: vi.fn(),
  updateEntity: vi.fn(),
  deleteEntityRecords: vi.fn(),
  revealEfilingPassword: vi.fn(),
  revealBankPassword: vi.fn(),
  listDocuments: vi.fn(),
  listClusterDocuments: vi.fn(),
  getDocument: vi.fn(),
  saveDocument: vi.fn(),
  deleteDocument: vi.fn(),
  listTransactions: vi.fn(),
  listClusterTransactions: vi.fn(),
  getTransaction: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  attachTransactionInvoice: vi.fn(),
  removeTransactionInvoice: vi.fn(),
  listManagers: vi.fn(),
  createManager: vi.fn(),
  updateManager: vi.fn(),
  deleteManager: vi.fn(),
};

export const auditRecord = vi.fn(async () => undefined);

export const storage = {
  listBuckets: vi.fn(),
  createBucket: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  /** Records which bucket name `storage.from(…)` was called with. */
  bucketArg: vi.fn(),
};

/** Module shape for `vi.mock('jsr:@supabase/supabase-js@2.49.8', …)`. */
export function makeSupabaseMock() {
  return {
    createClient: () => ({
      storage: {
        listBuckets: storage.listBuckets,
        createBucket: storage.createBucket,
        from: (bucket: string) => {
          storage.bucketArg(bucket);
          return {
            upload: storage.upload,
            remove: storage.remove,
            createSignedUrl: storage.createSignedUrl,
          };
        },
      },
    }),
  };
}

export const doc = (over: Record<string, unknown> = {}) => ({
  id: DOC,
  entityId: ENTITY,
  clusterId: CLUSTER,
  documentType: 'vat',
  fileName: 'invoice.pdf',
  storagePath: `${CLUSTER}/${ENTITY}/vat/1_invoice.pdf`,
  contentType: 'application/pdf',
  sizeBytes: 3,
  uploadedAt: '2026-01-01T00:00:00.000Z',
  uploadedBy: 'sa-1',
  ...over,
});

export const txn = (over: Record<string, unknown> = {}) => ({
  id: TXN,
  entityId: ENTITY,
  clusterId: CLUSTER,
  date: '2026-01-01',
  description: 'Consulting',
  direction: 'expense',
  vatTreatment: 'standard',
  amount: 115,
  vatAmount: 15,
  vatOverridden: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'sa-1',
  ...over,
});

export const OLD_INVOICE_PATH = `${CLUSTER}/${ENTITY}/transactions/${TXN}/1_old.pdf`;

export const invoiced = (path = OLD_INVOICE_PATH) =>
  txn({
    invoice: {
      fileName: 'old.pdf',
      storagePath: path,
      contentType: 'application/pdf',
      sizeBytes: 3,
      uploadedAt: '2026-01-01T00:00:00.000Z',
      uploadedBy: 'sa-1',
    },
  });

/** A valid document upload: PDF mime, .pdf extension, small. */
export function pdfUpload({
  filename = 'invoice.pdf',
  type = 'application/pdf',
  bytes = 'abc',
  documentType = 'vat',
} = {}) {
  const parts = [{ name: 'file', value: bytes, filename, type }];
  if (documentType) parts.push({ name: 'documentType', value: documentType });
  return multipart(parts, '----refundclusters');
}

export type Route = {
  name: string;
  method: string;
  path: string;
  ok: number;
  body?: unknown;
  form?: boolean;
};

/**
 * Every route the module registers, with a request that SUCCEEDS as a super
 * admin. This is the single source for the authorization matrix: adding a route
 * to the module without adding it here leaves a hole, and the count assertion
 * in the gate suite is what makes that hole visible.
 */
export const ROUTES: Route[] = [
  { name: 'list clusters', method: 'GET', path: '/', ok: 200 },
  { name: 'create cluster', method: 'POST', path: '/', ok: 201, body: { name: 'C' } },
  { name: 'update cluster', method: 'PUT', path: `/${CLUSTER}`, ok: 200, body: { name: 'C2' } },
  { name: 'delete cluster', method: 'DELETE', path: `/${CLUSTER}`, ok: 200 },
  { name: 'open cluster', method: 'GET', path: `/${CLUSTER}`, ok: 200 },
  {
    name: 'create entity',
    method: 'POST',
    path: `/${CLUSTER}/entities`,
    ok: 201,
    body: { entityType: 'company' },
  },
  {
    name: 'update entity',
    method: 'PUT',
    path: `/${CLUSTER}/entities/${ENTITY}`,
    ok: 200,
    body: { entityType: 'company' },
  },
  { name: 'delete entity', method: 'DELETE', path: `/${CLUSTER}/entities/${ENTITY}`, ok: 200 },
  {
    name: 'reveal eFiling password',
    method: 'POST',
    path: `/${CLUSTER}/entities/${ENTITY}/efiling-password/reveal`,
    ok: 200,
  },
  {
    name: 'reveal bank password',
    method: 'POST',
    path: `/${CLUSTER}/entities/${ENTITY}/bank-password/reveal`,
    ok: 200,
    body: { account: 'primary' },
  },
  {
    name: 'list documents',
    method: 'GET',
    path: `/${CLUSTER}/entities/${ENTITY}/documents`,
    ok: 200,
  },
  {
    name: 'upload document',
    method: 'POST',
    path: `/${CLUSTER}/entities/${ENTITY}/documents`,
    ok: 201,
    form: true,
  },
  {
    name: 'document signed url',
    method: 'GET',
    path: `/${CLUSTER}/entities/${ENTITY}/documents/${DOC}/url`,
    ok: 200,
  },
  {
    name: 'delete document',
    method: 'DELETE',
    path: `/${CLUSTER}/entities/${ENTITY}/documents/${DOC}`,
    ok: 200,
  },
  {
    name: 'list transactions',
    method: 'GET',
    path: `/${CLUSTER}/entities/${ENTITY}/transactions`,
    ok: 200,
  },
  {
    name: 'create transaction',
    method: 'POST',
    path: `/${CLUSTER}/entities/${ENTITY}/transactions`,
    ok: 201,
    body: { amount: 115 },
  },
  {
    name: 'update transaction',
    method: 'PUT',
    path: `/${CLUSTER}/entities/${ENTITY}/transactions/${TXN}`,
    ok: 200,
    body: { amount: 230 },
  },
  {
    name: 'delete transaction',
    method: 'DELETE',
    path: `/${CLUSTER}/entities/${ENTITY}/transactions/${TXN}`,
    ok: 200,
  },
  {
    name: 'upload transaction invoice',
    method: 'POST',
    path: `/${CLUSTER}/entities/${ENTITY}/transactions/${TXN}/invoice`,
    ok: 201,
    form: true,
  },
  {
    name: 'invoice signed url',
    method: 'GET',
    path: `/${CLUSTER}/entities/${ENTITY}/transactions/${TXN}/invoice/url`,
    ok: 200,
  },
  {
    name: 'delete invoice',
    method: 'DELETE',
    path: `/${CLUSTER}/entities/${ENTITY}/transactions/${TXN}/invoice`,
    ok: 200,
  },
  { name: 'list managers', method: 'GET', path: `/${CLUSTER}/managers`, ok: 200 },
  { name: 'create manager', method: 'POST', path: `/${CLUSTER}/managers`, ok: 201, body: {} },
  {
    name: 'update manager',
    method: 'PUT',
    path: `/${CLUSTER}/managers/${MANAGER}`,
    ok: 200,
    body: {},
  },
  { name: 'delete manager', method: 'DELETE', path: `/${CLUSTER}/managers/${MANAGER}`, ok: 200 },
];

/** Roles that must NOT reach any of these routes. */
export const FORBIDDEN_ROLES = [
  'admin',
  'adviser',
  'paraplanner',
  'compliance',
  'client',
  'worker',
];

/** Both spellings are live in the codebase; see `requireSuperAdmin` in auth-mw. */
export const SUPER_ADMIN_SPELLINGS = ['super_admin', 'super-admin'];

/** The most recent audit entry, or undefined if nothing was recorded. */
export function lastAudit(): Record<string, unknown> | undefined {
  const calls = auditRecord.mock.calls;
  return calls.length ? (calls[calls.length - 1][0] as Record<string, unknown>) : undefined;
}

/**
 * Defaults that make every route succeed, so a failing test is a failing
 * assertion rather than a missing stub. Call from `beforeEach` after
 * `vi.clearAllMocks()`.
 */
export function resetRefundClusterMocks(): void {
  svc.listClusters.mockResolvedValue([]);
  svc.getCluster.mockResolvedValue({ id: CLUSTER, name: 'C', archived: false });
  svc.createCluster.mockResolvedValue({ id: CLUSTER, name: 'C' });
  svc.updateCluster.mockResolvedValue({ id: CLUSTER, name: 'C' });
  svc.deleteCluster.mockResolvedValue({ entitiesDeleted: 2 });
  svc.listEntities.mockResolvedValue([]);
  svc.getEntityRaw.mockResolvedValue({ id: ENTITY, clusterId: CLUSTER });
  svc.createEntity.mockResolvedValue({
    id: ENTITY,
    entityType: 'company',
    taxDetails: { hasEfilingPassword: true },
  });
  svc.updateEntity.mockResolvedValue({ id: ENTITY });
  svc.deleteEntityRecords.mockResolvedValue(undefined);
  svc.revealEfilingPassword.mockResolvedValue('efiling-secret');
  svc.revealBankPassword.mockResolvedValue('bank-secret');
  svc.listDocuments.mockResolvedValue([]);
  svc.listClusterDocuments.mockResolvedValue([]);
  svc.getDocument.mockResolvedValue(doc());
  svc.saveDocument.mockResolvedValue(doc());
  svc.deleteDocument.mockResolvedValue(undefined);
  svc.listTransactions.mockResolvedValue([]);
  svc.listClusterTransactions.mockResolvedValue([]);
  svc.getTransaction.mockResolvedValue(invoiced());
  svc.createTransaction.mockResolvedValue(txn());
  svc.updateTransaction.mockResolvedValue(txn());
  svc.deleteTransaction.mockResolvedValue(undefined);
  svc.attachTransactionInvoice.mockResolvedValue(invoiced());
  svc.removeTransactionInvoice.mockResolvedValue(txn());
  svc.listManagers.mockResolvedValue([]);
  svc.createManager.mockResolvedValue({ id: MANAGER });
  svc.updateManager.mockResolvedValue({ id: MANAGER });
  svc.deleteManager.mockResolvedValue(undefined);

  auditRecord.mockResolvedValue(undefined);
  storage.listBuckets.mockResolvedValue({ data: [{ name: BUCKET }] });
  storage.createBucket.mockResolvedValue({ error: null });
  storage.upload.mockResolvedValue({ error: null });
  storage.remove.mockResolvedValue({ error: null });
  storage.createSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://signed/x.pdf' },
    error: null,
  });
}
