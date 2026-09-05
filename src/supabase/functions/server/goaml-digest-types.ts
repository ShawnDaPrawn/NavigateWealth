/**
 * GoAML morning-digest contracts.
 *
 * The Edge Function never logs into goAML. A scheduled Cursor Automation
 * performs the browser login + Outlook OTP, then POSTs a structured scan
 * here. This module is the payload the application persists and mails.
 */

export const GOAML_DIGEST_TOKEN_HEADER = 'x-nw-goaml-digest-token';

export const GOAML_DIGEST_TEMPLATE_ID = 'goaml_scan_digest';

export const GOAML_LOGIN_URL = 'https://goweb.fic.gov.za/goAMLWeb_PRD/Account/LogOn';
export const GOAML_HOME_URL = 'https://goweb.fic.gov.za/';

/** Only these hosts may become clickable links in the digest email. */
export const GOAML_ALLOWED_HOSTS = ['goweb.fic.gov.za'] as const;

/** Staff recipients when NW_GOAML_DIGEST_TO is unset. */
export const DEFAULT_DIGEST_RECIPIENTS = [
  'shawn@navigatewealth.co',
  'helen@directfp.co.za',
] as const;

export const MAX_UPDATES = 50;
export const MAX_TITLE = 200;
export const MAX_SUMMARY = 2000;
export const MAX_NOTES = 2000;
export const MAX_EXCERPT = 4000;

export type GoamlUpdateSeverity = 'info' | 'attention' | 'urgent';

export interface GoamlUpdate {
  title: string;
  summary: string;
  href?: string;
  area?: string;
  severity: GoamlUpdateSeverity;
  observedAt?: string;
}

export interface GoamlScanReport {
  scannedAt: string;
  sourceUrl: string;
  loginSucceeded: boolean;
  otpRequired: boolean;
  otpSucceeded?: boolean;
  updates: GoamlUpdate[];
  notes?: string;
  rawExcerpt?: string;
  dryRun: boolean;
  force: boolean;
}

export interface GoamlScanDiff {
  added: GoamlUpdate[];
  removed: GoamlUpdate[];
  unchanged: GoamlUpdate[];
}

export type GoamlDigestOutcome =
  | 'sent'
  | 'skipped_duplicate'
  | 'dry_run'
  | 'template_disabled'
  | 'login_failed_notified';

export interface GoamlDigestRecord {
  kind: 'snapshot' | 'send';
  scannedAt: string;
  sastDate: string;
  loginSucceeded: boolean;
  otpRequired?: boolean;
  otpSucceeded?: boolean;
  updates: GoamlUpdate[];
  fingerprint: string;
  notes?: string;
  sourceUrl?: string;
  sentAt?: string;
  recipientCount?: number;
  dryRun?: boolean;
  outcome: GoamlDigestOutcome;
  addedCount: number;
  removedCount: number;
}

export interface GoamlNotifyResult {
  success: boolean;
  sent: boolean;
  outcome: GoamlDigestOutcome;
  sastDate: string;
  updateCount: number;
  addedCount: number;
  removedCount: number;
  recipientCount: number;
  dryRun: boolean;
}
