/**
 * newsletter-intake-routes.ts — auth + payload gate.
 *
 * The detector-visible guard is constantTimeEqual on app.use('*') (the goaml
 * precedent). These tests pin the runtime: a missing/wrong token is 401, the
 * dedicated header reaches the service through the env override or the Vault
 * oracle, the shared cron path still works, the PDF is judged by its bytes,
 * dry runs write nothing, and a replay reports the existing draft with a 200
 * rather than creating a second one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { multipart } from './helpers/contract-harness.ts';

const env = vi.hoisted(() => ({
  NW_NEWSLETTER_INTAKE_TOKEN: 'intake-token',
  // The env override is honoured only under DENO_ENV=development; the suite
  // opts in per case so the production shape (unset) is the default.
  DENO_ENV: '',
  SUPABASE_URL: 'https://test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
}));

vi.stubGlobal('Deno', {
  env: { get: (name: string) => env[name as keyof typeof env] ?? '' },
});

const svc = vi.hoisted(() => ({
  createDraftFromIntake: vi.fn(async () => ({
    campaignId: 'draft-1',
    duplicate: false,
    reviewUrl: 'https://www.navigatewealth.co/admin?module=newsletter&campaign=draft-1',
    notified: true,
  })),
  assertKnownLists: vi.fn(async (ids: string[]) => ids.map((id) => `Name of ${id}`)),
}));
const isAuthorizedCronRequest = vi.hoisted(() => vi.fn(async () => false));
const verifyNewsletterIntakeToken = vi.hoisted(() => vi.fn(async (_c: string) => false));
const listAudienceLists = vi.hoisted(() =>
  vi.fn(async () => [
    {
      id: 'sys_newsletter_contacts',
      name: 'Newsletter Contacts',
      memberCount: 205,
      type: 'system',
    },
  ]),
);

vi.mock('../newsletter-intake-service.ts', () => svc);
vi.mock('../newsletter-studio-audience.ts', () => ({
  listAudienceLists,
  SUBSCRIBER_LIST_ID: 'sys_newsletter_contacts',
}));
vi.mock('../newsletter-intake-auth.ts', () => ({
  verifyNewsletterIntakeToken: (c: string) => verifyNewsletterIntakeToken(c),
  NEWSLETTER_INTAKE_VAULT_SECRET: 'navigatewealth_newsletter_intake_token',
}));
vi.mock('../cron-auth.ts', () => ({
  isAuthorizedCronRequest: (...a: unknown[]) => isAuthorizedCronRequest(...a),
  requireCronAuth: async (_c: unknown, next: () => Promise<void>) => next(),
  CRON_AUTH_HEADER: 'x-nw-cron-auth',
}));
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const app = (await import('../newsletter-intake-routes.ts')).default;

const TOKEN = { 'x-nw-newsletter-intake-token': 'intake-token' };

function submit(
  headers: Record<string, string>,
  fields: Record<string, string>,
  file: { value: string; filename?: string; type?: string } | null = {
    value: '%PDF-1.4 hello',
    filename: 'sept.pdf',
    type: 'application/pdf',
  },
) {
  const parts = Object.entries(fields).map(([name, value]) => ({ name, value }));
  if (file) parts.push({ name: 'file', ...file });
  const form = multipart(parts);
  return app.request('/submit', {
    method: 'POST',
    headers: { 'Content-Type': form.contentType, ...headers },
    body: form.body,
  });
}

const FIELDS = { title: 'September issue', description: 'What mattered in September.' };

beforeEach(() => {
  vi.clearAllMocks();
  isAuthorizedCronRequest.mockResolvedValue(false);
  verifyNewsletterIntakeToken.mockResolvedValue(false);
  env.NW_NEWSLETTER_INTAKE_TOKEN = 'intake-token';
  env.DENO_ENV = 'development';
});

describe('auth', () => {
  it('rejects a request with no token', async () => {
    const res = await submit({}, FIELDS);
    expect(res.status).toBe(401);
    expect(svc.createDraftFromIntake).not.toHaveBeenCalled();
  });

  it('rejects a wrong dedicated token', async () => {
    const res = await submit({ 'x-nw-newsletter-intake-token': 'nope' }, FIELDS);
    expect(res.status).toBe(401);
  });

  it('does not accept the dedicated header when no token is configured', async () => {
    env.NW_NEWSLETTER_INTAKE_TOKEN = '';
    const res = await submit({ 'x-nw-newsletter-intake-token': '' }, FIELDS);
    expect(res.status).toBe(401);
    // An empty header never reaches the oracle.
    expect(verifyNewsletterIntakeToken).not.toHaveBeenCalled();
  });

  it('ignores the env override outside development, so a stale env token is not a second credential', async () => {
    env.DENO_ENV = '';
    verifyNewsletterIntakeToken.mockResolvedValue(false);
    const res = await submit(TOKEN, FIELDS);
    expect(res.status).toBe(401);
    // The header still reached the oracle — Vault is the only production check.
    expect(verifyNewsletterIntakeToken).toHaveBeenCalledWith('intake-token');
    expect(svc.createDraftFromIntake).not.toHaveBeenCalled();
  });

  it('honours the env override under DENO_ENV=development without consulting the oracle', async () => {
    env.DENO_ENV = 'development';
    expect((await submit(TOKEN, FIELDS)).status).toBe(201);
    expect(verifyNewsletterIntakeToken).not.toHaveBeenCalled();
  });

  it('accepts the Vault-verified token with no env override configured (production path)', async () => {
    env.DENO_ENV = '';
    env.NW_NEWSLETTER_INTAKE_TOKEN = '';
    verifyNewsletterIntakeToken.mockImplementation(async (c: string) => c === 'vault-token');

    expect((await submit({ 'x-nw-newsletter-intake-token': 'vault-token' }, FIELDS)).status).toBe(
      201,
    );
    expect(verifyNewsletterIntakeToken).toHaveBeenCalledWith('vault-token');

    expect((await submit({ 'x-nw-newsletter-intake-token': 'stale' }, FIELDS)).status).toBe(401);
    expect(svc.createDraftFromIntake).toHaveBeenCalledTimes(1);
  });

  it('rejects a header that neither the env override nor the oracle accepts', async () => {
    verifyNewsletterIntakeToken.mockResolvedValue(false);
    const res = await submit({ 'x-nw-newsletter-intake-token': 'nope' }, FIELDS);
    expect(res.status).toBe(401);
    expect(verifyNewsletterIntakeToken).toHaveBeenCalledWith('nope');
  });

  it('accepts the dedicated token and the shared cron path', async () => {
    expect((await submit(TOKEN, FIELDS)).status).toBe(201);

    isAuthorizedCronRequest.mockResolvedValue(true);
    expect((await submit({}, FIELDS)).status).toBe(201);
    expect(svc.createDraftFromIntake).toHaveBeenCalledTimes(2);
  });

  it('guards the lists lookup the same way', async () => {
    expect((await app.request('/lists')).status).toBe(401);
    const ok = await app.request('/lists', { headers: TOKEN });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({
      success: true,
      lists: [{ id: 'sys_newsletter_contacts', name: 'Newsletter Contacts', memberCount: 205 }],
    });
  });
});

describe('payload', () => {
  it('hands the fields and bytes to the service, defaulting the audience to the subscriber base', async () => {
    const res = await submit(TOKEN, {
      ...FIELDS,
      idempotencyKey: '2026-09',
      submittedBy: 'claude',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      success: true,
      campaignId: 'draft-1',
      duplicate: false,
    });

    const input = svc.createDraftFromIntake.mock.calls[0][0] as unknown as {
      title: string;
      listIds: string[];
      fileName: string;
      bytes: Uint8Array;
      idempotencyKey: string;
      submittedBy: string;
    };
    expect(input.title).toBe('September issue');
    expect(input.listIds).toEqual(['sys_newsletter_contacts']);
    expect(input.fileName).toBe('sept.pdf');
    expect(new TextDecoder().decode(input.bytes)).toBe('%PDF-1.4 hello');
    expect(input.idempotencyKey).toBe('2026-09');
    expect(input.submittedBy).toBe('claude');
  });

  it('accepts listIds as a JSON array or a comma list', async () => {
    await submit(TOKEN, { ...FIELDS, listIds: '["sys_all","g2"]' });
    expect((svc.createDraftFromIntake.mock.calls[0][0] as { listIds: string[] }).listIds).toEqual([
      'sys_all',
      'g2',
    ]);
    await submit(TOKEN, { ...FIELDS, listIds: 'sys_all, g3' });
    expect((svc.createDraftFromIntake.mock.calls[1][0] as { listIds: string[] }).listIds).toEqual([
      'sys_all',
      'g3',
    ]);
  });

  it('reports a replayed idempotency key as 200 duplicate', async () => {
    svc.createDraftFromIntake.mockResolvedValueOnce({
      campaignId: 'draft-1',
      duplicate: true,
      reviewUrl: 'x',
      notified: true,
    });
    const res = await submit(TOKEN, { ...FIELDS, idempotencyKey: '2026-09' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true, campaignId: 'draft-1' });
  });

  it('400s without a file, with a non-PDF, or with a bad idempotency key', async () => {
    expect((await submit(TOKEN, FIELDS, null)).status).toBe(400);
    const notPdf = await submit(TOKEN, FIELDS, { value: 'MZ nope', filename: 'x.pdf' });
    expect(notPdf.status).toBe(400);
    expect(((await notPdf.json()) as { error: string }).error).toMatch(/not a PDF/);
    expect((await submit(TOKEN, { ...FIELDS, idempotencyKey: 'has spaces!' })).status).toBe(400);
    expect((await submit(TOKEN, { title: 'only a title' })).status).toBe(400);
    expect(svc.createDraftFromIntake).not.toHaveBeenCalled();
  });

  it('a dry run validates everything and writes nothing', async () => {
    const res = await submit(TOKEN, { ...FIELDS, dryRun: 'true', listIds: 'sys_all' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      dryRun: true,
      wouldCreate: {
        title: 'September issue',
        listIds: ['sys_all'],
        listNames: ['Name of sys_all'],
      },
    });
    expect(svc.assertKnownLists).toHaveBeenCalledWith(['sys_all']);
    expect(svc.createDraftFromIntake).not.toHaveBeenCalled();
  });

  it('turns an unknown audience into a 400 with the valid ids', async () => {
    const { ValidationError } = await import('../error.middleware.ts');
    svc.createDraftFromIntake.mockRejectedValueOnce(
      new ValidationError('Unknown audience id(s): nope. Valid ids: sys_newsletter_contacts'),
    );
    const res = await submit(TOKEN, { ...FIELDS, listIds: 'nope' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/Valid ids/);
  });
});
