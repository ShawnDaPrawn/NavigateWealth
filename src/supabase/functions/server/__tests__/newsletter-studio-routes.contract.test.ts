/**
 * newsletter-studio-routes.ts — Route Contract Tests
 * ==================================================
 *
 * The thing worth pinning is the three-tier auth split:
 *
 *   - **requireAdmin** on the entire studio surface — newsletters go to the
 *     firm's whole subscriber base, so a slide to requireAuth would let any
 *     signed-in client send one.
 *   - **requireCronAuth** on exactly one route, the cron tick.
 *   - **public** on exactly two routes: the click-through ping and the
 *     RFC 8058 one-click unsubscribe — recipients hold no session; both are
 *     capability-gated by the per-recipient token and 404 on anything unknown.
 *
 * The table is checked against the router's own registrations so a new route
 * cannot be added without appearing here. Validation is real (zod +
 * validateBody); the service and processor are stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { multipart, request, routeRegistrations } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const svc = vi.hoisted(() => {
  const campaign = {
    id: 'c1',
    status: 'draft',
    recipientCount: 0,
    pdf: { storagePath: 'c1/x.pdf', fileName: 'x.pdf', sizeBytes: 10, uploadedAt: 't' },
  };
  return {
    campaign,
    listCampaigns: vi.fn(async () => ({ campaigns: [campaign], total: 1, page: 1, limit: 25 })),
    getCampaignView: vi.fn(async () => campaign),
    createCampaign: vi.fn(async () => campaign),
    updateCampaign: vi.fn(async () => campaign),
    deleteCampaign: vi.fn(async () => undefined),
    attachCampaignPdf: vi.fn(async () => campaign),
    getCampaignPdfUrl: vi.fn(async () => ({
      url: 'https://signed.test/c1/x.pdf',
      fileName: 'x.pdf',
    })),
    scheduleCampaign: vi.fn(async () => ({ ...campaign, status: 'scheduled' })),
    sendCampaignNow: vi.fn(async () => ({ ...campaign, status: 'queued' })),
    resumeCampaign: vi.fn(async () => ({ ...campaign, status: 'queued' })),
    cancelCampaign: vi.fn(async () => ({ ...campaign, status: 'cancelled' })),
    getCampaignRecipients: vi.fn(async () => ({ recipients: [], total: 0, page: 1, limit: 50 })),
    getCampaignStats: vi.fn(async () => ({ campaignId: 'c1' })),
    getDashboardSummary: vi.fn(async () => ({ campaigns: { total: 0 } })),
    listAudienceLists: vi.fn(async () => []),
    recordCampaignClick: vi.fn(async () => ({ url: 'https://signed.test/c1/x.pdf?sig=1' })),
    unsubscribeByRecipientToken: vi.fn(async () => ({ email: 'a@b.co' })),
  };
});

const proc = vi.hoisted(() => ({
  processNewsletterCampaigns: vi.fn(async () => ({ mode: 'manual', sent: 0 })),
  sendCampaignTestEmails: vi.fn(async () => [{ email: 'me@x.co', ok: true }]),
}));

const audit = vi.hoisted(() => ({ record: vi.fn(async () => ({})) }));
const cron = vi.hoisted(() => ({ authorized: false }));
const perms = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(() => false),
  hasCapability: vi.fn(async () => true),
}));

vi.mock('../newsletter-studio-service.ts', () => svc);
vi.mock('../personnel-permissions-service.ts', () => ({ PermissionsService: perms }));
vi.mock('../newsletter-studio-processor.ts', () => proc);
vi.mock('../admin-audit-service.ts', () => ({ AdminAuditService: audit }));
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  return {
    requireAuth: makeRoleGate(['admin', 'client'], 'AUTH_REQUIRED'),
    requireAdmin: makeRoleGate(['admin'], 'ADMIN_REQUIRED'),
  };
});
vi.mock('../cron-auth.ts', () => ({
  requireCronAuth: async (
    c: { json: (b: unknown, s: number) => Response },
    next: () => Promise<void>,
  ) => {
    if (!cron.authorized) {
      return c.json(
        { error: 'Unauthorized — cron auth required', code: 'CRON_AUTH_REQUIRED' },
        401,
      );
    }
    await next();
  },
}));

import app from '../newsletter-studio-routes.ts';

const PDF_FORM = multipart([
  { name: 'file', value: '%PDF-1.4 test', filename: 'issue.pdf', type: 'application/pdf' },
]);

beforeEach(() => {
  vi.clearAllMocks();
  cron.authorized = false;
});

/** Every route, its guard tier, and a request that exercises it. */
const ROUTE_TABLE: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  tier: 'admin' | 'cron' | 'public';
  body?: unknown;
  form?: { body: string; contentType: string };
}[] = [
  { method: 'GET', path: '/dashboard', tier: 'admin' },
  { method: 'GET', path: '/campaigns', tier: 'admin' },
  {
    method: 'POST',
    path: '/campaigns',
    tier: 'admin',
    body: { title: 'n', description: 'd', listIds: ['g1'] },
  },
  { method: 'GET', path: '/campaigns/c1', tier: 'admin' },
  { method: 'PUT', path: '/campaigns/c1', tier: 'admin', body: { title: 't2' } },
  { method: 'DELETE', path: '/campaigns/c1', tier: 'admin' },
  { method: 'POST', path: '/campaigns/c1/pdf', tier: 'admin', form: PDF_FORM },
  { method: 'GET', path: '/campaigns/c1/pdf', tier: 'admin' },
  { method: 'POST', path: '/campaigns/c1/test', tier: 'admin', body: { emails: ['me@x.co'] } },
  {
    method: 'POST',
    path: '/campaigns/c1/schedule',
    tier: 'admin',
    body: { scheduledAt: '2027-01-01T09:00:00.000Z' },
  },
  { method: 'POST', path: '/campaigns/c1/send-now', tier: 'admin' },
  { method: 'POST', path: '/campaigns/c1/resume', tier: 'admin' },
  { method: 'POST', path: '/campaigns/c1/cancel', tier: 'admin' },
  { method: 'GET', path: '/campaigns/c1/recipients', tier: 'admin' },
  { method: 'GET', path: '/campaigns/c1/stats', tier: 'admin' },
  { method: 'GET', path: '/lists', tier: 'admin' },
  { method: 'POST', path: '/process', tier: 'admin', body: {} },
  { method: 'POST', path: '/cron/process', tier: 'cron', body: {} },
  {
    method: 'POST',
    path: '/track/click',
    tier: 'public',
    body: { campaignId: 'c1', token: 'tok', linkId: 'pdf' },
  },
  { method: 'POST', path: '/unsubscribe-oneclick', tier: 'public' },
];

