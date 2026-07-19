/**
 * Tests for the Suppliers API layer.
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

import { SuppliersAPI } from '../api';
import { DEFAULT_TEMPLATE_SPEC } from '../templateSpec';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SuppliersAPI suppliers', () => {
  it('lists suppliers', async () => {
    mockGet.mockResolvedValue({ suppliers: [{ id: 's1' }] });
    const suppliers = await SuppliersAPI.listSuppliers();
    expect(mockGet).toHaveBeenCalledWith('/suppliers');
    expect(suppliers).toEqual([{ id: 's1' }]);
  });

  it('returns an empty list when the payload is missing', async () => {
    mockGet.mockResolvedValue({});
    expect(await SuppliersAPI.listSuppliers()).toEqual([]);
  });

  it('creates a supplier', async () => {
    mockPost.mockResolvedValue({ supplier: { id: 's1', name: 'Acme' } });
    const supplier = await SuppliersAPI.createSupplier({ name: 'Acme', vatNumber: '4123456789' });
    expect(mockPost).toHaveBeenCalledWith('/suppliers', {
      name: 'Acme',
      vatNumber: '4123456789',
    });
    expect(supplier).toEqual({ id: 's1', name: 'Acme' });
  });

  it('fetches the supplier detail envelope', async () => {
    mockGet.mockResolvedValue({
      supplier: { id: 's1' },
      templates: [{ id: 't1' }],
      sequence: { prefix: 'INV-', nextNumber: 3, padding: 4 },
    });
    const detail = await SuppliersAPI.getSupplierDetail('s1');
    expect(mockGet).toHaveBeenCalledWith('/suppliers/s1');
    expect(detail.templates).toEqual([{ id: 't1' }]);
    expect(detail.sequence.nextNumber).toBe(3);
  });

  it('updates and deletes a supplier', async () => {
    mockPut.mockResolvedValue({ supplier: { id: 's1', archived: true } });
    await SuppliersAPI.updateSupplier('s1', { archived: true });
    expect(mockPut).toHaveBeenCalledWith('/suppliers/s1', { archived: true });

    mockDelete.mockResolvedValue({});
    await SuppliersAPI.deleteSupplier('s1');
    expect(mockDelete).toHaveBeenCalledWith('/suppliers/s1');
  });
});

describe('SuppliersAPI files', () => {
  it('uploads a logo as multipart form data', async () => {
    mockPost.mockResolvedValue({ supplier: { id: 's1' } });
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    await SuppliersAPI.uploadLogo('s1', file);
    expect(mockPost).toHaveBeenCalledWith('/suppliers/s1/logo', expect.any(FormData));
    const formData = mockPost.mock.calls[0][1] as FormData;
    expect(formData.get('file')).toBe(file);
  });

  it('uploads an example invoice as multipart form data', async () => {
    mockPost.mockResolvedValue({ supplier: { id: 's1' } });
    const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' });
    await SuppliersAPI.uploadExampleInvoice('s1', file);
    expect(mockPost).toHaveBeenCalledWith('/suppliers/s1/example-invoice', expect.any(FormData));
  });

  it('fetches signed URLs', async () => {
    mockGet.mockResolvedValue({
      url: 'https://signed',
      fileName: 'x.pdf',
      contentType: 'application/pdf',
    });
    expect(await SuppliersAPI.getLogoUrl('s1')).toBe('https://signed');
    expect(mockGet).toHaveBeenCalledWith('/suppliers/s1/logo/url');
    const example = await SuppliersAPI.getExampleInvoiceUrl('s1');
    expect(mockGet).toHaveBeenCalledWith('/suppliers/s1/example-invoice/url');
    expect(example.contentType).toBe('application/pdf');
  });
});

describe('SuppliersAPI templates', () => {
  it('runs the AI analysis', async () => {
    mockPost.mockResolvedValue({ template: { id: 't1', version: 1 } });
    const template = await SuppliersAPI.analyzeTemplate('s1');
    expect(mockPost).toHaveBeenCalledWith('/suppliers/s1/template/analyze');
    expect(template.version).toBe(1);
  });

  it('creates a manual template from scratch', async () => {
    mockPost.mockResolvedValue({ template: { id: 't1', version: 1 } });
    await SuppliersAPI.createManualTemplate('s1', DEFAULT_TEMPLATE_SPEC);
    expect(mockPost).toHaveBeenCalledWith('/suppliers/s1/templates', {
      spec: DEFAULT_TEMPLATE_SPEC,
    });
  });

  it('saves a spec edit against a base version', async () => {
    mockPut.mockResolvedValue({ template: { id: 't2', version: 2 } });
    await SuppliersAPI.saveTemplateSpec('s1', 't1', DEFAULT_TEMPLATE_SPEC);
    expect(mockPut).toHaveBeenCalledWith('/suppliers/s1/templates/t1', {
      spec: DEFAULT_TEMPLATE_SPEC,
    });
  });

  it('activates a template', async () => {
    mockPost.mockResolvedValue({ supplier: { id: 's1', activeTemplateId: 't2' } });
    await SuppliersAPI.activateTemplate('s1', 't2');
    expect(mockPost).toHaveBeenCalledWith('/suppliers/s1/templates/t2/activate');
  });
});

describe('SuppliersAPI invoices', () => {
  it('creates an invoice with the ledger flag', async () => {
    mockPost.mockResolvedValue({ invoice: { id: 'i1', invoiceNumber: 'INV-0001' } });
    const input = {
      billedTo: { kind: 'cluster_entity' as const, clusterId: 'c1', entityId: 'e1' },
      lineItems: [
        { description: 'Work', quantity: 1, unitPrice: 100, vatTreatment: 'standard' as const },
      ],
      recordInLedger: true,
    };
    await SuppliersAPI.createInvoice('s1', input);
    expect(mockPost).toHaveBeenCalledWith('/suppliers/s1/invoices', input);
  });

  it('lists invoices and billed-to options', async () => {
    mockGet.mockResolvedValue({ invoices: [{ id: 'i1' }] });
    expect(await SuppliersAPI.listInvoices('s1')).toEqual([{ id: 'i1' }]);
    expect(mockGet).toHaveBeenCalledWith('/suppliers/s1/invoices');

    mockGet.mockResolvedValue({ options: [{ entityId: 'e1' }] });
    expect(await SuppliersAPI.listBilledToOptions()).toEqual([{ entityId: 'e1' }]);
    expect(mockGet).toHaveBeenCalledWith('/suppliers/billed-to-options');
  });

  it('surfaces the linked ledger transaction on delete', async () => {
    mockDelete.mockResolvedValue({ ledgerTransactionId: 'txn1' });
    const result = await SuppliersAPI.deleteInvoice('s1', 'i1');
    expect(mockDelete).toHaveBeenCalledWith('/suppliers/s1/invoices/i1');
    expect(result.ledgerTransactionId).toBe('txn1');
  });

  it('updates the numbering sequence', async () => {
    mockPut.mockResolvedValue({ sequence: { prefix: 'ACM-', nextNumber: 10, padding: 3 } });
    const sequence = await SuppliersAPI.updateSequence('s1', { prefix: 'ACM-' });
    expect(mockPut).toHaveBeenCalledWith('/suppliers/s1/sequence', { prefix: 'ACM-' });
    expect(sequence.prefix).toBe('ACM-');
  });
});
