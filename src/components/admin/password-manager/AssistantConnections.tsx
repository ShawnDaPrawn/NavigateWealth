import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { api } from '../../../utils/api/client';
import type { ConnectionInfo } from '../../../shared/broker-operations';
import { ops, options, consentRequest } from './portalApi';

export const endpoint = 'https://www.navigatewealth.co/mcp/broker-operations';
export default function AssistantConnections({
  connections,
  reload,
}: {
  connections: ConnectionInfo[];
  reload: () => void;
}) {
  const [name, setName] = useState('Claude'),
    [auth, setAuth] = useState('oauth'),
    [uri, setUri] = useState(''),
    [issued, setIssued] = useState<{
      client: ConnectionInfo;
      clientSecret?: string;
      token?: string;
    } | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [grant, setGrant] = useState(consentRequest);
  const [details, setDetails] = useState<ConnectionInfo | null>(null);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }
  function dismiss() {
    sessionStorage.removeItem('nw-broker-consent');
    setGrant(null);
    setDetails(null);
  }
  return (
    <div className="space-y-4">
      {grant && (
        <section className="space-y-2 rounded-lg border p-3">
          <h3 className="font-semibold">Assistant connection request</h3>
          {details ? (
            <>
              <p>
                {details.name} is requesting access to linked accounts, reporting workflows and its
                own jobs. It can start report runs and see their results.
              </p>
              <p className="break-all text-sm">{details.redirectUri}</p>
              <Button
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    const r = await api.post<{ redirect: string }>(
                      ops + '/consent/approve',
                      grant,
                      options,
                    );
                    dismiss();
                    window.location.assign(r.redirect);
                  })
                }
              >
                Approve connection
              </Button>
            </>
          ) : (
            <Button
              disabled={busy}
              onClick={() =>
                void act(async () =>
                  setDetails(
                    await api.post<ConnectionInfo>(ops + '/consent/details', grant, options),
                  ),
                )
              }
            >
              Review request
            </Button>
          )}
          <Button variant="ghost" onClick={dismiss}>
            Dismiss
          </Button>
        </section>
      )}
      <label className="grid gap-1 text-sm font-medium">
        Streamable HTTP server URL
        <Input readOnly value={endpoint} onFocus={(e) => e.target.select()} />
      </label>
      <p className="text-sm">
        In Claude, add a custom connector. In ChatGPT, create an MCP app in the workspace’s
        developer settings. Enter the server URL, then register the callback URL shown by that
        client here. Use the generated client ID and secret in the client’s OAuth settings.
      </p>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            const d = await api.post<NonNullable<typeof issued>>(
              ops + '/connections',
              { name, redirectUri: auth === 'oauth' ? uri : '' },
              options,
            );
            setIssued(d);
            reload();
          });
        }}
      >
        <label className="grid gap-1 text-sm">
          Connection name
          <Input maxLength={80} required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Authentication
          <select
            value={auth}
            onChange={(e) => {
              setAuth(e.target.value);
              setIssued(null);
            }}
          >
            <option value="oauth">OAuth with PKCE</option>
            <option value="bearer">Bearer token for a custom client</option>
          </select>
        </label>
        {auth === 'oauth' && (
          <label className="grid gap-1 text-sm">
            Exact client callback URL
            <Input type="url" required value={uri} onChange={(e) => setUri(e.target.value)} />
          </label>
        )}
        <Button className="justify-self-start" disabled={busy}>
          Create connection
        </Button>
      </form>
      {issued && (
        <div className="space-y-2 rounded-lg border p-3">
          <p>Copy these settings now. The secret is shown once.</p>
          {issued.clientSecret && (
            <label className="grid text-sm">
              Client ID
              <Input readOnly value={issued.client.id} onFocus={(e) => e.target.select()} />
            </label>
          )}
          <label className="grid text-sm">
            {issued.clientSecret ? 'Client secret' : 'Bearer token'}
            <Input
              readOnly
              value={issued.clientSecret ?? issued.token}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <Button variant="ghost" onClick={() => setIssued(null)}>
            Done
          </Button>
        </div>
      )}
      {connections.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 border-t py-2">
          <div>
            <b>{row.name}</b>
            <p className="text-xs">
              {row.lastUsed
                ? 'Last connected ' + new Date(row.lastUsed).toLocaleString()
                : 'Awaiting first connection'}{' '}
              · Expires {new Date(row.expiresAt).toLocaleDateString()}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await api.delete(ops + '/connections/' + row.id, options);
                if (issued?.client.id === row.id) setIssued(null);
                reload();
              })
            }
          >
            Revoke
          </Button>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
