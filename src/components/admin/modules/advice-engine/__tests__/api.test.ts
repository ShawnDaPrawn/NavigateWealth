import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clientsApi, personnelApi, aiIntelligenceApi, roaApi, adviceEngineApi } from '../api';

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

vi.mock('../../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../../utils/errorUtils', () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Unknown error'),
}));

vi.mock('../roaModuleRuntime', () => ({
  moduleContractToRuntimeModule: (contract: unknown) => contract,
}));

const MOCK_CLIENT_RAW = {
  user_id: 'user-001',
  first_name: 'Jane',
  last_name: 'Smith',
  email: 'jane@example.com',
  phone: '0821234567',
};

const MOCK_DRAFT = {
  id: 'draft-001',
  status: 'draft',
  selectedModules: ['life-insurance'],
  moduleData: {},
  createdAt: new Date('2025-01-01T10:00:00Z'),
  updatedAt: new Date('2025-01-02T10:00:00Z'),
};

const MOCK_DRAFT_RAW = {
  ...MOCK_DRAFT,
  createdAt: '2025-01-01T10:00:00Z',
  updatedAt: '2025-01-02T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('clientsApi', () => {
  it('getClient returns normalised client from API', async () => {
    mockApiGet.mockResolvedValue({ client: MOCK_CLIENT_RAW });
    const client = await clientsApi.getClient('user-001');
    expect(client.user_id).toBe('user-001');
    expect(client.first_name).toBe('Jane');
    expect(client.email).toBe('jane@example.com');
  });

  it('getClient normalises nested profile data', async () => {
    const nestedClient = {
      id: 'u2',
      profile: {
        personalInformation: {
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob@test.com',
        },
      },
    };
    mockApiGet.mockResolvedValue({ client: nestedClient });
    const client = await clientsApi.getClient('u2');
    expect(client.first_name).toBe('Bob');
    expect(client.last_name).toBe('Jones');
    expect(client.email).toBe('bob@test.com');
  });

  it('getClient throws on API failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Not found'));
    await expect(clientsApi.getClient('missing')).rejects.toThrow('Not found');
  });
});

describe('personnelApi', () => {
  it('getPersonnel returns data array from API', async () => {
    const personnel = [{ id: 'p1', name: 'Alice Adviser' }];
    mockApiGet.mockResolvedValue({ data: personnel });
    const result = await personnelApi.getPersonnel();
    expect(result).toEqual(personnel);
  });

  it('getPersonnel returns empty array on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));
    const result = await personnelApi.getPersonnel();
    expect(result).toEqual([]);
  });

  it('getPersonnel returns empty array when data is absent', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await personnelApi.getPersonnel();
    expect(result).toEqual([]);
  });
});

describe('aiIntelligenceApi.getStatus', () => {
  it('returns API key status from server', async () => {
    mockApiGet.mockResolvedValue({ configured: true, valid: true });
    const status = await aiIntelligenceApi.getStatus();
    expect(status.configured).toBe(true);
    expect(status.valid).toBe(true);
  });

  it('returns unconfigured status on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Server error'));
    const status = await aiIntelligenceApi.getStatus();
    expect(status.configured).toBe(false);
    expect(status.valid).toBe(false);
    expect(typeof status.error).toBe('string');
  });
});

describe('aiIntelligenceApi.sendMessage', () => {
  it('returns AI chat response on success', async () => {
    const mockResponse = { reply: 'Here is my response', tokenCount: 50 };
    mockApiPost.mockResolvedValue(mockResponse);
    const result = await aiIntelligenceApi.sendMessage({ message: 'Hello AI' });
    expect(result.reply).toBe('Here is my response');
  });

  it('passes clientId and conversationHistory to the API', async () => {
    mockApiPost.mockResolvedValue({ reply: 'ok' });
    await aiIntelligenceApi.sendMessage({
      message: 'Analyse client',
      clientId: 'client-123',
      conversationHistory: [{ role: 'user', content: 'Hello' }],
    });
    expect(mockApiPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ clientId: 'client-123' }),
    );
  });

  it('throws API key error when error message includes "API key"', async () => {
    mockApiPost.mockRejectedValue(new Error('Invalid API key provided'));
    await expect(aiIntelligenceApi.sendMessage({ message: 'Hello' })).rejects.toThrow(
      'OpenAI API Key Issue',
    );
  });

  it('throws API key error when error message includes "401"', async () => {
    mockApiPost.mockRejectedValue(new Error('401 Unauthorized'));
    await expect(aiIntelligenceApi.sendMessage({ message: 'Hello' })).rejects.toThrow(
      'OpenAI API Key Issue',
    );
  });

  it('throws access denied error on 403', async () => {
    mockApiPost.mockRejectedValue(new Error('403 Forbidden'));
    await expect(aiIntelligenceApi.sendMessage({ message: 'Hello' })).rejects.toThrow(
      'Access denied',
    );
  });

  it('rethrows other errors as-is', async () => {
    mockApiPost.mockRejectedValue(new Error('Some other error'));
    await expect(aiIntelligenceApi.sendMessage({ message: 'Hello' })).rejects.toThrow(
      'Some other error',
    );
  });
});

