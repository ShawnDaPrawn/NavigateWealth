/**
 * Portfolio table — the wire contract shared by the Edge Function and the SPA.
 *
 * WHAT THIS IS
 * ------------
 * One provider + one product category, laid out the way the Product Structure
 * defines it: a row per client policy, a column per schema field, then when
 * the record was last updated and which policy print (PDF) is on file. The
 * admin Integrations panel renders it, the spreadsheet download serialises it,
 * and `/integrations/portfolio-table` hands the same shape to an outside agent
 * so a scheduled bot can read the book and post corrections.
 *
 * WHY IT LIVES IN `shared/`
 * -------------------------
 * The server builds these objects and the browser renders them. Two copies of
 * the shape would drift the way the publications `types.ts` files did (F8);
 * one file imported from both sides cannot.
 *
 * Only types, constants and PURE helpers belong here: this module is compiled
 * by `tsc` for the SPA and by `deno check` for the Edge Function, so it must
 * not touch `Deno`, the KV store, React or the DOM.
 */

/** Header an outside agent sends the Vault-held token in. */
export const PORTFOLIO_TOKEN_HEADER = 'x-nw-portfolio-token';

/** The worksheet the download writes and the upload reads first. */
export const PORTFOLIO_SHEET_NAME = 'Portfolio';
/** Reserved column headers around the schema columns. */
export const PORTFOLIO_CLIENT_COLUMN = 'Client';
export const PORTFOLIO_UPDATED_COLUMN = 'Last Updated';
export const PORTFOLIO_PRINT_COLUMN = 'Policy Print';

/** Rows accepted by one upload or one JSON request. */
export const PORTFOLIO_MAX_ROWS = 1000;

export interface PortfolioColumn {
  /** Schema field id — the key `PortfolioRow.values` uses. */
  id: string;
  /** Schema field name — the spreadsheet column header. */
  name: string;
  type: string;
  required: boolean;
  options?: string[];
  /** True for the field the book is matched on. */
  isPolicyNumber: boolean;
}

export interface PortfolioPolicyPrint {
  fileName: string;
  uploadDate: string;
  documentType: string;
  fileSize: number;
}

export interface PortfolioRow {
  clientId: string;
  clientName: string;
  policyId: string;
  policyNumber: string;
  categoryId: string;
  /** ISO timestamp of the last write to this policy record. */
  updatedAt: string;
  createdAt?: string;
  /** Field ids no automated source may overwrite. */
  lockedFields: string[];
  /** Current values keyed by schema field id. Missing fields are `null`. */
  values: Record<string, unknown>;
  /** The most recent automated change, when there has been one. */
  lastSync: { source: string; publishedAt: string } | null;
  /** The most recent policy print (PDF) on record, or null when none. */
  policyPrint: PortfolioPolicyPrint | null;
}

export interface PortfolioTable {
  providerId: string;
  providerName: string;
  categoryId: string;
  categoryLabel: string;
  generatedAt: string;
  columns: PortfolioColumn[];
  rows: PortfolioRow[];
  clientCount: number;
  policyCount: number;
}

/** One row an agent (or an uploaded sheet) proposes. */
export interface PortfolioRowInput {
  /** Spreadsheet row number, or the 1-based index of a JSON row. */
  rowNumber?: number;
  clientName?: string;
  policyNumber?: string;
  /** Exact keys, as carried in the downloaded sheet's hidden columns. */
  policyId?: string;
  clientId?: string;
  /** Keyed by field id, field name, or the configured spreadsheet column. */
  values: Record<string, unknown>;
}

export type PortfolioRowStatus =
  | 'updated'
  | 'unchanged'
  | 'unmatched'
  | 'client_mismatch'
  | 'duplicate'
  | 'invalid'
  | 'failed';

export interface PortfolioRowChange {
  fieldId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface PortfolioRowOutcome {
  rowNumber: number;
  clientName: string;
  policyNumber: string;
  status: PortfolioRowStatus;
  policyId?: string;
  clientId?: string;
  /** The client the matched (or number-matched) policy actually belongs to. */
  matchedClientName?: string;
  matchedBy: 'ids' | 'client_name_policy_number' | null;
  changes: PortfolioRowChange[];
  warnings: string[];
  errors: string[];
}

export interface PortfolioApplySummary {
  rows: number;
  updated: number;
  unchanged: number;
  unmatched: number;
  clientMismatch: number;
  duplicate: number;
  invalid: number;
  failed: number;
  clientsTouched: number;
}

export interface PortfolioApplyReport {
  success: true;
  /** When true, `updated` rows describe what WOULD change; nothing was written. */
  dryRun: boolean;
  providerId: string;
  providerName: string;
  categoryId: string;
  categoryLabel: string;
  source: 'spreadsheet' | 'api';
  /** The persisted sync run, when changes were written. */
  runId: string | null;
  appliedAt: string;
  summary: PortfolioApplySummary;
  /** Sheet-level notices, e.g. columns that were ignored. */
  warnings: string[];
  rows: PortfolioRowOutcome[];
}

export interface PortfolioCatalogueCategory {
  categoryId: string;
  categoryLabel: string;
  policyCount: number;
  clientCount: number;
}

export interface PortfolioCatalogueEntry {
  providerId: string;
  providerName: string;
  categories: PortfolioCatalogueCategory[];
}

const DIACRITICS = /[̀-ͯ]/g;

/**
 * A client name reduced to what two people typing it would agree on: case,
 * accents, punctuation and spacing folded away.
 */
export function normaliseClientName(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Word-order-insensitive key: "Smith, John" and "John Smith" agree. */
export function clientNameKey(value: unknown): string {
  return normaliseClientName(value).split(' ').filter(Boolean).sort().join(' ');
}

/**
 * Do two client names refer to the same person, as far as a spreadsheet can
 * tell? Empty names never match anything — a blank cell must not pair with a
 * client whose name is also missing.
 */
export function clientNamesMatch(a: unknown, b: unknown): boolean {
  const left = normaliseClientName(a);
  const right = normaliseClientName(b);
  if (!left || !right) return false;
  return left === right || clientNameKey(left) === clientNameKey(right);
}

/**
 * The display name for a client, from their stored profile.
 *
 * The same field order the integration sync engine has always used, so a bot
 * reading the table and an adviser reading the portal job list see one name.
 */
export function displayNameFromProfile(
  profile: Record<string, unknown> | null | undefined,
  clientId: string,
): string {
  const record = profile ?? {};
  const personal = (record.personalInformation || record.personal_info || {}) as Record<
    string,
    unknown
  >;
  const firstName = String(
    record.firstName || personal.firstName || personal.first_name || '',
  ).trim();
  const lastName = String(
    record.lastName ||
      record.surname ||
      personal.lastName ||
      personal.surname ||
      personal.last_name ||
      '',
  ).trim();
  const fullName = String(record.fullName || personal.fullName || personal.full_name || '').trim();
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || combined || `Client ${clientId.slice(0, 8)}`;
}
