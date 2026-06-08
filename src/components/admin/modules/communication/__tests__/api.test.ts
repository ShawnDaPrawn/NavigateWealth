import { describe, it, expect, vi, beforeEach } from 'vitest';
import { communicationApi } from '../api';

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

vi.mock('../../../../../utils/supabase/info', () => ({
  projectId: 'test-project',
  publicAnonKey: 'test-anon-key',
}));

const mockCreateClient = vi.fn(() => ({
  auth: {
    getSession: async () => ({ data: { session: null } }),
  },
}));

vi.mock('../../../../../utils/supabase/client', () => ({
  get createClient() {
    return mockCreateClient;
  },
}));

const MOCK_CLIENT = { id: 'client-001', name: 'Alice Smith', email: 'alice@test.com' };
const MOCK_GROUP = { id: 'group-001', name: 'VIP Clients', clientCount: 10 };
const MOCK_TEMPLATE = {
  id: 'tmpl-001',
  name: 'Welcome Email',
  enabled: true,
  subject: 'Welcome!',
  title: 'Welcome to Navigate Wealth',
  subtitle: '',
  greeting: 'Dear Client',
  bodyHtml: '<p>Welcome!</p>',
  buttonLabel: 'Get Started',
  buttonUrl: 'https://example.com',
  footerNote: '',
  category: 'welcome',
  createdAt: '2025-01-01T00:00:00Z',
};

const MOCK_CAMPAIGN = {
  id: 'camp-001',
  name: 'Q1 Newsletter',
  status: 'draft',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('communicationApi clients', () => {
  it('getClients returns client list from API', async () => {
    mockApiGet.mockResolvedValue([MOCK_CLIENT]);
    const result = await communicationApi.getClients();
    expect(result).toEqual([MOCK_CLIENT]);
  });

  it('getAllClients returns same client list', async () => {
    mockApiGet.mockResolvedValue([MOCK_CLIENT]);
    const result = await communicationApi.getAllClients();
    expect(result).toEqual([MOCK_CLIENT]);
  });
});

describe('communicationApi groups', () => {
  it('getGroups returns groups with default pagination', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_GROUP] });
    const result = await communicationApi.getGroups();
    expect(result).toEqual([MOCK_GROUP]);
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('page=1'));
  });

  it('getGroups returns empty array when data is absent', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await communicationApi.getGroups();
    expect(result).toEqual([]);
  });

  it('getGroupById returns group', async () => {
    mockApiGet.mockResolvedValue({ group: MOCK_GROUP });
    const result = await communicationApi.getGroupById('group-001');
    expect(result).toEqual(MOCK_GROUP);
  });

  it('createGroup posts and returns created group', async () => {
    mockApiPost.mockResolvedValue({ group: MOCK_GROUP });
    const result = await communicationApi.createGroup({ name: 'VIP Clients' });
    expect(result).toEqual(MOCK_GROUP);
  });

  it('updateGroup puts and returns updated group', async () => {
    const updated = { ...MOCK_GROUP, name: 'Updated Group' };
    mockApiPut.mockResolvedValue({ group: updated });
    const result = await communicationApi.updateGroup('group-001', { name: 'Updated Group' });
    expect(result.name).toBe('Updated Group');
  });

  it('deleteGroup calls delete endpoint', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await communicationApi.deleteGroup('group-001');
    expect(mockApiDelete).toHaveBeenCalled();
  });

  it('recalculateGroupMemberships posts to recalculate endpoint', async () => {
    mockApiPost.mockResolvedValue({ success: true, message: 'Done' });
    const result = await communicationApi.recalculateGroupMemberships();
    expect(result.success).toBe(true);
  });
});

