import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

const minutes = 60000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class CheckFailed extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

// The inspector records positions of controls and a fixed vocabulary. It never
// serializes page HTML, field values, arbitrary page text or screenshot pixels.
async function checkpoint(page, stage, api) {
  if (!api.checkpoint) return;
  const controls = await page.evaluate(() => {
    const words = [
      'Sign in',
      'Log in',
      'Continue',
      'Approve',
      'Verify',
      'Statements',
      'Reports',
      'Download',
      'Broker',
      'Month',
    ];
    const out = [];
    for (const el of document.querySelectorAll(
      'h1,h2,h3,input:not([type=hidden]),select,button,a,[role=button]',
    )) {
      const box = el.getBoundingClientRect();
      if (
        box.width < 5 ||
        box.height < 5 ||
        box.right <= 0 ||
        box.bottom <= 0 ||
        box.x >= innerWidth ||
        box.y >= innerHeight ||
        getComputedStyle(el).visibility === 'hidden'
      )
        continue;
      const generic = el.matches('input[type=password]')
        ? 'Password field'
        : el.matches('input')
          ? 'Input'
          : el.matches('select')
            ? 'Select'
            : el.matches('h1,h2,h3')
              ? 'Heading'
              : el.matches('a')
                ? 'Link'
                : 'Button';
      const label =
        words.find((w) => w.toLowerCase() === (el.textContent || '').trim().toLowerCase()) ||
        generic;
      const x = Math.max(0, box.x),
        y = Math.max(0, box.y);
      out.push({
        label,
        x: Math.round((100 * x) / innerWidth),
        y: Math.round((100 * y) / innerHeight),
        width: Math.round((100 * (Math.min(innerWidth, box.right) - x)) / innerWidth),
        height: Math.round((100 * (Math.min(innerHeight, box.bottom) - y)) / innerHeight),
      });
      if (out.length === 40) break;
    }
    return out;
  });
  await api.checkpoint({ stage, origin: new URL(page.url()).origin, controls });
}
export async function runReport(browser, task, api) {
  const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
  const allowed = new Set(task.origins);
  const trusted = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && allowed.has(url.origin);
    } catch {
      return false;
    }
  };
  const loginOrigin = task.loginOrigin;
  if (
    !trusted(task.loginUrl) ||
    new URL(task.loginUrl).origin !== loginOrigin ||
    !trusted(task.homeUrl)
  ) {
    await context.close();
    throw new CheckFailed('scope');
  }
  try {
    await context.route('**/*', async (route) => {
      let response;
      try {
        const url = route.request().url();
        if (!trusted(url)) {
          await route.abort();
          return;
        }
        // Inspect each redirect while the request is still in the isolated runner.
        response = await route.fetch({ maxRedirects: 0 });
        const location = response.headers().location;
        if (location && response.status() >= 300 && response.status() < 400) {
          const destination = new URL(location, url);
          if (
            !trusted(destination.href) ||
            (route.request().method() === 'POST' &&
              [307, 308].includes(response.status()) &&
              destination.origin !== new URL(url).origin)
          ) {
            await route.abort();
            return;
          }
        }
        await route.fulfill({ response });
      } catch {
        // A closed tab or failed provider request may carry headers in its error.
        await route.abort().catch(() => {});
      } finally {
        await response?.dispose().catch(() => {});
      }
    });
    await context.routeWebSocket('**/*', (socket) => socket.close());
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await page.goto(task.loginUrl, { waitUntil: 'domcontentloaded' });
    const s = task.selectors;
    const input = page.locator(s.username),
      pass = page.locator(s.password);
    await input.waitFor({ state: 'visible' });
    await pass.waitFor({ state: 'visible' });
    if (new URL(page.url()).origin !== loginOrigin) throw new CheckFailed('scope');
    await checkpoint(page, 'signin', api);
    await api.status();
    await input.fill(task.username);
    await pass.fill(task.password);
    await page.locator(s.submit).click();
    const verify = async (locator, expected) =>
      (await locator.count()) === 1 &&
      (await locator.isVisible()) &&
      (await locator.innerText()).trim() === expected;
    // MFA happens at the provider. Keep this browser alive for the operator and
    // always verify the provider's account identity after an approval signal.
    const account = page.locator(s.identity);
    try {
      await account.waitFor({ state: 'visible', timeout: 8000 });
    } catch {
      await checkpoint(page, 'approval', api);
      await api.event('mfa');
      const deadline = Date.now() + 8 * minutes;
      while (Date.now() < deadline) {
        await sleep(2000);
        const { state } = await api.status();
        if (await verify(account, task.identity)) break;
        if (state === 'running') {
          await account.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
          if (await verify(account, task.identity)) break;
        }
      }
    }
    if (!(await verify(account, task.identity))) throw new CheckFailed('identity');
    await page.goto(task.homeUrl, { waitUntil: 'domcontentloaded' });
    await page.locator(s.identity).waitFor({ state: 'visible' });
    if (!(await verify(page.locator(s.identity), task.identity))) throw new CheckFailed('identity');
    if (s.brokerSelect) await page.locator(s.brokerSelect).selectOption({ value: task.code });
    const checkScope = async () => {
      if (
        !(await verify(page.locator(s.identity), task.identity)) ||
        !(await verify(page.locator(s.brokerCode), task.code))
      )
        throw new CheckFailed('scope');
    };
    const scopeDeadline = Date.now() + 12000;
    while (!(await verify(page.locator(s.brokerCode), task.code)) && Date.now() < scopeDeadline)
      await sleep(250);
    await checkScope();
    await checkpoint(page, 'account', api);
    await api.event('verified');
    if (task.kind === 'test_login') return;
    await page.locator(s.monthSelect).selectOption({ value: task.month });
    await checkScope();
    // A result must expose its own broker and period, independently of the
    // page-level selector. Never take the first download link on a page.
    const rows = page.locator(s.reportRow);
    const empty = page.locator(s.emptyState);
    const isRequestedResult = async (result) =>
      (await result.isVisible()) &&
      (await verify(result.locator(s.rowBroker), task.code)) &&
      (await verify(result.locator(s.rowMonth), task.month));
    const resultsDeadline = Date.now() + 12000;
    let href;
    while (Date.now() < resultsDeadline) {
      const matching = [];
      for (const row of await rows.all()) {
        if (await isRequestedResult(row)) matching.push(row);
      }
      if (matching.length > 1) throw new CheckFailed('document');
      const confirmedEmpty = (await empty.count()) === 1 && (await isRequestedResult(empty));
      if (matching.length || confirmedEmpty) {
        await checkScope();
        await checkpoint(page, 'report', api);
        if (confirmedEmpty) {
          if (matching.length) throw new CheckFailed('document');
          await api.event('missing');
          return;
        }
        href = await matching[0].locator(s.documentLink).getAttribute('href');
        break;
      }
      await sleep(200);
    }
    if (!href) throw new CheckFailed('document');
    const target = new URL(href, page.url()).href;
    if (!trusted(target)) throw new CheckFailed('scope');
    await api.status();
    await checkScope();
    const response = await context.request.get(target, { maxRedirects: 0, timeout: 30000 });
    if (
      response.status() !== 200 ||
      Number(response.headers()['content-length']) > 10 * 1024 * 1024 ||
      !response.headers()['content-type']?.toLowerCase().includes('application/pdf')
    )
      throw new CheckFailed('document');
    const bytes = await response.body();
    if (bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== '%PDF-')
      throw new CheckFailed('document');
    // Verify the file independently of the portal's row before filing it.
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      verbosity: 0,
      useSystemFonts: false,
    }).promise;
    let text = '';
    try {
      for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 6); pageNo++) {
        const content = await (await pdf.getPage(pageNo)).getTextContent();
        text += ' ' + content.items.map((item) => item.str ?? '').join(' ');
      }
    } finally {
      await pdf.destroy();
    }
    const [year, month] = task.month.split('-');
    const monthName = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(+year, +month - 1, 1)),
    );
    const tokens = text.toLowerCase().split(/[^a-z0-9-]+/u);
    const padded = ' ' + text.toLowerCase().replace(/[^a-z0-9-]+/gu, ' ') + ' ';
    const literalCode = task.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const codeInDocument = new RegExp(
      '(?:^|[^a-z0-9_-])' + literalCode + '(?:$|[^a-z0-9_-])',
      'iu',
    );
    if (
      !codeInDocument.test(text) ||
      !(
        tokens.includes(task.month) ||
        padded.includes(' ' + monthName.toLowerCase() + ' ' + year + ' ') ||
        padded.includes(' ' + monthName.slice(0, 3).toLowerCase() + ' ' + year + ' ')
      )
    )
      throw new CheckFailed('document');
    await api.file(bytes);
  } finally {
    await context.close();
  }
}
async function main() {
  const id = process.env.NW_PORTAL_JOB_ID,
    secret = process.env.NW_PORTAL_WORKER_SECRET;
  if (!/^[a-f\d-]{36}$/.test(id ?? '') || !secret)
    throw new Error('Worker configuration is incomplete');
  const base =
    'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/broker-worker/' +
    id;
  let lease = '';
  const request = async (path, method = 'POST', body) => {
    const headers = { 'X-Portal-Worker-Secret': secret, 'X-Run-Lease': lease };
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + '/' + path, {
      method,
      headers,
      redirect: 'error',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Worker request failed (' + response.status + ')');
    return response.json();
  };
  const task = await request('claim');
  lease = task.lease;
  const api = {
    checkpoint: (data) => request('checkpoint', 'POST', data),
    status: () => request('status', 'GET'),
    event: (event, reason) =>
      request('event', 'POST', { event, reason, identity: task.identity, code: task.code }),
    file: (bytes) => {
      const form = new FormData();
      form.set('code', task.code);
      form.set('month', task.month);
      form.set('file', new Blob([bytes], { type: 'application/pdf' }), 'statement.pdf');
      return request('document', 'POST', form);
    },
  };
  let browser;
  try {
    browser = await chromium.launch();
    await runReport(browser, task, api);
  } catch (e) {
    await api.event('failed', e instanceof CheckFailed ? e.reason : 'portal').catch(() => {});
    // Only this fixed message reaches the Actions log. Never print provider errors.
    throw new Error('Report job did not complete. See the super admin Runs view.', { cause: e });
  } finally {
    await browser?.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error('Broker reporting worker failed. Check the run in Navigate Wealth.');
    process.exitCode = 1;
  });
