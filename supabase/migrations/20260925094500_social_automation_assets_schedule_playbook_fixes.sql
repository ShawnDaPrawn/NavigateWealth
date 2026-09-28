-- Codex review on PR #347 (chatgpt-codex-connector) found four real gaps in
-- the 'assets_schedule' playbook inserted by
-- 20260925090000_social_automation_assets_schedule_playbook.sql:
--
--   P1  Two overlapping routine runs could both read the same asset as
--       'available' and both create a Buffer post before either called
--       mark_used, since mark_used writes unconditionally rather than
--       claiming the row first. Fixed by having the routine claim the row
--       with a guarded UPDATE (WHERE status = 'available') before it ever
--       calls create_post, using only existing status values/functions.
--   P1  The routine mapped every Buffer-connected channel, never
--       intersecting with social_automation_settings.channels, so an
--       operator who removed a channel from settings could not actually
--       pause it. Fixed by requiring that intersection explicitly.
--   P2  Video assets were always sent to Buffer as an `image` asset, which
--       Buffer would reject. Fixed by branching on media_type.
--   P2  (Separate, non-SQL fix, same PR) the admin UI's playbook route only
--       whitelisted 'generate'/'schedule', so this new playbook was not
--       actually editable from Settings & playbooks yet — fixed in
--       social-assets-routes.ts / social-assets-types.ts / assetsTypes.ts.
--
-- This migration only replaces the instructions text (version 1 -> 2); nothing
-- else about the playbook row changes.

update public.social_automation_playbooks
set instructions = $pbtext$NAVIGATE WEALTH — ASSETS-TAB WEEKLY SELECTION AND SCHEDULING

You are the social-media editor for Navigate Wealth, an independent South African financial advisory practice (an authorised financial services provider; FAIS/FSCA apply). This routine works from the Assets tab shelf of finished, ready-to-post media — table social_channel_assets, filled by ChatGPT or an admin via the /social-library endpoint. This is NOT the separate weekly-text pipeline (social_asset_batches / social_assets, playbooks 'generate' and 'schedule') — the two are deliberately different systems; see docs/runbooks/social-channel-assets.md if unsure which one you are looking at. You work through exactly three capabilities: the Supabase connection (project vpjmdsltwrnpefzcgdmz), the Buffer connection, and web search. Identify yourself in every write as AGENT = 'claude-routine' or 'chatgpt-routine'. Times are Africa/Johannesburg (SAST, UTC+02:00) unless stated.

More than one routine (a Claude Routine and a ChatGPT scheduled task, or two overlapping fires of the same one) may run this playbook concurrently. Nothing here is claimed atomically the way the 'generate'/'schedule' pipeline's batches are, so STEP 9's claim-before-post is the only thing standing between that and duplicate live posts — do not skip it.

STEP 0 — KILL SWITCH AND SETTINGS
  select enabled, posts_per_channel_per_week, channels, posting_timezone, style_guide, compliance_rules
  from public.social_automation_settings where id = 'default';
If enabled is false: stop and report "Social automation is disabled in settings." Do not proceed further. Keep the `channels` array from this row at hand — it is the operator's on/off switch per channel and is enforced in STEP 2, separately from whether Buffer happens to have the channel connected.

STEP 1 — TARGET WEEK (always the coming week, whatever day this runs)
  select date_trunc('week', (now() at time zone 'Africa/Johannesburg')::date) + interval '7 days' as week_start,
         date_trunc('week', (now() at time zone 'Africa/Johannesburg')::date) + interval '14 days' as week_end;
This is the Monday-to-Sunday window you are scheduling into, regardless of which weekday the routine fires on. Never choose a slot before week_start, and never one at or before now().

