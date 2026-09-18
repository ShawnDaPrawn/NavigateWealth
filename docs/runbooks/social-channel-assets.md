# Social channel assets — the Assets tab, and how an agent fills it

**What this is.** A shelf of finished images and videos per social channel
(Instagram, LinkedIn, X), shown in **Admin → Social & Marketing → Social Media →
Assets**. ChatGPT puts media on the shelf; a publishing routine will take from
it and post through Buffer.

This is not the weekly text pipeline. That one generates candidate _posts_ —
body copy, hashtags, an image brief — and lives under **Weekly pipeline** in the
same tab strip, backed by `social_assets`. This one is the media files
themselves, backed by `social_channel_assets`. Two different things; the names
are worth keeping straight.

```
  ChatGPT                  Edge Function                 Admin UI
┌───────────┐   HTTPS   ┌──────────────────┐         ┌──────────────┐
│ makes the │──────────►│ /social-library  │────────►│ Assets tab   │
│ creative  │  + token  │  validates bytes │         │ per channel  │
└───────────┘           │  stores + row    │         └──────────────┘
                        └────────┬─────────┘                │
                                 │                          │ caption, alt,
                        ┌────────▼─────────┐                │ archive, delete
                        │ social_channel_  │◄───────────────┘
                        │ assets (status)  │
                        └────────┬─────────┘
                                 │  status = available
                        ┌────────▼─────────┐
                        │ Claude routine   │ (to be built)
                        │ → Buffer, then   │
                        │   mark used      │
                        └──────────────────┘
```

## The lifecycle

| Status      | Meaning                                                            |
| ----------- | ------------------------------------------------------------------ |
| `available` | On the shelf. This is the queue a publishing routine draws from.   |
| `used`      | Published. `buffer_post_id` records which Buffer post consumed it. |
| `archived`  | Taken out of circulation without deleting the file.                |

Marking an asset `used` is what stops it going out twice, so a routine must do
it immediately after Buffer accepts the post — not at the end of a batch.

Composing by hand counts as going out. Picking an asset in **Compose** and
publishing or scheduling it marks that asset `used` against the Buffer post
that took it, exactly as a routine would, so the two paths cannot disagree
about what is still on the shelf. The picker only offers `available` media for
the same reason. Nothing is marked when Buffer accepts nothing.

## Posting one by hand

**Create post** on an asset card opens Compose carrying that asset, its caption
as the fields currently read (an unsaved edit comes across too), and the channel
it was filed under already selected. All
three are a starting point, not a commitment — edit the text, add channels,
attach up to four pictures in total, then publish, queue or schedule as usual.
Scheduling is the same Compose control it always was; the asset is just already
in the draft.

The action is refused, with the reason written in the card, in two cases:

| State   | Why                                                                      |
| ------- | ------------------------------------------------------------------------ |
| a video | Compose hands Buffer an image URL. Video needs Buffer's own upload path. |
| `used`  | It has already been published. **Requeue** it first to send it again.    |

## The endpoint

Base URL: `https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/social-library`

Authenticate with the header `x-nw-social-assets-token`. The secret lives in
Vault as `navigatewealth_social_assets_token`; read it with

```sql
select decrypted_secret from vault.decrypted_secrets
where name = 'navigatewealth_social_assets_token';
```

and rotate it with `vault.update_secret` — no redeploy, and rotation revokes
every existing credential. An admin session works on the same routes, which is
how the Assets tab reads and writes them.

| Method   | Path                | What it does                                                |
| -------- | ------------------- | ----------------------------------------------------------- |
| `GET`    | `/channels`         | The three channels with available/used/archived counts.     |
| `GET`    | `/assets`           | List. `?channel=&status=&mediaType=&limit=&offset=`         |
| `POST`   | `/assets`           | Add one. Multipart file, or JSON with `sourceUrl`.          |
| `GET`    | `/assets/{id}`      | One asset.                                                  |
| `PATCH`  | `/assets/{id}`      | `caption`, `altText`, `tags`, `notes`, `status`, `channel`. |
| `POST`   | `/assets/{id}/used` | Mark published. Body: `{ "bufferPostId": "..." }`           |
| `DELETE` | `/assets/{id}`      | Remove the row and the file.                                |

### Adding an asset

With the file in hand:

