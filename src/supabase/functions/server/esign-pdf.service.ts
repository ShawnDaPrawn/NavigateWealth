/**
 * E-Signature PDF Service
 * Handles PDF manipulation, field flattening ("burn-in"), and certificate generation.
 */

import {
  PDFDocument,
  rgb,
  StandardFonts,
  clip,
  concatTransformationMatrix,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
} from 'npm:pdf-lib@1.17.1';
import type { PDFFont, PDFImage, PDFPage, RGB } from 'npm:pdf-lib@1.17.1';
import { fitFieldText, formatFieldDate, helveticaWidth } from '../../../shared/esign/fieldText.ts';
import { makeSanitiser } from './esign-certificate-format.ts';
import { fieldRectInDisplay, pageFrame } from './esign-page-frame.ts';
import type { EsignField, EsignSigner } from './esign-types.ts';
import { calculateHash } from './esign-storage.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const log = createModuleLogger('esign-pdf-service');

export interface PDFBurnInResult {
  pdfBuffer: Uint8Array;
  hash: string;
  pageCount: number;
}

export class PDFService {
  // ==========================================================================
  // Signature metadata (signer name, time, masked IP)
  // ==========================================================================

  /** Signature boxes shorter than this get no stamp — the certificate has it. */
  private static readonly STAMP_MIN_BOX_H = 28;
  /** Largest stamp font size, in points. */
  private static readonly STAMP_MAX_SIZE = 5.5;
  /** Medium grey for the stamp. */
  private static readonly META_COLOR: RGB = rgb(0.45, 0.45, 0.45);
  /** Dot separator between stamp segments. */
  private static readonly META_SEP = '  ·  ';

