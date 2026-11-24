/**
 * Client for the browser host that runs skill sessions. The host is a small
 * Playwright service we operate (scripts/vault-browser-host.mjs): it signs in
 * with the credential itself, keeps the page fenced to the allowed origins and
 * never returns the contents of password fields. The Edge Function cannot run
 * a browser, so until NW_BROWSER_HOST_URL and NW_BROWSER_HOST_TOKEN are set,
 * skills answer with a clear "not configured" error and automated workflows
 * (the broker-reporting runner) keep working.
 */

export interface PageControl {
  id: string;
  label: string;
  kind: string;
}
export interface PageView {
  url: string;
  title: string;
  text: string;
  controls: PageControl[];
}
export interface SessionStart {
  runId: string;
  loginUrl: string;
  username: string;
  password: string;
  otpSecret?: string;
  allowedOrigins: string[];
}
export interface HostAction {
  action: 'click' | 'fill' | 'select' | 'upload' | 'goto' | 'wait';
  target?: string;
  value?: string;
}

export class HostUnavailable extends Error {}

function config() {
  const url = Deno.env.get('NW_BROWSER_HOST_URL');
  const token = Deno.env.get('NW_BROWSER_HOST_TOKEN');
  if (!url || !token)
    throw new HostUnavailable(
      'Interactive skills need the browser host, which is not configured yet. Automated workflows still run.',
    );
  return { url: url.replace(/\/$/, ''), token };
}

async function call<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const { url, token } = config();
  const res = await fetch(url + path, {
    method: init.method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new HostUnavailable(
      typeof detail?.error === 'string' ? detail.error : 'The browser host did not respond.',
    );
  }
  return (await res.json()) as T;
}

export const browserHost = {
  start: (input: SessionStart) =>
    call<{ sessionId: string; page: PageView }>('/sessions', { method: 'POST', body: input }),
  read: (sessionId: string) =>
    call<PageView>('/sessions/' + encodeURIComponent(sessionId), { method: 'GET' }),
  act: (sessionId: string, action: HostAction) =>
    call<{ page: PageView; message: string }>(
      '/sessions/' + encodeURIComponent(sessionId) + '/actions',
      { method: 'POST', body: action },
    ),
  close: (sessionId: string) =>
    call<{ ok: boolean }>('/sessions/' + encodeURIComponent(sessionId), { method: 'DELETE' }),
};

/** The host fences origins too; this is the second fence, on our side. */
export function originAllowed(pageUrl: string, allowed: string[]) {
  try {
    return allowed.includes(new URL(pageUrl).origin);
  } catch {
    return false;
  }
}

/** Belt and braces: drop anything that looks like a password control. */
export function scrubPage(page: PageView): PageView {
  return {
    ...page,
    controls: page.controls.filter((c) => c.kind !== 'password'),
  };
}
