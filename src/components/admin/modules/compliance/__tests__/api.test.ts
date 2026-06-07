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

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}));

const MOCK_RECORD = {
  id: 'rec-001',
  type: 'fais',
  status: 'active',
  createdAt: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('faisApi', () => {
  it('getAll returns FAIS records', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await faisApi.getAll();
    expect(result).toEqual([MOCK_RECORD]);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/fais');
  });

  it('getAll returns empty array when data absent', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await faisApi.getAll();
    expect(result).toEqual([]);
  });

  it('getById returns single FAIS record', async () => {
    mockApiGet.mockResolvedValue(MOCK_RECORD);
    const result = await faisApi.getById('rec-001');
    expect(result).toEqual(MOCK_RECORD);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/fais/rec-001');
  });

  it('create posts FAIS record', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await faisApi.create({ type: 'fais', status: 'active' } as never);
    expect(result).toEqual(MOCK_RECORD);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/fais', expect.any(Object));
  });

  it('update puts FAIS record by ID', async () => {
    const updated = { ...MOCK_RECORD, status: 'expired' };
    mockApiPut.mockResolvedValue(updated);
    const result = await faisApi.update('rec-001', { status: 'expired' } as never);
    expect(result.status).toBe('expired');
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/fais/rec-001', { status: 'expired' });
  });

  it('delete calls delete endpoint', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await faisApi.delete('rec-001');
    expect(mockApiDelete).toHaveBeenCalledWith('/compliance/fais/rec-001');
  });

  it('getByAdviser returns records for adviser', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await faisApi.getByAdviser('adviser-001');
    expect(result).toEqual([MOCK_RECORD]);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/fais/adviser/adviser-001');
  });
});

describe('amlFicaApi', () => {
  it('getAll returns AML/FICA records', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await amlFicaApi.getAll();
    expect(result).toEqual([MOCK_RECORD]);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/aml-fica');
  });

  it('getById returns single record', async () => {
    mockApiGet.mockResolvedValue(MOCK_RECORD);
    const result = await amlFicaApi.getById('rec-001');
    expect(result).toEqual(MOCK_RECORD);
  });

  it('create posts new AML/FICA record', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await amlFicaApi.create({ type: 'aml' } as never);
    expect(result).toEqual(MOCK_RECORD);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/aml-fica', expect.any(Object));
  });

  it('update puts AML/FICA record', async () => {
    mockApiPut.mockResolvedValue(MOCK_RECORD);
    await amlFicaApi.update('rec-001', { status: 'complete' } as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/aml-fica/rec-001', { status: 'complete' });
  });
});

describe('popiPaiaApi', () => {
  it('getAllConsents returns POPIA consent records', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await popiPaiaApi.getAllConsents();
    expect(result).toEqual([MOCK_RECORD]);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/popia/consents');
  });

  it('recordConsent posts POPIA consent record', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await popiPaiaApi.recordConsent({ consentType: 'marketing' } as never);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('withdrawConsent posts to withdraw endpoint', async () => {
    mockApiPost.mockResolvedValue({ ...MOCK_RECORD, status: 'withdrawn' });
    const result = await popiPaiaApi.withdrawConsent('rec-001');
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/popia/consents/rec-001/withdraw', {});
  });

  it('getAllPAIARequests returns PAIA request list', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await popiPaiaApi.getAllPAIARequests();
    expect(result).toEqual([MOCK_RECORD]);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/paia/requests');
  });

  it('createPAIARequest posts PAIA request', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await popiPaiaApi.createPAIARequest({ subject: 'Data access' } as never);
    expect(result).toEqual(MOCK_RECORD);
  });
});

describe('statutoryApi', () => {
  it('getAll returns statutory records', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await statutoryApi.getAll();
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('create posts statutory record', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await statutoryApi.create({ category: 'annual' } as never);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('update puts statutory record', async () => {
    mockApiPut.mockResolvedValue(MOCK_RECORD);
    await statutoryApi.update('rec-001', { notes: 'Updated' } as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/statutory/rec-001', { notes: 'Updated' });
  });
});

describe('tcfApi', () => {
  it('getAll returns TCF records', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await tcfApi.getAll();
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('create posts TCF record', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await tcfApi.create({ outcome: 'positive' } as never);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('update puts TCF record', async () => {
    mockApiPut.mockResolvedValue(MOCK_RECORD);
    await tcfApi.update('rec-001', { outcome: 'needs_improvement' } as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/tcf/rec-001', {
      outcome: 'needs_improvement',
    });
  });
});

describe('recordKeepingApi', () => {
  it('getAll returns record keeping entries', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await recordKeepingApi.getAll();
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('create posts record keeping entry', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await recordKeepingApi.create({ documentType: 'contract' } as never);
    expect(result).toEqual(MOCK_RECORD);
  });
});

describe('debarmentSupervisionApi', () => {
  it('getAllDebarments returns debarment records', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await debarmentSupervisionApi.getAllDebarments();
    expect(result).toEqual([MOCK_RECORD]);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/debarment');
  });

  it('runCheck posts debarment check for adviser', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await debarmentSupervisionApi.runCheck('adviser-001');
    expect(result).toEqual(MOCK_RECORD);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/debarment/check/adviser-001', {});
  });

  it('getAllSupervision returns supervision records', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await debarmentSupervisionApi.getAllSupervision();
    expect(result).toEqual([MOCK_RECORD]);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/supervision');
  });

  it('createSupervision posts supervision record', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await debarmentSupervisionApi.createSupervision({ supervisorId: 's1' } as never);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('updateSupervision puts supervision record', async () => {
    mockApiPut.mockResolvedValue(MOCK_RECORD);
    await debarmentSupervisionApi.updateSupervision('rec-001', { notes: 'Updated' } as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/supervision/rec-001', {
      notes: 'Updated',
    });
  });
});

describe('conflictsMarketingApi', () => {
  it('getAllConflicts returns conflict records', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await conflictsMarketingApi.getAllConflicts();
    expect(result).toEqual([MOCK_RECORD]);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/conflicts');
  });

  it('createConflict posts conflict record', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await conflictsMarketingApi.createConflict({
      description: 'Potential conflict',
    } as never);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('updateConflict puts conflict record', async () => {
    mockApiPut.mockResolvedValue(MOCK_RECORD);
    await conflictsMarketingApi.updateConflict('rec-001', { status: 'reviewed' } as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/conflicts/rec-001', {
      status: 'reviewed',
    });
  });

  it('getAllMarketing returns marketing records', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await conflictsMarketingApi.getAllMarketing();
    expect(result).toEqual([MOCK_RECORD]);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/marketing');
  });

  it('createMarketing posts marketing record', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await conflictsMarketingApi.createMarketing({ campaign: 'Q1' } as never);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('approveMarketing posts approve for marketing record', async () => {
    mockApiPost.mockResolvedValue({ ...MOCK_RECORD, approved: true });
    const result = await conflictsMarketingApi.approveMarketing('rec-001', 'admin-001');
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/marketing/rec-001/approve', {
      approvedBy: 'admin-001',
    });
  });
});

