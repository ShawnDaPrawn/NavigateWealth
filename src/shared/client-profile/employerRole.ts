/**
 * Which employer is the client's primary one, and how the client's time at
 * each employer splits across the four occupational duty classes insurers
 * underwrite on (`employers[].isPrimary`, `employers[].occupationalDuties`).
 *
 * Primary vs secondary: income protection and disability cover are written
 * against the main occupation, so the adviser needs to know which employer
 * that is. Every existing reader of the profile (overview PDF, welcome banner,
 * client report, application mapping) takes `employers[0]` as "the" employer,
 * so the primary employer is always kept first. `isPrimary` records the choice
 * explicitly; a record saved before 2026-11 has no flag and its first employer
 * is the primary one.
 *
 * Occupational duties: the share of working time, in whole percent, spent on
 * office/admin work, travel, supervising others, and manual work. Underwriters
 * class the occupation from this split. Optional, but once anything is entered
 * the four must add up to 100.
 */

export interface OccupationalDuties {
  admin: number;
  travel: number;
  supervision: number;
  manual: number;
}

export type OccupationalDutyKey = keyof OccupationalDuties;

export const OCCUPATIONAL_DUTY_FIELDS: Array<{
  field: OccupationalDutyKey;
  label: string;
  hint: string;
}> = [
  { field: 'admin', label: 'Admin', hint: 'Office, desk and computer work' },
  { field: 'travel', label: 'Travel', hint: 'Driving or travelling for work' },
  { field: 'supervision', label: 'Supervision', hint: 'Managing or overseeing others' },
  { field: 'manual', label: 'Manual', hint: 'Physical or hands-on work' },
];

export function emptyOccupationalDuties(): OccupationalDuties {
  return { admin: 0, travel: 0, supervision: 0, manual: 0 };
}

function percent(v: unknown): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, Math.round(n));
}

export function normalizeOccupationalDuties(raw: unknown): OccupationalDuties {
  const r =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    admin: percent(r.admin),
    travel: percent(r.travel),
    supervision: percent(r.supervision),
    manual: percent(r.manual),
  };
}

export function occupationalDutiesTotal(value: unknown): number {
  const d = normalizeOccupationalDuties(value);
  return d.admin + d.travel + d.supervision + d.manual;
}

/** True when any share has been entered. */
export function hasOccupationalDuties(value: unknown): boolean {
  return occupationalDutiesTotal(value) > 0;
}

/**
 * Why the split cannot be saved, or null when it can. Nothing entered is
 * allowed; a partial split is not.
 */
export function occupationalDutiesError(value: unknown): string | null {
  const total = occupationalDutiesTotal(value);
  if (total === 0 || total === 100) return null;
  return `Occupational duties must add up to 100% (currently ${total}%)`;
}

/** e.g. "Admin 70% · Travel 20% · Supervision 10%". Empty when nothing is recorded. */
export function occupationalDutiesLine(value: unknown): string {
  const d = normalizeOccupationalDuties(value);
  return OCCUPATIONAL_DUTY_FIELDS.filter(({ field }) => d[field] > 0)
    .map(({ field, label }) => `${label} ${d[field]}%`)
    .join(' · ');
}

// ---------------------------------------------------------------------------
// Primary / secondary employer
// ---------------------------------------------------------------------------

interface EmployerLike {
  id: string;
  isPrimary?: boolean;
}

/**
 * Id of the primary employer: the one flagged primary, else the first. Null
 * when there are no employers.
 */
export function primaryEmployerId(employers: readonly EmployerLike[] | undefined): string | null {
  if (!employers || employers.length === 0) return null;
  return (employers.find((e) => e.isPrimary === true) ?? employers[0]).id;
}

/**
 * The list with the primary employer first and flagged, every other employer
 * flagged secondary, and the others in their existing order. `primaryId`
 * picks the primary; without it the current primary stays. Returns a new
 * array.
 */
export function withPrimaryEmployer<T extends EmployerLike>(
  employers: readonly T[],
  primaryId?: string,
): Array<T & { isPrimary: boolean }> {
  if (employers.length === 0) return [];
  const chosen =
    primaryId && employers.some((e) => e.id === primaryId)
      ? primaryId
      : primaryEmployerId(employers);
  const primary = employers.find((e) => e.id === chosen) as T;
  const rest = employers.filter((e) => e.id !== chosen);
  return [{ ...primary, isPrimary: true }, ...rest.map((e) => ({ ...e, isPrimary: false }))];
}

export function employerRoleLabel(isPrimary: boolean): 'Primary' | 'Secondary' {
  return isPrimary ? 'Primary' : 'Secondary';
}
