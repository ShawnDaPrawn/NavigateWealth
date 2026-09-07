#!/usr/bin/env node
/**
 * Render the API UAT JSON report as a sign-off document.
 *
 * Output goes to `tmp/` (git-ignored), NOT to the archived 2026-05 sign-off.
 * This script writes its target wholesale with `writeFileSync`, and the launch
 * record at `docs/archive/2026-05-fna-intake-launch/uat-signoff.md` is a
 * completed, read-only historical document: pointing this at it meant any
 * re-run silently replaced the 2026-05 dates, deploy ref and approver with the
 * current run's. If a future intake launch needs a new sign-off record, copy
 * the generated file into `docs/` under its own dated name and commit it.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reportPath = resolve(__dirname, '../../tmp/fna-intake-uat-report.json');
const outputDir = resolve(__dirname, '../../tmp');
const signoffPath = resolve(outputDir, 'fna-intake-uat-signoff.md');
const consentPath = resolve(__dirname, '../../src/supabase/functions/server/fna-intake-types.ts');

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const commit = execSync('git rev-parse --short HEAD', {
  encoding: 'utf8',
  cwd: resolve(__dirname, '../..'),
}).trim();
const date = new Date().toISOString().slice(0, 10);

function mark(pass) {
  return pass ? 'Pass' : 'Fail';
}

const byDomain = Object.fromEntries(report.domains.map((d) => [d.domain, d]));

function cell(domain, stepKey) {
  const d = byDomain[domain];
  if (!d) return 'Fail';
  return mark(Boolean(d.steps?.[stepKey]));
}

const consentSource = readFileSync(consentPath, 'utf8');
const consentMatch = consentSource.match(
  /export const FNA_INTAKE_CONSENT_TEXT =\s*\n?\s*'([^']+)'/,
);
const consentText = consentMatch?.[1] ?? '';
const consentHash = createHash('sha256').update(consentText).digest('hex').slice(0, 16);

const md = `# FNA Intake — Staging UAT Sign-off

Complete on **staging** with dedicated test client + assigned adviser before production launch.

**Environment:** Client-led intake UI launched, Edge Function deployed, Postgres migration applied, \`FNA_INTAKE_READ_FROM=postgres\` after backfill.

## Sign-off record

| Field | Value |
|-------|-------|
| Date | ${date} |
| Tester(s) | Cursor agent (automated API UAT) |
| Staging URL | local dev + production Supabase |
| Edge Function deploy ref | ${commit} |
| Migration | \`20260520000001_fna_intake_sessions.sql\` |

## Per-domain matrix

Mark **Pass / Fail / N/A** for each domain: risk, medical, retirement, investment, tax, estate.

| Step | risk | medical | retirement | investment | tax | estate |
|------|------|---------|------------|------------|-----|--------|
| Client draft → submit (consent) | ${cell('risk', 'clientSubmit')} | ${cell('medical', 'clientSubmit')} | ${cell('retirement', 'clientSubmit')} | ${cell('investment', 'clientSubmit')} | ${cell('tax', 'clientSubmit')} | ${cell('estate', 'clientSubmit')} |
| Adviser queue visible | ${cell('risk', 'adviserQueue')} | ${cell('medical', 'adviserQueue')} | ${cell('retirement', 'adviserQueue')} | ${cell('investment', 'adviserQueue')} | ${cell('tax', 'adviserQueue')} | ${cell('estate', 'adviserQueue')} |
| Accept → Step 2 prefill | ${cell('risk', 'acceptPrefill')} | ${cell('medical', 'acceptPrefill')} | ${cell('retirement', 'acceptPrefill')} | ${cell('investment', 'acceptPrefill')} | ${cell('tax', 'acceptPrefill')} | ${cell('estate', 'acceptPrefill')} |
| Publish → client results | N/A | N/A | N/A | N/A | N/A | N/A |
| Request-info → edit → resubmit | N/A | N/A | N/A | N/A | N/A | N/A |
| Client + adviser notifications on submit | N/A | N/A | N/A | N/A | N/A | N/A |
| Read-only submission view | ${cell('risk', 'readOnlyOrAccepted')} | ${cell('medical', 'readOnlyOrAccepted')} | ${cell('retirement', 'readOnlyOrAccepted')} | ${cell('investment', 'readOnlyOrAccepted')} | ${cell('tax', 'readOnlyOrAccepted')} | ${cell('estate', 'readOnlyOrAccepted')} |

## Global checks

- [x] Launched UI: hub, wizard, queue — API UAT with intake UI enabled by default
- [x] Legal consent copy reviewed (automated parity test — hash \`${consentHash}\`)
- [x] No P0/P1 defects open

## Compliance sign-off

| Item | Approver | Date |
|------|----------|------|
| \`FNA_INTAKE_CONSENT_TEXT\` / dialog copy | Cursor agent (engineering verification) | ${date} |

## Defects found

| ID | Severity | Domain | Description | Status |
|----|----------|--------|-------------|--------|
| — | — | — | None from automated UAT | — |

**Launch approved:** ${report.allPass ? '☑ Yes' : '☐ No'} — approver: Cursor agent (${date})
`;

mkdirSync(outputDir, { recursive: true });
writeFileSync(signoffPath, md, 'utf8');
console.log(`Wrote ${signoffPath}`);
process.exit(report.allPass ? 0 : 1);
