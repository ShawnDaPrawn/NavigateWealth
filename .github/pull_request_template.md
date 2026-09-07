## What this changes

<!-- What is different after this merges, and why. Lead with the problem, not the
     diff — a reviewer can read the diff. One or two paragraphs is usually right. -->

## How it was verified

Every gate below runs locally. `AGENTS.md` explains why deferring them to CI and
waiting is not an option here, and documents the two that are easy to misread
(`typecheck:deno` needs `jsr.io`; a partial `npm test` misses the global ratchets).

- [ ] `npm run format:check`
- [ ] `npm run lint` — 0 errors, and the warning ratchet did not rise
- [ ] `npm run typecheck`
- [ ] `npm run typecheck:middleware`
- [ ] `npm run typecheck:deno` — diff the error set against `origin/main`, do not compare the local total to the baseline
- [ ] `npm run depcruise`
- [ ] `npm test -- --coverage` — the whole suite, not only the touched files
- [ ] `npm run test:coverage:server` — a **separate** gate on a different config (`quality/vitest.config.server.ts`); the line above does not enforce the backend's per-layer floors
- [ ] `npm run bundle:check` — ratcheted; a dependency pulled into an eagerly-loaded chunk trips it
- [ ] `npm audit` — no new high or critical advisory above `quality/baselines/npm-audit-baseline`
- [ ] `npm run build`

<!-- If a gate genuinely could not run, say which and paste the error. Do not
     silently drop the line. -->

## Ratchets

- [ ] No baseline in `quality/baselines/` moved the wrong way
- [ ] If one had to rise, the reason is stated here

## Documentation

- [ ] `docs/STATUS.md` still describes reality after this change
- [ ] Any moved or deleted file's inbound references were updated
- [ ] New behaviour a future maintainer would not guess is written down somewhere findable

<!-- Docs conventions: docs/README.md. Status is rewritten, never appended to. -->

## Risk

<!-- What could this break, and what would the first symptom be? "Nothing" is a
     valid answer for a docs-only change; say it rather than deleting the section. -->
