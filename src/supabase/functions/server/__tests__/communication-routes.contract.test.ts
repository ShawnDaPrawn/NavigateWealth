/**
 * communication-routes.ts — Route Contract Tests
 * ==============================================
 *
 * 27 routes, ~192 statements, 0% coverage before this file. This is the module
 * that sends email and WhatsApp to the firm's entire client base, so the thing
 * worth pinning is not a payload shape — it is the two-tier authorization split
 * and the one place ownership is decided.
 *
 *   1. **The tier split.** 24 routes are `requireAdmin`; exactly three —
 *      `GET /inbox`, `POST /read/:id`, `DELETE /inbox/:id` — are `requireAuth`,
 *      because a client must be able to read and clear their own messages. If a
 *      route ever slid from `requireAdmin` to `requireAuth`, any signed-in
 *      client could send a message, or a campaign, to every other client. The
 *      split is therefore asserted per route, per role, from one table — and the
 *      table is checked against the router's own registrations so a new route
 *      cannot be added without appearing here.
 *   2. **Inbox ownership comes from the session, never the request.** All three
 *      client-facing routes pass `c.get('userId')` to the service. A refactor
 *      that read the id from the body or the query string would be a
 *      one-parameter IDOR over every client's private correspondence, so each
 *      is asserted to ignore a caller-supplied id.
 *   3. **Audit writes are deliberately NOT awaited** here (`.catch(() => {})`),
 *      unlike the refund-clusters module which awaits every one. That is a
 *      latency-for-durability trade, and what the tests pin is the half that
 *      must hold either way: a failing audit write never fails the request.
 *
 * WHAT IS REAL: the zod schemas, `formatZodError`, `asyncHandler` and the real
 * route wiring. The service layer and the audit recorder are stubbed — the
 * service is a 20-function facade over email/WhatsApp delivery, and its own
 * behaviour belongs to its own suite.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, routeRegistrations } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const svc = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  sendDirectMessage: vi.fn(),
  uploadFile: vi.fn(),
  getHistory: vi.fn(),
  getInbox: vi.fn(),
  markAsRead: vi.fn(),
  deleteMessage: vi.fn(),
  getAllClients: vi.fn(),
  getAllGroups: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  getAllTemplates: vi.fn(),
  createTemplate: vi.fn(),
  getTemplateById: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  getFooterSettings: vi.fn(),
  saveFooterSettings: vi.fn(),
  listAllCampaignsWithCreatorNames: vi.fn(),
  listCampaignsFiltered: vi.fn(),
  createCampaign: vi.fn(),
  sendCampaign: vi.fn(),
  deleteCommunicationLog: vi.fn(),
  listUnsubscribed: vi.fn(),
  unsubscribeContact: vi.fn(),
  resubscribeContact: vi.fn(),
}));

vi.mock('../communication-service.ts', () => ({
  CommunicationService: class {
    sendMessage = svc.sendMessage;
    sendDirectMessage = svc.sendDirectMessage;
    uploadFile = svc.uploadFile;
    getHistory = svc.getHistory;
    getInbox = svc.getInbox;
    markAsRead = svc.markAsRead;
    deleteMessage = svc.deleteMessage;
    getAllClients = svc.getAllClients;
    getAllGroups = svc.getAllGroups;
    createGroup = svc.createGroup;
    updateGroup = svc.updateGroup;
    deleteGroup = svc.deleteGroup;
    getAllTemplates = svc.getAllTemplates;
    createTemplate = svc.createTemplate;
    getTemplateById = svc.getTemplateById;
    updateTemplate = svc.updateTemplate;
    deleteTemplate = svc.deleteTemplate;
    getFooterSettings = svc.getFooterSettings;
    saveFooterSettings = svc.saveFooterSettings;
    listAllCampaignsWithCreatorNames = svc.listAllCampaignsWithCreatorNames;
    listCampaignsFiltered = svc.listCampaignsFiltered;
    createCampaign = svc.createCampaign;
    sendCampaign = svc.sendCampaign;
    deleteCommunicationLog = svc.deleteCommunicationLog;
    listUnsubscribed = svc.listUnsubscribed;
    unsubscribeContact = svc.unsubscribeContact;
    resubscribeContact = svc.resubscribeContact;
  },
}));

const repo = vi.hoisted(() => ({
  fetchMatcherClients: vi.fn(),
  recalculateAllGroupMemberships: vi.fn(),
  getAllGroups: vi.fn(),
  syncAutoProviderGroups: vi.fn(),
}));

vi.mock('../communication-repo.ts', () => ({
  fetchMatcherClients: repo.fetchMatcherClients,
  recalculateAllGroupMemberships: repo.recalculateAllGroupMemberships,
  getAllGroups: repo.getAllGroups,
}));

vi.mock('../provider-group-service.ts', () => ({
  syncAutoProviderGroups: repo.syncAutoProviderGroups,
}));

const auditRecord = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../admin-audit-service.ts', () => ({ AdminAuditService: { record: auditRecord } }));

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.mock('../quality-issues-runtime-server.ts', () => ({ scheduleRuntimeServerIssue: vi.fn() }));

/**
 * Two gates, mirroring auth-mw. `requireAuth` admits any authenticated role;
 * `requireAdmin` admits only the three admin spellings. Sharing one mock for
 * both would erase the distinction this whole file is about.
 */
vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  return {
    requireAuth: makeRoleGate(
      [
        'client',
        'adviser',
        'paraplanner',
        'compliance',
        'worker',
        'admin',
        'super_admin',
        'super-admin',
      ],
      'FORBIDDEN',
      'client',
    ),
    requireAdmin: makeRoleGate(['admin', 'super_admin', 'super-admin'], 'FORBIDDEN_ADMIN'),
  };
});

const app = (await import('../communication-routes.ts')).default;

const GROUP = 'grp-1';
const TEMPLATE = 'tpl-1';
const CAMPAIGN = 'cmp-1';
const MESSAGE = 'msg-1';

const req = (path: string, opts: Parameters<typeof request>[2] = {}) =>
  request(app, path, { as: 'admin', ...opts });

const validMessage = () => ({
  subject: 'Quarterly review',
  content: 'Your review is due.',
  recipients: ['client-1', 'client-2'],
});

beforeEach(() => {
  vi.clearAllMocks();
  svc.sendMessage.mockResolvedValue({ sent: 2 });
  // POST /send goes through sendDirectMessage — it sends AND files the history
  // row that makes an individual message visible in the Communication Centre.
  svc.sendDirectMessage.mockResolvedValue({
    success: true,
    messageId: 'msg-1',
    status: 'completed',
    stats: { sent: 2, failed: 0, total: 2 },
    results: [],
    cc: [],
  });
  svc.uploadFile.mockResolvedValue({ url: 'https://storage/f.pdf' });
  svc.getHistory.mockResolvedValue([]);
  svc.getInbox.mockResolvedValue([]);
  svc.markAsRead.mockResolvedValue(undefined);
  svc.deleteMessage.mockResolvedValue(undefined);
  svc.getAllClients.mockResolvedValue([]);
  svc.getAllGroups.mockResolvedValue([]);
  svc.createGroup.mockResolvedValue({ id: GROUP });
  svc.updateGroup.mockResolvedValue({ id: GROUP });
  svc.deleteGroup.mockResolvedValue(undefined);
  svc.getAllTemplates.mockResolvedValue([]);
  svc.createTemplate.mockResolvedValue({ id: TEMPLATE });
  svc.getTemplateById.mockResolvedValue({ id: TEMPLATE });
  svc.updateTemplate.mockResolvedValue({ id: TEMPLATE });
  svc.deleteTemplate.mockResolvedValue(undefined);
  svc.getFooterSettings.mockResolvedValue({ enabled: true });
  svc.saveFooterSettings.mockResolvedValue(undefined);
  svc.listAllCampaignsWithCreatorNames.mockResolvedValue({ campaigns: [] });
  svc.listCampaignsFiltered.mockResolvedValue({ campaigns: [], total: 0 });
  svc.createCampaign.mockResolvedValue({ id: CAMPAIGN });
  svc.sendCampaign.mockResolvedValue({ sent: 5 });
  svc.deleteCommunicationLog.mockResolvedValue(undefined);
  svc.listUnsubscribed.mockResolvedValue([]);
  svc.unsubscribeContact.mockResolvedValue({
    alreadyUnsubscribed: false,
    contact: { email: 'alex@example.com', unsubscribedBy: 'admin' },
  });
  svc.resubscribeContact.mockResolvedValue({ alreadySubscribed: false });
  repo.fetchMatcherClients.mockResolvedValue([]);
  repo.recalculateAllGroupMemberships.mockResolvedValue(undefined);
  repo.getAllGroups.mockResolvedValue([]);
  repo.syncAutoProviderGroups.mockResolvedValue({ created: 0, updated: 0 });
  auditRecord.mockResolvedValue(undefined);
});

