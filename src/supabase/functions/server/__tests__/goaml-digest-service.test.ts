/**
 * GoAML morning digest — snapshot, diff, and mail composition.
 *
 * The login lives in the Cursor Automation. These tests pin the application
 * side: recipient parsing, change detection, duplicate suppression, and the
 * guarantee that untrusted portal copy cannot break out of the HTML email.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubGlobal('Deno', {
  env: {
    get: (name: string) =>
      ({
        NW_GOAML_DIGEST_TO: '',
        NW_GOAML_DIGEST_TOKEN: 'digest-token',
      })[name] ?? '',
  },
});

const sendEmail = vi.hoisted(() => vi.fn(async () => true));
const getEmailTemplate = vi.hoisted(() => vi.fn());
const getFooterSettings = vi.hoisted(() => vi.fn(async () => ({})));
const store = vi.hoisted(() => {
  const rows = new Map<string, unknown>();
  return {
    rows,
    get: vi.fn(async (id: string) => rows.get(id) ?? null),
    put: vi.fn(async (id: string, value: unknown) => {
      rows.set(id, value);
    }),
  };
});
const recordAudit = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock('../email-service.ts', () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
  createEmailTemplate: (html: string) => html,
  getFooterSettings: (...a: unknown[]) => getFooterSettings(...a),
  getEmailTemplate: (...a: unknown[]) => getEmailTemplate(...a),
}));

vi.mock('../repositories/goaml-digest-repository.ts', () => ({
  GOAML_DIGEST_NAMESPACE: 'goaml:digest:',
  GOAML_DIGEST_LATEST_ID: 'latest',
  GOAML_DIGEST_LAST_SENT_ID: 'last_sent',
  goamlDigestStore: store,
}));

vi.mock('../admin-audit-service.ts', () => ({
  AdminAuditService: { record: (...a: unknown[]) => recordAudit(...a) },
}));

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

const {
  parseDigestRecipients,
  fingerprintUpdate,
  fingerprintUpdates,
  diffUpdates,
  shouldSkipDuplicate,
  resolveDigestSubject,
  buildDigestBodies,
  processGoamlNotify,
} = await import('../goaml-digest-service.ts');
const { stripForbiddenKeys } = await import('../goaml-digest-validation.ts');
const { DEFAULT_DIGEST_RECIPIENTS } = await import('../goaml-digest-types.ts');

const TEMPLATE = {
  id: 'goaml_scan_digest',
  name: 'GoAML Morning Digest',
  enabled: true,
  subject: 'GoAML {{ .Status }} — {{ .Date }}',
  title: 'GoAML Morning Digest',
  subtitle: '{{ .Date }}',
  greeting: 'Good morning,',
  bodyHtml: '<p>Intro for {{ .Date }}.</p>',
  buttonLabel: 'Open goAML',
  buttonUrl: 'https://goweb.fic.gov.za/',
  footerNote: 'Automated compliance digest.',
};

function update(over: Record<string, unknown> = {}) {
  return {
    title: 'Notice 1',
    summary: 'A filing reminder',
    href: 'https://goweb.fic.gov.za/notices/1',
    area: 'Notices',
    severity: 'info' as const,
    ...over,
  };
}

function report(over: Record<string, unknown> = {}) {
  return {
    scannedAt: '2026-09-05T06:05:00.000Z',
    sourceUrl: 'https://goweb.fic.gov.za/',
    loginSucceeded: true,
    otpRequired: true,
    otpSucceeded: true,
    updates: [update()],
    dryRun: false,
    force: false,
    ...over,
  };
}

beforeEach(() => {
  store.rows.clear();
  store.get.mockClear();
  store.put.mockClear();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
  getEmailTemplate.mockReset();
  getEmailTemplate.mockResolvedValue({ ...TEMPLATE });
  recordAudit.mockReset();
  recordAudit.mockResolvedValue({});
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-05T06:05:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('parseDigestRecipients', () => {
  it('falls back to the nominated compliance mailboxes', () => {
    expect(parseDigestRecipients(undefined)).toEqual([...DEFAULT_DIGEST_RECIPIENTS]);
    expect(parseDigestRecipients('')).toEqual([...DEFAULT_DIGEST_RECIPIENTS]);
  });

  it('dedupes, lowercases, and drops junk', () => {
    expect(
      parseDigestRecipients('Shawn@NavigateWealth.co, helen@directfp.co.za, not-an-email'),
    ).toEqual(['shawn@navigatewealth.co', 'helen@directfp.co.za']);
  });
});

describe('change detection', () => {
  it('treats the same title+href as unchanged regardless of summary drift', () => {
    const previous = [update({ summary: 'old copy' })];
    const current = [update({ summary: 'new copy' })];
    const diff = diffUpdates(previous, current);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toHaveLength(1);
  });

  it('flags a new title as added and a missing one as removed', () => {
    const previous = [update({ title: 'Old notice' })];
    const current = [update({ title: 'New notice', href: '/new' })];
    const diff = diffUpdates(previous, current);
    expect(diff.added.map((item) => item.title)).toEqual(['New notice']);
    expect(diff.removed.map((item) => item.title)).toEqual(['Old notice']);
  });

  it('fingerprints are order-independent', () => {
    const a = [update({ title: 'A' }), update({ title: 'B', href: '/b' })];
    const b = [update({ title: 'B', href: '/b' }), update({ title: 'A' })];
    expect(fingerprintUpdates(a)).toBe(fingerprintUpdates(b));
    expect(fingerprintUpdate(update())).toContain('notice 1');
  });
});

describe('duplicate suppression', () => {
  it('skips a second identical send on the same SAST day', () => {
    expect(
      shouldSkipDuplicate(
        {
          kind: 'send',
          scannedAt: '2026-09-05T06:00:00.000Z',
          sastDate: '2026-09-05',
          loginSucceeded: true,
          updates: [update()],
          fingerprint: fingerprintUpdates([update()]),
          outcome: 'sent',
          addedCount: 1,
          removedCount: 0,
        },
        fingerprintUpdates([update()]),
        '2026-09-05',
        false,
      ),
    ).toBe(true);
  });

  it('does not skip when force is set or the fingerprint moved', () => {
    const last = {
      kind: 'send' as const,
      scannedAt: '2026-09-05T06:00:00.000Z',
      sastDate: '2026-09-05',
      loginSucceeded: true,
      updates: [update()],
      fingerprint: fingerprintUpdates([update()]),
      outcome: 'sent' as const,
      addedCount: 1,
      removedCount: 0,
    };
    expect(shouldSkipDuplicate(last, fingerprintUpdates([update()]), '2026-09-05', true)).toBe(
      false,
    );
    expect(
      shouldSkipDuplicate(
        last,
        fingerprintUpdates([update({ title: 'Other' })]),
        '2026-09-05',
        false,
      ),
    ).toBe(false);
  });
});

describe('stripForbiddenKeys', () => {
  it('drops password, otp, and username fields at any depth', () => {
    const cleaned = stripForbiddenKeys({
      loginSucceeded: true,
      password: 'should-not-survive',
      updates: [{ title: 'Notice', otp: '123456', summary: 'ok' }],
      credentials: { username: 'Navigate94', password: 'nope' },
    }) as Record<string, unknown>;
    expect(cleaned.password).toBeUndefined();
    expect(cleaned.credentials).toEqual({});
    expect((cleaned.updates as Array<Record<string, unknown>>)[0]).toEqual({
      title: 'Notice',
      summary: 'ok',
    });
  });
});

describe('email composition', () => {
  it('escapes portal copy so a title cannot inject HTML', () => {
    const { htmlBody, text } = buildDigestBodies(
      report({
        updates: [update({ title: '<img src=x onerror=alert(1)>', summary: 'a <b>bold</b>' })],
        notes: '<script>alert(1)</script>',
      }),
      {
        added: [update({ title: '<img src=x onerror=alert(1)>', summary: 'a <b>bold</b>' })],
        removed: [],
        unchanged: [],
      },
      'Saturday, 05 September 2026',
      '<p>Intro</p>',
    );
    expect(htmlBody).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(htmlBody).not.toContain('<img src=x');
    expect(htmlBody).toContain('&lt;script&gt;');
    expect(text).toContain('NEW: <img src=x onerror=alert(1)>');
  });

  it('fills the subject placeholders from the scan', () => {
    const subject = resolveDigestSubject(
      'GoAML {{ .Status }} — {{ .Date }}',
      report(),
      { added: [update()], removed: [], unchanged: [] },
      'Saturday, 05 September 2026',
    );
    expect(subject).toBe('GoAML 1 new item(s) — Saturday, 05 September 2026');
  });
});

describe('processGoamlNotify', () => {
  it('mails the default recipients and stores latest + last_sent', async () => {
    const result = await processGoamlNotify(report());
    expect(result.outcome).toBe('sent');
    expect(result.sent).toBe(true);
    expect(result.addedCount).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const payload = sendEmail.mock.calls[0][0] as {
      to: string;
      cc?: string[];
      subject: string;
    };
    expect(payload.to).toBe('shawn@navigatewealth.co');
    expect(payload.cc).toEqual(['helen@directfp.co.za']);
    expect(payload.subject).toContain('1 new item(s)');
    expect(store.rows.has('latest')).toBe(true);
    expect(store.rows.has('last_sent')).toBe(true);
    expect(recordAudit).toHaveBeenCalled();
  });

  it('does not persist or send on dryRun', async () => {
    const result = await processGoamlNotify(report({ dryRun: true }));
    expect(result.outcome).toBe('dry_run');
    expect(result.sent).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(store.rows.size).toBe(0);
  });

  it('skips an identical second notify the same SAST morning', async () => {
    await processGoamlNotify(report());
    sendEmail.mockClear();
    const second = await processGoamlNotify(report());
    expect(second.outcome).toBe('skipped_duplicate');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('still mails when login failed so the operators hear about it', async () => {
    const result = await processGoamlNotify(
      report({ loginSucceeded: false, updates: [], notes: 'OTP never arrived' }),
    );
    expect(result.outcome).toBe('login_failed_notified');
    expect(result.sent).toBe(true);
    const payload = sendEmail.mock.calls[0][0] as { subject: string; text: string };
    expect(payload.subject).toContain('scan failed');
    expect(payload.text).toContain('LOGIN FAILED');
    expect(store.rows.has('latest')).toBe(false);
    expect(store.rows.has('last_sent')).toBe(true);
  });

  it('sends nothing when the transactional template is disabled', async () => {
    getEmailTemplate.mockResolvedValue({ ...TEMPLATE, enabled: false });
    const result = await processGoamlNotify(report());
    expect(result.outcome).toBe('template_disabled');
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
