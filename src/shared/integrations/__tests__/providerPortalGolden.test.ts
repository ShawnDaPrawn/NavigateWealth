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
  const brightRockAdapterSource = readRepoFile('scripts/provider-adapters/brightrock.mjs');
  const integrationsSource = readRepoFile('src/supabase/functions/server/integrations.tsx');
  const portalDefaultFlowsSource = readRepoFile('src/supabase/functions/server/portal-default-flows.ts');
  const productTypesSource = readRepoFile('src/components/admin/modules/product-management/types.ts');
  const providerFormSource = readRepoFile('src/components/admin/modules/product-management/components/ProviderFormDialog.tsx');
  const productProviderListSource = readRepoFile('src/components/admin/modules/product-management/components/ProviderList.tsx');
  const integrationHeaderSource = readRepoFile('src/components/admin/modules/product-management/integrations/IntegrationHeader.tsx');
  const portalAutomationTabSource = readRepoFile('src/components/admin/modules/product-management/integrations/PortalAutomationTab.tsx');
  const goldenDocs = readRepoFile('docs/provider-automation-golden-flows.md');
  const packageJsonSource = readRepoFile('package.json');

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

  it('keeps BrightRock extraction behind its provider adapter boundary', () => {
    expect(adapterRegistrySource).toContain("import { brightRockAdapter } from './brightrock.mjs'");
    expect(adapterRegistrySource).toContain('brightRockAdapter');
    expect(brightRockAdapterSource).toContain("id: 'brightrock'");
    expect(brightRockAdapterSource).toContain("defaultLoginUrl: 'https://iris.brightrock.co.za/'");
    expect(brightRockAdapterSource).toContain('async function extractBrightRockSnapshot');
    expect(brightRockAdapterSource).toContain('brightrock_policy_structure');
    expect(brightRockAdapterSource).toContain('that\\s+you\\s+can\\s+recover\\s+from');
    expect(brightRockAdapterSource).toContain("that's\\s+permanent");
    expect(brightRockAdapterSource).toContain("that's\\s+caused\\s+by\\s+death");
    expect(brightRockAdapterSource).toContain('additional\\s+expense\\s+needs');
  });

  it('keeps the shared worker routed through the provider adapter registry', () => {
    expect(workerSource).toContain("import { getProviderAdapter } from './provider-adapters/index.mjs'");
    expect(workerSource).toContain('const providerAdapter = getProviderAdapter({ job, flow });');
    expect(workerSource).toContain('providerAdapter?.extractSnapshot');
    expect(workerSource).toContain('providerAdapter?.findDocumentClickTarget');
    expect(workerSource).toContain("NW_PLAYWRIGHT_RECORD_VIDEO");
    expect(workerSource).toContain("NW_PLAYWRIGHT_RECORD_TRACE");
    expect(workerSource).toContain("recordVideo: {");
    expect(workerSource).toContain("context.tracing.start");
    expect(workerSource).toContain("context.tracing.stop");
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

  it('documents local watching and hosted replay for portal automation', () => {
    expect(readRepoFile('.github/workflows/provider-portal-worker.yml')).toContain('NW_PLAYWRIGHT_RECORD_VIDEO: "1"');
    expect(readRepoFile('.github/workflows/provider-portal-worker.yml')).toContain('NW_PLAYWRIGHT_RECORD_TRACE: "1"');
    expect(packageJsonSource).toContain('"provider:watch":');
    expect(readRepoFile('docs/provider-portal-worker.md')).toContain('Watching automation');
    expect(readRepoFile('docs/provider-portal-worker.md')).toContain('Local live watching on this machine');
    expect(readRepoFile('docs/provider-portal-worker.md')).toContain('Hosted replay through GitHub Actions artifacts');
    expect(readRepoFile('docs/provider-portal-worker.md')).toContain('provider-portal-worker-<run id>');
    expect(portalAutomationTabSource).toContain('Watch automation');
    expect(portalAutomationTabSource).toContain('Watch current run');
    expect(portalAutomationTabSource).toContain('Live Portal View');
    expect(portalAutomationTabSource).toContain('This refreshes while the worker is running');
    expect(portalAutomationTabSource).toContain('npm run provider:watch -- --job-id');
    expect(workerSource).toContain("jobPath('/live-view')");
    expect(integrationsSource).toContain('app.post("/portal-worker/jobs/:jobId/live-view"');
    expect(integrationsSource).toContain('app.post("/portal-jobs/:jobId/live-view"');
  });

  it('provides a BrightRock risk portal flow without document download', () => {
    expect(portalDefaultFlowsSource).toContain('BrightRock portal policy extraction');
    expect(portalDefaultFlowsSource).toContain("loginUrl: 'https://iris.brightrock.co.za/'");
    expect(portalDefaultFlowsSource).toContain("id: 'brightrock-env'");
    expect(portalDefaultFlowsSource).toContain('input[name*="verification" i]');
    expect(portalDefaultFlowsSource).toContain('input[name*="passcode" i]');
    expect(portalDefaultFlowsSource).toContain('BrightRock defaults to SMS OTP');
    expect(workerSource).toContain('async function chooseSmsOtpDeliveryIfPresent');
    expect(workerSource).toContain('async function completeManualOtpAfterDelivery');
    expect(workerSource).toContain('async function findOtpEntryTarget');
    expect(workerSource).toContain('async function waitForBrightRockOtpDeliveryProgress');
    expect(workerSource).toContain('async function hasVisibleOtpSendAction');
    expect(workerSource).toContain('function looksLikePendingOtpSendAction');
    expect(workerSource).toContain('function looksLikeOtpSubmitAction');
    expect(workerSource).toContain('async function clickVisibleOtpSubmitAction');
    expect(workerSource).toContain('function looksLikeBrightRockOtpInfoModal');
    expect(workerSource).toContain('async function dismissBrightRockOtpInfoModal');
    expect(workerSource).toContain('async function waitForAuthCheckpointToClear');
    expect(workerSource).toContain('function getOtpSendActionCandidates');
    expect(workerSource).toContain('/^(go|continue|next|submit)$/i');
    expect(workerSource).toContain('async function clickVisibleOtpSendAction');
    expect(workerSource).toContain('async function waitForManualOtpCheckpointIfPresent');
    expect(workerSource).toContain('async function writeOtpDiagnostics');
    expect(workerSource).toContain('BrightRock did not confirm that the SMS OTP was sent');
    expect(workerSource).toContain('The worker will not wait for a phone code until BrightRock shows a sent confirmation');
    expect(workerSource).toContain('manual-otp-timeout');
    expect(workerSource).toContain('brightrock-otp-send-action-missing');
    expect(workerSource).toContain('/\\bresend\\b/i.test(value)');
    expect(workerSource).toContain('send\\s+(otp|code|pin|passcode)');
    expect(workerSource).toContain('request\\s+new\\s+otp');
    expect(workerSource).toContain('an\\s+sms\\s+will\\s+be\\s+sent\\s+containing\\s+your\\s+otp');
    expect(workerSource).toContain('BrightRock stayed on the verification screen instead of continuing into the portal');
    expect(workerSource).toContain('async function selectBrightRockSmsOtpOption');
    expect(workerSource).toContain('forceSmsSelectionInDom');
    expect(workerSource).toContain('could not positively select SMS');
    expect(workerSource).toContain("kind: 'digits'");
    expect(workerSource).toContain("page.getByRole('radio', { name: /\\bSMS\\b/i })");
    expect(portalDefaultFlowsSource).toContain("Search by reference number");
    expect(portalDefaultFlowsSource).toContain('button:has-text("Confirm")');
    expect(portalDefaultFlowsSource).toContain("sourceHeader: 'Premium'");
    expect(portalDefaultFlowsSource).toContain("sourceHeader: 'Life Cover'");
    expect(portalDefaultFlowsSource).toContain("sourceHeader: 'Capital Disability'");
    expect(portalDefaultFlowsSource).toContain("sourceHeader: 'Severe Illness'");
    expect(portalDefaultFlowsSource).toContain("sourceHeader: 'Income Protection'");
    expect(portalDefaultFlowsSource).toContain('BrightRock does not currently offer a direct cover-summary PDF download');
  });

  it('does not hand login verification pages to smart assist search', () => {
    expect(workerSource).toContain('async function completeManualOtpIfPresent');
    expect(workerSource).toContain('await chooseSmsOtpDeliveryIfPresent(page, flow)');
    expect(workerSource).toContain('await clickVisibleOtpSendAction(page, flow)');
    expect(workerSource).toContain('await completeManualOtpAfterDelivery(page, flow)');
    expect(workerSource).toContain('await waitForManualOtpCheckpointIfPresent(page, flow, 12000)');
    expect(workerSource).not.toContain('completeManualOtpIfPresent(page, flow, 45000)');
    expect(workerSource).toContain('async function waitForAuthCheckpointToClear');
    expect(workerSource).toContain('Send OTP');
    expect(workerSource).toContain('async function assertPastAuthCheckpoint');
    expect(workerSource).toContain('Provider is still on a login verification step before');
    expect(workerSource).toContain('BrightRock stayed on the verification screen instead of continuing into the portal');
    expect(workerSource).toContain("await assertPastAuthCheckpoint(page, flow, 'policy search')");
  });

  it('does not let blank saved login URLs mask provider defaults', () => {
    expect(integrationsSource).toContain("loginUrl: String(configured.loginUrl || '').trim() || defaultFlow.loginUrl");
    expect(integrationsSource).toContain("loginUrl: String(body?.loginUrl || '').trim() || defaultFlow.loginUrl");
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

  it('keeps parent product categories out of portal automation', () => {
    expect(productTypesSource).toContain('PORTAL_AUTOMATION_CATEGORY_IDS');
    expect(productTypesSource).toContain("PRODUCT_CATEGORY_GROUP_IDS: ProductCategoryId[] = [");
    expect(productTypesSource).toContain("'retirement_planning'");
    expect(productTypesSource).toContain("'investments'");
    expect(productTypesSource).toContain('function isPortalAutomationCategory');
    expect(productTypesSource).toContain('function getPortalAutomationCategoryOptions');
    expect(providerFormSource).toContain('formData.categoryIds.filter(isPortalAutomationCategory)');
    expect(productProviderListSource).toContain('getPortalAutomationCategoryOptions(provider.categoryIds)');
    expect(productProviderListSource).toContain('Group only: {getProductCategoryLabel(catId)}');
    expect(integrationHeaderSource).toContain('getPortalAutomationCategoryOptions(provider.categoryIds)');
    expect(portalAutomationTabSource).toContain('Portal automation is only available for specific product categories');
    expect(portalAutomationTabSource).toContain('disabled={!automationCategorySelected');
    expect(integrationsSource).toContain('function getPortalAutomationCategoryError(categoryId: string): string | null');
    expect(integrationsSource).toContain('Retirement Planning is a parent category');
    expect(integrationsSource).toContain('Investments is a parent category');
    expect(integrationsSource).toContain('const automationCategoryError = getPortalAutomationCategoryError(categoryId);');
    expect(integrationsSource).toContain('policy.categoryId !== job.categoryId');
  });
});