// ============================================================================
// THE TIER SPLIT
// ============================================================================

type Route = { name: string; method: string; path: string; body?: unknown; form?: boolean };

/** The 24 routes only an admin may reach. */
const ADMIN_ROUTES: Route[] = [
  { name: 'send message', method: 'POST', path: '/send', body: {} },
  { name: 'upload attachment', method: 'POST', path: '/upload', form: true },
  { name: 'history', method: 'GET', path: '/history' },
  { name: 'client list', method: 'GET', path: '/clients' },
  { name: 'list groups', method: 'GET', path: '/groups' },
  { name: 'create group', method: 'POST', path: '/groups', body: {} },
  { name: 'update group', method: 'PUT', path: `/groups/${GROUP}`, body: {} },
  { name: 'delete group', method: 'DELETE', path: `/groups/${GROUP}` },
  { name: 'recalculate groups', method: 'POST', path: '/groups/recalculate', body: {} },
  { name: 'group debug', method: 'GET', path: '/groups/debug' },
  { name: 'list templates', method: 'GET', path: '/templates' },
  { name: 'create template', method: 'POST', path: '/templates', body: {} },
  { name: 'get template', method: 'GET', path: `/templates/${TEMPLATE}` },
  { name: 'update template', method: 'PUT', path: `/templates/${TEMPLATE}`, body: {} },
  { name: 'delete template', method: 'DELETE', path: `/templates/${TEMPLATE}` },
  { name: 'get email footer', method: 'GET', path: '/email-footer' },
  { name: 'save email footer', method: 'POST', path: '/email-footer', body: {} },
  { name: 'list campaigns', method: 'GET', path: '/campaigns' },
  { name: 'create campaign', method: 'POST', path: '/campaigns', body: {} },
  { name: 'send campaign', method: 'POST', path: `/campaigns/${CAMPAIGN}/send`, body: {} },
  { name: 'delete log', method: 'DELETE', path: `/logs/${MESSAGE}` },
  { name: 'list unsubscribed', method: 'GET', path: '/unsubscribed' },
  { name: 'unsubscribe contact', method: 'POST', path: '/unsubscribe', body: {} },
  { name: 'resubscribe contact', method: 'POST', path: '/resubscribe', body: {} },
];

/** The three routes a client may reach — their own inbox, and nothing else. */
const CLIENT_ROUTES: Route[] = [
  { name: 'own inbox', method: 'GET', path: '/inbox' },
  { name: 'mark own message read', method: 'POST', path: `/read/${MESSAGE}`, body: {} },
  { name: 'delete own message', method: 'DELETE', path: `/inbox/${MESSAGE}` },
];

const NON_ADMIN_ROLES = ['client', 'adviser', 'paraplanner', 'compliance', 'worker'];

const call = (r: Route, opts: Parameters<typeof request>[2] = {}) =>
  req(r.path, {
    method: r.method,
    ...(r.form
      ? { form: { body: '', contentType: 'application/json' } }
      : r.body !== undefined
        ? { body: r.body }
        : {}),
    ...opts,
  });