describe('documentsInsuranceApi', () => {
  it('getAll returns documents insurance records', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await documentsInsuranceApi.getAll();
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('create posts documents insurance record', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await documentsInsuranceApi.create({ documentType: 'PI' } as never);
    expect(result).toEqual(MOCK_RECORD);
  });
});

describe('newBusinessApi', () => {
  it('getAll returns new business records', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await newBusinessApi.getAll();
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('create posts new business record', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await newBusinessApi.create({ clientId: 'c1', productType: 'life' } as never);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('update puts new business record', async () => {
    mockApiPut.mockResolvedValue(MOCK_RECORD);
    await newBusinessApi.update('rec-001', { status: 'approved' } as never);
    expect(mockApiPut).toHaveBeenCalledWith('/compliance/new-business/rec-001', {
      status: 'approved',
    });
  });
});

describe('complaintsApi', () => {
  it('getAll returns complaint records', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_RECORD] });
    const result = await complaintsApi.getAll();
    expect(result).toEqual([MOCK_RECORD]);
  });

  it('create posts new complaint', async () => {
    mockApiPost.mockResolvedValue(MOCK_RECORD);
    const result = await complaintsApi.create({ description: 'Service complaint' } as never);
    expect(result).toEqual(MOCK_RECORD);
  });

  it('resolve posts to resolve endpoint', async () => {
    mockApiPost.mockResolvedValue({ ...MOCK_RECORD, status: 'resolved' });
    const result = await complaintsApi.resolve('rec-001', 'Issue addressed');
    expect(result.status).toBe('resolved');
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/complaints/rec-001/resolve', {
      resolution: 'Issue addressed',
    });
  });

  it('escalate posts to escalate endpoint', async () => {
    mockApiPost.mockResolvedValue({ ...MOCK_RECORD, status: 'escalated' });
    const result = await complaintsApi.escalate('rec-001', 'supervisor-001');
    expect(result.status).toBe('escalated');
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/complaints/rec-001/escalate', {
      escalatedTo: 'supervisor-001',
    });
  });
});

describe('complianceOverviewApi', () => {
  it('getRecentActivities returns activity list', async () => {
    const activities = [{ id: 'act-1', type: 'fais_updated', timestamp: '2025-01-01' }];
    mockApiGet.mockResolvedValue({ data: activities });
    const result = await complianceOverviewApi.getRecentActivities(10);
    expect(result).toEqual(activities);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/activities?limit=10');
  });

  it('getRecentActivities returns empty array when data absent', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await complianceOverviewApi.getRecentActivities();
    expect(result).toEqual([]);
  });

  it('getUpcomingDeadlines returns deadlines list', async () => {
    const deadlines = [{ id: 'dl-1', title: 'FAIS Renewal', dueDate: '2025-06-30' }];
    mockApiGet.mockResolvedValue({ data: deadlines });
    const result = await complianceOverviewApi.getUpcomingDeadlines(30);
    expect(result).toEqual(deadlines);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/deadlines?days=30');
  });

  it('getStats returns compliance statistics', async () => {
    const stats = { totalRecords: 50, compliant: 45, nonCompliant: 5, pending: 0 };
    mockApiGet.mockResolvedValue(stats);
    const result = await complianceOverviewApi.getStats();
    expect(result).toEqual(stats);
    expect(mockApiGet).toHaveBeenCalledWith('/compliance/stats');
  });

  it('refreshAll posts to refresh endpoint', async () => {
    mockApiPost.mockResolvedValue({ success: true, message: 'All checks refreshed' });
    const result = await complianceOverviewApi.refreshAll();
    expect(result.success).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('/compliance/refresh', {});
  });
});

describe('complianceApi legacy wrapper', () => {
  it('exposes all wrapped API functions', () => {
    expect(typeof complianceApi.getFAISRecords).toBe('function');
    expect(typeof complianceApi.getStatutoryRecords).toBe('function');
    expect(typeof complianceApi.getDocumentsInsuranceRecords).toBe('function');
    expect(typeof complianceApi.getRecentActivities).toBe('function');
    expect(typeof complianceApi.getUpcomingDeadlines).toBe('function');
    expect(typeof complianceApi.getComplianceStats).toBe('function');
    expect(typeof complianceApi.createFAISRecord).toBe('function');
    expect(typeof complianceApi.updateFAISRecord).toBe('function');
  });
});
