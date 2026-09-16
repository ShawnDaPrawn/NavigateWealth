---
name: newsletter-monthly-intake
description: Monthly hand-over of the Navigate Wealth newsletter PDF — queue a finished PDF, title and description through the Supabase connector so it appears in the admin Newsletters module as a draft awaiting approval, and the admin is emailed. Use when a Routine or a person asks to submit, hand over or queue the month's newsletter for review.
---

# Monthly newsletter hand-over

You are handing a finished newsletter PDF to the practice's admin for approval.
You never send it to subscribers yourself; the admin reviews the draft in the
admin **Newsletters** module and sends it from there. The full contract is
`docs/runbooks/newsletter-intake.md`.

## Steps

1. Have the PDF, a title (≤ 150 characters, it becomes the email subject) and a
   short description (≤ 1000 characters, shown above the "Read the newsletter"
   button). Keep the PDF **under 4 MB** for this path.

2. Base64-encode the PDF. Then, using the **Supabase** connection (project
   `vpjmdsltwrnpefzcgdmz`), run:

   ```sql
   select *
   from public.newsletter_intake_submit(
     p_title           => '<title>',
     p_description     => '<description>',
     p_pdf_base64      => '<base64>',
     p_file_name       => '<file name>.pdf',
     p_idempotency_key => '<YYYY-MM of the issue>',
     p_list_ids        => null,
     p_submitted_by    => 'claude-routine'
   );
   ```

   `existed = true` means this month's key was already used — do not hand over
   again; report the existing state instead.

3. The newsletter cron tick sweeps the row within about two minutes. Confirm with:

   ```sql
   select * from public.newsletter_intake_status('<YYYY-MM>');
   ```

   `status = 'processed'` and a `campaign_id` mean the draft exists and the admin
   has been emailed. `status = 'failed'` carries the reason in `error`.

4. Finish with a short report: the title, the file size, the idempotency key,
   the final `status`, and the `campaign_id` if there is one.

## Do not

- Do not call the app's REST API from a Routine environment; it cannot reach it.
- Do not send anything to subscribers, and do not try to approve the draft.
- Do not reuse an idempotency key for a different PDF; use a new one (e.g.
  `2026-09-v2`) if the first hand-over failed.
