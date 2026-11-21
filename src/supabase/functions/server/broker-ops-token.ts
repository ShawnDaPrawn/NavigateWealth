import { Hono } from 'npm:hono';
import { Buffer } from 'node:buffer';
import { exchange } from './broker-ops-auth.ts';
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
  const result = await exchange(data);
  return result ? c.json(result) : c.json({ error: 'invalid_grant' }, 400);
});
export default app;
