/**
 * P5.1 — SMS service (pluggable adapter).
 *
 * Ships with three adapters:
 *   - `noop`      (default): logs + returns success; does nothing. Safe in
 *                 dev/staging without provider credentials.
 *   - `twilio`    : HTTP POST to Twilio Messages API (global, expensive).
 *   - `clickatell`: HTTP POST to Clickatell REST v1 (SA-local, cheaper).
 *
 * The active adapter is selected via `SMS_PROVIDER` env var; other adapters
 * can be added without touching callers. Callers import `sendSms()` and
 * `sendOtpSms()` — they never see provider details.
 *
 * Opt-in is per-signer (`signer.sms_opt_in`). Callers MUST check opt-in
 * before invoking this service; we do NOT silently fall back to email.
 *
 * Rationale for ship-with-noop (vs. blocking on a provider decision):
 *   - Lets the rest of Phase 5 land and be tested end-to-end.
 *   - Forces every call site to be opt-in aware from day 1.
 *   - Swapping providers is a one-line env flip + secret population.
 */

import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const log = createModuleLogger('sms-service');

// ============================================================================
// TYPES
// ============================================================================

export type SmsProvider = 'noop' | 'twilio' | 'clickatell';

export interface SmsMessage {
  to: string;           // E.164 phone number (+27...)
  body: string;         // Plain-text body. SMS is 160 chars per segment.
  kind: 'otp' | 'invite' | 'reminder'; // audit / billing classifier
}

export interface SmsResult {
  success: boolean;
  provider: SmsProvider;
  messageId?: string;
  error?: string;
  // Set when no provider is configured or opt-in not given — caller should
  // treat as "not delivered" without treating it as a hard failure.
  delivered: boolean;
}

// ============================================================================
// PHONE NORMALISATION
// ============================================================================

/**
 * Normalise a SA phone number to E.164. Accepts:
 *   - 082 123 4567  → +27821234567
 *   - 27821234567   → +27821234567
 *   - +27821234567  → unchanged
 * Returns null if the number is unrecognisable.
 */
export function toE164(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('27')) return `+${digits}`;
  if (digits.startsWith('0')) return `+27${digits.slice(1)}`;
  // Best effort — assume already international if >= 10 digits.
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

// ============================================================================
// PROVIDER ADAPTERS
// ============================================================================

interface SmsAdapter {
  send(msg: SmsMessage): Promise<SmsResult>;
}

const noopAdapter: SmsAdapter = {
  async send(msg) {
    log.info(`[noop-sms] would send ${msg.kind} to ${msg.to} (${msg.body.length} chars)`);
    return { success: true, provider: 'noop', delivered: false };
  },
};

const twilioAdapter: SmsAdapter = {
  async send(msg) {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const token = Deno.env.get('TWILIO_AUTH_TOKEN');
    const from = Deno.env.get('TWILIO_FROM_NUMBER');
    if (!sid || !token || !from) {
      log.warn('Twilio credentials missing — falling back to noop');
      return noopAdapter.send(msg);
    }
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const body = new URLSearchParams({ To: msg.to, From: from, Body: msg.body });
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      if (!res.ok) {
        const errBody = await res.text();
        log.error(`Twilio send failed (${res.status}): ${errBody}`);
        return { success: false, provider: 'twilio', delivered: false, error: `Twilio ${res.status}` };
      }
      const json = await res.json() as { sid?: string };
      return { success: true, provider: 'twilio', delivered: true, messageId: json.sid };
    } catch (err) {
      return { success: false, provider: 'twilio', delivered: false, error: getErrMsg(err) };
    }
  },
};

const clickatellAdapter: SmsAdapter = {
  async send(msg) {
    const apiKey = Deno.env.get('CLICKATELL_API_KEY');
    if (!apiKey) {
      log.warn('Clickatell API key missing — falling back to noop');
      return noopAdapter.send(msg);
    }
    try {
      const url = 'https://platform.clickatell.com/messages';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          messages: [{ channel: 'sms', to: msg.to, content: msg.body }],
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        log.error(`Clickatell send failed (${res.status}): ${errBody}`);
        return { success: false, provider: 'clickatell', delivered: false, error: `Clickatell ${res.status}` };
      }
      const json = await res.json() as { messages?: Array<{ apiMessageId?: string }> };
      return {
        success: true,
        provider: 'clickatell',
        delivered: true,
        messageId: json.messages?.[0]?.apiMessageId,
      };
    } catch (err) {
      return { success: false, provider: 'clickatell', delivered: false, error: getErrMsg(err) };
    }
  },
};