describe('authorization tiers', () => {
  it('accounts for every route the module registers', () => {
    const registered = routeRegistrations(app)
      .filter((r) => r.method !== 'ALL')
      .map((r) => `${r.method} ${r.path}`);
    // Each route registers twice (guard + handler), so compare the distinct set.
    expect(new Set(registered).size).toBe(ADMIN_ROUTES.length + CLIENT_ROUTES.length);
  });

  it.each([...ADMIN_ROUTES, ...CLIENT_ROUTES])(
    '$method $path ($name) rejects an unauthenticated caller',
    async (r) => {
      const res = await call(r, { auth: false });
      expect(res.status).toBe(401);
      expect(svc.sendMessage).not.toHaveBeenCalled();
      expect(svc.sendDirectMessage).not.toHaveBeenCalled();
      expect(svc.sendCampaign).not.toHaveBeenCalled();
    },
  );

  describe.each(NON_ADMIN_ROLES)('as %s', (role) => {
    it.each(ADMIN_ROUTES)('$method $path ($name) is forbidden', async (r) => {
      const res = await call(r, { as: role });
      expect(res.status).toBe(403);
      // Nothing reaches a client: no send, no campaign, no group write.
      expect(svc.sendMessage).not.toHaveBeenCalled();
      expect(svc.sendDirectMessage).not.toHaveBeenCalled();
      expect(svc.sendCampaign).not.toHaveBeenCalled();
      expect(svc.createGroup).not.toHaveBeenCalled();
      expect(svc.deleteGroup).not.toHaveBeenCalled();
      expect(svc.getAllClients).not.toHaveBeenCalled();
    });
  });

  describe.each(['admin', 'super_admin', 'super-admin'])('as %s', (role) => {
    it.each(ADMIN_ROUTES)('$method $path ($name) passes the gate', async (r) => {
      const res = await call(r, { as: role });
      expect([401, 403]).not.toContain(res.status);
    });
  });

  describe.each([...NON_ADMIN_ROLES, 'admin'])('as %s', (role) => {
    it.each(CLIENT_ROUTES)('$method $path ($name) is allowed', async (r) => {
      // Every authenticated role reaches their own inbox, admins included —
      // an admin is also a person with messages.
      const res = await call(r, { as: role });
      expect(res.status).toBe(200);
    });
  });
});

// ============================================================================
// INBOX OWNERSHIP — the session decides, not the request
// ============================================================================

describe('inbox ownership', () => {
  it('reads the inbox of the caller, not of an id they supply', async () => {
    await req('/inbox?userId=someone-else', { as: 'client', user: 'client-me' });
    expect(svc.getInbox).toHaveBeenCalledWith('client-me');
  });

  it('marks read against the caller, not an id they supply', async () => {
    await req(`/read/${MESSAGE}`, {
      method: 'POST',
      as: 'client',
      user: 'client-me',
      body: { userId: 'someone-else' },
    });
    expect(svc.markAsRead).toHaveBeenCalledWith('client-me', MESSAGE);
  });

  it('deletes against the caller, not an id they supply', async () => {
    await req(`/inbox/${MESSAGE}?userId=someone-else`, {
      method: 'DELETE',
      as: 'client',
      user: 'client-me',
    });
    // The service scopes the delete by userId, so passing the caller's own id is
    // the only thing preventing one client clearing another's messages by id.
    expect(svc.deleteMessage).toHaveBeenCalledWith('client-me', MESSAGE);
  });

  it.each(['getInbox', 'markAsRead', 'deleteMessage'] as const)(
    'never calls %s with an id from the request',
    async (fn) => {
      const attacker = 'client-attacker';
      const victim = 'client-victim';
      await req('/inbox?userId=' + victim, { as: 'client', user: attacker });
      await req(`/read/${MESSAGE}`, {
        method: 'POST',
        as: 'client',
        user: attacker,
        body: { userId: victim },
      });
      await req(`/inbox/${MESSAGE}?userId=${victim}`, {
        method: 'DELETE',
        as: 'client',
        user: attacker,
      });
      for (const [firstArg] of svc[fn].mock.calls) expect(firstArg).toBe(attacker);
    },
  );
});

// ============================================================================
// VALIDATION — the gate on everything that leaves the building
// ============================================================================

