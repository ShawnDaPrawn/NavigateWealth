/**
 * Invoice Capture AI
 *
 * Reads a RECEIVED supplier invoice (PDF or photo) and extracts the fields
 * for a draft ledger transaction — supplier, invoice number, date, total and
 * VAT. The operator confirms/edits the draft before anything is written; the
 * uploaded document becomes the transaction's tax_invoice evidence.
 *
 * Uses the shared OpenAI pipeline (ai-model-config.ts) with Structured
 * Outputs, mirroring supplier-template-ai.ts; the untrusted response is
 * normalized by the shared capture-extraction module.
 *
 * @module server/invoice-capture-ai
 */

import { createModuleLogger } from '../stderr-logger.ts';
import { callResponses, parseJsonResponse } from '../ai-model-config.ts';
import {
  normalizeCaptureExtraction,
  type CaptureExtraction,
} from '../../../../shared/locked-vat/capture-extraction.ts';

export { normalizeCaptureExtraction };
export type { CaptureExtraction };

const log = createModuleLogger('invoice-capture-ai');

const CAPTURE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'supplierName',
    'supplierVatNumber',
    'invoiceNumber',
    'invoiceDate',
    'total',
    'vatAmount',
    'description',
    'confidence',
    'notes',
  ],
  properties: {
    supplierName: { type: 'string' },
    supplierVatNumber: { type: 'string' },
    invoiceNumber: { type: 'string' },
    invoiceDate: { type: 'string', description: 'ISO yyyy-mm-dd; empty string when unreadable' },
    total: { type: 'number', description: 'VAT-inclusive grand total' },
    vatAmount: { type: 'number' },
    description: { type: 'string', description: 'One-line summary of what was supplied' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    notes: { type: 'string', description: 'Anything unreadable or ambiguous' },
  },
};

const PROMPT = [
  'Read this supplier tax invoice and extract, exactly as printed:',
  '- supplierName: the ISSUER of the invoice (the party being paid), not the recipient.',
  '- supplierVatNumber: the issuer’s VAT registration number (South African VAT numbers are 10 digits starting with 4); empty string if absent.',
  '- invoiceNumber: the issuer’s invoice number/reference.',
  '- invoiceDate: the invoice date as ISO yyyy-mm-dd (convert printed formats); empty string if unreadable.',
  '- total: the VAT-INCLUSIVE grand total payable.',
  '- vatAmount: the VAT amount shown; 0 if the invoice shows no VAT.',
  '- description: a one-line summary of the goods/services supplied.',
  'Set confidence to your 0-1 estimate of read accuracy and use notes for anything unreadable, ambiguous, or unusual (e.g. handwriting, partial zero-rating, foreign currency).',
  'Report only what is visible in the document.',
].join('\n');

/** Extract draft-transaction fields from a received invoice document. */
export async function extractInvoiceCapture(input: {
  fileBase64: string;
  fileName: string;
  contentType: string;
}): Promise<{ extraction: CaptureExtraction; model: string }> {
  const isPdf = input.contentType === 'application/pdf';
  const result = await callResponses({
    messages: [
      {
        role: 'system',
        content:
          'You are a meticulous bookkeeping assistant reading supplier invoices. You only report what is visible in the document.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          isPdf
            ? {
                type: 'file',
                filename: input.fileName || 'invoice.pdf',
                dataBase64: input.fileBase64,
              }
            : { type: 'image', dataBase64: input.fileBase64, mimeType: input.contentType },
        ],
      },
    ],
    maxOutputTokens: 1200,
    jsonSchema: { name: 'invoice_capture', schema: CAPTURE_JSON_SCHEMA, strict: true },
  });

  let parsed: unknown;
  try {
    parsed = parseJsonResponse(result.text);
  } catch (err) {
    log.error('Invoice capture returned unparseable JSON', err);
    throw Object.assign(
      new Error('AI could not read this document — please retry or capture manually'),
      {
        status: 502,
      },
    );
  }
  return { extraction: normalizeCaptureExtraction(parsed), model: result.model };
}