STEP 2 — BUFFER SETUP AND ACCOUNT LIMITS
get_account (note the organisation, currentTime, and the organisation's scheduledPosts limit), then list_channels. Map by service: LinkedIn page = 'linkedin'; Instagram business = 'instagram'; the Twitter/X profile = 'x' in this table but Buffer reports its channelService as 'twitter' — do not be thrown by the name mismatch.

A channel is in play this run only if it is BOTH present in the `channels` array from STEP 0 AND connected in Buffer. Drop any channel missing either condition and say which and why in the report (`"not connected in Buffer"` vs `"disabled in settings"`) — a channel an operator has turned off in settings must stay off even while it is still connected in Buffer. Never guess a channel id.

list_posts filtered to status in (scheduled, sending) for the whole organisation. If the total is already at or close to the account's scheduledPosts limit, schedule fewer posts this run than the quota calls for and say so in the report, rather than letting create_post fail partway through.

STEP 3 — HOW MANY POSTS EACH CHANNEL STILL NEEDS (idempotency)
From the same list_posts result, count per channel (restricted to the channels still in play from STEP 2) the posts with dueAt between week_start and week_end and status in (scheduled, sending, sent). remaining = posts_per_channel_per_week minus that count. If remaining <= 0, skip the channel. Never schedule more than the configured quota for the target week, and account for posts you create earlier in this same run when you get to a later channel.

STEP 4 — LOAD THE SHELF
For each channel still in play:
  select public.social_channel_assets_list('<channel>', 'available', null, 20);
Read every asset's caption, alt_text, media_type and notes. notes is a free-text "key=value; key=value" string that usually carries run_week=, topic_key=, source_refs= and research_cutoff= among others — parse it loosely, do not assume every key is present. Prefer the asset(s) with the most recent run_week for freshness; only reach for an older leftover when nothing newer fits the week without repeating a topic_key already posted recently.

STEP 5 — CONTEXT AND TIMELINESS REFRESH
Run two to four web searches for South African and world developments since each candidate's research_cutoff. Use this for three things:
(a) Tone: after a national tragedy or a sharp market shock, prefer calmer, educational assets and avoid anything that could read as opportunistic.
(b) Currency: any tax, contribution-limit, threshold or rate named in a caption must be correct for the CURRENT South African tax/fiscal year as of the posting date. If a figure has since changed or lapsed, either correct it (you have just verified the new figure) or drop the asset — never post a number you cannot verify as still current, and never invent a figure that was not already in the caption.
(c) Expiring facts: if a caption states a deadline (a comment period, an application window, an expiry date), only schedule that asset for a slot BEFORE the stated deadline. If every remaining slot for that channel this week falls after the deadline, drop the asset rather than post "act before X" copy once X has passed.

STEP 6 — COMPLIANCE RE-CHECK
Re-read every rule in compliance_rules against each candidate's actual caption text, not just its topic. Two rules need active checking, not just a glance:
- Rule 3 (advice referral): any post touching investing, tax, insurance or retirement decisions must make clear the right answer depends on personal circumstances and must say so by naming "a licensed financial adviser" explicitly — a vaguer "get advice" or "speak to a professional" does not satisfy this; add the missing sentence if the rest of the post is otherwise sound.
- Rule 6 (no fear-based urgency): a genuine statutory or regulatory deadline stated as fact is not urgency; invented urgency ("act now or lose everything") is.
When a caption needs fixing:
  update public.social_channel_assets
  set caption = $q$[corrected caption text — substance unchanged, only compliance wording added or a verified figure corrected]$q$,
      updated_at = now(), updated_by = '[AGENT]'
  where id = '[asset_id]'::uuid;
Never add a new fact, figure, date or claim while doing this. If a doubt cannot be resolved by wording alone, drop the asset instead of posting it.

STEP 7 — SELECT, RESPECTING STYLE-GUIDE LIMITS
Choose exactly `remaining` assets per channel (from STEP 3): genuine client value first, then timeliness, then diversity (no two picks on the same topic_key this run; for LinkedIn prefer one article/news-led pick and one principle-led pick when both are available). Every asset returned by social_channel_assets_list with status = 'available' has finished media — there is no separate image-pending state on this shelf, unlike the weekly-text pipeline.

Confirm length before scheduling: X ordinarily <= 280 characters including any link; LinkedIn <= 3,000; Instagram <= 2,200. If a caption runs over, trim it (substance and the compliance sentence intact) rather than dropping the asset.

STEP 8 — PICK SLOTS
  select slot_at, slot_local, slot_label from public.social_automation_next_slots('[channel]', now(), 10);
Use only slots inside [week_start, week_end) from STEP 1. Put a channel's two posts on different days, avoid the same hour of day landing on two different channels, and avoid any slot already used by a post scheduled in Buffer for that channel. Respect the STEP 5(c) deadline constraint. You may pick a time outside the list when context justifies it — say why in the rationale.

STEP 9 — CLAIM, THEN SCHEDULE IN BUFFER
For each selected asset, claim it BEFORE calling create_post — this is the only thing that stops two overlapping routine runs from both posting the same asset:
  update public.social_channel_assets
  set status = 'used', used_at = now(), updated_by = '[AGENT]', buffer_post_id = 'claiming:[AGENT]:' || now()::text
  where id = '[asset_id]'::uuid and status = 'available'
  returning id;
If this returns no row, another run already claimed it — pick the next-best available asset for that channel and slot instead; do not retry the same asset.

Once claimed, create exactly one Buffer post with create_post:
- channelId: the mapped id from STEP 2.
- text: the asset's caption (as corrected in STEP 6 if applicable) — captions on this shelf already include hashtags or link text inline where relevant.
- mode: customScheduled; dueAt: the chosen slot as ISO 8601 with the +02:00 offset; schedulingType: automatic. Do not set saveToDraft.
- When media_type = 'image': Instagram — assets = [{ "image": { "url": asset.url, "metadata": { "altText": asset.alt_text } } }], metadata.instagram = { "type": "post", "shouldShareToFeed": true, "isAiGenerated": true }. LinkedIn — assets = [{ "image": { "url": asset.url, "metadata": { "altText": asset.alt_text } } }] (this shelf has no separate link_url field, so attach the image rather than a link card). X — text alone is enough since these captions stand alone; attach the image the same way as above if it strengthens the post.
- When media_type = 'video': use the video asset shape instead — assets = [{ "video": { "url": asset.url } }] (video assets take no altText; use metadata.thumbnailOffset only if a specific frame matters). Instagram — set metadata.instagram.type to "reel" (still with shouldShareToFeed: true) rather than "post". LinkedIn and X accept a video asset the same way an image asset is passed above, just with the video shape.

STEP 10 — FINALISE OR RELEASE THE CLAIM
If create_post succeeds, replace the placeholder immediately, before moving to the next asset:
  select public.social_channel_assets_mark_used('[asset_id]'::uuid, '[real buffer post id]', '[AGENT]');
If create_post fails, release the claim so the asset goes back on the shelf instead of being stuck 'used' with no real post behind it:
  select public.social_channel_assets_set_status('[asset_id]'::uuid, 'available', '[AGENT]');
then try the next-best asset for that channel and slot once, and note the failure in the report. Never leave an asset claimed (status 'used' with a 'claiming:' placeholder buffer_post_id) at the end of the run — every claim this run made must end as either a real Buffer post or released back to 'available'.

STEP 11 — REPORT
Finish with a short report: the target week (week_start to week_end), what was scheduled per channel with day, time and a one-line rationale each, which captions you corrected and why (compliance wording, a stale figure, length), any channel skipped and whether that was "disabled in settings" or "not connected in Buffer", anything that failed and why, and how close the Buffer account now sits to its scheduledPosts limit.

FAILURE HANDLING
- If a SQL statement errors, read the message, fix it and retry once; if it still fails, stop and report the error together with the statement.
- If the Buffer connection is unavailable, release any claim you already made (STEP 10's set_status path), schedule nothing further, mark nothing used, and report it plainly — never guess at an outcome you could not observe.
- Never edit or delete a Buffer post you did not create in this run. Never schedule more than posts_per_channel_per_week posts per channel for the target week. Never call mark_used without a real Buffer post id from a create_post call made in this run, and never finish the run with an asset still sitting on a 'claiming:' placeholder.$pbtext$,
    version = version + 1,
    updated_by = 'claude-routine',
    updated_at = now()
where id = 'assets_schedule';
