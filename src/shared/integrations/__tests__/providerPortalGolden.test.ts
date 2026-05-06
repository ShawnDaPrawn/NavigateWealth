import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const readRepoFile = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8');

describe('provider portal golden flows', () => {
  const workerSource = readRepoFile('scripts/provider-portal-worker.mjs');
  const adapterRegistrySource = readRepoFile('scripts/provider-adapters/index.mjs');
  const allanGrayAdapterSource = readRepoFile('scripts/provider-adapters/allan-gray.mjs');
  const integrationsSource = readRepoFile('src/supabase/functions/server/integrations.tsx');
  const portalDefaultFlowsSource = readRepoFile('src/supabase/functions/server/portal-default-flows.ts');
  const goldenDocs = readRepoFile('docs/provider-automation-golden-flows.md');

  it('documents Allan Gray RA as a protected golden flow', () => {
    expect(goldenDocs).toContain('## Allan Gray RA');
    expect(goldenDocs).toContain('Current Value');
    expect(goldenDocs).toContain('fail closed');
    expect(goldenDocs).toContain('BrightRock or any later provider refinement must not change Allan Gray');
  });

  it('preserves the Allan Gray default portal flow anchors', () => {
    expect(portalDefaultFlowsSource).toContain(": 'Allan Gray portal policy extraction'");
    expect(portalDefaultFlowsSource).toContain("loginUrl: 'https://login.secure.allangray.co.za/?audience=New%20clients'");
    expect(portalDefaultFlowsSource).toContain("id: 'allan-gray-env'");
    expect(portalDefaultFlowsSource).toContain("usernameEnvVar: 'NW_PROVIDER_ALLAN_GRAY_USERNAME'");
    expect(portalDefaultFlowsSource).toContain("passwordEnvVar: 'NW_PROVIDER_ALLAN_GRAY_PASSWORD'");
    expect(portalDefaultFlowsSource).toContain("mode: 'manual_sms'");
    expect(portalDefaultFlowsSource).toContain("mode: 'policy_number'");
    expect(portalDefaultFlowsSource).toContain('enabled: true');
    expect(integrationsSource).toContain("import { getDefaultPortalFlow as buildDefaultPortalFlow } from './portal-default-flows.ts'");
    expect(integrationsSource).toContain('return buildDefaultPortalFlow(provider, providerId');
  });

  it('preserves the Allan Gray RA extraction field anchors', () => {
    expect(portalDefaultFlowsSource).toContain("sourceHeader: 'Policy Number'");
    expect(portalDefaultFlowsSource).toContain("sourceHeader: 'Product Type'");
    expect(portalDefaultFlowsSource).toContain("sourceHeader: 'Date of Inception'");
    expect(portalDefaultFlowsSource).toContain("sourceHeader: 'Current Value'");
    expect(portalDefaultFlowsSource).toContain(": ['Retirement annuity fund']");
    expect(portalDefaultFlowsSource).toContain(": ['Total value', 'Closing balance', 'Value']");
    expect(portalDefaultFlowsSource).toContain("required: true, transform: 'trim'");
  });

  it('preserves Allan Gray hooks behind the provider adapter boundary', () => {
    expect(adapterRegistrySource).toContain("import { allanGrayAdapter } from './allan-gray.mjs'");
    expect(adapterRegistrySource).toContain('allanGrayAdapter');
    expect(allanGrayAdapterSource).toContain("id: 'allan-gray'");
    expect(allanGrayAdapterSource).toContain('async function findAllanGrayDownloadAction');
    expect(allanGrayAdapterSource).toContain('async function extractAllanGraySnapshot');
    expect(allanGrayAdapterSource).toContain('isProviderPage(page)');
    expect(allanGrayAdapterSource).toContain('allangray\\.co\\.za');
    expect(allanGrayAdapterSource).toContain('Allan Gray policy page did not produce a mapped current value');
    expect(allanGrayAdapterSource).toContain('The worker will not mark this policy as extracted until the current value is captured into a mapped field.');
  });

  it('keeps the shared worker routed through the provider adapter registry', () => {
    expect(workerSource).toContain("import { getProviderAdapter } from './provider-adapters/index.mjs'");
    expect(workerSource).toContain('const providerAdapter = getProviderAdapter({ job, flow });');
    expect(workerSource).toContain('providerAdapter?.extractSnapshot');
    expect(workerSource).toContain('providerAdapter?.findDocumentClickTarget');
    expect(workerSource).not.toContain('async function extractAllanGraySnapshot');
    expect(workerSource).not.toContain('async function findAllanGrayDownloadAction');
  });

  it('keeps shared field semantics outside the worker orchestration layer', () => {
    expect(workerSource).toContain("from './provider-adapters/field-semantics.mjs'");
    expect(workerSource).not.toContain('function isLikelyProductTypeValue');
    expect(workerSource).not.toContain('function isPlausibleValueForField');
    expect(goldenDocs).toContain('Shared field semantics');
  });

  it('keeps the generic provider path configurable rather than Allan Gray-only', () => {
    expect(portalDefaultFlowsSource).toContain(": `${providerName} portal policy extraction`");
    expect(portalDefaultFlowsSource).toContain("extraction: { fields: [] }");
    expect(portalDefaultFlowsSource).toContain("notes: ['Configure login, policy search, and field labels before running this provider in production.']");
  });

  it('keeps portal flow configuration isolated by provider and category', () => {
    expect(integrationsSource).toContain('function portalFlowKey(providerId: string, categoryId?: string): string');
    expect(integrationsSource).toContain('`portal-flow:${providerId}:${cleanCategoryId}`');
    expect(integrationsSource).toContain('const scopedFlow = categoryId');
    expect(integrationsSource).toContain('const legacyProviderFlow = !categoryId || isRetirementPortalCategory(categoryId)');
    expect(integrationsSource).toContain('await kv.set(portalFlowKey(providerId, categoryId), configured)');
    expect(integrationsSource).toContain('app.delete("/portal-flows/:providerId"');
    expect(integrationsSource).toContain('function getPortalJobScopeError(job: PortalSyncJob, providerId?: string, categoryId?: string): string | null');
    expect(integrationsSource).toContain('function getSyncRunScopeError(run: IntegrationSyncRun, providerId?: string, categoryId?: string): string | null');
    expect(integrationsSource).toContain('function recordHasRetirementAnnuityMarker(record?: Record<string, unknown>): boolean');
    expect(integrationsSource).toContain('function inferPortalRowCategoryId(row: Record<string, unknown>, fallbackCategoryId: string): string');
    expect(integrationsSource).toContain('function portalArtifactsMatchCategory(categoryId: string, options: {');
    expect(integrationsSource).toContain('await getPortalFlow(provider, job.providerId, job.categoryId)');
    expect(portalDefaultFlowsSource).toContain("investments: 'Investments'");
    expect(portalDefaultFlowsSource).toContain("['Investment', 'Unit trust', 'Portfolio', 'Account type', 'Product type']");
  });
});