  /**
   * Resolve the signer associated with a field.
   * Matches by signer.id first, then by email as fallback
   * (frontend may assign signer_id as the signer's email during preparation).
   */
  private static findSignerForField(
    field: EsignField,
    signers: EsignSigner[],
  ): EsignSigner | undefined {
    return (
      signers.find((s) => s.id === field.signer_id) ||
      signers.find((s) => s.email === field.signer_id)
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
   * Format an ISO timestamp for the signature stamp, in South African time:
   * "25 Feb 2026, 14:32". The Edge runtime's clock is UTC, so without the
   * time zone the stamp read two hours early.
   */
  private static formatMetaDate(iso: string): string {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      const opts = { timeZone: 'Africa/Johannesburg' } as const;
      return (
        d.toLocaleDateString('en-ZA', {
          ...opts,
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }) +
        ', ' +
        d.toLocaleTimeString('en-ZA', {
          ...opts,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    } catch {
      return iso;
    }
  }

  /** Embed a data-URL image, or null if it is not a PNG/JPEG pdf-lib can read. */
  private static async embedDataUrlImage(
    pdfDoc: PDFDocument,
    dataUrl: string,
  ): Promise<PDFImage | null> {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (/^data:image\/jpe?g/i.test(dataUrl)) return await pdfDoc.embedJpg(bytes);
    try {
      return await pdfDoc.embedPng(bytes);
    } catch {
      return await pdfDoc.embedJpg(bytes);
    }
  }

  /** Clip everything drawn by `draw` to the rectangle, so nothing can leave the box. */
  private static clipped(
    page: PDFPage,
    box: { x: number; y: number; w: number; h: number },
    draw: () => void,
  ): void {
    page.pushOperators(
      pushGraphicsState(),
      rectangle(box.x, box.y, box.w, box.h),
      clip(),
      endPath(),
    );
    try {
      draw();
    } finally {
      page.pushOperators(popGraphicsState());
    }
  }

  /** Draw a one-line value fitted to (and clipped by) the box. */
  private static drawFittedText(
    page: PDFPage,
    font: PDFFont,
    text: string,
    box: { x: number; y: number; w: number; h: number },
    opts: { maxSize?: number; color?: RGB } = {},
  ): void {
    if (!text) return;
    const fit = fitFieldText(text, box.w, box.h, {
      maxSize: opts.maxSize,
      // Real font metrics for the drawn font; the shared table matches them
      // for ASCII and is what the signing screen uses.
      measure: (t, size) => {
        try {
          return font.widthOfTextAtSize(t, size);
        } catch {
          return helveticaWidth(t, size);
        }
      },
    });
    PDFService.clipped(page, box, () => {
      page.drawText(text, {
        x: box.x + fit.offsetX,
        y: box.y + fit.baselineFromBottom,
        size: fit.size,
        font,
        color: opts.color ?? rgb(0, 0, 0),
      });
    });
  }

  /**
   * Burn field values into the PDF.
   *
   * Every value is drawn INSIDE its field box and clipped to it — the same
   * one-line fit rule the signing screen uses (shared/esign/fieldText.ts).
   * This used to print 14pt text wrapped onto lines below the box, stretch
   * signatures to the box's shape, print the signer stamp under the box over
   * whatever was there, ignore page rotation and crop, and abort the whole
   * completion on a name the standard font could not encode.
   */
  static async burnIn(
    originalPdfBuffer: Uint8Array,
    fields: EsignField[],
    signers: EsignSigner[],
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
      const sanitise = makeSanitiser(helveticaFont);

      // Group fields by page for efficiency
      const fieldsByPage: Record<number, EsignField[]> = {};
      (fields || []).forEach((field) => {
        if (!fieldsByPage[field.page]) {
          fieldsByPage[field.page] = [];
        }
        fieldsByPage[field.page].push(field);
      });

      // Process each page
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];
        const pageFields = (fieldsByPage[pageIndex + 1] || []).filter((f) => !!f.value);
        if (pageFields.length === 0) continue;

        // Draw in the page's DISPLAY space — the CropBox, turned by /Rotate —
        // which is what the studio and the signing screen positioned against.
        const frame = pageFrame(page.getCropBox(), page.getRotation().angle);
        page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...frame.matrix));
        try {
          for (const field of pageFields) {
            await PDFService.burnField(pdfDoc, page, field, signers, frame, {
              font: helveticaFont,
              sanitise,
            });
          }
        } finally {
          page.pushOperators(popGraphicsState());
        }
      }

      const pdfBytes = await pdfDoc.save();

      // Calculate new hash
      const hash = await calculateHash(pdfBytes);

      return {
        pdfBuffer: pdfBytes,
        hash,
        pageCount: pages.length,
      };
    } catch (error: unknown) {
      log.error('PDF Burn-in failed:', error);
      throw new Error(`PDF Burn-in failed: ${getErrMsg(error)}`, { cause: error });
    }
  }

  /** Draw one field's value. Coordinates are display space (see pageFrame). */
  private static async burnField(
    pdfDoc: PDFDocument,
    page: PDFPage,
    field: EsignField,
    signers: EsignSigner[],
    frame: { width: number; height: number },
    ctx: { font: PDFFont; sanitise: (s: string) => string },
  ): Promise<void> {
    const value = field.value ?? '';
    const box = fieldRectInDisplay(frame, field);

    // Every type whose value is a plain string burns in as text.
    const textLike =
      field.type === 'text' ||
      field.type === 'date' ||
      field.type === 'auto_date' ||
      field.type === 'dropdown' ||
      field.type === 'radio' ||
      field.type === 'note';

    if (textLike) {
      const shown =
        field.type === 'date' || field.type === 'auto_date' ? formatFieldDate(value) : value;
      PDFService.drawFittedText(page, ctx.font, ctx.sanitise(shown), box);
      return;
    }

    if (field.type === 'checkbox') {
      if (value === 'true' || value === 'checked') {
        PDFService.drawFittedText(page, ctx.font, 'X', box, { maxSize: Math.min(box.w, box.h) });
      }
      return;
    }

    if (field.type !== 'signature' && field.type !== 'initials') return;

    // A stamp line inside the bottom of the box when there is room for one;
    // the image takes the rest. Small boxes carry the image alone — the
    // completion certificate records who signed, when and from where.
    const signer = PDFService.findSignerForField(field, signers);
    const stampH =
      signer && box.h >= PDFService.STAMP_MIN_BOX_H
        ? Math.min(PDFService.STAMP_MAX_SIZE * 1.6, box.h * 0.22)
        : 0;
    const imageBox = { x: box.x, y: box.y + stampH, w: box.w, h: box.h - stampH };

    try {
      if (value.startsWith('data:image/')) {
        const img = await PDFService.embedDataUrlImage(pdfDoc, value);
        if (img) {
          // Keep the signature's shape: fit inside the box and centre it.
          // Drawing it at the box's width AND height stretched it.
          const scale = Math.min(imageBox.w / img.width, imageBox.h / img.height);
          const iw = img.width * scale;
          const ih = img.height * scale;
          page.drawImage(img, {
            x: imageBox.x + (imageBox.w - iw) / 2,
            y: imageBox.y + (imageBox.h - ih) / 2,
            width: iw,
            height: ih,
          });
        }
      } else {
        // Typed signature/initials — drawn as text, a little larger.
        PDFService.drawFittedText(page, ctx.font, ctx.sanitise(value), imageBox, { maxSize: 18 });
      }
    } catch (imgError: unknown) {
      log.error(`Failed to embed image for field ${field.id}:`, imgError);
      PDFService.drawFittedText(page, ctx.font, '[Signature]', imageBox, {
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    if (signer && stampH > 0) {
      const parts = [
        signer.name,
        signer.signed_at ? PDFService.formatMetaDate(signer.signed_at) : '',
        signer.ip_address ? `IP ${PDFService.maskIp(signer.ip_address)}` : '',
      ].filter(Boolean);
      PDFService.drawFittedText(
        page,
        ctx.font,
        ctx.sanitise(parts.join(PDFService.META_SEP)),
        { x: box.x, y: box.y, w: box.w, h: stampH },
        { maxSize: PDFService.STAMP_MAX_SIZE, color: PDFService.META_COLOR },
      );
    }
  }

  /**
   * Merge signed PDF with certificate PDF
   */
  static async mergeCertificate(
    signedPdfBuffer: Uint8Array,
    certificatePdfBuffer: Uint8Array,
  ): Promise<Uint8Array> {
    try {
      const mergedPdf = await PDFDocument.create();

      const signedDoc = await PDFDocument.load(signedPdfBuffer);
      const certificateDoc = await PDFDocument.load(certificatePdfBuffer);

      const signedPages = await mergedPdf.copyPages(signedDoc, signedDoc.getPageIndices());
      (signedPages || []).forEach((page) => mergedPdf.addPage(page));

      const certPages = await mergedPdf.copyPages(certificateDoc, certificateDoc.getPageIndices());
      (certPages || []).forEach((page) => mergedPdf.addPage(page));

      return await mergedPdf.save();
    } catch (error: unknown) {
      log.error('PDF Merge failed:', error);
      throw new Error(`PDF Merge failed: ${getErrMsg(error)}`, { cause: error });
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
        pages.forEach((page) => mergedPdf.addPage(page));
      }

      return await mergedPdf.save();
    } catch (error: unknown) {
      log.error('PDF Document Merge failed:', error);
      throw new Error(`PDF Document Merge failed: ${getErrMsg(error)}`, { cause: error });
    }
  }
}
