-- ============================================================================
-- Social automation — atomic claims, quota guard, and playbook v2
-- ============================================================================
--
-- WHY (found in review of the first migration, before any routine ran)
--
-- 1. Two routines (a Claude Routine and a ChatGPT task) may run the same half
--    of the pipeline concurrently. The first design let both load a `generated`
--    batch, both select the same assets (`select_asset` accepts rows already in
--    `selected`) and both create Buffer posts — duplicate public posts, with the
--    second `mark_scheduled` overwriting the first Buffer id. Scheduling now
--    starts with `social_automation_claim_batch`, which moves the batch
--    `generated|failed -> selecting` for exactly one caller; a second caller
--    gets `claimed: false` and stops. Generation gets the same treatment inside
--    `start_batch`: only the run that created the batch — or resumes one with
--    no activity for three hours — is `claimed`.
--
-- 2. A scheduling run that crashes after creating one of two configured posts
--    left a retry counting 1 < 2, not skipping the channel, and choosing the
--    full quota again — three posts for a channel configured for two. The
--    playbook now schedules only `quota - already scheduled` (database AND
--    Buffer counted), and `select_asset` refuses a pick that would exceed the
--    quota, as the hard backstop.
--
-- Every write that means "this run is alive" touches the batch's updated_at,
-- which is what the three-hour staleness rule reads.
-- ============================================================================

-- ── 1. start_batch with claim semantics ──────────────────────────────────────

create or replace function public.social_automation_start_batch(
  p_week_key      text,
  p_window_start  date,
  p_window_end    date,
  p_agent         text
) returns jsonb
language plpgsql set search_path = public as $fn$
declare
  b              public.social_asset_batches;
  existed        boolean := true;
  claimed        boolean := false;
  last_activity  timestamptz;
  per_channel    jsonb;
begin
  select * into b from public.social_asset_batches where week_key = p_week_key;
  if not found then
    begin
      insert into public.social_asset_batches (week_key, source_window_start, source_window_end, status, generated_by)
      values (p_week_key, p_window_start, p_window_end, 'generating', p_agent)
      returning * into b;
      existed := false;
      claimed := true;
    exception when unique_violation then
      -- Two runs raced to create the same week; the other one owns it.
      select * into b from public.social_asset_batches where week_key = p_week_key;
    end;
  end if;

  select greatest(b.updated_at, coalesce(max(a.created_at), b.updated_at)) into last_activity
  from public.social_assets a where a.batch_id = b.id;

  if existed and b.status = 'generating' and last_activity < now() - interval '3 hours' then
    -- A dead run: resume it. The caller fills only what is missing per channel.
    update public.social_asset_batches
    set generated_by = p_agent, updated_at = now()
    where id = b.id
    returning * into b;
    claimed := true;
  end if;

  select coalesce(jsonb_object_agg(t.channel, t.n), '{}'::jsonb) into per_channel
  from (select channel, count(*) as n from public.social_assets where batch_id = b.id group by channel) t;

  return jsonb_build_object(
    'batch_id', b.id,
    'week_key', b.week_key,
    'status', b.status,
    'existed', existed,
    'claimed', claimed,
    'generated_by', b.generated_by,
    'last_activity', last_activity,
    'source_window_start', b.source_window_start,
    'source_window_end', b.source_window_end,
    'assets_per_channel', per_channel
  );
end;
$fn$;

-- ── 2. claim_batch for scheduling ────────────────────────────────────────────

create or replace function public.social_automation_claim_batch(
  p_batch_id  uuid,
  p_agent     text
) returns jsonb
language plpgsql set search_path = public as $fn$
declare
  b        public.social_asset_batches;
  claimed  boolean := false;
begin
  update public.social_asset_batches
  set status = 'selecting', selected_by = p_agent, updated_at = now()
  where id = p_batch_id
    and (
      status in ('generated', 'failed')
      or (status = 'selecting' and updated_at < now() - interval '3 hours')
    )
  returning * into b;

  if found then
    claimed := true;
  else
    select * into b from public.social_asset_batches where id = p_batch_id;
    if not found then
      raise exception 'social_automation_claim_batch: batch % not found', p_batch_id;
    end if;
  end if;

  return jsonb_build_object(
    'batch_id', b.id,
    'week_key', b.week_key,
    'claimed', claimed,
    'status', b.status,
    'selected_by', b.selected_by,
    'updated_at', b.updated_at
  );
