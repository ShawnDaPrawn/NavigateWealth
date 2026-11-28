/**
 * Hand a rendered newsletter PDF to the admin Newsletters module as a draft.
 *
 *   NEWSLETTER_INTAKE_TOKEN=… npm run newsletter:submit -- \
 *     --pdf tmp/newsletter/the-wealth-compass-2026-12.pdf --issue 2026-12 \
 *     --title "…" --description "…" [--dry-run] [--submitted-by claude-routine]
 *
 * Posts to the HTTPS intake endpoint described in
 * docs/runbooks/newsletter-intake.md ("Path 1"). Nothing reaches subscribers:
 * the result is a draft awaiting an admin's approval, and one review email.
 * The issue month is the idempotency key, so a second run for the same month
 * returns the earlier draft instead of creating another.
 *
 * Without --dry-run it validates first (dryRun=true) and only then submits.
 * The token is read from NEWSLETTER_INTAKE_TOKEN and handed to curl on stdin,
 * so it never appears in a process list, an argument or a log line. curl, not
 * fetch, because curl honours the sandbox's HTTPS proxy settings.
 */
import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import process from 'node:process';

const BASE =
  process.env.NEWSLETTER_INTAKE_BASE ??
  'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379';

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const pdf = valueOf('--pdf');
const issue = valueOf('--issue');
const title = valueOf('--title');
const description = valueOf('--description');
const submittedBy = valueOf('--submitted-by') ?? 'claude-routine';
const dryRunOnly = args.includes('--dry-run');
const token = process.env.NEWSLETTER_INTAKE_TOKEN;

const missing = [];
if (!pdf) missing.push('--pdf');
if (!issue || !/^\d{4}-(0[1-9]|1[0-2])$/.test(issue)) missing.push('--issue YYYY-MM');
if (!title || title.length > 150) missing.push('--title (1–150 characters)');
if (!description || description.length > 1000) missing.push('--description (1–1000 characters)');
if (!token) missing.push('NEWSLETTER_INTAKE_TOKEN in the environment');
if (missing.length) {
  console.error(`Missing or invalid: ${missing.join(', ')}`);
  process.exit(2);
}

const { size } = await stat(pdf);
if (size > 5 * 1024 * 1024) {
  console.error(`${pdf} is over the 5 MB newsletter limit.`);
  process.exit(2);
}

function post(dryRun) {
  const curlArgs = [
    '-sS',
    '--max-time',
    '120',
    '-X',
    'POST',
    `${BASE}/newsletter-intake/submit`,
    '-H',
    '@-',
    '-F',
    `file=@${pdf};type=application/pdf`,
    '--form-string',
    `title=${title}`,
    '--form-string',
    `description=${description}`,
    '--form-string',
    `idempotencyKey=${issue}`,
    '--form-string',
    `issueMonth=${issue}`,
    '--form-string',
    `submittedBy=${submittedBy}`,
    '-w',
    '\n%{http_code}',
  ];
  if (dryRun) curlArgs.push('--form-string', 'dryRun=true');
  return new Promise((resolve, reject) => {
    const child = execFile(
      'curl',
      curlArgs,
      { maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`curl failed: ${stderr || error.message}`));
          return;
        }
        const cut = stdout.lastIndexOf('\n');
        const status = Number(stdout.slice(cut + 1));
        let body;
        try {
          body = JSON.parse(stdout.slice(0, cut));
        } catch {
          body = { raw: stdout.slice(0, cut).slice(0, 500) };
        }
        resolve({ status, body });
      },
    );
    child.stdin.end(`x-nw-newsletter-intake-token: ${token}\n`);
  });
}

const check = await post(true);
console.log(JSON.stringify({ step: 'dry-run', status: check.status, body: check.body }, null, 2));
if (check.status !== 200 || check.body?.success === false) {
  console.error('The dry run did not validate; nothing was submitted.');
  process.exit(1);
}
if (dryRunOnly) process.exit(0);

const result = await post(false);
console.log(JSON.stringify({ step: 'submit', status: result.status, body: result.body }, null, 2));
if (result.status !== 201 && !(result.status === 200 && result.body?.duplicate)) {
  console.error('The hand-over failed.');
  process.exit(1);
}
