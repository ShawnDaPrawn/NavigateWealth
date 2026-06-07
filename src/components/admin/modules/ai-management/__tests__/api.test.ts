import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  agentApi,
  vascoConfigApi,
  analyticsApi,
  feedbackApi,
  handoffApi,
  ragIndexApi,
  kbApi,
  promptApi,
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

vi.mock('../../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../../utils/errorUtils', () => ({
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

const MOCK_AGENT = {
  id: 'vasco-public',
  name: 'Vasco (Public)',
  description: 'Public-facing AI assistant',
  enabled: true,
};

const MOCK_KB_ENTRY = {
  id: 'kb-001',
  title: 'Understanding FAIS',
  content: 'FAIS overview...',
  category: 'compliance',
  createdAt: '2025-01-01T00:00:00Z',
};

const MOCK_VERSION = {
  id: 'v-001',
  agentId: 'vasco-public',
  context: 'public',
  prompt: 'You are a helpful advisor.',
  publishedAt: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('agentApi', () => {
  it('getAgents returns agent list from API', async () => {
    mockApiGet.mockResolvedValue({ agents: [MOCK_AGENT] });
    const result = await agentApi.getAgents();
    expect(result).toEqual([MOCK_AGENT]);
    expect(mockApiGet).toHaveBeenCalledWith('/ai-management/agents');
  });

  it('getAgents falls back to DEFAULT_AGENTS on API error', async () => {
    mockApiGet.mockRejectedValue(new Error('Not found'));
    const result = await agentApi.getAgents();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('getAgent returns specific agent', async () => {
    mockApiGet.mockResolvedValue({ agent: MOCK_AGENT });
    const result = await agentApi.getAgent('vasco-public');
    expect(result?.id).toBe('vasco-public');
    expect(mockApiGet).toHaveBeenCalledWith('/ai-management/agents/vasco-public');
  });

  it('getAgent falls back to DEFAULT_AGENTS on error', async () => {
    mockApiGet.mockRejectedValue(new Error('Not found'));
    const result = await agentApi.getAgent('vasco-public');
    expect(result?.id).toBe('vasco-public');
  });

  it('getAgent returns null when id not in defaults and API fails', async () => {
    mockApiGet.mockRejectedValue(new Error('Not found'));
    const result = await agentApi.getAgent('nonexistent-agent');
    expect(result).toBeNull();
  });
});

describe('vascoConfigApi', () => {
  it('getConfig returns Vasco config', async () => {
    const config = { enabled: true, updatedAt: '2025-01-01', updatedBy: 'admin' };
    mockApiGet.mockResolvedValue({ config });
    const result = await vascoConfigApi.getConfig();
    expect(result.enabled).toBe(true);
    expect(mockApiGet).toHaveBeenCalledWith('/vasco/config');
  });

  it('getConfig returns disabled default on error', async () => {
    mockApiGet.mockRejectedValue(new Error('Config unavailable'));
    const result = await vascoConfigApi.getConfig();
    expect(result.enabled).toBe(false);
    expect(result.updatedBy).toBe('system');
  });

  it('updateConfig puts enabled state', async () => {
    const config = { enabled: true, updatedAt: '2025-01-01', updatedBy: 'admin' };
    mockApiPut.mockResolvedValue({ config });
    const result = await vascoConfigApi.updateConfig(true);
    expect(result.enabled).toBe(true);
    expect(mockApiPut).toHaveBeenCalledWith('/vasco/config', { enabled: true });
  });
});

describe('analyticsApi', () => {
  it('getSummary returns analytics data', async () => {
    const summary = { totalChats: 100, avgRating: 4.5, handoffs: 5 };
    mockApiGet.mockResolvedValue(summary);
    const result = await analyticsApi.getSummary();
    expect(result.totalChats).toBe(100);
    expect(mockApiGet).toHaveBeenCalledWith('/vasco/analytics');
  });

  it('getSummary throws on API error', async () => {
    mockApiGet.mockRejectedValue(new Error('Analytics unavailable'));
    await expect(analyticsApi.getSummary()).rejects.toThrow('Analytics unavailable');
  });
});

describe('feedbackApi', () => {
  it('getRecent returns feedback with default limit', async () => {
    const feedback = [{ id: 'fb-001', rating: 5, comment: 'Excellent' }];
    mockApiGet.mockResolvedValue({ feedback });
    const result = await feedbackApi.getRecent();
    expect(result).toEqual(feedback);
    expect(mockApiGet).toHaveBeenCalledWith('/vasco/feedback?limit=50');
  });

  it('getRecent passes custom limit', async () => {
    mockApiGet.mockResolvedValue({ feedback: [] });
    await feedbackApi.getRecent(10);
    expect(mockApiGet).toHaveBeenCalledWith('/vasco/feedback?limit=10');
  });

  it('getRecent throws on API error', async () => {
    mockApiGet.mockRejectedValue(new Error('Fetch failed'));
    await expect(feedbackApi.getRecent()).rejects.toThrow('Fetch failed');
  });
});

describe('handoffApi', () => {
  it('getAll returns all handoffs', async () => {
    const handoffs = [{ id: 'hoff-001', status: 'pending', clientId: 'c1' }];
    mockApiGet.mockResolvedValue({ handoffs });
    const result = await handoffApi.getAll();
    expect(result).toEqual(handoffs);
    expect(mockApiGet).toHaveBeenCalledWith('/vasco/handoffs');
  });

  it('getAll filters by status', async () => {
    mockApiGet.mockResolvedValue({ handoffs: [] });
    await handoffApi.getAll('resolved' as never);
    expect(mockApiGet).toHaveBeenCalledWith('/vasco/handoffs?status=resolved');
  });

  it('getAll throws on API error', async () => {
    mockApiGet.mockRejectedValue(new Error('Fetch failed'));
    await expect(handoffApi.getAll()).rejects.toThrow('Fetch failed');
  });

  it('updateStatus puts new handoff status', async () => {
    const updated = { id: 'hoff-001', status: 'resolved' };
    mockApiPut.mockResolvedValue({ handoff: updated });
    const result = await handoffApi.updateStatus('hoff-001', 'resolved' as never);
    expect(result.status).toBe('resolved');
    expect(mockApiPut).toHaveBeenCalledWith('/vasco/handoffs/hoff-001', { status: 'resolved' });
  });
});

describe('ragIndexApi', () => {
  it('getStatus returns index when indexed', async () => {
    const response = {
      indexed: true,
      articles: [{ id: 'a1', title: 'Test' }],
      totalChunks: 50,
      lastFullIndex: '2025-01-01T00:00:00Z',
    };
    mockApiGet.mockResolvedValue(response);
    const result = await ragIndexApi.getStatus();
    expect(result?.totalChunks).toBe(50);
    expect(result?.lastFullIndex).toBe('2025-01-01T00:00:00Z');
  });

  it('getStatus returns null when not indexed', async () => {
    mockApiGet.mockResolvedValue({
      indexed: false,
      articles: [],
      totalChunks: 0,
      lastFullIndex: null,
    });
    const result = await ragIndexApi.getStatus();
    expect(result).toBeNull();
  });

  it('getStatus returns null on API error', async () => {
    mockApiGet.mockRejectedValue(new Error('Index unavailable'));
    const result = await ragIndexApi.getStatus();
    expect(result).toBeNull();
  });

  it('triggerReindex posts to index endpoint', async () => {
    const indexResult = { success: true, articlesIndexed: 25, chunksCreated: 100 };
    mockApiPost.mockResolvedValue(indexResult);
    const result = await ragIndexApi.triggerReindex();
    expect(result.success).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('/vasco/index', {});
  });

  it('clearIndex deletes index', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await ragIndexApi.clearIndex();
    expect(mockApiDelete).toHaveBeenCalledWith('/vasco/index');
  });
});

describe('kbApi', () => {
  it('getAll returns KB entries', async () => {
    mockApiGet.mockResolvedValue({ entries: [MOCK_KB_ENTRY] });
    const result = await kbApi.getAll();
    expect(result).toEqual([MOCK_KB_ENTRY]);
    expect(mockApiGet).toHaveBeenCalledWith('/ai-management/kb');
  });

  it('getAll throws on API error', async () => {
    mockApiGet.mockRejectedValue(new Error('Fetch failed'));
    await expect(kbApi.getAll()).rejects.toThrow('Fetch failed');
  });

  it('getStats returns KB statistics', async () => {
    const stats = { total: 10, byCategory: { compliance: 5 } };
    mockApiGet.mockResolvedValue({ stats });
    const result = await kbApi.getStats();
    expect(result.total).toBe(10);
    expect(mockApiGet).toHaveBeenCalledWith('/ai-management/kb/stats');
  });

  it('getEntry returns single KB entry', async () => {
    mockApiGet.mockResolvedValue({ entry: MOCK_KB_ENTRY });
    const result = await kbApi.getEntry('kb-001');
    expect(result).toEqual(MOCK_KB_ENTRY);
    expect(mockApiGet).toHaveBeenCalledWith('/ai-management/kb/kb-001');
  });

  it('create posts new KB entry', async () => {
    mockApiPost.mockResolvedValue({ entry: MOCK_KB_ENTRY });
    const result = await kbApi.create({
      title: 'Understanding FAIS',
      content: 'FAIS overview...',
    } as never);
    expect(result).toEqual(MOCK_KB_ENTRY);
    expect(mockApiPost).toHaveBeenCalledWith('/ai-management/kb', expect.any(Object));
  });

  it('update puts KB entry', async () => {
    const updated = { ...MOCK_KB_ENTRY, title: 'Updated FAIS Guide' };
    mockApiPut.mockResolvedValue({ entry: updated });
    const result = await kbApi.update('kb-001', { title: 'Updated FAIS Guide' } as never);
    expect(result.title).toBe('Updated FAIS Guide');
    expect(mockApiPut).toHaveBeenCalledWith('/ai-management/kb/kb-001', {
      title: 'Updated FAIS Guide',
    });
  });

  it('remove deletes KB entry', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await kbApi.remove('kb-001');
    expect(mockApiDelete).toHaveBeenCalledWith('/ai-management/kb/kb-001');
  });
});

describe('promptApi', () => {
  it('getBundle returns active, draft and versions', async () => {
    const bundle = { active: 'Active prompt text', draft: 'Draft text', versions: [MOCK_VERSION] };
    mockApiGet.mockResolvedValue(bundle);
    const result = await promptApi.getBundle('vasco-public', 'public' as never);
    expect(result.active).toBe('Active prompt text');
    expect(result.versions).toEqual([MOCK_VERSION]);
  });

  it('saveDraft puts draft prompt', async () => {
    mockApiPut.mockResolvedValue(undefined);
    await promptApi.saveDraft('vasco-public', 'public' as never, 'You are a helpful advisor.');
    expect(mockApiPut).toHaveBeenCalledWith(expect.stringContaining('vasco-public'), {
      prompt: 'You are a helpful advisor.',
    });
  });

  it('publish posts to publish endpoint', async () => {
    mockApiPost.mockResolvedValue({ version: MOCK_VERSION });
    const result = await promptApi.publish('vasco-public', 'public' as never);
    expect(result).toEqual(MOCK_VERSION);
    expect(mockApiPost).toHaveBeenCalledWith(expect.stringContaining('publish'), {});
  });

  it('rollback posts versionId to rollback endpoint', async () => {
    mockApiPost.mockResolvedValue({ version: MOCK_VERSION });
    const result = await promptApi.rollback('vasco-public', 'public' as never, 'v-001');
    expect(result).toEqual(MOCK_VERSION);
    expect(mockApiPost).toHaveBeenCalledWith(expect.stringContaining('rollback'), {
      versionId: 'v-001',
    });
  });

  it('seedIfMissing posts seed prompt', async () => {
    const bundle = { active: 'Seed prompt', draft: null, versions: [] };
    mockApiPost.mockResolvedValue(bundle);
    const result = await promptApi.seedIfMissing('vasco-public', 'public' as never, 'Seed prompt');
    expect(result.active).toBe('Seed prompt');
    expect(mockApiPost).toHaveBeenCalledWith(expect.stringContaining('seed'), {
      seedPrompt: 'Seed prompt',
    });
  });
});
