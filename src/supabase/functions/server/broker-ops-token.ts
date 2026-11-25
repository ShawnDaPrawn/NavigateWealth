import { Hono } from 'npm:hono';
import { Buffer } from 'node:buffer';
import { exchange } from './broker-ops-auth.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('mcp-oauth');
const app = new Hono();
app.post('/', async (c) => {
  c.header('Cache-Control', 'no-store');
  if (!c.req.header('Content-Type')?.toLowerCase().startsWith('application/x-www-form-urlencoded'))
    return c.json({ error: 'invalid_request' }, 400);
  const data = new URLSearchParams(await c.req.text());
  const basic = c.req.header('Authorization');
  if (basic?.startsWith('Basic ')) {
    const credentials = Buffer.from(basic.slice(6), 'base64').toString();
    const i = credentials.indexOf(':');
    if (i < 1) return c.json({ error: 'invalid_client' }, 401);
    data.set('client_id', credentials.slice(0, i));
    data.set('client_secret', credentials.slice(i + 1));
  }
  const fields = [...new Set(data.keys())].filter(
    (k) => k !== 'client_id' && k !== 'client_secret',
  );
  const result = await exchange(data);
  // Field names and outcome only: codes, verifiers and secrets are never logged.
  log.info('Token request', {
    auth: basic?.startsWith('Basic ') ? 'basic' : data.has('client_secret') ? 'post' : 'none',
    grantType: data.get('grant_type'),
    fields,
    resource: data.get('resource'),
    ok: Boolean(result),
  });
  return result ? c.json(result) : c.json({ error: 'invalid_grant' }, 400);
});
export default app;
