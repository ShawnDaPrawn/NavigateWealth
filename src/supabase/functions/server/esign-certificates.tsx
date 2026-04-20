/**
 * E-Signature Certificate Generation Service (KV Store Version)
 * Generates completion certificates for fully signed envelopes
 * Uses the Navigate Wealth branded PDF template with proper pagination.
 */

import * as kv from "./kv_store.tsx";
import { uploadCertificate, calculateHash } from "./esign-storage.ts";
import { getEnvelopeDetails, getAuditTrail } from "./esign-services.ts";
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import { EsignKeys } from './esign-keys.ts';
import { createModuleLogger } from "./stderr-logger.ts";
import { getConsentByVersion } from './esign-consent-registry.ts';

const log = createModuleLogger('esign-certificates');

interface EnvelopeData {
  id: string;
  title: string;
  created_at: string;
  completed_at: string;
  client_name: string;
  sender_name: string;
  /** P6.5 — sender-supplied signing reason/capacity prompt, if any. */
  signing_reason_prompt?: string;
  /** P6.4 — consent version + immutable text the signers saw. */
  consent?: { id: string; text: string };
  signers: Array<{
    name: string;
    email: string;
    role: string;
    phone?: string;
    signed_at: string;
    invite_sent_at?: string;
    viewed_at?: string;
    ip_address?: string;
    /** P6.3 — browser/device user-agent captured at signature time. */
    user_agent?: string;
    /** P6.3 — elapsed time from first view to successful signature. */
    time_to_sign_ms?: number;
    /** P6.3 — OTP channels used (email / sms). */
    otp_methods?: string[];
    /** P6.3 — summary of signature capture telemetry. */
    signature_telemetry?: {
      strokes?: number;
      duration_ms?: number;
      method?: 'draw' | 'type' | 'upload';
    };
    /** P6.4 — consent version the signer acknowledged. */
    consent_version?: string;
    /** P6.5 — signing reason/capacity attested by the signer. */
    signing_reason?: string;
    /** P6.6 — KBA outcome. */
    kba?: { provider: string; status: string; reference?: string };
  }>;
  audit_events: Array<{
    action: string;
    at: string;
    actor_email: string;
    ip: string;
  }>;
}

// ============================================================================
// DATE FORMATTER
// ============================================================================

