/**
 * The two password validators must agree.
 *
 * There are two copies of the password rules and there have to be:
 * `no-spa-edge-source` (quality/dependency-cruiser.cjs, severity error) forbids
 * SPA code from importing Edge Function source at runtime, so
 * `src/utils/auth/passwordValidation.ts` cannot import
 * `src/supabase/functions/server/passwordValidator.ts`.
 *
 * When the server-side check was finally wired into the live signup route, the
 * two copies had already drifted, and every divergence pointed the same
 * dangerous way: the meter said "✓ Very strong password" and the server refused.
 * `Abcdefgh1234!`, `aaaBBBccc111!`, `NavigateWealth1!` and `Password1234!` all
 * did that. The frontend had no sequential-run check, no repeated-character
 * check, and matched its word list by exact equality where the server matched by
 * substring.
 *
 * This file is what keeps them together. It is not testing that the rules are
 * right — the other file does that — only that both files answer identically.
 */
import { describe, it, expect } from 'vitest';
import { validatePassword as frontend } from '../../../../utils/auth/passwordValidation';
import { validatePassword as server } from '../passwordValidator';

/**
 * Passwords chosen to cover each rule and, more importantly, the boundaries
 * between them. Every one is a case some earlier version of these two files
 * disagreed on, or a plausible thing a person types into the signup form.
 */
const CORPUS = [
  // Strong, and must stay accepted.
  'Tr0ub4dor&Horse',
  'MyS3cureP@ssw0rd',
  'Summer2026Rain!',
  'Zebra!Quilt7Moon',
  'Jump0ver#Lazy8Dog',
  'Xk9#mQ2vLp4$wR',
  'Coffee&Toast99',
  'Winter#Garden44',
  'Blue-Harbour-26',
  'Kestrel$Moth71',
  // Ordinary words that merely CONTAIN a short list entry. These were refused
  // as "too common" before the substring rule was bounded by length.
  'Olympic$Rain42', // olym·pi·c
  'Tropical#Sun88', // tro·pi·cal
  'Compass&Birch51', // com·pass
  'Administer$Fox7', // adm·inister
  'Rooted!Willow83', // root·ed
  // Sequential runs — the frontend used to miss all of these.
  'Abcdefgh1234!',
  'Qrstuv#Wxyz901',
  // Repeated characters — likewise.
  'aaaBBBccc111!',
  'Zzz!Mountain742',
  // Common words as substrings, which must still be refused.
  'NavigateWealth1!',
  'Password1234!',
  'MyPassword2026!',
  'Qwerty!Mountain8',
  // Short list entries as the whole alphabetic core, which must be refused.
  'Admin!2026$xyz',
  'Pass!!!2026$abc',
  // Too short, wrong character mix, empty.
  'Short1!',
  'Thisisalonglowercaseonly',
  'ALLUPPERCASE1234',
  '',
];

describe('password validator agreement', () => {
  it.each(CORPUS.map((p) => [p]))('agrees on %j', (password) => {
    expect(frontend(password).isValid).toBe(server(password).isValid);
  });

  it('agrees across the whole corpus, so no single case masks a drift', () => {
    const disagreements = CORPUS.filter((p) => frontend(p).isValid !== server(p).isValid).map(
      (p) => ({
        password: p,
        frontend: frontend(p).isValid,
        server: server(p).isValid,
      }),
    );
    expect(disagreements).toEqual([]);
  });

  it('never shows a green meter over a password the server will refuse', () => {
    // The asymmetry that matters. A frontend stricter than the server is a
    // nuisance; a frontend looser than the server is a person filling in a form
    // that tells them they are fine and then rejects them.
    const looser = CORPUS.filter((p) => frontend(p).isValid && !server(p).isValid);
    expect(looser).toEqual([]);
  });

  it('scores a rejected password below "strong"', () => {
    // getPasswordStrengthLabel maps 3 -> Strong, 4 -> Very Strong. A password
    // the server refuses must never reach either.
    for (const p of CORPUS) {
      if (!frontend(p).isValid) {
        expect(frontend(p).score).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('common-password matching is bounded by entry length', () => {
  it('still refuses a long entry appearing anywhere in the password', () => {
    expect(server('MyPassword2026!').isValid).toBe(false);
    expect(server('Qwerty!Mountain8').isValid).toBe(false);
  });

  it('refuses a short entry only when it is the whole alphabetic core', () => {
    // 'admin' is a short entry: it condemns 'Admin!2026$xyz' ...
    expect(server('Admin!2026$xyz').isValid).toBe(false);
    // ... but not a longer word that happens to contain it.
    expect(server('Administer$Fox7').isValid).toBe(true);
  });

  it('accepts the strong passwords that the unbounded substring rule refused', () => {
    // Regression guard for the measured 10% false-rejection rate.
    for (const p of ['Olympic$Rain42', 'Tropical#Sun88', 'Compass&Birch51']) {
      expect(server(p).isValid, `${p} should be accepted`).toBe(true);
      expect(frontend(p).isValid, `${p} should be accepted by the meter too`).toBe(true);
    }
  });
});
