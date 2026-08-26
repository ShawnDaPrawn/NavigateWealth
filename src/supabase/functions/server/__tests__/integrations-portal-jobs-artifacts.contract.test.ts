/**
 * integrations-portal-jobs-routes.ts — Discovery Reports, Live View & Staging
 * ==========================================================================
 *
 * What the worker sends back, and what the app does with it. Every value here
 * arrives from a headless browser walking someone else's DOM, so the contract is
 * mostly about bounds:
 *
 *   - **Discovery reports** carry selector candidates, table summaries and
 *     warnings straight off the page. Each list and each string is capped, since
 *     a page with thousands of inputs would otherwise write an unbounded row
 *     into KV. The `purpose` and `confidence` allowlists collapse anything
 *     unexpected to a safe default, and only the exact string `dry-run` means
 *     dry run — a mistyped mode must not let a live run report as a rehearsal.
 *   - **Live view** is a screenshot upload; the two 400s (unparseable multipart
 *     vs. a form with no file) name different problems and are not
 *     interchangeable.
 *   - **Staging** writes extracted values onto client policy records, so it
 *     refuses to run without a saved field mapping rather than guessing at a
 *     target column.
 *   - **Item retry** must clear the previous attempt completely; a retry that
 *     kept the old error shows a failure next to a queued status and the
 *     operator cannot tell whether the retry ran.
 *
 * Shares `helpers/portal-jobs-harness.ts` with the other portal-job suites.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import {
  alignFileGlobal,
  kvStore,
  multipart,
  request,
  type RequestOptions,
} from './helpers/contract-harness.ts';
import {
  CATEGORY,
  CLIENT,
  JOB,
  PROVIDER,
  resetPortalJobMocks,
  runtime,
  screenshot,
  seedCreatePrerequisites,
  seedJob,
  seedMappingConfig,
} from './helpers/portal-jobs-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (k: string) => (k === 'NW_PORTAL_WORKER_SECRET' ? 'worker-secret' : 'test') },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

/**
 * `normaliseRunMode` is pure and belongs to the contract under test, so the
 * real one is kept; only the GitHub Actions dispatch and the storage upload are
 * replaced.
 */
vi.mock('../integrations-portal-runtime.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const { runtime: rt } = await import('./helpers/portal-jobs-harness.ts');
  return {
    ...actual,
    dispatchPortalGitHubAction: rt.dispatch,
    uploadPortalLiveView: rt.uploadLiveView,
  };
});

/** Role-aware `requireAdmin`, mirroring the shipped 401/403 split. */
vi.mock('../auth-mw.ts', async () => ({
  requireAdmin: (await import('./helpers/contract-harness.ts')).makeRoleGate(
    ['admin', 'super_admin', 'super-admin'],
    'FORBIDDEN',
  ),
}));

const app = (await import('../integrations-portal-jobs-routes.ts')).default;

/** See `contract-harness.ts` for why the `File` global has to be realigned. */
beforeAll(async () => {
  await alignFileGlobal();
});

const req = (path: string, opts: RequestOptions = {}) =>
  request(app, path, { as: 'admin', ...opts });

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  resetPortalJobMocks();
});

// ============================================================================
// DISCOVERY REPORT — everything in it comes from the worker
// ============================================================================

const REPORT_PATH = `/portal-jobs/${JOB}/discovery-report`;

const candidate = (over: Record<string, unknown> = {}) => ({
  purpose: 'input',
  selector: 'input#policy',
  tag: 'input',
  type: 'text',
  role: 'textbox',
  label: 'Policy number',
  confidence: 'high',
  notes: 'first field on the page',
  ...over,
});

