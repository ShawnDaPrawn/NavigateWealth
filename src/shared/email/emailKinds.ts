/**
 * Every kind of email the platform sends, in one catalogue.
 *
 * `sendEmail()` (src/supabase/functions/server/email-core.ts) requires a kind
 * on every call and records each send in `email_delivery_log` under it. The
 * Communication Centre's History filters by the same keys, and labels them
 * from here — so the server and the admin screen cannot disagree about what
 * an email is called.
 *
 * Adding an email: add its key here first. `sendEmail` is typed against
 * `EmailKind`, so a send without a catalogued kind does not type-check.
 *
 * `sensitive` emails carry a secret (a one-time code, a reset link). The log
 * keeps the fact that they were sent, never their content: no preview is
 * stored for them.
 *
 * `inCampaignHistory` marks kinds the History view already shows through its
 * own record (Communication Centre campaigns and individual messages carry
 * richer rows of their own). They are still logged, but not listed twice.
 */

export type EmailAudience = 'client' | 'staff' | 'public';

export interface EmailKindInfo {
  label: string;
  audience: EmailAudience;
  sensitive?: boolean;
  inCampaignHistory?: boolean;
}

export const EMAIL_KINDS = {
  // ── Sent by staff from the Communication Centre / client profile ──────────
  campaign: { label: 'Campaign', audience: 'client', inCampaignHistory: true },
  direct_message: { label: 'Individual message', audience: 'client', inCampaignHistory: true },
  documents_sent: { label: 'Documents sent', audience: 'client' },
  request_invitation: { label: 'Request invitation', audience: 'client' },

  // ── Newsletter & publications ─────────────────────────────────────────────
  newsletter: { label: 'Newsletter', audience: 'client' },
  newsletter_test: { label: 'Newsletter test send', audience: 'staff' },
  newsletter_confirm: { label: 'Newsletter subscription confirmation', audience: 'public' },
  newsletter_welcome: { label: 'Newsletter welcome', audience: 'public' },
  newsletter_admin_notice: { label: 'Newsletter subscription alert', audience: 'staff' },
  newsletter_review: { label: 'Newsletter awaiting review', audience: 'staff' },
  publication_notification: { label: 'New article notification', audience: 'client' },

  // ── Automated client emails ───────────────────────────────────────────────
  client_birthday: { label: 'Birthday greeting', audience: 'client' },

  // ── Onboarding & applications ─────────────────────────────────────────────
  application_received: { label: 'Application received', audience: 'client' },
  application_approved: { label: 'Application approved', audience: 'client' },
  application_declined: { label: 'Application declined', audience: 'client' },
  application_invite: { label: 'Application invitation', audience: 'client' },
  onboarded_welcome: { label: 'Welcome (onboarded)', audience: 'client' },
  signup_existing_account: { label: 'Sign-up: existing account', audience: 'public' },
  request_info: { label: 'Information request', audience: 'client' },
  admin_application_alert: { label: 'New application alert', audience: 'staff' },
  admin_approval_alert: { label: 'Application approved alert', audience: 'staff' },
  admin_signup_alert: { label: 'New sign-up alert', audience: 'staff' },
  personnel_invite: { label: 'Staff invitation', audience: 'staff' },

  // ── E-signatures ──────────────────────────────────────────────────────────
  esign_invitation: { label: 'E-sign: signature request', audience: 'client' },
  esign_reminder: { label: 'E-sign: reminder', audience: 'client' },
  esign_recalled: { label: 'E-sign: recalled', audience: 'client' },
  esign_completed: { label: 'E-sign: completed', audience: 'client' },
  esign_expired: { label: 'E-sign: expired', audience: 'client' },
  esign_code: { label: 'E-sign: verification code', audience: 'client', sensitive: true },
  esign_staff_update: { label: 'E-sign: progress alert', audience: 'staff' },
  esign_digest: { label: 'E-sign: activity digest', audience: 'staff' },
  esign_stuck_alert: { label: 'E-sign: stuck envelope alert', audience: 'staff' },

  // ── Account security ──────────────────────────────────────────────────────
  two_factor_code: { label: 'Sign-in code', audience: 'client', sensitive: true },
  two_factor_disabled: { label: 'Two-factor disabled', audience: 'client' },
  account_suspended: { label: 'Account suspended', audience: 'client' },
  account_suspended_alert: { label: 'Account suspended alert', audience: 'staff' },
  password_reset: { label: 'Password reset', audience: 'client', sensitive: true },
  email_change_notice: { label: 'Email change notice', audience: 'client' },
  email_change_code: { label: 'Email change code', audience: 'client', sensitive: true },

  // ── Website enquiries ─────────────────────────────────────────────────────
  contact_form_alert: { label: 'Contact form alert', audience: 'staff' },
  contact_form_ack: { label: 'Contact form acknowledgement', audience: 'public' },
  job_application_ack: { label: 'Job application acknowledgement', audience: 'public' },
  consultation_ack: { label: 'Consultation request acknowledgement', audience: 'public' },
  consultation_alert: { label: 'Consultation request alert', audience: 'staff' },
  quote_ack: { label: 'Quote request acknowledgement', audience: 'public' },
  quote_alert: { label: 'Quote request alert', audience: 'staff' },

  // ── Staff digests ─────────────────────────────────────────────────────────
  calendar_digest: { label: 'Daily calendar digest', audience: 'staff' },
  birthday_digest: { label: 'Client birthdays digest', audience: 'staff' },
  tasks_digest: { label: 'Overdue tasks digest', audience: 'staff' },
  goaml_digest: { label: 'goAML screening digest', audience: 'staff' },
} as const satisfies Record<string, EmailKindInfo>;

export type EmailKind = keyof typeof EMAIL_KINDS;

export function isEmailKind(value: unknown): value is EmailKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EMAIL_KINDS, value);
}

/** Label for a stored kind; an unknown key (an older deploy's) reads as itself. */
export function emailKindLabel(kind: string): string {
  return isEmailKind(kind) ? EMAIL_KINDS[kind].label : kind;
}

export function isSensitiveEmailKind(kind: string): boolean {
  return isEmailKind(kind) && (EMAIL_KINDS[kind] as EmailKindInfo).sensitive === true;
}

/** Kinds the History view lists through their own campaign rows, not the log. */
export const KINDS_IN_CAMPAIGN_HISTORY: readonly EmailKind[] = (
  Object.keys(EMAIL_KINDS) as EmailKind[]
).filter((k) => (EMAIL_KINDS[k] as EmailKindInfo).inCampaignHistory === true);
