/**
 * E-Signature Certificate of Completion — PDF renderer
 * ====================================================
 *
 * Draws the certificate attached to every completed envelope. The layout is
 * the approved standard of 14 Nov 2026 (Design canvas "Navigate Wealth — E-Sign
 * Certificate of Completion"), built on the Navigate Wealth design system:
 *
 *   1. Certificate of completion — envelope details, document integrity and a
 *      summary table of signers.
 *   2. Signer evidence — one card per signer: signature, how they were
 *      identified, consent, a timeline from invitation to signature, and device.
 *   3. Audit trail — every recorded event in plain English, grouped by day,
 *      times to the second in SAST (UTC+02:00).
 *   4. The consent wording signers saw, word for word, the legal basis and how
 *      the records are kept.
 *
 * Every page carries the logo, the certificate ID, the firm's FSP details and
 * "Page N of M". Content flows across as many pages as it needs: tables repeat
 * their header row, and a signer card is never split across pages.
 *
 * Wording rule: the certificate only states what the records show. It never
 * claims more than an ordinary electronic signature (ECTA s13(2)–(3)), and it
 * says the digital seal is "applied" only when the audit trail records it.
 *
 * Pure rendering — no KV, storage or network. `esign-certificates.ts` gathers
 * the data and calls `renderCertificatePdf`.
 */

import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import type { PDFFont, PDFImage, PDFPage, RGB } from 'npm:pdf-lib@1.17.1';
import { CERTIFICATE_LOGO_PNG_BASE64, CERTIFICATE_LOGO_SIZE } from './esign-certificate-logo.ts';
import {
  auditDetail,
  channelLabel,
  describeAction,
  describeDevice,
  fmtDate,
  fmtDateTime,
  fmtDay,
  fmtDuration,
  fmtShort,
  fmtTime,
  joinWords,
  makeSanitiser,
  legalParagraphs,
  maskPhone,
  sast,
  wrapRuns,
} from './esign-certificate-format.ts';
import type { Run } from './esign-certificate-format.ts';

type Fonts = { regular: PDFFont; bold: PDFFont; mono: PDFFont };

// ============================================================================
// DATA THE RENDERER NEEDS
// ============================================================================

export interface CertificateSigner {
  order: number;
  name: string;
  email: string;
  role: string;
  kind?: 'signer' | 'witness' | 'cc';
  phone?: string;
  signed_at: string;
  invite_sent_at?: string;
  viewed_at?: string;
  consent_accepted_at?: string;
  otp_verified_at?: string;
  ip_address?: string;
  user_agent?: string;
  time_to_sign_ms?: number;
  /** Channels a one-time PIN was sent on (email / sms). Empty when not OTP-gated. */
  otp_methods: string[];
  requires_otp: boolean;
  /** True when the invitation also went by SMS. */
  sms_invite?: boolean;
  /** Signature as captured: an image data URL, or typed text. */
  signature_data?: string;
  signature_telemetry?: {
    strokes?: number;
    duration_ms?: number;
    method?: 'draw' | 'type' | 'upload';
    adopted_at?: string;
  };
  consent_version?: string;
  signing_reason?: string;
  kba?: { provider: string; status: string; reference?: string };
}

