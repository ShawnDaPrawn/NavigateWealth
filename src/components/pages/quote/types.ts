/**
 * Get a Quote Flow — Shared Types
 *
 * Types shared between the Quote Gateway (Page 1) and Product Quote (Page 2).
 * §5.2 — Single source of truth for quote flow types.
 */

// ── Service identifiers ───────────────────────────────────────────────────────

export type QuoteServiceId =
  | 'risk-management'
  | 'medical-aid'
  | 'retirement-planning'
  | 'investment-management'
  | 'employee-benefits'
  | 'tax-planning'
  | 'estate-planning';

// ── Provider display ──────────────────────────────────────────────────────────

export interface QuoteProvider {
  id: string;
  name: string;
  logo: string | null;
}

// ── Form field definition ─────────────────────────────────────────────────────

export interface QuoteFormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'number';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** When true, field spans full width in the grid */
  fullWidth?: boolean;
}

// ── Service configuration ─────────────────────────────────────────────────────

export interface QuoteServiceConfig {
  id: QuoteServiceId;
  label: string;
  shortLabel: string;
  icon: string; // Lucide icon slug — resolved at render time
  description: string;
  heroDescription: string;
  providers: QuoteProvider[];
  productFields: QuoteFormField[];
  /** Colour accent for the hero gradient */
  accentColor: string;
}

// ── Contact details (shared between pages) ────────────────────────────────────

export interface QuoteContactDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

// ── Router state passed from Page 1 → Page 2 ─────────────────────────────────

export interface QuoteRouterState {
  contact: QuoteContactDetails;
  service: QuoteServiceId;
  parentSubmissionId: string;
}