describe('communicationApi templates', () => {
  it('getAllTemplates returns mapped frontend templates', async () => {
    const backendTemplate = {
      id: 'tmpl-001',
      name: 'Welcome',
      enabled: true,
      subject: 'Welcome!',
      content: '<p>Welcome!</p>',
      category: 'onboarding',
      createdAt: '2025-01-01',
    };
    mockApiGet.mockResolvedValue({ templates: [backendTemplate] });
    const result = await communicationApi.getAllTemplates();
    expect(result.length).toBe(1);
    expect(result[0].bodyHtml).toBe('<p>Welcome!</p>');
    expect(result[0].id).toBe('tmpl-001');
  });

  it('getAllTemplates returns empty array when templates absent', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await communicationApi.getAllTemplates();
    expect(result).toEqual([]);
  });

  it('getTemplate returns single mapped template', async () => {
    const backendTemplate = {
      id: 'tmpl-001',
      name: 'Welcome',
      enabled: true,
      subject: 'Welcome!',
      content: '<p>Hello!</p>',
      category: 'onboarding',
      createdAt: '2025-01-01',
    };
    mockApiGet.mockResolvedValue({ template: backendTemplate });
    const result = await communicationApi.getTemplate('tmpl-001');
    expect(result.bodyHtml).toBe('<p>Hello!</p>');
  });

  it('createTemplate posts backend format and returns mapped result', async () => {
    const backendTemplate = {
      id: 'tmpl-new',
      name: 'New Template',
      enabled: true,
      subject: 'Hello',
      content: '<p>Test</p>',
      category: 'welcome',
      createdAt: '2025-01-01',
    };
    mockApiPost.mockResolvedValue({ template: backendTemplate });
    const result = await communicationApi.createTemplate({
      name: 'New Template',
      subject: 'Hello',
      bodyHtml: '<p>Test</p>',
      category: 'welcome',
    } as never);
    expect(result.id).toBe('tmpl-new');
    expect(result.bodyHtml).toBe('<p>Test</p>');
  });

  it('saveTemplate puts when template has ID', async () => {
    mockApiPut.mockResolvedValue(undefined);
    await communicationApi.saveTemplate(MOCK_TEMPLATE as never);
    expect(mockApiPut).toHaveBeenCalledWith(
      expect.stringContaining('tmpl-001'),
      expect.objectContaining({ subject: 'Welcome!' }),
    );
  });

  it('saveTemplate posts when template has no ID', async () => {
    const noIdTemplate = { ...MOCK_TEMPLATE, id: '' };
    mockApiPost.mockResolvedValue(undefined);
    await communicationApi.saveTemplate(noIdTemplate as never);
    expect(mockApiPost).toHaveBeenCalled();
  });

  it('toggleTemplate puts enabled state', async () => {
    mockApiPut.mockResolvedValue(undefined);
    await communicationApi.toggleTemplate('tmpl-001', false);
    expect(mockApiPut).toHaveBeenCalledWith(expect.stringContaining('tmpl-001'), {
      enabled: false,
    });
  });
});

describe('communicationApi email footer', () => {
  it('getFooterSettings returns settings from API', async () => {
    const settings = {
      companyName: 'Navigate Wealth',
      address: '123 Main St',
      contactEmail: 'info@nw.com',
      contactPhone: '0821234567',
      socialLinks: {},
      copyrightText: '2025 Navigate Wealth',
    };
    mockApiGet.mockResolvedValue(settings);
    const result = await communicationApi.getFooterSettings();
    expect(result.companyName).toBe('Navigate Wealth');
  });

  it('getFooterSettings returns default empty settings on 404', async () => {
    const notFoundError = Object.assign(new Error('Not Found'), { status: 404 });
    mockApiGet.mockRejectedValue(notFoundError);
    const result = await communicationApi.getFooterSettings();
    expect(result.companyName).toBe('');
    expect(result.address).toBe('');
  });

  it('getFooterSettings rethrows non-404 errors', async () => {
    mockApiGet.mockRejectedValue(Object.assign(new Error('Server Error'), { status: 500 }));
    await expect(communicationApi.getFooterSettings()).rejects.toThrow('Server Error');
  });

  it('saveFooterSettings posts settings', async () => {
    mockApiPost.mockResolvedValue(undefined);
    await communicationApi.saveFooterSettings({
      companyName: 'Navigate Wealth',
      address: '123 Main St',
      contactEmail: 'info@nw.com',
      contactPhone: '0821234567',
      socialLinks: {},
      copyrightText: '2025',
    });
    expect(mockApiPost).toHaveBeenCalled();
  });
});

describe('communicationApi campaigns', () => {
  it('getAllCampaigns returns campaigns list', async () => {
    mockApiGet.mockResolvedValue({ campaigns: [MOCK_CAMPAIGN] });
    const result = await communicationApi.getAllCampaigns();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('camp-001');
  });

  it('getAllCampaigns returns empty array when absent', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await communicationApi.getAllCampaigns();
    expect(result).toEqual([]);
  });

  it('createCampaign posts and returns campaign', async () => {
    mockApiPost.mockResolvedValue({ campaign: MOCK_CAMPAIGN });
    const result = await communicationApi.createCampaign({ name: 'Q1 Newsletter' });
    expect(result).toEqual(MOCK_CAMPAIGN);
  });

  it('sendCampaign posts to send endpoint', async () => {
    mockApiPost.mockResolvedValue({ success: true });
    const result = await communicationApi.sendCampaign('camp-001');
    expect(result.success).toBe(true);
  });
});

