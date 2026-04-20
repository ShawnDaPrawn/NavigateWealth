/**
 * P6.6 — Pluggable Knowledge-Based Authentication (KBA) adapter.
 *
 * Some envelopes (high-value instructions, cession of policies, etc.)
 * warrant an identity check beyond the OTP + signature flow. This
 * module follows the same adapter pattern as `sms-service.ts`: a single
 * `KbaAdapter` interface, selected at runtime via `KBA_PROVIDER`, with
 * a safe `noop` default so the system stays functional without any
 * credentials wired in.
 *
 * Adapters implemented here are thin stubs — Smile ID and Onfido both
 * require multi-step session flows (start check → redirect signer →
 * webhook callback). Implementing them fully is out of scope; the
 * stubs just shape the return value so a future integration can drop
 * in without touching callers.
 *
 * Consumers:
 *   • Envelope settings: `kba_required` + `kba_provider` on EsignEnvelope.
 *   • Signer evidence: result stored on `EsignSigner.kba` and rendered
 *     on the completion certificate.
 */

import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('kba-service');

export type KbaProvider = 'noop' | 'smile_id' | 'onfido' | 'persona';

export interface KbaCheckInput {
  signerId: string;
  envelopeId: string;
  fullName: string;
  email: string;
  phone?: string;
  idNumber?: string;
  metadata?: Record<string, unknown>;
}

export interface KbaCheckResult {
  provider: KbaProvider;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  reference?: string;
  verifiedAt?: string;
  details?: Record<string, unknown>;
  /** Redirect URL for hosted provider flows (Smile/Onfido). */
  actionUrl?: string;
}

export interface KbaAdapter {
  readonly provider: KbaProvider;
  /** Start / perform a KBA check. Implementations may return an
   *  interim `skipped` status with `actionUrl` when the provider needs
   *  the signer to complete a hosted session. */
  runCheck(input: KbaCheckInput): Promise<KbaCheckResult>;
}

// ---------------------------------------------------------------------------
// Noop adapter (default)
// ---------------------------------------------------------------------------

const noopAdapter: KbaAdapter = {
  provider: 'noop',
  async runCheck(input) {
    log.info(`KBA(noop) skipped for signer ${input.signerId}`);
    return {
      provider: 'noop',
      status: 'skipped',
      verifiedAt: new Date().toISOString(),
      details: { reason: 'KBA_PROVIDER not configured' },
    };
  },
};

// ---------------------------------------------------------------------------
// Stub adapters — shape a future integration without committing to it.
// Each logs, returns `skipped`, and never blocks the signing flow.
// ---------------------------------------------------------------------------

function stubAdapter(provider: KbaProvider): KbaAdapter {
  return {
    provider,
    async runCheck(input) {
      log.warn(
        `KBA(${provider}) not fully implemented; returning skipped for signer ${input.signerId}`,
      );
      return {
        provider,
        status: 'skipped',
        verifiedAt: new Date().toISOString(),
        details: {
          reason: 'Provider stub — wire real SDK before enforcing KBA',
        },
      };
    },
  };
}

const adapters: Record<KbaProvider, KbaAdapter> = {
  noop: noopAdapter,
  smile_id: stubAdapter('smile_id'),
  onfido: stubAdapter('onfido'),
  persona: stubAdapter('persona'),
};

function readEnv(name: string): string | undefined {
  try {
    const g = globalThis as unknown as { Deno?: { env?: { get?(k: string): string | undefined } } };
    return g.Deno?.env?.get?.(name);
  } catch {
    return undefined;
  }
}

function resolveProvider(): KbaProvider {
  const raw = (readEnv('KBA_PROVIDER') || 'noop').toLowerCase();
  if (raw === 'smile_id' || raw === 'smile' || raw === 'smileid') return 'smile_id';
  if (raw === 'onfido') return 'onfido';
  if (raw === 'persona') return 'persona';
  return 'noop';
}

export function getActiveKbaAdapter(): KbaAdapter {
  return adapters[resolveProvider()];
}

export async function runKbaCheck(input: KbaCheckInput): Promise<KbaCheckResult> {
  const adapter = getActiveKbaAdapter();
  try {
    return await adapter.runCheck(input);
  } catch (error: unknown) {
    log.error('KBA adapter threw, returning error result:', error);
    return {
      provider: adapter.provider,
      status: 'error',
      verifiedAt: new Date().toISOString(),
      details: { message: error instanceof Error ? error.message : String(error) },
    };
  }
}

export function getKbaStatus(): { provider: KbaProvider; configured: boolean } {
  const provider = resolveProvider();
  return { provider, configured: provider !== 'noop' };
}
