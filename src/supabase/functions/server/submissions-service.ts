/**
 * Submissions Service
 * Navigate Wealth Admin Server
 *
 * Business logic for the Submissions Manager. Handles three submission
 * categories that originate from the public-facing website:
 *   - Quote Requests   (from /get-quote or contact forms)
 *   - Will Drafts      (submitted by client or initiated by admin)
 *   - Tax Planning     (completed FNA tax planning assessments)
 *
 * The `payload` field is intentionally open (Record<string, unknown>) so
 * that each source form can send its own field set without requiring a
 * schema migration here. When the source components are complete, they
 * simply POST their collected data into `payload`.
 *
 * KV key convention (§5.4):
 *   submission:{id}   →  Submission object
 *
 * All submissions are retrieved via getByPrefix('submission:') so new
 * types are discovered automatically as long as they follow the prefix.
 */

import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

// ── Types ──────────────────────────────────────────────────────────────────────

export type SubmissionType = 'quote' | 'will_draft' | 'tax_planning' | 'consultation' | 'contact' | 'client_signup';
export type SubmissionStatus = 'new' | 'pending' | 'completed' | 'archived';

export interface Submission {
  id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  /** Where the submission originated */
  sourceChannel: 'website_form' | 'admin' | 'client_portal';
  /**
   * Free-form payload from the source component.
   * Fields are intentionally not typed here — each source form
   * defines its own schema and writes into this map.
   */
  payload: Record<string, unknown>;
  /** Convenience display fields populated by the source form */
  submitterName?: string;
  submitterEmail?: string;
  submittedAt: string;
  /** Internal notes added by admin staff */
  notes?: string;
  assignedTo?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface CreateSubmissionInput {
  type: SubmissionType;
  sourceChannel: Submission['sourceChannel'];
  payload: Record<string, unknown>;
  submitterName?: string;
  submitterEmail?: string;
}

export interface UpdateSubmissionInput {
  status?: SubmissionStatus;
  notes?: string;
  assignedTo?: string;
  payload?: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function submissionKey(id: string): string {
  return `submission:${id}`;
}

function generateId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const submissionsService = {

  /**
   * List all submissions, optionally filtered by type or status.
   * Uses getByPrefix to scan all submission: keys.
   */
  async list(filters?: {
    type?: SubmissionType;
    status?: SubmissionStatus;
  }): Promise<Submission[]> {
    const entries = await kv.getByPrefix('submission:');
    let submissions = (entries as Submission[]).filter(Boolean);

    if (filters?.type) {
      submissions = submissions.filter(s => s.type === filters.type);
    }
    if (filters?.status) {
      submissions = submissions.filter(s => s.status === filters.status);
    }

    // Most recent first
    return submissions.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  },

  /**
   * Get a single submission by ID.
   */
  async getById(id: string): Promise<Submission | null> {
    return (await kv.get(submissionKey(id))) as Submission | null;
  },

  /**
   * Create a new submission (status always starts as 'new').
   */
  async create(input: CreateSubmissionInput, createdBy?: string): Promise<Submission> {
    const id = generateId();
    const now = new Date().toISOString();

    const submission: Submission = {
      id,
      type: input.type,
      status: 'new',
      sourceChannel: input.sourceChannel,
      payload: input.payload,
      submitterName: input.submitterName,
      submitterEmail: input.submitterEmail,
      submittedAt: now,
      updatedAt: now,
      updatedBy: createdBy,
    };

    await kv.set(submissionKey(id), submission);
    return submission;
  },

  /**
   * Update a submission's status, notes, or payload.
   * Multi-entry consistency is not required here as each submission
   * is a single KV entry.
   */
  async update(id: string, input: UpdateSubmissionInput, updatedBy?: string): Promise<Submission> {
    const existing = await kv.get(submissionKey(id)) as Submission | null;
    if (!existing) {
      throw new Error(`Submission not found: ${id}`);
    }

    const updated: Submission = {
      ...existing,
      ...(input.status !== undefined && { status: input.status }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.assignedTo !== undefined && { assignedTo: input.assignedTo }),
      ...(input.payload !== undefined && { payload: { ...existing.payload, ...input.payload } }),
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await kv.set(submissionKey(id), updated);
    return updated;
  },

  /**
   * Archive a submission (soft delete — status set to 'archived').
   */
  async archive(id: string, updatedBy?: string): Promise<Submission> {
    return this.update(id, { status: 'archived' }, updatedBy);
  },

  /**
   * Hard delete a submission (compliance-sensitive — use with caution).
   */
  async delete(id: string): Promise<void> {
    await kv.del(submissionKey(id));
  },

  /**
   * Count submissions with status 'new' — used by the nav badge.
   */
  async countNew(): Promise<number> {
    const all = await this.list({ status: 'new' });
    return all.length;
  },
};