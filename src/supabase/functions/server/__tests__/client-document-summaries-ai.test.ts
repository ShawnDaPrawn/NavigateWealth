/**
 * What the summariser actually sends to the model.
 * ================================================
 *
 * This is the part that decides what the AI is allowed to see, and it is where
 * being wrong is expensive in two different directions:
 *
 *   - attach too much (a thirty-file pack, base64-encoded) and a weekly job
 *     fanning out over every client blows both the request size and the bill;
 *   - claim a file was read when its bytes were never sent, and the stored
 *     summary asserts coverage it does not have.
 *
 * Both are pinned here. The Word/Excel case is the one that matters most:
 * those are ordinary client documents, the model cannot read their bytes, and
 * the honest answer is `analysed: false` rather than a silent omission.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/client-document-summaries-ai.test.ts
 */
import { describe, expect, it, beforeEach, vi, beforeAll } from 'vitest';

/**
 * Env the module sees. Deliberately returns undefined for anything a test has
 * not set: a catch-all default made "the operator has not configured a model"
 * indistinguishable from "the operator set it to the string 'test'", and the
 * unset case is the one that has to keep behaving like the old code.
 */
let envValues: Record<string, string | undefined> = {};

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: (name: string) => envValues[name] } });
});

/** Bytes returned for any storage path the test does not fail. */
const download = vi.fn();

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    storage: { from: () => ({ download: (path: string) => download(path) }) },
  }),
}));

const callResponses = vi.fn();
/** Model ids the fake OpenAI account serves; drives the preference probe. */
let servedModels: string[] = [];

vi.mock('../ai-model-config.ts', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../ai-model-config.ts');
  return {
    ...actual,
    callResponses: (...args: unknown[]) => callResponses(...args),
  };
});

const {
  buildSummaryInput,
  generateSummaryDraft,
  isReadableByModel,
  isFileRejection,
  wasTruncated,
  incompleteReason,
  mimeFromFileName,
  SummaryGenerationError,
  SUMMARY_MODEL_ENV,
  SUMMARY_MODEL_PREFERENCES,
} = await import('../client-document-summaries-ai.ts');
const { OPENAI_PRIMARY_MODEL, resetAvailableModelsCache, AiCallError } =
  await import('../ai-model-config.ts');

/**
 * A downloaded PDF of `sizeBytes`, whose CONTENT depends on `seed`.
 *
 * Two blobs of the same length are not the same file, and the summariser is
 * only allowed to collapse them when their bytes actually match — so the fake
 * has to be able to express "same size, different document".
 */
function pdfBlob(sizeBytes = 16, seed = 0) {
  const bytes = new Uint8Array(sizeBytes).fill(seed % 256);
  return { data: { arrayBuffer: async () => bytes.buffer }, error: null };
}

/** Distinct-but-stable content per storage path, so nothing dedupes by accident. */
function seedForPath(path: string): number {
  let seed = 0;
  for (const ch of path) seed = (seed * 31 + ch.charCodeAt(0)) % 251;
  return seed;
}

function doc(over: Record<string, unknown> = {}) {
  return {
    id: 'doc_1',
    title: 'Policy schedule',
    fileName: 'schedule.pdf',
    filePath: 'client-1/schedule.pdf',
    productCategory: 'Life',
    type: 'document',
    uploadDate: '2026-09-02T08:00:00.000Z',
    ...over,
  };
}

beforeEach(() => {
  envValues = { OPENAI_API_KEY: 'k' };
  servedModels = [];
  resetAvailableModelsCache();
  download.mockReset();
  download.mockImplementation(async (path: string) => pdfBlob(16, seedForPath(path)));
  callResponses.mockReset();
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    json: async () => ({ data: servedModels.map((id) => ({ id })) }),
  }));
});

/** The 400 OpenAI returns for a PDF it cannot parse. */
const FILE_REJECTION =
  'OpenAI request failed (400): { "error": { "message": "The uploaded file could not be ' +
  'processed. Please try again with a different file.", "type": "invalid_request_error" } }';

/** How many file blocks the Nth call to the model carried. */
function attachmentsOnCall(index: number): number {
  const [{ messages }] = callResponses.mock.calls[index] as [
    { messages: Array<{ content: unknown }> },
  ];
  const blocks = messages[1].content as Array<{ type: string }>;
  return blocks.filter((b) => b.type === 'file' || b.type === 'image').length;
}