end;
$fn$;

-- ── 3. add_asset keeps the generation claim alive ────────────────────────────

create or replace function public.social_automation_add_asset(
  p_batch_id  uuid,
  p_asset     jsonb,
  p_agent     text
) returns uuid
language plpgsql set search_path = public as $fn$
declare
  v_week     text;
  v_id       uuid;
  v_hashtags text[];
  v_sources  text[];
begin
  select week_key into v_week from public.social_asset_batches where id = p_batch_id;
  if v_week is null then
    raise exception 'social_automation_add_asset: batch % not found', p_batch_id;
  end if;

  select coalesce(array_agg(x), '{}') into v_hashtags
  from jsonb_array_elements_text(coalesce(p_asset -> 'hashtags', '[]'::jsonb)) x;
  select coalesce(array_agg(x), '{}') into v_sources
  from jsonb_array_elements_text(coalesce(p_asset -> 'source_article_ids', '[]'::jsonb)) x;

  insert into public.social_assets (
    batch_id, week_key, channel, title, body, first_comment, hashtags, link_url, link_title,
    source_article_ids, source_summary, image_brief, image_style, image_alt_text, image_url,
    image_status, created_by, updated_by
  ) values (
    p_batch_id, v_week, lower(p_asset ->> 'channel'), p_asset ->> 'title', p_asset ->> 'body',
    p_asset ->> 'first_comment', v_hashtags, p_asset ->> 'link_url', p_asset ->> 'link_title',
    v_sources, p_asset ->> 'source_summary', p_asset ->> 'image_brief', p_asset ->> 'image_style',
    p_asset ->> 'image_alt_text', p_asset ->> 'image_url',
    case
      when p_asset ->> 'image_url' is not null then 'ready'
      when p_asset ->> 'image_brief' is not null then 'pending'
      else 'none'
    end,
    p_agent, p_agent
  ) returning id into v_id;

  update public.social_asset_batches set updated_at = now() where id = p_batch_id;

  return v_id;
end;
$fn$;

-- ── 4. select_asset with the quota guard ─────────────────────────────────────

create or replace function public.social_automation_select_asset(
  p_asset_id       uuid,
  p_rank           int,
  p_rationale      text,
  p_scheduled_for  timestamptz,
  p_body           text default null,
  p_first_comment  text default null,
  p_agent          text default null
) returns jsonb
language plpgsql set search_path = public as $fn$
declare
  a        public.social_assets;
  v_quota  int;
  v_live   int;
begin
  select * into a from public.social_assets where id = p_asset_id;
  if not found then
    raise exception 'social_automation_select_asset: asset % not found', p_asset_id;
  end if;
  if a.state not in ('generated', 'shortlisted', 'selected', 'failed') then
    raise exception 'social_automation_select_asset: asset % is % and cannot be selected', p_asset_id, a.state;
  end if;

  select posts_per_channel_per_week into v_quota
  from public.social_automation_settings where id = 'default';

  select count(*) into v_live
  from public.social_assets
  where batch_id = a.batch_id
    and channel = a.channel
    and id <> a.id
    and state in ('selected', 'scheduled', 'published');

  if v_live >= coalesce(v_quota, 0) then
    raise exception
      'social_automation_select_asset: quota reached — % already has % selected/scheduled/published post(s) for week % (posts_per_channel_per_week = %)',
      a.channel, v_live, a.week_key, v_quota;
  end if;

  update public.social_assets
  set state = 'selected',
      selection_rank = p_rank,
      selection_rationale = p_rationale,
      scheduled_for = p_scheduled_for,
      body = coalesce(p_body, body),
      first_comment = coalesce(p_first_comment, first_comment),
      updated_by = coalesce(p_agent, updated_by)
  where id = a.id
  returning * into a;

  update public.social_asset_batches
  set status = 'selecting', selected_by = coalesce(p_agent, selected_by), updated_at = now()
  where id = a.batch_id and status in ('generated', 'selecting', 'failed');

  return jsonb_build_object('asset_id', a.id, 'channel', a.channel, 'state', a.state, 'scheduled_for', a.scheduled_for);
