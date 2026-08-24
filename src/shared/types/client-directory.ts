/**
 * The `/profile/all-users` client directory response (§9.3).
 *
 * Several modules need "the list of clients" to populate a picker — e-sign
 * recipients, calendar birthdays, global search. The wire shape of that
 * response is a shared contract, so it lives here; a module that also needs
 * the richer nested profile and application objects supplies its own entry
 * type through the generic parameter rather than redefining the envelope.
 */

/** One client as the directory endpoint returns it, without nested detail. */
export interface ClientDirectoryEntry {
  id: string;
  email: string;
  created_at: string;
  user_metadata?: {
    firstName?: string;
    surname?: string;
    /** Additional metadata fields from Supabase Auth */
    [key: string]: unknown;
  };
  name?: string;
  application_number?: string;
  application_status?: string;
  account_type?: string;
  deleted?: boolean;
  suspended?: boolean;
  account_status?: string;
  /** Present on the wire; typed richly by modules that model it. */
  profile?: unknown;
  application?: unknown;
}

export interface ClientDirectoryResponse<TEntry = ClientDirectoryEntry> {
  count?: number;
  /** @deprecated Server now returns `clients` — kept for backward compatibility */
  users?: TEntry[];
  /** Current server response field (PaginatedClientResponse shape) */
  clients?: TEntry[];
  /** Pagination fields — present when page/perPage query params are sent */
  total?: number;
  page?: number;
  perPage?: number;
  totalPages?: number;
}
