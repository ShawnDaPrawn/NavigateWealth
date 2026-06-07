import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  profilesApi,
  postsApi,
  campaignsApi,
  analyticsApi,
  socialMediaAIApi,
  linkedinApi,
} from '../api';

vi.mock('../../../../../utils/supabase/info', () => ({
  projectId: 'test-project',
  publicAnonKey: 'test-anon-key',
}));

vi.mock('../../../../../utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
  }),
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
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Network error'),
}));

function mockFetchOk(data: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ data }),
      blob: () => Promise.resolve(new Blob()),
    }),
  );
}

function mockFetchError(status = 500, errorMessage = 'Internal Server Error') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      statusText: errorMessage,
      json: () => Promise.resolve({ error: errorMessage }),
    }),
  );
}

function mockFetchThrows() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const MOCK_PROFILE = {
  id: 'profile-001',
  platform: 'linkedin',
  name: 'Navigate Wealth Official',
  active: true,
};

const MOCK_POST = {
  id: 'post-001',
  body: 'Check out our latest article!',
  status: 'draft',
  profiles: ['profile-001'],
};

const MOCK_CAMPAIGN = {
  id: 'camp-001',
  name: 'Q1 Campaign',
  status: 'active',
};

describe('profilesApi', () => {
  it('getAll returns profiles on success', async () => {
    mockFetchOk([MOCK_PROFILE]);
    const result = await profilesApi.getAll();
    expect(result.success).toBe(true);
    expect(result.data).toEqual([MOCK_PROFILE]);
  });

  it('getAll returns error response on HTTP failure', async () => {
    mockFetchError(403, 'Forbidden');
    const result = await profilesApi.getAll();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('getAll returns error response on network failure', async () => {
    mockFetchThrows();
    const result = await profilesApi.getAll();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network failure');
  });

  it('getById returns profile by ID', async () => {
    mockFetchOk(MOCK_PROFILE);
    const result = await profilesApi.getById('profile-001');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(MOCK_PROFILE);
  });

  it('connect posts to connect endpoint', async () => {
    mockFetchOk(MOCK_PROFILE);
    const result = await profilesApi.connect({ platform: 'linkedin', accessToken: 'token-xyz' });
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('profiles/connect');
    expect(fetchCall[1]?.method).toBe('POST');
  });

  it('update calls put on profile endpoint', async () => {
    mockFetchOk(MOCK_PROFILE);
    const result = await profilesApi.update('profile-001', { name: 'Updated Name' });
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1]?.method).toBe('PUT');
  });

  it('disconnect posts to disconnect endpoint', async () => {
    mockFetchOk(null);
    const result = await profilesApi.disconnect('profile-001');
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('disconnect');
  });

  it('sync posts to sync endpoint', async () => {
    mockFetchOk(MOCK_PROFILE);
    const result = await profilesApi.sync('profile-001');
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('sync');
  });

  it('delete calls DELETE on profile endpoint', async () => {
    mockFetchOk(null);
    const result = await profilesApi.delete('profile-001');
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1]?.method).toBe('DELETE');
  });
});

