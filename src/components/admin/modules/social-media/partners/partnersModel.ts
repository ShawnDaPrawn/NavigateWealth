/**
 * Partner advertisers — pure helpers (validation mirrors the server schema).
 */
import type { PartnerInput, PartnerStatus, SocialPartner } from '../types';

export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  ended: 'Ended',
};

export const EMPTY_PARTNER: PartnerInput = {
  name: '',
  contactName: '',
  contactEmail: '',
  website: '',
  referralCode: '',
  status: 'active',
  notes: '',
};

export function partnerToInput(partner: SocialPartner): PartnerInput {
  return {
    name: partner.name,
    contactName: partner.contactName,
    contactEmail: partner.contactEmail,
    website: partner.website,
    referralCode: partner.referralCode,
    status: partner.status,
    notes: partner.notes,
  };
}

/** "Pretoria Property Group" → "pretoria-property-group" (max 40). */
export function suggestReferralCode(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export type PartnerErrors = Partial<Record<keyof PartnerInput, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE = /^[a-z0-9][a-z0-9-]{1,39}$/;

export function validatePartner(input: PartnerInput, others: SocialPartner[]): PartnerErrors {
  const errors: PartnerErrors = {};
  if (!input.name.trim()) errors.name = 'Add the partner’s name';
  if (input.contactEmail.trim() && !EMAIL.test(input.contactEmail.trim())) {
    errors.contactEmail = 'Enter a valid email address';
  }
  if (input.website.trim()) {
    try {
      const url = new URL(input.website.trim());
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    } catch {
      errors.website = 'Enter a full web address starting with https://';
    }
  }
  const code = input.referralCode.trim().toLowerCase();
  if (!CODE.test(code)) {
    errors.referralCode = 'Use 2–40 lowercase letters, numbers or dashes';
  } else if (others.some((p) => p.referralCode === code)) {
    errors.referralCode = 'Another partner already uses this code';
  }
  return errors;
}
