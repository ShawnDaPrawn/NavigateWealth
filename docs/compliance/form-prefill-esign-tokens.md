# Form Prefill — E-Sign Token Compliance Notes

This document describes how e-sign field prefill tokens relate to the unified form prefill resolver.

## Allowed token families

| Token pattern | Resolver path | PII scope |
|---------------|---------------|-----------|
| `client.*` | Legacy profile flatten in `esign-prefill.ts` | Name, email, phone, ID, address, tax number, DOB, marital status |
| `key:profile_*` | `resolveCanonicalValueForClient` | Individual canonical profile / client key fields |
| `envelope.*` | Envelope metadata only | Non-PII workflow IDs |

## Key Manager tokens (recommended)

Use `key:` tokens for new templates so values stay aligned with FNA prefill:

- `key:profile_first_name`, `key:profile_last_name`
- `key:profile_email`, `key:profile_phone_number`
- `key:profile_id_number`, `key:profile_tax_number`
- `key:profile_date_of_birth`, `key:profile_marital_status`
- `key:profile_gross_monthly_income`, `key:profile_net_monthly_income`

Derived canonical keys (e.g. `derived:full_name`) are resolved when referenced via `key:derived:full_name` pattern in resolver-backed flows; prefer explicit profile keys in signed PDFs for audit clarity.

## Governance

1. **Review before send:** E-sign prefill runs at packet creation; advisers must review populated fields before sending for signature.
2. **No silent overwrite on signed PDFs:** Locked prefill metadata should remain read-only after first resolution.
3. **Platform-wide access:** Same as FNA prefill — any adviser may resolve tokens for any client packet they create.
4. **Audit:** Resolver version is not stamped on e-sign fields in v1; rely on envelope audit trail + field `resolvedAt` metadata.

## Testing

Unit coverage: `src/supabase/functions/server/__tests__/esign-prefill.test.ts`

## Change control

Adding tokens requires updating:

- `PrefillToken` in `esign-prefill.ts`
- Field picker in `FieldPropertiesPanel.tsx` (admin UI)
- This document for compliance review
