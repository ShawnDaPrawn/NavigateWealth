/**
 * Runtime contract for `BaseClient` (Stage A / F8).
 *
 * Mirrors the declared interface in `src/shared/types/client.ts`. The schema is
 * NOT an independent guess at the shape — the compile-time assertion at the
 * bottom makes the two provably identical, so a field added to the interface
 * without the schema (or vice versa) fails `npm run typecheck`.
 *
 * That assertion is the point. A hand-maintained schema that silently drifts
 * from its type is worse than none: it reports false violations and hides real
 * ones.
 */
import { z } from 'zod';
import type { BaseClient } from '../types/client';

export const AccountStatusSchema = z.enum(['active', 'approved', 'suspended', 'closed']);

export const BaseClientSchema = z.object({
  /** Canonical user identifier (Supabase Auth UID) */
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  idNumber: z.string().optional(),
  // The interface widens this to `AccountStatus | string`, because legacy rows
  // carry statuses outside the union. Mirror that rather than narrowing here —
  // narrowing would report every legacy row as a violation.
  accountStatus: z.union([AccountStatusSchema, z.string()]).optional(),
});

/**
 * Compile-time proof that the schema and the declared interface agree.
 *
 * `Equals` is the standard invariant-position trick: two conditional types are
 * assignable to each other only when A and B are mutually identical, which
 * (unlike `extends`) also catches EXTRA fields and optionality differences.
 */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// If this line errors, BaseClientSchema and BaseClient have drifted apart.
export const __baseClientContractIsInSync: Equals<
  z.infer<typeof BaseClientSchema>,
  BaseClient
> = true;
