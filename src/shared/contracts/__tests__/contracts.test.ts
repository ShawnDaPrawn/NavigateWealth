/**
 * Contract mechanism tests (Stage A / F8).
 *
 * Two things are verified here:
 *   1. `parseContract` is genuinely REPORT-ONLY — it must never throw and must
 *      never alter the payload. Adopting it can only add signal, never change
 *      behaviour. If that stops holding, wiring it into live endpoints becomes
 *      an outage risk.
 *   2. Every contract module carries a drift assertion, so a future schema
 *      cannot be added without being pinned to its declared type.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  parseContract,
  parseContractStrict,
  setContractViolationReporter,
  resetContractViolationReporter,
  BaseClientSchema,
} from '../index';

const CONTRACTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

afterEach(() => {
  resetContractViolationReporter();
});

const Schema = z.object({ id: z.string(), n: z.number() });

describe('parseContract (report-only)', () => {
  it('returns parsed data when the payload matches', () => {
    expect(parseContract(Schema, { id: 'a', n: 1 }, { endpoint: 'GET /x' })).toEqual({
      id: 'a',
      n: 1,
    });
  });

  it('does NOT throw on a mismatch — report-only is the whole point', () => {
    expect(() =>
      parseContract(Schema, { id: 'a', n: 'nope' }, { endpoint: 'GET /x' }),
    ).not.toThrow();
  });

  it('passes the ORIGINAL payload through unchanged on a mismatch', () => {
    const bad = { id: 'a', n: 'nope', extra: true };
    const out = parseContract(Schema, bad, { endpoint: 'GET /x' });
    // Same object, untouched — adopting this cannot change behaviour.
    expect(out).toBe(bad);
  });

  it('reports the endpoint and the offending field', () => {
    const reporter = vi.fn();
    setContractViolationReporter(reporter);
    parseContract(Schema, { id: 'a', n: 'nope' }, { endpoint: 'GET /clients/:id' });
    expect(reporter).toHaveBeenCalledTimes(1);
    const report = reporter.mock.calls[0][0];
    expect(report.endpoint).toBe('GET /clients/:id');
    expect(report.issues).toContain('n');
  });

  it('does not report when the payload is valid', () => {
    const reporter = vi.fn();
    setContractViolationReporter(reporter);
    parseContract(Schema, { id: 'a', n: 1 }, { endpoint: 'GET /x' });
    expect(reporter).not.toHaveBeenCalled();
  });
});

describe('parseContractStrict', () => {
  it('throws with the endpoint and issue when the payload is malformed', () => {
    expect(() => parseContractStrict(Schema, { id: 'a' }, { endpoint: 'GET /x' })).toThrow(
      /GET \/x/,
    );
  });
});

describe('BaseClientSchema', () => {
  it('accepts a minimal real client', () => {
    const client = { id: 'u1', firstName: 'A', lastName: 'B', email: 'a@b.co' };
    expect(BaseClientSchema.safeParse(client).success).toBe(true);
  });

  it('accepts legacy accountStatus values outside the enum', () => {
    // The declared interface widens to `AccountStatus | string`; narrowing the
    // schema would report every legacy row as a violation.
    const client = {
      id: 'u1',
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.co',
      accountStatus: 'legacy_unknown_status',
    };
    expect(BaseClientSchema.safeParse(client).success).toBe(true);
  });

  it('rejects a client missing a required field', () => {
    expect(BaseClientSchema.safeParse({ id: 'u1', firstName: 'A' }).success).toBe(false);
  });
});

describe('contract drift assertions', () => {
  it('every schema module pins itself to its declared type', () => {
    const modules = readdirSync(CONTRACTS_DIR).filter(
      (f) => f.endsWith('.ts') && !['index.ts', 'parse.ts'].includes(f),
    );
    expect(modules.length).toBeGreaterThan(0);

    for (const file of modules) {
      const src = readFileSync(join(CONTRACTS_DIR, file), 'utf8');
      expect(
        src.includes('Equals<'),
        `${file} defines a contract schema but has no compile-time drift assertion. ` +
          `Add one (see base-client.ts) so the schema cannot silently diverge from its interface.`,
      ).toBe(true);
    }
  });
});
