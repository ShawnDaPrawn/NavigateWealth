/**
 * communication-messaging.ts — sending a communication to a client
 * ================================================================
 *
 * Three defects reported from the Communication tab of a client profile, all
 * pinned here because each one was invisible from the UI:
 *
 *   1. **CC never reached anybody.** `data.cc` arrived at the service and was
 *      dropped on the floor — `sendEmail` was called without it. The adviser
 *      ticked "CC info@…", got a green "sent successfully" toast, and the CC'd
 *      person received nothing.
 *   2. **A rejected email reported success.** `sendEmail` RETURNS `false` on a
 *      provider rejection unless `throwOnError` is set, and the return value was
 *      discarded — so a 400 from SendGrid was logged as "Email sent
 *      successfully" and stored as `sent_via_email: true`.
 *   3. **Individual sends were missing from the manager.** They wrote only
 *      `communication_history:*`; the Communication Centre's History view reads
 *      campaign rows, so nothing an adviser sent from a client profile appeared
 *      there.
 *
 * WHAT IS REAL: the KV store (in-memory), the CC normalizer, the failure
 * classifier, and the status roll-up. Only the email transport and attachment
 * upload are stubbed — they are the process boundary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const sendEmailMock = vi.hoisted(() => vi.fn(async () => true));
const createEmailTemplateMock = vi.hoisted(() => vi.fn((content: string) => `<html>${content}`));

vi.mock('../email-service.ts', () => ({
  sendEmail: sendEmailMock,
  createEmailTemplate: createEmailTemplateMock,
}));

vi.mock('../communication-attachments.ts', () => ({
  uploadFile: vi.fn(async (file: { name: string }) => ({
    name: file.name,
    url: `https://storage.example/${file.name}`,
  })),
}));

vi.mock('../kv_store.tsx', async () => {
  const { makeKvMock } = await import('./helpers/contract-harness.ts');
  return makeKvMock();
});

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const { kvStore } = await import('./helpers/contract-harness.ts');
const { deleteCommunicationLog, sendDirectMessage, sendMessage, summarizeDelivery } =
  await import('../communication-messaging.ts');

type EmailParams = {
  to: string;
  cc?: string[];
  subject: string;
  throwOnError?: boolean;
};

const lastEmail = () => sendEmailMock.mock.calls.at(-1)?.[0] as unknown as EmailParams;

const baseMessage = {
  recipients: ['client-1'],
  subject: 'Your annual review',
  content: '<p>Hello</p>',
  sendEmail: true,
  recipientEmail: 'client@example.com',
};

beforeEach(() => {
  kvStore.clear();
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue(true);
  createEmailTemplateMock.mockClear();
});

describe('sendMessage — CC', () => {
  it('puts the CC list on the envelope', async () => {
    const result = await sendMessage('admin-1', {
      ...baseMessage,
      cc: ['info@navigatewealth.co', 'colleague@example.com'],
    });

    expect(lastEmail().cc).toEqual(['info@navigatewealth.co', 'colleague@example.com']);
    expect(result.cc).toEqual(['info@navigatewealth.co', 'colleague@example.com']);
    expect(result.status).toBe('completed');
  });

  it('drops a CC that repeats the recipient instead of letting the send fail', async () => {
    // SendGrid 400s the whole personalization when an address appears in both
    // `to` and `cc`, which would deny the CLIENT their message too.
    const result = await sendMessage('admin-1', {
      ...baseMessage,
      cc: ['client@example.com', 'colleague@example.com'],
    });

    expect(lastEmail().cc).toEqual(['colleague@example.com']);
    expect(result.status).toBe('completed');
    // …and it is NOT reported as uncopied: that address is the recipient, who
    // received the message as the To.
    expect(result.ccWarning).toBeUndefined();
  });

  it('drops a malformed CC and still delivers, reporting what was dropped', async () => {
    const result = await sendMessage('admin-1', {
      ...baseMessage,
      cc: ['typo-at-example.com', 'good@example.com'],
    });

    expect(lastEmail().cc).toEqual(['good@example.com']);
    expect(result.status).toBe('completed');
    expect(result.ccWarning).toContain('typo-at-example.com');
  });

  it('sends no cc field at all when every entry was unusable', async () => {
    // `cc: []` is not the same as omitting it — an empty array is another way
    // to hand the provider a malformed personalization.
    await sendMessage('admin-1', { ...baseMessage, cc: ['nonsense'] });
    expect(lastEmail().cc).toBeUndefined();
  });

  it('does not claim an address was missed when it was merely listed twice', async () => {
    // The encrypted-documents path passes the admin address in `cc` AND via the
    // `ccAdmin` flag, so a de-duplicated copy is the norm, not an error.
    const result = await sendMessage('admin-1', {
      ...baseMessage,
      cc: ['info@navigatewealth.co', 'info@navigatewealth.co'],
    });

    expect(lastEmail().cc).toEqual(['info@navigatewealth.co']);
    expect(result.ccWarning).toBeUndefined();
  });

  it('records the accepted CC list on the client-facing log entry', async () => {
    const result = await sendMessage('admin-1', {
      ...baseMessage,
      cc: ['colleague@example.com'],
    });

    const stored = kvStore.get(`communication_log:client-1:${result.messageId}`) as {
      cc: string[];
    };
    expect(stored.cc).toEqual(['colleague@example.com']);
  });
});

describe('sendMessage — delivery status', () => {
  it('asks the transport to throw so a rejection cannot look like a success', () => {
    return sendMessage('admin-1', baseMessage).then(() => {
      expect(lastEmail().throwOnError).toBe(true);
    });
  });

  it('reports a provider rejection as `rejected`, not success', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('SendGrid error: invalid email address'));

    const result = await sendMessage('admin-1', baseMessage);

    expect(result.status).toBe('rejected');
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('invalid email address');
    expect(result.results[0].emailStatus).toBe('rejected');
  });

  it('reports a transient provider error as `failed`', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('network timeout'));

    const result = await sendMessage('admin-1', baseMessage);

    expect(result.status).toBe('failed');
    expect(result.results[0].emailStatus).toBe('failed');
  });

  it('does not mark the log as emailed when the provider refused it', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('SendGrid error: bad request'));

    const result = await sendMessage('admin-1', baseMessage);
    const stored = kvStore.get(`communication_log:client-1:${result.messageId}`) as {
      sent_via_email: boolean;
      email_status: string;
      email_error: string;
    };

    expect(stored.sent_via_email).toBe(false);
    expect(stored.email_status).toBe('rejected');
    expect(stored.email_error).toContain('bad request');
  });

  it('still files the portal copy when the email fails', async () => {
    // The portal copy is the part that is always required; losing it as well
    // would turn one failure into two.
    sendEmailMock.mockRejectedValueOnce(new Error('network timeout'));

    const result = await sendMessage('admin-1', baseMessage);

    expect(kvStore.has(`communication_log:client-1:${result.messageId}`)).toBe(true);
    expect(result.results[0].portalDelivered).toBe(true);
  });

  it('treats a portal-only send as completed', async () => {
    const result = await sendMessage('admin-1', {
      ...baseMessage,
      sendEmail: false,
    });

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(result.status).toBe('completed');
    expect(result.results[0].emailStatus).toBe('skipped');
  });

  it('writes the status and stats onto the history entry', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('SendGrid error: bounce'));

    const result = await sendMessage('admin-1', baseMessage);
    const history = kvStore.get(`communication_history:${result.messageId}`) as {
      status: string;
      stats: { sent: number; failed: number; total: number };
    };

    expect(history.status).toBe('rejected');
    expect(history.stats).toEqual({ sent: 0, failed: 1, total: 1 });
  });

  it('tags campaign fan-out so it is not counted as a standalone message', async () => {
    const result = await sendMessage('admin-1', { ...baseMessage, campaignId: 'camp-9' });
    const history = kvStore.get(`communication_history:${result.messageId}`) as {
      campaign_id?: string;
    };
    expect(history.campaign_id).toBe('camp-9');
  });
});

describe('summarizeDelivery', () => {
  const base = { recipientId: 'r', portalDelivered: true } as const;

  it('is completed when everything landed', () => {
    expect(
      summarizeDelivery([
        { ...base, emailStatus: 'sent' },
        { ...base, emailStatus: 'skipped' },
      ]).status,
    ).toBe('completed');
  });

  it('is partial when some landed and some did not', () => {
    const summary = summarizeDelivery([
      { ...base, emailStatus: 'sent' },
      { ...base, emailStatus: 'failed', error: 'timeout' },
    ]);
    expect(summary.status).toBe('partial');
    expect(summary.stats).toEqual({ sent: 1, failed: 1, total: 2 });
    expect(summary.failureReason).toBe('timeout');
  });

  it('is rejected only when every failure was terminal', () => {
    expect(summarizeDelivery([{ ...base, emailStatus: 'rejected' }]).status).toBe('rejected');
    expect(
      summarizeDelivery([
        { ...base, emailStatus: 'rejected' },
        { ...base, emailStatus: 'failed' },
      ]).status,
    ).toBe('failed');
  });

  it('counts a lost portal write as a failure even when the email went out', () => {
    expect(
      summarizeDelivery([{ recipientId: 'r', portalDelivered: false, emailStatus: 'sent' }]).status,
    ).toBe('failed');
  });
});

describe('sendDirectMessage — visibility in the Communication Centre', () => {
  it('files a campaign-shaped history row so the manager can see the message', async () => {
    const result = await sendDirectMessage('admin-1', {
      ...baseMessage,
      recipientFirstName: 'Thandi',
      recipientLastName: 'Mokoena',
      cc: ['colleague@example.com'],
    });

    const row = kvStore.get(`communication:campaigns:${result.messageId}`) as Record<
      string,
      unknown
    >;

    expect(row).toBeDefined();
    expect(row.origin).toBe('direct');
    expect(row.recipientType).toBe('single');
    expect(row.channel).toBe('email');
    expect(row.subject).toBe('Your annual review');
    expect(row.status).toBe('completed');
    expect(row.createdBy).toBe('admin-1');
    expect(row.cc).toEqual(['colleague@example.com']);
    expect(row.stats).toEqual({ sent: 1, failed: 0, total: 1 });
  });

  it('records the real status when delivery failed', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('SendGrid error: invalid address'));

    const result = await sendDirectMessage('admin-1', baseMessage);
    const row = kvStore.get(`communication:campaigns:${result.messageId}`) as {
      status: string;
      failureReason?: string;
    };

    expect(row.status).toBe('rejected');
    expect(row.failureReason).toContain('invalid address');
  });

  it('files a portal-only send as the portal channel, not email', async () => {
    // "Send Email" is optional on the compose form. Recording every direct row
    // as `email` made the manager show an Email badge for a message no provider
    // ever saw.
    const result = await sendDirectMessage('admin-1', { ...baseMessage, sendEmail: false });
    const row = kvStore.get(`communication:campaigns:${result.messageId}`) as { channel: string };

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(row.channel).toBe('portal');
  });

  it('files an emailed send as the email channel', async () => {
    const result = await sendDirectMessage('admin-1', baseMessage);
    const row = kvStore.get(`communication:campaigns:${result.messageId}`) as { channel: string };
    expect(row.channel).toBe('email');
  });

  it('marks a multi-recipient send as `multiple`', async () => {
    const result = await sendDirectMessage('admin-1', {
      ...baseMessage,
      recipients: ['client-1', 'client-2'],
    });
    const row = kvStore.get(`communication:campaigns:${result.messageId}`) as {
      recipientType: string;
    };
    expect(row.recipientType).toBe('multiple');
  });

  it('never turns a failure to file history into a failed send', async () => {
    // The message has already gone out by the time the row is written; the
    // adviser must not be told the send failed because bookkeeping did.
    const kv = await import('../kv_store.tsx');
    const setSpy = vi.spyOn(kv, 'set');
    setSpy.mockImplementation(async (key: string, value: unknown) => {
      if (key.startsWith('communication:campaigns:')) throw new Error('KV down');
      kvStore.set(key, JSON.parse(JSON.stringify(value)));
    });

    const result = await sendDirectMessage('admin-1', baseMessage);

    expect(result.status).toBe('completed');
    expect(kvStore.has(`communication_log:client-1:${result.messageId}`)).toBe(true);
    setSpy.mockRestore();
  });
});

describe('deleteCommunicationLog', () => {
  it('removes the manager-visible row along with the message', async () => {
    // Without this the admin deletes the communication from the client profile,
    // is told it worked, and the Communication Centre keeps listing it forever.
    const result = await sendDirectMessage('admin-1', baseMessage);
    expect(kvStore.has(`communication:campaigns:${result.messageId}`)).toBe(true);

    await deleteCommunicationLog(result.messageId);

    expect(kvStore.has(`communication:campaigns:${result.messageId}`)).toBe(false);
    expect(kvStore.has(`communication_log:client-1:${result.messageId}`)).toBe(false);
    expect(kvStore.has(`communication_history:${result.messageId}`)).toBe(false);
  });

  it('leaves a real campaign alone even if its id is passed', async () => {
    // The guard is on `origin`: deleting a message must never be able to wipe a
    // Communication Centre campaign that happens to share an id.
    kvStore.set('communication:campaigns:camp-1', { id: 'camp-1', origin: 'campaign' });

    await deleteCommunicationLog('camp-1');

    expect(kvStore.has('communication:campaigns:camp-1')).toBe(true);
  });

  it('deletes every recipient copy of a multi-recipient message', async () => {
    const result = await sendDirectMessage('admin-1', {
      ...baseMessage,
      recipients: ['client-1', 'client-2'],
    });

    await deleteCommunicationLog(result.messageId);

    expect(kvStore.has(`communication_log:client-1:${result.messageId}`)).toBe(false);
    expect(kvStore.has(`communication_log:client-2:${result.messageId}`)).toBe(false);
  });
});
