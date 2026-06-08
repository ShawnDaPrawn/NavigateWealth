import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listPrefillForms,
  resolveFormPrefill,
  logPrefillAudit,
  fetchPrefillAudit,
  normalizeIntakeInputs,
  listFormTemplates,
  uploadFormTemplate,
  updateTemplateMappings,
  fillFormTemplate,
  previewTemplatePrefill,
} from '../form-prefill-api';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();

vi.mock('../../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listPrefillForms', () => {
  it('returns list of prefill form IDs', async () => {
    const forms = [{ id: 'risk-form', domain: 'risk' }];
    mockApiGet.mockResolvedValue({ success: true, data: forms });
    const result = await listPrefillForms();
    expect(result).toEqual(forms);
    expect(mockApiGet).toHaveBeenCalledWith('/prefill/forms');
  });
});

describe('resolveFormPrefill', () => {
  it('resolves prefill data for a form request', async () => {
    const prefill = { fields: { name: 'John Doe' } };
    mockApiPost.mockResolvedValue({ success: true, data: prefill });
    const request = { formId: 'risk-form', clientId: 'c-001' } as never;
    const result = await resolveFormPrefill(request);
    expect(result).toEqual(prefill);
    expect(mockApiPost).toHaveBeenCalledWith('/prefill/resolve', request);
  });
});

describe('logPrefillAudit', () => {
  it('posts audit log without returning data', async () => {
    mockApiPost.mockResolvedValue(undefined);
    const request = { formId: 'risk-form', clientId: 'c-001', appliedFields: ['name'] } as never;
    await expect(logPrefillAudit(request)).resolves.toBeUndefined();
    expect(mockApiPost).toHaveBeenCalledWith('/prefill/apply-audit', request);
  });
});

describe('fetchPrefillAudit', () => {
  it('fetches audit records for client with default limit', async () => {
    const records = [{ formId: 'risk-form', timestamp: '2025-01-01' }];
    mockApiGet.mockResolvedValue({ success: true, data: records });
    const result = await fetchPrefillAudit('c-001');
    expect(result).toEqual(records);
    expect(mockApiGet).toHaveBeenCalledWith('/prefill/audit/c-001?limit=50');
  });

  it('fetches audit records with custom limit', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: [] });
    await fetchPrefillAudit('c-001', 10);
    expect(mockApiGet).toHaveBeenCalledWith('/prefill/audit/c-001?limit=10');
  });
});

describe('normalizeIntakeInputs', () => {
  it('normalizes intake inputs for a domain', async () => {
    const normalized = { wizardInputs: { age: 40 } };
    mockApiPost.mockResolvedValue({ success: true, data: normalized });
    const result = await normalizeIntakeInputs('risk', { grossIncome: 50000 }, 'c-001');
    expect(result).toEqual(normalized);
    expect(mockApiPost).toHaveBeenCalledWith('/prefill/normalize-intake', {
      domain: 'risk',
      inputs: { grossIncome: 50000 },
      clientId: 'c-001',
    });
  });
});

describe('listFormTemplates', () => {
  it('returns list of form templates', async () => {
    const templates = [{ id: 't-001', name: 'Risk Form', status: 'active' }];
    mockApiGet.mockResolvedValue({ success: true, data: templates });
    const result = await listFormTemplates();
    expect(result).toEqual(templates);
    expect(mockApiGet).toHaveBeenCalledWith('/form-templates');
  });
});

describe('uploadFormTemplate', () => {
  it('uploads template and returns record', async () => {
    const template = { id: 't-001', name: 'New Template' };
    mockApiPost.mockResolvedValue({ success: true, data: template });
    const payload = {
      name: 'New Template',
      fileName: 'template.pdf',
      mimeType: 'application/pdf',
      base64Content: 'base64data',
    };
    const result = await uploadFormTemplate(payload);
    expect(result).toEqual(template);
    expect(mockApiPost).toHaveBeenCalledWith('/form-templates', payload);
  });
});

describe('updateTemplateMappings', () => {
  it('updates template field mappings', async () => {
    const updated = { id: 't-001', fields: [] };
    mockApiPut.mockResolvedValue({ success: true, data: updated });
    const result = await updateTemplateMappings('t-001', [], 'ready');
    expect(result).toEqual(updated);
    expect(mockApiPut).toHaveBeenCalledWith('/form-templates/t-001/mappings', {
      fields: [],
      status: 'ready',
    });
  });
});

describe('fillFormTemplate', () => {
  it('fills template for client and returns filled result', async () => {
    const filled = {
      filledBase64: 'data',
      filledFields: ['name'],
      unresolvedFields: [],
      fileName: 'filled.pdf',
    };
    mockApiPost.mockResolvedValue({ success: true, data: filled });
    const result = await fillFormTemplate('t-001', 'c-001');
    expect(result).toEqual(filled);
    expect(mockApiPost).toHaveBeenCalledWith('/form-templates/t-001/fill', {
      clientId: 'c-001',
      attachToDocuments: false,
    });
  });

  it('passes attachToDocuments option', async () => {
    mockApiPost.mockResolvedValue({
      success: true,
      data: { filledBase64: '', filledFields: [], unresolvedFields: [], fileName: 'f.pdf' },
    });
    await fillFormTemplate('t-001', 'c-001', { attachToDocuments: true });
    expect(mockApiPost).toHaveBeenCalledWith('/form-templates/t-001/fill', {
      clientId: 'c-001',
      attachToDocuments: true,
    });
  });
});

describe('previewTemplatePrefill', () => {
  it('previews prefill for template', async () => {
    const preview = { resolvedFields: { name: 'John' } };
    mockApiPost.mockResolvedValue({ success: true, data: preview });
    const result = await previewTemplatePrefill('t-001', 'c-001');
    expect(result).toEqual(preview);
    expect(mockApiPost).toHaveBeenCalledWith('/form-templates/t-001/preview', {
      clientId: 'c-001',
    });
  });
});
