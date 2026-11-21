// Run with node --test scripts/broker-report-worker.test.mjs after installing Chromium.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { runReport } from './broker-report-worker.mjs';

test('signed-in reporting selects the broker, verifies the file, and isolates failures', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nw-report-'));
  const key = join(dir, 'key'),
    cert = join(dir, 'cert');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      key,
      '-out',
      cert,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
    ],
    { stdio: 'ignore' },
  );
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText('A101 October 2026 commission statement');
  const bytes = Buffer.from(await pdf.save());
  let requireApproval = false;
  const server = createServer(
    { key: await readFile(key), cert: await readFile(cert) },
    (req, res) => {
      if (req.url === '/login') {
        res.setHeader('content-type', 'text/html');
        res.end(
          '<form action="/session" method="post"><input id="u" name="user"><input id="p" type="password" name="pass"><button>Sign in</button></form>',
        );
        return;
      }
      if (req.url === '/session' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          if (body !== 'user=demo&pass=local-only') {
            res.writeHead(403);
            res.end();
            return;
          }
          res.writeHead(303, {
            location: '/reports',
            'set-cookie': 'session=local; Secure; HttpOnly; Path=/',
          });
          res.end();
        });
        return;
      }
      if (req.headers.cookie !== 'session=local') {
        res.writeHead(401);
        res.end();
        return;
      }
      if (requireApproval && req.url === '/reports') {
        res.setHeader('content-type', 'text/html');
        res.end(
          '<p>Approve on your device</p><script>setTimeout(()=>location.reload(),500)</script>',
        );
        return;
      }
      if (req.url === '/file') {
        res.setHeader('content-type', 'application/pdf');
        res.end(bytes);
        return;
      }
      res.setHeader('content-type', 'text/html');
      res.end(
        `<b id="identity">Practice</b>
         <select id="brokers" onchange="setBroker()"><option>A101</option><option>B202</option><option>C303</option></select>
         <b id="code">A101</b>
         <select id="month" onchange="setTimeout(renderResults, 700)"><option>2026-09</option><option>2026-10</option></select>
         <table><tr class="row"><td class="b"></td><td class="m"></td><td><a href="/file">Download</a></td></tr></table>
         <p id="empty">No statements for <span class="b"></span> in <span class="m"></span></p>
         <script>
            function setBroker() {
              document.querySelector('#code').textContent = document.querySelector('#brokers').value;
              renderResults();
            }
            function renderResults() {
              const broker = document.querySelector('#code').textContent;
              const month = document.querySelector('#month').value;
              const missing = month === '2026-09' ? broker === 'A101' : broker === 'B202';
              for (const code of document.querySelectorAll('.b')) code.textContent = broker;
              for (const period of document.querySelectorAll('.m')) period.textContent = month;
              document.querySelector('.row').hidden = missing;
              document.querySelector('#empty').hidden = !missing;
            }
            renderResults();
         </script>`,
      );
    },
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'https://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });
  const fixtureBrowser = {
    newContext: (o) => browser.newContext({ ...o, ignoreHTTPSErrors: true }),
  };
  const task = {
    loginOrigin: origin,
    origins: [origin],
    loginUrl: origin + '/login',
    homeUrl: origin + '/reports',
    username: 'demo',
    password: 'local-only',
    identity: 'Practice',
    month: '2026-10',
    kind: 'monthly_statement',
    selectors: {
      username: '#u',
      password: '#p',
      submit: 'button',
      identity: '#identity',
      brokerSelect: '#brokers',
      brokerCode: '#code',
      monthSelect: '#month',
      reportRow: '.row',
      rowBroker: '.b',
      rowMonth: '.m',
      documentLink: 'a',
      emptyState: '#empty',
    },
  };
  try {
    const events = [],
      files = [];
    const checkpoints = [];
    const api = {
      checkpoint: async (data) => checkpoints.push(data),
      event: async (e) => events.push(e),
      file: async (file) => files.push(file),
      status: async () => ({ state: 'running' }),
    };
    await runReport(fixtureBrowser, { ...task, code: 'A101' }, api);
    assert.deepEqual(events, ['verified']);
    assert.deepEqual(
      checkpoints.map((c) => c.stage),
      ['signin', 'account', 'report'],
    );
    assert.doesNotMatch(JSON.stringify(checkpoints), /local-only|Practice|A101/);
    assert.equal(files.length, 1);
    assert.equal(files[0].compare(bytes), 0);
    events.length = 0;
    await runReport(fixtureBrowser, { ...task, code: 'B202' }, api);
    assert.deepEqual(events, ['verified', 'missing']);
    assert.equal(files.length, 1);
    await assert.rejects(runReport(fixtureBrowser, { ...task, code: 'C303' }, api), /document/);
    assert.equal(files.length, 1);
    await assert.rejects(
      runReport(fixtureBrowser, { ...task, identity: 'Different practice', code: 'A101' }, api),
      /identity/,
    );
    requireApproval = true;
    events.length = 0;
    await runReport(
      fixtureBrowser,
      { ...task, code: 'A101', kind: 'test_login' },
      {
        ...api,
        event: async (event) => {
          events.push(event);
          if (event === 'mfa') requireApproval = false;
        },
      },
    );
    assert.deepEqual(events, ['mfa', 'verified']);
    assert.ok(checkpoints.some((c) => c.stage === 'approval'));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true });
  }
});
