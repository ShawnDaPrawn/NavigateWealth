/**
 * Client Document Summary — the model call.
 *
 * Kept apart from the service so the service's grouping/storage logic is
 * testable without stubbing OpenAI, and so the prompt is one readable thing
 * rather than a string buried in a control-flow branch.
 *
 * WHAT GETS SENT
 * --------------
 * Only what the model can actually read: PDFs as file blocks, images as image
 * blocks. Word/Excel bytes are meaningless to it, so those documents
 * contribute their metadata (title, category, policy number, filename) and are
 * marked `analysed: false` in the stored record — the UI says so, rather than
 * implying the file was read.
 *
 * The attachment budget is deliberately small. A pack can hold thirty files;
 * sending all of them base64-encoded would blow both the request size and the
 * per-run cost of a weekly job that fans out over every client.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { callResponses, parseJsonResponse, resolvePreferredModel } from './ai-model-config.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import type { AiContentBlock } from './ai-model-config.ts';
import type { SummarisedDocument } from './client-document-summaries-types.ts';

const log = createModuleLogger('client-doc-summaries-ai');

const BUCKET_NAME = 'make-91ed8379-documents';

/**
 * Env var that pins the summariser to one model, overriding the ranking below.
 *
 * Set, it wins outright and no probe runs — naming a model is a decision, and a
 * setting that gets second-guessed is not worth having. Clear it to go back to
 * the ranked preferences.
 *
 * This caller can carry an override at all because `callResponses` retries on
 * `OPENAI_FALLBACK_MODEL` through Chat Completions: an id this account cannot
 * serve costs one failed request and still produces a summary, and the model
 * that actually answered is recorded on the stored record — so a bad value
 * shows on the timeline as the old model, not as a broken feature.
 */
export const SUMMARY_MODEL_ENV = 'OPENAI_SUMMARY_MODEL';

/**
 * Models to prefer for this feature, best first, CHECKED AGAINST THE ACCOUNT.
 *
 * READ THIS BEFORE EDITING. These names are a ranking, not a claim that any of
 * them exist. `resolvePreferredModel` asks the account which models it can
 * serve and skips every entry that is not on that list, so a name that is
 * wrong, retired, or invented is simply passed over — it cannot 400 a request
 * or take the feature down. That is deliberate: it is what makes it safe to
 * list newer models optimistically instead of pinning gpt-4o forever out of
 * caution, and it is the guard the `gpt-5.4` outage did not have.
 *
 * When none of these are available the answer is `OPENAI_PRIMARY_MODEL`, i.e.
 * exactly today's behaviour. So the worst case of a completely stale list is a
 * no-op, not a regression.
 *
 * WHAT BELONGS HERE. The summariser needs three things, so only add a model
 * that has all of them:
 *   1. it reads PDF and image input (documents are sent as file/image blocks);
 *   2. it supports Structured Outputs (`json_schema`, strict) — the summary
 *      shape is enforced, not parsed hopefully;
 *   3. it is cheap enough to run over every client every week.
 * The cost-tier ("mini"-class) models are ranked above their full-size siblings
 * for that third reason: this is short, schema-constrained output over a handful
 * of documents, which is where the cheap tier is strongest.
 *
 * TO REFINE THIS FOR THIS ACCOUNT: the first probe per function instance logs
 * `OpenAI models available to this account` with the real text-model list. Read
 * it out of the Edge Function logs and reorder these accordingly — no API key
 * needed in hand.
 */
export const SUMMARY_MODEL_PREFERENCES: readonly string[] = [
  'gpt-5-mini',
  'gpt-5',
  'gpt-4.1-mini',
  'gpt-4.1',
  'gpt-4o-mini',
];

/** Most files sent to the model in one summary. */
export const MAX_ATTACHMENTS = 6;
/** Ceiling on the combined size of those files, before base64 expansion. */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const PDF_MIME = 'application/pdf';
const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);

