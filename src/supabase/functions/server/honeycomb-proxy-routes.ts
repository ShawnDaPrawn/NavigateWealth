import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { ProxySchema } from './honeycomb-validation.ts';
import { HONEYCOMB_API_URL, getHeaders } from './honeycomb-utils.ts';

const app = new Hono();
const log = createModuleLogger('honeycomb-proxy');

app.post('/proxy', async (c) => {
  try {
    const input = ProxySchema.parse(await c.req.json());
    const safePath = input.path.startsWith('/') ? input.path : `/${input.path}`;
    const url = `${HONEYCOMB_API_URL}${safePath}`;

    log.info(`Proxying ${input.method} ${url}`);

    const response = await fetch(url, {
      method: input.method,
      headers: getHeaders(),
      body: input.body ? JSON.stringify(input.body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      log.error(`Honeycomb proxy error: ${response.status}`, { data });
      return c.json(
        { error: 'Honeycomb API Error', details: data, status: response.status },
        response.status as number,
      );
    }

    return c.json(data);
  } catch (e: unknown) {
    log.error('Proxy error:', e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

export default app;
