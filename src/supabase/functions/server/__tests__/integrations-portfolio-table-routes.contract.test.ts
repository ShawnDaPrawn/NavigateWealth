/**
 * integrations-portfolio-table-routes.ts — route contract tests.
 *
 * The router is mounted with the REAL service against an in-memory KV, because
 * the thing worth pinning is the matching rule an outside agent's rows are
 * judged by: client name + policy number, the hidden ids when a downloaded
 * sheet carries them, a policy number that belongs to someone else refused,
 * a locked field never overwritten, an invalid cell refusing its whole row,
 * and a dry run writing nothing. The gate is pinned the way the social
 * library's is: the token works without a session, a wrong one does not, and
 * a signed-in client never gets in.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import {
  kvStore,
  multipartBinary,
  request,
  routeRegistrations,
} from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const auth = vi.hoisted(() => ({
  verifyPortfolioTableToken: vi.fn(async (candidate: string) => candidate === 'the-real-token'),
}));
const cron = vi.hoisted(() => ({ isAuthorizedCronRequest: vi.fn(async () => false) }));

vi.mock('../kv_store.tsx', async () => {
  const { makeKvMock } = await import('./helpers/contract-harness.ts');
  return makeKvMock();
});
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../integrations-portfolio-table-auth.ts', () => auth);
vi.mock('../cron-auth.ts', () => cron);
vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  return {
    requireAuth: makeRoleGate(['admin', 'client'], 'AUTH_REQUIRED'),
    requireAdmin: makeRoleGate(['admin'], 'ADMIN_REQUIRED'),
  };
});
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(async (key: string) => ({
          data: { signedUrl: `https://signed.test/${key}` },
          error: null,
        })),
      }),
    },
  }),
}));

import app from '../integrations-portfolio-table-routes.ts';

const TOKEN_HEADER = 'x-nw-portfolio-token';
const SCOPE = 'providerId=p1&categoryId=employee_benefits';

const seed = () => {
  kvStore.clear();
  kvStore.set('provider:p1', {
    id: 'p1',
    name: 'Allan Gray',
    category_ids: ['employee_benefits', 'retirement_pre'],
  });
  kvStore.set('provider:p2', { id: 'p2', name: 'Brightrock', categoryIds: ['risk_planning'] });
  kvStore.set('user_profile:c1:personal_info', { firstName: 'Thandi', lastName: 'Nkosi' });
  kvStore.set('user_profile:c2:personal_info', {
    personalInformation: { firstName: 'John', surname: 'Smith' },
  });
  kvStore.set('policies:client:c1', [
    {
      id: 'pol1',
      clientId: 'c1',
      categoryId: 'employee_benefits',
      providerId: 'p1',
      providerName: 'Allan Gray',
      data: { eb_1: 'EB-001', eb_2: 'Acme', eb_3: 'Group Life', eb_4: 100000, eb_5: 500 },
      createdAt: '2025-12-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lockedFields: ['eb_5'],
      document: {
        storageKey: 'c1/pol1/print.pdf',
        fileName: 'print.pdf',
        fileSize: 1234,
        mimeType: 'application/pdf',
        provider: 'Allan Gray',
        productType: 'Employee Benefits',
        documentType: 'policy_schedule',
        uploadDate: '2026-02-01T00:00:00.000Z',
        uploadedBy: 'admin',
      },
    },
    {
      id: 'pol-risk',
      clientId: 'c1',
      categoryId: 'risk_planning',
      providerId: 'p2',
      providerName: 'Brightrock',
      data: { rp_1: 'RP-1' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  kvStore.set('policies:client:c2', [
    {
      id: 'pol2',
      clientId: 'c2',
      categoryId: 'employee_benefits',
      providerId: 'p1',
      providerName: 'Allan Gray',
      data: { eb_1: 'EB-002', eb_4: 50000 },
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
  ]);
};

const policiesOf = (clientId: string) =>
  kvStore.get(`policies:client:${clientId}`) as Array<{
    id: string;
    data: Record<string, unknown>;
    updatedAt: string;
    integrationSyncHistory?: Array<{ source: string; fieldsApplied: string[] }>;
  }>;

const historyEntries = () =>
  [...kvStore.keys()].filter((key) => key.startsWith('history:p1:employee_benefits'));

const postRows = (
  rows: unknown[],
  extra: Record<string, unknown> = {},
  options: { as?: string | null; auth?: boolean } = {},
) =>
  request(app, '/', {
    method: 'POST',
    body: { providerId: 'p1', categoryId: 'employee_benefits', rows, ...extra },
    ...options,
  });

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

beforeEach(() => {
  vi.clearAllMocks();
  cron.isAuthorizedCronRequest.mockResolvedValue(false);
  auth.verifyPortfolioTableToken.mockImplementation(async (c: string) => c === 'the-real-token');
  seed();
});

describe('route inventory', () => {
  it('registers exactly the documented routes', () => {
    const registered = [
      ...new Set(
        routeRegistrations(app)
          .filter((r) => r.method !== 'ALL')
          .map((r) => `${r.method} ${r.path}`),
      ),
    ];
    expect(registered.sort()).toEqual(
      ['GET /providers', 'GET /', 'GET /download', 'GET /print', 'POST /', 'POST /upload'].sort(),
    );
  });
});

describe('the gate', () => {
  it('turns away a caller with no credential at all', async () => {
    expect((await request(app, `/?${SCOPE}`, { auth: false })).status).toBe(401);
  });

  it('turns away a signed-in client, who is not an admin', async () => {
    expect((await request(app, `/?${SCOPE}`, { as: 'client' })).status).toBe(403);
  });

  it('lets the admin browser through on its session', async () => {
    expect((await request(app, `/?${SCOPE}`, { as: 'admin' })).status).toBe(200);
  });

  it('lets an agent through on the integration token, with no session', async () => {
    const res = await app.request(`/?${SCOPE}`, { headers: { [TOKEN_HEADER]: 'the-real-token' } });
    expect(res.status).toBe(200);
    expect(auth.verifyPortfolioTableToken).toHaveBeenCalledWith('the-real-token');
  });

  it('does not accept a wrong token as a credential', async () => {
    const res = await app.request(`/?${SCOPE}`, { headers: { [TOKEN_HEADER]: 'guessed' } });
    expect(res.status).toBe(401);
  });

  it('accepts the shared cron credential', async () => {
    cron.isAuthorizedCronRequest.mockResolvedValue(true);
    expect((await request(app, `/?${SCOPE}`, { auth: false })).status).toBe(200);
  });

  it('guards the write the same way', async () => {
    expect(
      (await postRows([{ clientName: 'x', policyNumber: 'y', values: {} }], {}, { auth: false }))
        .status,
    ).toBe(401);
    expect(
      (await postRows([{ clientName: 'x', policyNumber: 'y', values: {} }], {}, { as: 'client' }))
        .status,
    ).toBe(403);
  });
});

describe('GET / — the table', () => {
  it('400s without a scope and on an unknown provider', async () => {
    expect((await request(app, '/?providerId=p1')).status).toBe(400);
    const ghost = await request(app, '/?providerId=ghost&categoryId=employee_benefits');
    expect(ghost.status).toBe(400);
    expect(await ghost.json()).toMatchObject({ error: 'Invalid provider ID' });
  });

  it('lays the book out as the product structure, one row per policy, sorted by client', async () => {
    const res = await request(app, `/?${SCOPE}`);
    expect(res.status).toBe(200);
    const { table } = (await res.json()) as { table: Record<string, any> };

    expect(table).toMatchObject({
      providerId: 'p1',
      providerName: 'Allan Gray',
      categoryId: 'employee_benefits',
      categoryLabel: 'Employee Benefits',
      policyCount: 2,
      clientCount: 2,
    });
    // Columns are the default Employee Benefits schema, in schema order, with
    // the policy number flagged as the match field.
    expect(table.columns.map((c: { id: string }) => c.id)).toEqual([
      'eb_1',
      'eb_inception',
      'eb_2',
      'eb_3',
      'eb_4',
      'eb_5',
      'eb_6',
    ]);
    expect(table.columns[0]).toMatchObject({ name: 'Policy Number', isPolicyNumber: true });
    expect(table.columns[3].options).toContain('Group Life');

    expect(table.rows.map((r: { clientName: string }) => r.clientName)).toEqual([
      'John Smith',
      'Thandi Nkosi',
    ]);
    const thandi = table.rows[1];
    expect(thandi).toMatchObject({
      clientId: 'c1',
      policyId: 'pol1',
      policyNumber: 'EB-001',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lockedFields: ['eb_5'],
      values: { eb_1: 'EB-001', eb_2: 'Acme', eb_4: 100000, eb_6: null },
      policyPrint: { fileName: 'print.pdf', uploadDate: '2026-02-01T00:00:00.000Z' },
      lastSync: null,
    });
    expect(table.rows[0].policyPrint).toBeNull();
    // The other provider's policy on the same client is not in this book.
    expect(table.rows.some((r: { policyId: string }) => r.policyId === 'pol-risk')).toBe(false);
  });
});

describe('GET /providers — the catalogue', () => {
  it('lists every provider with its products and how many policies each holds', async () => {
    const res = await request(app, '/providers');
    expect(res.status).toBe(200);
    const { providers } = (await res.json()) as { providers: Array<Record<string, any>> };
    expect(providers.map((p) => p.providerName)).toEqual(['Allan Gray', 'Brightrock']);
    expect(providers[0].categories).toEqual([
      {
        categoryId: 'employee_benefits',
        categoryLabel: 'Employee Benefits',
        policyCount: 2,
        clientCount: 2,
      },
      {
        categoryId: 'retirement_pre',
        categoryLabel: 'Pre-Retirement',
        policyCount: 0,
        clientCount: 0,
      },
    ]);
    expect(providers[1].categories[0]).toMatchObject({
      categoryId: 'risk_planning',
      policyCount: 1,
    });
  });
});

describe('GET /print — the policy print', () => {
  it('400s without both ids, 404s for a missing policy or a policy with no print', async () => {
    expect((await request(app, '/print?policyId=pol1')).status).toBe(400);
    expect((await request(app, '/print?policyId=ghost&clientId=c1')).status).toBe(404);
    const none = await request(app, '/print?policyId=pol2&clientId=c2');
    expect(none.status).toBe(404);
    expect(await none.json()).toMatchObject({ error: expect.stringContaining('No policy print') });
  });

  it('returns a signed link and the document metadata', async () => {
    const res = await request(app, '/print?policyId=pol1&clientId=c1');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      url: 'https://signed.test/c1/pol1/print.pdf',
      document: { fileName: 'print.pdf' },
    });
  });
});

describe('POST / — applying rows by client name + policy number', () => {
  it('rejects a body with no rows, a missing scope, and a body that is not JSON', async () => {
    expect((await postRows([])).status).toBe(400);
    expect((await request(app, '/', { method: 'POST', body: { rows: [{}] } })).status).toBe(400);
    expect((await request(app, '/', { method: 'POST', raw: 'nope' })).status).toBe(400);
  });

  it('a dry run reports what would change and writes nothing', async () => {
    const res = await postRows(
      [
        {
          clientName: 'Thandi Nkosi',
          policyNumber: 'EB-001',
          values: { 'Cover Amount': 120000, eb_5: 999, Employer: 'Acme', Mystery: 'x' },
        },
      ],
      { dryRun: true },
    );
    expect(res.status).toBe(200);
    const report = await res.json();
    expect(report).toMatchObject({
      success: true,
      dryRun: true,
      providerName: 'Allan Gray',
      source: 'api',
      runId: null,
      summary: { rows: 1, updated: 1, unchanged: 0, clientsTouched: 1 },
    });
    const [row] = report.rows;
    expect(row).toMatchObject({
      rowNumber: 1,
      status: 'updated',
      policyId: 'pol1',
      clientId: 'c1',
      matchedClientName: 'Thandi Nkosi',
      matchedBy: 'client_name_policy_number',
      changes: [{ fieldId: 'eb_4', fieldName: 'Cover Amount', oldValue: 100000, newValue: 120000 }],
    });
    // A locked field is reported, not written; an unknown key is ignored, not fatal.
    expect(row.warnings).toEqual(
      expect.arrayContaining([
        'Monthly Contribution is locked and was not changed',
        expect.stringContaining('"Mystery" is not a field'),
      ]),
    );
    expect(policiesOf('c1')[0].data.eb_4).toBe(100000);
    expect(historyEntries()).toEqual([]);
  });

  it('applies the differences, records provenance and history, and leaves locks alone', async () => {
    const res = await postRows(
      [
        {
          clientName: 'nkosi, THANDI',
          policyNumber: 'eb 001',
          values: { eb_4: '125,000', eb_5: 999, 'Benefit Type': 'group life' },
        },
        { clientName: 'John Smith', policyNumber: 'EB-002', values: { eb_4: 50000 } },
      ],
      { submittedBy: 'grokbot' },
      { auth: false },
    ).then((r) => r);
    // No session was sent: the request above must fail unless it carries the token.
    expect(res.status).toBe(401);

    const applied = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [TOKEN_HEADER]: 'the-real-token' },
      body: JSON.stringify({
        providerId: 'p1',
        categoryId: 'employee_benefits',
        submittedBy: 'grokbot',
        rows: [
          {
            clientName: 'nkosi, THANDI',
            policyNumber: 'eb 001',
            values: { eb_4: '125,000', eb_5: 999, 'Benefit Type': 'group life' },
          },
          { clientName: 'John Smith', policyNumber: 'EB-002', values: { eb_4: 50000 } },
        ],
      }),
    });
    expect(applied.status).toBe(200);
    const report = await applied.json();
    expect(report.dryRun).toBe(false);
    expect(report.summary).toMatchObject({ rows: 2, updated: 1, unchanged: 1, clientsTouched: 1 });
    expect(report.rows[0]).toMatchObject({ status: 'updated', policyId: 'pol1' });
    expect(report.rows[1]).toMatchObject({ status: 'unchanged', policyId: 'pol2' });
    expect(typeof report.runId).toBe('string');

    const [pol1] = policiesOf('c1');
    expect(pol1.data.eb_4).toBe(125000);
    expect(pol1.data.eb_5).toBe(500);
    expect(pol1.data.eb_3).toBe('Group Life');
    expect(pol1.updatedAt > '2026-01-01T00:00:00.000Z').toBe(true);
    expect(pol1.integrationSyncHistory?.at(-1)).toMatchObject({
      source: 'portfolio_table',
      fieldsApplied: ['eb_4'],
    });
    // The run is kept as a record of what changed, and the header's history
    // gains one entry naming who wrote.
    expect(kvStore.get(`sync-run:${report.runId}`)).toMatchObject({ source: 'portfolio_table' });
    const [historyKey] = historyEntries();
    expect(kvStore.get(historyKey)).toMatchObject({
      fileName: 'Portfolio update via API (agent:grokbot)',
      publishedRows: 1,
      rowCount: 2,
      status: 'success',
    });
    // Client totals were recalculated for the touched client.
    expect(kvStore.has('user_profile:c1:client_keys')).toBe(true);
  });

  it('refuses a policy number that belongs to a different client', async () => {
    const res = await postRows([
      { clientName: 'Someone Else', policyNumber: 'EB-001', values: { eb_4: 1 } },
    ]);
    const report = await res.json();
    expect(report.rows[0]).toMatchObject({
      status: 'client_mismatch',
      matchedClientName: 'Thandi Nkosi',
      changes: [],
    });
    expect(report.rows[0].errors[0]).toMatch(/belongs to Thandi Nkosi/);
    expect(policiesOf('c1')[0].data.eb_4).toBe(100000);
    expect(report.summary).toMatchObject({ clientMismatch: 1, updated: 0 });
  });

  it('reports an unknown policy number, a missing key, and an invalid cell', async () => {
    const res = await postRows([
      { clientName: 'Thandi Nkosi', policyNumber: 'EB-999', values: { eb_4: 1 } },
      { clientName: 'Thandi Nkosi', values: { eb_4: 1 } },
      { policyNumber: 'EB-001', values: { eb_4: 1 } },
      {
        clientName: 'Thandi Nkosi',
        policyNumber: 'EB-001',
        values: { eb_4: 'lots', eb_2: 'Beta' },
      },
      { clientName: 'Thandi Nkosi', policyNumber: 'EB-001', values: { 'Benefit Type': 'Yacht' } },
    ]);
    const report = await res.json();
    expect(report.rows.map((r: { status: string }) => r.status)).toEqual([
      'unmatched',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
    ]);
    expect(report.rows[1].errors).toEqual(['Policy number is required for matching']);
    expect(report.rows[2].errors).toEqual(['Client name is required for matching']);
    // An invalid cell refuses the whole row: the valid Employer change beside it is not applied.
    expect(report.rows[3].errors).toEqual(['Cover Amount must be a valid currency']);
    expect(report.rows[3].changes).toEqual([]);
    expect(report.rows[4].errors[0]).toMatch(/Benefit Type must be one of/);
    expect(policiesOf('c1')[0].data.eb_2).toBe('Acme');
    expect(report.summary).toMatchObject({ unmatched: 1, invalid: 4, updated: 0 });
    // Rows that only failed still leave a history entry, so the header shows
    // the attempt — and shows it as FAILED, not as the last successful sync.
    const [historyKey] = historyEntries();
    expect(kvStore.get(historyKey)).toMatchObject({
      status: 'failed',
      publishedRows: 0,
      errorCount: 5,
    });
  });

  it('keeps a child-category policy out of the parent category book, so no row can write across schemas', async () => {
    // `employee_benefits_risk` is grouped under `employee_benefits` elsewhere,
    // but its schema is different: a parent-category row must not be able to
    // land parent field ids on it, even through the hidden ids.
    kvStore.set('policies:client:c1', [
      ...policiesOf('c1'),
      {
        id: 'pol-eb-risk',
        clientId: 'c1',
        categoryId: 'employee_benefits_risk',
        providerId: 'p1',
        providerName: 'Allan Gray',
        data: { ebr_1: 'EB-RISK-1' },
        createdAt: 'x',
        updatedAt: 'x',
      },
    ]);
    const table = (
      (await (await request(app, `/?${SCOPE}`)).json()) as {
        table: { rows: Array<{ policyId: string }> };
      }
    ).table;
    expect(table.rows.map((r) => r.policyId)).toEqual(['pol2', 'pol1']);

    const catalogue = (await (await request(app, '/providers')).json()) as {
      providers: Array<{ categories: Array<{ categoryId: string; policyCount: number }> }>;
    };
    expect(catalogue.providers[0].categories[0]).toMatchObject({
      categoryId: 'employee_benefits',
      policyCount: 2,
    });

    const res = await postRows([
      { policyId: 'pol-eb-risk', clientId: 'c1', clientName: 'Thandi Nkosi', values: { eb_4: 1 } },
      { clientName: 'Thandi Nkosi', policyNumber: 'EB-RISK-1', values: { eb_4: 1 } },
    ]);
    const report = await res.json();
    expect(report.rows.map((r: { status: string }) => r.status)).toEqual(['invalid', 'unmatched']);
    expect(policiesOf('c1').find((p) => p.id === 'pol-eb-risk')?.data).toEqual({
      ebr_1: 'EB-RISK-1',
    });
  });

  it('uses the hidden ids when a row carries them, but still checks the client name', async () => {
    const res = await postRows([
      { policyId: 'pol1', clientId: 'c1', clientName: 'Thandi Nkosi', values: { eb_4: 130000 } },
      { policyId: 'pol1', clientId: 'c1', clientName: 'John Smith', values: { eb_4: 1 } },
      { policyId: 'pol1', clientId: 'c2', values: { eb_4: 1 } },
      { policyId: 'pol1', clientId: 'c1', policyNumber: 'EB-777', values: {} },
    ]);
    const report = await res.json();
    expect(report.rows[0]).toMatchObject({ status: 'updated', matchedBy: 'ids' });
    expect(report.rows[1]).toMatchObject({ status: 'client_mismatch' });
    expect(report.rows[2]).toMatchObject({ status: 'invalid' });
    expect(report.rows[3]).toMatchObject({ status: 'unchanged', matchedBy: 'ids' });
    expect(report.rows[3].warnings[0]).toMatch(/differs from the record's "EB-001"/);
    expect(policiesOf('c1')[0].data.eb_4).toBe(130000);
  });

  it('holds two identical policies as a duplicate until the ids pick one', async () => {
    kvStore.set('user_profile:c3:personal_info', { fullName: 'Dup Client' });
    kvStore.set('policies:client:c3', [
      {
        id: 'd1',
        clientId: 'c3',
        categoryId: 'employee_benefits',
        providerId: 'p1',
        data: { eb_1: 'EB-777' },
        createdAt: 'x',
        updatedAt: 'x',
      },
      {
        id: 'd2',
        clientId: 'c3',
        categoryId: 'employee_benefits',
        providerId: 'p1',
        data: { eb_1: 'EB-777' },
        createdAt: 'x',
        updatedAt: 'x',
      },
    ]);
    const res = await postRows([
      { clientName: 'Dup Client', policyNumber: 'EB-777', values: { eb_4: 5 } },
      {
        clientName: 'Dup Client',
        policyNumber: 'EB-777',
        policyId: 'd2',
        clientId: 'c3',
        values: { eb_4: 5 },
      },
    ]);
    const report = await res.json();
    expect(report.rows[0].status).toBe('duplicate');
    expect(report.rows[1]).toMatchObject({ status: 'updated', policyId: 'd2' });
  });

  it('matches on the policy number carried in the values when the row names none separately', async () => {
    // An agent can send the number as a cell, the way a sheet does, rather than
    // as its own field. That cell is the match key: a number that belongs to
    // someone else must not retarget the named client's record.
    const res = await postRows([
      { clientName: 'John Smith', values: { eb_1: 'EB-002', eb_4: 81000 } },
      { clientName: 'John Smith', values: { eb_1: 'EB-001', eb_4: 1 } },
    ]);
    const report = await res.json();
    expect(report.rows[0]).toMatchObject({
      status: 'updated',
      policyId: 'pol2',
      policyNumber: 'EB-002',
      matchedBy: 'client_name_policy_number',
    });
    expect(report.rows[1]).toMatchObject({
      status: 'client_mismatch',
      matchedClientName: 'Thandi Nkosi',
      changes: [],
    });
    expect(policiesOf('c2')[0].data).toMatchObject({ eb_1: 'EB-002', eb_4: 81000 });
    expect(policiesOf('c1')[0].data.eb_4).toBe(100000);
  });

  it('leaves a blank cell alone unless the field is configured to clear on blank', async () => {
    const ignore = await postRows([
      { clientName: 'Thandi Nkosi', policyNumber: 'EB-001', values: { Employer: '' } },
    ]);
    expect((await ignore.json()).rows[0].status).toBe('unchanged');

    kvStore.set('config:mapping:p1:employee_benefits', {
      providerId: 'p1',
      categoryId: 'employee_benefits',
      fieldMapping: {},
      fieldBindings: [{ targetFieldId: 'eb_2', columnName: 'Employer', blankBehavior: 'clear' }],
      settings: {},
    });
    const clear = await postRows([
      { clientName: 'Thandi Nkosi', policyNumber: 'EB-001', values: { Employer: '' } },
    ]);
    const report = await clear.json();
    expect(report.rows[0]).toMatchObject({
      status: 'updated',
      changes: [{ fieldId: 'eb_2', oldValue: 'Acme', newValue: '' }],
    });
    expect(policiesOf('c1')[0].data.eb_2).toBe('');
  });

  it('refuses the whole row when a blank cell is configured as an error, and does not apply the cells beside it', async () => {
    kvStore.set('config:mapping:p1:employee_benefits', {
      providerId: 'p1',
      categoryId: 'employee_benefits',
      fieldMapping: {},
      fieldBindings: [{ targetFieldId: 'eb_2', columnName: 'Employer', blankBehavior: 'error' }],
      settings: {},
    });
    const res = await postRows([
      {
        clientName: 'Thandi Nkosi',
        policyNumber: 'EB-001',
        // Whitespace is blank. Cover Amount beside it is a real change that
        // must not land: one invalid cell refuses the row.
        values: { Employer: '   ', eb_4: 222000 },
      },
    ]);
    const report = await res.json();
    expect(report.rows[0]).toMatchObject({
      status: 'invalid',
      changes: [],
      errors: ['Employer cannot be blank'],
    });
    expect(policiesOf('c1')[0].data.eb_2).toBe('Acme');
    expect(policiesOf('c1')[0].data.eb_4).toBe(100000);
    expect(report.summary).toMatchObject({ invalid: 1, updated: 0 });
    const [historyKey] = historyEntries();
    expect(kvStore.get(historyKey)).toMatchObject({ status: 'failed', publishedRows: 0 });
  });

  it('writes no history for a run that changed nothing and hit nothing', async () => {
    await postRows([{ clientName: 'John Smith', policyNumber: 'EB-002', values: { eb_4: 50000 } }]);
    expect(historyEntries()).toEqual([]);
  });
});

describe('GET /download and POST /upload — the spreadsheet round trip', () => {
  const download = async () => {
    const res = await request(app, `/download?${SCOPE}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/spreadsheetml/);
    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="Allan Gray - Employee Benefits - Portfolio.xlsx"',
    );
    // cellStyles is what makes SheetJS read `!cols` (the hidden flags) back.
    return XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: 'array', cellStyles: true });
  };

  /** The status, with the body in the failure message so a 400 explains itself. */
  const expectStatus = async (res: Response, status: number) => {
    expect(res.status, await res.clone().text()).toBe(status);
  };

  const upload = (
    bytes: string | Uint8Array,
    name: string,
    mode: 'preview' | 'apply',
    type = 'application/octet-stream',
  ) => {
    const form = multipartBinary([
      { name: 'providerId', value: 'p1' },
      { name: 'categoryId', value: 'employee_benefits' },
      { name: 'mode', value: mode },
      { name: 'file', value: bytes, filename: name, type },
    ]);
    return app.request('/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': form.contentType },
      body: form.body,
    });
  };

  it('downloads the book with the product columns, the read-only columns and the hidden ids', async () => {
    const workbook = await download();
    expect(workbook.SheetNames).toEqual(['Portfolio', 'Instructions', 'Field Dictionary']);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Portfolio, { defval: '' }) as Array<
      Record<string, unknown>
    >;
    expect(Object.keys(rows[0])).toEqual([
      'Client',
      'Policy Number',
      'Date of Inception',
      'Employer',
      'Benefit Type',
      'Cover Amount',
      'Monthly Contribution',
      'Notes',
      'Last Updated',
      'Policy Print',
      '_NW Policy ID',
      '_NW Client ID',
      '_NW Provider ID',
      '_NW Category ID',
    ]);
    expect(rows[0]).toMatchObject({
      Client: 'John Smith',
      'Policy Number': 'EB-002',
      'Cover Amount': 50000,
    });
    expect(rows[1]).toMatchObject({
      Client: 'Thandi Nkosi',
      'Policy Number': 'EB-001',
      'Last Updated': '2026-01-01T00:00:00.000Z',
      'Policy Print': 'print.pdf (2026-02-01)',
      '_NW Policy ID': 'pol1',
      '_NW Client ID': 'c1',
      '_NW Provider ID': 'p1',
      '_NW Category ID': 'employee_benefits',
    });
    // The hidden columns are hidden, the visible ones are not.
    const cols = workbook.Sheets.Portfolio['!cols'] as Array<{ hidden?: boolean }>;
    expect(cols.slice(-4).every((c) => c.hidden)).toBe(true);
    expect(cols[0].hidden).toBeFalsy();
  });

  it('an amended download previews, then applies, matched through the hidden ids', async () => {
    const workbook = await download();
    const sheet = workbook.Sheets.Portfolio;
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Array<Record<string, unknown>>;
    rows[0]['Cover Amount'] = 60000; // John Smith
    rows[1]['Employer'] = 'Acme Holdings'; // Thandi Nkosi
    rows[1]['Monthly Contribution'] = 900; // locked
    const amended = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(amended, XLSX.utils.json_to_sheet(rows), 'Portfolio');
    const bytes = new Uint8Array(XLSX.write(amended, { type: 'array', bookType: 'xlsx' }));

    const preview = await upload(bytes, 'book.xlsx', 'preview');
    await expectStatus(preview, 200);
    const previewReport = await preview.json();
    expect(previewReport).toMatchObject({
      dryRun: true,
      source: 'spreadsheet',
      summary: { updated: 2 },
    });
    expect(previewReport.rows[0]).toMatchObject({
      rowNumber: 2,
      status: 'updated',
      matchedBy: 'ids',
      changes: [{ fieldId: 'eb_4', oldValue: 50000, newValue: 60000 }],
    });
    expect(previewReport.rows[1].warnings).toContain(
      'Monthly Contribution is locked and was not changed',
    );
    expect(policiesOf('c2')[0].data.eb_4).toBe(50000);

    const apply = await upload(bytes, 'book.xlsx', 'apply');
    expect((await apply.json()).summary.updated).toBe(2);
    expect(policiesOf('c2')[0].data.eb_4).toBe(60000);
    expect(policiesOf('c1')[0].data.eb_2).toBe('Acme Holdings');
    expect(policiesOf('c1')[0].data.eb_5).toBe(500);
  });

  it('accepts a hand-made CSV with the product column names, matched by client + policy number', async () => {
    const csv =
      'Client,Policy Number,Cover Amount,Ignored\nJohn Smith,EB-002,70000,x\nNobody,EB-002,1,x\n';
    const res = await upload(csv, 'book.csv', 'apply', 'text/csv');
    await expectStatus(res, 200);
    const report = await res.json();
    expect(report.warnings[0]).toMatch(/Ignored columns .*: Ignored/);
    expect(report.rows.map((r: { status: string }) => r.status)).toEqual([
      'updated',
      'client_mismatch',
    ]);
    expect(policiesOf('c2')[0].data.eb_4).toBe(70000);
  });

  it('400s a sheet none of whose columns belong to the product, and a form without a file', async () => {
    const res = await upload('Foo,Bar\n1,2\n', 'x.csv', 'preview', 'text/csv');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: expect.stringContaining('None of the columns'),
    });

    const form = multipartBinary([
      { name: 'providerId', value: 'p1' },
      { name: 'categoryId', value: 'employee_benefits' },
    ]);
    const noFile = await app.request('/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': form.contentType },
      body: form.body,
    });
    expect(noFile.status).toBe(400);
    expect(await noFile.json()).toMatchObject({ error: 'No file uploaded' });
  });

  it('refuses a row stamped for another provider or product, and still applies the rows that belong here', async () => {
    // The hidden ids would otherwise match these policies exactly. A sheet
    // downloaded for a different book must not write through them.
    const csv = [
      'Client,Policy Number,Cover Amount,_NW Policy ID,_NW Client ID,_NW Provider ID,_NW Category ID',
      'Thandi Nkosi,EB-001,999999,pol1,c1,p2,risk_planning',
      'John Smith,EB-002,777000,pol2,c2,p1,employee_benefits',
    ].join('\n');
    const res = await upload(csv, 'wrong-book.csv', 'apply', 'text/csv');
    await expectStatus(res, 200);
    const report = await res.json();
    expect(report.rows[0]).toMatchObject({ status: 'invalid', changes: [] });
    expect(report.rows[0].errors).toEqual([
      'This row belongs to a different provider sheet',
      'This row belongs to a different product sheet',
    ]);
    expect(report.rows[1]).toMatchObject({ status: 'updated', policyId: 'pol2', matchedBy: 'ids' });
    expect(policiesOf('c1')[0].data.eb_4).toBe(100000);
    expect(policiesOf('c2')[0].data.eb_4).toBe(777000);
  });

  it('a sheet with no Client column matches only through the hidden ids', async () => {
    const csv = [
      'Policy Number,Cover Amount,_NW Policy ID,_NW Client ID',
      'EB-001,111000,pol1,c1',
      'EB-002,222000,,',
    ].join('\n');
    const res = await upload(csv, 'no-client.csv', 'apply', 'text/csv');
    await expectStatus(res, 200);
    const report = await res.json();
    expect(report.warnings[0]).toMatch(/no "Client" column/);
    expect(report.rows[0]).toMatchObject({ status: 'updated', matchedBy: 'ids', policyId: 'pol1' });
    expect(report.rows[1]).toMatchObject({ status: 'invalid', changes: [] });
    expect(report.rows[1].errors).toEqual(['Client name is required for matching']);
    // The second row's policy number is John's. Without a client name or the
    // hidden ids it must not be applied to him.
    expect(policiesOf('c1')[0].data.eb_4).toBe(111000);
    expect(policiesOf('c2')[0].data.eb_4).toBe(50000);
  });

  it('reads a column addressed by its field id in brackets, and ignores a bracketed id that is not a field', async () => {
    // `name [id]` is how the download disambiguates a header. A bracket whose
    // id is not a field must not fall back to the words in front of it, or a
    // typo would write into the wrong column.
    const csv = [
      'Client,Policy Number,Cover Amount [eb_4],Cover Amount [nope]',
      'John Smith,EB-002,81000,1',
    ].join('\n');
    const res = await upload(csv, 'brackets.csv', 'apply', 'text/csv');
    await expectStatus(res, 200);
    const report = await res.json();
    expect(report.warnings.join('\n')).toMatch(/Cover Amount \[nope\]/);
    expect(report.rows[0]).toMatchObject({
      status: 'updated',
      changes: [{ fieldId: 'eb_4', oldValue: 50000, newValue: 81000 }],
    });
    expect(policiesOf('c2')[0].data.eb_4).toBe(81000);
  });
});
