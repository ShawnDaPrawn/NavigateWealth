/**
 * GoAML morning digest — snapshot, diff, and transactional mail.
 *
 * The browser login and Outlook OTP live in the Cursor Automation. This
 * service only accepts a structured scan, diffs it against yesterday's
 * snapshot, and sends one branded email through sendEmail().
 */

import { createModuleLogger } from './stderr-logger.ts';
import { escapeHtml } from './shared-validation-utils.ts';
import {
  sendEmail,
  createEmailTemplate,
  getFooterSettings,
  getEmailTemplate,
} from './email-service.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import {
  goamlDigestStore,
  GOAML_DIGEST_LAST_SENT_ID,
  GOAML_DIGEST_LATEST_ID,
} from './repositories/goaml-digest-repository.ts';
import {
  DEFAULT_DIGEST_RECIPIENTS,
  GOAML_DIGEST_TEMPLATE_ID,
  GOAML_HOME_URL,
  type GoamlDigestOutcome,
  type GoamlDigestRecord,
  type GoamlNotifyResult,
  type GoamlScanDiff,
  type GoamlScanReport,
  type GoamlUpdate,
} from './goaml-digest-types.ts';

const log = createModuleLogger('goaml-digest');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseDigestRecipients(raw: string | undefined): string[] {
  const source = (raw ?? '').trim();
  const list = (source || DEFAULT_DIGEST_RECIPIENTS.join(','))
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => EMAIL_RE.test(entry));
  return [...new Set(list)];
}

export function sastDateKey(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
}

export function formatSastDate(now = new Date()): string {
  return now.toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  });
}

export function fingerprintUpdate(update: GoamlUpdate): string {
  const title = update.title.trim().toLowerCase().replace(/\s+/g, ' ');
  const href = (update.href ?? '').trim().toLowerCase();
  return `${title}|${href}`;
}

export function fingerprintUpdates(updates: GoamlUpdate[]): string {
  return updates.map(fingerprintUpdate).sort().join('\n');
}

export function diffUpdates(
  previous: GoamlUpdate[] | undefined,
  current: GoamlUpdate[],
): GoamlScanDiff {
  const prevMap = new Map((previous ?? []).map((item) => [fingerprintUpdate(item), item]));
  const currKeys = new Set(current.map(fingerprintUpdate));
  return {
    added: current.filter((item) => !prevMap.has(fingerprintUpdate(item))),
    removed: (previous ?? []).filter((item) => !currKeys.has(fingerprintUpdate(item))),
    unchanged: current.filter((item) => prevMap.has(fingerprintUpdate(item))),
  };
}

export function shouldSkipDuplicate(
  lastSent: GoamlDigestRecord | null,
  fingerprint: string,
  sastDate: string,
  force: boolean,
): boolean {
  if (force) return false;
  if (!lastSent) return false;
  return lastSent.sastDate === sastDate && lastSent.fingerprint === fingerprint;
}

function severityColour(severity: GoamlUpdate['severity']): { bg: string; text: string } {
  if (severity === 'urgent') return { bg: '#dc2626', text: '#ffffff' };
  if (severity === 'attention') return { bg: '#d97706', text: '#ffffff' };
  return { bg: '#2563eb', text: '#ffffff' };
}

function renderUpdateRows(updates: GoamlUpdate[], emptyLabel: string): string {
  if (updates.length === 0) {
    return `<tr><td colspan="3" style="padding: 14px; color: #6b7280; font-size: 13px;">${escapeHtml(emptyLabel)}</td></tr>`;
  }
  return updates
    .map((item) => {
      const colour = severityColour(item.severity);
      const title = item.href
        ? `<a href="${escapeHtml(item.href)}" style="color: #111827; font-weight: 600; text-decoration: underline;">${escapeHtml(item.title)}</a>`
        : `<span style="font-weight: 600; color: #111827;">${escapeHtml(item.title)}</span>`;
      const area = item.area ? escapeHtml(item.area) : 'Portal';
      return `
        <tr>
          <td style="padding: 12px 14px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
            <div style="margin-bottom: 3px;">${title}</div>
            ${item.summary ? `<div style="font-size: 12px; color: #6b7280;">${escapeHtml(item.summary)}</div>` : ''}
          </td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; text-align: center; vertical-align: top;">
            <span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;background:${colour.bg};color:${colour.text};">${escapeHtml(item.severity)}</span>
          </td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; font-size: 12px; color: #6b7280;">
            ${area}
          </td>
        </tr>`;
    })
    .join('');
}

