import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  faisApi,
  amlFicaApi,
  popiPaiaApi,
  statutoryApi,
  tcfApi,
  recordKeepingApi,
  debarmentSupervisionApi,
  conflictsMarketingApi,
  documentsInsuranceApi,
  newBusinessApi,
  complaintsApi,
  complianceOverviewApi,
  complianceApi,
} from '../api';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();
const mockApiPatch = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
  },
}));

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const MOCK_RECORD = {
  id: 'rec-001',
  type: 'fais',
  status: 'active',
  createdAt: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// faisApi
// ---------------------------------------------------------------------------

describe('faisApi', () => {
  it('getAll calls GET /compliance/fais and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await faisApi.getAll();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/fais');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAll returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await faisApi.getAll();
    expect(result).toEqual([]);
  });

  it('getById calls GET /compliance/fais/:id and returns the record', async () => {
    mockApiGet.mockResolvedValue(MOCK_RECORD);
    const result = await faisApi.getById('rec-001');
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/fais/rec-001');
    expect(result).toEqual(MOCK_RECORD);
  });

  it('create calls POST /compliance/fais with payload and returns new record', async () => {
    const payload = { type: 'fais', status: 'active' };
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await faisApi.create(payload as never);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/fais', payload);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('update calls PUT /compliance/fais/:id with payload and returns updated record', async () => {
    const payload = { status: 'expired' };
    const updated = { ...MOCK_RECORD, status: 'expired' };
    mockApiPut.mockResolvedValue(updated);
    const result = await faisApi.update('rec-001', payload as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/fais/rec-001', payload);
    expect(result).toEqual(updated);
  });

  it('delete calls DELETE /compliance/fais/:id', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await faisApi.delete('rec-001');
    expect(mockApiDelete).toHaveBeenCalledWith('/compliance/fais/rec-001');
  });

  it('getByAdviser calls GET /compliance/fais/adviser/:id and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await faisApi.getByAdviser('adviser-001');
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/fais/adviser/adviser-001');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getByAdviser returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await faisApi.getByAdviser('adviser-001');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// amlFicaApi
// ---------------------------------------------------------------------------

describe('amlFicaApi', () => {
  it('getAll calls GET /compliance/aml-fica and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await amlFicaApi.getAll();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/aml-fica');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAll returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await amlFicaApi.getAll();
    expect(result).toEqual([]);
  });

  it('getById calls GET /compliance/aml-fica/:id and returns the record', async () => {
    mockApiGet.mockResolvedValue(MOCK_RECORD);
    const result = await amlFicaApi.getById('rec-001');
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/aml-fica/rec-001');
    expect(result).toEqual(MOCK_RECORD);
  });

  it('create calls POST /compliance/aml-fica with payload', async () => {
    const payload = { clientId: 'c1', checkType: 'pep' };
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await amlFicaApi.create(payload as never);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/aml-fica', payload);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('update calls PUT /compliance/aml-fica/:id with payload', async () => {
    const payload = { status: 'cleared' };
    mockApiPut.mockResolvedValue(MOCK_RECORD);
    await amlFicaApi.update('rec-001', payload as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/aml-fica/rec-001', payload);
  });

  it('getByClient calls GET /compliance/aml-fica/client/:id and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await amlFicaApi.getByClient('client-001');
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/aml-fica/client/client-001');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getByClient returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await amlFicaApi.getByClient('client-001');
    expect(result).toEqual([]);
  });

  it('runScreening calls POST /compliance/aml-fica/screen/:clientId with empty body', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await amlFicaApi.runScreening('client-001');
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/aml-fica/screen/client-001', {});
    expect(result).toEqual(MOCK_RECORD);
  });
});

// ---------------------------------------------------------------------------
// popiPaiaApi
// ---------------------------------------------------------------------------

