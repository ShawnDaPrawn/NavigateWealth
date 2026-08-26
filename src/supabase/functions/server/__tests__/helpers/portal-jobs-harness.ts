/**
 * Fixtures and stubs shared by the integrations-portal-jobs route contract suites.
 * ==============================================================================
 *
 * The module under test drives the robot that logs into a product provider's
 * website AS THE FIRM, with the firm's stored username and password, and writes
 * what it finds back onto client policy records. 13 routes, split across four
 * suites by concern to stay inside the repo's 1000-line file budget:
 *
 *   integrations-portal-jobs-routes      the admin gate, route order, job scope
 *   integrations-portal-jobs-otp         the OTP relay and worker status writes
 *   integrations-portal-jobs-lifecycle   job creation, the latest pointer, history
 *   integrations-portal-jobs-artifacts   discovery reports, live view, staging, retry
 *
 * WHAT IS REAL, AND WHY: KV is in-memory but everything above it runs for real —
 * the guards, the flow resolution, the credential lookup, the sync engine's
 * queue building and row staging. Stubbing those would leave the interesting
 * logic (which policies get queued, what a staged run contains) untested while
 * the coverage number went up. Only `integrations-portal-runtime.ts` is mocked,
 * because its two functions are a GitHub Actions dispatch and a Supabase
 * storage upload.
 *
 * @module __tests__/helpers/portal-jobs-harness
 */
import { vi } from 'vitest';
import { kvStore, multipart } from './contract-harness.ts';

export const PROVIDER = 'allan-gray';
export const CATEGORY = 'risk_planning';
export const OTHER_PROVIDER = 'brightrock';
export const OTHER_CATEGORY = 'medical_aid';
export const JOB = 'job-1';
export const CLIENT = '11111111-2222-4333-8444-555555555555';

/** The two IO functions of `integrations-portal-runtime.ts`. */
export const runtime = {
  dispatch: vi.fn(),
  uploadLiveView: vi.fn(),
};

/** Roles that must not reach any portal-job route. */
export const FORBIDDEN_ROLES = ['adviser', 'paraplanner', 'compliance', 'client', 'worker'];

/** Roles the admin gate admits. */
export const ADMIN_ROLES = ['admin', 'super_admin', 'super-admin'];

export const ALLOWED_STATUSES = [
  'queued',
  'running',
  'waiting_for_otp',
  'discovering',
  'discovery_ready',
  'extracting',
  'dry_run_ready',
  'staging',
  'staged',
  'failed',
  'cancelled',
];

/** The statuses that stamp `completedAt`. */
export const TERMINAL_STATUSES = [
  'discovery_ready',
  'dry_run_ready',
  'staged',
  'failed',
  'cancelled',
];

export type Route = {
  name: string;
  method: string;
  path: string;
  body?: unknown;
  form?: boolean;
};

/**
 * Every route the module registers.
 *
 * Unlike a module that gates with `app.use('*', …)`, the gate here is applied
 * PER ROUTE (`app.post(path, requireAdmin, handler)`) — the shape where a route
 * added later can ship ungated, because nothing fails when the argument is left
 * out. So this table is exhaustive and its length is checked against the
 * router's own registrations.
 */
export const ROUTES: Route[] = [
  { name: 'create job', method: 'POST', path: '/portal-jobs', body: {} },
  { name: 'latest job', method: 'GET', path: '/portal-jobs/latest' },
  { name: 'job history', method: 'GET', path: '/portal-jobs/history' },
  { name: 'get job', method: 'GET', path: `/portal-jobs/${JOB}` },
  { name: 'job items', method: 'GET', path: `/portal-jobs/${JOB}/items` },
  { name: 'retry item', method: 'POST', path: `/portal-jobs/${JOB}/items/item-1/retry`, body: {} },
  { name: 'update status', method: 'POST', path: `/portal-jobs/${JOB}/status`, body: {} },
  { name: 'live view', method: 'POST', path: `/portal-jobs/${JOB}/live-view`, form: true },
  {
    name: 'save discovery report',
    method: 'POST',
    path: `/portal-jobs/${JOB}/discovery-report`,
    body: {},
  },
  { name: 'get discovery report', method: 'GET', path: `/portal-jobs/${JOB}/discovery-report` },
  { name: 'submit otp', method: 'POST', path: `/portal-jobs/${JOB}/otp`, body: { otp: '123456' } },
  { name: 'collect otp', method: 'GET', path: `/portal-jobs/${JOB}/otp` },
  { name: 'stage rows', method: 'POST', path: `/portal-jobs/${JOB}/stage`, body: { rows: [{}] } },
];