export function buildDigestBodies(
  report: GoamlScanReport,
  diff: GoamlScanDiff,
  dateLabel: string,
  introHtml: string,
): { htmlBody: string; text: string } {
  const statusLine = report.loginSucceeded
    ? diff.added.length > 0
      ? `The morning scan found <strong>${diff.added.length}</strong> new item(s) on goAML.`
      : 'The morning scan completed. There are no new items since the last successful digest.'
    : 'The morning scan <strong>could not sign in</strong> to goAML. Review the notes below and retry from the automation.';

  const notesBlock = report.notes
    ? `<p style="font-size: 13px; color: #374151; margin-top: 12px;"><strong>Operator notes:</strong> ${escapeHtml(report.notes)}</p>`
    : '';

  const htmlBody = `
    ${introHtml}
    <p>${statusLine}</p>
    ${notesBlock}
    <h3 style="margin: 24px 0 8px; font-size: 15px; color: #111827;">New since last digest</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
      <thead>
        <tr>
          <th align="left" style="padding: 8px 14px; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Item</th>
          <th style="padding: 8px 10px; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Severity</th>
          <th align="left" style="padding: 8px 10px; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Area</th>
        </tr>
      </thead>
      <tbody>${renderUpdateRows(diff.added, 'No new items.')}</tbody>
    </table>
    <h3 style="margin: 24px 0 8px; font-size: 15px; color: #111827;">Still present</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
      <tbody>${renderUpdateRows(diff.unchanged, 'Nothing carried over from the previous scan.')}</tbody>
    </table>
    ${
      diff.removed.length > 0
        ? `<h3 style="margin: 24px 0 8px; font-size: 15px; color: #111827;">No longer listed</h3>
           <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
             <tbody>${renderUpdateRows(diff.removed, '')}</tbody>
           </table>`
        : ''
    }
    <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">
      Scan time (SAST date ${escapeHtml(dateLabel)}). Source: ${escapeHtml(report.sourceUrl)}.
    </p>
  `;

  const textLines = [
    `GoAML morning digest — ${dateLabel}`,
    report.loginSucceeded
      ? diff.added.length > 0
        ? `New items: ${diff.added.length}`
        : 'No new items since the last digest.'
      : 'LOGIN FAILED — the automation could not sign in.',
    report.notes ? `Notes: ${report.notes}` : '',
    ...diff.added.map((item) => `- NEW: ${item.title}${item.area ? ` (${item.area})` : ''}`),
    `Open goAML: ${report.sourceUrl}`,
  ].filter(Boolean);

  return { htmlBody, text: textLines.join('\n') };
}

export function resolveDigestSubject(
  templateSubject: string,
  report: GoamlScanReport,
  diff: GoamlScanDiff,
  dateLabel: string,
): string {
  const status = report.loginSucceeded
    ? diff.added.length > 0
      ? `${diff.added.length} new item(s)`
      : 'no new updates'
    : 'scan failed';
  return templateSubject
    .replaceAll('{{ .Date }}', dateLabel)
    .replaceAll('{{ .UpdateCount }}', String(report.updates.length))
    .replaceAll('{{ .NewCount }}', String(diff.added.length))
    .replaceAll('{{ .Status }}', status);
}

function toRecord(
  report: GoamlScanReport,
  diff: GoamlScanDiff,
  sastDate: string,
  outcome: GoamlDigestOutcome,
  extras: Partial<GoamlDigestRecord> = {},
): GoamlDigestRecord {
  return {
    kind: extras.kind ?? 'snapshot',
    scannedAt: report.scannedAt,
    sastDate,
    loginSucceeded: report.loginSucceeded,
    otpRequired: report.otpRequired,
    otpSucceeded: report.otpSucceeded,
    updates: report.updates,
    fingerprint: fingerprintUpdates(report.updates),
    notes: report.notes,
    sourceUrl: report.sourceUrl,
    dryRun: report.dryRun,
    outcome,
    addedCount: diff.added.length,
    removedCount: diff.removed.length,
    ...extras,
  };
}