describe('popiPaiaApi', () => {
  it('getAllConsents calls GET /compliance/popia/consents and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await popiPaiaApi.getAllConsents();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/popia/consents');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAllConsents returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await popiPaiaApi.getAllConsents();
    expect(result).toEqual([]);
  });

  it('recordConsent calls POST /compliance/popia/consents with payload', async () => {
    const payload = { consentType: 'marketing', userId: 'u1' };
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await popiPaiaApi.recordConsent(payload as never);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/popia/consents', payload);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('withdrawConsent calls POST /compliance/popia/consents/:id/withdraw with empty body', async () => {
    const withdrawn = { ...MOCK_RECORD, status: 'withdrawn' };
    mockApiPost.mockResolvedValue(withdrawn);
    const result = await popiPaiaApi.withdrawConsent('rec-001');
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/popia/consents/rec-001/withdraw', {});
    expect(result).toEqual(withdrawn);
  });

  it('getConsentsByUser calls GET /compliance/popia/consents/user/:id and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await popiPaiaApi.getConsentsByUser('user-001');
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/popia/consents/user/user-001');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getConsentsByUser returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await popiPaiaApi.getConsentsByUser('user-001');
    expect(result).toEqual([]);
  });

  it('getAllPAIARequests calls GET /compliance/paia/requests and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await popiPaiaApi.getAllPAIARequests();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/paia/requests');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAllPAIARequests returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await popiPaiaApi.getAllPAIARequests();
    expect(result).toEqual([]);
  });

  it('createPAIARequest calls POST /compliance/paia/requests with payload', async () => {
    const payload = { subject: 'Data access', requestorId: 'u1' };
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await popiPaiaApi.createPAIARequest(payload as never);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/paia/requests', payload);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('updatePAIARequest calls PUT /compliance/paia/requests/:id with payload', async () => {
    const payload = { status: 'completed' };
    const updated = { ...MOCK_RECORD, status: 'completed' };
    mockApiPut.mockResolvedValue(updated);
    const result = await popiPaiaApi.updatePAIARequest('rec-001', payload as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/paia/requests/rec-001', payload);
    expect(result).toEqual(updated);
  });
});

// ---------------------------------------------------------------------------
// statutoryApi
// ---------------------------------------------------------------------------

describe('statutoryApi', () => {
  it('getAll calls GET /compliance/statutory and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await statutoryApi.getAll();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/statutory');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAll returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await statutoryApi.getAll();
    expect(result).toEqual([]);
  });

  it('getById calls GET /compliance/statutory/:id and returns the record', async () => {
    mockApiGet.mockResolvedValue(MOCK_RECORD);
    const result = await statutoryApi.getById('rec-001');
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/statutory/rec-001');
    expect(result).toEqual(MOCK_RECORD);
  });

  it('create calls POST /compliance/statutory with payload', async () => {
    const payload = { category: 'annual', period: '2025' };
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await statutoryApi.create(payload as never);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/statutory', payload);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('update calls PUT /compliance/statutory/:id with payload', async () => {
    const payload = { notes: 'Updated' };
    mockApiPut.mockResolvedValue(MOCK_RECORD);
    await statutoryApi.update('rec-001', payload as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/statutory/rec-001', payload);
  });

  it('markAsSubmitted calls POST /compliance/statutory/:id/submit with submittedBy', async () => {
    const submitted = { ...MOCK_RECORD, status: 'submitted' };
    mockApiPost.mockResolvedValue(submitted);
    const result = await statutoryApi.markAsSubmitted('rec-001', 'admin-001');
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/statutory/rec-001/submit', {
      submittedBy: 'admin-001',
    });
    expect(result).toEqual(submitted);
  });
});

// ---------------------------------------------------------------------------
// tcfApi
// ---------------------------------------------------------------------------

describe('tcfApi', () => {
  it('getAll calls GET /compliance/tcf and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await tcfApi.getAll();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/tcf');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAll returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await tcfApi.getAll();
    expect(result).toEqual([]);
  });

  it('create calls POST /compliance/tcf with payload', async () => {
    const payload = { outcome: 'positive', assessedBy: 'u1' };
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await tcfApi.create(payload as never);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/tcf', payload);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('update calls PUT /compliance/tcf/:id with payload', async () => {
    const payload = { outcome: 'needs_improvement' };
    const updated = { ...MOCK_RECORD, outcome: 'needs_improvement' };
    mockApiPut.mockResolvedValue(updated);
    const result = await tcfApi.update('rec-001', payload as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/tcf/rec-001', payload);
    expect(result).toEqual(updated);
  });
});