describe('aiIntelligenceApi.getHistory', () => {
  it('returns chat history on success', async () => {
    const history = { messages: [{ query: 'Hello', reply: 'Hi' }] };
    mockApiGet.mockResolvedValue(history);
    const result = await aiIntelligenceApi.getHistory();
    expect(result.messages.length).toBe(1);
  });

  it('returns empty messages on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));
    const result = await aiIntelligenceApi.getHistory();
    expect(result.messages).toEqual([]);
  });
});

describe('aiIntelligenceApi.clearHistory', () => {
  it('calls delete on the history endpoint', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await expect(aiIntelligenceApi.clearHistory()).resolves.toBeUndefined();
    expect(mockApiDelete).toHaveBeenCalled();
  });

  it('throws on failure', async () => {
    mockApiDelete.mockRejectedValue(new Error('Delete failed'));
    await expect(aiIntelligenceApi.clearHistory()).rejects.toThrow('Delete failed');
  });
});

describe('aiIntelligenceApi.searchClients', () => {
  it('returns search results for valid query', async () => {
    const results = { clients: [{ user_id: 'u1', first_name: 'Alice' }], totalCount: 1 };
    mockApiPost.mockResolvedValue(results);
    const result = await aiIntelligenceApi.searchClients('Alice');
    expect(result.clients.length).toBe(1);
  });

  it('returns empty results for query shorter than 2 chars', async () => {
    const result = await aiIntelligenceApi.searchClients('A');
    expect(result.clients).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('returns empty results for empty query', async () => {
    const result = await aiIntelligenceApi.searchClients('');
    expect(result.clients).toEqual([]);
  });

  it('returns empty results on failure', async () => {
    mockApiPost.mockRejectedValue(new Error('Network error'));
    const result = await aiIntelligenceApi.searchClients('Alice');
    expect(result.clients).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it('passes limit parameter to API', async () => {
    mockApiPost.mockResolvedValue({ clients: [], totalCount: 0 });
    await aiIntelligenceApi.searchClients('Alice', 5);
    expect(mockApiPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ limit: 5 }),
    );
  });
});

describe('roaApi.getModules', () => {
  it('returns contracts mapped to runtime modules when available', async () => {
    const mockContract = { id: 'mod-1', name: 'Life Insurance' };
    mockApiGet.mockResolvedValue({ contracts: [mockContract] });
    const modules = await roaApi.getModules();
    expect(modules.length).toBe(1);
  });

  it('falls back to legacy modules when contracts are empty', async () => {
    const legacyModule = { id: 'legacy-1', name: 'Legacy Module' };
    mockApiGet
      .mockResolvedValueOnce({ contracts: [] })
      .mockResolvedValueOnce({ modules: [legacyModule] });
    const modules = await roaApi.getModules();
    expect(modules[0]).toEqual(legacyModule);
  });

  it('falls back when contracts API throws', async () => {
    const legacyModule = { id: 'legacy-1' };
    mockApiGet
      .mockRejectedValueOnce(new Error('Contracts unavailable'))
      .mockResolvedValueOnce({ modules: [legacyModule] });
    const modules = await roaApi.getModules();
    expect(modules[0]).toEqual(legacyModule);
  });

  it('returns empty array when both APIs fail', async () => {
    mockApiGet
      .mockRejectedValueOnce(new Error('Contracts fail'))
      .mockRejectedValueOnce(new Error('Legacy fail'));
    const modules = await roaApi.getModules();
    expect(modules).toEqual([]);
  });
});

describe('roaApi.getDraft', () => {
  it('returns normalised draft from API', async () => {
    mockApiGet.mockResolvedValue({ draft: MOCK_DRAFT_RAW });
    const draft = await roaApi.getDraft('draft-001');
    expect(draft.id).toBe('draft-001');
    expect(draft.createdAt).toBeInstanceOf(Date);
    expect(draft.updatedAt).toBeInstanceOf(Date);
  });

  it('throws on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Draft not found'));
    await expect(roaApi.getDraft('missing')).rejects.toThrow('Draft not found');
  });
});

