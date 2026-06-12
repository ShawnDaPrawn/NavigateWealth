# Locked module — standalone unit

This module is **not part of Navigate Wealth**. It is a self-contained workspace
for a separate business, accessed from within the Navigate Wealth admin for
convenience only. Nothing elsewhere in the codebase may depend on it, reference
it, or document it — this README is the single source of truth.

It is intentionally built so it can be deleted in one sitting. Keep it that way:

- All frontend code lives in `src/components/admin/modules/locked/` (including
  its own query keys, types, API layer and tests — nothing in shared registries).
- All backend code lives in `src/supabase/functions/server/locked/`.
- Its data is namespaced: KV keys under the `refund-clusters:` prefix, a
  dedicated private storage bucket, and audit entries with their own entity types.
- Dependencies point strictly **outward** (shared UI components, the API client,
  shared server middleware). Nothing outside imports from inside this module
  except the registration lines listed below.

## How to delete this module completely

### 1. Delete the two folders

- `src/components/admin/modules/locked/`
- `src/supabase/functions/server/locked/`

### 2. Remove the registration lines

These are the only lines outside the folders above that mention the module.
Find them by searching for the quoted strings (line numbers drift; strings don't):

| File                                                             | Remove                                                                                                                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/pages/AdminDashboardPage.tsx`                    | the `const LockedModule = React.lazy(...)` declaration and the `case 'locked':` block                                                           |
| `src/components/admin/layout/config.ts`                          | the `locked: { label: 'Locked', icon: Lock }` entry, `'locked'` in the Growth group's `modules` array, and the `Lock` icon import if now unused |
| `src/components/admin/layout/types.ts`                           | `\| 'locked'` in the `AdminModule` union                                                                                                        |
| `src/components/admin/modules/personnel/constants.ts`            | `'locked'` in `SELF_GATED_MODULES` and the `locked: []` entry in the module-capabilities map                                                    |
| `src/components/admin/modules/personnel/hooks/usePermissions.ts` | `'locked'` in the `allModules` list (if present)                                                                                                |
| `src/supabase/functions/server/mount-modules.ts`                 | the `lazy(app, '/refund-clusters', ...)` line                                                                                                   |

Then run the quality gates (`npm run lint && npm run typecheck && npm test`) —
the compiler will flag anything missed via the `AdminModule` union.

### 3. Clean up operational data (Supabase project)

- **KV rows**: delete all rows in `kv_store_91ed8379` whose key starts with
  `refund-clusters:` (clusters, entities, document metadata).
- **Storage**: delete the bucket `make-91ed8379-refund-clusters` and its contents.
- **Secrets**: remove the `NW_REFUND_VAULT_KEY` edge-function secret if it was set.
- **Audit log** (optional): historical admin-audit entries with entityType
  `refund_cluster` / `refund_entity` remain in the shared audit trail; purge them
  only if required.
- Redeploy the edge function after removing the server folder.

## Security model (for maintainers)

Access requires super-admin role **and** an access code (`./access.ts`); every
server route re-enforces super-admin; eFiling passwords are AES-256-GCM
encrypted at rest (key: `NW_REFUND_VAULT_KEY`, falling back to a key derived
from the service-role key); documents live in a private bucket served via
short-lived signed URLs; every sensitive action is audit-logged.
