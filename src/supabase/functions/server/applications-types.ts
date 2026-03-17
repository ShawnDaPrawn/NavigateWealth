/**
 * Application Domain Types (Server-Side)
 *
 * Defines the KV-persisted shapes for applications and related entities
 * used throughout the applications service.
 *
 * These types represent what is *actually stored* in the KV store, which
 * may carry more fields than the canonical `DatabaseApplication` from
 * types.tsx (e.g. deprecation metadata, amendment history, invite tracking).
 *
 * @module applications-types
 */

import type { BackendApplicationStatus, ApplicationData } from './types.ts';

// ---------------------------------------------------------------------------
// Supabase Client
// ---------------------------------------------------------------------------

/**
 * Supabase Admin client created via `createClient(url, serviceRoleKey)`.
 *
 * Using a structural type here avoids importing the full SupabaseClient
 * generic (which requires DB schema params we don't define). Only the
 * surface area actually used by the service is described.
 */
export interface SupabaseAdminClient {
  auth: {
    admin: {
      getUserById(uid: string): Promise<{
        data: { user: SupabaseAuthUser | null };
        error: { message: string; status?: number } | null;
      }>;
      listUsers(opts?: { perPage?: number }): Promise<{
        data: { users: SupabaseAuthUser[] };
        error: { message: string } | null;
      }>;
      createUser(attrs: Record<string, unknown>): Promise<{
        data: { user: SupabaseAuthUser | null };
        error: { message: string; status?: number; code?: string } | null;
      }>;
      updateUserById(uid: string, attrs: Record<string, unknown>): Promise<{
        data: { user: SupabaseAuthUser | null };
        error: { message: string } | null;
      }>;
    };
  };
}

export interface SupabaseAuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// KV Application Entity
// ---------------------------------------------------------------------------

export interface AmendmentRecord {
  amended_by: string;
  amended_at: string;
  fields_changed: string[];
  notes: string;
}

/**
 * Application record as persisted in KV under `application:{id}`.
 *
 * Extends the canonical `DatabaseApplication` columns with runtime /
 * admin-only fields (deprecation, amendments, invite tracking, origin).
 */
export interface KvApplication {
  id: string;
  user_id: string;
  status: BackendApplicationStatus | 'declined';
  application_data: ApplicationData;
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  review_notes?: string | null;

  /** Unique human-readable application number (e.g. NW-00042) */
  application_number?: string | null;
  /** Where the application originated (self-service | admin_invite | admin_import) */
  origin?: string | null;
  /** Admin who triggered the onboarding (admin_import origin) */
  onboarded_by?: string | null;

  // Deprecation metadata
  deprecated?: boolean;
  deprecated_at?: string;
  deprecated_reason?: string;

  // Amendment audit trail
  amendments?: AmendmentRecord[];
  last_amended_at?: string;
  last_amended_by?: string;

  // Invite tracking
  invited_by?: string;
  last_invite_resent_at?: string;
  last_invite_resent_by?: string;
}

// ---------------------------------------------------------------------------
// Lightweight entities used in getStats aggregation
// ---------------------------------------------------------------------------

export interface KvTask {
  id?: string;
  status?: string;
  [key: string]: unknown;
}

export interface KvRequest {
  id?: string;
  status?: string;
  [key: string]: unknown;
}

export interface KvEsignEnvelope {
  id?: string;
  status?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Migration helpers
// ---------------------------------------------------------------------------

export interface MigrationResult {
  migrated: number;
  deleted: number;
  applications: Array<{ oldId: string; newId: string; status: string }>;
}