end;
$fn$;

-- ── 5. mark_scheduled keeps the scheduling claim alive ───────────────────────

create or replace function public.social_automation_mark_scheduled(
  p_asset_id        uuid,
  p_buffer_post_id  text,
  p_scheduled_for   timestamptz,
  p_agent           text default null
) returns jsonb
language plpgsql set search_path = public as $fn$
declare
  a public.social_assets;
begin
  update public.social_assets
  set state = 'scheduled',
      buffer_post_id = p_buffer_post_id,
      buffer_status = 'scheduled',
      buffer_error = null,
      scheduled_for = coalesce(p_scheduled_for, scheduled_for),
      updated_by = coalesce(p_agent, updated_by)
  where id = p_asset_id
  returning * into a;

  if a.id is null then
    raise exception 'social_automation_mark_scheduled: asset % not found', p_asset_id;
  end if;

  update public.social_asset_batches set updated_at = now() where id = a.batch_id;

  return jsonb_build_object('asset_id', a.id, 'channel', a.channel, 'state', a.state, 'buffer_post_id', a.buffer_post_id);
end;
$fn$;

-- ── 6. Grants for the new function ───────────────────────────────────────────

revoke execute on function public.social_automation_claim_batch(uuid, text) from public, anon, authenticated;
grant  execute on function public.social_automation_claim_batch(uuid, text) to service_role;

-- ── 7. Playbooks v2 — only where the seeded v1 text is still in place ────────

update public.social_automation_playbooks
set version = 2,
    updated_by = 'migration:20260910-claims',
    instructions = $pb_gen$NAVIGATE WEALTH — WEEKLY SOCIAL ASSET GENERATION

You are the social-media content strategist for Navigate Wealth, an independent South African financial advisory practice. In this run you CREATE candidate assets for next week. You do NOT post anything. You work through exactly two capabilities: the Supabase connection (run SQL against project vpjmdsltwrnpefzcgdmz) and web search. Identify yourself in every write as AGENT = 'claude-routine' or 'chatgpt-routine', whichever you are.

Run the SQL statements below verbatim, substituting the bracketed values. When a text value could contain quotes or newlines, wrap it in dollar quotes ($q$ ... $q$) instead of single quotes.

STEP 0 — KILL SWITCH AND SETTINGS
  select enabled, assets_per_channel, channels, style_guide, compliance_rules, site_origin
  from public.social_automation_settings where id = 'default';
If enabled is false: stop, and report "Social automation is disabled in settings." Read style_guide and compliance_rules in full; they govern everything you write.

STEP 1 — WHICH WEEK
  select to_char(case when extract(isodow from d) >= 6 then d + 7 else d end, 'IYYY-"W"IW') as week_key,
         (d - 7)::date as window_start, d::date as window_end
  from (select (now() at time zone 'Africa/Johannesburg')::date as d) t;
week_key is the ISO week the assets are FOR (next week when run on Saturday/Sunday). window_start/window_end is the 7-day source window for articles.

STEP 2 — START (OR RESUME) THE BATCH — this is the claim
  select public.social_automation_start_batch('[week_key]', '[window_start]', '[window_end]', '[AGENT]');
Read the JSON result and act on `claimed`:
- claimed = false: STOP and report. Either another run is generating this week right now (status 'generating' with recent last_activity — never compete with it) or the week is already generated or scheduled.
- claimed = true and existed = false: a fresh batch. Create assets_per_channel assets for every channel.
- claimed = true and existed = true: a previous run died and you are resuming it. assets_per_channel in the result shows what already exists per channel; create only the missing count per channel.
Keep batch_id. Another routine that starts while you work will see claimed = false and stop.

