---
name: social-weekly-generate
description: Saturday run of the Navigate Wealth social pipeline — read the "generate" playbook from the database and follow it to create next week's candidate assets for LinkedIn, Instagram and X. Use when a Routine or a person asks to generate the week's social assets.
---

# Weekly social asset generation (Saturday)

You are running the generation half of the routine-driven social pipeline described in
`docs/runbooks/social-automation.md`. The instructions you must follow live in the database,
not in this file, so the operator can change them from the admin Assets tab without a deploy.

## Steps

1. Using the **Supabase** connection (project `vpjmdsltwrnpefzcgdmz`), run:

   ```sql
   select instructions from public.social_automation_playbooks where id = 'generate';
   ```

2. Follow those instructions exactly, in order, identifying yourself as `claude-routine`
   in every write. Use the Supabase connection for every SQL statement and **WebSearch**
   for the context step. Do not call the app's REST API and do not post to Buffer in this run.

3. Finish with the short report the playbook asks for. That report is what the operator sees
   in the Routine notification, so keep it scannable.

## Do not

- Do not invent a channel, a figure, or an article. Everything you write is grounded in the
  articles the playbook gives you or the context you researched and can name.
- Do not edit or delete assets from other weeks.
- Do not continue if `social_automation_settings.enabled` is false — stop and say so.
