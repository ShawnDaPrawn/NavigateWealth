# Documentation

Start here. Every document in this repository is listed below; if something is
not linked from this page, it should either be linked or be deleted.

## Start with one of these

| If you want to know                                   | Read                             |
| ----------------------------------------------------- | -------------------------------- |
| What the system is and what state it is in            | [`STATUS.md`](STATUS.md)         |
| What to build or fix next                             | [`ROADMAP.md`](ROADMAP.md)       |
| How code must be structured                           | [`GUIDELINES.md`](GUIDELINES.md) |
| What has gone wrong before, and why                   | [`INCIDENTS.md`](INCIDENTS.md)   |
| How a subsystem works                                 | [`architecture/`](architecture/) |
| How to operate or fix something running in production | [`runbooks/`](runbooks/)         |
| Why a past choice was made                            | [`decisions/`](decisions/)       |
| What a regulator or compliance review needs           | [`compliance/`](compliance/)     |

## What each folder is for

**`architecture/`** — how a subsystem is built and why. Durable explanations
that change only when the design changes.

- [`provider-portal-worker.md`](architecture/provider-portal-worker.md) — the Playwright worker, its secrets, and debugging
- [`provider-automation-golden-flows.md`](architecture/provider-automation-golden-flows.md) — protected regression flows for provider automation
- [`openclaw-gateway.md`](architecture/openclaw-gateway.md) — the OpenClaw gateway contract and capability model

**`runbooks/`** — how to operate, verify or repair something that is running.
Written for someone acting under time pressure.

- [`scheduled-jobs.md`](runbooks/scheduled-jobs.md) — every `pg_cron` job, the green-when-broken trap, and repair procedure
- [`edge-function-latency.md`](runbooks/edge-function-latency.md) — diagnosing slow Edge Function responses
- [`edge-function-metrics.md`](runbooks/edge-function-metrics.md) — reading the function's metrics
- [`email-provider-cutover.md`](runbooks/email-provider-cutover.md) — switching email providers
- [`goaml-morning-digest.md`](runbooks/goaml-morning-digest.md) — the 08:00 SAST GoAML digest automation
- [`shared-household-mailboxes.md`](runbooks/shared-household-mailboxes.md) — households sharing one contact inbox
- [`form-prefill.md`](runbooks/form-prefill.md) — form prefill operations
- [`fna-intake.md`](runbooks/fna-intake.md) — adviser and support operations for client-led FNA intake
- [`seo.md`](runbooks/seo.md) — the SEO build pipeline and its recurring operational steps

**`decisions/`** — one file per decision that closed an open question, named
`YYYY-MM-DD-<decision>.md`. A decision record states what was chosen, what was
rejected, and why. It is not updated afterwards; a later reversal is a new file.

- [`2026-08-30-keep-in-house-esign.md`](decisions/2026-08-30-keep-in-house-esign.md) — keep the in-house e-sign platform rather than adopting Documenso

**`compliance/`** — records a compliance review or regulator would ask for.

- [`form-prefill-esign-tokens.md`](compliance/form-prefill-esign-tokens.md)
- [`marketing-consent-backfill-2026-09-02.md`](compliance/marketing-consent-backfill-2026-09-02.md)

**`archive/`** — read-only history. Nothing here describes the present. Files
are kept because they explain how the present was arrived at, and because live
documents cite their finding IDs and section numbers.

- [`production-readiness-ledger-2026.md`](archive/production-readiness-ledger-2026.md) — the former status ledger, verbatim, covering 2026-04 to 2026-09. Superseded by `STATUS.md`, `ROADMAP.md` and `INCIDENTS.md`, but still the source for the numbered operator walkthroughs (§ 3.2 CORS, § 3.6 password policy, § 3.8 backup) that other files cite by section.
- [`2026-08-architecture-remediation-plan.md`](archive/2026-08-architecture-remediation-plan.md) — the sequenced security and correctness fix list. `ROADMAP.md` uses its finding IDs (S4, A5, …).
- [`2026-08-architecture-enhancement-plan.md`](archive/2026-08-architecture-enhancement-plan.md) — the target-state blueprint. `ROADMAP.md` uses its fitness-function IDs (F1–F10) and stage letters.
- [`2026-06-security-audit.md`](archive/2026-06-security-audit.md) — the June audit. **Its findings were remediated**; read it as history, not as an open incident.
- [`2026-05-fna-intake-launch/`](archive/2026-05-fna-intake-launch/) — launch checklist and UAT sign-off, completed 2026-05-23.
- [`2026-05-form-prefill-launch/`](archive/2026-05-form-prefill-launch/) — launch plan and UAT evidence, Tier A completed 2026-05-23.

## Documentation elsewhere in the repository

Short READMEs live next to the thing they describe, which is where they belong.

| Location                                                               | Covers                                                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [`../AGENTS.md`](../AGENTS.md)                                         | Working agreement for coding agents: the finalization protocol and deployment rules |
| [`../README.md`](../README.md)                                         | Project front page: what the app is, quick start, commands                          |
| `../src/components/admin/modules/*/README.md`                          | Per-module architecture and constraints for seven admin modules                     |
| [`../quality/baselines/README.md`](../quality/baselines/README.md)     | What each ratchet baseline counts and which gate enforces it                        |
| [`../supabase/migrations/README.md`](../supabase/migrations/README.md) | Migration conventions                                                               |
| [`../supabase/cron/README.md`](../supabase/cron/README.md)             | Cron job SQL and the publications smoke test                                        |
| [`../e2e/README.md`](../e2e/README.md)                                 | Running the opt-in Playwright suite                                                 |
| [`../brand-source/README.md`](../brand-source/README.md)               | Why brand source material is not under `public/`                                    |
| [`../public/brand-assets/README.md`](../public/brand-assets/README.md) | The web-ready brand assets the app actually uses                                    |

## Conventions

Three rules keep this from growing back into an unreadable pile.

1. **Status is rewritten, never appended.** `STATUS.md` describes today. When
   something changes, edit the sentence that is now wrong. An "Addendum as of
   &lt;date&gt;" heading is the failure mode that produced a 1,791-line ledger with
   three sections all claiming to be current.
2. **A dated record moves to `archive/` or `decisions/` when its work ships.**
   Launch checklists, UAT sign-offs, audits and superseded plans are evidence,
   not guidance. Leaving them beside live documents makes every document
   suspect. Nothing is deleted — the archive keeps it.
3. **Every document opens with what it is and who reads it**, and is linked
   from this page. A document nobody can find is a document nobody maintains;
   three runbooks here had no inbound link at all before this index existed.

A CI link check is being added so the build fails on any relative link in a
Markdown file that does not resolve — a move that misses a reference should be
caught by the gate, not discovered months later.

## Settled questions

Recorded here because they were re-litigated repeatedly across the documents
this index replaced.

- **`ROADMAP.md` is the live plan.** The two archived architecture plans are
  reference material for their finding IDs. Where they and the roadmap disagree
  about what is still open, the roadmap wins — and where the roadmap and the
  repository disagree, **the repository wins**. Re-verify before acting.
- **`STATUS.md` is the live status.** Nothing else claims to describe the
  present.
- **The git history rewrite to shrink the repository is not done.** Tracked
  asset weight has been reduced, but the history still carries it. That change
  requires every collaborator to re-clone and is a separate, announced decision.
