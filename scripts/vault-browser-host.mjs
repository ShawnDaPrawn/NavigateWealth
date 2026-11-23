#!/usr/bin/env node
/**
 * Browser host for password-manager skills.
 *
 * The Edge Function cannot run a browser, so skill sessions run here: a small
 * HTTP service that keeps one signed-in Chromium page per run. It signs in with
 * the credential itself, keeps every navigation on the run's allowed origins,
 * and never returns the contents of password fields. The Edge Function talks
 * to it with NW_BROWSER_HOST_URL + NW_BROWSER_HOST_TOKEN.
 *
 *   NW_BROWSER_HOST_TOKEN=<long random> PORT=8787 node scripts/vault-browser-host.mjs
 *
 * Deploy it anywhere that runs Node 22 with Playwright's Chromium and HTTPS in
 * front (a small container is enough). Sessions close after 30 idle minutes.
 */
import { createServer } from 'node:http';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { chromium } from 'playwright';

const TOKEN = process.env.NW_BROWSER_HOST_TOKEN ?? '';
const PORT = Number(process.env.PORT ?? 8787);
const IDLE_MS = 30 * 60 * 1000;
if (TOKEN.length < 32) {
  console.error('Set NW_BROWSER_HOST_TOKEN (32+ characters).');
  process.exit(1);
}

let browser;
const sessions = new Map();

export function totp(secret, now = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const ch of secret.toUpperCase().replace(/[\s=-]/g, '')) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30000)));
  const mac = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const o = mac[mac.length - 1] & 0x0f;
  return String((mac.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

function authorised(req) {
  const given = Buffer.from(req.headers.authorization ?? '');
  const expected = Buffer.from('Bearer ' + TOKEN);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function view(page) {
  const controls = await page.evaluate(() => {
    const out = [];
    // Ids persist on the page and never repeat, even when controls appear
    // between reads or a cloned element carries a copy of another's id.
    const seen = new Set();
    window.__nwSeq = window.__nwSeq || 0;
    for (const el of document.querySelectorAll(
      'a[href], button, input, select, textarea, [role="button"], [role="link"]',
    )) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || el.closest('[aria-hidden="true"]')) continue;
      const type = (el.getAttribute('type') || '').toLowerCase();
      const kind = el.tagName === 'INPUT' ? type || 'text' : el.tagName.toLowerCase();
      if (kind === 'hidden') continue;
      let id = el.dataset.nwId;
      if (!id || seen.has(id)) id = 'c' + ++window.__nwSeq;
      seen.add(id);
      el.dataset.nwId = id;
      const labelled = el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      const label = (
        el.getAttribute('aria-label') ||
        (labelled && labelled.textContent) ||
        (kind === 'password' ? '' : el.innerText) ||
        el.getAttribute('placeholder') ||
        el.getAttribute('name') ||
        el.getAttribute('title') ||
        ''
      )
        .trim()
        .slice(0, 120);
      out.push({ id, label, kind });
    }
    return out;
  });
  const text = (await page.evaluate(() => document.body?.innerText ?? '')).slice(0, 20000);
  return {
    url: page.url(),
    title: await page.title(),
    text,
    controls: controls.filter((c) => c.kind !== 'password'),
  };
}

async function signIn(page, { username, password, otpSecret }) {
  const pass = page.locator('input[type="password"]').first();
  await pass.waitFor({ timeout: 20000 });
  const user = page
    .locator(
      'input[autocomplete="username"], input[type="email"], input[name*="user" i], input[id*="user" i], input[type="text"]',
    )
    .first();
  if (username && (await user.count())) await user.fill(username);
  await pass.fill(password);
  const submit = page
    .locator(
      'button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Continue")',
    )
    .first();
  await ((await submit.count()) ? submit.click() : pass.press('Enter'));
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined);
  if (otpSecret) {
    const otp = page
      .locator(
        'input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="code" i], input[id*="code" i]',
      )
      .first();
    if (await otp.count()) {
      await otp.fill(totp(otpSecret));
      await otp.press('Enter');
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined);
    }
  }
}

function touch(id) {
  const s = sessions.get(id);
  if (!s) return null;
  clearTimeout(s.timer);
  s.timer = setTimeout(() => close(id), IDLE_MS);
  return s;
}
async function close(id) {
  const s = sessions.get(id);
  sessions.delete(id);
  if (s) await s.context.close().catch(() => undefined);
}

async function start(body) {
  browser ??= await chromium.launch();
  const allowed = new Set(body.allowedOrigins);
  const context = await browser.newContext({ acceptDownloads: false });
  const page = await context.newPage();
  // Fence: top-level navigations may only go to the allowed origins.
  await page.route('**/*', (route) => {
    const req = route.request();
    if (
      req.isNavigationRequest() &&
      req.frame() === page.mainFrame() &&
      !allowed.has(new URL(req.url()).origin)
    )
      return route.abort('blockedbyclient');
    return route.continue();
  });
  const id = randomUUID();
  sessions.set(id, { context, page, allowed, timer: null });
  touch(id);
  try {
    await page.goto(body.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await signIn(page, body);
    return { sessionId: id, page: await view(page) };
  } catch (error) {
    await close(id);
    throw error;
  }
}

async function act(s, { action, target, value }) {
  const el = target
    ? s.page.locator('[data-nw-id="' + String(target).replace(/"/g, '') + '"]').first()
    : null;
  if (target && !(await el.count()))
    throw new Error('No control with that id on the page. Read the page again.');
  if (action === 'click') await el.click();
  else if (action === 'fill') {
    if ((await el.getAttribute('type')) === 'password')
      throw new Error('Password fields are filled by the host only.');
    await el.fill(value ?? '');
  } else if (action === 'select') await el.selectOption(value ?? '');
  else if (action === 'goto') {
    if (!s.allowed.has(new URL(value).origin))
      throw new Error('That website is not allowed for this run.');
    await s.page.goto(value, { waitUntil: 'domcontentloaded' });
  } else if (action === 'wait') await s.page.waitForTimeout(Math.min(Number(value) || 1000, 15000));
  else throw new Error('Unsupported action: ' + action);
  await s.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
  return { page: await view(s.page), message: 'Done: ' + action };
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 1_000_000) throw new Error('Body too large');
  }
  return data ? JSON.parse(data) : {};
}

const server = createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  if (!authorised(req)) return send(401, { error: 'Unauthorised' });
  const [, root, id, sub] = (req.url ?? '').split('?')[0].split('/');
  try {
    if (root !== 'sessions') return send(404, { error: 'Not found' });
    if (!id && req.method === 'POST') return send(200, await start(await readBody(req)));
    const s = touch(id);
    if (!s) return send(404, { error: 'This session has ended.' });
    if (req.method === 'GET' && !sub) return send(200, await view(s.page));
    if (req.method === 'POST' && sub === 'actions')
      return send(200, await act(s, await readBody(req)));
    if (req.method === 'DELETE' && !sub) {
      await close(id);
      return send(200, { ok: true });
    }
    return send(404, { error: 'Not found' });
  } catch (error) {
    return send(400, { error: error instanceof Error ? error.message.slice(0, 300) : 'Failed' });
  }
});

if (import.meta.url === `file://${process.argv[1]}`)
  server.listen(PORT, () => console.log('Vault browser host listening on :' + PORT));
