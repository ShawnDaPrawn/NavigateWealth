import type { ZodError } from 'npm:zod';
import { getErrMsg } from './shared-logger-utils.ts';

export const HONEYCOMB_API_URL = 'https://publicapi.honeycombonline.co.za';
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export const routeError = (c: { json: (body: unknown, status: number) => unknown }, e: unknown) => {
  const isZod = e instanceof Error && e.name === 'ZodError';
  return c.json({ error: isZod ? (e as ZodError).errors : getErrMsg(e) }, isZod ? 400 : 500);
};

export const getHeaders = () => {
  const apiKey = Deno.env.get('HONEYCOMB_API_KEY');
  if (!apiKey) throw new Error('HONEYCOMB_API_KEY is not configured');
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
};