describe('send validation', () => {
  it('sends a well-formed message', async () => {
    const res = await req('/send', { method: 'POST', body: validMessage() });
    expect(res.status).toBe(200);
    expect(svc.sendDirectMessage).toHaveBeenCalledWith(
      'test-user',
      expect.objectContaining(validMessage()),
    );
  });

  it.each([
    ['no subject', { subject: undefined }],
    ['an empty subject', { subject: '' }],
    ['an over-long subject', { subject: 'x'.repeat(501) }],
    ['no content', { content: undefined }],
    ['empty content', { content: '' }],
    ['no recipients', { recipients: undefined }],
    ['an empty recipient list', { recipients: [] }],
    ['a recipient that is an empty string', { recipients: [''] }],
    ['recipients that are not an array', { recipients: 'client-1' }],
    ['an unknown channel', { channel: 'carrier-pigeon' }],
    ['an unknown priority', { priority: 'immediate' }],
  ])('refuses a message with %s', async (_label, over) => {
    const body: Record<string, unknown> = { ...validMessage(), ...over };
    for (const [k, v] of Object.entries(over)) if (v === undefined) delete body[k];
    const res = await req('/send', { method: 'POST', body });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
    // Nothing left the building.
    expect(svc.sendDirectMessage).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it.each([
    ['email', 'email'],
    ['whatsapp', 'whatsapp'],
    ['sms', 'sms'],
  ])('accepts the %s channel', async (_label, channel) => {
    const res = await req('/send', { method: 'POST', body: { ...validMessage(), channel } });
    expect(res.status).toBe(200);
  });

  it('defaults the channel to email and the priority to normal', async () => {
    await req('/send', { method: 'POST', body: validMessage() });
    expect(svc.sendDirectMessage.mock.calls[0][1]).toMatchObject({
      channel: 'email',
      priority: 'normal',
      sendEmail: false,
    });
  });

  it('attributes the send to the acting admin, not to anything in the body', async () => {
    await req('/send', {
      method: 'POST',
      user: 'admin-7',
      body: { ...validMessage(), senderId: 'someone-else' },
    });
    expect(svc.sendDirectMessage.mock.calls[0][0]).toBe('admin-7');
  });
});

describe('group and template validation', () => {
  it.each([
    ['create group', 'POST', '/groups', { description: 'no name' }],
    ['create template', 'POST', '/templates', { subject: 'no name or body' }],
    ['create campaign', 'POST', '/campaigns', {}],
    ['unsubscribe contact', 'POST', '/unsubscribe', {}],
    ['resubscribe contact', 'POST', '/resubscribe', {}],
  ] as const)('refuses an invalid %s', async (_label, method, path, body) => {
    const res = await req(path, { method, body });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('creates a group with the defaults the schema supplies', async () => {
    const res = await req('/groups', { method: 'POST', body: { name: 'Retirees' } });
    expect(res.status).toBe(200);
    expect(svc.createGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Retirees',
        description: '',
        color: '#6d28d9',
        clientIds: [],
      }),
    );
  });

  it('rejects an external contact with a malformed email', async () => {
    const res = await req('/groups', {
      method: 'POST',
      body: { name: 'Newsletter', externalContacts: [{ email: 'not-an-email' }] },
    });
    expect(res.status).toBe(400);
    expect(svc.createGroup).not.toHaveBeenCalled();
  });

  it('accepts a partial group update', async () => {
    // UpdateGroupSchema is CreateGroupSchema.partial(), so a rename alone is
    // valid — requiring the whole object would make every edit a full replace.
    const res = await req(`/groups/${GROUP}`, { method: 'PUT', body: { name: 'Renamed' } });
    expect(res.status).toBe(200);
    expect(svc.updateGroup).toHaveBeenCalledWith(
      GROUP,
      expect.objectContaining({ name: 'Renamed' }),
    );
  });

  it('accepts a partial template update', async () => {
    const res = await req(`/templates/${TEMPLATE}`, { method: 'PUT', body: { subject: 'New' } });
    expect(res.status).toBe(200);
    expect(svc.updateTemplate).toHaveBeenCalledWith(
      TEMPLATE,
      expect.objectContaining({ subject: 'New' }),
    );
  });

  it('requires a body on a new template', async () => {
    const res = await req('/templates', { method: 'POST', body: { name: 'Welcome' } });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a template that does not exist', async () => {
    svc.getTemplateById.mockResolvedValue(null);
    const res = await req(`/templates/${TEMPLATE}`);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Template not found');
  });

  it('accepts an empty-string email on the footer settings', async () => {
    // `.email().or(z.literal(''))` — clearing the field must be possible, and
    // an empty string is not a malformed address.
    const res = await req('/email-footer', { method: 'POST', body: { email: '' } });
    expect(res.status).toBe(200);
    expect(svc.saveFooterSettings).toHaveBeenCalled();
  });

  it('refuses a malformed email on the footer settings', async () => {
    const res = await req('/email-footer', { method: 'POST', body: { email: 'not-an-email' } });
    expect(res.status).toBe(400);
    expect(svc.saveFooterSettings).not.toHaveBeenCalled();
  });

  it('keeps unknown footer fields rather than failing the save', async () => {
    // The footer schema is `.passthrough()`: it is a gate on the fields it
    // knows, not a closed contract.
    const res = await req('/email-footer', {
      method: 'POST',
      body: { companyName: 'Navigate Wealth', customLine: 'FSP 12345' },
    });
    expect(res.status).toBe(200);
    expect(svc.saveFooterSettings).toHaveBeenCalledWith(
      expect.objectContaining({ customLine: 'FSP 12345' }),
    );
  });
});

describe('attachment upload', () => {
  it('refuses a form with no file part', async () => {
    const { multipart } = await import('./helpers/contract-harness.ts');
    const res = await req('/upload', {
      method: 'POST',
      form: multipart([{ name: 'caption', value: 'no file here' }]),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('No file provided');
    expect(svc.uploadFile).not.toHaveBeenCalled();
  });

  it('surfaces a body that is not a form as a 500, not a silent success', async () => {
    // `c.req.formData()` throws on a JSON body rather than returning an empty
    // record, so this lands on `asyncHandler`'s envelope. Recorded rather than
    // asserted as desirable: a 400 naming the expected content type would be
    // better, and this test is what would go red if someone improves it.
    const res = await req('/upload', { method: 'POST', body: { file: 'nope' } });
    expect(res.status).toBe(500);
    expect(svc.uploadFile).not.toHaveBeenCalled();
  });

  it('refuses a text field posing as the file', async () => {
    // `formData.get('file')` returns a string when the part has no filename;
    // the `instanceof File` guard is what stops a string reaching `uploadFile`.
    const { multipart } = await import('./helpers/contract-harness.ts');
    const res = await req('/upload', {
      method: 'POST',
      form: multipart([{ name: 'file', value: 'not-a-file' }]),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('No file provided');
    expect(svc.uploadFile).not.toHaveBeenCalled();
  });
});

// ============================================================================
// AUDIT — non-blocking on purpose, and it must stay non-fatal
// ============================================================================

type AuditCase = {
  name: string;
  method: string;
  path: string;
  body?: unknown;
  action: string;
  severity: string;
};

const AUDITED: AuditCase[] = [
  {
    name: 'send message',
    method: 'POST',
    path: '/send',
    body: undefined,
    action: 'message_sent',
    severity: 'info',
  },
  {
    name: 'create group',
    method: 'POST',
    path: '/groups',
    body: { name: 'G' },
    action: 'group_created',
    severity: 'info',
  },
  {
    name: 'update group',
    method: 'PUT',
    path: `/groups/${GROUP}`,
    body: { name: 'G' },
    action: 'group_updated',
    severity: 'info',
  },
  {
    name: 'delete group',
    method: 'DELETE',
    path: `/groups/${GROUP}`,
    action: 'group_deleted',
    severity: 'warning',
  },
  {
    name: 'create template',
    method: 'POST',
    path: '/templates',
    body: { name: 'T', bodyHtml: '<p>x</p>' },
    action: 'template_created',
    severity: 'info',
  },
  {
    name: 'update template',
    method: 'PUT',
    path: `/templates/${TEMPLATE}`,
    body: { name: 'T' },
    action: 'template_updated',
    severity: 'info',
  },
  {
    name: 'save footer',
    method: 'POST',
    path: '/email-footer',
    body: { companyName: 'NW' },
    action: 'email_footer_updated',
    severity: 'info',
  },
  {
    name: 'create campaign',
    method: 'POST',
    path: '/campaigns',
    body: {
      name: 'C',
      subject: 'S',
      bodyHtml: '<p>B</p>',
      recipientType: 'group',
    },
    action: 'campaign_created',
    severity: 'info',
  },
  {
    name: 'send campaign',
    method: 'POST',
    path: `/campaigns/${CAMPAIGN}/send`,
    body: {},
    action: 'campaign_sent',
    severity: 'warning',
  },
  {
    name: 'delete log',
    method: 'DELETE',
    path: `/logs/${MESSAGE}`,
    action: 'communication_log_deleted',
    severity: 'warning',
  },
  {
    name: 'unsubscribe contact',
    method: 'POST',
    path: '/unsubscribe',
    body: { email: 'alex@example.com', clientId: 'client-1' },
    action: 'contact_unsubscribed',
    severity: 'warning',
  },
  {
    name: 'resubscribe contact',
    method: 'POST',
    path: '/resubscribe',
    body: { email: 'alex@example.com', clientId: 'client-1' },
    action: 'contact_resubscribed',
    severity: 'info',
  },
];

const auditCall = (r: AuditCase, opts: Parameters<typeof request>[2] = {}) =>
  req(r.path, {
    method: r.method,
    ...(r.path === '/send'
      ? { body: validMessage() }
      : r.body !== undefined
        ? { body: r.body }
        : {}),
    ...opts,
  });

describe('audit trail', () => {
  it.each(AUDITED)('$name records $action at $severity', async (r) => {
    const res = await auditCall(r, { user: 'admin-42' });
    expect(res.status).toBe(200);
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: r.action,
        severity: r.severity,
        actorId: 'admin-42',
        actorRole: 'admin',
      }),
    );
  });

  it.each(AUDITED)('$name still succeeds when the audit write fails', async (r) => {
    // `.catch(() => {})` at every call site. These writes are deliberately not
    // awaited — the trade is latency for durability — so what must hold is that
    // a KV problem in the audit log never blocks a client's message from being
    // sent or a template from being saved.
    auditRecord.mockRejectedValue(new Error('kv unavailable'));
    const res = await auditCall(r);
    expect(res.status).toBe(200);
  });

  it.each(AUDITED)('$name does not audit when the request is refused', async (r) => {
    const res = await auditCall(r, { as: 'client' });
    expect(res.status).toBe(403);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('falls back to a role of admin when the context has none', async () => {
    // `(c.get('userRole') as string | undefined) || 'admin'` — the gate always
    // sets it today, so this is the branch that keeps an audit row attributable
    // if a future gate stops setting the role.
    await req('/send', { method: 'POST', as: 'super_admin', body: validMessage() });
    expect(auditRecord.mock.calls[0][0]).toMatchObject({ actorRole: 'super_admin' });
  });

  it('records how many recipients a message went to', async () => {
    await req('/send', {
      method: 'POST',
      body: { ...validMessage(), recipients: ['a', 'b', 'c', 'd'] },
    });
    expect(auditRecord.mock.calls[0][0]).toMatchObject({
      metadata: { recipientCount: 4 },
      entityType: 'communication',
    });
  });

  it('never puts message content in the audit metadata', async () => {
    // The audit log is read by more people than the outbox is, and a message
    // body can carry a client's financial position.
    await req('/send', {
      method: 'POST',
      body: { ...validMessage(), content: 'Your portfolio is worth R4,200,000' },
    });
    expect(JSON.stringify(auditRecord.mock.calls)).not.toContain('R4,200,000');
  });
});

// ============================================================================
// CAMPAIGN LISTING — a bounded page, and one deliberate full dump
// ============================================================================

describe('campaign listing', () => {
  it.each([
    ['5', 5],
    ['100', 100],
    ['1', 1],
    ['0', 1],
    ['-10', 1],
    ['9999', 100],
    ['abc', 50],
    ['', 50],
  ])('clamps a limit of %p to %i', async (limit, expected) => {
    await req(`/campaigns?limit=${limit}`);
    expect(svc.listCampaignsFiltered.mock.calls[0][0]).toMatchObject({ limit: expected });
  });

  it.each([
    ['3', 3],
    ['1', 1],
    ['0', 1],
    ['-5', 1],
    ['abc', 1],
  ])('clamps a page of %p to %i', async (page, expected) => {
    await req(`/campaigns?page=${page}`);
    expect(svc.listCampaignsFiltered.mock.calls[0][0]).toMatchObject({ page: expected });
  });

  it.each([
    ['email', 'email'],
    ['whatsapp', 'whatsapp'],
    ['sms', undefined],
    ['EMAIL', undefined],
    ['', undefined],
  ])('passes a channel filter of %p through as %p', async (channel, expected) => {
    await req(`/campaigns?channel=${channel}`);
    expect(svc.listCampaignsFiltered.mock.calls[0][0].channel).toBe(expected);
  });

  it.each([
    ['single', 'single'],
    ['multiple', 'multiple'],
    ['group', 'group'],
    ['everyone', undefined],
  ])('passes a recipientType of %p through as %p', async (recipientType, expected) => {
    await req(`/campaigns?recipientType=${recipientType}`);
    expect(svc.listCampaignsFiltered.mock.calls[0][0].recipientType).toBe(expected);
  });

  it('trims a search term and drops an empty one', async () => {
    await req('/campaigns?search=%20%20quarterly%20%20');
    expect(svc.listCampaignsFiltered.mock.calls[0][0].search).toBe('quarterly');
    svc.listCampaignsFiltered.mockClear();
    await req('/campaigns?search=%20%20');
    expect(svc.listCampaignsFiltered.mock.calls[0][0].search).toBeUndefined();
  });

  it('serves an unpaginated dump only for the explicit all=1', async () => {
    // `?all=1` bypasses the page/limit clamp entirely. It exists for the admin
    // export view; pinning the exact trigger keeps it from being reachable by
    // accident (e.g. `all=0` or `all=true`).
    await req('/campaigns?all=1');
    expect(svc.listAllCampaignsWithCreatorNames).toHaveBeenCalledTimes(1);
    expect(svc.listCampaignsFiltered).not.toHaveBeenCalled();

    for (const all of ['0', 'true', 'yes', '']) {
      svc.listAllCampaignsWithCreatorNames.mockClear();
      svc.listCampaignsFiltered.mockClear();
      await req(`/campaigns?all=${all}`);
      expect(svc.listAllCampaignsWithCreatorNames).not.toHaveBeenCalled();
      expect(svc.listCampaignsFiltered).toHaveBeenCalledTimes(1);
    }
  });
});

describe('group recalculation', () => {
  it('fetches the client set once and shares it with both passes', async () => {
    // The provider-group sync and the membership recalculation both need every
    // client. Fetching twice doubles the heaviest read in the module.
    const clients = [{ id: 'c1' }, { id: 'c2' }];
    repo.fetchMatcherClients.mockResolvedValue(clients);
    const res = await req('/groups/recalculate', { method: 'POST', body: {} });
    expect(res.status).toBe(200);
    expect(repo.fetchMatcherClients).toHaveBeenCalledTimes(1);
    expect(repo.syncAutoProviderGroups).toHaveBeenCalledWith(clients);
    expect(repo.recalculateAllGroupMemberships).toHaveBeenCalledWith(clients);
  });

  it('reports what the provider sync did', async () => {
    repo.syncAutoProviderGroups.mockResolvedValue({ created: 2, updated: 3 });
    const res = await req('/groups/recalculate', { method: 'POST', body: {} });
    expect(await res.json()).toMatchObject({
      success: true,
      providerGroups: { created: 2, updated: 3 },
    });
  });

  it('syncs provider groups before recalculating membership', async () => {
    // Order matters: a provider group created by the sync must exist before the
    // membership pass runs, or its members are only filled in on the next run.
    await req('/groups/recalculate', { method: 'POST', body: {} });
    expect(repo.syncAutoProviderGroups.mock.invocationCallOrder[0]).toBeLessThan(
      repo.recalculateAllGroupMemberships.mock.invocationCallOrder[0],
    );
  });
});