export interface CertificateAuditEvent {
  action: string;
  at: string;
  actor_type?: string;
  email?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

export interface CertificateData {
  certificate_id: string;
  envelope_id: string;
  title: string;
  created_at: string;
  sent_at?: string;
  completed_at: string;
  expires_at?: string;
  /** When the certificate record was first issued. */
  issued_at: string;
  client_name?: string;
  sender_name: string;
  sender_email?: string;
  signing_mode?: 'sequential' | 'parallel';
  signing_reason_prompt?: string;
  document?: { filename?: string; page_count?: number; hash?: string };
  consent?: { id: string; text: string };
  signers: CertificateSigner[];
  audit_events: CertificateAuditEvent[];
}

// ============================================================================
// FIRM DETAILS (as on navigatewealth.co)
// ============================================================================

const FIRM_LINE =
  'Wealthfront (Pty) Ltd t/a Navigate Wealth · Authorised FSP 54606 · Reg. 2024/071953/07';
const VERIFY_URL = 'navigatewealth.co/verify';
const CONTACT = 'info@navigatewealth.co or 012 667 2505';

// ============================================================================
// DESIGN TOKENS (Navigate Wealth design system, px × 0.75 = pt)
// ============================================================================

const hex = (h: string): RGB =>
  rgb(
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  );

const C = {
  violet: hex('#6d28d9'),
  violet600: hex('#5b21b6'),
  violet100: hex('#ede9fe'),
  ink: hex('#111827'),
  ink2: hex('#1f2937'),
  ink3: hex('#374151'),
  text2: hex('#4b5563'),
  text3: hex('#6b7280'),
  line: hex('#e5e7eb'),
  line2: hex('#f1f2f4'),
  subtle: hex('#fafafb'),
  bg: hex('#f6f7f9'),
  green: hex('#047857'),
  green50: hex('#ecfdf5'),
  white: rgb(1, 1, 1),
};

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MX = 36; // side margin (48px)
const CW = PAGE_W - MX * 2; // content width
const TOP = 30; // top padding (40px)
const BAND_H = 4.5; // violet band (6px)
const HEADER_BOTTOM = 70; // y of the header rule
const FOOTER_TOP = PAGE_H - 24 - 26.5 - 9; // y of the footer rule
const CONTENT_BOTTOM = FOOTER_TOP - 14; // lowest y content may reach
const RADIUS = 9; // card radius (12px)

// ============================================================================
// RENDERER
// ============================================================================

export async function renderCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Certificate of completion — ${data.title}`);
  doc.setAuthor('Navigate Wealth');
  doc.setCreator('Navigate Wealth E-Signature Platform');
  doc.setProducer('Navigate Wealth E-Signature Platform');

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.Courier),
  };
  const clean = makeSanitiser(fonts.regular);

  let logo: PDFImage | null = null;
  try {
    logo = await doc.embedPng(
      Uint8Array.from(atob(CERTIFICATE_LOGO_PNG_BASE64), (c) => c.charCodeAt(0)),
    );
  } catch {
    logo = null; // the wordmark is drawn as text instead
  }

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0; // top-down cursor, in points from the top of the page

  // ── Primitives (top-down coordinates) ──────────────────────────────────

  const text = (
    s: string,
    x: number,
    top: number,
    size: number,
    font: PDFFont = fonts.regular,
    color: RGB = C.ink,
  ) => {
    const str = clean(s);
    if (!str) return;
    page.drawText(str, { x, y: PAGE_H - top - size * 0.8, size, font, color });
  };

  const textRight = (
    s: string,
    right: number,
    top: number,
    size: number,
    font: PDFFont = fonts.regular,
    color: RGB = C.ink,
  ) => {
    const str = clean(s);
    text(str, right - font.widthOfTextAtSize(str, size), top, size, font, color);
  };

  const rect = (x: number, top: number, w: number, h: number, color: RGB) =>
    page.drawRectangle({ x, y: PAGE_H - top - h, width: w, height: h, color });

  const hline = (x1: number, x2: number, top: number, color: RGB = C.line, t = 0.75) =>
    page.drawLine({
      start: { x: x1, y: PAGE_H - top },
      end: { x: x2, y: PAGE_H - top },
      thickness: t,
      color,
    });

  const vline = (x: number, top: number, bottom: number, color: RGB = C.line2, t = 0.75) =>
    page.drawLine({
      start: { x, y: PAGE_H - top },
      end: { x, y: PAGE_H - bottom },
      thickness: t,
      color,
    });

  /** Rounded rectangle; `corners` picks which corners are rounded (tl, tr, br, bl). */
  const rounded = (
    x: number,
    top: number,
    w: number,
    h: number,
    opts: { fill?: RGB; border?: RGB; r?: number; corners?: [boolean, boolean, boolean, boolean] },
  ) => {
    const r = Math.min(opts.r ?? RADIUS, h / 2, w / 2);
    const [tl, tr, br, bl] = opts.corners ?? [true, true, true, true];
    const k = 0.5523 * r;
    const p = [
      `M ${tl ? r : 0} 0`,
      `L ${tr ? w - r : w} 0`,
      tr ? `C ${w - r + k} 0 ${w} ${r - k} ${w} ${r}` : '',
      `L ${w} ${br ? h - r : h}`,
      br ? `C ${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h}` : '',
      `L ${bl ? r : 0} ${h}`,
      bl ? `C ${r - k} ${h} 0 ${h - r + k} 0 ${h - r}` : '',
      `L 0 ${tl ? r : 0}`,
      tl ? `C 0 ${r - k} ${r - k} 0 ${r} 0` : '',
      'Z',
    ]
      .filter(Boolean)
      .join(' ');
    page.drawSvgPath(p, {
      x,
      y: PAGE_H - top,
      color: opts.fill,
      borderColor: opts.border,
      borderWidth: opts.border ? 0.75 : 0,
    });
  };

  const check = (cx: number, cy: number, s: number, color: RGB, t = 1.4) => {
    // A tick centred on (cx, cy) in top-down coordinates, s = half-width.
    const pts = [
      [cx - s, cy],
      [cx - s * 0.3, cy + s * 0.7],
      [cx + s, cy - s * 0.7],
    ];
    for (let i = 0; i < 2; i += 1) {
      page.drawLine({
        start: { x: pts[i][0], y: PAGE_H - pts[i][1] },
        end: { x: pts[i + 1][0], y: PAGE_H - pts[i + 1][1] },
        thickness: t,
        color,
      });
    }
  };

  const drawLines = (lines: Run[][], x: number, top: number, size: number, lh: number) => {
    lines.forEach((ln, i) => {
      let cx = x;
      for (const r of ln) {
        text(r.text, cx, top + i * lh + (lh - size) / 2, size, r.font, r.color ?? C.ink);
        cx += r.font.widthOfTextAtSize(clean(r.text), size);
      }
    });
  };

  const wrap = (s: string, font: PDFFont, size: number, maxW: number, color?: RGB) =>
    wrapRuns([{ text: clean(s), font, color }], size, maxW);

  // ── Page furniture ──────────────────────────────────────────────────────

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    rect(0, 0, PAGE_W, BAND_H, C.violet);
    if (logo) {
      const h = 16.5;
      const w = (CERTIFICATE_LOGO_SIZE.width / CERTIFICATE_LOGO_SIZE.height) * h;
      page.drawImage(logo, { x: MX, y: PAGE_H - TOP - 4 - h, width: w, height: h });
    } else {
      text('Navigate', MX, TOP + 4, 15, fonts.bold, C.ink);
      text(
        'Wealth',
        MX + fonts.bold.widthOfTextAtSize('Navigate ', 15),
        TOP + 4,
        15,
        fonts.bold,
        C.violet,
      );
    }
    textRight(
      pages.length === 1 ? 'Certificate ID' : 'Certificate of completion · Certificate ID',
      PAGE_W - MX,
      TOP,
      9,
      fonts.bold,
      C.text3,
    );
    textRight(data.certificate_id, PAGE_W - MX, TOP + 13, 9, fonts.mono, C.ink3);
    hline(MX, PAGE_W - MX, HEADER_BOTTOM);
    y = HEADER_BOTTOM + 16;
  };

  const drawFooters = () => {
    const total = pages.length;
    pages.forEach((p, i) => {
      page = p;
      hline(MX, PAGE_W - MX, FOOTER_TOP);
      text(FIRM_LINE, MX, FOOTER_TOP + 9, 9, fonts.regular, C.text2);
      text(
        `Envelope ${data.envelope_id} · Verify at ${VERIFY_URL}`,
        MX,
        FOOTER_TOP + 21.75,
        9,
        fonts.regular,
        C.text2,
      );
      textRight(`Page ${i + 1} of ${total}`, PAGE_W - MX, FOOTER_TOP + 21.75, 9, fonts.bold, C.ink);
    });
  };

  const ensure = (h: number) => {
    if (y + h > CONTENT_BOTTOM) newPage();
  };

  const sectionHeading = (title: string, size = 11.25) => {
    text(title, MX, y, size, fonts.bold, C.ink);
    y += size + 9;
  };

  // ── Derived facts ───────────────────────────────────────────────────────

  const signers = data.signers;
  const events = data.audit_events;
  const sealEvent = events.find((e) => e.action === 'digital_signature_applied');
  const nameByEmail = new Map(signers.map((s) => [s.email.toLowerCase(), s]));
  const docPages = data.document?.page_count;

  // ════════════════════════════════════════════════════════════════════════
  // 1 · CERTIFICATE OF COMPLETION
  // ════════════════════════════════════════════════════════════════════════

  newPage();
  y = HEADER_BOTTOM + 19.5;

  // Status pill, top right
  {
    const label = 'Completed';
    const size = 9.75;
    const pw = fonts.bold.widthOfTextAtSize(label, size) + 9 + 10 + 4.5;
    const px = PAGE_W - MX - pw;
    rounded(px, y, pw, 19.5, { fill: C.green50, r: 9.75 });
    check(px + 13, y + 10, 3.4, C.green, 1.6);
    text(label, px + 19.5, y + (19.5 - size) / 2, size, fonts.bold, C.green);
    const n = signers.length;
    textRight(
      `${n} of ${n} ${n === 1 ? 'signer' : 'signers'} signed`,
      PAGE_W - MX,
      y + 24,
      9.4,
      fonts.regular,
      C.text2,
    );
  }

  // Title block
  {
    const maxW = CW - 120;
    text('Certificate of completion', MX, y, 21, fonts.bold, C.ink);
    y += 27 + 4.5;
    const titleLines = wrap(data.title, fonts.regular, 11.25, maxW, C.ink2);
    drawLines(titleLines, MX, y, 11.25, 16.5);
    y += titleLines.length * 16.5 + 3;
    text(
      `All signers signed. Completed on ${fmtDate(data.completed_at)} at ${fmtTime(data.completed_at)} SAST.`,
      MX,
      y,
      9.4,
      fonts.regular,
      C.text2,
    );
    y += 13.5 + 16.5;
  }

  // Envelope card (two-column description list)
  {
    sectionHeading('Envelope');
    type Cell = { label: string; value: string; mono?: boolean; full?: boolean };
    const filename = data.document?.filename;
    const fileValue = [
      filename,
      docPages ? `${docPages} ${docPages === 1 ? 'page' : 'pages'}` : undefined,
    ]
      .filter(Boolean)
      .join(' · ');
    const senderValue = [data.sender_name, data.sender_email].filter(Boolean).join(' · ');
    const cells: Cell[] = [
      { label: 'Envelope ID', value: data.envelope_id, mono: true, full: true },
      { label: 'Document', value: data.title },
      { label: 'File', value: fileValue || 'Not recorded' },
      { label: 'Sent by', value: senderValue },
      { label: 'Client', value: data.client_name || 'Not linked to a client' },
      {
        label: 'Signing order',
        value: `${data.signing_mode === 'parallel' ? 'Parallel' : 'Sequential'} · ${signers.length} ${signers.length === 1 ? 'signer' : 'signers'}`,
      },
      {
        label: 'Consent wording',
        value: data.consent ? `Version ${data.consent.id}` : 'Not recorded for this envelope',
      },
      { label: 'Created', value: fmtDateTime(data.created_at) },
      { label: 'Sent', value: fmtDateTime(data.sent_at) },
      { label: 'Completed', value: fmtDateTime(data.completed_at) },
      { label: 'Signing deadline', value: fmtDateTime(data.expires_at) },
    ];
    if (data.signing_reason_prompt) {
      cells.push({
        label: 'Signing capacity requested',
        value: data.signing_reason_prompt,
        full: true,
      });
    }

    const PADX = 13.5;
    const PADY = 6.75;
    const colW = CW / 2;
    type Row = { cells: Cell[]; h: number; lines: Run[][][] };
    const rows: Row[] = [];
    let pending: Cell[] = [];
    const flush = () => {
      if (!pending.length) return;
      const w = pending.length === 1 && pending[0].full ? CW : colW;
      const lines = pending.map((c) =>
        wrap(c.value, c.mono ? fonts.mono : fonts.regular, c.mono ? 9.4 : 10, w - PADX * 2, C.ink),
      );
      const h = PADY * 2 + 12 + Math.max(...lines.map((l) => l.length)) * 14.25;
      rows.push({ cells: pending, h, lines });
      pending = [];
    };
    for (const c of cells) {
      if (c.full) {
        flush();
        pending = [c];
        flush();
      } else {
        pending.push(c);
        if (pending.length === 2) flush();
      }
    }
    flush();

    const total = rows.reduce((a, r) => a + r.h, 0);
    ensure(total);
    rounded(MX, y, CW, total, { border: C.line });
    let ry = y;
    rows.forEach((r, i) => {
      if (i > 0) hline(MX + 0.5, MX + CW - 0.5, ry, C.line2);
      r.cells.forEach((c, j) => {
        const cx = MX + j * colW;
        if (j === 1) vline(cx, ry, ry + r.h);
        text(c.label, cx + PADX, ry + PADY, 9, fonts.bold, C.text3);
        drawLines(r.lines[j], cx + PADX, ry + PADY + 12, c.mono ? 9.4 : 10, 14.25);
      });
      ry += r.h;
    });
    y += total + 15;
  }

  // Document integrity card
  {
    // Heading with a shield-and-tick mark
    const sx = MX;
    const sy = y;
    page.drawSvgPath(
      'M 6.75 0 L 13 2.4 L 13 7.6 C 13 12 6.75 15 6.75 15 C 6.75 15 0.5 12 0.5 7.6 L 0.5 2.4 Z',
      {
        x: sx,
        y: PAGE_H - sy + 1,
        borderColor: C.green,
        borderWidth: 1.4,
      },
    );
    check(sx + 6.9, sy + 6.9, 2.6, C.green, 1.3);
    text('Document integrity', MX + 19.5, y, 11.25, fonts.bold, C.ink);
    y += 11.25 + 9;

    const PADX = 13.5;
    const PADY = 6.75;
    const innerW = CW - PADX * 2;
    const sealText = sealEvent
      ? `A PKCS#7 digital seal was applied to the signed document and this certificate on ${fmtDateTime(sealEvent.at)}. Any change made after sealing breaks the seal.`
      : 'On completion, the signed document and this certificate are sealed together with a PKCS#7 digital signature. Any change made after sealing breaks the seal.';
    const rowsSpec: { label: string; runs: Run[]; size: number; mono?: boolean }[] = [
      {
        label: 'Fingerprint of the document as sent for signing (SHA-256)',
        runs: [
          data.document?.hash
            ? { text: data.document.hash, font: fonts.mono, color: C.ink }
            : { text: 'Not recorded for this envelope', font: fonts.regular, color: C.ink },
        ],
        size: data.document?.hash ? 9.4 : 10,
      },
      { label: 'Digital seal', runs: [{ text: sealText, font: fonts.regular }], size: 10 },
      {
        label: 'How to verify',
        runs: [
          { text: 'Upload the signed PDF at ', font: fonts.regular },
          { text: VERIFY_URL, font: fonts.regular, color: C.violet },
          {
            text: ', or open the Signature panel in Adobe Acrobat Reader.',
            font: fonts.regular,
          },
        ],
        size: 10,
      },
    ];
    const built = rowsSpec.map((r) => {
      const lines = wrapRuns(
        r.runs.map((x) => ({ ...x, text: clean(x.text) })),
        r.size,
        innerW,
      );
      return { ...r, lines, h: PADY * 2 + 12 + lines.length * 14.25 };
    });
    const total = built.reduce((a, r) => a + r.h, 0);
    ensure(total);
    rounded(MX, y, CW, total, { border: C.line });
    let ry = y;
    built.forEach((r, i) => {
      if (i > 0) hline(MX + 0.5, MX + CW - 0.5, ry, C.line2);
      text(r.label, MX + PADX, ry + PADY, 9, fonts.bold, C.text3);
      drawLines(r.lines, MX + PADX, ry + PADY + 12, r.size, 14.25);
      ry += r.h;
    });
    y += total + 15;
  }

  // Signers summary table
  {
    const cols = [
      { label: 'Signer', w: 0.31 },
      { label: 'Role', w: 0.16 },
      { label: 'Signed (SAST)', w: 0.17 },
      { label: 'IP address', w: 0.2 },
      { label: 'Verified by', w: 0.16 },
    ].map((c) => ({ ...c, w: c.w * CW }));
    const PADX = 9;
    const HEAD_H = 25.5;

    let cardTop = y;
    const head = (title: string) => {
      sectionHeading(title);
      cardTop = y;
      rounded(MX, y, CW, HEAD_H, { fill: C.subtle, corners: [true, true, false, false] });
      let cx = MX;
      for (const c of cols) {
        text(c.label, cx + PADX, y + (HEAD_H - 9) / 2, 9, fonts.bold, C.text3);
        cx += c.w;
      }
      hline(MX, MX + CW, y + HEAD_H);
      y += HEAD_H;
    };
    const close = () => rounded(MX, cardTop, CW, y - cardTop, { border: C.line });

    const rowsData = signers.map((s, i) => {
      const verified = ['Signing link'];
      for (const m of s.otp_methods) {
        const ch = channelLabel(m);
        verified.push(`${ch === 'email' ? 'Email' : ch} PIN`);
      }
      if (s.kba && s.kba.status === 'passed') verified.push('Identity check');
      const inner = (j: number) => cols[j].w - PADX * 2;
      const cells: Run[][][] = [
        [
          ...wrapRuns([{ text: clean(`${i + 1}. ${s.name}`), font: fonts.bold }], 9.75, inner(0)),
          ...wrap(s.email, fonts.regular, 9, inner(0), C.text2),
        ],
        wrap(s.role || 'Signer', fonts.regular, 9.75, inner(1)),
        [
          ...wrap(fmtDate(s.signed_at), fonts.regular, 9.75, inner(2)),
          ...wrap(fmtTime(s.signed_at), fonts.regular, 9.75, inner(2)),
        ],
        wrap(
          s.ip_address || 'Not recorded',
          s.ip_address ? fonts.mono : fonts.regular,
          9.4,
          inner(3),
        ),
        verified.flatMap((v) => wrap(v, fonts.regular, 9.75, inner(4))),
      ];
      const h = 15 + Math.max(...cells.map((c) => c.length)) * 13.5;
      return { cells, h };
    });

    ensure(11.25 + 9 + HEAD_H + (rowsData[0]?.h ?? 0));
    head('Signers');
    rowsData.forEach((r, i) => {
      if (y + r.h > CONTENT_BOTTOM) {
        close();
        newPage();
        head('Signers (continued)');
      } else if (i > 0) {
        hline(MX + 0.5, MX + CW - 0.5, y, C.line2);
      }
      let cx = MX;
      r.cells.forEach((lines, j) => {
        lines.forEach((ln, k) => {
          let lx = cx + PADX;
          for (const run of ln) {
            const size = run.font === fonts.mono ? 9.4 : run.color === C.text2 ? 9 : 9.75;
            text(
              run.text,
              lx,
              y + 7.5 + k * 13.5 + (13.5 - size) / 2,
              size,
              run.font,
              run.color ?? C.ink,
            );
            lx += run.font.widthOfTextAtSize(clean(run.text), size);
          }
        });
        cx += cols[j].w;
      });
      y += r.h;
    });
    close();
    y += 15;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2 · SIGNER EVIDENCE
  // ════════════════════════════════════════════════════════════════════════

  newPage();
  text('Signer evidence', MX, y, 16.5, fonts.bold, C.ink);
  y += 22.5;
  text(
    'Identity, authentication, consent and device details recorded for each signer, in signing order.',
    MX,
    y,
    9.4,
    fonts.regular,
    C.text2,
  );
  y += 13.5 + 12;

  for (let si = 0; si < signers.length; si += 1) {
    const s = signers[si];
    const PADX = 13.5;
    const HEAD = 40.5;
    const LEFT_W = 177;
    const GAP = 16.5;
    const rightX = MX + PADX + LEFT_W + GAP;
    const rightW = CW - PADX * 2 - LEFT_W - GAP;
    const LABEL_W = 88.5;
    const LH = 13.5;

    // Identity and authentication rows
    const linkVia = s.sms_invite ? 'email and SMS' : 'email';
    const pinRow = s.requires_otp
      ? `Sent by ${joinWords((s.otp_methods.length ? s.otp_methods : ['email']).map(channelLabel))}${s.otp_verified_at ? ` · verified ${fmtTime(s.otp_verified_at)} SAST` : ''}`
      : 'Not required for this signer';
    const kbaRow = s.kba
      ? `${s.kba.provider} · ${s.kba.status}${s.kba.reference ? ` · ref ${s.kba.reference}` : ''}`
      : 'Not required for this envelope';
    const consentRow = s.consent_version
      ? `Version ${s.consent_version}${s.consent_accepted_at ? ` · accepted ${fmtTime(s.consent_accepted_at)} SAST` : ''}`
      : 'Not recorded';
    const idRows: [string, string][] = [
      ['Email', s.email],
      ...(s.phone ? ([['Mobile', maskPhone(s.phone)]] as [string, string][]) : []),
      ['Signing link', `Unique single-use link, sent by ${linkVia}`],
      ['One-time PIN', pinRow],
      ['Identity check', kbaRow],
      ['Consent', consentRow],
      ...(s.signing_reason ? ([['Signing capacity', s.signing_reason]] as [string, string][]) : []),
    ];
    const idBuilt = idRows.map(([l, v]) => ({
      l,
      lines: wrap(v, fonts.regular, 9.4, rightW - LABEL_W),
    }));
    const idH = idBuilt.reduce((a, r) => a + r.lines.length * LH + 1.5, 0);

    // Signature block
    const tel = s.signature_telemetry;
    const telParts: string[] = [];
    if (tel?.method)
      telParts.push(tel.method === 'draw' ? 'Drawn' : tel.method === 'type' ? 'Typed' : 'Uploaded');
    if (typeof tel?.strokes === 'number')
      telParts.push(`${tel.strokes} ${tel.strokes === 1 ? 'stroke' : 'strokes'}`);
    if (typeof tel?.duration_ms === 'number')
      telParts.push(`${Math.round(tel.duration_ms / 100) / 10} s`);
    const sigMeta: string[] = [];
    if (telParts.length) sigMeta.push(telParts.join(' · '));
    if (tel?.adopted_at) sigMeta.push(`Adopted ${fmtTime(tel.adopted_at)} SAST`);
    const SIG_BOX = 69;
    const leftH = 12 + 4.5 + SIG_BOX + (sigMeta.length ? 4.5 + sigMeta.length * 12 : 0);
    const bodyH = 10.5 * 2 + Math.max(leftH, idH);

    // Timeline
    const steps = [
      ['Invited', s.invite_sent_at],
      ['Opened', s.viewed_at],
      ['Consented', s.consent_accepted_at],
      ['PIN verified', s.otp_verified_at],
      ['Signed', s.signed_at],
    ].filter(([, at]) => sast(at)) as [string, string][];
    const TL_H = 9 * 2 + 12 + 12;

    // Device
    const ua = s.user_agent;
    const uaLines = ua ? wrap(ua, fonts.mono, 8.6, CW - PADX * 2) : [];
    const devH = 7.5 * 2 + 12 + 13.5 + (ua ? 6 + 12 + uaLines.length * 12 : 0);

    const cardH = HEAD + bodyH + TL_H + devH;
    ensure(cardH);
    const top = y;

    // Header
    page.drawCircle({
      x: MX + PADX + 11.25,
      y: PAGE_H - (top + HEAD / 2),
      size: 11.25,
      color: C.violet100,
    });
    const num = String(si + 1);
    text(
      num,
      MX + PADX + 11.25 - fonts.bold.widthOfTextAtSize(num, 9.75) / 2,
      top + HEAD / 2 - 4.9,
      9.75,
      fonts.bold,
      C.violet600,
    );
    text(s.name, MX + PADX + 31.5, top + 8.25, 11.25, fonts.bold, C.ink);
    const kindLabel = s.kind === 'witness' ? 'Witness' : 'Signer';
    const roleLine =
      !s.role || s.role.toLowerCase() === kindLabel.toLowerCase()
        ? kindLabel
        : `${s.role} · ${kindLabel}`;
    text(roleLine, MX + PADX + 31.5, top + 23.25, 9, fonts.regular, C.text2);
    {
      const label = `Signed ${fmtDate(s.signed_at)}, ${fmtTime(s.signed_at)}`;
      const size = 9.4;
      const pw = fonts.bold.widthOfTextAtSize(clean(label), size) + 8.25 + 9 + 4.5;
      const px = MX + CW - PADX - pw;
      const py = top + (HEAD - 18) / 2;
      rounded(px, py, pw, 18, { fill: C.green50, r: 9 });
      check(px + 11.5, py + 9, 3, C.green, 1.5);
      text(label, px + 17.25, py + (18 - size) / 2, size, fonts.bold, C.green);
    }
    hline(MX + 0.5, MX + CW - 0.5, top + HEAD);

    // Body: signature
    let by = top + HEAD + 10.5;
    text('Signature', MX + PADX, by, 9, fonts.bold, C.text3);
    const boxTop = by + 16.5;
    rounded(MX + PADX, boxTop, LEFT_W, SIG_BOX, { fill: C.subtle, border: C.line, r: 6 });
    let drewSignature = false;
    const sig = s.signature_data;
    if (sig && sig.startsWith('data:image/')) {
      try {
        const bytes = Uint8Array.from(atob(sig.split(',')[1] ?? ''), (c) => c.charCodeAt(0));
        let img: PDFImage;
        if (/^data:image\/jpe?g/.test(sig)) img = await doc.embedJpg(bytes);
        else {
          try {
            img = await doc.embedPng(bytes);
          } catch {
            img = await doc.embedJpg(bytes);
          }
        }
        const maxW = LEFT_W - 18;
        const maxH = SIG_BOX - 12;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const iw = img.width * scale;
        const ih = img.height * scale;
        page.drawImage(img, {
          x: MX + PADX + (LEFT_W - iw) / 2,
          y: PAGE_H - (boxTop + (SIG_BOX + ih) / 2),
          width: iw,
          height: ih,
        });
        drewSignature = true;
      } catch {
        drewSignature = false;
      }
    } else if (sig && !sig.startsWith('data:')) {
      const size = 15;
      const typed = wrap(sig, fonts.regular, size, LEFT_W - 18)[0] ?? [];
      const tw = typed.reduce((a, r) => a + r.font.widthOfTextAtSize(r.text, size), 0);
      drawLines([typed], MX + PADX + (LEFT_W - tw) / 2, boxTop + (SIG_BOX - 18) / 2, size, 18);
      drewSignature = true;
    }
    if (!drewSignature) {
      const msg = 'Shown in place on the signed document';
      const w = fonts.regular.widthOfTextAtSize(msg, 9);
      text(
        msg,
        MX + PADX + (LEFT_W - w) / 2,
        boxTop + (SIG_BOX - 9) / 2,
        9,
        fonts.regular,
        C.text2,
      );
    }
    sigMeta.forEach((m, i) =>
      text(m, MX + PADX, boxTop + SIG_BOX + 4.5 + i * 12 + 1.5, 9, fonts.regular, C.text2),
    );

    // Body: identity rows
    by = top + HEAD + 10.5;
    for (const r of idBuilt) {
      text(r.l, rightX, by + (LH - 9.4) / 2, 9.4, fonts.bold, C.text3);
      drawLines(r.lines, rightX + LABEL_W, by, 9.4, LH);
      by += r.lines.length * LH + 1.5;
    }

    // Timeline strip
    const tlTop = top + HEAD + bodyH;
    rect(MX + 0.5, tlTop, CW - 1, TL_H, C.subtle);
    hline(MX + 0.5, MX + CW - 0.5, tlTop, C.line2);
    const stepW = (CW - PADX * 2) / Math.max(steps.length, 1);
    steps.forEach(([label, at], i) => {
      const sx = MX + PADX + i * stepW;
      page.drawCircle({ x: sx + 5.25, y: PAGE_H - (tlTop + 9 + 5.6), size: 5.25, color: C.green });
      check(sx + 5.25, tlTop + 9 + 5.6, 2.2, C.white, 1.1);
      text(label, sx + 15, tlTop + 9 + 1.25, 9, fonts.bold, C.ink);
      text(fmtShort(at), sx + 15, tlTop + 9 + 13.5, 9, fonts.regular, C.text2);
    });

    // Device strip
    const dTop = tlTop + TL_H;
    hline(MX + 0.5, MX + CW - 0.5, dTop, C.line2);
    const dcol = (CW - PADX * 2) / 3;
    const dev: [string, string, boolean][] = [
      ['IP address', s.ip_address || 'Not recorded', Boolean(s.ip_address)],
      ['Device', describeDevice(ua), false],
      [
        'Time to sign',
        typeof s.time_to_sign_ms === 'number'
          ? `${fmtDuration(s.time_to_sign_ms)} from invitation`
          : 'Not recorded',
        false,
      ],
    ];
    dev.forEach(([l, v, mono], i) => {
      const dx = MX + PADX + i * dcol;
      text(l, dx, dTop + 7.5, 9, fonts.bold, C.text3);
      const line = wrap(v, mono ? fonts.mono : fonts.regular, mono ? 9 : 9.4, dcol - 9)[0] ?? [];
      drawLines([line], dx, dTop + 7.5 + 12, mono ? 9 : 9.4, 13.5);
    });
    if (ua) {
      const uy = dTop + 7.5 + 12 + 13.5 + 6;
      text('User agent', MX + PADX, uy, 9, fonts.bold, C.text3);
      uaLines.forEach((ln, i) =>
        text(
          ln.map((r) => r.text).join(''),
          MX + PADX,
          uy + 12 + i * 12 + 1.5,
          8.6,
          fonts.mono,
          C.ink3,
        ),
      );
    }

    rounded(MX, top, CW, cardH, { border: C.line });
    y = top + cardH + 12;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3 · AUDIT TRAIL
  // ════════════════════════════════════════════════════════════════════════

  newPage();
  text('Audit trail', MX, y, 16.5, fonts.bold, C.ink);
  y += 22.5;
  {
    const intro = wrap(
      `${events.length} ${events.length === 1 ? 'event' : 'events'} in the order they happened. Times are South African Standard Time (SAST, UTC+02:00), taken from the platform's server clock.`,
      fonts.regular,
      9.4,
      CW,
      C.text2,
    );
    drawLines(intro, MX, y, 9.4, 13.5);
    y += intro.length * 13.5 + 12;
  }

  const sorted = [...events].sort(
    (a, b) => (new Date(a.at).getTime() || 0) - (new Date(b.at).getTime() || 0),
  );

  const actorFor = (e: CertificateAuditEvent): { who: string; role: string } => {
    if (e.actor_type === 'system') return { who: 'Navigate Wealth platform', role: 'System' };
    // The sender can also be a signer; what they did as the sender is
    // attributed to them as the sender.
    if (e.actor_type === 'sender_user') return { who: data.sender_name, role: 'Sender' };
    const em = e.email?.toLowerCase();
    const signer = em ? nameByEmail.get(em) : undefined;
    if (signer) {
      const kind = signer.kind === 'witness' ? 'Witness' : 'Signer';
      return {
        who: signer.name,
        role: `${kind} ${signer.order}${signer.role ? ` · ${signer.role}` : ''}`,
      };
    }
    if (em && em === data.sender_email?.toLowerCase())
      return { who: data.sender_name, role: 'Sender' };
    if (e.email) return { who: e.email, role: e.actor_type === 'signer' ? 'Signer' : 'User' };
    return { who: 'Navigate Wealth platform', role: 'System' };
  };

  const detailFor = (e: CertificateAuditEvent): string => {
    const em = e.email?.toLowerCase();
    return auditDetail(e, em ? nameByEmail.get(em)?.name : undefined);
  };

  {
    const cols = [
      { label: 'Time', w: 63 },
      { label: 'Event', w: CW - 63 - 129 - 93 },
      { label: 'By', w: 129 },
      { label: 'IP address', w: 93 },
    ];
    const PADX = 9;
    const HEAD_H = 25.5;
    const DAY_H = 22.5;

    let cardTop = y;
    const head = () => {
      cardTop = y;
      rounded(MX, y, CW, HEAD_H, { fill: C.subtle, corners: [true, true, false, false] });
      let cx = MX;
      for (const c of cols) {
        text(c.label, cx + PADX, y + (HEAD_H - 9) / 2, 9, fonts.bold, C.text3);
        cx += c.w;
      }
      hline(MX, MX + CW, y + HEAD_H);
      y += HEAD_H;
    };
    const close = () => rounded(MX, cardTop, CW, y - cardTop, { border: C.line });

    const dayRow = (iso: string) => {
      rect(MX + 0.5, y, CW - 1, DAY_H, C.bg);
      text(fmtDay(iso), MX + PADX, y + (DAY_H - 9) / 2, 9, fonts.bold, C.ink3);
      y += DAY_H;
    };

    if (sorted.length === 0) {
      head();
      text('No events recorded.', MX + PADX, y + 9, 9.75, fonts.regular, C.text2);
      y += 30;
      close();
    } else {
      ensure(HEAD_H + DAY_H + 40);
      head();
      let lastDay = '';
      let first = true;
      for (const e of sorted) {
        const { who, role } = actorFor(e);
        const evLines = [
          ...wrapRuns(
            [{ text: clean(describeAction(e.action)), font: fonts.bold }],
            9.75,
            cols[1].w - PADX * 2,
          ),
          ...wrap(detailFor(e), fonts.regular, 9, cols[1].w - PADX * 2, C.text2).filter((l) =>
            l.some((r) => r.text),
          ),
        ];
        const byLines = [
          ...wrap(who, fonts.regular, 9.75, cols[2].w - PADX * 2),
          ...wrap(role, fonts.regular, 9, cols[2].w - PADX * 2, C.text2),
        ];
        const ipLines = e.ip
          ? wrap(e.ip, fonts.mono, 9.4, cols[3].w - PADX * 2)
          : wrap('—', fonts.regular, 9.75, 50, C.text2);
        const rowH = 10.5 + Math.max(evLines.length, byLines.length, ipLines.length) * 12.75;
        const day = fmtDay(e.at);
        const needDay = day !== lastDay;

        if (y + rowH + (needDay ? DAY_H : 0) > CONTENT_BOTTOM - 15) {
          close();
          textRight('Continued on the next page', PAGE_W - MX, y + 6, 9, fonts.regular, C.text2);
          newPage();
          text('Audit trail (continued)', MX, y, 13.5, fonts.bold, C.ink);
          y += 13.5 + 10.5;
          head();
          dayRow(e.at);
          lastDay = day;
          first = true;
        } else if (needDay) {
          if (!first) hline(MX + 0.5, MX + CW - 0.5, y, C.line2);
          dayRow(e.at);
          lastDay = day;
          first = true;
        }
        if (!first) hline(MX + 0.5, MX + CW - 0.5, y, C.line2);
        first = false;

        text(fmtTime(e.at) || '—', MX + PADX, y + 5.25 + (12.75 - 9.4) / 2, 9.4, fonts.mono, C.ink);
        const drawCell = (lines: Run[][], x: number) =>
          lines.forEach((ln, k) => {
            let lx = x;
            for (const run of ln) {
              const size = run.font === fonts.mono ? 9.4 : run.color === C.text2 ? 9 : 9.75;
              text(
                run.text,
                lx,
                y + 5.25 + k * 12.75 + (12.75 - size) / 2,
                size,
                run.font,
                run.color ?? C.ink,
              );
              lx += run.font.widthOfTextAtSize(clean(run.text), size);
            }
          });
        drawCell(evLines, MX + cols[0].w + PADX);
        drawCell(byLines, MX + cols[0].w + cols[1].w + PADX);
        drawCell(ipLines, MX + cols[0].w + cols[1].w + cols[2].w + PADX);
        y += rowH;
      }
      close();
      textRight(
        `End of audit trail · ${sorted.length} ${sorted.length === 1 ? 'event' : 'events'}`,
        PAGE_W - MX,
        y + 6,
        9,
        fonts.regular,
        C.text2,
      );
      y += 6 + 12 + 13.5;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4 · CONSENT, LEGAL BASIS, ISSUE
  // ════════════════════════════════════════════════════════════════════════

  if (data.consent) {
    const PAD = 12;
    const lines = wrap(data.consent.text, fonts.regular, 9.75, CW - PAD * 2, C.ink2);
    const boxH = PAD * 2 - 3 + lines.length * 15;
    ensure(11.25 + 4.5 + 12 + 6 + boxH);
    text('Consent to sign electronically', MX, y, 11.25, fonts.bold, C.ink);
    y += 11.25 + 4.5;
    text(
      `Version ${data.consent.id} · shown to each signer, word for word, before they could sign`,
      MX,
      y,
      9,
      fonts.regular,
      C.text2,
    );
    y += 12 + 6;
    rounded(MX, y, CW, boxH, { fill: C.subtle, border: C.line });
    drawLines(lines, MX + PAD, y + PAD - 1.5, 9.75, 15);
    y += boxH + 16.5;
  }

  {
    const paras = legalParagraphs({
      allOtp: signers.length > 0 && signers.every((s) => s.requires_otp),
      someOtp: signers.some((s) => s.requires_otp),
      hasConsent: Boolean(data.consent),
      contact: CONTACT,
    });
    const built = paras.map(([b, t]) =>
      wrapRuns(
        [
          { text: clean(b), font: fonts.bold, color: C.ink },
          { text: ` ${clean(t)}`, font: fonts.regular, color: C.ink2 },
        ],
        9.4,
        CW,
      ),
    );
    ensure(11.25 + 6 + built[0].length * 13.5);
    text('Legal basis and record keeping', MX, y, 11.25, fonts.bold, C.ink);
    y += 11.25 + 7.5;
    for (const lines of built) {
      ensure(lines.length * 13.5);
      drawLines(lines, MX, y, 9.4, 13.5);
      y += lines.length * 13.5 + 6;
    }

    const issued = wrap(
      `Issued automatically by the Navigate Wealth e-signature platform on ${fmtDate(data.issued_at)} at ${fmtTime(data.issued_at)} SAST from its own records. This certificate has not been edited by any person.`,
      fonts.regular,
      9,
      CW - 21,
      C.ink3,
    );
    const ih = 15 + issued.length * 12.75;
    ensure(ih + 6);
    y += 4.5;
    rounded(MX, y, CW, ih, { fill: C.bg, r: 6 });
    drawLines(issued, MX + 10.5, y + 7.5, 9, 12.75);
    y += ih;
  }

  drawFooters();
  return await doc.save();
}