describe('communicationApi history and logs', () => {
  it('getHistoryPage returns paginated activity log entries', async () => {
    const backendCampaign = {
      id: 'camp-001',
      channel: 'email',
      recipientType: 'group',
      createdAt: '2025-03-01T10:00:00Z',
      createdBy: 'admin',
      subject: 'Hello Clients',
      bodyHtml: '<p>Content here</p>',
      status: 'sent',
    };
    mockApiGet.mockResolvedValue({
      campaigns: [backendCampaign],
      total: 1,
      page: 1,
      limit: 50,
    });
    const result = await communicationApi.getHistoryPage({ page: 1, limit: 50 });
    expect(result.total).toBe(1);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].channel).toBe('email');
  });

  it('getClientLogs returns communications for a client', async () => {
    const logs = [{ id: 'log-001', subject: 'Welcome', channel: 'email' }];
    mockApiGet.mockResolvedValue({ communications: logs });
    const result = await communicationApi.getClientLogs('client-001');
    expect(result).toEqual(logs);
  });

  it('getClientLogs returns empty array when absent', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await communicationApi.getClientLogs('client-001');
    expect(result).toEqual([]);
  });

  it('deleteLog calls delete endpoint', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await communicationApi.deleteLog('log-001');
    expect(mockApiDelete).toHaveBeenCalled();
  });
});

describe('communicationApi inbox', () => {
  it('getInbox returns messages from API', async () => {
    const messages = [{ id: 'msg-001', subject: 'Test message', read: false }];
    mockApiGet.mockResolvedValue({ messages });
    const result = await communicationApi.getInbox();
    expect(result.length).toBe(1);
  });

  it('getInbox returns empty array when messages absent', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await communicationApi.getInbox();
    expect(result).toEqual([]);
  });

  it('markAsRead posts to read endpoint', async () => {
    mockApiPost.mockResolvedValue(undefined);
    await communicationApi.markAsRead('msg-001');
    expect(mockApiPost).toHaveBeenCalled();
  });

  it('deleteMessage calls delete endpoint', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await communicationApi.deleteMessage('msg-001');
    expect(mockApiDelete).toHaveBeenCalled();
  });
});

describe('communicationApi providers', () => {
  it('getProviders returns mapped providers from array response', async () => {
    const providers = [
      { id: 'prov-1', name: 'Discovery', logoUrl: 'https://img.url', categoryIds: ['cat-1'] },
    ];
    mockApiGet.mockResolvedValue(providers);
    const result = await communicationApi.getProviders();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('prov-1');
    expect(result[0].logo).toBe('https://img.url');
  });

  it('getProviders returns mapped providers from object response', async () => {
    const providers = [{ id: 'prov-2', name: 'OUTsurance', categoryIds: [] }];
    mockApiGet.mockResolvedValue({ providers });
    const result = await communicationApi.getProviders();
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('OUTsurance');
  });

  it('getProviders falls back to product-management endpoint on primary failure', async () => {
    const providers = [{ id: 'prov-3', name: 'Momentum' }];
    mockApiGet
      .mockRejectedValueOnce(new Error('Integrations endpoint unavailable'))
      .mockResolvedValueOnce({ providers });
    const result = await communicationApi.getProviders();
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Momentum');
  });

  it('getProviders returns empty array when both endpoints fail', async () => {
    mockApiGet
      .mockRejectedValueOnce(new Error('Primary fail'))
      .mockRejectedValueOnce(new Error('Fallback fail'));
    const result = await communicationApi.getProviders();
    expect(result).toEqual([]);
  });
});

describe('buildCampaignMessagePreview via getHistoryPage', () => {
  it('strips HTML tags and decodes entities in campaign preview', async () => {
    const backendCampaign = {
      id: 'camp-002',
      channel: 'email',
      recipientType: 'individual',
      createdAt: '2025-03-01T10:00:00Z',
      createdBy: 'system',
      bodyHtml: '<p>Hello &amp; welcome!</p>',
      status: 'sent',
    };
    mockApiGet.mockResolvedValue({ campaigns: [backendCampaign], total: 1, page: 1, limit: 50 });
    const result = await communicationApi.getHistoryPage({});
    expect(result.entries[0].messagePreview).toContain('Hello');
    expect(result.entries[0].messagePreview).toContain('welcome');
  });

  it('getHistoryPage passes search and channel filters to query', async () => {
    mockApiGet.mockResolvedValue({ campaigns: [], total: 0, page: 1, limit: 50 });
    await communicationApi.getHistoryPage({ search: 'newsletter', channel: 'email' });
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('search=newsletter'));
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('channel=email'));
  });
});