// ---------------------------------------------------------------------------
// recordKeepingApi
// ---------------------------------------------------------------------------

describe('recordKeepingApi', () => {
  it('getAll calls GET /compliance/record-keeping and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await recordKeepingApi.getAll();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/record-keeping');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAll returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await recordKeepingApi.getAll();
    expect(result).toEqual([]);
  });

  it('create calls POST /compliance/record-keeping with payload', async () => {
    const payload = { documentType: 'contract', retentionPeriod: 7 };
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await recordKeepingApi.create(payload as never);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/record-keeping', payload);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('markForDisposal calls POST /compliance/record-keeping/:id/dispose with empty body', async () => {
    const disposed = { ...MOCK_RECORD, status: 'disposal_pending' };
    mockApiPost.mockResolvedValue(disposed);
    const result = await recordKeepingApi.markForDisposal('rec-001');
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/record-keeping/rec-001/dispose', {});
    expect(result).toEqual(disposed);
  });
});

// ---------------------------------------------------------------------------
// debarmentSupervisionApi
// ---------------------------------------------------------------------------

describe('debarmentSupervisionApi', () => {
  it('getAllDebarments calls GET /compliance/debarment and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await debarmentSupervisionApi.getAllDebarments();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/debarment');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAllDebarments returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await debarmentSupervisionApi.getAllDebarments();
    expect(result).toEqual([]);
  });

  it('runCheck calls POST /compliance/debarment/check/:adviserId with empty body', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await debarmentSupervisionApi.runCheck('adviser-001');
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/debarment/check/adviser-001', {});
    expect(result).toEqual(MOCK_RECORD);
  });

  it('getAllSupervision calls GET /compliance/supervision and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await debarmentSupervisionApi.getAllSupervision();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/supervision');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAllSupervision returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await debarmentSupervisionApi.getAllSupervision();
    expect(result).toEqual([]);
  });

  it('createSupervision calls POST /compliance/supervision with payload', async () => {
    const payload = { supervisorId: 's1', adviserId: 'a1' };
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await debarmentSupervisionApi.createSupervision(payload as never);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/supervision', payload);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('updateSupervision calls PUT /compliance/supervision/:id with payload', async () => {
    const payload = { notes: 'Progress reviewed' };
    mockApiPut.mockResolvedValue(MOCK_RECORD);
    await debarmentSupervisionApi.updateSupervision('rec-001', payload as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/supervision/rec-001', payload);
  });
});

// ---------------------------------------------------------------------------
// conflictsMarketingApi
// ---------------------------------------------------------------------------

describe('conflictsMarketingApi', () => {
  it('getAllConflicts calls GET /compliance/conflicts and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await conflictsMarketingApi.getAllConflicts();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/conflicts');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAllConflicts returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await conflictsMarketingApi.getAllConflicts();
    expect(result).toEqual([]);
  });

  it('createConflict calls POST /compliance/conflicts with payload', async () => {
    const payload = { description: 'Potential conflict', adviserId: 'a1' };
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await conflictsMarketingApi.createConflict(payload as never);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/conflicts', payload);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('updateConflict calls PUT /compliance/conflicts/:id with payload', async () => {
    const payload = { status: 'reviewed' };
    mockApiPut.mockResolvedValue(MOCK_RECORD);
    await conflictsMarketingApi.updateConflict('rec-001', payload as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/conflicts/rec-001', payload);
  });

  it('getAllMarketing calls GET /compliance/marketing and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await conflictsMarketingApi.getAllMarketing();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/marketing');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAllMarketing returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await conflictsMarketingApi.getAllMarketing();
    expect(result).toEqual([]);
  });

  it('createMarketing calls POST /compliance/marketing with payload', async () => {
    const payload = { campaign: 'Q1 Newsletter', channel: 'email' };
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await conflictsMarketingApi.createMarketing(payload as never);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/marketing', payload);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('approveMarketing calls POST /compliance/marketing/:id/approve with approvedBy', async () => {
    const approved = { ...MOCK_RECORD, approved: true };
    mockApiPost.mockResolvedValue(approved);
    const result = await conflictsMarketingApi.approveMarketing('rec-001', 'admin-001');
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/marketing/rec-001/approve', {
      approvedBy: 'admin-001',
    });
    expect(result).toEqual(approved);
  });
});

