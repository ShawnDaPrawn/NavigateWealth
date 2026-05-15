# OpenClaw Gateway

Navigate Wealth connects to OpenClaw through a narrow gateway rather than
giving the VPS broad app credentials.

The gateway is intentionally general. OTP handling, email helpers, provider
automation, calendar actions, and future assistant workflows should be added as
separate capabilities behind this gateway instead of creating one-off OpenClaw
routes.

## App endpoint

```text
POST /make-server-91ed8379/openclaw/events
```

Headers:

```text
X-OpenClaw-Secret: <NW_OPENCLAW_GATEWAY_SECRET>
Content-Type: application/json
```

Body:

```json
{
  "capability": "integration.proposal",
  "source": "hostinger-openclaw",
  "eventType": "future.integration.request",
  "correlationId": "optional-external-id",
  "payload": {
    "summary": "Describe the requested integration here"
  }
}
```

## Environment variables

Set these on the Supabase Edge Function:

```bash
NW_OPENCLAW_GATEWAY_SECRET=<random shared secret used only by OpenClaw>
NW_OPENCLAW_ALLOWED_CAPABILITIES=system.heartbeat,integration.proposal,message.intake
```

Default allowed capabilities are deliberately non-mutating:

- `system.heartbeat`
- `integration.proposal`
- `message.intake`

Future capabilities must be explicitly allow-listed before OpenClaw can use
them. For example, `provider.otp.submit` exists as a reserved future capability
but is not enabled by default.

## VPS configuration shape

OpenClaw should keep its LLM provider key separate from its Navigate Wealth
gateway secret.

Use separate variables:

```bash
OPENAI_API_KEY=<llm-provider-key>
NAVIGATE_WEALTH_OPENCLAW_ENDPOINT=https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/openclaw/events
NW_OPENCLAW_GATEWAY_SECRET=<same random shared secret configured in Supabase>
```

Do not put Supabase service-role keys, GitHub tokens, admin session tokens, or
provider portal credentials on the OpenClaw VPS unless a later capability
specifically requires them and has its own review.

## OpenAI-compatible HTTP (Cursor and other OpenAI clients)

OpenClaw can serve standard `POST /v1/chat/completions` (and related endpoints)
on the **same gateway port** as the WebSocket gateway. That surface is
**disabled by default**; turn it on in OpenClaw gateway config on the VPS.
Official reference:
[OpenAI HTTP API](https://documentation.openclaw.ai/gateway/openai-http-api).

### 1. Enable on the VPS

In `openclaw` gateway config (see OpenClaw configuration docs for file location
on your install), set:

```json5
{
  gateway: {
    http: {
      endpoints: {
        chatCompletions: { enabled: true },
      },
    },
  },
}
```

Restart the gateway so the change applies.

### 2. Reach the gateway from your PC

Keep the gateway bound to loopback on the VPS and use an SSH tunnel (same port
you already forward for ACP/MCP), for example:

```bash
ssh -L 18789:127.0.0.1:18789 navigate-openclaw
```

Do not expose this HTTP surface on a public interface; the bearer token is
full operator access for that gateway instance.

### 3. Cursor (custom OpenAI-compatible URL)

After the tunnel is up, configure Cursor’s OpenAI-compatible integration (exact
UI labels vary by version):

| Setting | Value |
| --- | --- |
| Base URL / API URL | `http://127.0.0.1:18789/v1` |
| API key | Your **gateway** bearer token (`gateway.auth.token` / `OPENCLAW_GATEWAY_TOKEN`), not a raw provider key |
| Model | `openclaw/default` (stable alias for the default agent) or `openclaw/<agent-name>` |

OpenClaw routes the OpenAI `model` field to **agents**, not raw provider ids.
To pin a **backend** provider/model for a request, use the HTTP header
`x-openclaw-model` (for example `deepseek/deepseek-v4-flash`) if your client
supports custom headers; otherwise the agent’s configured default in OpenClaw
applies.

### 4. Quick smoke test

With the tunnel running and chat completions enabled:

```bash
curl -sS http://127.0.0.1:18789/v1/models \
  -H 'Authorization: Bearer YOUR_GATEWAY_TOKEN'
```

You should see agent targets such as `openclaw/default`. Then:

```bash
curl -sS http://127.0.0.1:18789/v1/chat/completions \
  -H 'Authorization: Bearer YOUR_GATEWAY_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"model":"openclaw/default","messages":[{"role":"user","content":"hi"}]}'
```

## Control model

The initial gateway records events only. It does not update clients, policies,
tasks, provider jobs, documents, users, or admin settings.

When adding a future capability:

1. Add it to the capability registry.
2. Decide whether it mutates app data.
3. Add a dedicated handler for that one capability.
4. Keep it disabled until `NW_OPENCLAW_ALLOWED_CAPABILITIES` includes it.
5. Add regression tests for the allowed and rejected paths.
