#!/usr/bin/env bash
# Copy backup artifacts to an S3-compatible bucket with Object Lock, and PROVE
# the lock was applied.
#
# WHY OBJECT LOCK AND NOT JUST "ANOTHER BUCKET"
# ---------------------------------------------
# A second copy that the same credential can delete is not ransomware
# protection — it is a second thing for the attacker to encrypt. What makes a
# backup survive an attacker holding every key is that the STORAGE ITSELF
# refuses deletion. With Object Lock in COMPLIANCE mode, no principal, not the
# account root, not AWS support, can delete or overwrite an object before its
# retain-until date. That is the property being bought here.
#
# Before this, the only off-vendor copy was the GitHub Actions artifact on the
# backup workflow: 90-day retention, and deletable by any repository admin —
# which is to say, by exactly the account whose compromise the off-vendor copy
# is meant to survive.
#
# VERIFICATION IS THE POINT
# -------------------------
# Every check below is there because the failure it catches is silent. A put
# that lands in a bucket WITHOUT Object Lock enabled succeeds and looks
# identical to one that is protected, so the retention metadata is read back
# from the object rather than assumed from the request. This mirrors the
# existing `pg_restore --file=/dev/null` decode in the backup workflow: produce
# the artifact, then prove the property you claim it has.
#
# SETUP (one time — docs/runbooks/backup-and-restore.md has the click-path)
#   1. Create a bucket with Object Lock ENABLED AT CREATION. It cannot be
#      turned on afterwards.
#   2. Set a default retention, and keep versioning on (Object Lock requires it).
#   3. Create a principal that can put and read but NOT delete, and give CI its
#      keys. The lock is the real control; the policy is defence in depth.
#
# ENVIRONMENT
#   NW_BACKUP_S3_BUCKET        required — without it this script exits 0 and
#                              does nothing, so the workflow stays green before
#                              the bucket exists
#   NW_BACKUP_S3_PREFIX        key prefix (default: navigatewealth)
#   NW_BACKUP_S3_ENDPOINT      S3-compatible endpoint (Backblaze B2, MinIO…);
#                              omit for AWS S3
#   NW_BACKUP_S3_REGION        region (default: us-east-1)
#   NW_BACKUP_RETENTION_DAYS   lock duration (default: 180)
#   NW_BACKUP_LOCK_MODE        COMPLIANCE (default) or GOVERNANCE
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   the put-only principal
#
# Usage: upload-offsite.sh <file> [<file>...]
set -euo pipefail

BUCKET="${NW_BACKUP_S3_BUCKET:-}"
if [ -z "$BUCKET" ]; then
  echo "::warning::NW_BACKUP_S3_BUCKET is not set — skipping the off-site copy. See docs/runbooks/backup-and-restore.md."
  echo "offsite=skipped" >> "${GITHUB_OUTPUT:-/dev/null}"
  exit 0
fi

if [ "$#" -eq 0 ]; then
  echo "::error::upload-offsite.sh needs at least one file to upload."
  exit 2
fi

command -v aws > /dev/null 2>&1 || {
  echo "::error::The AWS CLI is not installed on this runner."
  exit 1
}

PREFIX="${NW_BACKUP_S3_PREFIX:-navigatewealth}"
REGION="${NW_BACKUP_S3_REGION:-us-east-1}"
RETENTION_DAYS="${NW_BACKUP_RETENTION_DAYS:-180}"
LOCK_MODE="${NW_BACKUP_LOCK_MODE:-COMPLIANCE}"

case "$LOCK_MODE" in
  COMPLIANCE | GOVERNANCE) ;;
  *)
    echo "::error::NW_BACKUP_LOCK_MODE must be COMPLIANCE or GOVERNANCE, got '$LOCK_MODE'."
    exit 2
    ;;
esac

# GOVERNANCE is deletable by anyone holding s3:BypassGovernanceRetention, which
# an attacker who has taken the cloud account plausibly does. It is supported
# here because it is the right choice while testing the pipeline, but it is not
# the control this workflow is for, and a run that uses it says so.
if [ "$LOCK_MODE" = "GOVERNANCE" ]; then
  echo "::warning::Object Lock is in GOVERNANCE mode — a caller with s3:BypassGovernanceRetention can still delete these backups. COMPLIANCE is the ransomware-resistant setting."
fi

