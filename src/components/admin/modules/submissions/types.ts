/**
 * Submissions Manager — Types
 *
 * All types for the Submissions Manager module. The `payload` field is
 * intentionally open to accommodate any source form's field set without
 * requiring changes here when new form components are wired up.
 *
 * §9.1 — Strict typing except where flexibility is explicit design intent.
 * §5.2 — Public types only; internal UI types kept local to components.
 */

// ── Enumerations ──────────────────────────────────────────────────────────────

export type SubmissionType = 'quote' | 'will_draft' | 'tax_planning' | 'consultation' | 'contact' | 'client_signup';
export type SubmissionStatus = 'new' | 'pending' | 'completed' | 'archived';
export type SubmissionSourceChannel = 'website_form' | 'admin' | 'client_portal';

// ── Core Entities ─────────────────────────────────────────────────────────────

/**
 * A single incoming submission.
 *
 * `payload` is a flexible key-value store populated by the source form.
 * Fields within payload are not typed here — each form component defines
 * its own schema and posts it into payload. The Submissions Manager renders
 * payload fields dynamically so no changes are needed here when new forms
 * are wired up.
 */
export interface Submission {
  id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  sourceChannel: SubmissionSourceChannel;
  /**
   * Free-form data from the source form.
   * Rendered dynamically in the detail drawer — no hardcoded field access.
   */
  payload: Record<string, unknown>;
  submitterName?: string;
  submitterEmail?: string;
  submittedAt: string;
  notes?: string;
  assignedTo?: string;
  updatedAt: string;
  updatedBy?: string;
}

// ── API Input/Output Types ────────────────────────────────────────────────────

export interface CreateSubmissionInput {
  type: SubmissionType;
  sourceChannel: SubmissionSourceChannel;
  payload: Record<string, unknown>;
  submitterName?: string;
  submitterEmail?: string;
}

export interface UpdateSubmissionInput {
  status?: SubmissionStatus;
  notes?: string;
  assignedTo?: string;
  /** Merges into existing payload — does not replace it */
  payload?: Record<string, unknown>;
}

export interface SubmissionsFilters {
  type?: SubmissionType;
  status?: SubmissionStatus;
  search?: string;
}

// ── Column Definition ─────────────────────────────────────────────────────────

export interface SubmissionColumn {
  id: SubmissionStatus;
  label: string;
  description: string;
}