describe('postsApi', () => {
  it('getAll returns posts', async () => {
    mockFetchOk([MOCK_POST]);
    const result = await postsApi.getAll();
    expect(result.success).toBe(true);
    expect(result.data).toEqual([MOCK_POST]);
  });

  it('getAll with status filter adds status query params', async () => {
    mockFetchOk([MOCK_POST]);
    await postsApi.getAll({ status: 'draft' });
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('status=draft');
  });

  it('getAll with multiple statuses appends each', async () => {
    mockFetchOk([MOCK_POST]);
    await postsApi.getAll({ status: ['draft', 'scheduled'] });
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('status=draft');
    expect(fetchCall[0]).toContain('status=scheduled');
  });

  it('getAll with profiles and campaign adds query params', async () => {
    mockFetchOk([]);
    await postsApi.getAll({ profiles: ['profile-001'], campaign: 'camp-1', tags: ['tag1'] });
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('profile=profile-001');
    expect(fetchCall[0]).toContain('campaign=camp-1');
    expect(fetchCall[0]).toContain('tag=tag1');
  });

  it('getById returns post by ID', async () => {
    mockFetchOk(MOCK_POST);
    const result = await postsApi.getById('post-001');
    expect(result.data).toEqual(MOCK_POST);
  });

  it('create posts to posts endpoint', async () => {
    mockFetchOk(MOCK_POST);
    const result = await postsApi.create({
      profiles: ['profile-001'],
      body: 'Hello world!',
    });
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1]?.method).toBe('POST');
  });

  it('update calls put on post endpoint', async () => {
    mockFetchOk(MOCK_POST);
    const result = await postsApi.update('post-001', { body: 'Updated content' });
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('post-001');
    expect(fetchCall[1]?.method).toBe('PUT');
  });

  it('delete calls DELETE on post endpoint', async () => {
    mockFetchOk(null);
    const result = await postsApi.delete('post-001');
    expect(result.success).toBe(true);
  });

  it('schedule posts scheduledAt to schedule endpoint', async () => {
    mockFetchOk(MOCK_POST);
    const scheduledAt = new Date('2025-12-01T09:00:00Z');
    await postsApi.schedule('post-001', scheduledAt);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('schedule');
  });

  it('publish posts to publish endpoint', async () => {
    mockFetchOk({ ...MOCK_POST, status: 'published' });
    await postsApi.publish('post-001');
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('publish');
  });

  it('duplicate posts to duplicate endpoint', async () => {
    mockFetchOk({ ...MOCK_POST, id: 'post-002' });
    const result = await postsApi.duplicate('post-001');
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('duplicate');
  });

  it('cancelSchedule posts to cancel-schedule endpoint', async () => {
    mockFetchOk(MOCK_POST);
    await postsApi.cancelSchedule('post-001');
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('cancel-schedule');
  });

  it('getByDateRange delegates to getAll with date params', async () => {
    mockFetchOk([MOCK_POST]);
    const start = new Date('2025-01-01');
    const end = new Date('2025-01-31');
    const result = await postsApi.getByDateRange(start, end);
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('startDate=');
    expect(fetchCall[0]).toContain('endDate=');
  });

  it('getAnalytics returns post analytics', async () => {
    const analytics = { impressions: 500, clicks: 50, engagements: 25 };
    mockFetchOk(analytics);
    const result = await postsApi.getAnalytics('post-001');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(analytics);
  });
});

describe('campaignsApi', () => {
  it('getAll returns campaigns list', async () => {
    mockFetchOk([MOCK_CAMPAIGN]);
    const result = await campaignsApi.getAll();
    expect(result.success).toBe(true);
    expect(result.data).toEqual([MOCK_CAMPAIGN]);
  });

  it('getById returns campaign', async () => {
    mockFetchOk(MOCK_CAMPAIGN);
    const result = await campaignsApi.getById('camp-001');
    expect(result.data).toEqual(MOCK_CAMPAIGN);
  });

  it('create posts new campaign', async () => {
    mockFetchOk(MOCK_CAMPAIGN);
    const result = await campaignsApi.create({
      name: 'New Campaign',
      startDate: new Date('2025-01-01'),
    });
    expect(result.success).toBe(true);
  });

  it('update calls put on campaign endpoint', async () => {
    mockFetchOk(MOCK_CAMPAIGN);
    await campaignsApi.update('camp-001', { name: 'Updated Campaign' });
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1]?.method).toBe('PUT');
  });

  it('delete calls DELETE on campaign endpoint', async () => {
    mockFetchOk(null);
    const result = await campaignsApi.delete('camp-001');
    expect(result.success).toBe(true);
  });

  it('getPosts returns posts associated with campaign', async () => {
    mockFetchOk([MOCK_POST]);
    const result = await campaignsApi.getPosts('camp-001');
    expect(result.success).toBe(true);
    expect(result.data).toEqual([MOCK_POST]);
  });

  it('getAnalytics returns campaign analytics', async () => {
    const analytics = {
      totalImpressions: 1000,
      totalClicks: 100,
      totalEngagement: 50,
      averageCTR: 10,
      averageEngagementRate: 5,
      postsByPlatform: {},
      engagementByPlatform: {},
    };
    mockFetchOk(analytics);
    const result = await campaignsApi.getAnalytics('camp-001');
    expect(result.data).toEqual(analytics);
  });

  it('addPosts posts postIds to campaign', async () => {
    mockFetchOk(MOCK_CAMPAIGN);
    await campaignsApi.addPosts('camp-001', ['post-001', 'post-002']);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('posts');
    expect(fetchCall[1]?.method).toBe('POST');
  });

  it('removePosts calls DELETE with ids query', async () => {
    mockFetchOk(MOCK_CAMPAIGN);
    await campaignsApi.removePosts('camp-001', ['post-001']);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('post-001');
    expect(fetchCall[1]?.method).toBe('DELETE');
  });
});