ENDPOINT_ARGS=()
if [ -n "${NW_BACKUP_S3_ENDPOINT:-}" ]; then
  ENDPOINT_ARGS=(--endpoint-url "$NW_BACKUP_S3_ENDPOINT")
fi

RETAIN_UNTIL="$(date -u -d "+${RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%SZ)"
RETAIN_UNTIL_EPOCH="$(date -u -d "$RETAIN_UNTIL" +%s)"
# One day of slack. The server records the date it was given, but clock skew and
# an endpoint that rounds to midnight should not fail an otherwise good upload.
MIN_ACCEPTABLE_EPOCH=$((RETAIN_UNTIL_EPOCH - 86400))
DATE_PREFIX="$(date -u +%Y/%m)"

echo "Off-site target: s3://$BUCKET/$PREFIX/$DATE_PREFIX/"
echo "Object Lock: $LOCK_MODE until $RETAIN_UNTIL (${RETENTION_DAYS} days)"

uploaded=0
for file in "$@"; do
  [ -f "$file" ] || {
    echo "::error::$file does not exist."
    exit 1
  }

  size="$(stat -c%s "$file")"
  # put-object is a single-part upload, capped at 5 GB by the S3 API. It is used
  # rather than `aws s3 cp` because the per-object Object Lock arguments are
  # only documented on the low-level call, and a backup that silently lands
  # unlocked is the one outcome this script exists to prevent. If the archive
  # ever approaches this, switch to a multipart upload that sets retention —
  # do not drop the lock to make the upload fit.
  if [ "$size" -gt 5000000000 ]; then
    echo "::error::$file is $size bytes, past the 5 GB single-part limit. See the comment above this check."
    exit 1
  fi

  key="$PREFIX/$DATE_PREFIX/$(basename "$file")"
  echo "--> s3://$BUCKET/$key ($size bytes)"

  aws s3api put-object \
    "${ENDPOINT_ARGS[@]}" \
    --region "$REGION" \
    --bucket "$BUCKET" \
    --key "$key" \
    --body "$file" \
    --object-lock-mode "$LOCK_MODE" \
    --object-lock-retain-until-date "$RETAIN_UNTIL" \
    --output text > /dev/null

  # Read the object back. Everything below is asserted against what the SERVER
  # says, never against what was requested.
  read -r remote_size remote_mode remote_until remote_etag <<< "$(
    aws s3api head-object \
      "${ENDPOINT_ARGS[@]}" \
      --region "$REGION" \
      --bucket "$BUCKET" \
      --key "$key" \
      --query '[ContentLength,ObjectLockMode,ObjectLockRetainUntilDate,ETag]' \
      --output text
  )"

  if [ "$remote_size" != "$size" ]; then
    echo "::error::$key is $remote_size bytes remotely, $size locally — the upload is incomplete."
    exit 1
  fi

  if [ "$remote_mode" != "$LOCK_MODE" ]; then
    echo "::error::$key came back with Object Lock mode '$remote_mode', expected '$LOCK_MODE'. The bucket almost certainly does not have Object Lock enabled — it cannot be turned on after creation, so the bucket must be recreated."
    exit 1
  fi

  remote_until_epoch="$(date -u -d "$remote_until" +%s 2> /dev/null || echo 0)"
  if [ "$remote_until_epoch" -lt "$MIN_ACCEPTABLE_EPOCH" ]; then
    echo "::error::$key is retained only until '$remote_until', short of the requested $RETAIN_UNTIL."
    exit 1
  fi

  # ETag on a single-part upload is the MD5 of the body on AWS S3 and on every
  # S3-compatible endpoint this targets. A multipart ETag carries a `-N` suffix
  # and is not an MD5, so it is skipped rather than compared wrongly — the
  # length and lock checks above still gate those.
  etag="${remote_etag//\"/}"
  if [[ "$etag" != *-* ]]; then
    local_md5="$(md5sum "$file" | cut -d' ' -f1)"
    if [ "$etag" != "$local_md5" ]; then
      echo "::error::$key has ETag $etag, local MD5 is $local_md5 — the bytes that landed are not the bytes that were sent."
      exit 1
    fi
  fi

  echo "    verified: $remote_size bytes, $remote_mode until $remote_until"
  uploaded=$((uploaded + 1))
done

echo "Off-site copy complete: $uploaded artifact(s) locked until $RETAIN_UNTIL."
echo "offsite=uploaded" >> "${GITHUB_OUTPUT:-/dev/null}"
