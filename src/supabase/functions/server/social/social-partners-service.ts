/**
 * Social & Marketing — partner advertisers (service).
 *
 * CRUD over the partners repository. The referral link is built here from the
 * site origin and the partner's referral code, with UTM tags so a visit can be
 * attributed later:
 *   <origin>/?utm_source=partner&utm_medium=referral&utm_campaign=partners&utm_content=<code>
 */

import { socialPartners } from '../repositories/social-partners-repository.ts';
import type { SocialPartner } from './social-partners-types.ts';
import type { CreatePartnerInput, UpdatePartnerInput } from './social-partners-validation.ts';

const SITE_ORIGIN = 'https://www.navigatewealth.co';

/** Partners are a short, hand-kept list; a few hundred at most. */
const LIST_REASON = 'social partners admin list (hand-kept, small)';

export class PartnerConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PartnerConflictError';
  }
}

export class PartnerNotFoundError extends Error {
  constructor() {
    super('Partner not found');
    this.name = 'PartnerNotFoundError';
  }
}

export function buildReferralLink(referralCode: string, origin = SITE_ORIGIN): string {
  const url = new URL('/', origin);
  url.searchParams.set('utm_source', 'partner');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'partners');
  url.searchParams.set('utm_content', referralCode);
  return url.toString();
}

export async function listPartners(): Promise<SocialPartner[]> {
  const all = await socialPartners.listAll(LIST_REASON);
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

async function assertCodeFree(code: string, exceptId?: string) {
  const all = await socialPartners.listAll(LIST_REASON);
  if (all.some((p) => p.referralCode === code && p.id !== exceptId)) {
    throw new PartnerConflictError('That referral code is already used by another partner');
  }
}

export async function createPartner(
  input: CreatePartnerInput,
  adminUserId: string,
): Promise<SocialPartner> {
  await assertCodeFree(input.referralCode);
  const now = new Date().toISOString();
  const partner: SocialPartner = {
    id: crypto.randomUUID(),
    name: input.name,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    website: input.website,
    referralCode: input.referralCode,
    referralLink: buildReferralLink(input.referralCode),
    status: input.status,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
    createdBy: adminUserId,
    updatedBy: adminUserId,
  };
  await socialPartners.put(partner.id, partner);
  return partner;
}

export async function updatePartner(
  id: string,
  patch: UpdatePartnerInput,
  adminUserId: string,
): Promise<SocialPartner> {
  const existing = await socialPartners.get(id);
  if (!existing) throw new PartnerNotFoundError();
  if (patch.referralCode && patch.referralCode !== existing.referralCode) {
    await assertCodeFree(patch.referralCode, id);
  }
  const referralCode = patch.referralCode ?? existing.referralCode;
  const next: SocialPartner = {
    ...existing,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    referralCode,
    referralLink: buildReferralLink(referralCode),
    updatedAt: new Date().toISOString(),
    updatedBy: adminUserId,
  };
  await socialPartners.put(id, next);
  return next;
}

export async function deletePartner(id: string): Promise<void> {
  const existing = await socialPartners.get(id);
  if (!existing) throw new PartnerNotFoundError();
  await socialPartners.remove(id);
}
