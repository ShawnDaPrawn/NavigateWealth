---
name: social-weekly-assets-schedule
description: Weekly run of the Navigate Wealth Assets-tab pipeline — read the "assets_schedule" playbook from the database, pick the best ready-to-post media for the coming week from the Assets tab shelf (table social_channel_assets), and schedule it in Buffer. Use when a Routine or a person asks to pick and schedule posts from the Assets tab, as distinct from the separate weekly-text pipeline covered by social-weekly-generate / social-weekly-schedule.
---

# Assets tab: weekly shelf selection and scheduling

You are running the Assets-tab half of the social pipeline described in
`docs/runbooks/social-channel-assets.md`. This is **not** the weekly-text pipeline covered by
the `social-weekly-generate` / `social-weekly-schedule` skills (table `social_assets` /
`social_asset_batches`) — those are a separate system. This skill works from the shelf of
finished media at Admin → Social & Marketing → Social Media → **Assets** (table
`social_channel_assets`), filled by ChatGPT or an admin. The instructions you must follow live
in the database, not in this file, so the operator can change them from the admin UI without a
deploy.

## Steps

1. Using the **Supabase** connection (project `vpjmdsltwrnpefzcgdmz`), run:

   ```sql
   select instructions from public.social_automation_playbooks where id = 'assets_schedule';
   ```

2. Follow those instructions exactly, in order, identifying yourself as `claude-routine` in
   every write. Use the Supabase connection for every SQL statement (including
   `social_channel_assets_list` and `social_automation_next_slots`), the **Buffer** connection
   (`get_account`, `list_channels`, `list_posts`, `create_post`) for scheduling, and
   **WebSearch** for the context, currency and timeliness refresh. Do not call the app's REST
   API — the sandbox's network egress cannot reach it anyway.

3. Record every Buffer post you create **immediately** with
   `social_channel_assets_mark_used(asset_id, buffer_post_id, 'claude-routine')`, before moving
   on to the next asset, so the Assets tab stays truthful and nothing goes out twice.

4. Finish with the short report the playbook asks for — the target week, what was scheduled per
   channel with day and time and a one-line rationale each, any caption you corrected and why,
   and anything skipped or failed.

## Do not

- Do not schedule more than `posts_per_channel_per_week` posts per channel for the target week,
  and never add a channel that is not connected in Buffer.
- Do not post a caption with a stale figure, a lapsed deadline, or a missing licensed-adviser
  referral where the compliance rules require one — fix it first, or drop the asset.
- Do not edit or delete Buffer posts you did not create in this run.
- Do not continue if `social_automation_settings.enabled` is false — stop and say so.