STEP 3 — SOURCE MATERIAL: THIS WEEK'S ARTICLES
  select id, title, subtitle, excerpt, category_name, published_at, url, body_text
  from public.social_recent_articles
  where published_at >= '[window_start]'
  order by published_at desc;
body_text is truncated to 6,000 characters. If there are more than eight articles, group them by theme and keep the six to eight with the most client value, timeliness and diversity across categories. If there are none, use evergreen topics from the style guide plus this week's context.

Also check what was used recently so you do not repeat it:
  select week_key, channel, title from public.social_assets
  where created_at > now() - interval '21 days' order by created_at desc;

STEP 4 — CONTEXT: SOUTH AFRICA AND THE WORLD THIS WEEK
Run three to six web searches, for example: "South Africa personal finance news this week", "SARB repo rate decision", "SARS tax season deadline", "two-pot retirement system withdrawals", "JSE rand this week", "global markets this week investors". Prefer Moneyweb, BusinessLIVE, Daily Maverick Business, News24 Business, FAnews, the SARB, SARS, FSCA and National Treasury. Write a CONTEXT BRIEF of 150–250 words: dated facts only, no speculation, with the source names. You will store it in Step 6.

STEP 5 — GENERATE THE ASSETS
For each channel listed in settings.channels, write the assets this run owes (assets_per_channel for a fresh batch; the missing count when resuming) following the WEEKLY MIX and channel formats in style_guide, and every rule in compliance_rules. Insert each one:
  select public.social_automation_add_asset('[batch_id]'::uuid, $q${
    "channel": "linkedin | instagram | x",
    "title": "short internal label, max 120 chars",
    "body": "the post text (LinkedIn/X: hashtags at the end of body; Instagram: caption, blank line, hashtags)",
    "first_comment": "optional — a first comment (e.g. the article link for LinkedIn) or null",
    "hashtags": ["FinancialPlanning", "SouthAfrica"],
    "link_url": "https://www.navigatewealth.co/resources/article/<slug> or null",
    "link_title": "article title when link_url is set, else null",
    "source_article_ids": ["article id(s) this draws on, or empty"],
    "source_summary": "one line: what this asset is based on",
    "image_brief": "REQUIRED for instagram; optional for linkedin without a link; null for x. Describe the visual.",
    "image_style": "editorial | photorealistic | abstract | conceptual | lifestyle | data_visualisation (only when image_brief is set)",
    "image_alt_text": "one-sentence alt text when image_brief is set"
  }$q$::jsonb, '[AGENT]');
Rules of thumb: hashtags without the # symbol in the array (write them with # inside body). Instagram assets MUST have image_brief. Article-led LinkedIn assets use link_url and no image_brief. X bodies must stay under 240 characters including the link.

Before inserting, self-check every asset against compliance_rules. Rewrite or drop anything that fails. Never insert a doubtful figure.

STEP 6 — FINISH THE BATCH
  select public.social_automation_finish_generation('[batch_id]'::uuid, $q$[CONTEXT BRIEF]$q$,
    $q${"articles_considered": [n], "articles_used": [n], "searches": [n], "notes": "[anything the operator should know]"}$q$::jsonb);
The Edge Function will render images for every asset that has an image_brief within the next hour or two; you do not wait for that.

STEP 7 — REPORT
Finish with a short report: week_key, assets created per channel, the articles used (titles), the context brief, and anything skipped and why. Do not paste every asset body into the report.

FAILURE HANDLING
- If a SQL statement errors, read the message, fix the statement and retry once. If it still fails, stop and report the error with the statement.
- If web search is unavailable, generate from the articles and evergreen topics only and say so in the report.
- Never delete or edit assets from other weeks.$pb_gen$
where id = 'generate' and version = 1;

update public.social_automation_playbooks
set version = 2,
    updated_by = 'migration:20260910-claims',
    instructions = $pb_sch$NAVIGATE WEALTH — WEEKLY SELECTION AND SCHEDULING

