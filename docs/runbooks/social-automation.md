# Social automation — routine-driven weekly pipeline

The practice's LinkedIn Page, Instagram account and (once connected) X account are
published to through **Buffer**. Every week an AI routine — a **Claude Routine** or a
**ChatGPT scheduled task**, or both — generates candidate posts from the week's
published articles and the news, then selects the best of them, writes the final copy,
picks the posting times and schedules them in Buffer. No human approval sits in the
loop; the operator monitors the accounts and deletes a post in Buffer if needed.

This runbook is the model-agnostic contract: everything a routine needs to know, and
everything an operator needs to set up, monitor and change it.

## How it fits together

```
Saturday 06:00 SAST      hourly                 Sunday 16:00 SAST          hourly
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────┐
│ GENERATE routine │  │ Edge Function job │  │ SCHEDULE routine     │  │ Edge Function job │
│ (Claude/ChatGPT) │  │ render-images     │  │ (Claude/ChatGPT)     │  │ sync-buffer       │
│                  │  │                   │  │                      │  │                   │
│ articles (SQL)   │  │ pending briefs →  │  │ candidates (SQL)     │  │ Buffer status →   │
│ + web search     │  │ DALL-E → public   │  │ + web search         │  │ published/failed  │
│ → social_assets  │  │ bucket → image_url│  │ → Buffer create_post │  │ on social_assets  │
└──────────────────┘  └──────────────────┘  │ → mark_scheduled     │  └──────────────────┘
                                             └──────────────────────┘
                 Admin UI: Social Media → Assets (kill switch, candidates, settings, playbooks)
```

Two hard facts shaped the design:

- **The routines never call the app's REST API.** The Claude environment's network policy
  blocks egress to the Supabase Edge Function (and to RSS feeds and `api.buffer.com`), and a
  ChatGPT task has no such API access either. Both DO have a **Supabase connector** and a
  **Buffer connector**, so the contract is the database schema plus Buffer's own tools.
- **A text model cannot make an Instagram image.** The routine writes an `image_brief`; the
  Edge Function's hourly job renders it with DALL-E 3 into a **public** bucket so Buffer
  can fetch it later. Instagram candidates are only selectable once their image is `ready`.

## The contract (migration `social_automation`)

| Object                                                                                          | Purpose                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `social_asset_batches`                                                                          | One row per posting week (`week_key` = ISO week, e.g. `2026-W38`). Status: generating → generated → selecting → scheduled/failed. Holds the context brief and the run report.                                 |
| `social_assets`                                                                                 | Candidate and scheduled posts. `state`: generated → selected → scheduled → published (or failed/rejected/expired). `image_*` columns are owned by the render job; `buffer_*` by the routine and the sync job. |
| `social_automation_settings`                                                                    | Single row `default`. **`enabled` is the kill switch.** Counts, channels, timezone, site origin, preferred posting slots, style guide, compliance rules.                                                      |
| `social_automation_playbooks`                                                                   | `generate` and `schedule` — the step-by-step instructions a routine reads and follows. Editable in the admin UI; versioned.                                                                                   |
| `social_recent_articles` (view)                                                                 | Published articles from the KV store with an absolute public URL and tag-stripped body text.                                                                                                                  |
| `social_automation_week_status` (view)                                                          | Counts per week / channel / state.                                                                                                                                                                            |
| `social_automation_is_enabled()`                                                                | The kill switch, as a boolean.                                                                                                                                                                                |
| `social_automation_start_batch(week, from, to, agent)`                                          | Idempotent batch start; reports `existed` and per-channel counts.                                                                                                                                             |
| `social_automation_add_asset(batch_id, json, agent)`                                            | One asset from one JSON object; sets `image_status = 'pending'` when a brief is given.                                                                                                                        |
| `social_automation_finish_generation(batch_id, brief, report)`                                  | Marks the batch generated.                                                                                                                                                                                    |
| `social_automation_select_asset(asset_id, rank, rationale, slot, body?, first_comment?, agent)` | Records a pick and its slot; optional final copy.                                                                                                                                                             |
| `social_automation_mark_scheduled(asset_id, buffer_post_id, slot, agent)`                       | Records the Buffer post.                                                                                                                                                                                      |
| `social_automation_mark_failed(asset_id, error, agent)`                                         | Records a failure.                                                                                                                                                                                            |
| `social_automation_finish_selection(batch_id, report, agent)`                                   | Marks the batch scheduled (or failed if nothing was).                                                                                                                                                         |
| `social_automation_next_slots(channel, from, count)`                                            | Candidate posting times from the preferred slots, as absolute timestamps.                                                                                                                                     |

The playbooks quote every statement a routine needs; read them in the Assets tab
(Settings & playbooks → Playbooks) or with
`select id, title, instructions from public.social_automation_playbooks;`.

## Setting up a routine

The trigger prompt is deliberately one paragraph, because the real instructions live in the
`social_automation_playbooks` table and are edited there. Give the routine the **Supabase**
and **Buffer** connectors (and web search); nothing else.

### Prompt — generation (Saturday)

> Using the Supabase connection for project `vpjmdsltwrnpefzcgdmz`, run
> `select instructions from public.social_automation_playbooks where id = 'generate';`
> and follow those instructions exactly, identifying yourself as `claude-routine`
> (or `chatgpt-routine`). Use the Supabase connection for every SQL statement and web search
> for the context step. Finish with the short report the playbook asks for.

