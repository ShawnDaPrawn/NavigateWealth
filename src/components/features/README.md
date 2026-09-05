# Feature modules

Self-contained, client-facing features: onboarding, will drafting, the portfolio
report, the codebase download tab.

## Why this is not called `modules/`

It was, and that was the problem. `src/components/admin/modules/` holds the
thirty admin modules, and this directory held four unrelated client-facing ones.
Both were reached by relative imports that read identically:

```ts
// from src/components/pages/          → src/components/modules/onboarding
import { … } from '../modules/onboarding';

// from src/components/admin/layout/   → src/components/admin/modules/personnel
import { … } from '../modules/personnel';
```

Same prefix, two different trees, and which one you got depended on where the
importing file happened to sit. The worst case was in
`admin/modules/applications/components/`, which reached back up four levels
through `../../../../modules/onboarding/` — a path that looks like it points at
admin's own modules and does not.

`features/` is a different word, so a reader can tell the two apart without
counting `../` segments.

## What belongs here

A feature that a client or a public visitor uses, that owns its own steps,
state and components, and that is not an admin module. If it is adviser- or
admin-facing, it belongs in `admin/modules/`. If it is a shared primitive with
no domain of its own, it belongs in `ui/` or `shared/`.
