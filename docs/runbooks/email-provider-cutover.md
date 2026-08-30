# Runbook — moving platform email from SendGrid to Amazon SES

**Status:** the code path is landed and tested; the cutover itself is an operator action
(AWS account + DNS + Edge Function secrets). Nothing changes until `NW_EMAIL_PROVIDER`
is set.

## Why

SendGrid is a per-month subscription. SES is usage-priced (roughly USD 0.10 per 1,000
emails) and is the transport listmonk-style setups normally sit on. Deliverability is
unaffected by the swap **provided the DNS below is in place**: DKIM signing and DMARC
alignment come from the domain records, not from the vendor.

## What the code does

Every platform email — newsletter campaigns, subscriber confirmation/welcome, e-sign,
digests, consultation and contact notifications — goes through one function,
`sendEmail()` in `src/supabase/functions/server/email-core.ts`. That function reads
`NW_EMAIL_PROVIDER` per send:

| Value              | Behaviour                                                  |
| ------------------ | ---------------------------------------------------------- |
| unset / `sendgrid` | SendGrid (current behaviour, unchanged)                    |
| `ses`              | Amazon SES via `email-transport-ses.ts` (SigV4 + raw MIME) |

`isEmailConfigured()` reports on the **active** provider, so the "email service not
configured" guards keep working either way.

Custom from-addresses (`newsletters@`, `noreply@`), `Reply-To`, and the deliverability
headers (`List-Unsubscribe`, `List-Unsubscribe-Post`, `List-Id`, `Message-ID`) are
carried on both paths — SES gets them because the message is submitted as raw MIME.

`customArgs` is SendGrid-only webhook metadata and is dropped on the SES path; nothing
reads it today.

## Operator steps

1. **AWS account → SES.** Open the SES console in the region you want
   (`eu-west-1` is a good default; `af-south-1` is closer but has a smaller feature set —
   either works).
2. **Verify the domain.** SES → Identities → Create identity → Domain
   `navigatewealth.co`, with **Easy DKIM** enabled. SES gives three CNAME records;
   add them at the DNS host. Wait for status **Verified** (usually minutes).
   These sit alongside the existing SendGrid `s1/s2._domainkey` records — both can
   coexist, which is what makes rollback safe.
3. **Request production access.** New SES accounts are in the sandbox and can only send
   to verified addresses. SES → Account dashboard → Request production access. Short
   form; usually approved within a day. **Do not cut over before this is granted.**
4. **Create an IAM user** with an inline policy allowing only
   `ses:SendEmail` and `ses:SendRawEmail`. Take the access key id + secret.
5. **Set the Edge Function secrets** (Supabase Dashboard → Project → Edge Functions →
   Secrets):

   ```
   NW_SES_REGION=eu-west-1
   NW_SES_ACCESS_KEY_ID=…
   NW_SES_SECRET_ACCESS_KEY=…
   ```

   Leave `NW_EMAIL_PROVIDER` unset for now — nothing changes yet.

6. **Smoke test on SES before switching everything.** In Newsletter Studio, open any
   draft campaign → **Send test** to your own address. It will still go via SendGrid at
   this point; set `NW_EMAIL_PROVIDER=ses`, re-send the test, and confirm:
   - the mail arrives,
   - "show original" in Gmail reports **DKIM=pass** and **DMARC=pass** with
     `d=navigatewealth.co`,
   - the unsubscribe link at the footer works.
7. **Cut over:** `NW_EMAIL_PROVIDER=ses`. That is the whole switch — it applies to every
   email the platform sends, immediately, with no deploy.
8. **Watch for a day**, then cancel SendGrid. Keep the SendGrid DKIM records in DNS until
   the subscription is actually cancelled.

## Rollback

Unset `NW_EMAIL_PROVIDER` (or set it to `sendgrid`). Instant, no deploy. This is why the
SendGrid key and DNS records should stay in place through the first week.

## DNS posture (verified 2026-08-29)

| Record          | Value                                            | Note                                                                                                |
| --------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| SPF             | `v=spf1 include:spf.protection.outlook.com -all` | M365. SES mail passes SPF on its own return-path domain, which is DMARC-aligned — no change needed. |
| DKIM (SendGrid) | `s1/s2._domainkey` → sendgrid.net                | Keep until SendGrid is cancelled.                                                                   |
| DKIM (M365)     | `selector1/2._domainkey` → onmicrosoft.com       | Corporate mail.                                                                                     |
| DMARC           | `v=DMARC1; p=none;`                              | ⚠️ No `rua=`, so no reports and no enforcement.                                                     |

**Recommended DNS improvement, independent of this cutover:**

```
v=DMARC1; p=none; rua=mailto:dmarc-reports@navigatewealth.co;
```

Collect reports for a few weeks, confirm only M365 + SES appear, then move `p=none` →
`p=quarantine` → `p=reject`.

## Known gap

Bounces and spam complaints are handled asynchronously by the provider today: a hard
bounce lands on the provider suppression list, and the _next_ campaign to that address
fails terminally (visible in the campaign's recipient drill-down). Ingesting SES's SNS
notifications to mark bounces in near-real-time — and auto-unsubscribing hard bouncers —
is a contained follow-up, not part of this change.
