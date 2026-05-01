# Provider Automation Golden Flows

This document records provider automation behavior that must survive the
universal-provider refactor.

Use these golden flows before changing shared portal worker behavior, provider
adapters, or default provider flows.

## Allan Gray RA

Allan Gray retirement annuity automation is the first protected golden flow.
It currently works and must remain stable while the provider automation engine
is refactored into a universal, adapter-based system.

### Runtime owner

- Worker orchestration:
  `scripts/provider-portal-worker.mjs`
- Provider adapter:
  `scripts/provider-adapters/allan-gray.mjs`
- Provider adapter registry:
  `scripts/provider-adapters/index.mjs`
- Shared field semantics:
  `scripts/provider-adapters/field-semantics.mjs`
- Server flow and job API:
  `src/supabase/functions/server/integrations.tsx`
- Server default portal flows:
  `src/supabase/functions/server/portal-default-flows.ts`
- Product management UI:
  `src/components/admin/modules/product-management/integrations/PortalAutomationTab.tsx`

### Expected pipeline

```text
load job -> login -> manual SMS OTP -> search by Navigate Wealth policy number -> confirm matching policy page -> extract mapped fields -> validate current value -> stage completed row
```

The worker must start from the Navigate Wealth queued policy number. It must
not use a loosely discovered portal number as the authority for the policy
identity.

### Default flow anchors

The Allan Gray default flow must preserve:

- Login URL:
  `https://login.secure.allangray.co.za/?audience=New%20clients`
- Credential profile:
  `allan-gray-env`
- Credential environment names:
  `NW_PROVIDER_ALLAN_GRAY_USERNAME`
  and `NW_PROVIDER_ALLAN_GRAY_PASSWORD`
- Manual SMS OTP mode
- Policy-number search mode
- Smart assist enabled for search

### Required extracted fields

The protected Allan Gray RA field set is:

- Policy Number
- Product Type
- Date of Inception
- Current Value

`Current Value` is the protected stageable business value. The worker must
fail closed when the Allan Gray policy page does not produce a mapped current
value.

### Provider-specific adapter hooks to preserve

The protected Allan Gray adapter hooks are:

- Allan Gray page detection by `allangray.co.za`
- Allan Gray snapshot extraction
- Allan Gray document download action detection
- Allan Gray current-value missing failure message

These hooks must stay behind the provider adapter boundary. Shared worker
orchestration may call them through the registry, but it should not reintroduce
direct Allan Gray branches.

### Anti-regression rules

- BrightRock or any later provider refinement must not change Allan Gray
  defaults, page detection, snapshot extraction, download detection, or missing
  current-value behavior unless the change is explicitly part of an Allan Gray
  task.
- Shared worker changes must remain provider-neutral.
- Shared field semantics must reject obvious wrong-type values, such as using a
  date or money amount as a product type, or using portal summary text as a
  current value.
- If a shared worker change is unavoidable, run the Allan Gray golden tests and
  explain why the change is safe for Allan Gray RA.
- Generic providers must still work from configured selectors, labels, and
  field mappings without requiring Allan Gray-specific behavior.

### Phase 2 verification

Phase 2 froze these anchors with static regression tests. Phase 3 moved the
provider-specific implementation behind the Allan Gray adapter boundary. Future
changes should keep the tests focused on the registry and adapter behavior
rather than deleting them.

Phase 4 moved common provider field semantics into a shared module. Future
providers should use those shared rules before adding provider-specific
validation overrides.

Phase 5 moved default provider flow construction out of `integrations.tsx` into
`portal-default-flows.ts`. The route cluster still lives in `integrations.tsx`
for now; split routes only in a later behavior-preserving slice with the golden
tests passing.