function getActiveAdapter(): { adapter: SmsAdapter; provider: SmsProvider } {
  const configured = (Deno.env.get('SMS_PROVIDER') || 'noop').toLowerCase();
  switch (configured) {
    case 'twilio': return { adapter: twilioAdapter, provider: 'twilio' };
    case 'clickatell': return { adapter: clickatellAdapter, provider: 'clickatell' };
    case 'noop':
    default: return { adapter: noopAdapter, provider: 'noop' };
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Send a generic SMS. Always returns a result — never throws. Caller owns
 * audit logging; this function only emits stderr logs.
 */
export async function sendSms(msg: { to: string; body: string; kind: SmsMessage['kind'] }): Promise<SmsResult> {
  const e164 = toE164(msg.to);
  if (!e164) {
    log.warn(`SMS not sent: unparseable phone '${msg.to}'`);
    return { success: false, provider: 'noop', delivered: false, error: 'Invalid phone number' };
  }
  if (msg.body.length > 480) {
    log.warn(`SMS body ${msg.body.length} chars — will split into multiple segments`);
  }
  const { adapter, provider } = getActiveAdapter();
  try {
    const result = await adapter.send({ to: e164, body: msg.body, kind: msg.kind });
    log.info(
      `SMS ${msg.kind} → ${e164} via ${provider}: ` +
      `delivered=${result.delivered} success=${result.success}${result.error ? ` error=${result.error}` : ''}`
    );
    return result;
  } catch (err) {
    return { success: false, provider, delivered: false, error: getErrMsg(err) };
  }
}

/**
 * Send an OTP code by SMS. Formats a short, unambiguous message.
 * The caller should still email the OTP if `delivered: false`.
 */
export async function sendOtpSms(params: {
  to: string;
  otp: string;
  envelopeTitle?: string;
  expiresInMinutes?: number;
}): Promise<SmsResult> {
  const title = params.envelopeTitle
    ? `"${params.envelopeTitle.slice(0, 40)}"`
    : 'your document';
  const expiry = params.expiresInMinutes ?? 15;
  const body = `Navigate Wealth: ${params.otp} is your code to sign ${title}. Expires in ${expiry} min. Do not share.`;
  return sendSms({ to: params.to, body, kind: 'otp' });
}

/**
 * Send a "you have a document to sign" SMS invite.
 */
export async function sendInviteSms(params: {
  to: string;
  signerName: string;
  envelopeTitle: string;
  signingUrl: string;
}): Promise<SmsResult> {
  const firstName = params.signerName.split(/\s+/)[0] || params.signerName;
  // Trim URL to keep message short; the full URL still works.
  const url = params.signingUrl;
  const title = params.envelopeTitle.length > 40
    ? params.envelopeTitle.slice(0, 37) + '...'
    : params.envelopeTitle;
  const body = `Hi ${firstName}, you have a document to sign: "${title}". Open: ${url}`;
  return sendSms({ to: params.to, body, kind: 'invite' });
}

/**
 * Send a reminder SMS for a pending envelope.
 */
export async function sendReminderSms(params: {
  to: string;
  signerName: string;
  envelopeTitle: string;
  signingUrl: string;
  daysPending?: number;
}): Promise<SmsResult> {
  const firstName = params.signerName.split(/\s+/)[0] || params.signerName;
  const title = params.envelopeTitle.length > 40
    ? params.envelopeTitle.slice(0, 37) + '...'
    : params.envelopeTitle;
  const age = params.daysPending ? ` (pending ${params.daysPending}d)` : '';
  const body = `Hi ${firstName}, reminder to sign "${title}"${age}: ${params.signingUrl}`;
  return sendSms({ to: params.to, body, kind: 'reminder' });
}

/**
 * Runtime introspection for the admin dashboard / diagnostics.
 */
export function getSmsProviderStatus(): {
  provider: SmsProvider;
  configured: boolean;
} {
  const provider = (Deno.env.get('SMS_PROVIDER') || 'noop').toLowerCase() as SmsProvider;
  switch (provider) {
    case 'twilio':
      return {
        provider,
        configured: !!(Deno.env.get('TWILIO_ACCOUNT_SID') &&
          Deno.env.get('TWILIO_AUTH_TOKEN') &&
          Deno.env.get('TWILIO_FROM_NUMBER')),
      };
    case 'clickatell':
      return {
        provider,
        configured: !!Deno.env.get('CLICKATELL_API_KEY'),
      };
    default:
      return { provider: 'noop', configured: true };
  }
}