describe('the route table is the router', () => {
  it('covers every registration exactly (a new route must be added here)', () => {
    // Hono registers one row per middleware layer — dedupe to method+path.
    const registered = [
      ...new Set(
        routeRegistrations(app)
          .filter((r) => !['ALL', 'OPTIONS'].includes(r.method))
          .map((r) => `${r.method} ${r.path}`),
      ),
    ].sort();
    const tabled = ROUTE_TABLE.map((r) => `${r.method} ${r.path.replace('/c1', '/:id')}`).sort();
    expect(registered).toEqual(tabled);
  });

  it('no longer carries templates, duplicate or an admin pause', () => {
    const paths = routeRegistrations(app).map((r) => r.path);
    expect(paths.some((p) => p.includes('template'))).toBe(false);
    expect(paths.some((p) => p.endsWith('/duplicate'))).toBe(false);
    expect(paths.some((p) => p.endsWith('/pause'))).toBe(false);
  });
});

describe('authorization tiers', () => {
  it.each(ROUTE_TABLE.filter((r) => r.tier === 'admin'))(
    'admin-only: $method $path 401s anonymous, 403s a client, 200s an admin',
    async ({ method, path, body, form }) => {
      const anon = await request(app, path, { method, body, form, auth: false });
      expect(anon.status).toBe(401);

      const client = await request(app, path, { method, body, form, as: 'client' });
      expect(client.status).toBe(403);

      const admin = await request(app, path, { method, body, form, as: 'admin' });
      expect([200, 201]).toContain(admin.status);
    },
  );

  it('cron tick refuses without cron credentials and runs with them', async () => {
    const denied = await request(app, '/cron/process', { method: 'POST', body: {} });
    expect(denied.status).toBe(401);
    expect(proc.processNewsletterCampaigns).not.toHaveBeenCalled();

    cron.authorized = true;
    const allowed = await request(app, '/cron/process', { method: 'POST', body: {} });
    expect(allowed.status).toBe(200);
    expect(proc.processNewsletterCampaigns).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'cron' }),
    );
  });

  it('click-through is public, returns the signed URL, and 404s unknown ids without detail', async () => {
    const ok = await request(app, '/track/click', {
      method: 'POST',
      auth: false,
      body: { campaignId: 'c1', token: 'tok', linkId: 'pdf' },
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ success: true, url: 'https://signed.test/c1/x.pdf?sig=1' });

    svc.recordCampaignClick.mockResolvedValueOnce(null as never);
    const missing = await request(app, '/track/click', {
      method: 'POST',
      auth: false,
      body: { campaignId: 'nope', token: 'x', linkId: 'l9' },
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'Not found' });
  });
});