const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/** Guess the MIME type from the filename; storage metadata is not always set. */
export function mimeFromFileName(fileName: string | undefined): string {
  const ext = (fileName || '').toLowerCase().split('.').pop() || '';
  switch (ext) {
    case 'pdf':
      return PDF_MIME;
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

/** True when the model can read this file's bytes at all. */
export function isReadableByModel(mime: string): boolean {
  return mime === PDF_MIME || IMAGE_MIMES.has(mime);
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Chunked to keep the argument list of fromCharCode within engine limits —
  // spreading a multi-megabyte array in one call throws RangeError.
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export interface DocumentForSummary {
  id: string;
  title: string;
  fileName?: string;
  filePath?: string;
  productCategory: string;
  policyNumber?: string;
  type?: string;
  url?: string;
  description?: string;
  sourceSystem?: string;
  uploadDate: string;
}

export interface SummaryDraft {
  headline: string;
  summary: string;
  highlights: string[];
  followUps: string[];
  documents: SummarisedDocument[];
  model: string;
}

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    headline: {
      type: 'string',
      description: 'One short line naming what this batch of documents was, max 120 characters.',
    },
    summary: {
      type: 'string',
      description:
        'Two to four sentences describing what the documents show was done for the client.',
    },
    highlights: {
      type: 'array',
      description: 'Concrete facts from the documents: products, amounts, dates, parties.',
      items: { type: 'string' },
    },
    followUps: {
      type: 'array',
      description: 'Anything outstanding the documents point at. Empty array when nothing is.',
      items: { type: 'string' },
    },
  },
  required: ['headline', 'summary', 'highlights', 'followUps'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a compliance-minded assistant for a South African
financial advisory practice. You are given the documents that were filed to one
client's record in a single batch, and you write the timeline entry that
explains what that batch was.

Write for an adviser scanning a client's history months later. They need to know
what was done, not what a document is called.

Rules:
- State only what the documents actually show. Never infer an outcome, a value
  or an approval that is not written down.
- Prefer specifics over adjectives: product names, providers, policy numbers,
  premium and cover amounts (in Rand), effective dates, who signed what.
- If a document could not be read, say nothing about its contents.
- If the batch is routine filing with no advice event in it, say that plainly.
- Never invent follow-ups to look useful. An empty followUps array is correct
  when the documents raise nothing.
- Do not include the client's ID number or any bank account number.
- South African English, plain sentences, no markdown.`;

/** Download one document's bytes from storage, or null when unavailable. */
async function downloadDocument(filePath: string): Promise<ArrayBuffer | null> {
  const { data, error } = await getSupabase().storage.from(BUCKET_NAME).download(filePath);
  if (error || !data) {
    log.warn('Could not download document for summarisation', {
      filePath,
      error: error?.message,
    });
    return null;
  }
  return await data.arrayBuffer();
}

/**
 * Build the model input for a group of documents.
 *
 * Returns the content blocks and the per-document record of what was actually
 * analysed, so the stored summary can be honest about its own coverage.
 */
export async function buildSummaryInput(
  documents: DocumentForSummary[],
): Promise<{ blocks: AiContentBlock[]; analysed: SummarisedDocument[] }> {
  const analysed: SummarisedDocument[] = [];
  const fileBlocks: AiContentBlock[] = [];
  let attachedBytes = 0;

  for (const doc of documents) {
    const mime = mimeFromFileName(doc.fileName);
    const attachable =
      doc.type !== 'link' &&
      // RoA documents keep their bytes behind a KV pointer rather than a
      // storage path; their metadata is descriptive enough on its own.
      doc.sourceSystem !== 'record-of-advice' &&
      Boolean(doc.filePath) &&
      isReadableByModel(mime) &&
      fileBlocks.length < MAX_ATTACHMENTS;

    if (!attachable) {
      analysed.push({
        id: doc.id,
        title: doc.title,
        fileName: doc.fileName,
        productCategory: doc.productCategory,
        analysed: false,
      });
      continue;
    }

    const buffer = await downloadDocument(doc.filePath!);
    if (!buffer || attachedBytes + buffer.byteLength > MAX_ATTACHMENT_BYTES) {
      analysed.push({
        id: doc.id,
        title: doc.title,
        fileName: doc.fileName,
        productCategory: doc.productCategory,
        analysed: false,
      });
      continue;
    }

    attachedBytes += buffer.byteLength;
    const dataBase64 = toBase64(buffer);
    fileBlocks.push(
      mime === PDF_MIME
        ? { type: 'file', filename: doc.fileName || `${doc.title}.pdf`, dataBase64, mimeType: mime }
        : { type: 'image', dataBase64, mimeType: mime },
    );
    analysed.push({
      id: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      productCategory: doc.productCategory,
      analysed: true,
    });
  }

  const manifest = documents
    .map((doc, index) => {
      const wasRead = analysed[index]?.analysed ? 'contents attached' : 'metadata only';
      const parts = [
        `${index + 1}. ${doc.title}`,
        `category: ${doc.productCategory || 'General'}`,
        doc.policyNumber ? `policy: ${doc.policyNumber}` : '',
        doc.fileName ? `file: ${doc.fileName}` : '',
        doc.type === 'link' ? `link: ${doc.url || ''}` : '',
        doc.description ? `note: ${doc.description}` : '',
        `uploaded: ${doc.uploadDate}`,
        `(${wasRead})`,
      ].filter(Boolean);
      return parts.join(' — ');
    })
    .join('\n');

  const blocks: AiContentBlock[] = [
    {
      type: 'text',
      text:
        `These ${documents.length} item(s) were filed to one client's record together.\n\n` +
        `Manifest:\n${manifest}\n\n` +
        `Write the timeline entry for this batch.`,
    },
    ...fileBlocks,
  ];

  return { blocks, analysed };
}

/**
 * Summarise a group of documents.
 *
 * Throws on a model or parse failure — the caller decides whether that means a
 * stored `failed` record (manual run, so the user sees why) or a counted
 * failure in a scan report.
 */
export async function generateSummaryDraft(documents: DocumentForSummary[]): Promise<SummaryDraft> {
  const { blocks, analysed } = await buildSummaryInput(documents);

  const result = await callResponses({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: blocks },
    ],
    // Resolved per call, not at module load: an operator changing the secret
    // gets the new model on the next request rather than the next cold start.
    // The account probe behind this is cached per instance, so the weekly scan
    // pays for it once across its whole run.
    model: await resolvePreferredModel(SUMMARY_MODEL_PREFERENCES, SUMMARY_MODEL_ENV),
    maxOutputTokens: 1200,
    temperature: 0.2,
    jsonSchema: { name: 'client_document_summary', schema: SUMMARY_SCHEMA, strict: true },
  });

  let parsed: Partial<SummaryDraft>;
  try {
    parsed = parseJsonResponse<Partial<SummaryDraft>>(result.text);
  } catch (error) {
    log.error('Summary response was not JSON', { error: getErrMsg(error) });
    throw new Error(`AI summary could not be parsed: ${getErrMsg(error)}`, { cause: error });
  }

  const headline = typeof parsed.headline === 'string' ? parsed.headline.trim() : '';
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  if (!headline || !summary) {
    throw new Error('AI summary was empty');
  }

  return {
    headline,
    summary,
    highlights: Array.isArray(parsed.highlights)
      ? parsed.highlights.filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
      : [],
    followUps: Array.isArray(parsed.followUps)
      ? parsed.followUps.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : [],
    documents: analysed,
    model: result.model,
  };
}