/** A well-formed model reply, so a test can assert on the REQUEST instead. */
function respondOk() {
  callResponses.mockResolvedValue({
    text: JSON.stringify({
      headline: 'Filed',
      summary: 'Routine filing.',
      highlights: [],
      followUps: [],
    }),
    model: 'whatever-answered',
    raw: {},
  });
}

describe('file type recognition', () => {
  it('knows what the model can and cannot read', () => {
    expect(mimeFromFileName('a.pdf')).toBe('application/pdf');
    expect(mimeFromFileName('a.PNG')).toBe('image/png');
    expect(mimeFromFileName('a.docx')).toBe('application/octet-stream');
    expect(mimeFromFileName(undefined)).toBe('application/octet-stream');

    expect(isReadableByModel('application/pdf')).toBe(true);
    expect(isReadableByModel('image/jpeg')).toBe(true);
    expect(isReadableByModel('application/msword')).toBe(false);
  });
});

describe('building the model input', () => {
  it('attaches a PDF and marks it analysed', async () => {
    const { blocks, analysed } = await buildSummaryInput([doc()]);

    expect(analysed[0].analysed).toBe(true);
    expect(blocks.filter((b) => b.type === 'file')).toHaveLength(1);
  });

  it('sends an image as an image block, not a file block', async () => {
    const { blocks } = await buildSummaryInput([doc({ fileName: 'card.png' })]);

    expect(blocks.filter((b) => b.type === 'image')).toHaveLength(1);
    expect(blocks.filter((b) => b.type === 'file')).toHaveLength(0);
  });

  it('describes a Word document without pretending to have read it', async () => {
    const { blocks, analysed } = await buildSummaryInput([doc({ fileName: 'advice-record.docx' })]);

    expect(analysed[0].analysed).toBe(false);
    expect(blocks.filter((b) => b.type === 'file')).toHaveLength(0);
    expect(download).not.toHaveBeenCalled();
    // It still reaches the model as metadata — a summary that silently omitted
    // a document would be describing a batch it did not cover.
    const manifest = blocks.find((b) => b.type === 'text');
    expect(manifest && 'text' in manifest ? manifest.text : '').toContain('advice-record.docx');
  });

  it('never downloads a link', async () => {
    const { analysed } = await buildSummaryInput([
      doc({ type: 'link', fileName: undefined, filePath: undefined, url: 'https://x.co' }),
    ]);

    expect(analysed[0].analysed).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });

  it('caps how many files it attaches', async () => {
    const documents = Array.from({ length: 10 }, (_, i) =>
      doc({ id: `doc_${i}`, filePath: `client-1/${i}.pdf` }),
    );

    const { blocks, analysed } = await buildSummaryInput(documents);

    expect(blocks.filter((b) => b.type === 'file')).toHaveLength(6);
    expect(analysed.filter((a) => a.analysed)).toHaveLength(6);
    // The four beyond the cap are still listed, marked unread.
    expect(analysed).toHaveLength(10);
  });

  it('stops attaching once the byte budget is spent', async () => {
    download.mockResolvedValue(pdfBlob(5 * 1024 * 1024));
    const documents = Array.from({ length: 4 }, (_, i) =>
      doc({ id: `doc_${i}`, filePath: `client-1/${i}.pdf` }),
    );

    const { blocks } = await buildSummaryInput(documents);

    // 8MB budget: the first 5MB file fits, the second does not.
    expect(blocks.filter((b) => b.type === 'file')).toHaveLength(1);
  });

  it('treats an unavailable file as unread rather than failing the batch', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'Object not found' } });

    const { blocks, analysed } = await buildSummaryInput([doc()]);

    expect(analysed[0].analysed).toBe(false);
    expect(blocks.filter((b) => b.type === 'file')).toHaveLength(0);
  });
});

