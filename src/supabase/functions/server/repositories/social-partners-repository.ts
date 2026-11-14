/**
 * Social partner advertisers repository.
 *
 * One KV namespace; the key strings live here so the namespace has exactly one
 * definition (see kv-repository.ts).
 */

import type { SocialPartner } from '../social/social-partners-types.ts';
import { createKvRepository } from './kv-repository.ts';

export const SOCIAL_PARTNERS_NAMESPACE = 'social:partners:';

export const socialPartners = createKvRepository<SocialPartner>(SOCIAL_PARTNERS_NAMESPACE);
