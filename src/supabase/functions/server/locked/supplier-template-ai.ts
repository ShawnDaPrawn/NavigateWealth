/**
 * Supplier Template AI
 *
 * Analyzes a supplier's uploaded example invoice (PDF or image) and extracts
 * an InvoiceTemplateSpec describing its look, feel and layout, so the
 * deterministic renderer can reproduce the supplier's invoice standard.
 *
 * The default analyzer uses the shared OpenAI pipeline (ai-model-config.ts)
 * with Structured Outputs; the InvoiceTemplateAnalyzer interface isolates the
 * provider so an alternative (e.g. Anthropic) can be swapped in here without
 * touching the routes.
 *
 * @module server/supplier-template-ai
 */

import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from '../stderr-logger.ts';
import { callResponses, parseJsonResponse } from '../ai-model-config.ts';
import {
  normalizeTemplateSpec,
  TEMPLATE_ANALYSIS_JSON_SCHEMA,
  type InvoiceTemplateSpec,
} from './supplier-template-spec.ts';
import type { SupplierRecord } from './suppliers-service.ts';

const log = createModuleLogger('supplier-template-ai');

export interface TemplateAnalysisResult {
  spec: InvoiceTemplateSpec;
  confidence: number;
  notes: string;
  model: string;
}

export interface InvoiceTemplateAnalyzer {
  analyze(input: {
    fileBase64: string;
    fileName: string;
    contentType: string;
    supplier: SupplierRecord;
  }): Promise<TemplateAnalysisResult>;
}

/** Downloads a stored file from the given bucket as base64. */
export async function downloadFileAsBase64(bucket: string, storagePath: string): Promise<string> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) {
    throw new Error(`Failed to download example invoice: ${error?.message ?? 'no data'}`);
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function buildPrompt(supplier: SupplierRecord): string {
  return [
    `You are analyzing an example tax invoice issued by "${supplier.name}"`,
    supplier.vatNumber ? `(VAT number ${supplier.vatNumber})` : '',
    supplier.registrationNumber ? `(registration number ${supplier.registrationNumber})` : '',
    `. Extract a layout specification that lets a renderer reproduce this invoice's exact look and feel:`,
    `- palette: the dominant brand colours as 6-digit hex (primary, accent, header text, body text, table header background/text). Sample them from the document, not from assumptions.`,
    `- logo: whether a logo is shown, which area of the header it occupies, and its approximate rendered height in pixels on an A4 page (~794px wide).`,
    `- header: the document title EXACTLY as printed (e.g. "TAX INVOICE"), which side the title and the supplier details sit on, which supplier details are shown, and any accent bar.`,
    `- metaBox: the invoice metadata fields in the order printed, with their labels EXACTLY as worded.`,
    `- billedTo: the customer block heading exactly as worded and which customer details appear.`,
    `- lineTable: the line-item columns in printed order with their exact labels and alignment, plus the closest table style and header style.`,
    `- totals: position and the exact subtotal/VAT/total labels.`,
    `- footer: banking details, terms and any closing line, transcribed from the document.`,
    `- formats: the closest currency and date formats to what is printed.`,
    `Every enum field must use the closest allowed value; where the layout doesn't match any option exactly, pick the nearest and describe the mismatch in "notes".`,
    `Set "confidence" to your 0-1 estimate of how faithfully the spec reproduces the example.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Default analyzer: shared OpenAI pipeline with Structured Outputs. */
export const openAiInvoiceTemplateAnalyzer: InvoiceTemplateAnalyzer = {
  async analyze({ fileBase64, fileName, contentType, supplier }) {
    const isPdf = contentType === 'application/pdf';
    const result = await callResponses({
      messages: [
        {
          role: 'system',
          content:
            'You are a meticulous document-layout analyst. You describe the visual design of invoices as structured data. You only report what is visible in the document.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt(supplier) },
            isPdf
              ? {
                  type: 'file',
                  filename: fileName || 'example-invoice.pdf',
                  dataBase64: fileBase64,
                }
              : { type: 'image', dataBase64: fileBase64, mimeType: contentType },
          ],
        },
      ],
      maxOutputTokens: 3000,
      jsonSchema: {
        name: 'invoice_template_analysis',
        schema: TEMPLATE_ANALYSIS_JSON_SCHEMA,
        // The full nested spec exceeds strict-mode's appetite for optionality;
        // the normalizer re-validates everything on our side anyway.
        strict: false,
      },
    });

    let parsed: { spec?: unknown; confidence?: unknown; notes?: unknown };
    try {
      parsed = parseJsonResponse(result.text);
    } catch (err) {
      log.error('Template analysis returned unparseable JSON', err);
      throw Object.assign(new Error('AI analysis returned an unreadable response — please retry'), {
        status: 502,
      });
    }

    const confidence =
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0;
    return {
      spec: normalizeTemplateSpec(parsed.spec),
      confidence,
      notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0, 2000) : '',
      model: result.model,
    };
  },
};
