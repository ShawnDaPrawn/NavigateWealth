# Quality ratchet baselines

Each file here is a single committed number: the current size of a known
backlog. A gate reads it, recounts the real thing, and fails when the count
moves the wrong way. That is the whole mechanism — no new debt gets in, and
the existing debt is burned down by lowering the number.

These are project-invented counters, not tool config, which is why they live
here rather than in the repo root.

## The files

| Baseline                        | Counts                                           | Enforced by                                                                  | Direction         |
| ------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------- |
| `anon-key-bearer-baseline`      | anon-key bearer headers                          | `src/utils/api/__tests__/anon-key-bearer-ratchet.test.ts`                    | must not rise     |
| `auth-implementations-baseline` | distinct auth implementations on the edge server | `src/supabase/functions/server/__tests__/auth-consolidation.test.ts`         | must not rise     |
| `auth-without-authz-baseline`   | authenticated routes with no ownership check     | `src/supabase/functions/server/__tests__/auth-without-authz-ratchet.test.ts` | must not rise     |
| `bundle-size-baseline.json`     | per-chunk size floors                            | `scripts/check-bundle-size.mjs` (`npm run bundle:check`)                     | must not rise     |
| `contract-coverage-baseline`    | `parseContract` call sites                       | `src/shared/contracts/__tests__/contract-coverage.test.ts`                   | **must not fall** |
| `deno-check-baseline`           | Deno edge-code type errors                       | `.github/workflows/quality-check.yml`                                        | must not rise     |
| `depcruise-baseline`            | module-boundary violations                       | `.github/workflows/quality-check.yml`                                        | must not rise     |
| `eslint-warning-baseline`       | ESLint warnings                                  | `.github/workflows/quality-check.yml`                                        | must not rise     |
| `kv-direct-access-baseline`     | direct KV calls bypassing the repository         | `src/supabase/functions/server/__tests__/kv-repository.test.ts`              | must not rise     |
| `npm-audit-baseline`            | high + critical advisories                       | `.github/workflows/quality-check.yml`                                        | must not rise     |
| `raw-fetch-baseline`            | raw `fetch()` calls                              | `src/utils/api/__tests__/raw-fetch-ratchet.test.ts`                          | must not rise     |
| `route-auth-baseline`           | routes with no granular auth guard               | `src/supabase/functions/server/__tests__/route-auth-granular.test.ts`        | must not rise     |
| `route-validation-baseline`     | routes with an unvalidated body                  | `src/supabase/functions/server/__tests__/validate.test.ts`                   | must not rise     |

`contract-coverage-baseline` is the one inversion: `parseContract` call sites
are coverage, not debt, so the failure case is the count _dropping_.

## Changing a number

**Lowering it** (you fixed some debt) needs no ceremony — the gate prints the
new count when you come in under the floor. Lock the gain in by writing that
number to the file in the same PR, or the next regression slips in free.

**Raising it** is a deliberate act and needs a reason in the PR description.
A gate that gets re-baselined upward without justification is not a gate.

`bundle-size-baseline.json` is regenerated rather than hand-edited:

```
npm run bundle:check -- --write-baseline
```

The rest are plain integers, e.g.:

```
node -e "require('fs').writeFileSync('quality/baselines/route-auth-baseline', 123 + '\n')"
```
