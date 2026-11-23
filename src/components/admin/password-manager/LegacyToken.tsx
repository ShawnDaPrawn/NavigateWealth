import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import type { VaultSummary } from '../../../shared/password-manager';
import { getModuleUrl } from '../../../utils/api/config';
import { issueLegacyToken, revokeLegacyToken, type IssuedToken } from './vaultApi';
import { ErrorLine, useAction } from './ui';

/** The original one-credential MCP bearer token, kept for existing clients. */
export default function LegacyToken({
  item,
  onChanged,
}: {
  item: VaultSummary;
  onChanged: () => void;
}) {
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const { busy, error, run } = useAction();
  const connected = Boolean(
    item.connectionExpiresAt && Date.parse(item.connectionExpiresAt) > Date.now(),
  );
  return (
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Legacy token</summary>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 font-medium">
          Streamable HTTP endpoint
          <Input
            readOnly
            value={getModuleUrl('mcp/password-vault')}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <ErrorLine>{error}</ErrorLine>
        {issued ? (
          <>
            <p>
              Save this token in your MCP client’s bearer-token setting. It is shown once and
              expires on {new Date(issued.expiresAt).toLocaleDateString()}.
            </p>
            <label className="grid gap-1 font-medium">
              Bearer token
              <Input
                readOnly
                value={issued.token}
                autoComplete="off"
                onFocus={(e) => e.target.select()}
              />
            </label>
            <Button variant="ghost" className="justify-self-start" onClick={() => setIssued(null)}>
              Done
            </Button>
          </>
        ) : (
          <>
            <p>
              {connected
                ? 'A token is active until ' +
                  new Date(item.connectionExpiresAt!).toLocaleDateString() +
                  '. Replacing it disconnects the previous client.'
                : 'Create a 90-day bearer token for this credential only.'}{' '}
              New set-ups should use an AI connection instead.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setIssued(await issueLegacyToken(item.id, item.revision));
                    onChanged();
                  })
                }
              >
                {connected ? 'Replace token' : 'Create token'}
              </Button>
              {connected && (
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await revokeLegacyToken(item.id, item.revision);
                      onChanged();
                    })
                  }
                >
                  Revoke token
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