describe('parsing the model response', () => {
  it('returns a draft and records which model answered', async () => {
    callResponses.mockResolvedValue({
      text: JSON.stringify({
        headline: 'Life cover issued',
        summary: 'A policy was issued.',
        highlights: ['R2 000 000 cover'],
        followUps: [],
      }),
      model: 'gpt-4o',
      raw: {},
    });

    const draft = await generateSummaryDraft([doc()]);

    expect(draft.headline).toBe('Life cover issued');
    expect(draft.model).toBe('gpt-4o');
    expect(draft.documents[0].analysed).toBe(true);
  });

  it('rejects an empty summary rather than storing a blank timeline entry', async () => {
    callResponses.mockResolvedValue({
      text: JSON.stringify({ headline: '', summary: '', highlights: [], followUps: [] }),
      model: 'gpt-4o',
      raw: {},
    });

    await expect(generateSummaryDraft([doc()])).rejects.toThrow(/empty/i);
  });

  it('rejects a non-JSON response with a message that says so', async () => {
    callResponses.mockResolvedValue({ text: 'I cannot help with that.', model: 'gpt-4o', raw: {} });

    await expect(generateSummaryDraft([doc()])).rejects.toThrow(/could not be parsed/i);
  });

  it('drops empty strings out of the bullet lists', async () => {
    callResponses.mockResolvedValue({
      text: JSON.stringify({
        headline: 'Filed',
        summary: 'Routine filing.',
        highlights: ['kept', '   ', ''],
        followUps: null,
      }),
      model: 'gpt-4o',
      raw: {},
    });

    const draft = await generateSummaryDraft([doc()]);

    expect(draft.highlights).toEqual(['kept']);
    expect(draft.followUps).toEqual([]);
  });
});

describe('which model it asks for', () => {
  it('uses OPENAI_SUMMARY_MODEL verbatim when the operator has pinned one', async () => {
    // An explicit setting is a decision; it must not be second-guessed against
    // the preference ranking.
    envValues[SUMMARY_MODEL_ENV] = 'operator-choice';
    servedModels = SUMMARY_MODEL_PREFERENCES.slice();
    respondOk();

    await generateSummaryDraft([doc()]);

    expect(callResponses).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'operator-choice' }),
    );
  });

  it('picks the highest-ranked preference the account serves', async () => {
    // Only the LAST preference is available, so a resolver that just took the
    // first entry would ask for a model this account cannot serve.
    const last = SUMMARY_MODEL_PREFERENCES[SUMMARY_MODEL_PREFERENCES.length - 1];
    servedModels = ['gpt-4o', last];
    respondOk();

    await generateSummaryDraft([doc()]);

    expect(callResponses).toHaveBeenCalledWith(expect.objectContaining({ model: last }));
  });

  it('stays on the shared default when the account serves none of them', async () => {
    // The worst case of a stale preference list is a no-op, not a regression.
    servedModels = ['whisper-1', 'text-embedding-3-small'];
    respondOk();

    await generateSummaryDraft([doc()]);

    const { model } = callResponses.mock.calls[0][0] as { model: string };
    expect(model).toBe(OPENAI_PRIMARY_MODEL);
  });

  it('records the model that ANSWERED, not the one requested', async () => {
    // callResponses falls back to Chat Completions on OPENAI_FALLBACK_MODEL
    // when the primary call fails, so the two can differ. The stored record has
    // to carry the truth — otherwise a silently-degraded run looks like a
    // successful adoption of the new model.
    envValues[SUMMARY_MODEL_ENV] = 'a-model-this-account-cannot-serve';
    callResponses.mockResolvedValue({
      text: JSON.stringify({
        headline: 'Filed',
        summary: 'Routine filing.',
        highlights: [],
        followUps: [],
      }),
      model: 'gpt-4o',
      raw: {},
    });

    const draft = await generateSummaryDraft([doc()]);

    expect(draft.model).toBe('gpt-4o');
  });
});