You are the social-media editor for Navigate Wealth, an independent South African financial advisory practice. In this run you CHOOSE the best assets generated for next week, finalise their copy, pick the posting times, and SCHEDULE them in Buffer. You work through exactly three capabilities: the Supabase connection (run SQL against project vpjmdsltwrnpefzcgdmz), the Buffer connection, and web search. Identify yourself in every write as AGENT = 'claude-routine' or 'chatgpt-routine', whichever you are. Times are Africa/Johannesburg (SAST, UTC+02:00) unless stated.

Run the SQL statements below verbatim, substituting the bracketed values. Wrap free text in dollar quotes ($q$ ... $q$).

STEP 0 — KILL SWITCH AND SETTINGS
  select enabled, posts_per_channel_per_week, channels, posting_timezone, style_guide, compliance_rules
  from public.social_automation_settings where id = 'default';
If enabled is false: stop and report "Social automation is disabled in settings."

STEP 1 — WHICH WEEK
  select to_char(case when extract(isodow from d) >= 6 then d + 7 else d end, 'IYYY-"W"IW') as week_key,
         date_trunc('week', (case when extract(isodow from d) >= 6 then d + 7 else d end)::timestamp) as week_start
  from (select (now() at time zone 'Africa/Johannesburg')::date as d) t;
week_start is the Monday 00:00 local of the posting week; the posting window is week_start to week_start + 7 days.

STEP 2 — LOAD AND CLAIM THE BATCH
  select id as batch_id, status, generated_at, context_brief, run_report
  from public.social_asset_batches where week_key = '[week_key]';
If there is no batch or status is 'generating': the generation run has not completed — stop and report it (do not generate assets in this run). If status is 'scheduled': this week is already scheduled — stop and report it. Otherwise claim it:
  select public.social_automation_claim_batch('[batch_id]'::uuid, '[AGENT]');
If claimed = false: STOP and report — another routine is scheduling this week right now (status 'selecting', claimed within the last 3 hours by selected_by). Never compete with it. Only continue when claimed = true.

  select id, channel, title, body, first_comment, hashtags, link_url, link_title, source_summary,
         image_status, image_url, image_alt_text, state
  from public.social_assets
  where batch_id = '[batch_id]'::uuid and state in ('generated', 'shortlisted', 'selected')
  order by channel, created_at;
Instagram candidates are usable only when image_status = 'ready' (image_url set). If an Instagram asset's image is 'failed', skip it. If every Instagram asset is still 'pending' or 'rendering', the image job has not run yet: skip Instagram this week and say so in the report.

STEP 3 — HOW MANY POSTS EACH CHANNEL STILL NEEDS (idempotency)
  select channel, count(*) as already from public.social_assets
  where week_key = '[week_key]' and state in ('scheduled', 'published') group by channel;
Also, through the Buffer connection: get_account (note the organisation and currentTime), list_channels, then list_posts for the organisation with dueAt between week_start and week_start + 7 days and status in (scheduled, sending, sent), and count them per channel.

For each channel: remaining = posts_per_channel_per_week − max(database count, Buffer count). If remaining ≤ 0, skip the channel. You will schedule EXACTLY `remaining` posts for that channel — never the full quota again. This is what makes a retry after a crash safe. The database enforces it too: social_automation_select_asset raises "quota reached" if a pick would exceed the quota; if that happens, the channel is done — do not work around it.

Map channels by service: linkedin (type page, the Navigate Wealth company page) = 'linkedin'; instagram (business, navigate_wealth) = 'instagram'; twitter = 'x'. A channel that is not connected in Buffer is skipped with a note; never guess a channel id.

STEP 4 — CONTEXT REFRESH
Run two to four web searches for what has happened in South Africa and world markets since the generation run (repo rate, budget or tax announcements, major market moves, national events). Use this to (a) prefer timely assets and (b) tone-check: if there is a national tragedy or a sharp market shock, prefer calm, educational assets and avoid anything that could read as opportunistic.

STEP 5 — SELECT AND FINALISE
For each channel still in play, choose `remaining` assets (from STEP 3). Criteria, in order: genuine client value; timeliness against the context; compliance (re-check every rule in compliance_rules — drop anything doubtful); diversity across the week (no two posts on the same theme; for LinkedIn prefer one article-led and one principle or question); Instagram must have a ready image. Prefer assets in state 'selected' from an earlier interrupted run over fresh 'generated' ones if they still fit.

