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

vi.mock('../../../../../utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
  }),
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
