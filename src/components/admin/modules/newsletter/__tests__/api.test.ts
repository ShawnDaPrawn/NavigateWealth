/**
 * newsletterStudioApi — transport contracts.
 *
 * Pins the endpoint paths, the query-string building, and the response
 * unwrapping (every handler returns `{ success, <entity> }` — the api layer
 * must unwrap and null-guard). All traffic goes through the shared client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { newsletterStudioApi } from '../api';

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('campaigns', () => {
  it('builds the list query string and defaults missing fields', async () => {
    mockApiGet.mockResolvedValue({ campaigns: undefined, total: undefined });
    const result = await newsletterStudioApi.getCampaigns({
      page: 2,
      status: 'draft',
      search: '  wrap  ',
    });
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining('newsletter-studio/campaigns?'),
    );
    const url = mockApiGet.mock.calls[0][0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('status=draft');
    expect(url).toContain('search=wrap');
    expect(result).toEqual({ campaigns: [], total: 0, page: 1, limit: 100 });
  });

  it('omits the all-status filter', async () => {
    mockApiGet.mockResolvedValue({ campaigns: [], total: 0, page: 1, limit: 100 });
    await newsletterStudioApi.getCampaigns({ status: 'all' });
    expect(mockApiGet.mock.calls[0][0]).not.toContain('status=');
  });

  it('unwraps the campaign envelope on create', async () => {
    const campaign = { id: 'c1', name: 'n' };
    mockApiPost.mockResolvedValue({ success: true, campaign });
    const input = { name: 'n', subject: 's', listIds: ['g'], bodyHtml: '<p>b</p>' };
    const result = await newsletterStudioApi.createCampaign(input);
    expect(mockApiPost).toHaveBeenCalledWith('newsletter-studio/campaigns', input);
    expect(result).toBe(campaign);
  });

  it('routes lifecycle actions to their endpoints', async () => {
    mockApiPost.mockResolvedValue({ campaign: { id: 'c1' } });
    await newsletterStudioApi.sendCampaignNow('c1');
    await newsletterStudioApi.pauseCampaign('c1');
    await newsletterStudioApi.resumeCampaign('c1');
    await newsletterStudioApi.cancelCampaign('c1');
    await newsletterStudioApi.scheduleCampaign('c1', '2027-01-01T09:00:00.000Z');
    expect(mockApiPost.mock.calls.map((c) => c[0])).toEqual([
      'newsletter-studio/campaigns/c1/send-now',
      'newsletter-studio/campaigns/c1/pause',
      'newsletter-studio/campaigns/c1/resume',
      'newsletter-studio/campaigns/c1/cancel',
      'newsletter-studio/campaigns/c1/schedule',
    ]);
    expect(mockApiPost.mock.calls[4][1]).toEqual({ scheduledAt: '2027-01-01T09:00:00.000Z' });
  });

  it('sends tests and null-guards the results array', async () => {
    mockApiPost.mockResolvedValue({ success: true });
    const results = await newsletterStudioApi.sendTest('c1', ['me@x.co']);
    expect(mockApiPost).toHaveBeenCalledWith('newsletter-studio/campaigns/c1/test', {
      emails: ['me@x.co'],
    });
    expect(results).toEqual([]);
  });

  it('deletes via the campaign endpoint', async () => {
    mockApiDelete.mockResolvedValue({});
    await newsletterStudioApi.deleteCampaign('c1');
    expect(mockApiDelete).toHaveBeenCalledWith('newsletter-studio/campaigns/c1');
  });
});

describe('recipients and stats', () => {
  it('builds the recipients query with a status filter', async () => {
    mockApiGet.mockResolvedValue({ recipients: [], total: 0, page: 1, limit: 50 });
    await newsletterStudioApi.getRecipients('c1', { page: 3, status: 'failed_terminal' });
    const url = mockApiGet.mock.calls[0][0] as string;
    expect(url).toContain('newsletter-studio/campaigns/c1/recipients?');
    expect(url).toContain('page=3');
    expect(url).toContain('status=failed_terminal');
  });

  it('unwraps stats', async () => {
    const stats = { campaignId: 'c1', sentCount: 5 };
    mockApiGet.mockResolvedValue({ success: true, stats });
    expect(await newsletterStudioApi.getStats('c1')).toBe(stats);
  });
});

describe('lists, templates, dashboard, processor', () => {
  it('null-guards list and template payloads', async () => {
    mockApiGet.mockResolvedValue({});
    expect(await newsletterStudioApi.getLists()).toEqual([]);
    expect(await newsletterStudioApi.getTemplates()).toEqual([]);
  });

  it('creates and updates templates on the right endpoints', async () => {
    mockApiPost.mockResolvedValue({ template: { id: 't1' } });
    mockApiPut.mockResolvedValue({ template: { id: 't1' } });
    const input = { name: 't', bodyHtml: '<p>b</p>' };
    await newsletterStudioApi.createTemplate(input);
    await newsletterStudioApi.updateTemplate('t1', input);
    expect(mockApiPost).toHaveBeenCalledWith('newsletter-studio/templates', input);
    expect(mockApiPut).toHaveBeenCalledWith('newsletter-studio/templates/t1', input);
  });

  it('unwraps the dashboard envelope', async () => {
    const data = { campaigns: { total: 3 } };
    mockApiGet.mockResolvedValue({ success: true, data });
    expect(await newsletterStudioApi.getDashboard()).toBe(data);
    expect(mockApiGet).toHaveBeenCalledWith('newsletter-studio/dashboard');
  });

  it('ticks the processor and unwraps the result', async () => {
    const result = { mode: 'manual', sent: 4 };
    mockApiPost.mockResolvedValue({ success: true, result });
    expect(await newsletterStudioApi.process()).toBe(result);
    expect(mockApiPost).toHaveBeenCalledWith('newsletter-studio/process', {});
  });

  it('tracks clicks with the public ping and returns the stored URL', async () => {
    mockApiPost.mockResolvedValue({ success: true, url: 'https://a.example/one' });
    const url = await newsletterStudioApi.trackClick('c1', 'tok', 'l1');
    expect(mockApiPost).toHaveBeenCalledWith('newsletter-studio/track/click', {
      campaignId: 'c1',
      token: 'tok',
      linkId: 'l1',
    });
    expect(url).toBe('https://a.example/one');
  });
});
