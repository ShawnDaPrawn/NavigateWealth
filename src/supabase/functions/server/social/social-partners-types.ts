/**
 * Social & Marketing — partner advertisers (types).
 *
 * A partner is a business the practice promotes and that promotes the
 * practice back, with a referral link carrying UTM tags so visits can be
 * attributed. Referral performance is not tracked by this service yet: the
 * admin shows "—" until a tracking source exists.
 */

export type PartnerStatus = 'active' | 'paused' | 'ended';

export interface SocialPartner {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  website: string;
  /** Short code used in the referral link (`utm_content`). Unique per partner. */
  referralCode: string;
  /** The full link to share, with UTM parameters. Built by the service. */
  referralLink: string;
  status: PartnerStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
