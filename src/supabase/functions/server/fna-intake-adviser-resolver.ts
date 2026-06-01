/**
 * Resolve assigned adviser user id for a client (for intake notifications).
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('fna-intake-adviser-resolver');

export async function resolveClientAdviserUserId(clientId: string): Promise<string | null> {
  try {
    const profile = (await kv.get(`user_profile:${clientId}:personal_info`)) as Record<
      string,
      unknown
    > | null;
    if (!profile) return null;

    if (typeof profile.adviserId === 'string' && profile.adviserId) {
      return profile.adviserId;
    }

    const applicationId = profile.applicationId ?? profile.application_id;
    if (!applicationId || typeof applicationId !== 'string') return null;

    const application = (await kv.get(`application:${applicationId}`)) as Record<
      string,
      unknown
    > | null;
    if (!application) return null;

    const adviserId = application.adviserId ?? application.reviewed_by ?? application.approvedBy;
    return typeof adviserId === 'string' && adviserId ? adviserId : null;
  } catch (error) {
    log.warn('Failed to resolve adviser for client', { clientId, error });
    return null;
  }
}
