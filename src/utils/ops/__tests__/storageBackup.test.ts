/**
 * Contract for the Supabase Storage backup and the off-site locked copy.
 *
 * The runner is a Node `.mjs` so the backup workflow can invoke it without
 * `npm ci` — the same reasoning as `post-deploy-smoke.mjs`, and the same
 * technique here: Vite's React plugin cannot transform that file, so this suite
 * drives it through a Node subprocess, which is the runtime CI uses anyway.
 *
 * The end-to-end case below runs the real `backupStorage` against a stub HTTP
 * server speaking the Storage API. That is deliberate: the parts of this script
 * that can lose data quietly are the recursion into synthesised folders, the
 * pagination, and the size check, and none of them are exercised by testing the
 * pure helpers alone.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const scriptPath = resolve(repoRoot, 'scripts/ops/backup-storage.mjs');
const scriptHref = pathToFileURL(scriptPath).href;
const uploadScript = resolve(repoRoot, 'scripts/ops/upload-offsite.sh');
const workflowPath = resolve(repoRoot, '.github/workflows/weekly-backup.yml');

function runInNode(source: string): unknown {
  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    cwd: repoRoot,
    timeout: 30_000,
  });
  return JSON.parse(stdout) as unknown;
}

function callBackup(expression: string): unknown {
  return runInNode(`
    import * as backup from ${JSON.stringify(scriptHref)};
    const result = await (${expression});
    process.stdout.write(JSON.stringify(result));
  `);
}

describe('storage backup — path safety', () => {
  it('refuses any object key that resolves outside the backup root', () => {
    // Object keys are chosen by whatever uploaded them. A backup script that
    // materialises remote names onto the filesystem is an arbitrary-write
    // primitive unless this holds, so each escape shape is pinned rather than
    // left to the implementation's current spelling.
    // `../outside.txt` is the subtle one and the reason containment is checked
    // at the bucket level too: the bucket segment absorbs the `..`, so it stays
    // inside the backup root while landing in another bucket's tree, and the
    // manifest would still file it under this bucket.
    const escapes = ['../outside.txt', '../../etc/passwd', '/etc/passwd', 'a/../../../oops'];
    const results = callBackup(`
      Promise.resolve(${JSON.stringify(escapes)}.map((key) => {
        try {
          backup.safeObjectPath('/tmp/root', 'bucket', key);
          return 'ACCEPTED';
        } catch {
          return 'REJECTED';
        }
      }))
    `) as string[];
    expect(results).toEqual(escapes.map(() => 'REJECTED'));
  });

  it('accepts ordinary nested keys, and rejects a sibling directory sharing the root prefix', () => {
    const results = callBackup(`
      Promise.resolve([
        (() => { try { return backup.safeObjectPath('/tmp/root', 'b', 'x/y/z.pdf').replace('/tmp/root/', ''); } catch { return 'REJECTED'; } })(),
        (() => { try { backup.safeObjectPath('/tmp/root', '../root-evil', 'z'); return 'ACCEPTED'; } catch { return 'REJECTED'; } })(),
      ])
    `) as string[];
    expect(results[0]).toBe('b/x/y/z.pdf');
    expect(results[1]).toBe('REJECTED');
  });
});

describe('storage backup — listing semantics', () => {
  it('treats a null id as a folder and a real id as an object', () => {
    // The whole recursion rests on this. Reading a folder as an object writes a
    // 404 body to disk; reading an object as a folder skips it silently, which
    // is the direction that loses data.
    const results = callBackup(`
      Promise.resolve([
        backup.isFolderEntry({ id: null, name: 'sub' }),
        backup.isFolderEntry({ name: 'sub' }),
        backup.isFolderEntry({ id: 'abc', name: 'a.pdf' }),
      ])
    `) as boolean[];
    expect(results).toEqual([true, true, false]);
  });

  it('reports an absent size as unknown rather than zero', () => {
    // `null` and `0` must not collapse. If a missing size read as zero, the
    // length check would "pass" for a truncated download of any object whose
    // metadata happens to be missing.
    const results = callBackup(`
      Promise.resolve([
        backup.listedSize({ metadata: { size: 42 } }),
        backup.listedSize({ metadata: {} }),
        backup.listedSize({ metadata: null }),
        backup.listedSize({}),
      ])
    `) as (number | null)[];
    expect(results).toEqual([42, null, null, null]);
  });

  it('fails a download whose byte count disagrees with the listing, and tolerates an unknown size', () => {
    const results = callBackup(`
      Promise.resolve([
        (() => { try { backup.assertSize('b', 'p', 10, 4); return 'ACCEPTED'; } catch { return 'REJECTED'; } })(),
        (() => { try { backup.assertSize('b', 'p', 10, 10); return 'ACCEPTED'; } catch { return 'REJECTED'; } })(),
        (() => { try { backup.assertSize('b', 'p', null, 4); return 'ACCEPTED'; } catch { return 'REJECTED'; } })(),
      ])
    `) as string[];
    expect(results).toEqual(['REJECTED', 'ACCEPTED', 'ACCEPTED']);
  });
});

describe('storage backup — manifest', () => {
  it('round-trips keys containing commas, quotes and newlines', () => {
    // Object keys legitimately contain all three. A manifest that mangles them
    // misreports which files exist, which is only discovered during a restore.
    const csv = callBackup(`
      Promise.resolve(backup.serializeCsv([
        backup.MANIFEST_HEADER,
        ['b', 'a,comma.pdf', 1, 'h', '', ''],
        ['b', 'a"quote.pdf', 2, 'h', '', ''],
        ['b', 'a\\nnewline.pdf', 3, 'h', '', ''],
      ]))
    `) as string;
    expect(csv).toContain('"a,comma.pdf"');
    expect(csv).toContain('"a""quote.pdf"');
    expect(csv).toContain('"a\nnewline.pdf"');
    expect(csv.endsWith('\n')).toBe(true);
  });
});

describe('storage backup — end to end against a stub Storage API', () => {
  const result = runInNode(`
    import * as backup from ${JSON.stringify(scriptHref)};
    import { createServer } from 'node:http';
    import { mkdtemp, readFile } from 'node:fs/promises';
    import { tmpdir } from 'node:os';
    import { join } from 'node:path';

    const BODIES = { 'docs/a.pdf': 'hello', 'docs/sub/b,q".txt': 'abc' };

    const server = createServer((req, res) => {
      const url = req.url;
      if (req.method === 'GET' && url === '/storage/v1/bucket') {
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify([
          { id: 'docs', name: 'docs', public: false },
          { id: 'empty', name: 'empty', public: true },
        ]));
      }
      if (req.method === 'POST' && url.startsWith('/storage/v1/object/list/')) {
        const bucket = url.slice('/storage/v1/object/list/'.length);
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          const { prefix } = JSON.parse(body);
          res.setHeader('content-type', 'application/json');
          if (bucket === 'empty') return res.end('[]');
          if (prefix === '') {
            return res.end(JSON.stringify([
              { name: 'a.pdf', id: '1', updated_at: '2026-01-01T00:00:00Z', metadata: { size: 5, mimetype: 'application/pdf' } },
              { name: 'sub', id: null, metadata: null },
            ]));
          }
          if (prefix === 'sub') {
            return res.end(JSON.stringify([
              { name: 'b,q".txt', id: '2', updated_at: '2026-01-02T00:00:00Z', metadata: { size: 3, mimetype: 'text/plain' } },
            ]));
          }
          return res.end('[]');
        });
        return;
      }
      if (req.method === 'GET' && url.startsWith('/storage/v1/object/')) {
        // Per-segment decode, because that is how the script encodes it.
        // \`decodeURI\` would leave %2C and %22 intact and quietly 404 every key
        // containing a comma or a quote — exactly the keys worth testing.
        const key = url
          .slice('/storage/v1/object/'.length)
          .split('/')
          .map(decodeURIComponent)
          .join('/');
        if (key in BODIES) return res.end(BODIES[key]);
        res.statusCode = 404;
        return res.end('not found');
      }
      res.statusCode = 500;
      res.end('unexpected');
    });

    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const outDir = await mkdtemp(join(tmpdir(), 'nw-storage-'));

    const summary = await backupStorageOrError();
    async function backupStorageOrError() {
      try {
        return await backup.backupStorage({
          baseUrl: 'http://127.0.0.1:' + port,
          serviceKey: 'stub',
          outDir,
        });
      } catch (error) {
        return { error: String(error && error.message) };
      }
    }

    const manifest = await readFile(join(outDir, 'manifest.csv'), 'utf8');
    const buckets = await readFile(join(outDir, 'buckets.csv'), 'utf8');
    const nested = await readFile(join(outDir, 'objects', 'docs', 'sub', 'b,q".txt'), 'utf8');
    const flat = await readFile(join(outDir, 'objects', 'docs', 'a.pdf'), 'utf8');
    const count = await readFile(join(outDir, 'object-count.txt'), 'utf8');
    server.close();
    process.stdout.write(JSON.stringify({ summary, manifest, buckets, nested, flat, count }));
  `) as {
    summary: { buckets: number; objects: number; bytes: number };
    manifest: string;
    buckets: string;
    nested: string;
    flat: string;
    count: string;
  };

  it('recurses into synthesised folders and downloads every object', () => {
    expect(result.summary).toEqual({ buckets: 2, objects: 2, bytes: 8 });
    expect(result.flat).toBe('hello');
    expect(result.nested).toBe('abc');
  });

  it('writes a manifest with the real sha256 of each object', () => {
    // sha256("hello"), computed independently of the script under test.
    expect(result.manifest).toContain(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
    const rows = result.manifest.trimEnd().split('\n');
    expect(rows[0]).toBe('bucket,path,bytes,sha256,contentType,updatedAt');
    expect(rows).toHaveLength(3);
    // Bucket and path are separate columns, and the path holds both a comma and
    // a quote, so it must come back quoted with the quote doubled.
    expect(result.manifest).toContain('docs,"sub/b,q"".txt",3,');
  });

  it('writes the object total as a bare integer for the archive check to compare against', () => {
    // Counted here rather than from manifest lines because an object key may
    // contain a newline: the manifest quotes it correctly, and `wc -l` would
    // then report more rows than there are objects and fail a good backup.
    expect(result.count).toBe('2\n');
  });

  it('records every bucket, including the empty one, so a vanished bucket is visible', () => {
    // A bucket that disappears between runs is a signal. Omitting empty buckets
    // would make "no objects" and "no bucket" identical in the record.
    expect(result.buckets).toContain('empty,true,0,0');
    expect(result.buckets).toContain('docs,false,2,8');
  });

  it('refuses to record an empty archive as a successful backup', () => {
    // The failure mode the DB leg already guards with a minimum dump size: a
    // credential that can list buckets but not read them produces a clean,
    // green, empty backup that is only discovered on the day it is needed.
    const outcome = runInNode(`
      import * as backup from ${JSON.stringify(scriptHref)};
      import { createServer } from 'node:http';
      import { mkdtemp } from 'node:fs/promises';
      import { tmpdir } from 'node:os';
      import { join } from 'node:path';
      const server = createServer((req, res) => {
        res.setHeader('content-type', 'application/json');
        if (req.url === '/storage/v1/bucket') return res.end(JSON.stringify([{ id: 'docs' }]));
        res.end('[]');
      });
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      const outDir = await mkdtemp(join(tmpdir(), 'nw-empty-'));
      let outcome = 'ACCEPTED';
      try {
        await backup.backupStorage({
          baseUrl: 'http://127.0.0.1:' + server.address().port,
          serviceKey: 'stub',
          outDir,
        });
      } catch (error) {
        outcome = String(error.message).includes('Refusing to record an empty archive')
          ? 'REJECTED'
          : 'WRONG_ERROR';
      }
      server.close();
      process.stdout.write(JSON.stringify(outcome));
    `);
    expect(outcome).toBe('REJECTED');
  });
});

describe('weekly-backup workflow wiring', () => {
  const workflow = readFileSync(workflowPath, 'utf8');

  it('checks out the repository before running any script from it', () => {
    // This is a regression test for a real latent break. Four steps run
    // scripts out of `scripts/ops/`, and the workflow had no checkout at all —
    // the first run that was actually configured would have died on
    // "No such file or directory". It went unnoticed for three weeks because
    // every run skipped every step that touches the repo.
    const checkoutAt = workflow.indexOf('actions/checkout');
    expect(checkoutAt, 'the backup workflow must check out the repository').toBeGreaterThan(-1);

    for (const script of [
      'scripts/ops/capture-db-shape.sh',
      'scripts/ops/compare-restore.py',
      'scripts/ops/backup-storage.mjs',
      'scripts/ops/upload-offsite.sh',
    ]) {
      const usedAt = workflow.indexOf(script);
      expect(usedAt, `${script} is referenced by the workflow`).toBeGreaterThan(-1);
      expect(checkoutAt, `checkout must precede ${script}`).toBeLessThan(usedAt);
    }
  });

  it('gates each leg on its own secret so one missing secret cannot disable the others', () => {
    expect(workflow).toContain("steps.guard.outputs.configured == 'true'");
    expect(workflow).toContain("steps.guard.outputs.storage == 'true'");
    expect(workflow).toContain("steps.guard.outputs.offsite == 'true'");
  });

  it('writes what it did to the job summary on every run', () => {
    // The whole reason three green ticks meant nothing. A skip stays a skip
    // rather than a failure, but it must not read as a completed backup.
    expect(workflow).toContain('GITHUB_STEP_SUMMARY');
  });

  it('uploads the storage archive alongside the dump', () => {
    expect(workflow).toContain('env.STORAGE_FILE');
  });

  it('does not let a failed leg suppress the ones after it', () => {
    // A step condition with no status function carries an implicit
    // `success()`, so a bare `if: steps.guard.outputs.storage == 'true'` skips
    // the Storage leg whenever the database leg failed — and, worse, skips the
    // artifact upload, discarding a database dump that was already decoded and
    // restore-verified because a different backup went wrong. Pinned because
    // "simplifying" these conditions back to a bare guard reintroduces it
    // silently: the workflow still looks correct and still passes.
    for (const step of [
      'Back up Supabase Storage objects',
      'Copy the backups off-site into locked object storage',
      'Upload',
    ]) {
      const at = workflow.indexOf(`- name: ${step}`);
      expect(at, `step "${step}" is missing`).toBeGreaterThan(-1);
      // The `if:` LINE only. Slicing from the step name would swallow the
      // comment above the condition, which explains `!cancelled()` and so
      // satisfies the assertion whether or not the condition still carries it —
      // this test passed against a deliberately reverted workflow before the
      // slice was narrowed.
      const ifAt = workflow.indexOf('\n        if:', at) + 1;
      const condition = workflow.slice(ifAt, workflow.indexOf('\n', ifAt));
      expect(condition, `"${step}" must survive an earlier leg's failure`).toContain(
        '!cancelled()',
      );
    }
  });
});

describe('off-site upload', () => {
  const upload = readFileSync(uploadScript, 'utf8');

  it('reads the lock back off the stored object rather than trusting the request', () => {
    // A put into a bucket WITHOUT Object Lock enabled succeeds and is
    // indistinguishable from a protected one. Object Lock cannot be enabled
    // after bucket creation, so this check is the only thing standing between
    // "we have immutable backups" and a bucket that must be recreated.
    expect(upload).toContain('head-object');
    expect(upload).toContain('ObjectLockMode');
    expect(upload).toContain('ObjectLockRetainUntilDate');
  });

  it('fails the run when the returned lock mode is not the requested one', () => {
    expect(upload).toMatch(/remote_mode" != "\$LOCK_MODE"[\s\S]{0,400}exit 1/);
  });

  it('defaults to COMPLIANCE, the mode an account takeover cannot bypass', () => {
    expect(upload).toContain('NW_BACKUP_LOCK_MODE:-COMPLIANCE');
  });

  it('skips cleanly when the bucket is not configured, rather than failing every Sunday', () => {
    expect(upload).toContain('NW_BACKUP_S3_BUCKET is not set');
    expect(upload).toMatch(/NW_BACKUP_S3_BUCKET is not set[\s\S]{0,300}exit 0/);
  });

  it('is documented with an IAM policy that permits the retention write it performs', () => {
    // Setting `x-amz-object-lock-mode` on a put IS a retention write, so a
    // policy denying `s3:PutObjectRetention` fails every upload with
    // AccessDenied and there is no off-site copy at all. The first draft of the
    // runbook denied it while the script sent the flags, which would have
    // broken leg 3 on its first run — the runbook and the script have no import
    // relationship, so nothing else stops them drifting apart again.
    const runbook = readFileSync(resolve(repoRoot, 'docs/runbooks/backup-and-restore.md'), 'utf8');
    expect(upload).toContain('--object-lock-mode');

    const denyAt = runbook.indexOf('NeverDeleteOrWeakenAnObject');
    const allowAt = runbook.indexOf('WriteAndVerifyBackups');
    expect(allowAt, 'the runbook must document an allow statement').toBeGreaterThan(-1);
    expect(denyAt).toBeGreaterThan(allowAt);

    const allow = runbook.slice(allowAt, denyAt);
    expect(allow, 'the CI principal must be allowed to write retention').toContain(
      's3:PutObjectRetention',
    );
    // Granting it is safe only because the bypass stays denied: compliance
    // retention can then only be extended, never shortened or removed.
    expect(runbook.slice(denyAt)).toContain('s3:BypassGovernanceRetention');
  });
});
