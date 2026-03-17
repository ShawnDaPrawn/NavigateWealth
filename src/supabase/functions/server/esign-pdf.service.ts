/**
 * E-Signature PDF Service
 * Handles PDF manipulation, field flattening ("burn-in"), and certificate generation.
 */

import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import type { PDFFont, PDFPage, RGB } from 'npm:pdf-lib@1.17.1';
import type { EsignField, EsignSigner } from './esign-types.ts';
import { calculateHash } from './esign-storage.ts';
import { createModuleLogger } from "./stderr-logger.ts";
import { getErrMsg } from "./shared-logger-utils.ts";

const log = createModuleLogger('esign-pdf-service');

export interface PDFBurnInResult {
  pdfBuffer: Uint8Array;
  hash: string;
  pageCount: number;
}

export class PDFService {

  // ==========================================================================
  // Signature Metadata Helpers (rendered below signature/initials on burn-in)
  // ==========================================================================

  /** Metadata font size in PDF points */
  private static readonly META_FONT_SIZE = 5.5;
  /** Vertical gap between signature bottom edge and metadata block */
  private static readonly META_GAP = 1.5;
  /** Line height for metadata text lines */
  private static readonly META_LINE_HEIGHT = 7;
  /** Minimum space from page bottom before we skip metadata (points) */
  private static readonly META_MARGIN_BOTTOM = 12;
  /** Dark grey for bold signer name */
  private static readonly META_COLOR_BOLD: RGB = rgb(0.25, 0.25, 0.25);
  /** Medium grey for regular metadata text */
  private static readonly META_COLOR: RGB = rgb(0.5, 0.5, 0.5);
  /** Lighter grey for separator line */
  private static readonly META_LINE_COLOR: RGB = rgb(0.78, 0.78, 0.78);
  /** Dot separator between metadata segments */
  private static readonly META_SEP = '  ·  ';

  /**
   * Resolve the signer associated with a field.
   * Matches by signer.id first, then by email as fallback
   * (frontend may assign signer_id as the signer's email during preparation).
   */
  private static findSignerForField(
    field: EsignField,
    signers: EsignSigner[]
  ): EsignSigner | undefined {
    return (
      signers.find(s => s.id === field.signer_id) ||
      signers.find(s => s.email === field.signer_id)
    );
  }

