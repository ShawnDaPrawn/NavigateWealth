/**
 * Formatting for the e-sign certificate of completion: SAST dates and times,
 * durations, masked phone numbers, readable devices, audit actions in plain
 * English, and text that is safe to draw with the standard PDF fonts.
 *
 * Pure functions — `esign-certificate-pdf.ts` draws with them.
 */

import type { PDFFont, RGB } from 'npm:pdf-lib@1.17.1';

// ============================================================================
// FORMATTING
// ============================================================================

const SAST_OFFSET_MS = 2 * 60 * 60 * 1000; // South Africa has no daylight saving
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function sast(iso: string | undefined): Date | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? new Date(ms + SAST_OFFSET_MS) : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "10:11:42" in SAST. */
export function fmtTime(iso: string | undefined): string {
  const d = sast(iso);
  return d ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` : '';
}

/** "12 Nov 2026" in SAST. */
export function fmtDate(iso: string | undefined): string {
  const d = sast(iso);
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '';
}

/** "12 Nov 2026, 10:11:42 SAST", or "Not recorded". */
export function fmtDateTime(iso: string | undefined, withZone = true): string {
  if (!sast(iso)) return 'Not recorded';
  return `${fmtDate(iso)}, ${fmtTime(iso)}${withZone ? ' SAST' : ''}`;
}

/** "Thursday, 12 November 2026" in SAST. */
export function fmtDay(iso: string): string {
  const d = sast(iso);
  if (!d) return 'Date not recorded';
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "12 Nov, 10:11:42" — short form for timelines. */
export function fmtShort(iso: string | undefined): string {
  const d = sast(iso);
  return d
    ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
    : '';
}

/** "1 h 25 min 14 s". */
export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (h || m) parts.push(`${m} min`);
  parts.push(`${s} s`);
  return parts.join(' ');
}

/** "+27 82 ••• 4417" — the last four digits stay readable. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return phone;
  const last4 = digits.slice(-4);
  const prefix = phone.trim().startsWith('+')
    ? `+${digits.slice(0, 2)} ${digits.slice(2, 4)}`
    : digits.slice(0, 3);
  return `${prefix} ••• ${last4}`;
}

/** A readable device from a user-agent string: "Safari 19 on iPhone (iOS 19.1)". */
export function describeDevice(ua: string | undefined): string {
  if (!ua) return 'Not recorded';
  const ver = (re: RegExp) => ua.match(re)?.[1]?.split('.')[0];
  let browser = '';
  if (/Edg(e|A|iOS)?\//.test(ua)) browser = `Edge ${ver(/Edg(?:e|A|iOS)?\/([\d.]+)/) ?? ''}`;
  else if (/OPR\//.test(ua)) browser = `Opera ${ver(/OPR\/([\d.]+)/) ?? ''}`;
  else if (/SamsungBrowser\//.test(ua))
    browser = `Samsung Internet ${ver(/SamsungBrowser\/([\d.]+)/) ?? ''}`;
  else if (/CriOS\//.test(ua)) browser = `Chrome ${ver(/CriOS\/([\d.]+)/) ?? ''}`;
  else if (/FxiOS\//.test(ua)) browser = `Firefox ${ver(/FxiOS\/([\d.]+)/) ?? ''}`;
  else if (/Firefox\//.test(ua)) browser = `Firefox ${ver(/Firefox\/([\d.]+)/) ?? ''}`;
  else if (/Chrome\//.test(ua)) browser = `Chrome ${ver(/Chrome\/([\d.]+)/) ?? ''}`;
  else if (/Safari\//.test(ua)) browser = `Safari ${ver(/Version\/([\d.]+)/) ?? ''}`;
  browser = browser.trim();

  let os = '';
  const ios = ua.match(/(?:iPhone|CPU) OS ([\d_]+)/)?.[1]?.replace(/_/g, '.');
  if (/iPhone/.test(ua)) os = `iPhone${ios ? ` (iOS ${ios})` : ''}`;
  else if (/iPad/.test(ua)) os = `iPad${ios ? ` (iPadOS ${ios})` : ''}`;
  else if (/Android/.test(ua)) {
    const v = ua.match(/Android ([\d.]+)/)?.[1];
    os = `Android${v ? ` ${v}` : ''}`;
  } else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  if (browser && os) return `${browser} on ${os}`;
  return browser || os || 'Unrecognised device';
}

export function channelLabel(ch: string): string {
  const c = ch.toLowerCase();
  if (c === 'sms') return 'SMS';
  if (c === 'email') return 'email';
  if (c === 'whatsapp') return 'WhatsApp';
  return c;
}

export function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// ============================================================================
// AUDIT EVENTS IN PLAIN ENGLISH
// ============================================================================

const EVENT_LABELS: Record<string, string> = {
  envelope_created: 'Envelope created',
  esign_envelope_created: 'Envelope created',
  envelope_created_from_template_api: 'Envelope created from a template',
  document_uploaded: 'Document uploaded',
  document_added: 'Document added',
  document_removed: 'Document removed',
  documents_reordered: 'Documents reordered',
  envelope_materialised: 'Documents combined for signing',
  page_manifest_updated: 'Pages updated',
  page_manifest_materialised: 'Pages updated',
  page_manifest_cleared: 'Page changes cleared',
  page_manifest_previewed: 'Page changes previewed',
  prefill_resolved: 'Fields pre-filled from the client record',
  fields_updated: 'Signature fields placed',
  field_deleted: 'Field removed',
  draft_settings_updated: 'Envelope settings changed',
  signing_mode_changed: 'Signing order changed',
  reminder_config_updated: 'Reminder settings changed',
  esign_invites_sent: 'Envelope sent',
  sent: 'Envelope sent',
  invite_sent: 'Invitation emailed',
  invite_sms_sent: 'Invitation sent by SMS',
  invite_send_failed: 'Invitation could not be sent',
  email_failed: 'Email could not be sent',
  reminder_sent: 'Reminder sent',
  esign_bulk_remind: 'Reminder sent',
  viewed: 'Document opened',
  otp_sent: 'One-time PIN sent',
  otp_resent: 'One-time PIN sent again',
  otp_verified: 'One-time PIN verified',
  kba_check: 'Identity check',
  consent_accepted: 'Consent accepted',
  attachment_uploaded: 'Attachment uploaded',
  signed: 'Document signed',
  declined: 'Declined to sign',
  signer_status_changed: 'Signer status changed',
  signer_token_rotated: 'Signing link replaced',
  status_changed: 'Envelope status changed',
  paused: 'Envelope paused',
  recalled: 'Envelope recalled',
  esign_envelope_recalled: 'Envelope recalled',
  restored: 'Envelope restored',
  esign_envelope_restored: 'Envelope restored',
  soft_deleted: 'Envelope moved to the recovery bin',
  esign_envelope_soft_deleted: 'Envelope moved to the recovery bin',
  envelope_expired_auto: 'Envelope expired',
  envelope_voided_bulk: 'Envelope voided',
  esign_bulk_void: 'Envelope voided',
  envelope_completion_queued: 'Completion started',
  completion_enqueued: 'Completion started',
  completion_failed: 'Completion attempt failed',
  completion_dead_lettered: 'Completion stopped after repeated failures',
  completed: 'Envelope completed',
  digital_signature_applied: 'Digital seal applied',
  evidence_pack_exported: 'Evidence pack exported',
};

const ACRONYMS: Record<string, string> = {
  otp: 'OTP',
  kba: 'KBA',
  sms: 'SMS',
  pdf: 'PDF',
  ip: 'IP',
};

/** "otp_sent" → "One-time PIN sent"; unknown actions become sentence case. */
export function describeAction(action: string): string {
  if (EVENT_LABELS[action]) return EVENT_LABELS[action];
  const words = action
    .replace(/^esign_/, '')
    .split(/[_\s.]+/)
    .filter(Boolean)
    .map((w) => ACRONYMS[w.toLowerCase()] ?? w.toLowerCase());
  if (words.length === 0) return 'Event';
  const first = words[0];
  words[0] = first === first.toUpperCase() ? first : first[0].toUpperCase() + first.slice(1);
  return words.join(' ');
}

/**
 * The second line under an audit event: the channel, the recipient or the
 * reason, when the event records one. `signerName` is the signer the event's
 * email belongs to, if any.
 */
export function auditDetail(
  e: { action: string; actor_type?: string; metadata?: Record<string, unknown> },
  signerName?: string,
): string {
  const md = e.metadata ?? {};
  const ch = (md.channel ?? md.method) as string | undefined;
  const bySystem = e.actor_type === 'system';
  switch (e.action) {
    case 'otp_sent':
    case 'otp_resent':
      return `By ${channelLabel(ch || 'email')}${signerName && bySystem ? ` to ${signerName}` : ''}`;
    case 'invite_sent':
    case 'invite_sms_sent':
    case 'reminder_sent':
      return signerName ? `To ${signerName}` : '';
    case 'declined':
    case 'recalled':
    case 'esign_envelope_recalled':
      return typeof md.reason === 'string' ? `Reason: ${md.reason}` : '';
    case 'kba_check':
      return typeof md.status === 'string' ? `Result: ${md.status}` : '';
    default:
      return signerName && bySystem ? `For ${signerName}` : '';
  }
}

// ============================================================================
// TEXT: ENCODING AND WRAPPING
// ============================================================================

/**
 * The standard fonts encode WinAnsi only; pdf-lib throws on anything else
 * (a name in another script, an emoji in a reason). Accents are stripped
 * where that is enough, anything still unencodable becomes "?".
 */
export function makeSanitiser(font: PDFFont): (s: string) => string {
  const supported = new Set(font.getCharacterSet());
  return (s: string) => {
    let out = '';
    for (const ch of s.replace(/[\r\n\t]+/g, ' ')) {
      const cp = ch.codePointAt(0)!;
      if (supported.has(cp)) {
        out += ch;
        continue;
      }
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      out += base && [...base].every((b) => supported.has(b.codePointAt(0)!)) ? base : '?';
    }
    return out;
  };
}

export type Run = { text: string; font: PDFFont; color?: RGB };

/** Wraps runs of mixed fonts to lines no wider than maxW. Long words break by character. */
export function wrapRuns(runs: Run[], size: number, maxW: number): Run[][] {
  type Tok = { text: string; font: PDFFont; color?: RGB; space: boolean };
  const toks: Tok[] = [];
  for (const r of runs) {
    for (const part of r.text.split(/(\s+)/)) {
      if (!part) continue;
      toks.push({ text: part, font: r.font, color: r.color, space: /^\s+$/.test(part) });
    }
  }
  const lines: Run[][] = [];
  let line: Run[] = [];
  let w = 0;
  const push = (t: Tok) => {
    const last = line[line.length - 1];
    if (last && last.font === t.font && last.color === t.color) last.text += t.text;
    else line.push({ text: t.text, font: t.font, color: t.color });
    w += t.font.widthOfTextAtSize(t.text, size);
  };
  const breakLine = () => {
    if (line.length) {
      const last = line[line.length - 1];
      last.text = last.text.replace(/\s+$/, '');
    }
    lines.push(line);
    line = [];
    w = 0;
  };
  for (const t of toks) {
    if (t.space) {
      if (line.length) push({ ...t, text: ' ' });
      continue;
    }
    const tw = t.font.widthOfTextAtSize(t.text, size);
    if (w + tw <= maxW) {
      push(t);
      continue;
    }
    if (line.length && tw <= maxW) {
      breakLine();
      push(t);
      continue;
    }
    // A word longer than a whole line (a user agent, a long email): split it.
    let rest = t.text;
    while (rest) {
      let n = rest.length;
      while (n > 1 && w + t.font.widthOfTextAtSize(rest.slice(0, n), size) > maxW) n -= 1;
      if (w > 0 && w + t.font.widthOfTextAtSize(rest.slice(0, n), size) > maxW) {
        breakLine();
        continue;
      }
      push({ ...t, text: rest.slice(0, n) });
      rest = rest.slice(n);
      if (rest) breakLine();
    }
  }
  if (line.length || lines.length === 0) breakLine();
  return lines;
}

// ============================================================================
// LEGAL BASIS — worded from what the records show
// ============================================================================

/**
 * The legal-basis paragraphs, as [run-in heading, text]. The identity sentence
 * names a one-time PIN only when signers were actually OTP-gated, and the
 * consent only when consent wording was recorded: the certificate never
 * claims an assurance the records do not show.
 */
export function legalParagraphs(o: {
  allOtp: boolean;
  someOtp: boolean;
  hasConsent: boolean;
  contact: string;
}): [string, string][] {
  const idMethod = o.allOtp
    ? 'a unique, single-use signing link sent to their own contact details and a one-time PIN'
    : o.someOtp
      ? 'a unique, single-use signing link sent to their own contact details and, where shown on the signer evidence page, a one-time PIN'
      : 'a unique, single-use signing link sent to their own contact details';
  const approval = o.hasConsent
    ? 'by accepting the consent above and adopting their signature'
    : 'by adopting their signature';
  return [
    [
      'Type of signature.',
      'Each signature in this envelope is an electronic signature as defined in section 1 of the Electronic Communications and Transactions Act 25 of 2002 (ECTA), used with the agreement of the parties. It is not an advanced electronic signature as provided for in section 37 of ECTA.',
    ],
    [
      'Identity and approval — section 13(3)(a).',
      `Each signer was identified by ${idMethod}, and showed approval of the document ${approval}.`,
    ],
    [
      'Reliability and integrity — sections 13(3)(b), 14 and 15.',
      "Every event is time-stamped by the platform's server clock, the document sent for signing is fingerprinted with SHA-256, and the completion process applies a digital seal so that any later change can be detected.",
    ],
    [
      'Record keeping.',
      'Navigate Wealth keeps the signed document, this certificate and the full audit trail for at least five years, in line with section 18 of the Financial Advisory and Intermediary Services Act 37 of 2002.',
    ],
    [
      'Personal information.',
      `IP addresses, device details and contact details in this certificate are processed only as evidence of this transaction, in line with the Protection of Personal Information Act 4 of 2013. Queries: ${o.contact}.`,
    ],
  ];
}