```bash
curl -X POST "$BASE/social-library/assets" \
  -H "x-nw-social-assets-token: $TOKEN" \
  -F channel=instagram \
  -F file=@reel.mp4 \
  -F 'caption=What the two-pot system changes for your retirement savings' \
  -F 'altText=An advisor talking to camera' \
  -F 'tags=retirement,two-pot'
```

With only a link (the file is fetched and checked exactly as an upload is):

```bash
curl -X POST "$BASE/social-library/assets" \
  -H "x-nw-social-assets-token: $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"channel":"linkedin","sourceUrl":"https://.../chart.png",
       "caption":"Three numbers worth knowing before you retire",
       "altText":"A bar chart of retirement outcomes","tags":["retirement"]}'
```

Both return `201` with the stored asset, including the permanent `url` Buffer
will fetch at publish time.

### What is accepted

| Kind  | Formats         | Limit |
| ----- | --------------- | ----- |
| Image | PNG, JPEG, WebP | 15MB  |
| Video | MP4, MOV, WebM  | 50MB  |

**The first bytes decide, not the file name or the content type.** The bucket is
world-readable, so a file renamed to `.png` must not be able to land in it; a
declared type that disagrees with the signature is rejected rather than
trusted. `channel` is required and must be `linkedin`, `instagram` or `x`.

The video limit is the endpoint's, not the bucket's. A multipart body over 55MB
is refused by `bodyLimitMiddleware` before any route runs, and both intake paths
hold the file in memory to read its signature, so an isolate cannot take a
200MB reel whatever the bucket allows. The bucket itself stays at 200MB, which
costs nothing and leaves room for a direct-to-storage upload later. A reel that
will not fit has to be compressed — there is no larger door round the back.

### Optional fields worth sending

`caption` (a suggestion the publishing routine may rewrite), `altText`,
`tags`, `notes`, and `width`/`height`/`durationSeconds` when known — a routine
can filter on shape rather than discovering that Buffer rejected a portrait
video.

## Setting ChatGPT up

As a Custom GPT Action: import an OpenAPI schema covering `POST
/social-library/assets`, set authentication to **API Key**, header name
`x-nw-social-assets-token`, and paste the Vault secret. The JSON `sourceUrl`
form is the one to use — a GPT Action cannot post multipart.

## For the publishing routine (later)

An agent whose only reach is the Supabase connector does not need the HTTPS
endpoint at all; the same operations exist as SQL functions, and both paths go
through them so they cannot drift:

```sql
-- What is on the shelf for Instagram
select public.social_channel_assets_list('instagram');            -- defaults to available
select public.social_channel_assets_list('linkedin', 'available', 'image', 20);

-- After Buffer accepts the post
select public.social_channel_assets_mark_used('<asset id>', '<buffer post id>', 'claude-routine');

-- Put one back, or take it out of circulation
select public.social_channel_assets_set_status('<asset id>', 'available', 'admin');
```

All four functions are `service_role` only; the table has RLS on with no
policies, so no browser reaches it directly.

## Where the files live

The public bucket `make-91ed8379-social-assets`, under
`channels/<channel>/<uuid>__<slug>.<ext>`. Public because Buffer fetches media
from the URL it was handed, and for a scheduled post that can be days later —
a signed URL would have expired. The same bucket holds the weekly automation's
rendered images under the week key; a delete through this endpoint can only
touch paths under `channels/`.

## Failure modes

| Symptom                                             | Cause                                                                                  | Fix                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `401 Unauthorized`                                  | Missing or stale token.                                                                | Re-read the Vault secret; check the header name.               |
| `400 … not a supported image … or video`            | The bytes are not one of the six formats — often an HTML error page saved as an image. | Check what the `sourceUrl` actually returns.                   |
| `400 … says it is X but its contents are Y`         | The file was renamed, or the content type is wrong.                                    | Send the real type, or leave it off and let the bytes speak.   |
| `400 Images must be 15MB or smaller`                | An image over the image limit (video gets 50MB).                                       | Compress, or send it as video if that is what it is.           |
| Asset never leaves `available`                      | The publishing routine is not marking it used.                                         | It must call `mark_used` right after Buffer accepts the post.  |
| An asset shows in the tab but its preview is broken | The row outlived its file (a storage delete that failed half way).                     | Delete the asset and re-add it; the tab's delete removes both. |
