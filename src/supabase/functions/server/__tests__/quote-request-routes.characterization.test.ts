/**
 * Characterization net for the `quote-request-routes.ts` split.
 * =============================================================
 *
 * 1,580 lines, of which lines 63 to 1579 are a SINGLE POST handler, and no
 * tests at all. It is a public, unauthenticated endpoint — the architecture
 * plan calls it out by name — and it is where the will drafting flow submits
 * its drafts, so what it accepts and refuses is load-bearing well beyond the
 * quote form.
 *
 * WHAT THIS PINS
 * --------------
 * The gates before anything is stored or sent: blocked IP, schema validation,
 * the honeypot, blocked email domains, and the rate limit. Each one is a place
 * where a refactor can quietly stop refusing something.
 *
 * The honeypot deserves its own note. It returns 200 with a fabricated
 * submission id and `emailsSent: { admin: true, acknowledgment: true }` — a
 * deliberate lie, so a bot cannot tell it was caught. A refactor that "fixed"
 * that into an honest 400 would break the feature by making it work correctly,
 * which is exactly the kind of thing a test has to hold in place.
 *
 * And the per-vertical output. The handler dispatches on
 * `productDetails.vertical` TWICE — once building PDF fields, once building
 * email HTML — with the same five branches and near-identical inner logic. The
 * split moves those blocks out; these assertions check that each vertical still
 * reaches both.
 */
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';

const kvStore = vi.hoisted(() => new Map<string, unknown>());
const sendEmail = vi.hoisted(() => vi.fn());
const generateContactPdf = vi.hoisted(() => vi.fn());
const createSubmission = vi.hoisted(() => vi.fn());
const getSubmissionById = vi.hoisted(() => vi.fn());
const updateSubmission = vi.hoisted(() => vi.fn());

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
  set: vi.fn(async (k: string, v: unknown) => {
    kvStore.set(k, v);
  }),
  del: vi.fn(async (k: string) => {
    kvStore.delete(k);
  }),
  getByPrefix: vi.fn(async () => []),
  listByPrefix: vi.fn(async () => []),
  mget: vi.fn(),
  mset: vi.fn(),
  mdel: vi.fn(),
}));

vi.mock('../email-service.ts', () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
  createEmailTemplate: (content: string) => `<html>${content}</html>`,
  getFooterSettings: vi.fn(async () => ({})),
}));

vi.mock('../contact-pdf-generator.ts', () => ({
  generateContactPdf: (...a: unknown[]) => generateContactPdf(...a),
}));

vi.mock('../submissions-service.ts', () => ({
  submissionsService: {
    create: (...a: unknown[]) => createSubmission(...a),
    getById: (...a: unknown[]) => getSubmissionById(...a),
    update: (...a: unknown[]) => updateSubmission(...a),
  },
}));

import app from '../quote-request-routes.ts';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  app.request('/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

/** A submission the schema accepts. Each test varies one thing from here. */
function validBody(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Zora',
    lastName: 'Mkhize',
    email: `zora${Math.random().toString(36).slice(2)}@example.co.za`,
    phone: '+27820000000',
    productName: 'Medical Aid',
    service: 'medical-aid',
    stage: 'initial',
    ...overrides,
  };
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  generateContactPdf.mockResolvedValue(new Uint8Array([1, 2, 3]));
  createSubmission.mockResolvedValue({ id: 'sub-1' });
  getSubmissionById.mockResolvedValue(null);
  updateSubmission.mockResolvedValue(undefined);
  sendEmail.mockResolvedValue({ success: true });
});

describe('the endpoint is alive', () => {
  it('reports itself on GET /', async () => {
    const res = await app.request('/');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ service: 'quote-request' });
  });
});

