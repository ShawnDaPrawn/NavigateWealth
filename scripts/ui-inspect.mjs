import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4173;
const DEFAULT_DELAY_MS = 1200;
const DEFAULT_OUTPUT = 'tmp/ui-inspect/latest.png';

function parseArgs(argv) {
  const options = {
    url: '',
    path: '/',
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    output: DEFAULT_OUTPUT,
    waitFor: '',
    click: [],
    clipSelector: '',
    delayMs: DEFAULT_DELAY_MS,
    headless: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--url':
        options.url = argv[index + 1] || '';
        index += 1;
        break;
      case '--path':
        options.path = argv[index + 1] || '/';
        index += 1;
        break;
      case '--host':
        options.host = argv[index + 1] || DEFAULT_HOST;
        index += 1;
        break;
      case '--port':
        options.port = Number(argv[index + 1] || DEFAULT_PORT);
        index += 1;
        break;
      case '--output':
        options.output = argv[index + 1] || DEFAULT_OUTPUT;
        index += 1;
        break;
      case '--wait-for':
        options.waitFor = argv[index + 1] || '';
        index += 1;
        break;
      case '--click':
        options.click.push(argv[index + 1] || '');
        index += 1;
        break;
      case '--clip':
        options.clipSelector = argv[index + 1] || '';
        index += 1;
        break;
      case '--delay':
        options.delayMs = Number(argv[index + 1] || DEFAULT_DELAY_MS);
        index += 1;
        break;
      case '--headed':
        options.headless = false;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        break;
    }
  }

  return options;
}

function printHelp() {
  process.stdout.write(`
Usage:
  npm run ui:inspect -- --path /legal/privacy-notice --output tmp/ui-inspect/privacy.png
  npm run ui:inspect -- --path /signup --click "button:text('Terms of Service')" --wait-for "[role='dialog']"
  npm run ui:inspect -- --url https://www.navigatewealth.co/legal/privacy-notice --clip ".legal-document-content"

Options:
  --url <absolute-url>        Inspect an already-running URL instead of starting local Vite dev
  --path <route>              Route to open on the local dev server (default: /)
  --host <host>               Local Vite host (default: 127.0.0.1)
  --port <port>               Local Vite port (default: 4173)
  --output <file>             Screenshot output path (default: tmp/ui-inspect/latest.png)
  --wait-for <selector>       Wait for a selector before capture
  --click <selector>          Click a selector before capture; can be supplied multiple times
  --clip <selector>           Capture only a specific element instead of full page
  --delay <ms>                Delay after load and interactions (default: 1200)
  --headed                    Launch a visible browser instead of headless
`);
}

async function waitForHttp(url, timeoutMs = 45000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet.
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function startViteDevServer(host, port) {
  const viteEntrypoint = path.resolve(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');

  const child = spawn(
    process.execPath,
    [viteEntrypoint, '--host', host, '--port', String(port), '--strictPort', '--open', 'false'],
    {
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    },
  );

  return child;
}

async function stopChildProcess(child) {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === 'win32' && child.pid) {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.on('close', () => resolve());
      killer.on('error', () => resolve());
    });
    return;
  }

  child.kill('SIGTERM');
}

async function ensureParentDir(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const origin = options.url || `http://${options.host}:${options.port}`;
  const targetUrl = options.url || new URL(options.path, `${origin}/`).toString();
  let devServer = null;

  if (!options.url) {
    devServer = startViteDevServer(options.host, options.port);
    await waitForHttp(targetUrl);
  }

  let browser;

  try {
    await ensureParentDir(options.output);

    browser = await chromium.launch({ headless: options.headless });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1600 },
      colorScheme: 'light',
    });

    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    if (options.waitFor) {
      await page.waitForSelector(options.waitFor, { state: 'visible', timeout: 20000 });
    }

    if (options.delayMs > 0) {
      await delay(options.delayMs);
    }

    for (const selector of options.click.filter(Boolean)) {
      await page.locator(selector).first().click();
      await delay(options.delayMs);
    }

    if (options.clipSelector) {
      const locator = page.locator(options.clipSelector).first();
      await locator.screenshot({ path: options.output });
    } else {
      await page.screenshot({
        path: options.output,
        fullPage: true,
      });
    }

    process.stdout.write(`Saved browser inspection screenshot to ${options.output}\n`);
  } finally {
    if (browser) {
      await browser.close();
    }

    if (devServer) {
      await stopChildProcess(devServer);
    }
  }
}

run().catch((error) => {
  console.error('[ui-inspect] failed:', error);
  process.exitCode = 1;
});
