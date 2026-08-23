/**
 * Shared ground for the communication modules: id and name helpers, admin
 * display-name resolution, and the stored shapes the modules exchange.
 */
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

export function generateId(): string {
  return crypto.randomUUID();
}

export function splitFullName(fullName?: string): { firstName: string; surname: string } {
  const value = (fullName || '').trim();
  if (!value) {
    return { firstName: '', surname: '' };
  }

  const [firstName, ...rest] = value.split(/\s+/);
  return {
    firstName: firstName || '',
    surname: rest.join(' ').trim(),
  };
}

export const ADMIN_USER_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLikelyAuthUserId(id: string): boolean {
  return ADMIN_USER_ID_UUID_RE.test(id);
}

export async function resolveAdminDisplayName(adminUserId: string): Promise<string> {
  const id = (adminUserId || '').trim();
  if (!id || id === 'system') return 'System';
  if (id === 'admin') return 'Administrator';
  if (!isLikelyAuthUserId(id)) return id;

  try {
    const profile = (await kv.get(`personnel:profile:${id}`)) as Record<string, unknown> | null;
    if (profile) {
      const fn = String(profile.firstName || '');
      const ln = String(profile.lastName || '');
      const name = `${fn} ${ln}`.trim();
      if (name) return name;
      const em = String(profile.email || '').trim();
      if (em) return em;
    }
  } catch {
    // ignore KV errors
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const {
      data: { user },
      error,
    } = await supabase.auth.admin.getUserById(id);
    if (!error && user) {
      const meta = (user.user_metadata || {}) as Record<string, unknown>;
      const full =
        (typeof meta.full_name === 'string' && meta.full_name) ||
        (typeof meta.name === 'string' && meta.name) ||
        (typeof meta.display_name === 'string' && meta.display_name);
      if (full && String(full).trim()) return String(full).trim();
      if (user.email) return user.email;
    }
  } catch {
    // ignore auth lookup errors
  }

  return 'Staff member';
}

export async function resolveAdminDisplayNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.map((x) => (x || '').trim()).filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (id) => [id, await resolveAdminDisplayName(id)] as const),
  );
  return new Map(entries);
}

export function stripHtmlForSearch(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export interface StoredAttachment {
  name: string;
  url?: string;
  content?: string;
  type?: string;
  [key: string]: unknown;
}

export interface CommHistoryEntry {
  category?: string;
  recipients?: string[];
  sent_at?: string;
  [key: string]: unknown;
}

export interface CommLogEntry {
  id?: string;
  recipient_id?: string;
  [key: string]: unknown;
}

export interface SimpleClient {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  surname: string;
  email: string;
  accountType: string;
  status: string;
  hasEmailOptIn: boolean;
  hasWhatsAppOptIn: boolean;
}