describe('analyticsApi', () => {
  it('getOverview returns analytics overview', async () => {
    const overview = {
      totalImpressions: 5000,
      totalClicks: 500,
      totalEngagement: 250,
      averageCTR: 10,
      averageEngagementRate: 5,
      postsByPlatform: {},
      engagementByPlatform: {},
    };
    mockFetchOk(overview);
    const result = await analyticsApi.getOverview();
    expect(result.success).toBe(true);
    expect(result.data).toEqual(overview);
  });

  it('getOverview with filters adds query params', async () => {
    mockFetchOk({});
    await analyticsApi.getOverview({
      profiles: ['profile-001'],
      campaign: 'camp-1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31'),
    });
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('profile=profile-001');
    expect(fetchCall[0]).toContain('campaign=camp-1');
  });

  it('getByPlatform adds platform param', async () => {
    mockFetchOk({});
    await analyticsApi.getByPlatform('linkedin');
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('platform=linkedin');
  });

  it('getTopPosts calls analytics/top-posts endpoint', async () => {
    mockFetchOk([MOCK_POST]);
    await analyticsApi.getTopPosts(5);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('top-posts');
    expect(fetchCall[0]).toContain('limit=5');
  });

  it('export returns blob on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(['csv,data'])),
      }),
    );
    const result = await analyticsApi.export();
    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Blob);
  });

  it('export returns error on HTTP failure', async () => {
    mockFetchError(500, 'Export Error');
    const result = await analyticsApi.export();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Export failed');
  });

  it('export returns error on network failure', async () => {
    mockFetchThrows();
    const result = await analyticsApi.export();
    expect(result.success).toBe(false);
  });
});