// ---------------------------------------------------------------------------
// documentsInsuranceApi
// ---------------------------------------------------------------------------

describe('documentsInsuranceApi', () => {
  it('getAll calls GET /compliance/documents-insurance and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await documentsInsuranceApi.getAll();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/documents-insurance');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAll returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await documentsInsuranceApi.getAll();
    expect(result).toEqual([]);
  });

  it('create calls POST /compliance/documents-insurance with payload', async () => {
    const payload = { documentType: 'PI', expiryDate: '2026-01-01' };
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await documentsInsuranceApi.create(payload as never);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/documents-insurance', payload);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('update calls PUT /compliance/documents-insurance/:id with payload', async () => {
    const payload = { expiryDate: '2027-01-01' };
    const updated = { ...MOCK_RECORD, expiryDate: '2027-01-01' };
    mockApiPut.mockResolvedValue(updated);
    const result = await documentsInsuranceApi.update('rec-001', payload as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/documents-insurance/rec-001', payload);
    expect(result).toEqual(updated);
  });

  it('markAsRenewed calls POST /compliance/documents-insurance/:id/renew with empty body', async () => {
    const renewed = { ...MOCK_RECORD, status: 'renewed' };
    mockApiPost.mockResolvedValue(renewed);
    const result = await documentsInsuranceApi.markAsRenewed('rec-001');
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/documents-insurance/rec-001/renew', {});
    expect(result).toEqual(renewed);
  });
});

// ---------------------------------------------------------------------------
// newBusinessApi
// ---------------------------------------------------------------------------

describe('newBusinessApi', () => {
  it('getAll calls GET /compliance/new-business and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await newBusinessApi.getAll();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/new-business');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAll returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await newBusinessApi.getAll();
    expect(result).toEqual([]);
  });

  it('create calls POST /compliance/new-business with payload', async () => {
    const payload = { clientId: 'c1', productType: 'life' };
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await newBusinessApi.create(payload as never);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/new-business', payload);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('update calls PUT /compliance/new-business/:id with payload', async () => {
    const payload = { status: 'approved' };
    const updated = { ...MOCK_RECORD, status: 'approved' };
    mockApiPut.mockResolvedValue(updated);
    const result = await newBusinessApi.update('rec-001', payload as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/new-business/rec-001', payload);
    expect(result).toEqual(updated);
  });

  it('getByClient calls GET /compliance/new-business/client/:id and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await newBusinessApi.getByClient('client-001');
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/new-business/client/client-001');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getByClient returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await newBusinessApi.getByClient('client-001');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// complaintsApi
// ---------------------------------------------------------------------------

describe('complaintsApi', () => {
  it('getAll calls GET /compliance/complaints and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await complaintsApi.getAll();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/complaints');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getAll returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await complaintsApi.getAll();
    expect(result).toEqual([]);
  });

  it('getById calls GET /compliance/complaints/:id and returns the record', async () => {
    mockApiGet.mockResolvedValue(MOCK_RECORD);
    const result = await complaintsApi.getById('rec-001');
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/complaints/rec-001');
    expect(result).toEqual(MOCK_RECORD);
  });

  it('create calls POST /compliance/complaints with payload', async () => {
    const payload = { description: 'Service complaint', clientId: 'c1' };
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await complaintsApi.create(payload as never);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/complaints', payload);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('update calls PUT /compliance/complaints/:id with payload', async () => {
    const payload = { status: 'in_progress' };
    const updated = { ...MOCK_RECORD, status: 'in_progress' };
    mockApiPut.mockResolvedValue(updated);
    const result = await complaintsApi.update('rec-001', payload as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/complaints/rec-001', payload);
    expect(result).toEqual(updated);
  });

  it('resolve calls POST /compliance/complaints/:id/resolve with resolution and outcome', async () => {
    const resolved = { ...MOCK_RECORD, status: 'resolved' };
    mockApiPost.mockResolvedValue(resolved);
    const result = await complaintsApi.resolve('rec-001', 'Issue addressed', 'upheld');
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/complaints/rec-001/resolve', {
      resolution: 'Issue addressed',
      outcome: 'upheld',
    });
    expect(result).toEqual(resolved);
  });

  it('escalate calls POST /compliance/complaints/:id/escalate with escalatedTo', async () => {
    const escalated = { ...MOCK_RECORD, status: 'escalated' };
    mockApiPost.mockResolvedValue(escalated);
    const result = await complaintsApi.escalate('rec-001', 'supervisor-001');
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/complaints/rec-001/escalate', {
      escalatedTo: 'supervisor-001',
    });
    expect(result).toEqual(escalated);
  });
});