### Prompt — selection and scheduling (Sunday)

> Using the Supabase connection for project `vpjmdsltwrnpefzcgdmz`, run
> `select instructions from public.social_automation_playbooks where id = 'schedule';`
> and follow those instructions exactly, identifying yourself as `claude-routine`
> (or `chatgpt-routine`). Use the Supabase connection for SQL, the Buffer connection to list
> channels/posts and create posts, and web search for the context refresh. Finish with the
> short report the playbook asks for.

### Claude Routine

Two Routines, fresh session per fire, in the **Default** environment
(`env_019n52ecjK5M42Si4ifT8PHQ`), connectors `["Buffer", "Supabase"]`, push + email
notifications on. Cron is UTC; SAST is UTC+2:

| Routine                    | Cron (UTC)   | Local          | Prompt                                                                    |
| -------------------------- | ------------ | -------------- | ------------------------------------------------------------------------- |
| Social — generate assets   | `0 4 * * 6`  | Sat 06:00 SAST | the generation prompt above (or "run the `social-weekly-generate` skill") |
| Social — select & schedule | `0 14 * * 0` | Sun 16:00 SAST | the scheduling prompt above (or "run the `social-weekly-schedule` skill") |

The skills in `.claude/skills/social-weekly-*/SKILL.md` are the same instructions for a
session that has the repository checked out.

### ChatGPT scheduled task

Same two prompts, same schedule, with the Supabase MCP connector and the Buffer connector
enabled on the task. Identify as `chatgpt-routine`. Nothing in the contract is Claude-specific.

### Running both

Safe. Every step is idempotent: a batch that already exists is reported, not recreated;
scheduling skips a channel that already has its posts for the week (checked in both the
database and Buffer); a second routine finds the first one's work and stops.

## Operator setup checklist

1. **Migration** — `supabase/migrations/*_social_automation.sql` is applied (check
   `select version, name from supabase_migrations.schema_migrations order by version desc limit 3;`).
2. **`BUFFER_API_KEY`** — Edge Function secret (already set). Optional: `BUFFER_API_URL`,
   `BUFFER_ORGANIZATION_ID`.
3. **Cron jobs** — run `supabase/cron/social-automation-jobs.sql` in the SQL Editor after the
   Edge Function that carries `/social-assets` is deployed (a job pointing at a path that does
   not exist yet is the exact failure `docs/runbooks/scheduled-jobs.md` catalogues). Verify with
   query A **and** query C from that runbook.
4. **Buffer channels** — LinkedIn Page and Instagram are connected; **X must be connected in
   Buffer** (Channels → Connect). The routine skips a channel that is not connected.
5. **Routines** — create the two Routines above.
6. **Settings** — review Social Media → Assets → Settings & playbooks: counts, slots, style
   guide, compliance rules, playbooks. All editable without a deploy.

## Rehearsal

Run the generation routine by hand (fire the trigger, or run the skill in a session). Check the
Assets tab: a batch for the posting week with 5 candidates per channel, Instagram ones
`Image queued`. Run "Render images now". Then run the scheduling routine by hand — to rehearse
without publishing, tell it in the same message to create Buffer posts with
`saveToDraft: true`; the playbook's default is live scheduling. Check Buffer's queue and the
Assets tab; delete the drafts in Buffer afterwards.

## Monitoring

- **Assets tab** — the posting week's batch, its status, the context brief the routine used,
  the run report, and every asset with its state and Buffer status.
- **Routine notifications** — each run ends with a report (what was created / scheduled,
  what was skipped and why).
- **Buffer** — the queue is the truth for what will publish. Delete there to stop a post.
- **Kill switch** — Assets tab → the automation toggle (or
  `update public.social_automation_settings set enabled = false where id = 'default';`).
  Both routines check it first and stop.

Useful queries:

```sql
select * from public.social_automation_week_status order by week_key desc;
select week_key, status, generated_at, selected_at, run_report from public.social_asset_batches order by week_key desc limit 4;
select channel, title, state, image_status, scheduled_for, buffer_status, buffer_error
from public.social_assets where week_key = '2026-W38' order by channel, selection_rank nulls last;
```

## Failure modes

| Symptom                               | Cause                                                              | Fix                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Batch stays `generating`              | The generation run stopped early.                                  | Re-run it; it continues with the missing assets per channel.                              |
| Instagram skipped: images pending     | The render job has not run since generation.                       | Check the `social-automation-render-images` cron (query C); or click "Render images now". |
| Image `failed`                        | DALL-E rejected the brief (content policy) or storage failed.      | Card → "Retry image", or remove the asset.                                                |
| Asset `failed` with a Buffer error    | `create_post` rejected (token expired, plan limit, missing image). | Fix in Buffer (reconnect channel / plan), then re-run scheduling or post manually.        |
| Batch `failed` after scheduling       | Nothing could be scheduled — read `run_report.selection`.          | Usually Buffer unreachable or all channels skipped.                                       |
| `scheduled` never becomes `published` | `social-automation-sync-buffer` not running.                       | Query C on the cron; "Sync Buffer now" as a stopgap.                                      |

## Costs

DALL-E 3 standard: roughly $0.04 (1024²) to $0.08 (1792×1024) per image; at five Instagram
briefs plus a few LinkedIn ones a week that is well under $1/week. Web search and the routines'
own tokens are billed to the Claude / ChatGPT account. Buffer's Free plan (3 channels,
10 scheduled posts per channel) covers two posts per channel per week.
