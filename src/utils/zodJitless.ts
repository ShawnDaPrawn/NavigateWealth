/**
 * Turn off Zod's JIT before any schema is built.
 * ==============================================
 *
 * Zod 4 compiles object parsers with `new Function(...)` for speed, and to find
 * out whether it may, it probes `new Function('')` the moment the first
 * `z.object()` is constructed. Our Content-Security-Policy has no
 * `'unsafe-eval'`, so every page that loaded the forms bundle (react-hook-form
 * + zod, the `vendor-forms` chunk) reported a `script-src` "blocked eval"
 * violation — the open Issue Manager rows from 2026-10-09 onwards. Zod catches
 * the throw and falls back, so nothing visibly broke, but the report fires
 * regardless, and it is one of the things standing between the report-only
 * policy and enforcing it.
 *
 * `jitless` makes Zod skip both the probe and the compiled fast path. The cost
 * is speed on very large object parses, which our form-sized schemas never
 * notice.
 *
 * WHY THE GLOBAL AND NOT `z.config({ jitless: true })`: importing `zod` here
 * would pull the whole library into the eager entry chunk (it otherwise loads
 * only with the lazy routes that use forms) and trip the bundle-size ratchet.
 * Zod keeps its settings on `globalThis.__zod_globalConfig` precisely so that
 * separate copies share one config; it reads that object when it first
 * evaluates and creates it only if absent. Seeding it here — mutating in place,
 * never replacing, so a copy of Zod that somehow evaluated first still sees the
 * change — has the same effect as `z.config` without the import.
 *
 * Must stay the FIRST import in src/main.tsx: module bodies run in import
 * order, and a schema defined at the top level of any module App pulls in would
 * otherwise be built before this runs.
 */

type ZodGlobalConfig = { jitless?: boolean } & Record<string, unknown>;

export function enableZodJitless(): void {
  const scope = globalThis as typeof globalThis & { __zod_globalConfig?: ZodGlobalConfig };
  scope.__zod_globalConfig ??= {};
  scope.__zod_globalConfig.jitless = true;
}

enableZodJitless();