describe('socialMediaAIApi', () => {
  it('generatePostText posts to generate-post endpoint', async () => {
    const generated = { text: 'Exciting news about financial planning!', platform: 'linkedin' };
    mockFetchOk(generated);
    const result = await socialMediaAIApi.generatePostText({
      topic: 'Financial planning',
      platform: 'linkedin',
    } as never);
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('generate-post');
  });

  it('generatePostText returns error on failure', async () => {
    mockFetchThrows();
    const result = await socialMediaAIApi.generatePostText({ topic: 'Test' } as never);
    expect(result.success).toBe(false);
  });

  it('getHistory fetches AI generation history', async () => {
    const history = [{ id: 'gen-001', topic: 'Test', generatedAt: '2025-01-01' }];
    mockFetchOk(history);
    const result = await socialMediaAIApi.getHistory(20);
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('limit=20');
  });

  it('getHistory returns error on failure', async () => {
    mockFetchThrows();
    const result = await socialMediaAIApi.getHistory();
    expect(result.success).toBe(false);
  });

  it('getStatus checks AI service configuration', async () => {
    mockFetchOk({ configured: true });
    const result = await socialMediaAIApi.getStatus();
    expect(result.success).toBe(true);
    expect(result.data?.configured).toBe(true);
  });

  it('generateImage posts to generate-image endpoint', async () => {
    const imageResult = { imageUrl: 'https://example.com/img.png', prompt: 'Financial chart' };
    mockFetchOk(imageResult);
    const result = await socialMediaAIApi.generateImage({ prompt: 'Financial chart' } as never);
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('generate-image');
  });

  it('generateImage returns error on failure', async () => {
    mockFetchThrows();
    const result = await socialMediaAIApi.generateImage({ prompt: 'Test' } as never);
    expect(result.success).toBe(false);
  });

  it('generateBundle posts to generate-bundle endpoint', async () => {
    mockFetchOk({ posts: [] });
    const result = await socialMediaAIApi.generateBundle({ topic: 'Tax season' } as never);
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('generate-bundle');
  });

  it('getAllCustomTemplates fetches all templates', async () => {
    const templates = [{ id: 't1', name: 'Brand Template' }];
    mockFetchOk(templates);
    const result = await socialMediaAIApi.getAllCustomTemplates();
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('templates');
  });

  it('createCustomTemplate posts template to endpoint', async () => {
    const template = { id: 't1', name: 'New Brand Template' };
    mockFetchOk(template);
    const result = await socialMediaAIApi.createCustomTemplate({
      name: 'New Brand Template',
    } as never);
    expect(result.success).toBe(true);
  });

  it('updateCustomTemplate puts to template endpoint', async () => {
    const template = { id: 't1', name: 'Updated' };
    mockFetchOk(template);
    await socialMediaAIApi.updateCustomTemplate('t1', { name: 'Updated' } as never);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('t1');
    expect(fetchCall[1]?.method).toBe('PUT');
  });

  it('deleteCustomTemplate calls DELETE on template endpoint', async () => {
    mockFetchOk(null);
    const result = await socialMediaAIApi.deleteCustomTemplate('t1');
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1]?.method).toBe('DELETE');
  });

  it('getAIAnalyticsSummary fetches analytics', async () => {
    const summary = { totalGenerations: 100, successRate: 0.95 };
    mockFetchOk(summary);
    const result = await socialMediaAIApi.getAIAnalyticsSummary();
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('analytics');
  });
});

describe('linkedinApi', () => {
  it('getAuthUrl fetches OAuth auth URL', async () => {
    mockFetchOk({ authUrl: 'https://linkedin.com/oauth?...' });
    const result = await linkedinApi.getAuthUrl('https://myapp.com/callback');
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('auth-url');
    expect(fetchCall[0]).toContain('redirectUri=');
  });

  it('getAuthUrl returns error on failure', async () => {
    mockFetchThrows();
    const result = await linkedinApi.getAuthUrl('https://myapp.com/callback');
    expect(result.success).toBe(false);
  });

  it('handleCallback posts code and state', async () => {
    const status = { connected: true, personUrn: 'urn:li:person:abc' };
    mockFetchOk(status);
    const result = await linkedinApi.handleCallback(
      'code-123',
      'state-456',
      'https://callback.url',
    );
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('callback');
    expect(fetchCall[1]?.method).toBe('POST');
  });

  it('getStatus checks LinkedIn connection', async () => {
    const status = { connected: false };
    mockFetchOk(status);
    const result = await linkedinApi.getStatus();
    expect(result.success).toBe(true);
  });

  it('disconnect posts to disconnect endpoint', async () => {
    mockFetchOk(null);
    await linkedinApi.disconnect();
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('disconnect');
    expect(fetchCall[1]?.method).toBe('POST');
  });

  it('shareText posts to share/text endpoint', async () => {
    mockFetchOk({ postId: 'li-post-001' });
    const result = await linkedinApi.shareText('Check out our article!');
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('share/text');
  });

  it('shareText returns error on failure', async () => {
    mockFetchThrows();
    const result = await linkedinApi.shareText('Hello!');
    expect(result.success).toBe(false);
  });

  it('shareArticle posts to share/article endpoint', async () => {
    mockFetchOk({ postId: 'li-art-001' });
    const result = await linkedinApi.shareArticle('Article text', 'https://article.url', 'Title');
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('share/article');
  });

  it('shareImage posts to share/image endpoint', async () => {
    mockFetchOk({ postId: 'li-img-001' });
    const result = await linkedinApi.shareImage('Image caption', 'https://image.url/img.jpg');
    expect(result.success).toBe(true);
    const fetchCall = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('share/image');
  });
});