describe('the PDF upload route', () => {
  it('hands the bytes and file name to the service', async () => {
    const res = await request(app, '/campaigns/c1/pdf', {
      method: 'POST',
      as: 'admin',
      form: PDF_FORM,
    });
    expect(res.status).toBe(200);
    expect(svc.attachCampaignPdf).toHaveBeenCalledWith('c1', {
      bytes: expect.any(Uint8Array),
      fileName: 'issue.pdf',
    });
    const [, file] = svc.attachCampaignPdf.mock.calls[0] as unknown as [
      string,
      { bytes: Uint8Array },
    ];
    expect(new TextDecoder().decode(file.bytes)).toBe('%PDF-1.4 test');
  });

  it('400s when no file is attached and never reaches the service', async () => {
    const res = await request(app, '/campaigns/c1/pdf', {
      method: 'POST',
      as: 'admin',
      form: multipart([{ name: 'note', value: 'no file here' }]),
    });
    expect(res.status).toBe(400);
    expect(svc.attachCampaignPdf).not.toHaveBeenCalled();
  });

  it('returns the signed preview URL', async () => {
    const res = await request(app, '/campaigns/c1/pdf', { method: 'GET', as: 'admin' });
    expect(await res.json()).toEqual({
      success: true,
      url: 'https://signed.test/c1/x.pdf',
      fileName: 'x.pdf',
    });
  });
});

describe('capability tiers within admin (review finding)', () => {
  it('refuses a mutation when the stored permission set lacks the capability', async () => {
    perms.hasCapability.mockResolvedValueOnce(false);
    const res = await request(app, '/campaigns', {
      method: 'POST',
      as: 'admin',
      body: { title: 'n', description: 'd', listIds: ['g1'] },
    });
    expect(res.status).toBe(403);
    expect(perms.hasCapability).toHaveBeenCalledWith(expect.any(String), 'newsletter', 'create');
    expect(svc.createCampaign).not.toHaveBeenCalled();
  });

  it('maps send/delete/upload mutations to their capabilities', async () => {
    await request(app, '/campaigns/c1/send-now', { method: 'POST', as: 'admin' });
    expect(perms.hasCapability).toHaveBeenCalledWith(expect.any(String), 'newsletter', 'send');

    await request(app, '/campaigns/c1', { method: 'DELETE', as: 'admin' });
    expect(perms.hasCapability).toHaveBeenCalledWith(expect.any(String), 'newsletter', 'delete');

    await request(app, '/campaigns/c1/pdf', { method: 'POST', as: 'admin', form: PDF_FORM });
    expect(perms.hasCapability).toHaveBeenCalledWith(expect.any(String), 'newsletter', 'create');
  });

  it('super admins bypass the capability check entirely', async () => {
    perms.isSuperAdmin.mockReturnValueOnce(true);
    const res = await request(app, '/campaigns/c1/resume', { method: 'POST', as: 'admin' });
    expect(res.status).toBe(200);
    expect(perms.hasCapability).not.toHaveBeenCalled();
  });

  it("gates reads on 'view' — recipient PII is not authorised by the admin role alone", async () => {
    await request(app, '/campaigns', { method: 'GET', as: 'admin' });
    expect(perms.hasCapability).toHaveBeenCalledWith(expect.any(String), 'newsletter', 'view');

    perms.hasCapability.mockResolvedValueOnce(false);
    const denied = await request(app, '/campaigns/c1/recipients', { method: 'GET', as: 'admin' });
    expect(denied.status).toBe(403);
    expect(svc.getCampaignRecipients).not.toHaveBeenCalled();
  });

  it.each([
    ['/dashboard'],
    ['/campaigns'],
    ['/campaigns/c1'],
    ['/campaigns/c1/pdf'],
    ['/campaigns/c1/recipients'],
    ['/campaigns/c1/stats'],
    ['/lists'],
  ])('read route %s is denied without the view capability', async (path) => {
    perms.hasCapability.mockResolvedValueOnce(false);
    const res = await request(app, path, { method: 'GET', as: 'admin' });
    expect(res.status).toBe(403);
  });
});