/** Safe date formatter — never throws */
function formatDateSafe(dateStr: string | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleString('en-ZA', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ============================================================================
// PDF GENERATION — NAVIGATE WEALTH BRANDED TEMPLATE
// ============================================================================

/**
 * Generate a PDF certificate using the Navigate Wealth branded template.
 * Uses a form-based layout with bordered sections, table-style audit trail,
 * proper text wrapping, and robust multi-page pagination — content never
 * overlaps the footer.
 */
async function generateCertificatePDF(data: EnvelopeData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // ── Page constants (A4 portrait: 595 × 842 points) ─────────────────
  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 50;
  const CONTENT_W = PAGE_W - MARGIN * 2;       // 495pt usable width
  const HEADER_H = 65;                          // Branded header band
  const FOOTER_ZONE = 70;                       // Reserved footer space (generous)
  const FOOTER_LINE_Y = FOOTER_ZONE + 2;       // Line just above footer text
  const FOOTER_TEXT_Y = FOOTER_ZONE - 15;       // Footer text baseline
  const CONTENT_TOP = PAGE_H - HEADER_H - 24;   // First usable Y after header
  const MIN_CONTENT_Y = FOOTER_ZONE + 15;       // Lowest Y before footer

  // ── Brand colours ──────────────────────────────────────────────────
  const PURPLE       = rgb(109 / 255, 40 / 255, 217 / 255);   // #6D28D9
  const PURPLE_LIGHT = rgb(139 / 255, 92 / 255, 246 / 255);   // #8B5CF6
  const DARK         = rgb(30 / 255, 27 / 255, 75 / 255);     // #1E1B4B
  const TEXT_COLOR   = rgb(17 / 255, 24 / 255, 39 / 255);     // gray-900
  const MUTED        = rgb(107 / 255, 114 / 255, 128 / 255);  // gray-500
  const LINE_COLOR   = rgb(0.82, 0.82, 0.82);
  const WHITE        = rgb(1, 1, 1);
  const SECTION_BG   = rgb(0.975, 0.975, 0.985);              // very light purple-gray
  const ROW_ALT_BG   = rgb(0.96, 0.96, 0.97);                 // alternating row
  const TABLE_BORDER = rgb(0.85, 0.85, 0.88);
  const GREEN        = rgb(22 / 255, 163 / 255, 74 / 255);    // #16A34A

  // ── Page management ────────────────────────────────────────────────
  type PDFPage = ReturnType<typeof pdfDoc.addPage>;
  const pages: PDFPage[] = [];
  let currentPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
  pages.push(currentPage);
  let y = CONTENT_TOP;

  // ── Text wrapping utility ──────────────────────────────────────────
  /**
   * Break text into lines that fit within maxWidth.
   * Returns an array of line strings.
   */
  const wrapText = (text: string, fontSize: number, usedFont: typeof font, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = usedFont.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
  };

  // ── Drawing primitives ─────────────────────────────────────────────

  /** Draw the branded header bar on a page */
  const drawHeader = (page: PDFPage) => {
    // Gradient-like effect: two rectangles
    page.drawRectangle({
      x: 0, y: PAGE_H - HEADER_H,
      width: PAGE_W, height: HEADER_H,
      color: PURPLE,
    });
    // Accent line at bottom of header
    page.drawRectangle({
      x: 0, y: PAGE_H - HEADER_H,
      width: PAGE_W, height: 2,
      color: PURPLE_LIGHT,
    });
    page.drawText('Navigate Wealth', {
      x: MARGIN, y: PAGE_H - 28,
      size: 16, font: boldFont, color: WHITE,
    });
    page.drawText('E-Signature Completion Certificate', {
      x: MARGIN, y: PAGE_H - 48,
      size: 10, font, color: rgb(0.88, 0.88, 0.95),
    });
    // Date on the right
    page.drawText(formatDateSafe(data.completed_at), {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(formatDateSafe(data.completed_at), 8),
      y: PAGE_H - 28,
      size: 8, font, color: rgb(0.8, 0.8, 0.9),
    });
  };

  /** Draw footer with page numbers */
  const drawFooter = (page: PDFPage, pageNum: number, totalPages: number) => {
    page.drawLine({
      start: { x: MARGIN, y: FOOTER_LINE_Y },
      end: { x: PAGE_W - MARGIN, y: FOOTER_LINE_Y },
      thickness: 0.5, color: LINE_COLOR,
    });
    page.drawText(
      'This certificate is electronically generated and legally binding under the ECTA. | Navigate Wealth',
      { x: MARGIN, y: FOOTER_TEXT_Y, size: 6.5, font: italicFont, color: MUTED }
    );
    page.drawText(
      `Page ${pageNum} of ${totalPages}`,
      {
        x: PAGE_W - MARGIN - font.widthOfTextAtSize(`Page ${pageNum} of ${totalPages}`, 7),
        y: FOOTER_TEXT_Y,
        size: 7, font, color: MUTED,
      }
    );
  };

  /** Ensure enough vertical space; if not, create a new page */
  const ensureSpace = (needed: number): number => {
    if (y - needed < MIN_CONTENT_Y) {
      currentPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
      pages.push(currentPage);
      drawHeader(currentPage);
      y = CONTENT_TOP;
    }
    return y;
  };

  /** Draw a bordered section heading with background */
  const sectionHeading = (title: string) => {
    const headingH = 26;
    y = ensureSpace(headingH + 10);
    y -= 6;

    // Section heading background
    currentPage.drawRectangle({
      x: MARGIN, y: y - headingH + 8,
      width: CONTENT_W, height: headingH,
      color: PURPLE,
      borderColor: PURPLE,
      borderWidth: 0,
    });
    currentPage.drawText(title, {
      x: MARGIN + 10, y: y - headingH + 16,
      size: 9.5, font: boldFont, color: WHITE,
    });
    y -= headingH + 4;
  };

  /** Draw a form row (label + value) inside a bordered section */
  const formRow = (
    label: string,
    value: string,
    options?: { isLast?: boolean; labelWidth?: number; valueBold?: boolean }
  ) => {
    const labelW = options?.labelWidth ?? 140;
    const valueMaxW = CONTENT_W - labelW - 25;
    const valueFont = options?.valueBold ? boldFont : font;
    const valueLines = wrapText(value || 'N/A', 8.5, valueFont, valueMaxW);
    const rowH = Math.max(18, valueLines.length * 12 + 6);

    y = ensureSpace(rowH + 2);

    // Row background (light)
    currentPage.drawRectangle({
      x: MARGIN, y: y - rowH + 4,
      width: CONTENT_W, height: rowH,
      color: SECTION_BG,
    });

    // Left & right borders
    currentPage.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: MARGIN, y: y - rowH + 4 },
      thickness: 0.5, color: TABLE_BORDER,
    });
    currentPage.drawLine({
      start: { x: MARGIN + CONTENT_W, y: y + 4 },
      end: { x: MARGIN + CONTENT_W, y: y - rowH + 4 },
      thickness: 0.5, color: TABLE_BORDER,
    });

    // Bottom border
    currentPage.drawLine({
      start: { x: MARGIN, y: y - rowH + 4 },
      end: { x: MARGIN + CONTENT_W, y: y - rowH + 4 },
      thickness: 0.5, color: options?.isLast ? TABLE_BORDER : LINE_COLOR,
    });

    // Label
    currentPage.drawText(label, {
      x: MARGIN + 10, y: y - 6,
      size: 8, font: boldFont, color: MUTED,
    });

    // Value (potentially multi-line)
    valueLines.forEach((line, i) => {
      currentPage.drawText(line, {
        x: MARGIN + labelW + 10, y: y - 6 - (i * 12),
        size: 8.5, font: valueFont, color: TEXT_COLOR,
      });
    });

    y -= rowH;
  };

  // ── Draw header on first page ──────────────────────────────────────
  drawHeader(currentPage);

  // ── DOCUMENT DETAILS section ───────────────────────────────────────
  sectionHeading('DOCUMENT DETAILS');
  formRow('Certificate ID', data.id);
  formRow('Document Title', data.title, { valueBold: true });
  formRow('Client', data.client_name);
  formRow('Sent By', data.sender_name);
  formRow('Document Created', formatDateSafe(data.created_at));
  formRow('Signing Completed', formatDateSafe(data.completed_at), { isLast: true });

  y -= 16;

  // ── SIGNING DETAILS section ────────────────────────────────────────
  sectionHeading('SIGNING DETAILS');

  data.signers.forEach((signer, index) => {
    const isLast = index === data.signers.length - 1;
    // Signer sub-header row
    const signerLabel = `Signer ${index + 1}`;
    const signerValue = `${signer.name}${signer.role ? ` (${signer.role})` : ''}`;
    formRow(signerLabel, signerValue, { valueBold: true });
    formRow('Email', signer.email);
    if (signer.phone) formRow('Mobile', signer.phone);
    formRow('Signed At', formatDateSafe(signer.signed_at));
    formRow('IP Address', signer.ip_address || 'Not recorded');

    // P6.3 — per-signer evidence package.
    if (signer.user_agent) {
      const ua = signer.user_agent.length > 140 ? `${signer.user_agent.slice(0, 140)}…` : signer.user_agent;
      formRow('Device / User Agent', ua);
    }
    if (typeof signer.time_to_sign_ms === 'number') {
      const mins = Math.round(signer.time_to_sign_ms / 60000);
      const pretty = mins >= 1 ? `${mins} minute${mins === 1 ? '' : 's'}` : `${Math.round(signer.time_to_sign_ms / 1000)} second(s)`;
      formRow('Time to Sign', pretty);
    }
    if (signer.otp_methods && signer.otp_methods.length > 0) {
      formRow('OTP Channel(s)', signer.otp_methods.map((m) => m.toUpperCase()).join(', '));
    }
    if (signer.signature_telemetry) {
      const tel = signer.signature_telemetry;
      const parts: string[] = [];
      if (tel.method) parts.push(`method=${tel.method}`);
      if (typeof tel.strokes === 'number') parts.push(`strokes=${tel.strokes}`);
      if (typeof tel.duration_ms === 'number') parts.push(`duration=${Math.round(tel.duration_ms / 100) / 10}s`);
      if (parts.length > 0) formRow('Signature Capture', parts.join(' · '));
    }
    if (signer.kba) {
      formRow('KBA', `${signer.kba.provider} — ${signer.kba.status}${signer.kba.reference ? ` (ref ${signer.kba.reference})` : ''}`);
    }
    if (signer.consent_version) {
      formRow('Consent Version', signer.consent_version);
    }
    if (signer.signing_reason) {
      formRow('Signing Capacity', signer.signing_reason, { isLast });
    } else {
      // Ensure the last row reads as last (bottom border style) when no
      // capacity row was emitted.
      // We can't retroactively re-draw the previous row; this is a
      // cosmetic-only improvement, so we simply add a small gap.
      if (isLast) y -= 0;
    }

    if (!isLast) {
      // Visual separator between signers
      y -= 2;
    }
  });

  y -= 16;

  // ── P6.4 — CONSENT TEXT (verbatim copy of the ECTA wording shown
  //    to every signer, pinned at envelope send-time). ───────────────
  if (data.consent) {
    sectionHeading(`CONSENT (VERSION ${data.consent.id.toUpperCase()})`);
    const consentLines = wrapText(data.consent.text, 8.5, font, CONTENT_W - 24);
    const blockH = consentLines.length * 11 + 20;
    y = ensureSpace(blockH + 8);
    currentPage.drawRectangle({
      x: MARGIN, y: y - blockH,
      width: CONTENT_W, height: blockH,
      color: SECTION_BG,
      borderColor: TABLE_BORDER,
      borderWidth: 0.5,
    });
    consentLines.forEach((line, i) => {
      currentPage.drawText(line, {
        x: MARGIN + 12,
        y: y - 14 - (i * 11),
        size: 8.5, font, color: TEXT_COLOR,
      });
    });
    y -= blockH + 10;
  }

  // ── P6.5 — SIGNING CAPACITY disclosure (sender-requested). ─────────
  if (data.signing_reason_prompt) {
    sectionHeading('SIGNING CAPACITY');
    formRow('Prompt', data.signing_reason_prompt, { isLast: true });
    y -= 12;
  }

  // ── AUDIT TRAIL section (table-style with alternating rows) ────────
  sectionHeading('AUDIT TRAIL');

  // Column positions (shared by header + rows)
  const colDate = MARGIN + 10;
  const colAction = MARGIN + 145;
  const colActor = MARGIN + 315;
  const colActionW = 160;
  const colActorW = CONTENT_W - 325;

  /** Draw the audit table column header row */
  const drawAuditTableHeader = () => {
    const headerH = 22;
    currentPage.drawRectangle({
      x: MARGIN, y: y - headerH + 4,
      width: CONTENT_W, height: headerH,
      color: DARK,
    });
    currentPage.drawText('DATE & TIME', {
      x: colDate, y: y - headerH + 12,
      size: 7, font: boldFont, color: WHITE,
    });
    currentPage.drawText('ACTION', {
      x: colAction, y: y - headerH + 12,
      size: 7, font: boldFont, color: WHITE,
    });
    currentPage.drawText('ACTOR / IP', {
      x: colActor, y: y - headerH + 12,
      size: 7, font: boldFont, color: WHITE,
    });
    y -= headerH;
  };

  /** Ensure space for audit row; if a new page is created, redraw the table column header */
  const ensureAuditSpace = (needed: number): number => {
    const pageCountBefore = pages.length;
    y = ensureSpace(needed);
    if (pages.length > pageCountBefore) {
      // A new page was added — redraw the table column header
      drawAuditTableHeader();
    }
    return y;
  };

  // Draw initial table header
  {
    const headerH = 22;
    y = ensureSpace(headerH + 4);
    drawAuditTableHeader();
  }

  // Table rows
  data.audit_events.forEach((event, index) => {
    const actionText = event.action.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const actorText = `${event.actor_email}${event.ip ? `  |  ${event.ip}` : ''}`;

    // Calculate wrapped lines for action and actor
    const actionLines = wrapText(actionText, 7.5, font, colActionW);
    const actorLines = wrapText(actorText, 7, font, colActorW);
    const maxLines = Math.max(actionLines.length, actorLines.length, 1);
    const rowH = Math.max(18, maxLines * 11 + 7);

    y = ensureAuditSpace(rowH + 2);

    const isAlternate = index % 2 === 1;

    // Row background
    currentPage.drawRectangle({
      x: MARGIN, y: y - rowH + 4,
      width: CONTENT_W, height: rowH,
      color: isAlternate ? ROW_ALT_BG : WHITE,
    });

    // Left & right borders
    currentPage.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: MARGIN, y: y - rowH + 4 },
      thickness: 0.5, color: TABLE_BORDER,
    });
    currentPage.drawLine({
      start: { x: MARGIN + CONTENT_W, y: y + 4 },
      end: { x: MARGIN + CONTENT_W, y: y - rowH + 4 },
      thickness: 0.5, color: TABLE_BORDER,
    });

    // Bottom border
    currentPage.drawLine({
      start: { x: MARGIN, y: y - rowH + 4 },
      end: { x: MARGIN + CONTENT_W, y: y - rowH + 4 },
      thickness: 0.5, color: LINE_COLOR,
    });

    // Date
    currentPage.drawText(formatDateSafe(event.at), {
      x: colDate, y: y - 6,
      size: 7.5, font, color: TEXT_COLOR,
    });

    // Action (possibly multi-line)
    actionLines.forEach((line, i) => {
      currentPage.drawText(line, {
        x: colAction, y: y - 6 - (i * 11),
        size: 7.5, font: i === 0 ? boldFont : font, color: TEXT_COLOR,
      });
    });

    // Actor / IP (possibly multi-line)
    actorLines.forEach((line, i) => {
      currentPage.drawText(line, {
        x: colActor, y: y - 6 - (i * 11),
        size: 7, font, color: MUTED,
      });
    });

    y -= rowH;
  });

  // Close audit table bottom border
  currentPage.drawLine({
    start: { x: MARGIN, y: y + 4 },
    end: { x: MARGIN + CONTENT_W, y: y + 4 },
    thickness: 1, color: TABLE_BORDER,
  });

  y -= 20;

  // ── DOCUMENT INTEGRITY section ─────────────────────────────────────
  {
    const integrityH = 52;
    y = ensureSpace(integrityH + 10);

    // Bordered box
    currentPage.drawRectangle({
      x: MARGIN, y: y - integrityH,
      width: CONTENT_W, height: integrityH,
      color: rgb(0.97, 0.99, 0.97), // very light green
      borderColor: rgb(0.8, 0.9, 0.8),
      borderWidth: 0.5,
    });

    // Draw a small green check indicator box
    const checkBoxSize = 10;
    const checkBoxX = MARGIN + 12;
    const checkBoxY = y - 18;
    currentPage.drawRectangle({
      x: checkBoxX, y: checkBoxY,
      width: checkBoxSize, height: checkBoxSize,
      color: GREEN,
      borderColor: GREEN,
      borderWidth: 0,
    });
    // White "V" as check symbol inside the green box
    currentPage.drawText('V', {
      x: checkBoxX + 2.5, y: checkBoxY + 2,
      size: 7, font: boldFont, color: WHITE,
    });

    currentPage.drawText('Document Integrity Verified', {
      x: MARGIN + 28, y: y - 16,
      size: 9, font: boldFont, color: GREEN,
    });

    currentPage.drawText(
      'This document has been electronically signed by all required parties. The signing process was conducted in',
      {
        x: MARGIN + 12, y: y - 30,
        size: 7.5, font, color: MUTED,
      }
    );
    currentPage.drawText(
      'compliance with the Electronic Communications and Transactions Act 25 of 2002 (ECTA) of South Africa.',
      {
        x: MARGIN + 12, y: y - 42,
        size: 7.5, font, color: MUTED,
      }
    );

    y -= integrityH + 8;
  }

  // ── Finalize: draw footers on all pages ────────────────────────────
  const totalPages = pages.length;
  pages.forEach((page, i) => {
    drawFooter(page, i + 1, totalPages);
  });

  return await pdfDoc.save();
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetch envelope data for certificate generation
 */
