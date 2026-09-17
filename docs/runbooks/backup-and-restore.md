# Backup And Restore

What is backed up, how to finish configuring it, and how to get the platform
back. Everything here is driven by
[`.github/workflows/weekly-backup.yml`](../../.github/workflows/weekly-backup.yml),
which runs 03:17 UTC on Sundays and can be dispatched by hand.

## The three legs

| Leg         | Covers                                        | Secrets                                     | Proof it produces                                                            |
| ----------- | --------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Database | All of Postgres, including `auth` and the KV  | `SUPABASE_DB_URL`                           | Restores into a scratch Postgres; rows, indexes, constraints and RLS diffed  |
| 2. Storage  | Every Storage object, byte for byte           | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Each object checked against its listed size; archive file count vs. manifest |
| 3. Off-site | Both artifacts, in a bucket nobody can delete | `NW_BACKUP_S3_BUCKET` + credentials         | Object Lock mode and retain-until read back off the stored object            |

Each leg is gated on its own secrets. A missing secret skips **only** that leg,
warns, and records a row in the run's job summary. That last part matters: this
workflow's first three scheduled runs were green while doing no work at all,
because the single secret it needed was unset and every step skipped. A skip is
still not a failure — a red cross every Sunday teaches people to ignore the
workflow — but the run page now says which legs actually ran.

## What is still not covered

- **Supabase's own platform restore** is untested here. Leg 1 proves the bytes
  load into a live Postgres, which is the property that matters, but it is not a
  rehearsal of the vendor's restore button.
- **Re-uploading the Storage archive** into a project is not rehearsed. Leg 2
  proves the objects came down intact and the archive is readable. The restore
  direction below is written but has not been run against a real target.
- **Recovery point objective is up to 24 hours.** Point-in-time recovery was
  declined at ~$100/month (see [`../STATUS.md`](../STATUS.md), "Where money, not
  work, is the blocker"). A failure at 23:00 can lose that day's work. The
  weekly off-site copy is a disaster floor, not an RPO improvement.
- **Secrets are not backed up**, deliberately. A restore rotates them; it does
  not reinstate them. See step 4 of the restore.

## Setup

### Leg 1 — the database secret

`Settings → Secrets and variables → Actions → New repository secret`

- **Name:** `SUPABASE_DB_URL`
- **Value:** Supabase → Project Settings → Database → Connection string → URI,
  with the password included.

**The trap that will otherwise fail the job:** use the **Session pooler**
string on port 5432, not the direct connection. The direct host is IPv6-only and
GitHub's runners are IPv4, so a direct string fails with a connection timeout
that reads like a firewall problem and is not one.

### Leg 2 — the Storage secrets

- **`SUPABASE_URL`** — `https://vpjmdsltwrnpefzcgdmz.supabase.co`
- **`SUPABASE_SERVICE_ROLE_KEY`** — Project Settings → API → `service_role`

Supabase Storage has no scoped credential: there is no read-only key that can
list and download objects, so the service-role key is what leg 2 needs. That
widens what a GitHub compromise yields, and it is a real cost. It is accepted
because the alternative is leaving the least reproducible data the platform
holds — signed e-sign PDFs, client documents, policy documents, e-sign
certificates — with no backup of any kind. It is also the strongest argument for
leg 3: once the locked copy exists, an attacker holding every secret in this
repository still cannot destroy the backups.

### Leg 3 — the locked off-site bucket

This is the leg that survives an attacker who holds every credential. Supabase's
managed backups live inside the account being attacked, and the GitHub artifact
is deletable by any repository admin. Neither survives the compromise it is
meant to insure against.

**Create the bucket with Object Lock enabled.** It cannot be turned on
afterwards; a bucket created without it must be replaced.

```bash
aws s3api create-bucket \
  --bucket navigatewealth-backups \
  --region us-east-1 \
  --object-lock-enabled-for-bucket

aws s3api put-object-lock-configuration \
  --bucket navigatewealth-backups \
  --object-lock-configuration 'ObjectLockEnabled=Enabled,Rule={DefaultRetention={Mode=COMPLIANCE,Days=180}}'

# The dump and the archive hold client PII. Encryption at rest is not optional.
aws s3api put-bucket-encryption \
  --bucket navigatewealth-backups \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block \
  --bucket navigatewealth-backups \
  --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'

# Expire objects once their lock does, so this does not bill forever.
aws s3api put-bucket-lifecycle-configuration \
  --bucket navigatewealth-backups \
  --lifecycle-configuration \
  '{"Rules":[{"ID":"expire-after-lock","Status":"Enabled","Filter":{},"Expiration":{"Days":210},"NoncurrentVersionExpiration":{"NoncurrentDays":30}}]}'
```

**COMPLIANCE, not GOVERNANCE.** Governance retention is bypassable by any caller
holding `s3:BypassGovernanceRetention`, which an attacker who has taken the
cloud account plausibly does. Compliance retention cannot be shortened or
deleted by anyone, including the account root and the vendor. That immovability
is the entire product being bought, and it cuts both ways: an object written by
mistake bills until its retention expires. Retention is set to 180 days by
default for that reason — long enough to outlast a slow-burn intrusion, short
enough that a bad object is not a permanent line item.

**Give CI a principal that cannot delete.** The lock is the real control; this
is defence in depth, and it also stops a mistake in this repository from
costing anything.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "WriteAndVerifyBackups",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:GetObjectRetention", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::navigatewealth-backups", "arn:aws:s3:::navigatewealth-backups/*"]
    },
    {
      "Sid": "NeverDeleteOrWeaken",
      "Effect": "Deny",
      "Action": [
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
        "s3:PutObjectRetention",
        "s3:PutObjectLegalHold",
        "s3:PutBucketVersioning",
        "s3:PutObjectLockConfiguration",
        "s3:BypassGovernanceRetention"
      ],
      "Resource": "arn:aws:s3:::navigatewealth-backups/*"
    }
  ]
}
```

`s3:GetObject` is granted because the upload verifies what it wrote by reading
it back, and an unverified upload is how a bucket without Object Lock goes
unnoticed. Read access is a confidentiality cost, not a resilience one: an
attacker in CI already holds the live data these backups are made from.

Then set the secrets:

| Secret                            | Value                                             |
| --------------------------------- | ------------------------------------------------- |
| `NW_BACKUP_S3_BUCKET`             | `navigatewealth-backups`                          |
| `NW_BACKUP_AWS_ACCESS_KEY_ID`     | the put-only principal's key id                   |
| `NW_BACKUP_AWS_SECRET_ACCESS_KEY` | its secret                                        |
| `NW_BACKUP_S3_ENDPOINT`           | only for a non-AWS endpoint (Backblaze B2, MinIO) |

Optional repository **variables** (`Settings → Secrets and variables → Actions →
Variables`), all with working defaults: `NW_BACKUP_S3_REGION` (`us-east-1`),
`NW_BACKUP_S3_PREFIX` (`navigatewealth`), `NW_BACKUP_RETENTION_DAYS` (`180`),
`NW_BACKUP_LOCK_MODE` (`COMPLIANCE`).

A different provider only changes `NW_BACKUP_S3_ENDPOINT`. Backblaze B2 supports
Object Lock and is roughly a fifth of S3's price; its endpoint looks like
`https://s3.us-west-004.backblazeb2.com`.