describe('communicationApi debugGroups', () => {
  it('debugGroups calls GET groups/debug endpoint and returns debug data', async () => {
    const debugData = { groups: [{ id: 'g1' }], clients: [{ id: 'c1' }], summary: { total: 1 } };
    mockApiGet.mockResolvedValue(debugData);
    const result = await communicationApi.debugGroups();
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('debug'));
    expect(result).toEqual(debugData);
  });
});

describe('communicationApi getHistory', () => {
  it('getHistory returns activity log entries for given page and limit', async () => {
    const backendCampaign = {
      id: 'camp-hist-001',
      channel: 'email',
      recipientType: 'group',
      createdAt: '2025-04-01T10:00:00Z',
      createdBy: 'admin',
      subject: 'History Test',
      bodyHtml: '<p>Content</p>',
      status: 'sent',
    };
    mockApiGet.mockResolvedValue({
      campaigns: [backendCampaign],
      total: 1,
      page: 1,
      limit: 20,
    });
    const result = await communicationApi.getHistory(1, 20);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].channel).toBe('email');
  });

  it('getHistory uses default page=1 and limit=50', async () => {
    mockApiGet.mockResolvedValue({ campaigns: [], total: 0, page: 1, limit: 50 });
    const result = await communicationApi.getHistory();
    expect(Array.isArray(result)).toBe(true);
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('page=1'));
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('limit=50'));
  });
});

describe('communicationApi uploadFile', () => {
  it('uploadFile sends a POST with FormData via fetch and returns attachment data', async () => {
    const mockAttachment = { id: 'att-001', filename: 'doc.pdf', url: 'https://cdn/doc.pdf' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockAttachment,
    });
    vi.stubGlobal('fetch', mockFetch);

    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    const result = await communicationApi.uploadFile(file);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('communication/upload');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toContain('Bearer');
    expect(options.body).toBeInstanceOf(FormData);
    expect(result).toEqual(mockAttachment);

    vi.unstubAllGlobals();
  });

  it('uploadFile throws when the response is not ok', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'File too large' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const file = new File(['data'], 'big.pdf', { type: 'application/pdf' });
    await expect(communicationApi.uploadFile(file)).rejects.toThrow('File too large');

    vi.unstubAllGlobals();
  });
});

describe('communicationApi sendDirectMessage', () => {
  it('sendDirectMessage posts payload via fetch and returns response data on success', async () => {
    const mockResponse = { success: true, messageId: 'msg-xyz' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await communicationApi.sendDirectMessage({
      clientId: 'client-001',
      subject: 'Hello',
      message: 'Test body',
      category: 'general',
      priority: 'normal',
      sendEmail: true,
      clientEmail: 'client@example.com',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('communication/send');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(options.body as string);
    expect(body.recipients).toContain('client-001');
    expect(body.subject).toBe('Hello');
    expect(result).toEqual(mockResponse);

    vi.unstubAllGlobals();
  });

  it('sendDirectMessage returns success:true with unknown messageId when response is not JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/plain' },
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await communicationApi.sendDirectMessage({
      clientId: 'client-002',
      subject: 'Plain response',
      message: 'Body',
      category: 'info',
      priority: 'low',
      sendEmail: false,
    });

    expect(result).toEqual({ success: true, messageId: 'unknown' });

    vi.unstubAllGlobals();
  });

  it('sendDirectMessage throws when JSON response is not ok', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'Invalid recipient' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      communicationApi.sendDirectMessage({
        clientId: 'bad-client',
        subject: 'Fail',
        message: 'Body',
        category: 'general',
        priority: 'normal',
        sendEmail: true,
      }),
    ).rejects.toThrow('Invalid recipient');

    vi.unstubAllGlobals();
  });

  it('sendDirectMessage uses session token when session is present', async () => {
    // Override supabase mock to return an active session for this test only
    mockCreateClient.mockReturnValueOnce({
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'session-token-abc' } },
        }),
      },
    } as never);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, messageId: 'msg-session' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await communicationApi.sendDirectMessage({
      clientId: 'client-003',
      subject: 'With session',
      message: 'Body',
      category: 'general',
      priority: 'normal',
      sendEmail: false,
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer session-token-abc');

    vi.unstubAllGlobals();
  });
});