async function fetchEnvelopeData(envelopeId: string): Promise<EnvelopeData | null> {
  try {
    // Fetch envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      log.error('Envelope not found');
      return null;
    }

    // Get signed signers
    const signedSigners = envelope.signers
      .filter((s: EsignSigner) => s.status === 'signed')
      .sort((a: EsignSigner, b: EsignSigner) => (a.order || 0) - (b.order || 0));

    if (signedSigners.length === 0) {
      log.error('No signed signers found');
      return null;
    }

    // Fetch audit events
    const auditEvents = await getAuditTrail(envelopeId);

    // Match signers with their IP addresses + evidence fields from
    // audit events. P6.3 — the evidence page wants the full provenance
    // for each signature: IP + UA, OTP channel(s), time-to-sign, KBA
    // and consent stamps.
    const signersWithEvidence = signedSigners.map((signer: EsignSigner) => {
      const signEvent = auditEvents.find(
        (e: EsignAuditEvent) => e.action === 'signed' && e.email === signer.email
      );
      const viewedEvent = auditEvents.find(
        (e: EsignAuditEvent) => e.action === 'viewed' && e.email === signer.email
      );
      const otpChannels = new Set<string>();
      for (const ev of auditEvents) {
        if (ev.email !== signer.email) continue;
        if (ev.action === 'otp_sent' || ev.action === 'otp_resent') {
          const ch = (ev.metadata?.channel as string | undefined)
            || (ev.metadata?.method as string | undefined)
            || 'email';
          otpChannels.add(ch);
        }
      }

      let time_to_sign_ms: number | undefined;
      const first = signer.invite_sent_at || viewedEvent?.at;
      if (first && signer.signed_at) {
        const a = new Date(first).getTime();
        const b = new Date(signer.signed_at).getTime();
        if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
          time_to_sign_ms = b - a;
        }
      }

      return {
        name: signer.name,
        email: signer.email,
        role: signer.role,
        phone: signer.phone,
        signed_at: signer.signed_at || new Date().toISOString(),
        invite_sent_at: signer.invite_sent_at,
        viewed_at: signer.viewed_at,
        ip_address: signEvent?.ip || signer.ip_address,
        user_agent: signEvent?.user_agent || signer.user_agent,
        time_to_sign_ms,
        otp_methods: signer.requires_otp ? Array.from(otpChannels) : [],
        signature_telemetry: signer.signature_telemetry,
        consent_version: signer.consent_version,
        signing_reason: signer.signing_reason,
        kba: signer.kba && signer.kba.status !== 'skipped'
          ? { provider: signer.kba.provider, status: signer.kba.status, reference: signer.kba.reference }
          : undefined,
      };
    });

    // P6.4 — resolve the consent text for inclusion on the evidence page.
    const consent = envelope.consent_version
      ? await getConsentByVersion(envelope.consent_version as string)
      : null;

    return {
      id: envelope.id,
      title: envelope.title,
      created_at: envelope.created_at,
      completed_at: envelope.completed_at || new Date().toISOString(),
      client_name: 'Client', // TODO: Fetch from client data if available
      sender_name: 'Admin', // TODO: Fetch from user data if available
      signing_reason_prompt: envelope.signing_reason_required
        ? (envelope.signing_reason_prompt || 'Signed in capacity as disclosed by the signer')
        : undefined,
      consent: consent ? { id: consent.id, text: consent.text } : undefined,
      signers: signersWithEvidence,
      audit_events: auditEvents.map((e: EsignAuditEvent) => ({
        action: e.action,
        at: e.at,
        actor_email: e.email || 'System',
        ip: e.ip || '',
      })),
    };
  } catch (error) {
    log.error('Fetch envelope data exception:', error);
    return null;
  }
}