Polish the copy without changing its substance. Hard limits: X ≤ 240 characters including the link (count a link as 23); LinkedIn ≤ 3,000 characters (aim 900–1,300; hook in the first two lines); Instagram ≤ 2,200 characters (caption, blank line, 4–6 hashtags). No new facts or figures at this stage.

Pick posting times from the preferred slots:
  select slot_at, slot_local, slot_label from public.social_automation_next_slots('[channel]', now(), 10);
Choose slots on DIFFERENT days within the posting week, avoiding the same hour on two channels and any slot already used by a post scheduled in Buffer for that channel. You may pick a time outside the list when the context justifies it (for example a budget-speech morning) — say why in the rationale. slot_at is an absolute timestamp; when you pass it to Buffer, format it as ISO 8601 with the +02:00 offset (e.g. 2026-09-15T07:30:00+02:00) and make sure it is in the future relative to Buffer's currentTime.

Record each pick BEFORE creating anything in Buffer:
  select public.social_automation_select_asset('[asset_id]'::uuid, [rank 1..n], $q$[one or two sentences: why this asset, why this slot]$q$,
    '[slot_at as ISO 8601]'::timestamptz, $q$[final body, or null to keep the generated body]$q$, $q$[final first comment or null]$q$, '[AGENT]');

STEP 6 — SCHEDULE IN BUFFER
For each selected asset, create exactly one Buffer post with the Buffer connection's create_post:
- channelId: the mapped channel id.
- text: the final body (LinkedIn and X: hashtags already at the end; Instagram: caption, blank line, hashtags).
- mode: customScheduled; dueAt: the slot as ISO 8601 with +02:00; schedulingType: automatic.
- Instagram: assets = [{ "image": { "url": image_url, "metadata": { "altText": image_alt_text } } }]; metadata.instagram = { "type": "post", "shouldShareToFeed": true, "isAiGenerated": true }.
- LinkedIn with link_url: metadata.linkedin.linkAttachment = { "url": link_url, "title": link_title }; no assets. LinkedIn without a link and with a ready image: assets = [{ "image": { "url": image_url, "metadata": { "altText": image_alt_text } } }].
- X: text only (the link is inside the text). If the asset has a ready image, you may attach it as an image asset.
Do not set saveToDraft. Do not add tags.

After each successful create_post, IMMEDIATELY record it, before creating the next one:
  select public.social_automation_mark_scheduled('[asset_id]'::uuid, '[buffer post id]', '[dueAt ISO 8601]'::timestamptz, '[AGENT]');
If create_post fails, record it and try the next-best asset for that channel and slot (one retry per slot):
  select public.social_automation_mark_failed('[asset_id]'::uuid, $q$[error message]$q$, '[AGENT]');

STEP 7 — FINISH THE BATCH
  select public.social_automation_finish_selection('[batch_id]'::uuid,
    $q${"scheduled": {"linkedin": [n], "instagram": [n], "x": [n]}, "skipped": {"[channel]": "[reason]"}, "failures": ["[asset title]: [error]"], "context_notes": "[one or two lines]"}$q$::jsonb,
    '[AGENT]');

STEP 8 — REPORT
Finish with a short report: week_key, what was scheduled per channel with day and time, the rationale for each pick in one line, anything skipped or failed and why. The operator monitors the accounts and will delete a post in Buffer if needed, so make the report easy to scan.

FAILURE HANDLING
- If a SQL statement errors, read the message, fix the statement and retry once; if it still fails, stop and report the error with the statement. A "quota reached" error is not a failure to work around: that channel is done.
- If the Buffer connection is unavailable, record nothing as scheduled, finish the batch with an empty "scheduled" object (the batch will show as failed and can be re-claimed later), and report it.
- Never edit or delete Buffer posts you did not create in this run. Never schedule more than posts_per_channel_per_week posts per channel for the week.$pb_sch$
where id = 'schedule' and version = 1;