// ---------------------------------------------------------------------------
// complianceOverviewApi
// ---------------------------------------------------------------------------

describe('complianceOverviewApi', () => {
  it('getRecentActivities calls GET with provided limit and returns response.data', async () => {
    const activities = [{ id: 'act-1', type: 'fais_updated', timestamp: '2025-01-01' }];
    mockApiGet.mockResolvedValue({ data: activities });
    const result = await complianceOverviewApi.getRecentActivities(10);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/activities?limit=10');
    expect(result).toEqual(activities);
  });

  it('getRecentActivities uses default limit of 20 when none provided', async () => {
    mockApiGet.mockResolvedValue({ data: [] });
    await complianceOverviewApi.getRecentActivities();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/activities?limit=20');
  });

  it('getRecentActivities returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await complianceOverviewApi.getRecentActivities();
    expect(result).toEqual([]);
  });

  it('getUpcomingDeadlines calls GET with provided days and returns response.data', async () => {
    const deadlines = [{ id: 'dl-1', title: 'FAIS Renewal', dueDate: '2025-06-30' }];
    mockApiGet.mockResolvedValue({ data: deadlines });
    const result = await complianceOverviewApi.getUpcomingDeadlines(14);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/deadlines?days=14');
    expect(result).toEqual(deadlines);
  });

  it('getUpcomingDeadlines uses default days of 30 when none provided', async () => {
    mockApiGet.mockResolvedValue({ data: [] });
    await complianceOverviewApi.getUpcomingDeadlines();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/deadlines?days=30');
  });

  it('getUpcomingDeadlines returns empty array when response has no data', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await complianceOverviewApi.getUpcomingDeadlines();
    expect(result).toEqual([]);
  });

  it('getStats calls GET /compliance/stats and returns the stats object directly', async () => {
    const stats = { totalRecords: 50, compliant: 45, nonCompliant: 5, pending: 0 };
    mockApiGet.mockResolvedValue(stats);
    const result = await complianceOverviewApi.getStats();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/stats');
    expect(result).toEqual(stats);
  });

  it('refreshAll calls POST /compliance/refresh with empty body and returns result', async () => {
    const response = { success: true, message: 'All checks refreshed' };
    mockApiPost.mockResolvedValue(response);
    const result = await complianceOverviewApi.refreshAll();
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/refresh', {});
    expect(result).toEqual(response);
  });
});

// ---------------------------------------------------------------------------
// complianceApi (legacy wrapper)
// ---------------------------------------------------------------------------

describe('complianceApi legacy wrapper', () => {
  it('exposes all eight backward-compatible function aliases', () => {
    expect(typeof complianceApi.getFAISRecords).toBe('function');
    expect(typeof complianceApi.getStatutoryRecords).toBe('function');
    expect(typeof complianceApi.getDocumentsInsuranceRecords).toBe('function');
    expect(typeof complianceApi.getRecentActivities).toBe('function');
    expect(typeof complianceApi.getUpcomingDeadlines).toBe('function');
    expect(typeof complianceApi.getComplianceStats).toBe('function');
    expect(typeof complianceApi.createFAISRecord).toBe('function');
    expect(typeof complianceApi.updateFAISRecord).toBe('function');
  });

  it('getFAISRecords delegates to faisApi.getAll and returns response.data', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await complianceApi.getFAISRecords();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/fais');
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('getComplianceStats delegates to complianceOverviewApi.getStats', async () => {
    const stats = { totalRecords: 10, compliant: 8, nonCompliant: 2, pending: 0 };
    mockApiGet.mockResolvedValue(stats);
    const result = await complianceApi.getComplianceStats();
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/stats');
    expect(result).toEqual(stats);
  });
});