## Verify it, which is the only step that counts

```
Actions → Weekly Backup → Run workflow → main
```

Then read the run, not the tick:

1. The **job summary** table must show `true` for every leg you configured.
2. Leg 1 prints `Backup verified: TOC complete AND every data block decoded.`
   and then `restore errors: N total, N attributable to missing extensions`.
3. Leg 2 prints a per-bucket object count and `manifest rows: N, files in
archive: N` with the two numbers equal.
4. Leg 3 prints `verified: <bytes> bytes, COMPLIANCE until <date>` per artifact.

If leg 3 fails with `came back with Object Lock mode 'None'`, the bucket was
created without Object Lock. It cannot be enabled retroactively — create a new
bucket and repoint the secret.

Only once a run has passed end to end should the DR items in
[`../STATUS.md`](../STATUS.md) be checked off. Recording automation as
operationally verified before a single run is precisely what that ledger exists
not to do.

## Restoring

### The database

```bash
# 1. Fetch the newest dump. From the locked bucket, preferred:
aws s3 ls s3://navigatewealth-backups/navigatewealth/ --recursive | sort | tail -5
aws s3 cp s3://navigatewealth-backups/navigatewealth/<yyyy>/<mm>/<dump> .
#    Or, within 90 days, from the workflow run's artifact.

# 2. Restore into the target project's connection string.
#    --no-owner/--no-acl because the roles differ between projects.
pg_restore --no-owner --no-acl --dbname="$TARGET_DB_URL" <dump>
```

Errors naming `pg_cron`, `pg_net`, `supabase_vault` or `wrappers` are expected
on a plain Postgres and are cascades of extensions that image cannot install.
Against a real Supabase project they should not appear. `scripts/ops/compare-restore.py`
is the same comparison CI runs and works by hand:

```bash
bash scripts/ops/capture-db-shape.sh "$SOURCE_DB_URL" source.csv
bash scripts/ops/capture-db-shape.sh "$TARGET_DB_URL" restored.csv
python3 scripts/ops/compare-restore.py source.csv source.csv restored.csv
```

### Storage objects

The archive expands to `objects/<bucket>/<path...>` plus `manifest.csv` and
`buckets.csv`. Buckets must exist before objects land in them, and `buckets.csv`
carries each bucket's public flag — restoring a public bucket as private breaks
the published article images; restoring a private one as public exposes client
documents. Check that column rather than guessing.

```bash
tar -xzf navigatewealth-storage-<stamp>.tar.gz
cat buckets.csv          # bucket,public,objects,bytes — create these first
# then upload objects/<bucket>/... back into each bucket
```

Verify with the manifest, which carries a sha256 per object. A restore that
uploads every file but corrupts one is otherwise invisible.

### After any restore

1. Repoint `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID` and
   `VITE_SUPABASE_ANON_KEY` on Vercel, and redeploy.
2. Redeploy the Edge Function
   ([`deployment.md`](deployment.md)) and re-set every Edge Function secret —
   `.env.example` is the inventory. Backups deliberately do not carry them.
3. Re-install the pg_cron jobs. They live in `supabase/cron/` and pull
   authorisation from `vault.decrypted_secrets`, so the vault secrets must be
   re-created first.
4. **Rotate everything** if the restore follows a compromise rather than an
   accident: service-role key, database password, `SUPABASE_ACCESS_TOKEN`,
   `VERCEL_TOKEN`, the portal worker and gateway secrets, and every provider
   portal credential. A restore that reinstates the attacker's access is not a
   recovery.
5. Run `npm run deploy:smoke` against the new project.