  /**
   * Mask an IP address for privacy: show first two octets, mask the rest.
   * e.g. "102.134.56.78" → "102.134.x.x"
   */
  private static maskIp(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.x.x`;
    }
    // IPv6 or unexpected format — show first segment only
    return ip.split(':').slice(0, 2).join(':') + ':…';
  }

  /**
   * Format an ISO date string for metadata display.
   * Output: "25 Feb 2026, 14:32" (en-ZA locale)
   */
  private static formatMetaDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-ZA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }) + ', ' + d.toLocaleTimeString('en-ZA', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return iso;
    }
  }

  /**
   * Draw provenance metadata below a signature or initials field.
   *
   * Compact single-line layout (space permitting):
   *   ─────────────────────────── (thin separator)
   *   **Name**  ·  25 Feb 2026, 14:32  ·  IP: 102.134.x.x
   *
   * Falls back to two tight lines if the field is too narrow.
   * Skips rendering if there isn't enough space before the page bottom.
   */
  private static drawSignatureMetadata(
    page: PDFPage,
    field: EsignField,
    signer: EsignSigner,
    regularFont: PDFFont,
    boldFont: PDFFont,
    fieldX: number,
    fieldY: number,
    fieldW: number,
  ): void {
    const {
      META_FONT_SIZE,
      META_GAP,
      META_LINE_HEIGHT,
      META_MARGIN_BOTTOM,
      META_COLOR,
      META_COLOR_BOLD,
      META_LINE_COLOR,
      META_SEP,
    } = PDFService;

    const metaTopY = fieldY - META_GAP;

    // Prepare text segments
    const nameText = signer.name;
    const datePart = signer.signed_at
      ? PDFService.formatMetaDate(signer.signed_at)
      : 'Pending';
    const ipPart = signer.ip_address
      ? `IP: ${PDFService.maskIp(signer.ip_address)}`
      : '';

    // Measure widths to decide single-line vs two-line
    const nameW = boldFont.widthOfTextAtSize(nameText, META_FONT_SIZE);
    const sepW = regularFont.widthOfTextAtSize(META_SEP, META_FONT_SIZE);
    const dateW = regularFont.widthOfTextAtSize(datePart, META_FONT_SIZE);
    const ipW = ipPart ? regularFont.widthOfTextAtSize(ipPart, META_FONT_SIZE) : 0;

    const singleLineW = nameW + sepW + dateW + (ipPart ? sepW + ipW : 0);
    const useSingleLine = singleLineW <= fieldW;

    // Total height needed
    const lineCount = useSingleLine ? 1 : 2;
    const totalMetaHeight = META_GAP + 1 + META_LINE_HEIGHT * lineCount;

    // Bounds check: don't render if it would go below the page margin
    if (metaTopY - totalMetaHeight < META_MARGIN_BOTTOM) {
      return;
    }

    // 1. Thin separator line
    const lineY = metaTopY;
    page.drawLine({
      start: { x: fieldX, y: lineY },
      end: { x: fieldX + fieldW, y: lineY },
      thickness: 0.4,
      color: META_LINE_COLOR,
    });

    if (useSingleLine) {
      // ── Single compact line: **Name**  ·  date  ·  IP: x.x.x.x
      const textY = lineY - META_LINE_HEIGHT;
      let cursorX = fieldX;

      // Bold name
      page.drawText(nameText, {
        x: cursorX, y: textY,
        size: META_FONT_SIZE, font: boldFont, color: META_COLOR_BOLD,
      });
      cursorX += nameW;

      // Separator + date
      page.drawText(META_SEP, {
        x: cursorX, y: textY,
        size: META_FONT_SIZE, font: regularFont, color: META_COLOR,
      });
      cursorX += sepW;
      page.drawText(datePart, {
        x: cursorX, y: textY,
        size: META_FONT_SIZE, font: regularFont, color: META_COLOR,
      });
      cursorX += dateW;

      // Separator + IP (if available)
      if (ipPart) {
        page.drawText(META_SEP, {
          x: cursorX, y: textY,
          size: META_FONT_SIZE, font: regularFont, color: META_COLOR,
        });
        cursorX += sepW;
        page.drawText(ipPart, {
          x: cursorX, y: textY,
          size: META_FONT_SIZE, font: regularFont, color: META_COLOR,
        });
      }
    } else {
      // ── Two-line compact layout:
      //   Line 1: **Name**  ·  date
      //   Line 2: IP: x.x.x.x  (only if present)
      const line1Y = lineY - META_LINE_HEIGHT;
      let cursorX = fieldX;

      // Bold name
      page.drawText(nameText, {
        x: cursorX, y: line1Y,
        size: META_FONT_SIZE, font: boldFont, color: META_COLOR_BOLD,
      });
      cursorX += nameW;

      // If date fits on line 1 after name, append it
      const dateWithSepW = sepW + dateW;
      if (cursorX + dateWithSepW <= fieldX + fieldW) {
        page.drawText(META_SEP, {
          x: cursorX, y: line1Y,
          size: META_FONT_SIZE, font: regularFont, color: META_COLOR,
        });
        cursorX += sepW;
        page.drawText(datePart, {
          x: cursorX, y: line1Y,
          size: META_FONT_SIZE, font: regularFont, color: META_COLOR,
        });
      } else {
        // Date on line 2 instead
        const line2Y = line1Y - META_LINE_HEIGHT;
        const dateIpText = ipPart ? `${datePart}${META_SEP}${ipPart}` : datePart;
        page.drawText(dateIpText, {
          x: fieldX, y: line2Y,
          size: META_FONT_SIZE, font: regularFont, color: META_COLOR,
          maxWidth: fieldW,
        });
        return; // Already drew line 2, done
      }

      // Line 2: IP only
      if (ipPart) {
        const line2Y = line1Y - META_LINE_HEIGHT;
        page.drawText(ipPart, {
          x: fieldX, y: line2Y,
          size: META_FONT_SIZE, font: regularFont, color: META_COLOR,
        });
      }
    }
  }

  /**
   * Burn-in signatures and fields into the PDF
   */
  static async burnIn(
    originalPdfBuffer: Uint8Array,
    fields: EsignField[],
    signers: EsignSigner[]
  ): Promise<PDFBurnInResult> {
    try {
      // Load the PDF
      const pdfDoc = await PDFDocument.load(originalPdfBuffer);

      // ── Flatten existing AcroForm fields (signature fields, text fields, etc.)
      // Original documents (e.g. from Sygnia, Allan Gray) may contain embedded
      // PKCS#7 digital signatures. Modifying the PDF invalidates those signatures,
      // causing Adobe to show "At least one signature has problems". Flattening
      // converts all interactive form fields to static content, removing the old
      // signature dictionaries so Adobe won't attempt to validate them.
      // Our own PKCS#7 seal is applied later by signAndProtectPdf().
      try {
        const form = pdfDoc.getForm();
        form.flatten();
        log.info('Flattened existing AcroForm fields before burn-in');
      } catch {
        // No AcroForm present or flatten unsupported — safe to continue
      }

      const pages = pdfDoc.getPages();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Group fields by page for efficiency
      const fieldsByPage: Record<number, EsignField[]> = {};
      (fields || []).forEach(field => {
        if (!fieldsByPage[field.page]) {
          fieldsByPage[field.page] = [];
        }
        fieldsByPage[field.page].push(field);
      });

      // Process each page
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];
        const pageFields = fieldsByPage[pageIndex + 1] || []; // Pages are 1-based in our data model

        const { height } = page.getSize();

        for (const field of pageFields) {
          if (!field.value) continue; // Skip empty fields

          // Calculate position — x,y are stored as percentages (0–100).
          // width,height are stored in PDF points (absolute pixel values).
          // PDF origin is bottom-left; stored y is top-down.
          const x = (field.x / 100) * page.getWidth();
          const w = field.width;   // already in PDF points
          const h = field.height;  // already in PDF points
          const y = height - ((field.y / 100) * height) - h;

          if (field.type === 'text' || field.type === 'date') {
            // Clamp font size to fit the field height, min 8, max 14
            const fontSize = Math.max(8, Math.min(14, h * 0.6));
            page.drawText(field.value, {
              x: x + 2,
              y: y + (h / 2) - (fontSize * 0.35),
              size: fontSize,
              font: helveticaFont,
              color: rgb(0, 0, 0),
              maxWidth: w - 4,
            });
          } else if (field.type === 'checkbox') {
             if (field.value === 'true' || field.value === 'checked') {
                page.drawText('X', {
                  x: x + (w/2) - 4,
                  y: y + (h/2) - 4,
                  size: Math.min(14, h * 0.7),
                  font: helveticaFont,
                  color: rgb(0, 0, 0),
                });
             }
          } else if (field.type === 'signature' || field.type === 'initials') {
            // Handle both PNG and JPEG data URLs
            try {
              if (field.value.startsWith('data:image/png')) {
                const base64Data = field.value.split(',')[1];
                if (base64Data) {
                  const pngImageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                  const pngImage = await pdfDoc.embedPng(pngImageBytes);
                  page.drawImage(pngImage, { x, y, width: w, height: h });
                }
              } else if (field.value.startsWith('data:image/jpeg') || field.value.startsWith('data:image/jpg')) {
                const base64Data = field.value.split(',')[1];
                if (base64Data) {
                  const jpgImageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                  const jpgImage = await pdfDoc.embedJpg(jpgImageBytes);
                  page.drawImage(jpgImage, { x, y, width: w, height: h });
                }
              } else if (field.value.startsWith('data:image/')) {
                // Fallback: try PNG for any other image data URL
                const base64Data = field.value.split(',')[1];
                if (base64Data) {
                  const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                  try {
                    const img = await pdfDoc.embedPng(imgBytes);
                    page.drawImage(img, { x, y, width: w, height: h });
                  } catch {
                    // If PNG fails, try JPG
                    const img = await pdfDoc.embedJpg(imgBytes);
                    page.drawImage(img, { x, y, width: w, height: h });
                  }
                }
              } else {
                // Value is plain text (e.g. typed signature/initials) — render as text
                const fontSize = Math.max(10, Math.min(18, h * 0.5));
                page.drawText(field.value, {
                  x: x + 2,
                  y: y + (h / 2) - (fontSize * 0.35),
                  size: fontSize,
                  font: helveticaFont,
                  color: rgb(0, 0, 0),
                  maxWidth: w - 4,
                });
              }

              // ── Signature metadata block ─────────────────────────────
              // Render provenance info (signer name, timestamp, IP) below
              // the signature/initials field for audit traceability.
              const signer = PDFService.findSignerForField(field, signers);
              if (signer) {
                PDFService.drawSignatureMetadata(
                  page, field, signer, helveticaFont, helveticaBoldFont, x, y, w
                );
              }

            } catch (imgError: unknown) {
              log.error(`Failed to embed image for field ${field.id}:`, imgError);
              // Fallback: render value as text so we don't lose data
              page.drawText('[Signature]', {
                x: x + 2,
                y: y + (h / 2) - 5,
                size: 10,
                font: helveticaFont,
                color: rgb(0.5, 0.5, 0.5),
              });
            }
          }
        }
      }

      const pdfBytes = await pdfDoc.save();

      // Calculate new hash
      const hash = await calculateHash(pdfBytes);

      return {
        pdfBuffer: pdfBytes,
        hash,
        pageCount: pages.length
      };

    } catch (error: unknown) {
      log.error('PDF Burn-in failed:', error);
      throw new Error(`PDF Burn-in failed: ${getErrMsg(error)}`);
    }
  }

  /**
   * Merge signed PDF with certificate PDF
   */
  static async mergeCertificate(
    signedPdfBuffer: Uint8Array,
    certificatePdfBuffer: Uint8Array
  ): Promise<Uint8Array> {
    try {
      const mergedPdf = await PDFDocument.create();
      
      const signedDoc = await PDFDocument.load(signedPdfBuffer);
      const certificateDoc = await PDFDocument.load(certificatePdfBuffer);
      
      const signedPages = await mergedPdf.copyPages(signedDoc, signedDoc.getPageIndices());
      (signedPages || []).forEach(page => mergedPdf.addPage(page));
      
      const certPages = await mergedPdf.copyPages(certificateDoc, certificateDoc.getPageIndices());
      (certPages || []).forEach(page => mergedPdf.addPage(page));
      
      return await mergedPdf.save();
    } catch (error: unknown) {
       log.error('PDF Merge failed:', error);
       throw new Error(`PDF Merge failed: ${getErrMsg(error)}`);
    }
  }

  /**
   * Merge multiple PDF documents into a single PDF
   */
  static async mergeDocuments(pdfBuffers: Uint8Array[]): Promise<Uint8Array> {
    try {
      if (pdfBuffers.length === 0) {
        throw new Error('No PDF buffers provided for merging');
      }
      
      if (pdfBuffers.length === 1) {
        return pdfBuffers[0];
      }

      const mergedPdf = await PDFDocument.create();
      
      for (const buffer of pdfBuffers) {
        const doc = await PDFDocument.load(buffer);
        const indices = doc.getPageIndices();
        if (!indices || indices.length === 0) {
          log.warn('Skipping empty PDF document during merge');
          continue;
        }
        const pages = await mergedPdf.copyPages(doc, indices);
        if (!pages || !Array.isArray(pages)) {
          log.warn('copyPages returned unexpected value, skipping');
          continue;
        }
        pages.forEach(page => mergedPdf.addPage(page));
      }
      
      return await mergedPdf.save();
    } catch (error: unknown) {
      log.error('PDF Document Merge failed:', error);
      throw new Error(`PDF Document Merge failed: ${getErrMsg(error)}`);
    }
  }
}