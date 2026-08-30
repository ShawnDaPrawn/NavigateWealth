# Form Prefill — E-Sign Token Compliance Notes

This document describes how e-sign field prefill tokens relate to the unified form prefill resolver.

## Allowed token families

| Token pattern   | Resolver path                                | PII scope                                                        |
| --------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| `client.*`      | Legacy profile flatten in `esign-prefill.ts` | Name, email, phone, ID, address, tax number, DOB, marital status |
| `key:profile_*` | `resolveCanonicalValueForClient`             | Individual canonical profile / client key fields                 |
| `envelope.*`    | Envelope metadata only                       | Non-PII workflow IDs                                             |

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

## Binding entry points

A prefill token can reach a field through three routes, all of which produce
the same `metadata.prefill.token` shape and go through the same resolver:

1. **Manual binding** — the adviser picks a token in the studio's field
   properties panel (`FieldPropertiesPanel.tsx`). Original v1 path.
2. **Palette presets** — the "Client details (auto-filled)" group in the
   field palette (`FieldPalette.tsx`) drops a text field pre-bound to the
   matching token (Full/First/Last name, Email, Phone, ID number).
3. **Upload-time suggestions** — the smart-anchor analyzer
   (`esign-pdf-analysis.ts`) recognises identity captions in the uploaded
   PDF ("First name:", "Email:", "ID number:", …) and proposes candidates
   already carrying the matching token. Candidates are suggestions only:
   nothing is bound until the adviser accepts them, and the accepted field
   shows its binding in the properties panel like any manual one.

Routes 2 and 3 do not widen the token list — they select from the same
closed `PrefillToken` set, and the **review-before-send** rule in Governance
applies unchanged: resolution happens at send time and the adviser remains
responsible for reviewing populated fields.

## Testing

Unit coverage: `src/supabase/functions/server/__tests__/esign-prefill.test.ts`
and `src/supabase/functions/server/__tests__/esign-pdf-analysis.test.ts`
(anchor→token mapping).

## Change control

Adding tokens requires updating:

- `PrefillToken` in `esign-prefill.ts`
- Field picker in `FieldPropertiesPanel.tsx` (admin UI)
- This document for compliance review
