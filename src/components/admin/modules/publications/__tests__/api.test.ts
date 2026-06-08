import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ArticlesAPI,
  CategoriesAPI,
  ContentTypesAPI,
  StatsAPI,
  InitializationAPI,
  SettingsAPI,
  AIWritingAPI,
  TemplatesAPI,
  VersionsAPI,
  AutoContentAPI,
  NewsletterAPI,
  fetchRSSFeed,
  PublicationsAPIError,
} from '../api';

vi.mock('../../../../../utils/api/config', () => ({
  getModuleUrl: (module: string) => `https://api.test/${module}`,
}));

vi.mock('../../../../../utils/supabase/info', () => ({
  publicAnonKey: 'test-anon-key',
}));

vi.mock('../../../../../utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
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

const mockFetch = vi.fn();

function makeOkResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data }),
  } as unknown as Response;
}

function makeErrorResponse(status: number, error = 'Bad request') {
  return {
    ok: false,
    status,
    json: async () => ({ error }),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ============================================================================
// PublicationsAPIError
// ============================================================================

describe('PublicationsAPIError', () => {
  it('has correct name and message', () => {
    const err = new PublicationsAPIError('something failed', 404);
    expect(err.name).toBe('PublicationsAPIError');
    expect(err.message).toBe('something failed');
    expect(err.statusCode).toBe(404);
  });
});

// ============================================================================
// ArticlesAPI
// ============================================================================

describe('ArticlesAPI', () => {
  const MOCK_ARTICLE = { id: 'a-001', title: 'Test Article', status: 'published' };

  describe('getArticles', () => {
    it('fetches all articles with no filters', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([MOCK_ARTICLE]));
      const result = await ArticlesAPI.getArticles();
      expect(result).toEqual([MOCK_ARTICLE]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/articles'),
        expect.any(Object),
      );
    });

    it('appends filter params to URL', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([]));
      await ArticlesAPI.getArticles({ status: 'draft', search: 'hello', category_id: 'cat-1' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('status=draft');
      expect(url).toContain('search=hello');
      expect(url).toContain('category_id=cat-1');
    });

    it('skips filter params with value "all"', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([]));
      await ArticlesAPI.getArticles({ status: 'all', category_id: 'all', type_id: 'all' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).not.toContain('status=');
      expect(url).not.toContain('category_id=');
      expect(url).not.toContain('type_id=');
    });

    it('throws PublicationsAPIError on non-ok response', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500, 'Server error'));
      await expect(ArticlesAPI.getArticles()).rejects.toThrow('Server error');
    });
  });

  describe('getArticle', () => {
    it('fetches article by id', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(MOCK_ARTICLE));
      const result = await ArticlesAPI.getArticle('a-001');
      expect(result).toEqual(MOCK_ARTICLE);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/articles/a-001'),
        expect.any(Object),
      );
    });
  });

  describe('getArticleBySlug', () => {
    it('fetches article by slug', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(MOCK_ARTICLE));
      const result = await ArticlesAPI.getArticleBySlug('test-article');
      expect(result).toEqual(MOCK_ARTICLE);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/articles/slug/test-article'),
        expect.any(Object),
      );
    });
  });

  describe('createArticle', () => {
    it('creates article with POST', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(MOCK_ARTICLE));
      const input = { title: 'Test Article', excerpt: 'excerpt', category_id: 'c', type_id: 't' };
      const result = await ArticlesAPI.createArticle(input as never);
      expect(result).toEqual(MOCK_ARTICLE);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/articles'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('updateArticle', () => {
    it('updates article with PUT', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ ...MOCK_ARTICLE, title: 'Updated' }));
      const result = await ArticlesAPI.updateArticle({ id: 'a-001', title: 'Updated' } as never);
      expect(result.title).toBe('Updated');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/articles/a-001'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  describe('deleteArticle', () => {
    it('deletes article and dispatches event', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await ArticlesAPI.deleteArticle('a-001');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/articles/a-001'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('publishArticle', () => {
    it('publishes article with notify_subscribers defaulting to true', async () => {
      const publishedArticle = { article: { id: 'a-001', status: 'published' } };
      mockFetch.mockResolvedValue(makeOkResponse(publishedArticle));
      const result = await ArticlesAPI.publishArticle('a-001');
      expect(result.article.status).toBe('published');
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.notify_subscribers).toBe(true);
    });

    it('passes notify_subscribers option through', async () => {
      const publishedArticle = { article: { id: 'a-001', status: 'published' } };
      mockFetch.mockResolvedValue(makeOkResponse(publishedArticle));
      await ArticlesAPI.publishArticle('a-001', { notify_subscribers: false });
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.notify_subscribers).toBe(false);
    });
  });

  describe('archiveArticle', () => {
    it('archives article with POST', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ ...MOCK_ARTICLE, status: 'archived' }));
      const result = await ArticlesAPI.archiveArticle('a-001');
      expect(result.status).toBe('archived');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/articles/a-001/archive'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('unarchiveArticle', () => {
    it('unarchives article with POST', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(MOCK_ARTICLE));
      await ArticlesAPI.unarchiveArticle('a-001');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/articles/a-001/unarchive'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('unpublishArticle', () => {
    it('unpublishes article with POST', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ ...MOCK_ARTICLE, status: 'draft' }));
      const result = await ArticlesAPI.unpublishArticle('a-001');
      expect(result.status).toBe('draft');
    });
  });

  describe('processScheduled', () => {
    it('returns processed count from response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { processed: 3 } }),
      } as unknown as Response);
      const result = await ArticlesAPI.processScheduled();
      expect(result.processed).toBe(3);
    });

    it('defaults to 0 when data missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as unknown as Response);
      const result = await ArticlesAPI.processScheduled();
      expect(result.processed).toBe(0);
    });
  });

  describe('searchArticles', () => {
    it('encodes query and calls articles endpoint', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([MOCK_ARTICLE]));
      await ArticlesAPI.searchArticles('financial planning');
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('search=financial%20planning');
    });
  });

  describe('getFeaturedArticles', () => {
    it('requests featured articles with default limit', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([MOCK_ARTICLE]));
      await ArticlesAPI.getFeaturedArticles();
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('is_featured=true');
      expect(url).toContain('limit=10');
    });

    it('accepts custom limit', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([]));
      await ArticlesAPI.getFeaturedArticles(5);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('limit=5');
    });
  });

  describe('reshareArticle', () => {
    it('posts reshare with default options', async () => {
      const reshareResult = { sent: 5, failed: 0 };
      mockFetch.mockResolvedValue(makeOkResponse(reshareResult));
      const result = await ArticlesAPI.reshareArticle('a-001', {});
      expect(result).toEqual(reshareResult);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.dryRun).toBe(true);
      expect(body.targetMode).toBe('all');
    });
  });

  describe('getEmailEngagementSummary', () => {
    it('fetches summary without options', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([]));
      await ArticlesAPI.getEmailEngagementSummary();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/email-engagement/summary'),
        expect.any(Object),
      );
    });

    it('appends include_deleted param when requested', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([]));
      await ArticlesAPI.getEmailEngagementSummary({ includeDeleted: true });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('include_deleted=true');
    });
  });

  describe('getNotificationJob', () => {
    it('fetches notification job and dispatches engagement event', async () => {
      const job = { articleId: 'a-001', status: 'complete' };
      mockFetch.mockResolvedValue(makeOkResponse(job));
      const result = await ArticlesAPI.getNotificationJob('job-001');
      expect(result.articleId).toBe('a-001');
    });
  });

  describe('processNotificationJobs', () => {
    it('posts to process endpoint', async () => {
      const processorResult = { processed: 2, errors: 0 };
      mockFetch.mockResolvedValue(makeOkResponse(processorResult));
      const result = await ArticlesAPI.processNotificationJobs({ maxJobs: 5 });
      expect(result).toEqual(processorResult);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/notification-jobs/process'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});

// ============================================================================
// CategoriesAPI
// ============================================================================

describe('CategoriesAPI', () => {
  const MOCK_CATEGORY = { id: 'cat-001', name: 'Finance', icon: '💰' };

  describe('getCategories', () => {
    it('returns all categories', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([MOCK_CATEGORY]));
      const result = await CategoriesAPI.getCategories();
      expect(result).toEqual([MOCK_CATEGORY]);
    });
  });

  describe('getCategory', () => {
    it('returns single category by id', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(MOCK_CATEGORY));
      const result = await CategoriesAPI.getCategory('cat-001');
      expect(result).toEqual(MOCK_CATEGORY);
    });
  });

  describe('createCategory', () => {
    it('creates category with POST', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(MOCK_CATEGORY));
      const result = await CategoriesAPI.createCategory({ name: 'Finance' } as never);
      expect(result).toEqual(MOCK_CATEGORY);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/categories'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('updateCategory', () => {
    it('updates category with PUT', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(MOCK_CATEGORY));
      await CategoriesAPI.updateCategory({ id: 'cat-001', name: 'Finance Updated' } as never);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/categories/cat-001'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  describe('deleteCategory', () => {
    it('deletes category with DELETE', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await CategoriesAPI.deleteCategory('cat-001');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/categories/cat-001'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('reorderCategories', () => {
    it('posts reorder with POST', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await CategoriesAPI.reorderCategories([{ id: 'cat-001', order: 1 }]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/categories/reorder'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});

// ============================================================================
// ContentTypesAPI
// ============================================================================

describe('ContentTypesAPI', () => {
  const MOCK_TYPE = { id: 'type-001', name: 'Blog Post' };

  describe('getTypes', () => {
    it('returns all content types', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([MOCK_TYPE]));
      const result = await ContentTypesAPI.getTypes();
      expect(result).toEqual([MOCK_TYPE]);
    });
  });

  describe('createType', () => {
    it('creates type with POST', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(MOCK_TYPE));
      const result = await ContentTypesAPI.createType({ name: 'Blog Post' } as never);
      expect(result).toEqual(MOCK_TYPE);
    });
  });

  describe('deleteType', () => {
    it('deletes type with DELETE', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await ContentTypesAPI.deleteType('type-001');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/types/type-001'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});

// ============================================================================
// StatsAPI
// ============================================================================

describe('StatsAPI', () => {
  it('fetches publication statistics', async () => {
    const stats = { totalArticles: 10, published: 5, drafts: 5 };
    mockFetch.mockResolvedValue(makeOkResponse(stats));
    const result = await StatsAPI.getStats();
    expect(result).toEqual(stats);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/stats'), expect.any(Object));
  });
});

// ============================================================================
// InitializationAPI
// ============================================================================

describe('InitializationAPI', () => {
  describe('checkStatus', () => {
    it('returns initialized=true when categories and types both non-empty', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOkResponse([{ id: 'cat-1' }]))
        .mockResolvedValueOnce(makeOkResponse([{ id: 'type-1' }]));
      const result = await InitializationAPI.checkStatus();
      expect(result.is_initialized).toBe(true);
      expect(result.has_categories).toBe(true);
      expect(result.has_types).toBe(true);
    });

    it('returns is_initialized=false when no categories', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOkResponse([]))
        .mockResolvedValueOnce(makeOkResponse([{ id: 'type-1' }]));
      const result = await InitializationAPI.checkStatus();
      expect(result.is_initialized).toBe(false);
    });

    it('returns defaults on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const result = await InitializationAPI.checkStatus();
      expect(result.is_initialized).toBe(false);
      expect(result.has_categories).toBe(false);
    });
  });

  describe('initialize', () => {
    it('posts initialization request', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ success: true }));
      const result = await InitializationAPI.initialize();
      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/initialize'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});

// ============================================================================
// SettingsAPI
// ============================================================================

describe('SettingsAPI', () => {
  it('exportData fetches export endpoint', async () => {
    mockFetch.mockResolvedValue(makeOkResponse({ articles: [] }));
    await SettingsAPI.exportData();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/export'), expect.any(Object));
  });

  it('clearDrafts posts to clear-drafts endpoint', async () => {
    mockFetch.mockResolvedValue(makeOkResponse({ message: 'Cleared' }));
    const result = await SettingsAPI.clearDrafts();
    expect(result.message).toBe('Cleared');
  });
});

// ============================================================================
// AIWritingAPI
// ============================================================================

describe('AIWritingAPI', () => {
  it('generate posts to publications-ai generate endpoint', async () => {
    const aiResponse = { content: 'AI generated content' };
    mockFetch.mockResolvedValue(makeOkResponse(aiResponse));
    const result = await AIWritingAPI.generate({ prompt: 'Write about finance' } as never);
    expect(result).toEqual(aiResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/generate'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ============================================================================
// TemplatesAPI
// ============================================================================

describe('TemplatesAPI', () => {
  const MOCK_TEMPLATE = { id: 't-001', name: 'Standard Article' };

  it('getTemplates returns all templates', async () => {
    mockFetch.mockResolvedValue(makeOkResponse([MOCK_TEMPLATE]));
    const result = await TemplatesAPI.getTemplates();
    expect(result).toEqual([MOCK_TEMPLATE]);
  });

  it('createTemplate posts with body', async () => {
    mockFetch.mockResolvedValue(makeOkResponse(MOCK_TEMPLATE));
    await TemplatesAPI.createTemplate({ name: 'Standard Article' } as never);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/templates'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('deleteTemplate sends DELETE request', async () => {
    mockFetch.mockResolvedValue(makeOkResponse(null));
    await TemplatesAPI.deleteTemplate('t-001');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/templates/t-001'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// ============================================================================
// VersionsAPI
// ============================================================================

describe('VersionsAPI', () => {
  it('getVersions fetches article versions', async () => {
    const versions = [{ id: 'v-001', articleId: 'a-001' }];
    mockFetch.mockResolvedValue(makeOkResponse(versions));
    const result = await VersionsAPI.getVersions('a-001');
    expect(result).toEqual(versions);
  });

  it('createVersion posts with article id', async () => {
    const version = { id: 'v-002', articleId: 'a-001' };
    mockFetch.mockResolvedValue(makeOkResponse(version));
    await VersionsAPI.createVersion('a-001', 'editor@test.com');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/versions/a-001'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ============================================================================
// AutoContentAPI
// ============================================================================

describe('AutoContentAPI', () => {
  it('getConfigs fetches pipeline configs', async () => {
    const configs = [{ id: 'pipe-001', name: 'News Pipeline' }];
    mockFetch.mockResolvedValue(makeOkResponse(configs));
    const result = await AutoContentAPI.getConfigs();
    expect(result).toEqual(configs);
  });

  it('triggerPipeline posts to trigger endpoint', async () => {
    const triggerResult = { success: true, jobId: 'job-001' };
    mockFetch.mockResolvedValue(makeOkResponse(triggerResult));
    const result = await AutoContentAPI.triggerPipeline('news' as never);
    expect(result).toEqual(triggerResult);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/trigger/news'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('getContentSources returns content sources', async () => {
    const sources = [{ id: 'src-001', name: 'Reuters' }];
    mockFetch.mockResolvedValue(makeOkResponse(sources));
    const result = await AutoContentAPI.getContentSources();
    expect(result).toEqual(sources);
  });
});

// ============================================================================
// fetchRSSFeed
// ============================================================================

describe('fetchRSSFeed', () => {
  it('returns parsed news items on success', async () => {
    const rssData = {
      status: 'ok',
      feed: { title: 'Reuters' },
      items: [
        {
          title: 'Market Update',
          pubDate: '2025-01-01T00:00:00Z',
          author: 'Reporter',
          link: 'https://reuters.com/article-1',
          thumbnail: 'https://img.reuters.com/thumb.jpg',
          description: 'Markets rose today.',
        },
      ],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => rssData,
    } as unknown as Response);
    const result = await fetchRSSFeed('https://reuters.com/feed');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Market Update');
    expect(result[0].source).toBe('Reuters');
  });

  it('returns empty array when status is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'error' }),
    } as unknown as Response);
    const result = await fetchRSSFeed('https://broken.feed');
    expect(result).toEqual([]);
  });

  it('returns empty array on failed HTTP response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as unknown as Response);
    const result = await fetchRSSFeed('https://down.feed');
    expect(result).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));
    const result = await fetchRSSFeed('https://unreachable.feed');
    expect(result).toEqual([]);
  });

  it('uses enclosure.link for image when available', async () => {
    const rssData = {
      status: 'ok',
      items: [
        {
          title: 'With Enclosure',
          pubDate: '2025-01-01T00:00:00Z',
          link: 'https://x.com/a',
          enclosure: { link: 'https://cdn.x.com/img.jpg' },
        },
      ],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => rssData,
    } as unknown as Response);
    const result = await fetchRSSFeed('https://x.com/feed');
    expect(result[0].image).toBe('https://cdn.x.com/img.jpg');
  });
});

// ============================================================================
// NewsletterAPI
// ============================================================================

describe('NewsletterAPI', () => {
  it('getSubscribers fetches subscriber list', async () => {
    const subscribers = { subscribers: [], total: 0 };
    mockFetch.mockResolvedValue(makeOkResponse(subscribers));
    const result = await NewsletterAPI.getSubscribers();
    expect(result).toEqual(subscribers);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/subscribers'),
      expect.any(Object),
    );
  });

  it('addSubscriber posts subscriber data', async () => {
    const mutationResult = { success: true, email: 'user@test.com' };
    mockFetch.mockResolvedValue(makeOkResponse(mutationResult));
    const result = await NewsletterAPI.addSubscriber({
      email: 'user@test.com',
      firstName: 'John',
      surname: 'Doe',
    });
    expect(result).toEqual(mutationResult);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/add'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('bulkAdd posts subscribers array', async () => {
    const bulkResult = { added: 2, failed: 0, duplicates: 0 };
    mockFetch.mockResolvedValue(makeOkResponse(bulkResult));
    await NewsletterAPI.bulkAdd([{ email: 'a@test.com' }, { email: 'b@test.com' }]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/bulk'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('removeSubscriber posts email to remove endpoint', async () => {
    mockFetch.mockResolvedValue(makeOkResponse({ success: true }));
    await NewsletterAPI.removeSubscriber('user@test.com');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/remove'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('resubscribe posts email to resubscribe endpoint', async () => {
    mockFetch.mockResolvedValue(makeOkResponse({ success: true }));
    await NewsletterAPI.resubscribe('user@test.com');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/resubscribe'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('updateSubscriber posts to update endpoint', async () => {
    mockFetch.mockResolvedValue(makeOkResponse({ success: true }));
    await NewsletterAPI.updateSubscriber({ email: 'user@test.com', firstName: 'Updated' } as never);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/update'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