describe('discovery report', () => {
  it('saves a discovery report and moves the job to discovery_ready', async () => {
    seedJob();
    const res = await req(REPORT_PATH, {
      method: 'POST',
      body: {
        urlHost: 'portal.allangray.co.za',
        title: 'Policies',
        summary: {
          inputCount: 4,
          buttonCount: 2,
          linkCount: 9,
          tableCount: 1,
          candidatePolicyTables: 1,
        },
        selectorCandidates: [candidate()],
        tableSummaries: [
          { selector: 'table#policies', headerTexts: ['Policy', 'Premium'], rowCount: 12 },
        ],
        warnings: ['two tables looked like policy tables'],
      },
    });
    expect(res.status).toBe(200);
    const { job, report } = await res.json();
    expect(job).toMatchObject({
      status: 'discovery_ready',
      currentStep: 'discovery_ready',
      discoveryReportId: report.id,
    });
    expect(report).toMatchObject({
      jobId: JOB,
      providerId: PROVIDER,
      categoryId: CATEGORY,
      mode: 'discover',
    });
    expect(kvStore.get(`portal-discovery-report:${report.id}`)).toBeTruthy();
    expect(kvStore.get(`portal-discovery-report:latest:${JOB}`)).toMatchObject({
      reportId: report.id,
    });
  });

  it('moves the job to dry_run_ready for a dry run and says nothing was written', async () => {
    seedJob();
    const res = await req(REPORT_PATH, {
      method: 'POST',
      body: { mode: 'dry-run', summary: { extractedRowCount: 14 } },
    });
    const { job } = await res.json();
    expect(job).toMatchObject({
      status: 'dry_run_ready',
      currentStep: 'dry_run_ready',
      extractedRows: 14,
    });
    // A dry run must be unmistakable in the UI — an admin reading "completed"
    // would believe policies had been updated.
    expect(job.message).toContain('no policies were updated');
    expect(job.message).toContain('14 rows');
  });

  it.each([
    ['discover', 'discover'],
    ['dry_run', 'discover'],
    ['DRY-RUN', 'discover'],
    ['', 'discover'],
    ['dry-run', 'dry-run'],
  ])('treats a mode of %p as %s', async (mode, expected) => {
    // Only the exact string 'dry-run' means dry run. Anything else is a real
    // discovery pass, which is the safe default: a mistyped mode must not make
    // a live run silently report as a dry run.
    seedJob();
    const res = await req(REPORT_PATH, { method: 'POST', body: { mode } });
    expect((await res.json()).report.mode).toBe(expected);
  });

  it('keeps the job extractedRows when the report does not carry a count', async () => {
    seedJob(JOB, { extractedRows: 9 });
    const res = await req(REPORT_PATH, { method: 'POST', body: {} });
    expect((await res.json()).job.extractedRows).toBe(9);
  });

  it.each([
    ['urlHost', 'urlHost', 200],
    ['title', 'title', 200],
  ])('truncates %s to %i characters', async (_label, field, max) => {
    seedJob();
    const res = await req(REPORT_PATH, {
      method: 'POST',
      body: { [field]: 'x'.repeat(max + 500) },
    });
    expect((await res.json()).report[field]).toHaveLength(max);
  });

  it('caps the selector candidate list at 200', async () => {
    // The worker walks the DOM; a page with thousands of inputs would
    // otherwise write an unbounded row into KV.
    seedJob();
    const res = await req(REPORT_PATH, {
      method: 'POST',
      body: { selectorCandidates: Array.from({ length: 500 }, () => candidate()) },
    });
    expect((await res.json()).report.selectorCandidates).toHaveLength(200);
  });

  it.each([
    ['selector', 'selector', 500],
    ['tag', 'tag', 40],
    ['type', 'type', 80],
    ['role', 'role', 80],
    ['label', 'label', 120],
    ['notes', 'notes', 300],
  ])('truncates a candidate %s to %i characters', async (_label, field, max) => {
    seedJob();
    const res = await req(REPORT_PATH, {
      method: 'POST',
      body: { selectorCandidates: [candidate({ [field]: 'y'.repeat(max + 200) })] },
    });
    expect((await res.json()).report.selectorCandidates[0][field]).toHaveLength(max);
  });

  it.each(['input', 'button', 'link', 'table', 'policy_row', 'field'])(
    'keeps the %s purpose',
    async (purpose) => {
      seedJob();
      const res = await req(REPORT_PATH, {
        method: 'POST',
        body: { selectorCandidates: [candidate({ purpose })] },
      });
      expect((await res.json()).report.selectorCandidates[0].purpose).toBe(purpose);
    },
  );

  it.each(['iframe', 'script', '', 'INPUT', null, 42])(
    'falls back to the field purpose for %p',
    async (purpose) => {
      seedJob();
      const res = await req(REPORT_PATH, {
        method: 'POST',
        body: { selectorCandidates: [candidate({ purpose })] },
      });
      expect((await res.json()).report.selectorCandidates[0].purpose).toBe('field');
    },
  );

  it.each(['low', 'medium', 'high'])('keeps the %s confidence', async (confidence) => {
    seedJob();
    const res = await req(REPORT_PATH, {
      method: 'POST',
      body: { selectorCandidates: [candidate({ confidence })] },
    });
    expect((await res.json()).report.selectorCandidates[0].confidence).toBe(confidence);
  });

  it.each(['certain', 'HIGH', '', null])(
    'falls back to low confidence for %p',
    async (confidence) => {
      seedJob();
      const res = await req(REPORT_PATH, {
        method: 'POST',
        body: { selectorCandidates: [candidate({ confidence })] },
      });
      expect((await res.json()).report.selectorCandidates[0].confidence).toBe('low');
    },
  );

  it('caps table summaries at 50, headers at 30 and warnings at 50', async () => {
    seedJob();
    const res = await req(REPORT_PATH, {
      method: 'POST',
      body: {
        tableSummaries: Array.from({ length: 80 }, () => ({
          selector: 'table',
          headerTexts: Array.from({ length: 60 }, (_, i) => `h${i}`),
          rowCount: 1,
        })),
        warnings: Array.from({ length: 90 }, (_, i) => `w${i}`),
      },
    });
    const { report } = await res.json();
    expect(report.tableSummaries).toHaveLength(50);
    expect(report.tableSummaries[0].headerTexts).toHaveLength(30);
    expect(report.warnings).toHaveLength(50);
  });

  it.each([
    ['selectorCandidates', 'selectorCandidates'],
    ['tableSummaries', 'tableSummaries'],
    ['warnings', 'warnings'],
  ])('defaults %s to an empty array when it is not one', async (_label, field) => {
    seedJob();
    const res = await req(REPORT_PATH, { method: 'POST', body: { [field]: 'not an array' } });
    expect((await res.json()).report[field]).toEqual([]);
  });

  it('turns a nullish summary count into zero and a non-numeric one into null', async () => {
    // `Number(value || 0)` handles the two cases differently and the
    // difference is easy to misread: `null` is falsy so it takes the `|| 0`
    // and lands on 0, while the truthy string 'lots' survives to `Number()`
    // and becomes NaN — which serialises to `null` over JSON. Pinned as it
    // behaves rather than as it reads, so a future tightening to `Number(v) ||
    // 0` is a visible change rather than a silent one.
    seedJob();
    const res = await req(REPORT_PATH, {
      method: 'POST',
      body: { summary: { inputCount: 'lots', tableCount: null, linkCount: 7 } },
    });
    const { summary } = (await res.json()).report;
    expect(summary.tableCount).toBe(0);
    expect(summary.linkCount).toBe(7);
    expect(summary.inputCount).toBeNull();
  });

  it('returns 404 for a job that does not exist', async () => {
    const res = await req('/portal-jobs/nope/discovery-report', { method: 'POST', body: {} });
    expect(res.status).toBe(404);
  });

  it('reads back the latest report for a job', async () => {
    seedJob();
    const saved = await (
      await req(REPORT_PATH, { method: 'POST', body: { urlHost: 'a.example' } })
    ).json();
    const res = await req(REPORT_PATH);
    expect(res.status).toBe(200);
    expect((await res.json()).report.id).toBe(saved.report.id);
  });

  it('returns the newest report when several have been saved', async () => {
    seedJob();
    await req(REPORT_PATH, { method: 'POST', body: { urlHost: 'first.example' } });
    const second = await (
      await req(REPORT_PATH, { method: 'POST', body: { urlHost: 'second.example' } })
    ).json();
    const res = await req(REPORT_PATH);
    expect((await res.json()).report.id).toBe(second.report.id);
  });

  it('reports no report rather than 404 when none was saved', async () => {
    seedJob();
    const res = await req(REPORT_PATH);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, report: null });
  });
});
// ============================================================================
// LIVE VIEW, STAGE, RETRY
// ============================================================================

