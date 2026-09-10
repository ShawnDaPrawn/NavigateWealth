---
name: buffer
description: >-
  Schedules and manages Buffer social posts via the Buffer CLI and the Navigate
  Wealth Social Media module. Use when the user mentions Buffer, Buffer CLI,
  social scheduling, Instagram/Facebook/LinkedIn/X via Buffer, or posting from
  the admin Social Media & Marketing section.
---

# Buffer

Navigate Wealth talks to Buffer two ways:

1. **App** — GraphQL proxy in the Edge Function (`/buffer/*`), UI on Social Media → Connected Profiles.
2. **CLI** — `@bufferapp/cli` on this machine for agent/terminal work. Do not add it as a SPA dependency.

Never commit `BUFFER_API_KEY`. Prefer the Edge Function secret; admins can also paste a key in Connected Profiles (stored server-side).

## CLI

```bash
buffer --output json account
buffer --output json channels list --organization-id <org-id>
buffer posts create --json "<payload>" --dry-run
buffer schema describe posts create
```

Env `BUFFER_API_KEY` overrides repo/global config. Repo config is `.buffer/config.json` (no apiKey). Timezone: `Africa/Johannesburg`.

Exit codes: 0 ok, 2 usage, 3 API (incl. 429), 4 auth.

## Scheduling rules

- `mode: addToQueue` = next slot. `shareNow` = publish now. `customScheduled` requires `dueAt` with offset.
- `schedulingType: automatic` for hands-off publish. `notification` only pings the mobile app.
- Empty `text` with no assets is rejected. Instagram needs an image/video plus `metadata.instagram.type` and `shouldShareToFeed`.
- Serialise mutations. On 429, sleep `Retry-After`, retry once, then back off.

## App wiring

- Frontend: `src/components/admin/modules/social-media/components/BufferConnector.tsx`
- API client: `src/components/admin/modules/social-media/api/bufferApi.ts`
- Server: `buffer-routes.ts` → `buffer-service.ts` → `https://api.buffer.com`
- Local compose/publish/schedule also calls `BufferService.pushLocalPost` when Buffer is connected.

Discover payloads with `buffer schema describe <command>`. Dry-run generated mutations before sending.
