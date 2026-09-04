# Shared Household Mailboxes — Runbook

How to onboard two clients who use one email address: a minor on a parent's
inbox, a spouse without their own, an elderly parent whose mail a child manages.

## Why it needs a runbook

Every client record is a Supabase Auth user, and Supabase Auth allows **one
account per email address**. Until 2026-09 that made the contact address and the
login identity the same field, so the first person captured on a household inbox
consumed it and nobody else in that household could be onboarded at all.

The fix separates the two:

| Field         | What it is                       | Unique?        |
| ------------- | -------------------------------- | -------------- |
| `signInEmail` | The Supabase Auth login identity | Yes — enforced |
| `email`       | The inbox we actually write to   | No             |

A linked client keeps the household's real address as their contact email and
signs in with a derived alias — `michael.wood+charlotte-page-wood@gmail.com`.
The alias is RFC 5233 sub-addressing, so it stays deliverable to the same mailbox
on providers that honour the convention, but **delivery is not relied on**:
`ClientsService.getAllClients` resolves `client.email` to the real address, and
every message the platform sends — campaigns, newsletter, birthday greetings —
reads that field.

## Onboarding the second person in a household

Client Management → Add Client → enter their details with the **shared address**
in the Email field. On submit, the form reports the conflict and names who holds
the address, then offers two directions. Pick the one that says who **owns the
mailbox** — that person keeps the plain address:

| Situation                                                      | Choose                      | Result                                                     |
| -------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------- |
| The existing client owns the inbox; the new one is a dependant | _«Existing client» owns it_ | The new client gets the alias                              |
| The new client owns the inbox; the existing one is a dependant | _«New client» owns it_      | The existing client moves to an alias, freeing the address |
| Same person, already onboarded                                 | _Use a different email_     | Nothing is created                                         |

Fill in "Relationship to the mailbox owner" (e.g. `Daughter (minor)`) — it is
stored on the profile and is the only record of _why_ the accounts are linked.

## Repairing a record captured before the split

The second option above is the repair path, and it is also available directly:

```
POST /admin/onboarding/link-shared-mailbox
{ "userId": "<the dependant's user id>", "relationship": "Daughter (minor)" }
```

It moves that client onto an alias and returns `freedEmail` — the address now
available for its owner. It is idempotent: running it on an already-linked
client reports `alreadyLinked: true` and changes nothing.

**Clients only.** The route refuses a personnel account or the super admin with
`403 NOT_A_CLIENT`, and the Add Client prompt hides the option when the address
is held by staff. Re-keying an adviser would silently change their login, and
the super admin's address _is_ the allowlist `isSuperAdminEmail` checks — moving
it would revoke their own access.

**If it fails part-way.** The mailbox is recorded on the profile _before_ Auth is
touched. The two writes cannot be made atomic, and their failure modes are not
symmetric: a marker written but never used resolves to the address the client
already had, while an Auth email changed but never recorded loses the only copy
of the real inbox. So if the Auth update fails the marker is rolled back; if it
succeeds but the finalising write does not, re-running the endpoint reads the
mailbox back off the marker and completes. A client with no profile row at all
gets a minimal one created to hold the mapping.

Deliberately **not** the dual-verification flow in
`security-email-change-routes.ts`. That flow mails a code to the old address and
to the new one; here both resolve to the same inbox, so the codes would prove
nothing. The admin is the authority, and the audit trail is the `sharedEmail`
block written to the profile (`linkedBy`, `linkedAt`, `relationship`).

## Bulk import

Duplicate emails are **skipped** by default — that is the right behaviour when a
file lists the same client twice. Tick **"Link rows that share an existing
email"** on the Bulk Import tab for a household book; linked rows show their
derived alias in the results table.

## Checks

| Question                                     | Where to look                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Is this client linked?                       | Client drawer → Security → Sign-In Email (the caption names the real inbox)         |
| Which household members share an inbox?      | Client Management search on the shared address — it matches both fields             |
| Where will this client's mail actually go?   | `client.email`; the alias only ever appears as `client.signInEmail`                 |
| Where do 2FA codes and reset credentials go? | `resolveDeliveryEmail` in `security-shared.ts` — the contact inbox, never the alias |

## Limits

- The alias is derived from the client's name, so two members of one household
  with identical names get `…-2`, `…-3`, and the sixth attempt fails rather than
  looping. That bound is `MAX_ALIAS_ATTEMPTS` in
  `admin-client-onboarding-service.ts`.
- A mailbox whose local part is already at or near the 64-character RFC 5321
  limit cannot take an alias; the request fails with `ALIAS_ERROR` rather than
  truncating the mailbox into a different address.
- A client who later changes their sign-in email through the verified
  email-change flow has their link dropped automatically — they now hold an
  address of their own, and keeping it would carry on routing their mail to the
  guardian they just moved off.
- The **public forgot-password** flow hands the typed address straight to
  Supabase, which mails that Auth address. A linked client who starts it from
  the alias therefore depends on their provider honouring sub-addressing. Every
  flow the server controls — 2FA codes, admin-initiated resets, welcome,
  approval and decline mail — is routed to the contact inbox instead.
- Two clients sharing an inbox will each match a campaign audience. The
  newsletter service de-duplicates by address, but a campaign targeting both
  household members sends to the same inbox twice — expected, and the same as
  posting two letters to one house.

## Code

| Concern                              | File                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| Alias derivation, contact resolution | `src/supabase/functions/server/client-email-identity.ts`                         |
| Creation and repair                  | `src/supabase/functions/server/admin-client-onboarding-service.ts`               |
| The seam every message reads         | `src/supabase/functions/server/client-management-service.ts` (`getAllClients`)   |
| Admin flow                           | `src/components/admin/modules/client-management/components/SingleClientForm.tsx` |
| Security-mail delivery               | `src/supabase/functions/server/security-shared.ts` (`resolveDeliveryEmail`)      |

```bash
npm test -- client-email-identity shared-mailbox shared-email delivery-email
```
