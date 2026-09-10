---
name: social-weekly-schedule
description: Sunday run of the Navigate Wealth social pipeline — read the "schedule" playbook from the database, select the best candidate assets for next week, finalise the copy and posting times, and schedule them in Buffer. Use when a Routine or a person asks to select and schedule the week's social posts.
---

# Weekly selection and scheduling (Sunday)

You are running the scheduling half of the routine-driven social pipeline described in
`docs/runbooks/social-automation.md`. The instructions you must follow live in the database,
not in this file, so the operator can change them from the admin Assets tab without a deploy.

## Steps

1. Using the **Supabase** connection (project `vpjmdsltwrnpefzcgdmz`), run:

   ```sql
   select instructions from public.social_automation_playbooks where id = 'schedule';
   ```

2. Follow those instructions exactly, in order, identifying yourself as `claude-routine`
   in every write. Use the Supabase connection for every SQL statement, the **Buffer**
   connection (`get_account`, `list_channels`, `list_posts`, `create_post`) for scheduling,
   and **WebSearch** for the context refresh. Do not call the app's REST API.

3. Record every Buffer post you create immediately with
   `social_automation_mark_scheduled(...)`, and every failure with
   `social_automation_mark_failed(...)`, so the Assets tab and the Buffer sync job stay truthful.

4. Finish with the short report the playbook asks for — what was scheduled per channel with
   day and time, one line of rationale each, and anything skipped or failed.

## Do not

- Do not schedule more than `posts_per_channel_per_week` posts per channel for the week, and
  never add a channel that is not connected in Buffer.
- Do not edit or delete Buffer posts you did not create in this run.
- Do not continue if `social_automation_settings.enabled` is false — stop and say so.
