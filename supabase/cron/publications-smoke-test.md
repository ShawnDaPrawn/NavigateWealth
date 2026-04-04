# Publications Smoke Test

Use this after deploying the edge function and creating the cron jobs.

## 1. Verify cron jobs exist

- Open Supabase SQL Editor.
- Run `supabase/cron/verify-publications-jobs.sql`.
- Confirm both job names are present:
  - `publications-process-scheduled`
  - `publications-process-notification-jobs`
- Confirm recent `cron.job_run_details` rows show `status = succeeded`.

## 2. Publish test article

- In admin, create or open a non-critical article.
- Publish it with `Notify newsletter subscribers` enabled.
- Confirm the publish modal shows a queued delivery job.
- Confirm the modal or engagement panel shows a recipient count larger than 10 if you have more than 10 subscribers.

## 3. Watch delivery progress

- Wait 1 to 2 minutes.
- Open the article email engagement panel.
- Confirm `sent` keeps increasing without keeping the admin tab focused.
- Confirm `pending` trends down toward zero.

## 4. Validate full recipient coverage

- Compare:
  - newsletter subscriber count
  - article notification job recipient count
  - final `sent + failed`
- These should reconcile. If they do not, inspect the failed recipient rows and the job's `lastError`.

## 5. Retry smoke test

- If any recipients are `failed`, click retry.
- Confirm a retry job is queued for the undelivered publish recipients.
- Wait another 1 to 2 minutes.
- Confirm:
  - `pending` decreases again
  - `sent` increases or `failed` remains with a concrete provider error
  - retry does not stop after a single recipient unless only one undelivered recipient remained

## 6. Failure handling check

- If failures remain, confirm the recipient detail rows show a specific delivery error message.
- Confirm the article remains published even if some deliveries fail.
- Confirm retry is still available for remaining undelivered publish recipients.

## Good outcome

- Article publishes immediately.
- Delivery continues even if the admin page is closed or idle.
- Large sends progress beyond the first 10 recipients automatically.
- Retry processes the real remaining undelivered set, not a stale subset.