describe('the same file filed twice', () => {
  it('sends duplicate content once but still counts both as analysed', async () => {
    // A real client pack is three PDFs each uploaded twice — 9.4MB of which half
    // is a copy. Sending both wastes the byte budget and makes it likelier the
    // request trips a provider limit, but the twin's contents DID reach the
    // model, so calling it unread would be its own lie.
    respondOk();
    download.mockImplementation(async () => pdfBlob(2326161, 7));
    const twins = [
      doc({ id: 'a', fileName: 'overview.pdf', filePath: 'c/1.pdf' }),
      doc({ id: 'b', fileName: 'overview.pdf', filePath: 'c/2.pdf' }),
    ];

    const { analysed, attached } = await buildSummaryInput(twins);

    expect(attached).toHaveLength(1);
    expect(analysed.map((a) => a.analysed)).toEqual([true, true]);
  });

  it('collapses identical bytes even when the two are filed under different names', async () => {
    respondOk();
    download.mockImplementation(async () => pdfBlob(1024, 3));

    const { attached } = await buildSummaryInput([
      doc({ id: 'a', fileName: 'quote.pdf', filePath: 'c/1.pdf' }),
      doc({ id: 'b', fileName: 'quote-signed-copy.pdf', filePath: 'c/2.pdf' }),
    ]);

    expect(attached).toHaveLength(1);
  });

  it('does NOT collapse two different documents that share a name and a size', async () => {
    // The dangerous direction. A pack is assembled from files picked out of
    // different folders, so `quote.pdf` at 363,553 bytes really can be two
    // unrelated documents. Merging them on name and length would drop a real
    // financial document from the request while the stored record still claimed
    // the model had read it.
    download.mockImplementation(async (path: string) =>
      pdfBlob(363553, path.includes('1') ? 11 : 200),
    );

    const { attached, analysed } = await buildSummaryInput([
      doc({ id: 'a', fileName: 'quote.pdf', filePath: 'c/1.pdf' }),
      doc({ id: 'b', fileName: 'quote.pdf', filePath: 'c/2.pdf' }),
    ]);

    expect(attached.map((a) => a.id)).toEqual(['a', 'b']);
    expect(analysed.every((a) => a.analysed)).toBe(true);
  });

  it('lets a copy through the byte budget the original already paid for', async () => {
    // The duplicate costs nothing to attach — it is not attached — so it must
    // not be turned away as over budget and reported unread.
    download.mockImplementation(async () => pdfBlob(5_000_000, 9));

    const { attached, analysed } = await buildSummaryInput([
      doc({ id: 'a', fileName: 'big.pdf', filePath: 'c/1.pdf' }),
      doc({ id: 'b', fileName: 'big.pdf', filePath: 'c/2.pdf' }),
    ]);

    expect(attached).toHaveLength(1);
    expect(analysed.map((a) => a.analysed)).toEqual([true, true]);
  });
});

describe('a file the provider will not read', () => {
  it('retries without the largest attachment rather than losing the batch', async () => {
    // Before this, one unparseable PDF meant the client got no timeline entry
    // at all for that pack.
    download.mockImplementation(async (path: string) =>
      pdfBlob(path.includes('big') ? 5_000_000 : 1000),
    );
    callResponses.mockRejectedValueOnce(new Error(FILE_REJECTION));
    respondOk();

    const draft = await generateSummaryDraft([
      doc({ id: 'small', filePath: 'c/small.pdf', fileName: 'small.pdf', fileSize: 1000 }),
      doc({ id: 'big', filePath: 'c/big.pdf', fileName: 'big.pdf', fileSize: 5_000_000 }),
    ]);

    expect(callResponses).toHaveBeenCalledTimes(2);
    expect(attachmentsOnCall(0)).toBe(2);
    expect(attachmentsOnCall(1)).toBe(1);
    // The dropped one is reported unread; the survivor is not.
    expect(draft.documents.find((d) => d.id === 'big')?.analysed).toBe(false);
    expect(draft.documents.find((d) => d.id === 'small')?.analysed).toBe(true);
  });

  it('falls back to a metadata-only summary rather than none at all', async () => {
    callResponses
      .mockRejectedValueOnce(new Error(FILE_REJECTION))
      .mockRejectedValueOnce(new Error(FILE_REJECTION));
    respondOk();

    const draft = await generateSummaryDraft([
      doc({ id: 'a', filePath: 'c/a.pdf', fileName: 'a.pdf', fileSize: 10 }),
      doc({ id: 'b', filePath: 'c/b.pdf', fileName: 'b.pdf', fileSize: 20 }),
    ]);

    expect(callResponses).toHaveBeenCalledTimes(3);
    expect(attachmentsOnCall(2)).toBe(0);
    expect(draft.documents.every((d) => !d.analysed)).toBe(true);
  });

  it('gives up after three attempts, carrying the analysis and model', async () => {
    callResponses.mockRejectedValue(new Error(FILE_REJECTION));

    const error = await generateSummaryDraft([
      doc({ id: 'a', filePath: 'c/a.pdf', fileName: 'a.pdf', fileSize: 10 }),
      doc({ id: 'b', filePath: 'c/b.pdf', fileName: 'b.pdf', fileSize: 20 }),
    ]).catch((e) => e);

    expect(callResponses).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(SummaryGenerationError);
    expect(error.documents).toHaveLength(2);
    expect(error.model).toBeTruthy();
  });

  it('does NOT retry a failure that sending less cannot fix', async () => {
    // A rate limit or an auth error is not answered by dropping a file; paying
    // to fail twice more would just be slower.
    callResponses.mockRejectedValue(new Error('OpenAI API rate limit exceeded.'));

    await expect(generateSummaryDraft([doc()])).rejects.toThrow(/rate limit/i);
    expect(callResponses).toHaveBeenCalledTimes(1);
  });

  it('recognises a file rejection without mistaking other errors for one', () => {
    expect(isFileRejection(new Error(FILE_REJECTION))).toBe(true);
    expect(isFileRejection(new Error('OpenAI API rate limit exceeded.'))).toBe(false);
    expect(isFileRejection(new Error('OpenAI request failed (401)'))).toBe(false);
  });
});