describe('the gates before anything is stored or sent', () => {
  it('accepts a well-formed initial submission', async () => {
    const res = await post(validBody());

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; submissionId: string };
    expect(json.success).toBe(true);
    expect(json.submissionId).toEqual(expect.any(String));
    expect(kvStore.has(`quote_request:${json.submissionId}`)).toBe(true);
  });

  it('rejects a body the schema does not accept, storing nothing', async () => {
    const res = await post({ firstName: 'Zora' });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: 'Validation failed' });
    expect([...kvStore.keys()].filter((k) => k.startsWith('quote_request:'))).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('rejects a body that is not JSON', async () => {
    const res = await app.request('/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('the honeypot lies on purpose', () => {
  it('returns a convincing success while storing and sending nothing', async () => {
    // The deliberate deception: a bot must not be able to tell it was caught.
    // Anyone "fixing" this into an honest 400 would break the feature by making
    // it correct.
    const res = await post(validBody({ website: 'http://spam.example' }));

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.success).toBe(true);
    expect(json.submissionId).toEqual(expect.any(String));
    expect(json.emailsSent).toEqual({ admin: true, acknowledgment: true });

    // ...and none of it happened.
    expect([...kvStore.keys()].filter((k) => k.startsWith('quote_request:'))).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it('lets an empty honeypot field through', async () => {
    const res = await post(validBody({ website: '' }));

    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalled();
  });
});

describe('blocked senders are refused before storage', () => {
  it('refuses a known scam email domain', async () => {
    const { getBlockedEmailDomain } =
      await import('../../../../shared/submissions/blockedEmailDomains.ts');
    // Find a domain the shared list actually blocks, rather than inventing one
    // that may stop being blocked.
    const blocked = ['test.com', 'mailinator.com', 'guerrillamail.com', 'yopmail.com'].find((d) =>
      getBlockedEmailDomain(`someone@${d}`),
    );
    expect(blocked, 'no known blocked domain to test with').toBeTruthy();

    const res = await post(validBody({ email: `someone@${blocked}` }));

    expect(res.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
    expect([...kvStore.keys()].filter((k) => k.startsWith('quote_request:'))).toEqual([]);
  });
});

describe('the rate limit holds', () => {
  it('refuses a burst from one email address', async () => {
    const email = 'burst@example.co.za';
    const codes: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      codes.push((await post(validBody({ email }))).status);
    }

    // Whatever the exact allowance, a burst of eight must not all succeed.
    expect(codes.filter((c) => c === 200).length).toBeLessThan(8);
    expect(codes).toContain(429);
  });

  it('does not penalise a different address', async () => {
    for (let i = 0; i < 8; i += 1) {
      await post(validBody({ email: 'burst@example.co.za' }));
    }

    const res = await post(validBody({ email: 'someone-else@example.co.za' }));

    expect(res.status).toBe(200);
  });
});

describe('a successful submission does all three things', () => {
  it('stores it, files a submission, and sends both emails', async () => {
    const res = await post(validBody());
    const { submissionId } = (await res.json()) as { submissionId: string };

    expect(kvStore.get(`quote_request:${submissionId}`)).toMatchObject({
      firstName: 'Zora',
      lastName: 'Mkhize',
    });
    expect(createSubmission).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('sends the acknowledgment to the submitter and the notification elsewhere', async () => {
    await post(validBody({ email: 'zora@example.co.za' }));

    const recipients = sendEmail.mock.calls.map((c) => (c[0] as { to: string }).to);
    expect(recipients).toContain('zora@example.co.za');
    expect(recipients.filter((r) => r !== 'zora@example.co.za')).toHaveLength(1);
  });
});

describe('each vertical still reaches both the PDF fields and the email HTML', () => {
  /**
   * The handler dispatches on `productDetails.vertical` twice over. These are
   * the branches the split moves out of the handler; if one stops being reached,
   * its details vanish silently from both the PDF and the email — the
   * submission still succeeds and still looks fine.
   */
  /**
   * Each branch opens by pushing its own "Quote Phase" label, so that value is
   * a reliable marker that the branch was entered. Asserting only that the
   * field list is non-empty would not do: the base fields (name, email, phone)
   * are pushed regardless, so a vertical could stop being reached entirely and
   * the count would still be five. That weaker check passed against a mutation
   * that disabled the TaxPlanning branch — which is precisely why it is not the
   * check used here.
   */
  /**
   * Each branch opens by pushing its own "Quote Phase" label, so that value is
   * a reliable marker that the PDF-fields branch was entered. Asserting only
   * that the field list is non-empty would not do: the base fields (name,
   * email, phone) are pushed regardless, so a vertical could stop being reached
   * entirely and the count would still be five. That weaker check passed
   * against a mutation that disabled the TaxPlanning branch, which is why it is
   * not the check used here.
   *
   * The HTML half needs a different handle. Its `sections` array starts empty
   * and only fills when the vertical's own data is present, so each case
   * supplies one field that branch reads and looks for the value coming out the
   * other side. That checks the data path, not just the branch.
   */
  const VERTICALS: [string, string, Record<string, unknown>, string][] = [
    [
      'MedicalAid',
      'Comprehensive Medical Aid Assessment',
      { members: { membership_type: 'MARKER-MEDICAL' } },
      'MARKER-MEDICAL',
    ],
    [
      'Investment',
      'Investment Management Assessment',
      { objective: { primary_objective: 'MARKER-INVEST' } },
      'MARKER-INVEST',
    ],
    [
      'Retirement',
      'Retirement Planning Assessment',
      { selected_product: 'MARKER-RETIRE' },
      'MARKER-RETIRE',
    ],
    [
      'EmployeeBenefits',
      'Employee Benefits Assessment',
      { business: { company_name: 'MARKER-EB' } },
      'MARKER-EB',
    ],
    [
      'TaxPlanning',
      'Tax Planning Assessment',
      { taxpayer_context: { taxpayer_type: 'MARKER-TAX' } },
      'MARKER-TAX',
    ],
  ];

  it.each(VERTICALS)('%s reaches the PDF fields with its own marker', async (vertical, marker) => {
    await post(
      validBody({
        stage: 'full',
        email: `${vertical.toLowerCase()}@example.co.za`,
        productDetails: { phase: 2, vertical },
      }),
    );

    expect(generateContactPdf).toHaveBeenCalledTimes(1);
    const { fields } = generateContactPdf.mock.calls[0][0] as {
      fields: { label: string; value: string }[];
    };
    const phase = fields.find((f) => f.label === 'Quote Phase');
    expect(phase, `${vertical} did not reach its PDF-fields branch`).toBeTruthy();
    expect(phase!.value).toContain(marker);
  });

  it.each(VERTICALS)(
    '%s carries its own data into the admin email HTML',
    async (vertical, _marker, payload, needle) => {
      await post(
        validBody({
          stage: 'full',
          email: `${vertical.toLowerCase()}-html@example.co.za`,
          productDetails: { phase: 2, vertical, ...payload },
        }),
      );

      expect(sendEmail).toHaveBeenCalledTimes(2);
      const allHtml = sendEmail.mock.calls.map((c) => (c[0] as { html: string }).html).join('\n');
      expect(allHtml, `${vertical} data did not reach the email HTML`).toContain(needle);
    },
  );

  it('an initial-stage submission carries no Quote Phase field at all', async () => {
    // The baseline that makes the assertions above meaningful.
    await post(validBody({ email: 'baseline@example.co.za' }));

    const { fields } = generateContactPdf.mock.calls[0][0] as { fields: { label: string }[] };
    expect(fields.find((f) => f.label === 'Quote Phase')).toBeUndefined();
  });

  it('links a full submission back to its initial one', async () => {
    const first = await post(validBody({ email: 'linked@example.co.za' }));
    const { submissionId } = (await first.json()) as { submissionId: string };

    const second = await post(
      validBody({
        stage: 'full',
        email: 'linked2@example.co.za',
        parentSubmissionId: submissionId,
        productDetails: { phase: 2, vertical: 'MedicalAid', answers: {} },
      }),
    );

    expect(second.status).toBe(200);
    const stored = [...kvStore.entries()]
      .filter(([k]) => k.startsWith('quote_request:'))
      .map(([, v]) => v as Record<string, unknown>);
    expect(stored.some((s) => s.parentSubmissionId === submissionId)).toBe(true);
  });
});
