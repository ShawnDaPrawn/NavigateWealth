/**
 * zodJitless: Zod must never construct a Function once the entry module ran.
 *
 * Under the site's CSP (no 'unsafe-eval') each such construction is reported
 * as a `script-src` "blocked eval" violation, which is what filled the Issue
 * Manager from the vendor-forms chunk. The control case proves the probe is
 * real in this runtime, so the main assertion is not passing vacuously.
 */
import { afterEach, describe, expect, it } from 'vitest';
import '../zodJitless';
import { z } from 'zod';

const RealFunction = globalThis.Function;

/** Run `fn` with the global Function constructor counted. */
function countFunctionConstructions(fn: () => void): number {
  let count = 0;
  globalThis.Function = new Proxy(RealFunction, {
    construct(target, args, newTarget) {
      count += 1;
      return Reflect.construct(target, args, newTarget);
    },
    apply(target, thisArg, args) {
      count += 1;
      return Reflect.apply(target, thisArg, args);
    },
  });
  try {
    fn();
  } finally {
    globalThis.Function = RealFunction;
  }
  return count;
}

function buildAndParseObjectSchema(): void {
  const schema = z.object({ name: z.string(), age: z.number().optional() });
  expect(schema.parse({ name: 'Ada', age: 36 })).toEqual({ name: 'Ada', age: 36 });
}

describe('zodJitless', () => {
  afterEach(() => {
    z.config({ jitless: true });
  });

  it('turns on jitless in the config Zod actually reads', () => {
    expect(z.config().jitless).toBe(true);
  });

  it('builds and parses object schemas without constructing a Function', () => {
    expect(countFunctionConstructions(buildAndParseObjectSchema)).toBe(0);
  });

  it('control: with jitless off, the same schema does construct one', () => {
    z.config({ jitless: false });
    expect(countFunctionConstructions(buildAndParseObjectSchema)).toBeGreaterThan(0);
  });
});