describe('one-click unsubscribe (RFC 8058)', () => {
  it('is public, identified by query params, and unsubscribes via the service', async () => {
    const res = await request(app, '/unsubscribe-oneclick?c=c1&t=tok', {
      method: 'POST',
      auth: false,
    });
    expect(res.status).toBe(200);
    expect(svc.unsubscribeByRecipientToken).toHaveBeenCalledWith('c1', 'tok');
  });

  it('404s unknown ids without detail', async () => {
    svc.unsubscribeByRecipientToken.mockResolvedValueOnce(null as never);
    const res = await request(app, '/unsubscribe-oneclick?c=nope&t=x', {
      method: 'POST',
      auth: false,
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('rejects requests missing the identifying params', async () => {
    const res = await request(app, '/unsubscribe-oneclick', { method: 'POST', auth: false });
    expect(res.status).toBe(400);
    expect(svc.unsubscribeByRecipientToken).not.toHaveBeenCalled();
  });
});

describe('validation is real', () => {
  it('rejects a newsletter without audiences or without a description', async () => {
    const noLists = await request(app, '/campaigns', {
      method: 'POST',
      as: 'admin',
      body: { title: 'n', description: 'd', listIds: [] },
    });
    expect(noLists.status).toBe(400);

    const noDescription = await request(app, '/campaigns', {
      method: 'POST',
      as: 'admin',
      body: { title: 'n', listIds: ['g1'] },
    });
    expect(noDescription.status).toBe(400);
    expect(svc.createCampaign).not.toHaveBeenCalled();
  });

  it('rejects a test send beyond five addresses', async () => {
    const res = await request(app, '/campaigns/c1/test', {
      method: 'POST',
      as: 'admin',
      body: { emails: ['1@x.co', '2@x.co', '3@x.co', '4@x.co', '5@x.co', '6@x.co'] },
    });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed schedule timestamp', async () => {
    const res = await request(app, '/campaigns/c1/schedule', {
      method: 'POST',
      as: 'admin',
      body: { scheduledAt: 'tomorrow-ish' },
    });
    expect(res.status).toBe(400);
  });

  it('treats an empty processor body as {} (validateOptionalBody)', async () => {
    const res = await request(app, '/process', { method: 'POST', as: 'admin' });
    expect(res.status).toBe(200);
    expect(proc.processNewsletterCampaigns).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'manual' }),
    );
  });

  it('surfaces a service ValidationError (no PDF yet) as a 400', async () => {
    const { ValidationError } = await import('../error.middleware.ts');
    svc.sendCampaignNow.mockRejectedValueOnce(
      new ValidationError('Upload the newsletter PDF before sending'),
    );
    const res = await request(app, '/campaigns/c1/send-now', { method: 'POST', as: 'admin' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/Upload the newsletter PDF/);
  });
});

describe('side channels', () => {
  it('send-now kicks an inline delivery pass but never fails the request on it', async () => {
    proc.processNewsletterCampaigns.mockRejectedValueOnce(new Error('kv down'));
    const res = await request(app, '/campaigns/c1/send-now', { method: 'POST', as: 'admin' });
    expect(res.status).toBe(200);
    expect(proc.processNewsletterCampaigns).toHaveBeenCalled();
  });

  it('a failing audit write never fails the request', async () => {
    audit.record.mockRejectedValueOnce(new Error('audit kv down'));
    const res = await request(app, '/campaigns', {
      method: 'POST',
      as: 'admin',
      body: { title: 'n', description: 'd', listIds: ['g1'] },
    });
    expect(res.status).toBe(201);
  });
});