describe('live view', () => {
  it('stores the screenshot against the job and refreshes the latest pointer', async () => {
    seedJob();
    const res = await req(`/portal-jobs/${JOB}/live-view`, { method: 'POST', form: screenshot() });
    expect(res.status).toBe(200);
    expect(runtime.uploadLiveView).toHaveBeenCalledTimes(1);
    const [, file, meta] = runtime.uploadLiveView.mock.calls[0];
    expect(file.name).toBe('shot.png');
    expect(meta).toMatchObject({ pageUrl: 'https://portal.example/policies' });
    expect((await res.json()).job.liveView).toMatchObject({ url: 'https://storage/shot.png' });
    expect(kvStore.get(`portal-job:latest:${PROVIDER}:${CATEGORY}`)).toMatchObject({ jobId: JOB });
  });

  it('explains itself when a multipart body is truncated or corrupt', async () => {
    // The realistic failure: the worker's upload is cut off mid-stream, so the
    // Content-Type promises multipart and the body cannot be parsed as it.
    // That is the only input that makes `parseBody` throw.
    seedJob();
    const res = await app.request(`/portal-jobs/${JOB}/live-view`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer t',
        'Content-Type': 'multipart/form-data; boundary=----portaljobs',
      },
      body: 'truncated before the first boundary',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Expected multipart/form-data');
    expect(runtime.uploadLiveView).not.toHaveBeenCalled();
  });

  it('treats a non-multipart body as a form with no file', async () => {
    // `parseBody` does NOT throw for a JSON or plain-text body — it returns an
    // empty record — so this lands on the missing-file 400 rather than the
    // parse-error one. Both are 400s, but only one names the real problem, and
    // pinning which is which stops the two branches being "simplified" into
    // one on the assumption they are interchangeable.
    seedJob();
    const res = await req(`/portal-jobs/${JOB}/live-view`, { method: 'POST', raw: 'plain text' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('No screenshot file provided');
  });

  it('refuses a form with no screenshot', async () => {
    seedJob();
    const res = await req(`/portal-jobs/${JOB}/live-view`, {
      method: 'POST',
      form: multipart([{ name: 'pageUrl', value: 'https://portal.example' }]),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('No screenshot file provided');
  });

  it('returns 404 for a job that does not exist', async () => {
    const res = await req('/portal-jobs/nope/live-view', { method: 'POST', form: screenshot() });
    expect(res.status).toBe(404);
    expect(runtime.uploadLiveView).not.toHaveBeenCalled();
  });

  it('reports an upload failure as a 500', async () => {
    seedJob();
    runtime.uploadLiveView.mockRejectedValue(new Error('bucket missing'));
    const res = await req(`/portal-jobs/${JOB}/live-view`, { method: 'POST', form: screenshot() });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('bucket missing');
  });
});

describe('staging', () => {
  it('refuses to stage with no rows', async () => {
    seedJob();
    const res = await req(`/portal-jobs/${JOB}/stage`, { method: 'POST', body: { rows: [] } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('No extracted rows supplied');
  });

  it.each([
    ['a missing rows field', {}],
    ['rows as an object', { rows: { a: 1 } }],
    ['rows as a string', { rows: 'AG-1' }],
  ])('refuses %s', async (_label, body) => {
    seedJob();
    const res = await req(`/portal-jobs/${JOB}/stage`, { method: 'POST', body });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a job that does not exist', async () => {
    const res = await req('/portal-jobs/nope/stage', { method: 'POST', body: { rows: [{}] } });
    expect(res.status).toBe(404);
  });

  it('refuses to stage against a provider that no longer exists', async () => {
    seedJob();
    const res = await req(`/portal-jobs/${JOB}/stage`, { method: 'POST', body: { rows: [{}] } });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('Invalid provider ID');
  });

  it('refuses to stage without a saved field mapping', async () => {
    // Staging writes extracted values onto client policy records. With no
    // mapping there is no defined target field, and guessing would put a
    // premium into whatever column happened to sort first.
    seedCreatePrerequisites();
    seedJob();
    const res = await req(`/portal-jobs/${JOB}/stage`, {
      method: 'POST',
      body: { rows: [{ policy_number: 'AG-12345' }] },
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('No mapping configuration found');
  });

  it('stages extracted rows into a sync run and records it on the job', async () => {
    seedCreatePrerequisites();
    seedMappingConfig();
    seedJob();
    const res = await req(`/portal-jobs/${JOB}/stage`, {
      method: 'POST',
      body: { rows: [{ policy_number: 'AG-12345', premium: 1200 }] },
    });
    expect(res.status).toBe(200);
    const { job, stagedRun } = await res.json();
    expect(stagedRun).toMatchObject({ providerId: PROVIDER });
    expect(job.stagedRunId).toBe(stagedRun.id);
  });
});

describe('item retry', () => {
  const RETRY = (itemId = 'item-1') => `/portal-jobs/${JOB}/items/${itemId}/retry`;

  const failedItem = (over: Record<string, unknown> = {}) => ({
    id: 'item-1',
    jobId: JOB,
    providerId: PROVIDER,
    categoryId: CATEGORY,
    clientId: CLIENT,
    clientName: 'Thabo Mokoena',
    policyId: 'pol-1',
    policyNumber: 'AG-12345',
    normalizedPolicyNumber: 'AG12345',
    status: 'failed',
    currentStep: 'login',
    message: 'Login failed',
    error: 'Bad credentials',
    warning: 'slow page',
    warnings: ['slow page'],
    workerId: 'worker-7',
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:05:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:05:00.000Z',
    ...over,
  });

  it('clears the previous attempt entirely', async () => {
    seedJob(JOB, { status: 'failed' });
    kvStore.set(`portal-job-items:${JOB}`, [failedItem()]);
    const res = await req(RETRY(), { method: 'POST', body: {} });
    expect(res.status).toBe(200);
    const { item } = await res.json();
    expect(item).toMatchObject({
      status: 'queued',
      currentStep: 'queued',
      message: 'Queued for retry.',
    });
    // A retry that kept the previous error would show the old failure next to
    // a queued status — the operator cannot tell whether the retry ran.
    for (const field of ['error', 'warning', 'workerId', 'startedAt', 'completedAt']) {
      expect(item[field]).toBeUndefined();
    }
    expect(item.warnings).toEqual([]);
  });

  it.each(['staged', 'failed', 'cancelled'])('reopens a %s job back to queued', async (status) => {
    seedJob(JOB, { status });
    kvStore.set(`portal-job-items:${JOB}`, [failedItem()]);
    const { job } = await (await req(RETRY(), { method: 'POST', body: {} })).json();
    expect(job.status).toBe('queued');
  });

  it.each(['running', 'extracting', 'waiting_for_otp'])(
    'leaves an in-flight %s job on its current status',
    async (status) => {
      // Forcing a running job back to queued would make the worker's next
      // status write look like a regression and could double-dispatch it.
      seedJob(JOB, { status });
      kvStore.set(`portal-job-items:${JOB}`, [failedItem()]);
      const { job } = await (await req(RETRY(), { method: 'POST', body: {} })).json();
      expect(job.status).toBe(status);
    },
  );

  it('names the client and policy it re-queued', async () => {
    seedJob(JOB, { status: 'failed' });
    kvStore.set(`portal-job-items:${JOB}`, [failedItem()]);
    const { job } = await (await req(RETRY(), { method: 'POST', body: {} })).json();
    expect(job.message).toBe('Queued Thabo Mokoena / AG-12345 for retry.');
    expect(job.currentStep).toBe('retry_queued');
  });

  it('leaves the other items in the queue untouched', async () => {
    seedJob(JOB, { status: 'failed' });
    kvStore.set(`portal-job-items:${JOB}`, [
      failedItem(),
      failedItem({ id: 'item-2', status: 'completed', policyNumber: 'AG-99999' }),
    ]);
    const { items, summary } = await (await req(RETRY(), { method: 'POST', body: {} })).json();
    expect(items.map((i: { status: string }) => i.status)).toEqual(['queued', 'completed']);
    expect(summary).toMatchObject({ total: 2, queued: 1, completed: 1, failed: 0 });
  });

  it('returns 404 for an item that is not in the queue', async () => {
    seedJob();
    kvStore.set(`portal-job-items:${JOB}`, [failedItem()]);
    const res = await req(RETRY('ghost-item'), { method: 'POST', body: {} });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Portal job policy item not found');
  });

  it('returns 404 for a job that does not exist', async () => {
    const res = await req(`/portal-jobs/nope/items/item-1/retry`, { method: 'POST', body: {} });
    expect(res.status).toBe(404);
  });

  it('persists the re-queued item, not just returns it', async () => {
    seedJob(JOB, { status: 'failed' });
    kvStore.set(`portal-job-items:${JOB}`, [failedItem()]);
    await req(RETRY(), { method: 'POST', body: {} });
    const stored = kvStore.get(`portal-job-items:${JOB}`) as { status: string }[];
    expect(stored[0].status).toBe('queued');
  });
});
