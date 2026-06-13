/**
 * Tests for the Refund Clusters API layer.
 *
 * Mocks the central api client and asserts that each method hits the right
 * endpoint with the right payload and unwraps the response envelope.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock('../../../../../../utils/logger', () => ({
  logger: { error: vi.fn(), debug: vi.fn() },
}));

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

import { RefundClustersAPI } from '../api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RefundClustersAPI clusters', () => {
  it('lists clusters', async () => {
    mockGet.mockResolvedValue({ clusters: [{ id: 'c1' }] });
    const clusters = await RefundClustersAPI.listClusters();
    expect(mockGet).toHaveBeenCalledWith('/refund-clusters');
    expect(clusters).toEqual([{ id: 'c1' }]);
  });

  it('returns an empty list when the payload is missing', async () => {
    mockGet.mockResolvedValue({});
    expect(await RefundClustersAPI.listClusters()).toEqual([]);
  });

  it('creates a cluster', async () => {
    mockPost.mockResolvedValue({ cluster: { id: 'c1', name: 'Q3' } });
    const cluster = await RefundClustersAPI.createCluster({
      name: 'Q3',
      description: 'd',
      vatPeriod: 'A',
    });
    expect(mockPost).toHaveBeenCalledWith('/refund-clusters', {
      name: 'Q3',
      description: 'd',
      vatPeriod: 'A',
    });
    expect(cluster.id).toBe('c1');
  });

  it('updates and archives a cluster', async () => {
    mockPut.mockResolvedValue({ cluster: { id: 'c1', archived: true } });
    await RefundClustersAPI.updateCluster('c1', { archived: true });
    expect(mockPut).toHaveBeenCalledWith('/refund-clusters/c1', { archived: true });
  });

  it('deletes a cluster', async () => {
    mockDelete.mockResolvedValue({});
    await RefundClustersAPI.deleteCluster('c1');
    expect(mockDelete).toHaveBeenCalledWith('/refund-clusters/c1');
  });

  it('fetches cluster detail with entities defaulted', async () => {
    mockGet.mockResolvedValue({ cluster: { id: 'c1' } });
    const detail = await RefundClustersAPI.getClusterDetail('c1');
    expect(mockGet).toHaveBeenCalledWith('/refund-clusters/c1');
    expect(detail.entities).toEqual([]);
  });

  it('rethrows API errors', async () => {
    mockGet.mockRejectedValue(new Error('boom'));
    await expect(RefundClustersAPI.listClusters()).rejects.toThrow('boom');
  });
});

describe('RefundClustersAPI entities', () => {
  it('creates an entity in a cluster', async () => {
    mockPost.mockResolvedValue({ entity: { id: 'e1' } });
    const entity = await RefundClustersAPI.createEntity('c1', {
      entityType: 'sole_proprietor',
    });
    expect(mockPost).toHaveBeenCalledWith('/refund-clusters/c1/entities', {
      entityType: 'sole_proprietor',
    });
    expect(entity.id).toBe('e1');
  });

  it('updates an entity', async () => {
    mockPut.mockResolvedValue({ entity: { id: 'e1' } });
    await RefundClustersAPI.updateEntity('c1', 'e1', { entityType: 'company' });
    expect(mockPut).toHaveBeenCalledWith('/refund-clusters/c1/entities/e1', {
      entityType: 'company',
    });
  });

  it('deletes an entity', async () => {
    mockDelete.mockResolvedValue({});
    await RefundClustersAPI.deleteEntity('c1', 'e1');
    expect(mockDelete).toHaveBeenCalledWith('/refund-clusters/c1/entities/e1');
  });

  it('reveals the eFiling password via the audited endpoint', async () => {
    mockPost.mockResolvedValue({ password: 'pw' });
    const password = await RefundClustersAPI.revealEfilingPassword('c1', 'e1');
    expect(mockPost).toHaveBeenCalledWith(
      '/refund-clusters/c1/entities/e1/efiling-password/reveal',
    );
    expect(password).toBe('pw');
  });
});

describe('RefundClustersAPI documents', () => {
  it('uploads a document as multipart form data', async () => {
    mockPost.mockResolvedValue({ document: { id: 'd1' } });
    const file = new File(['x'], 'id.pdf', { type: 'application/pdf' });
    await RefundClustersAPI.uploadDocument('c1', 'e1', 'id_copy', file);

    const [endpoint, body] = mockPost.mock.calls[0] as [string, FormData];
    expect(endpoint).toBe('/refund-clusters/c1/entities/e1/documents');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('documentType')).toBe('id_copy');
    expect(body.get('file')).toBe(file);
  });

  it('lists documents', async () => {
    mockGet.mockResolvedValue({ documents: [{ id: 'd1' }] });
    const docs = await RefundClustersAPI.listDocuments('c1', 'e1');
    expect(mockGet).toHaveBeenCalledWith('/refund-clusters/c1/entities/e1/documents');
    expect(docs).toHaveLength(1);
  });

  it('fetches a signed document URL', async () => {
    mockGet.mockResolvedValue({ url: 'https://signed' });
    const url = await RefundClustersAPI.getDocumentUrl('c1', 'e1', 'd1');
    expect(mockGet).toHaveBeenCalledWith('/refund-clusters/c1/entities/e1/documents/d1/url');
    expect(url).toBe('https://signed');
  });

  it('deletes a document', async () => {
    mockDelete.mockResolvedValue({});
    await RefundClustersAPI.deleteDocument('c1', 'e1', 'd1');
    expect(mockDelete).toHaveBeenCalledWith('/refund-clusters/c1/entities/e1/documents/d1');
  });
});

describe('RefundClustersAPI transactions', () => {
  const txnInput = {
    date: '2026-03-15',
    description: 'Supplier',
    direction: 'expense' as const,
    vatTreatment: 'standard' as const,
    amount: 1150,
  };

  it('lists transactions', async () => {
    mockGet.mockResolvedValue({ transactions: [{ id: 't1' }] });
    const txns = await RefundClustersAPI.listTransactions('c1', 'e1');
    expect(mockGet).toHaveBeenCalledWith('/refund-clusters/c1/entities/e1/transactions');
    expect(txns).toHaveLength(1);
  });

  it('creates a transaction', async () => {
    mockPost.mockResolvedValue({ transaction: { id: 't1' } });
    await RefundClustersAPI.createTransaction('c1', 'e1', txnInput);
    expect(mockPost).toHaveBeenCalledWith('/refund-clusters/c1/entities/e1/transactions', txnInput);
  });

  it('updates a transaction', async () => {
    mockPut.mockResolvedValue({ transaction: { id: 't1' } });
    await RefundClustersAPI.updateTransaction('c1', 'e1', 't1', txnInput);
    expect(mockPut).toHaveBeenCalledWith(
      '/refund-clusters/c1/entities/e1/transactions/t1',
      txnInput,
    );
  });

  it('deletes a transaction', async () => {
    mockDelete.mockResolvedValue({});
    await RefundClustersAPI.deleteTransaction('c1', 'e1', 't1');
    expect(mockDelete).toHaveBeenCalledWith('/refund-clusters/c1/entities/e1/transactions/t1');
  });

  it('uploads a transaction invoice as form data', async () => {
    mockPost.mockResolvedValue({ transaction: { id: 't1' } });
    const file = new File(['x'], 'inv.pdf', { type: 'application/pdf' });
    await RefundClustersAPI.uploadTransactionInvoice('c1', 'e1', 't1', file);
    const [endpoint, body] = mockPost.mock.calls[0] as [string, FormData];
    expect(endpoint).toBe('/refund-clusters/c1/entities/e1/transactions/t1/invoice');
    expect(body.get('file')).toBe(file);
  });

  it('fetches a signed invoice URL', async () => {
    mockGet.mockResolvedValue({ url: 'https://signed' });
    const url = await RefundClustersAPI.getTransactionInvoiceUrl('c1', 'e1', 't1');
    expect(mockGet).toHaveBeenCalledWith(
      '/refund-clusters/c1/entities/e1/transactions/t1/invoice/url',
    );
    expect(url).toBe('https://signed');
  });

  it('deletes a transaction invoice', async () => {
    mockDelete.mockResolvedValue({});
    await RefundClustersAPI.deleteTransactionInvoice('c1', 'e1', 't1');
    expect(mockDelete).toHaveBeenCalledWith(
      '/refund-clusters/c1/entities/e1/transactions/t1/invoice',
    );
  });
});