describe('a reply that stopped short', () => {
  it('says the reply was truncated instead of surfacing a JSON parser message', async () => {
    // What this actually looked like in production: "Unterminated string in JSON
    // at position 342" — a parser message that tells the reader nothing.
    callResponses.mockResolvedValue({
      text: '{"headline":"Filed","summary":"The client',
      model: 'gpt-4o',
      raw: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } },
    });

    await expect(generateSummaryDraft([doc()])).rejects.toThrow(/cut off/i);
  });

  it('does not blame the output budget for an incomplete reply that stopped for another reason', async () => {
    // Telling an adviser to raise a limit that was never the problem sends them
    // looking in the wrong place, and no budget makes a filtered reply finish.
    callResponses.mockResolvedValue({
      text: '{"headline":"Filed"',
      model: 'gpt-4o',
      raw: { status: 'incomplete', incomplete_details: { reason: 'content_filter' } },
    });

    const error = await generateSummaryDraft([doc()]).catch((e) => e);

    expect(error.message).toMatch(/content_filter/);
    expect(error.message).not.toMatch(/budget/i);
  });

  it('reads the stop reason off either API shape', () => {
    expect(incompleteReason({ incomplete_details: { reason: 'max_output_tokens' } })).toBe(
      'max_output_tokens',
    );
    expect(incompleteReason({ choices: [{ finish_reason: 'length' }] })).toBe('max_output_tokens');
    expect(incompleteReason({ choices: [{ finish_reason: 'content_filter' }] })).toBe(
      'content_filter',
    );
    // Stopped short without saying why is still unfinished, so still fatal.
    expect(incompleteReason({ status: 'incomplete' })).toBe('unspecified');
    expect(incompleteReason({ choices: [{ finish_reason: 'stop' }] })).toBeNull();
    expect(incompleteReason({ status: 'completed' })).toBeNull();
    expect(incompleteReason(null)).toBeNull();
  });

  it('counts only the output limit as truncation', () => {
    expect(wasTruncated({ incomplete_details: { reason: 'max_output_tokens' } })).toBe(true);
    expect(wasTruncated({ choices: [{ finish_reason: 'length' }] })).toBe(true);
    // A filtered or otherwise-incomplete reply is a different problem with a
    // different answer, so it must not be reported as a budget shortfall.
    expect(wasTruncated({ incomplete_details: { reason: 'content_filter' } })).toBe(false);
    expect(wasTruncated({ status: 'incomplete' })).toBe(false);
    expect(wasTruncated({ choices: [{ finish_reason: 'stop' }] })).toBe(false);
    expect(wasTruncated(null)).toBe(false);
  });
});

describe('which model the failure is filed against', () => {
  it('records the model that actually served the failed request', async () => {
    // `callResponses` retries the fallback model on its own. Recording the model
    // that was ASKED for names a model that never saw this batch, which is worse
    // than recording nothing.
    envValues.OPENAI_SUMMARY_MODEL = 'gpt-5-mini';
    callResponses.mockRejectedValue(new AiCallError('OpenAI returned empty content', 'gpt-4o'));

    const error = await generateSummaryDraft([doc()]).catch((e) => e);

    expect(error).toBeInstanceOf(SummaryGenerationError);
    expect(error.model).toBe('gpt-4o');
  });

  it('records the answering model when the call succeeded but its reply was unusable', async () => {
    envValues.OPENAI_SUMMARY_MODEL = 'gpt-5-mini';
    callResponses.mockResolvedValue({
      text: 'I cannot help with that.',
      model: 'gpt-4o',
      raw: {},
    });

    const error = await generateSummaryDraft([doc()]).catch((e) => e);

    expect(error.model).toBe('gpt-4o');
  });

  it('falls back to the requested model when nothing came back at all', async () => {
    envValues.OPENAI_SUMMARY_MODEL = 'gpt-5-mini';
    callResponses.mockRejectedValue(new Error('network down'));

    const error = await generateSummaryDraft([doc()]).catch((e) => e);

    expect(error.model).toBe('gpt-5-mini');
  });
});