/** A multipart form carrying a live-view screenshot. */
export const screenshot = () =>
  multipart(
    [
      { name: 'file', value: 'PNGDATA', filename: 'shot.png', type: 'image/png' },
      { name: 'pageUrl', value: 'https://portal.example/policies' },
    ],
    '----portaljobs',
  );

/** Seeds a portal job and returns it. */
export function seedJob(id = JOB, over: Record<string, unknown> = {}) {
  const now = '2026-01-01T00:00:00.000Z';
  const job = {
    id,
    providerId: PROVIDER,
    providerName: 'Allan Gray',
    categoryId: CATEGORY,
    status: 'running',
    runMode: 'live',
    automationHost: 'github_actions',
    flowId: 'flow-1',
    credentialProfileId: 'allan-gray-env',
    createdAt: now,
    updatedAt: now,
    currentStep: 'running',
    message: 'Working',
    ...over,
  };
  kvStore.set(`portal-job:${id}`, job);
  return job;
}

export function seedLatestPointer(id = JOB, providerId = PROVIDER, categoryId = CATEGORY) {
  kvStore.set(`portal-job:latest:${providerId}:${categoryId}`, {
    jobId: id,
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

/** Seeds provider, credentials, schema and one client policy so create succeeds. */
export function seedCreatePrerequisites({
  providerId = PROVIDER,
  categoryId = CATEGORY,
  policyNumber = 'AG-12345',
  credentials = { username: 'firm@example.co.za', password: 'portal-pa55word' } as {
    username: string;
    password: string;
  } | null,
} = {}) {
  kvStore.set(`provider:${providerId}`, { id: providerId, name: 'Allan Gray' });
  if (credentials) {
    kvStore.set(`portal-credential:${providerId}:${providerId}-env`, {
      providerId,
      profileId: `${providerId}-env`,
      ...credentials,
    });
  }
  // `getSchemaForCategory` reads `config:schema:{categoryId}` and falls back to
  // DEFAULT_SCHEMAS. Seeding the configured key keeps the fixture in control of
  // which field is the policy number rather than inheriting a default.
  kvStore.set(`config:schema:${categoryId}`, {
    categoryId,
    fields: [
      { id: 'policy_number', name: 'Policy Number', type: 'text' },
      { id: 'premium', name: 'Premium', type: 'currency' },
    ],
  });
  kvStore.set(`user_profile:${CLIENT}:personal_info`, { firstName: 'Thabo', lastName: 'Mokoena' });
  // Policy numbers are read by FIELD ID, never by display name.
  kvStore.set(`policies:client:${CLIENT}`, [
    {
      id: 'pol-1',
      clientId: CLIENT,
      providerId,
      categoryId,
      archived: false,
      data: { policy_number: policyNumber },
    },
  ]);
}

/** A mapping config, without which `stagePortalRows` refuses to guess. */
export function seedMappingConfig(providerId = PROVIDER, categoryId = CATEGORY) {
  kvStore.set(`config:mapping:${providerId}:${categoryId}`, {
    providerId,
    categoryId,
    fieldBindings: [
      { sourceColumn: 'policy_number', targetFieldId: 'policy_number' },
      { sourceColumn: 'premium', targetFieldId: 'premium' },
    ],
    settings: {},
  });
}

/** Defaults that make the runtime boundary succeed. Call from `beforeEach`. */
export function resetPortalJobMocks(): void {
  runtime.dispatch.mockResolvedValue({
    automationHost: 'github_actions',
    actionsRunUrl: 'https://github.com/run/1',
  });
  runtime.uploadLiveView.mockResolvedValue({
    url: 'https://storage/shot.png',
    capturedAt: '2026-01-01T00:00:00.000Z',
  });
}
