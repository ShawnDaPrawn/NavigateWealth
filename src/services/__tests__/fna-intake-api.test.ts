import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getIntakeDraft,
  saveIntakeDraft,
  submitIntakeSession,
  listSubmittedIntakes,
  acceptIntakeSession,
  requestIntakeMoreInfo,
  FNA_INTAKE_CONSENT_TEXT,
} from '../fna-intake-api';

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

const MOCK_SESSION = {
  id: 'sess-001',
  clientId: 'c-001',
  domain: 'risk',
  status: 'client_draft',
  inputs: {},
  progressPercent: 20,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  intakeSource: 'client',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FNA_INTAKE_CONSENT_TEXT', () => {
  it('is a non-empty consent string', () => {
    expect(typeof FNA_INTAKE_CONSENT_TEXT).toBe('string');
    expect(FNA_INTAKE_CONSENT_TEXT.length).toBeGreaterThan(0);
  });
});

describe('getIntakeDraft', () => {
  it('returns existing draft session', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: MOCK_SESSION });
    const result = await getIntakeDraft('c-001', 'risk');
    expect(result).toEqual(MOCK_SESSION);
    expect(mockApiGet).toHaveBeenCalledWith('/fna-intake/risk/draft/c-001');
  });

  it('returns null when no draft exists', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: null });
    const result = await getIntakeDraft('c-001', 'medical');
    expect(result).toBeNull();
  });
});

describe('saveIntakeDraft', () => {
  it('saves draft inputs and returns updated session', async () => {
    const updated = { ...MOCK_SESSION, inputs: { age: 40 }, progressPercent: 50 };
    mockApiPut.mockResolvedValue({ success: true, data: updated });
    const result = await saveIntakeDraft('c-001', 'risk', { age: 40 });
    expect(result).toEqual(updated);
    expect(mockApiPut).toHaveBeenCalledWith('/fna-intake/risk/draft/c-001', {
      inputs: { age: 40 },
    });
  });

  it('throws when response has no data', async () => {
    mockApiPut.mockResolvedValue({ success: false, data: null });
    await expect(saveIntakeDraft('c-001', 'risk', {})).rejects.toThrow(
      'Failed to save intake draft',
    );
  });
});

describe('submitIntakeSession', () => {
  it('submits session and returns updated session', async () => {
    const submitted = { ...MOCK_SESSION, status: 'submitted' };
    mockApiPost.mockResolvedValue({ success: true, data: submitted });
    const result = await submitIntakeSession('sess-001');
    expect(result.status).toBe('submitted');
    expect(mockApiPost).toHaveBeenCalledWith('/fna-intake/session/sess-001/submit', {
      consentAccepted: true,
    });
  });

  it('throws when response has no data', async () => {
    mockApiPost.mockResolvedValue({ success: false, data: null });
    await expect(submitIntakeSession('sess-001')).rejects.toThrow('Failed to submit intake');
  });
});

describe('listSubmittedIntakes', () => {
  it('returns list of submitted intake sessions', async () => {
    const sessions = [{ ...MOCK_SESSION, status: 'submitted' }];
    mockApiGet.mockResolvedValue({ success: true, data: sessions });
    const result = await listSubmittedIntakes();
    expect(result).toEqual(sessions);
    expect(mockApiGet).toHaveBeenCalledWith('/fna-intake/queue/list');
  });

  it('returns empty array when no data', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: null });
    const result = await listSubmittedIntakes();
    expect(result).toEqual([]);
  });
});

describe('acceptIntakeSession', () => {
  it('accepts session and returns result', async () => {
    const acceptResult = {
      session: MOCK_SESSION,
      linkedFnaId: 'fna-001',
      domain: 'risk',
      clientId: 'c-001',
      initialStep: 1,
    };
    mockApiPost.mockResolvedValue({ success: true, data: acceptResult });
    const result = await acceptIntakeSession('sess-001');
    expect(result.linkedFnaId).toBe('fna-001');
    expect(mockApiPost).toHaveBeenCalledWith('/fna-intake/session/sess-001/accept', {});
  });

  it('throws when response has no data', async () => {
    mockApiPost.mockResolvedValue({ success: false, data: null });
    await expect(acceptIntakeSession('sess-001')).rejects.toThrow('Failed to accept intake');
  });
});

describe('requestIntakeMoreInfo', () => {
  it('requests more info and returns updated session', async () => {
    const updated = { ...MOCK_SESSION, requestInfoAt: '2025-01-02T00:00:00Z' };
    mockApiPost.mockResolvedValue({ success: true, data: updated });
    const result = await requestIntakeMoreInfo('sess-001');
    expect(result.requestInfoAt).toBe('2025-01-02T00:00:00Z');
    expect(mockApiPost).toHaveBeenCalledWith('/fna-intake/session/sess-001/request-info', {});
  });

  it('throws when response has no data', async () => {
    mockApiPost.mockResolvedValue({ success: false, data: null });
    await expect(requestIntakeMoreInfo('sess-001')).rejects.toThrow(
      'Failed to return intake to client',
    );
  });
});
