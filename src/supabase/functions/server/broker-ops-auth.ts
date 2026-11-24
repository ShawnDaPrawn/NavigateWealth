import { Buffer } from 'node:buffer';
import { z } from 'npm:zod@4.6.5';
import {
  clients,
  grants,
  takeGrant,
  updateClient,
  clientInfo,
  type Client,
} from './repositories/broker-ops.ts';
import { constantTimeEqual } from './crypto-utils.ts';
import { sha256Hex } from './sha256.ts';
import { resourceUrl, OperationError } from './broker-ops-jobs.ts';
import {
  oauthConnection,
  updateConnection as updateVaultConnection,
  vaultResourceUrl,
  VAULT_TOKEN_PREFIX,
} from './vault-connections.ts';
export const random = () =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
export const clientInput = z.object({
  name: z.string().trim().min(1).max(80),
  redirectUri: z
    .string()
    .url()
    .max(2048)
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'https:' && !u.username && !u.password && !u.hash;
      } catch {
        return false;
      }
    })
    .or(z.literal('')),
});
export const oauthInput = z.object({
  client_id: z.uuid(),
  redirect_uri: z.string().max(2048),
  state: z.string().min(1).max(1024),
  code_challenge_method: z.literal('S256'),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  response_type: z.literal('code'),
  resource: z.enum([resourceUrl, vaultResourceUrl]).optional(),
  scope: z.enum(['portal.jobs', 'vault']).optional(),
});

/**
 * One authorization server for both MCP resources: broker reporting clients
 * and password-manager connections. A client id belongs to exactly one.
 */
async function findClient(id: string) {
  const broker = await clients.get(id);
  if (broker)
    return {
      kind: 'broker' as const,
      row: broker,
      resource: resourceUrl,
      scope: 'portal.jobs',
      prefix: 'nwop_',
      update: (patch: { tokenHash: string; tokenExpires: number }) => updateClient(broker, patch),
    };
  const vault = await oauthConnection(id);
  if (vault)
    return {
      kind: 'vault' as const,
      row: vault,
      resource: vaultResourceUrl,
      scope: 'vault',
      prefix: VAULT_TOKEN_PREFIX,
      update: async (patch: { tokenHash: string; tokenExpires: number }) =>
        Boolean(await updateVaultConnection(vault, patch)),
    };
  return null;
}
export async function issueClient(name: string, redirectUri: string) {
  const id = crypto.randomUUID(),
    secret = random(),
    token = 'nwop_' + id + '.' + random();
  const now = Date.now(),
    expiresAt = new Date(now + 90 * 86400000).toISOString();
  const row = {
    id,
    name,
    redirectUri,
    createdAt: new Date(now).toISOString(),
    lastUsed: null,
    expiresAt,
    secretHash: await sha256Hex(secret),
    tokenHash: await sha256Hex(token),
    tokenExpires: Date.parse(expiresAt),
  };
  await clients.put(id, row);
  return {
    client: clientInfo(row),
    clientSecret: redirectUri ? secret : undefined,
    token: redirectUri ? undefined : token,
  };
}
export async function authenticateConnection(value: string) {
  const m = /^Bearer (nwop_([0-9a-f-]{36})\.[A-Za-z0-9_-]{43})$/i.exec(value);
  if (!m) return null;
  const row = await clients.get(m[2]);
  if (
    !row ||
    row.tokenExpires <= Date.now() ||
    Date.parse(row.expiresAt) <= Date.now() ||
    !constantTimeEqual(row.tokenHash, await sha256Hex(m[1]))
  )
    return null;
  if (!row.lastUsed || Date.now() - Date.parse(row.lastUsed) > 60000)
    await updateClient(row, { lastUsed: new Date().toISOString() });
  return row.id;
}
export async function consentTarget(input: z.infer<typeof oauthInput>) {
  const target = await findClient(input.client_id);
  const row = target?.row;
  if (
    !target ||
    !row ||
    Date.parse(row.expiresAt) <= Date.now() ||
    !row.redirectUri ||
    input.redirect_uri !== row.redirectUri
  )
    throw new OperationError('Unknown or expired client or callback.');
  return target;
}
export async function checkConsent(input: z.infer<typeof oauthInput>): Promise<Client> {
  return (await consentTarget(input)).row;
}
export async function approve(input: z.infer<typeof oauthInput>) {
  const target = await consentTarget(input);
  const row = target.row;
  const code = random();
  await grants.put(await sha256Hex(code), {
    clientId: row.id,
    redirectUri: row.redirectUri,
    challenge: input.code_challenge,
    expires: Date.now() + 120000,
    resource: target.resource,
  });
  const url = new URL(row.redirectUri);
  url.searchParams.set('code', code);
  url.searchParams.set('state', input.state);
  return url.href;
}
export async function exchange(data: URLSearchParams) {
  const id = data.get('client_id') ?? '',
    code = data.get('code') ?? '',
    verifier = data.get('code_verifier') ?? '';
  if (
    !z.uuid().safeParse(id).success ||
    data.get('grant_type') !== 'authorization_code' ||
    !/^[-._~A-Za-z0-9]{43,128}$/.test(verifier) ||
    !/^[A-Za-z0-9_-]{43}$/.test(code)
  )
    return null;
  const target = await findClient(id);
  const row = target?.row;
  if (
    !target ||
    !row ||
    (data.has('resource') && data.get('resource') !== target.resource) ||
    Date.parse(row.expiresAt) <= Date.now() ||
    !constantTimeEqual(row.secretHash, await sha256Hex(data.get('client_secret') ?? ''))
  )
    return null;
  const hash = await sha256Hex(code);
  const grant = await grants.get(hash);
  const challenge = Buffer.from(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  ).toString('base64url');
  if (
    !grant ||
    grant.expires <= Date.now() ||
    grant.clientId !== id ||
    grant.redirectUri !== data.get('redirect_uri') ||
    grant.resource !== target.resource ||
    !constantTimeEqual(grant.challenge, challenge) ||
    !(await takeGrant(hash))
  )
    return null;
  const token = target.prefix + id + '.' + random();
  const ttl = Math.min(30 * 86400, Math.floor((Date.parse(row.expiresAt) - Date.now()) / 1000));
  if (
    !(await target.update({
      tokenHash: await sha256Hex(token),
      tokenExpires: Date.now() + ttl * 1000,
    }))
  )
    return null;
  return { access_token: token, token_type: 'Bearer', scope: target.scope, expires_in: ttl };
}
