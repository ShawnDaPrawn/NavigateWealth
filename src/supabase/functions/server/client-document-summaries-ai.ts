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
import {
  AiCallError,
  callResponses,
  parseJsonResponse,
  resolvePreferredModel,
} from './ai-model-config.ts';
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

/**
 * Output budget for one summary.
 *
 * Raised from 1200 after a real batch came back cut off mid-sentence: with
 * Structured Outputs a truncated reply is invalid JSON, so the budget running
 * out surfaced as "Unterminated string in JSON at position 342" rather than as
 * anything a reader could act on. The entry itself is a headline, a short
 * paragraph and two small lists, so this is generous for the content — the
 * headroom is for models that spend output tokens on reasoning before writing.
 */
export const MAX_SUMMARY_OUTPUT_TOKENS = 3000;

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

/**
 * A failure that still knows what it was working with.
 *
 * The stored `failed` record used to hardcode `analysed: false` for every
 * document and carry no model at all, so a failed entry said "0 of 6 files read
 * by the AI" whether six files had been sent or none, and gave no way to tell
 * which model had rejected them. Both are facts the catch site cannot recover
 * on its own, so the throw carries them.
 */
export class SummaryGenerationError extends Error {
  constructor(
    message: string,
    readonly documents: SummarisedDocument[],
    readonly model: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'SummaryGenerationError';
  }
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
 * Identity of a file's CONTENT, for spotting the same document filed twice.
 *
 * This hashes the bytes rather than comparing filename and length, because a
 * pack is assembled from files the adviser picked out of different folders:
 * `quote.pdf` at 363,553 bytes is not evidence of being the same `quote.pdf`.
 * Collapsing on that pair would drop a real financial document from the request
 * while the stored record still claimed the model had read it — the exact kind
 * of false coverage this feature is not allowed to produce. Two files that hash
 * the same ARE the same, so the collapse is safe.
 */
async function contentDigest(buffer: ArrayBuffer): Promise<string> {
  return toBase64(await crypto.subtle.digest('SHA-256', buffer));
}

/** One attachment that made it into the request, and what it cost. */
interface Attachment {
  id: string;
  bytes: number;
}

export interface SummaryInputOptions {
  /** Document ids to leave unattached — the retry ladder narrows with this. */
  excludeIds?: ReadonlySet<string>;
  /** Send no bytes at all. The last rung: a metadata-only summary still beats none. */
  metadataOnly?: boolean;
}

/**
 * Build the model input for a group of documents.
 *
 * Returns the content blocks, the per-document record of what was actually
 * analysed, and the attachments that were sent — the last so a retry can narrow
 * the request without rebuilding this logic.
 *
 * DUPLICATES ARE SENT ONCE. A pack routinely holds the same file uploaded
 * twice (one real client pack here is three PDFs filed twice over, 9.4MB of
 * which half is a copy). Sending both wastes the byte budget, doubles the cost,
 * and makes it likelier the request trips a provider limit. The twin is still
 * listed in the manifest and still counts as analysed, because its contents did
 * reach the model — just once. Identity is a hash of the downloaded bytes, so
 * the twin is downloaded and only then collapsed: the saving is the upload and
 * the model's attention, which is where the cost is.
 */
export async function buildSummaryInput(
  documents: DocumentForSummary[],
  options: SummaryInputOptions = {},
): Promise<{
  blocks: AiContentBlock[];
  analysed: SummarisedDocument[];
  attached: Attachment[];
}> {
  const analysed: SummarisedDocument[] = [];
  const fileBlocks: AiContentBlock[] = [];
  const attached: Attachment[] = [];
  /** content hash -> index of the document whose bytes were actually sent. */
  const sentByContent = new Map<string, number>();
  /** Per-document manifest note, e.g. that it duplicates an earlier entry. */
  const notes: Array<string | null> = [];
  let attachedBytes = 0;

  const record = (doc: DocumentForSummary, wasAnalysed: boolean, note: string | null) => {
    analysed.push({
      id: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      productCategory: doc.productCategory,
      analysed: wasAnalysed,
    });
    notes.push(note);
  };

  for (const doc of documents) {
    const mime = mimeFromFileName(doc.fileName);
    const attachable =
      !options.metadataOnly &&
      !options.excludeIds?.has(doc.id) &&
      doc.type !== 'link' &&
      // RoA documents keep their bytes behind a KV pointer rather than a
      // storage path; their metadata is descriptive enough on its own.
      doc.sourceSystem !== 'record-of-advice' &&
      Boolean(doc.filePath) &&
      isReadableByModel(mime) &&
      fileBlocks.length < MAX_ATTACHMENTS;

    if (!attachable) {
      record(doc, false, options.excludeIds?.has(doc.id) ? 'could not be read by the AI' : null);
      continue;
    }

    const buffer = await downloadDocument(doc.filePath!);
    if (!buffer) {
      record(doc, false, null);
      continue;
    }

    // Hashed before the budget check: a copy of something already attached
    // costs nothing more, so it must not be turned away for being over budget.
    const digest = await contentDigest(buffer);
    const twinIndex = sentByContent.get(digest);
    if (twinIndex !== undefined) {
      // Byte-for-byte identical to one already sent: its content reached the
      // model, so it is analysed — we simply did not pay for it twice.
      record(doc, analysed[twinIndex].analysed, `same file as item ${twinIndex + 1}`);
      continue;
    }

    if (attachedBytes + buffer.byteLength > MAX_ATTACHMENT_BYTES) {
      record(doc, false, null);
      continue;
    }

    attachedBytes += buffer.byteLength;
    const dataBase64 = toBase64(buffer);
    fileBlocks.push(
      mime === PDF_MIME
        ? { type: 'file', filename: doc.fileName || `${doc.title}.pdf`, dataBase64, mimeType: mime }
        : { type: 'image', dataBase64, mimeType: mime },
    );
    attached.push({ id: doc.id, bytes: buffer.byteLength });
    sentByContent.set(digest, analysed.length);
    record(doc, true, null);
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
        `(${[wasRead, notes[index]].filter(Boolean).join('; ')})`,
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

  return { blocks, analysed, attached };
}

/**
 * True when the provider rejected an attached FILE rather than the request.
 *
 * A PDF the provider cannot parse — scanned oddly, damaged, too many pages —
 * comes back as a 400 about the upload, not about anything the retry could fix
 * by waiting. Distinguishing it matters because it is the one failure worth
 * answering by sending less, and previously it took the whole pack down.
 */
export function isFileRejection(error: unknown): boolean {
  const message = getErrMsg(error).toLowerCase();
  return (
    message.includes('uploaded file could not be processed') ||
    message.includes('invalid_image') ||
    message.includes('failed to process file') ||
    (message.includes('file') && message.includes('could not be processed'))
  );
}

/** Reason string used when a reply stopped for want of output budget. */
const OUTPUT_LIMIT_REASON = 'max_output_tokens';

/**
 * Why the model stopped short, or null when it finished.
 *
 * Structured Outputs guarantees valid JSON only for a response that FINISHES.
 * An unfinished one is invalid by definition, and surfaced as "Unterminated
 * string in JSON at position 342" — a parser message that tells the reader
 * nothing about the actual cause. Both API shapes are read because either can
 * serve this call.
 *
 * The REASON is carried rather than collapsed to a yes/no, because the two
 * cases need opposite responses: running out of output budget is answered by a
 * bigger budget, while a content filter is not answered by retrying at all, and
 * telling an adviser to raise a limit that was never the problem sends them
 * looking in the wrong place.
 */
export function incompleteReason(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as {
    status?: unknown;
    incomplete_details?: { reason?: unknown };
    choices?: Array<{ finish_reason?: unknown }>;
  };

  const stated = body.incomplete_details?.reason;
  if (typeof stated === 'string' && stated) return stated;
  // Responses said it stopped short but not why; still unfinished, still fatal.
  if (body.status === 'incomplete') return 'unspecified';

  const finish = body.choices?.[0]?.finish_reason;
  if (finish === 'length') return OUTPUT_LIMIT_REASON;
  if (finish === 'content_filter') return 'content_filter';
  return null;
}

/** True only when the reply stopped because it ran out of output budget. */
export function wasTruncated(raw: unknown): boolean {
  return incompleteReason(raw) === OUTPUT_LIMIT_REASON;
}

/** Parse and validate one model reply into a draft. */
function toDraft(
  result: { text: string; model: string; raw: unknown },
  analysed: SummarisedDocument[],
): SummaryDraft {
  const incomplete = incompleteReason(result.raw);
  if (incomplete === OUTPUT_LIMIT_REASON) {
    throw new Error(
      'The AI reply was cut off before it finished, so it could not be read. ' +
        'This batch may need a larger output budget.',
    );
  }
  if (incomplete) {
    throw new Error(
      `The AI stopped before finishing this summary (${incomplete}), so its reply ` +
        'could not be read. Retrying will not change that on its own.',
    );
  }

  let parsed: Partial<SummaryDraft>;
  try {
    parsed = parseJsonResponse<Partial<SummaryDraft>>(result.text);
  } catch (error) {
    // Wrapped, not re-thrown raw: a bare "Unexpected token 'I'" reaches the
    // timeline as the stored reason and tells the reader nothing about what
    // went wrong or what to do.
    log.error('Summary response was not JSON', { error: getErrMsg(error) });
    throw new Error(`AI summary could not be parsed: ${getErrMsg(error)}`, { cause: error });
  }

  const headline = typeof parsed.headline === 'string' ? parsed.headline.trim() : '';
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  if (!headline || !summary) throw new Error('AI summary was empty');

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

/**
 * Summarise a group of documents.
 *
 * ONE UNREADABLE FILE NO LONGER COSTS THE WHOLE BATCH. A pack is summarised as
 * a unit, so before this a single PDF the provider could not parse left the
 * client with no timeline entry at all and an error nobody could act on. The
 * request now narrows and retries instead:
 *
 *   1. everything attached;
 *   2. the largest attachment dropped — size is a heuristic for the awkward
 *      file, not a diagnosis, but the provider does not say which file it
 *      rejected and one guided retry beats bisecting six multi-megabyte
 *      uploads;
 *   3. metadata only, which cannot be rejected for its files.
 *
 * Bounded at three attempts, and only a file rejection advances a rung —
 * anything else throws immediately rather than paying to fail again.
 *
 * Throws {@link SummaryGenerationError}, which carries the per-document
 * analysis and the model attempted so the stored failure can be honest about
 * both.
 */
export async function generateSummaryDraft(documents: DocumentForSummary[]): Promise<SummaryDraft> {
  // Resolved once for the whole ladder: retries must not silently change model.
  const model = await resolvePreferredModel(SUMMARY_MODEL_PREFERENCES, SUMMARY_MODEL_ENV);
  const excludeIds = new Set<string>();
  let metadataOnly = false;
  let analysed: SummarisedDocument[] = [];

  for (let attempt = 1; attempt <= 3; attempt++) {
    const input = await buildSummaryInput(documents, { excludeIds, metadataOnly });
    analysed = input.analysed;
    // What answered, as opposed to what was asked for. `callResponses` retries
    // the fallback model on its own, so these differ more often than the name
    // `model` suggests, and a failure must be filed against the one that
    // produced it.
    let servedBy = model;

    try {
      const result = await callResponses({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: input.blocks },
        ],
        model,
        maxOutputTokens: MAX_SUMMARY_OUTPUT_TOKENS,
        temperature: 0.2,
        jsonSchema: { name: 'client_document_summary', schema: SUMMARY_SCHEMA, strict: true },
      });
      servedBy = result.model || model;
      return toDraft(result, analysed);
    } catch (error) {
      // Three provenances, most specific first: the failed call named its own
      // model; the call returned and `toDraft` rejected what it said; or nothing
      // came back at all and the requested model is the best we know.
      const servedByFailure = error instanceof AiCallError ? error.model : servedBy;
      const isLastAttempt = attempt === 3;
      if (isLastAttempt || !isFileRejection(error)) {
        throw new SummaryGenerationError(getErrMsg(error), analysed, servedByFailure, {
          cause: error,
        });
      }

      if (!metadataOnly && input.attached.length > 1) {
        const largest = input.attached.reduce((a, b) => (b.bytes > a.bytes ? b : a));
        excludeIds.add(largest.id);
        log.warn('Provider rejected a file — retrying without the largest attachment', {
          droppedDocumentId: largest.id,
          droppedBytes: largest.bytes,
          remaining: input.attached.length - 1,
        });
      } else {
        metadataOnly = true;
        log.warn('Provider rejected a file — retrying with metadata only', {
          documentCount: documents.length,
        });
      }
    }
  }

  // Unreachable: the loop either returns or throws on its third attempt.
  throw new SummaryGenerationError('AI summary could not be generated', analysed, model);
}
