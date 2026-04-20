/**
 * P8.6 — Per-firm signer-page branding.
 *
 * Each firm can configure a small branding bundle (display name, logo
 * URL, accent colour, support email) that the signer page reads once
 * at session-start. The accent colour drives the gradient strip and
 * primary button hue; the logo replaces the generic "Navigate Wealth"
 * lockup. If a firm has no branding record we fall back to defaults
 * baked into the signer UI so unbranded firms keep working unchanged.
 *
 * Storage: KV at `esign:branding:{firmId}`.
 *
 * The accent colour is validated as a 6-digit hex (`#RRGGBB`) and the
 * logo URL must be HTTPS — both are surfaced to anonymous signer
 * traffic, so we won't accept arbitrary `javascript:` strings or
 * non-hex values. The signer page also clamps the accent colour into
 * a high-contrast range when rendering.
 */

import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';

export interface FirmBranding {
  firm_id: string;
  display_name: string | null;
  logo_url: string | null;
  accent_hex: string | null;
  support_email: string | null;
  updated_at: string;
}

export interface FirmBrandingInput {
  display_name?: string | null;
  logo_url?: string | null;
  accent_hex?: string | null;
  support_email?: string | null;
}

const HEX_RE = /^#([0-9a-fA-F]{6})$/;
const HTTPS_URL_RE = /^https:\/\/[^\s]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitise(input: FirmBrandingInput): {
  display_name: string | null;
  logo_url: string | null;
  accent_hex: string | null;
  support_email: string | null;
} {
  const display = (input.display_name ?? '').trim();
  const logo = (input.logo_url ?? '').trim();
  const accent = (input.accent_hex ?? '').trim();
  const support = (input.support_email ?? '').trim();

  if (logo && !HTTPS_URL_RE.test(logo)) {
    throw new Error('logo_url must be an https:// URL');
  }
  if (accent && !HEX_RE.test(accent)) {
    throw new Error('accent_hex must be a 6-digit hex like #4f46e5');
  }
  if (support && !EMAIL_RE.test(support)) {
    throw new Error('support_email must be a valid email address');
  }

  return {
    display_name: display ? display.slice(0, 80) : null,
    logo_url: logo || null,
    accent_hex: accent ? accent.toLowerCase() : null,
    support_email: support || null,
  };
}

export async function getFirmBranding(firmId: string): Promise<FirmBranding | null> {
  if (!firmId) return null;
  const record = await kv.get(EsignKeys.firmBranding(firmId));
  if (!record || typeof record !== 'object') return null;
  return record as FirmBranding;
}

export async function setFirmBranding(
  firmId: string,
  input: FirmBrandingInput,
): Promise<FirmBranding> {
  if (!firmId) throw new Error('firm_id required');
  const clean = sanitise(input);
  const record: FirmBranding = {
    firm_id: firmId,
    ...clean,
    updated_at: new Date().toISOString(),
  };
  await kv.set(EsignKeys.firmBranding(firmId), record);
  return record;
}

export async function deleteFirmBranding(firmId: string): Promise<void> {
  if (!firmId) return;
  await kv.del(EsignKeys.firmBranding(firmId));
}

/**
 * Public projection: only the fields safe to ship to anonymous signer
 * traffic. Strips `firm_id` and `updated_at` so the signer JSON stays
 * minimal. Returns `null` when nothing is configured so the signer UI
 * falls back to its built-in defaults.
 */
export interface PublicBranding {
  display_name: string | null;
  logo_url: string | null;
  accent_hex: string | null;
  support_email: string | null;
}

export function toPublicBranding(record: FirmBranding | null): PublicBranding | null {
  if (!record) return null;
  if (!record.display_name && !record.logo_url && !record.accent_hex && !record.support_email) {
    return null;
  }
  return {
    display_name: record.display_name,
    logo_url: record.logo_url,
    accent_hex: record.accent_hex,
    support_email: record.support_email,
  };
}
