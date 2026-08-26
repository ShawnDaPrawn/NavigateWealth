/**
 * Source ratchet: an e-sign invite audit event must not claim a delivery that
 * did not happen.
 * ==========================================================================
 *
 * `sendEmail` returns `false` WITHOUT throwing on three paths (email-core.ts):
 * no SENDGRID_API_KEY, a non-OK SendGrid response, and any caught error. Four
 * separate call sites had the identical shape —
 *
 *     if (emailSent) { await updateSignerStatus(...); }
 *     await logAuditEvent({ action: 'invite_sent', ... });   // unconditional
 *
 * — so a silent SendGrid failure left the signer record correctly showing no
 * invite while the audit trail asserted one had gone out. The audit trail is
 * the ECTA evidence artefact for the signature, which makes an overstatement
 * here the wrong direction to be wrong in: it favours the firm's account of
 * events over the recipient's. Operationally it is just as bad — the envelope
 * stalls with nothing surfacing why, because everyone is waiting on a
 * signature from someone who was never told.
 *
 * WHY A SOURCE RATCHET RATHER THAN FOUR ROUTE SUITES
 * The behavioural test lives in esign-packet-service.contract.test.ts, which
 * drives the real service through the real `sendEmail` boundary. The other
 * three sites sit deep inside large route handlers whose harnesses would cost
 * far more than the one line each is being checked for — and a ratchet catches
 * the FIFTH site, which a per-site test by definition cannot.
 *
 * This asserts the guard exists, not that it is spelled a particular way: any
 * conditional expression on the `action` is accepted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SERVER_DIR = join(import.meta.dirname!, '..');

/** Every `action: <expr>,` whose expression mentions invite_sent. */
const INVITE_ACTION = /action:\s*([^\n]*?'invite_sent'[^\n]*?),/g;

function serverSources(): string[] {
  return readdirSync(SERVER_DIR)
    .filter((f) => /^esign-.*\.(ts|tsx)$/.test(f))
    .map((f) => join(SERVER_DIR, f));
}

describe('invite audit honesty (source ratchet)', () => {
  it('never logs invite_sent unconditionally', () => {
    const offenders: string[] = [];

    for (const path of serverSources()) {
      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(INVITE_ACTION)) {
        const expression = match[1].trim();
        // A bare literal is the defect. A conditional — however spelled — has
        // consulted the send result, which is all this ratchet asks.
        if (expression === `'invite_sent'`) {
          const line = source.slice(0, match.index).split('\n').length;
          offenders.push(`${path.split('/').pop()}:${line}`);
        }
      }
    }

    expect(
      offenders,
      `logAuditEvent must not assert 'invite_sent' without consulting the sendEmail result. ` +
        `Offending sites: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('finds the four known call sites, so the ratchet is actually scanning', () => {
    // Without this, deleting the regex or pointing it at an empty directory
    // would make the ratchet above pass vacuously — the exact failure mode a
    // ratchet is supposed to prevent.
    const sitesByFile = new Map<string, number>();
    for (const path of serverSources()) {
      const source = readFileSync(path, 'utf8');
      const count = [...source.matchAll(INVITE_ACTION)].length;
      if (count > 0) sitesByFile.set(path.split('/').pop()!, count);
    }

    expect([...sitesByFile.keys()].sort()).toEqual([
      'esign-documents-routes.ts',
      'esign-packet-service.ts',
      'esign-sender-envelope-routes.ts',
      'esign-signer-submit-routes.ts',
    ]);
  });

  it('the ratchet regex rejects the shape that shipped and accepts the fix', () => {
    const check = (snippet: string) => [...snippet.matchAll(INVITE_ACTION)].map((m) => m[1].trim());

    expect(check(`          action: 'invite_sent',\n`)).toEqual([`'invite_sent'`]);
    expect(check(`  action: emailSent ? 'invite_sent' : 'invite_send_failed',\n`)).toEqual([
      `emailSent ? 'invite_sent' : 'invite_send_failed'`,
    ]);
    expect(check(`  action: sent ? 'invite_sent' : 'invite_send_failed',\n`)).toEqual([
      `sent ? 'invite_sent' : 'invite_send_failed'`,
    ]);
    // Near misses that must not be mistaken for the invite action.
    expect(check(`  action: 'invite_sms_sent',\n`)).toEqual([]);
    expect(check(`  action: 'invite_send_failed',\n`)).toEqual([]);
  });
});
