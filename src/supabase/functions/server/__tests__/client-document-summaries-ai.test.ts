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
  mimeFromFileName,
  SUMMARY_MODEL_ENV,
} = await import('../client-document-summaries-ai.ts');
const { OPENAI_PRIMARY_MODEL } = await import('../ai-model-config.ts');

function pdfBlob(sizeBytes = 16) {
  return { data: { arrayBuffer: async () => new ArrayBuffer(sizeBytes) }, error: null };
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
  envValues = {};
  download.mockReset();
  download.mockResolvedValue(pdfBlob());
  callResponses.mockReset();
});

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
  it('uses OPENAI_SUMMARY_MODEL when the operator has set it', async () => {
    // The summariser can be moved to a newer model on its own, without
    // dragging policy extraction and the other nine callers of the global
    // OPENAI_MODEL along with it.
    envValues[SUMMARY_MODEL_ENV] = 'some-newer-model';
    respondOk();

    await generateSummaryDraft([doc()]);

    expect(callResponses).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'some-newer-model' }),
    );
  });

  it('asks for the shared default when the var is unset', async () => {
    respondOk();

    await generateSummaryDraft([doc()]);

    const { model } = callResponses.mock.calls[0][0] as { model: string };
    expect(model).toBe(OPENAI_PRIMARY_MODEL);
  });

  it('records the model that ANSWERED, not the one requested', async () => {
    // callResponses falls back to Chat Completions on OPENAI_FALLBACK_MODEL
    // when the primary call fails, so the two can differ. The stored record
    // has to carry the truth — otherwise a silently-degraded run looks like a
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