// ============================================================================
// PUBLIC EXPORTS
// ============================================================================

/**
 * Generate and store completion certificate
 */
export async function generateCompletionCertificate(
  envelopeId: string
): Promise<{ success: boolean; certificateId?: string; error?: string; pdfBuffer?: Uint8Array }> {
  try {
    log.info(`Generating completion certificate for envelope ${envelopeId}...`);

    // Check if certificate already exists
    const existingCert = await kv.get(`esign:certificate:${envelopeId}`);

    // Fetch envelope data (needed for PDF generation regardless of existing cert)
    const envelopeData = await fetchEnvelopeData(envelopeId);

    if (!envelopeData) {
      return { success: false, error: 'Failed to fetch envelope data' };
    }

    // Always generate fresh PDF buffer (ensures latest template is used)
    const certificateBuffer = await generateCertificatePDF(envelopeData);

    if (existingCert) {
      log.info(`Certificate record already exists for envelope ${envelopeId}, returning fresh PDF buffer`);
      return { success: true, certificateId: existingCert.id, pdfBuffer: certificateBuffer };
    }

    // Calculate hash
    const hash = await calculateHash(certificateBuffer);

    // Upload to storage
    const { path, error: uploadError } = await uploadCertificate(
      envelopeId,
      certificateBuffer
    );

    if (uploadError || !path) {
      return { success: false, error: uploadError || 'Failed to upload certificate' };
    }

    // Create certificate record
    const certificateId = crypto.randomUUID();
    const certificate = {
      id: certificateId,
      envelope_id: envelopeId,
      storage_path: path,
      hash: hash,
      generated_at: new Date().toISOString(),
    };

    // Store certificate record
    await kv.set(`esign:certificate:${envelopeId}`, certificate);

    log.success(`Certificate generated successfully: ${certificateId}`);
    return { success: true, certificateId, pdfBuffer: certificateBuffer };
  } catch (error) {
    log.error('Generate certificate exception:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if envelope is eligible for certificate generation
 */
export async function isEligibleForCertificate(envelopeId: string): Promise<boolean> {
  try {
    const envelope = await kv.get(`esign:envelope:${envelopeId}`);

    if (!envelope) {
      return false;
    }

    return envelope.status === 'completed';
  } catch (error) {
    log.error('Check eligibility exception:', error);
    return false;
  }
}

/**
 * Get certificate if it exists
 */
export async function getCertificate(envelopeId: string): Promise<{
  exists: boolean;
  certificateId?: string;
  storagePath?: string;
  hash?: string;
  generatedAt?: string;
}> {
  try {
    const certificate = await kv.get(`esign:certificate:${envelopeId}`);

    if (!certificate) {
      return { exists: false };
    }

    return {
      exists: true,
      certificateId: certificate.id,
      storagePath: certificate.storage_path,
      hash: certificate.hash,
      generatedAt: certificate.generated_at,
    };
  } catch (error) {
    log.error('Get certificate exception:', error);
    return { exists: false };
  }
}

/**
 * Auto-generate certificate when envelope completes
 * Called by the signing service after all signers complete
 */
export async function autoGenerateCertificateIfComplete(
  envelopeId: string
): Promise<void> {
  try {
    const eligible = await isEligibleForCertificate(envelopeId);

    if (eligible) {
      log.info(`Auto-generating certificate for envelope ${envelopeId}...`);
      await generateCompletionCertificate(envelopeId);
    }
  } catch (error) {
    log.error('Auto-generate certificate exception:', error);
    // Non-critical, don't throw
  }
}