describe('roaApi.saveDraft', () => {
  it('creates new draft when draftId is null', async () => {
    mockApiPost.mockResolvedValue({ draft: MOCK_DRAFT_RAW });
    const result = await roaApi.saveDraft(null, { selectedModules: ['life'] });
    expect(mockApiPost).toHaveBeenCalled();
    expect(result.id).toBe('draft-001');
  });

  it('updates existing draft when draftId is provided', async () => {
    mockApiPut.mockResolvedValue({ draft: MOCK_DRAFT_RAW });
    const result = await roaApi.saveDraft('draft-001', { selectedModules: ['retirement'] });
    expect(mockApiPut).toHaveBeenCalled();
    expect(result.id).toBe('draft-001');
  });

  it('throws on save failure', async () => {
    mockApiPost.mockRejectedValue(new Error('Save failed'));
    await expect(roaApi.saveDraft(null, {})).rejects.toThrow('Save failed');
  });
});

describe('roaApi.submitDraft', () => {
  it('posts to submit endpoint and returns normalised draft', async () => {
    mockApiPost.mockResolvedValue({ draft: MOCK_DRAFT_RAW });
    const result = await roaApi.submitDraft('draft-001');
    expect(mockApiPost).toHaveBeenCalledWith(
      expect.stringContaining('draft-001/submit'),
      expect.anything(),
    );
    expect(result.id).toBe('draft-001');
  });
});

describe('roaApi.deleteDraft', () => {
  it('calls delete endpoint', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await expect(roaApi.deleteDraft('draft-001')).resolves.toBeUndefined();
    expect(mockApiDelete).toHaveBeenCalledWith(expect.stringContaining('draft-001'));
  });

  it('throws on failure', async () => {
    mockApiDelete.mockRejectedValue(new Error('Delete failed'));
    await expect(roaApi.deleteDraft('draft-001')).rejects.toThrow('Delete failed');
  });
});

describe('roaApi.listDrafts', () => {
  it('returns normalised drafts array', async () => {
    mockApiGet.mockResolvedValue({ drafts: [MOCK_DRAFT_RAW] });
    const drafts = await roaApi.listDrafts();
    expect(drafts.length).toBe(1);
    expect(drafts[0].createdAt).toBeInstanceOf(Date);
  });

  it('adds status query param when provided', async () => {
    mockApiGet.mockResolvedValue({ drafts: [] });
    await roaApi.listDrafts('submitted');
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('status=submitted'));
  });

  it('returns empty array on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));
    const drafts = await roaApi.listDrafts();
    expect(drafts).toEqual([]);
  });
});

describe('roaApi.getModuleContracts', () => {
  it('returns contracts array on success', async () => {
    const contracts = [{ id: 'c1', name: 'Contract 1' }];
    mockApiGet.mockResolvedValue({ contracts });
    const result = await roaApi.getModuleContracts();
    expect(result).toEqual(contracts);
  });

  it('filters by status when option is provided', async () => {
    mockApiGet.mockResolvedValue({ contracts: [] });
    await roaApi.getModuleContracts({ status: 'active' });
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('status=active'));
  });

  it('returns empty array on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));
    const result = await roaApi.getModuleContracts();
    expect(result).toEqual([]);
  });
});

describe('roaApi.getClientContext', () => {
  it('returns client context from API', async () => {
    const mockContext = { clientId: 'c1', policies: [] };
    mockApiGet.mockResolvedValue({ context: mockContext });
    const result = await roaApi.getClientContext('c1');
    expect(result).toEqual(mockContext);
  });

  it('throws on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Not found'));
    await expect(roaApi.getClientContext('missing')).rejects.toThrow('Not found');
  });
});

describe('adviceEngineApi.healthCheck', () => {
  it('returns combined health status', async () => {
    mockApiGet
      .mockResolvedValueOnce({ configured: true, valid: true })
      .mockResolvedValueOnce({ contracts: [{ id: 'c1' }] });
    const result = await adviceEngineApi.healthCheck();
    expect(result.aiConfigured).toBe(true);
    expect(result.roaAvailable).toBe(true);
  });

  it('returns false values on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Health check failed'));
    const result = await adviceEngineApi.healthCheck();
    expect(result.aiConfigured).toBe(false);
    expect(result.roaAvailable).toBe(false);
  });

  it('reports roaAvailable false when no contracts', async () => {
    mockApiGet
      .mockResolvedValueOnce({ configured: true, valid: true })
      .mockResolvedValueOnce({ contracts: [] });
    const result = await adviceEngineApi.healthCheck();
    expect(result.roaAvailable).toBe(false);
  });
});