export async function processGoamlNotify(report: GoamlScanReport): Promise<GoamlNotifyResult> {
  const sastDate = sastDateKey();
  const dateLabel = formatSastDate();
  const previous = await goamlDigestStore.get(GOAML_DIGEST_LATEST_ID);
  const lastSent = await goamlDigestStore.get(GOAML_DIGEST_LAST_SENT_ID);
  const diff = diffUpdates(previous?.updates, report.updates);
  const fingerprint = fingerprintUpdates(report.updates);
  const recipients = parseDigestRecipients(Deno.env.get('NW_GOAML_DIGEST_TO'));

  const baseResult = {
    success: true,
    sastDate,
    updateCount: report.updates.length,
    addedCount: diff.added.length,
    removedCount: diff.removed.length,
    recipientCount: recipients.length,
    dryRun: report.dryRun,
  };

  if (recipients.length === 0) {
    throw new Error('NW_GOAML_DIGEST_TO resolved to an empty recipient list');
  }

  if (shouldSkipDuplicate(lastSent, fingerprint, sastDate, report.force)) {
    log.info('Skipping duplicate GoAML digest for today', { sastDate });
    return { ...baseResult, sent: false, outcome: 'skipped_duplicate' };
  }

  const template = await getEmailTemplate(GOAML_DIGEST_TEMPLATE_ID);
  if (!template.enabled) {
    log.info('goaml_scan_digest template is disabled — sending nothing');
    return { ...baseResult, sent: false, outcome: 'template_disabled' };
  }

  const introHtml = template.bodyHtml
    .replaceAll('{{ .Date }}', escapeHtml(dateLabel))
    .replaceAll('{{ .UpdateCount }}', String(report.updates.length))
    .replaceAll('{{ .NewCount }}', String(diff.added.length));
  const { htmlBody, text } = buildDigestBodies(report, diff, dateLabel, introHtml);
  const footerSettings = await getFooterSettings();
  const html = createEmailTemplate(htmlBody, {
    title: template.title,
    subtitle: template.subtitle.replaceAll('{{ .Date }}', dateLabel),
    greeting: template.greeting,
    buttonUrl: template.buttonUrl || GOAML_HOME_URL,
    buttonLabel: template.buttonLabel || 'Open goAML',
    footerNote: template.footerNote,
    footerSettings,
  });
  const subject = resolveDigestSubject(template.subject, report, diff, dateLabel);
  const outcome: GoamlDigestOutcome = report.dryRun
    ? 'dry_run'
    : report.loginSucceeded
      ? 'sent'
      : 'login_failed_notified';

  if (!report.dryRun) {
    const sent = await sendEmail({
      to: recipients[0],
      cc: recipients.length > 1 ? recipients.slice(1) : undefined,
      subject,
      html,
      text,
      throwOnError: true,
    });
    if (!sent) {
      throw new Error('sendEmail returned false for the GoAML digest');
    }
  }

  const snapshot = toRecord(report, diff, sastDate, outcome);
  if (!report.dryRun) {
    // A failed login must not become tomorrow's baseline or every item
    // will look new after the next successful sign-in.
    if (report.loginSucceeded) {
      await goamlDigestStore.put(GOAML_DIGEST_LATEST_ID, snapshot);
    }
    await goamlDigestStore.put(
      GOAML_DIGEST_LAST_SENT_ID,
      toRecord(report, diff, sastDate, outcome, {
        kind: 'send',
        sentAt: new Date().toISOString(),
        recipientCount: recipients.length,
      }),
    );
  }

  AdminAuditService.record({
    actorId: 'goaml-digest-automation',
    actorRole: 'system',
    category: 'system',
    action: report.dryRun ? 'goaml_digest_dry_run' : 'goaml_digest_sent',
    summary: report.loginSucceeded
      ? `GoAML morning digest (${diff.added.length} new / ${report.updates.length} total)`
      : 'GoAML morning digest reported a login failure',
    severity: report.loginSucceeded ? (diff.added.length > 0 ? 'warning' : 'info') : 'critical',
    entityType: 'compliance',
    entityId: sastDate,
    metadata: {
      outcome,
      addedCount: diff.added.length,
      updateCount: report.updates.length,
      dryRun: report.dryRun,
    },
  }).catch(() => {});

  log.info('GoAML digest processed', {
    outcome,
    addedCount: diff.added.length,
    updateCount: report.updates.length,
    dryRun: report.dryRun,
  });

  return {
    ...baseResult,
    sent: !report.dryRun,
    outcome,
  };
}

export async function getLatestSnapshot(): Promise<GoamlDigestRecord | null> {
  return goamlDigestStore.get(GOAML_DIGEST_LATEST_ID);
}

export async function getLastSent(): Promise<GoamlDigestRecord | null> {
  return goamlDigestStore.get(GOAML_DIGEST_LAST_SENT_ID);
}

export function toPublicSnapshot(record: GoamlDigestRecord | null) {
  if (!record) return null;
  return {
    scannedAt: record.scannedAt,
    sastDate: record.sastDate,
    loginSucceeded: record.loginSucceeded,
    updates: record.updates,
    fingerprint: record.fingerprint,
    notes: record.notes,
    sourceUrl: record.sourceUrl,
    outcome: record.outcome,
    addedCount: record.addedCount,
    removedCount: record.removedCount,
    sentAt: record.sentAt,
  };
}
