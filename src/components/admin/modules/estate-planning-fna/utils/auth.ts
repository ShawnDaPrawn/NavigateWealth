import { api } from '../../../../../utils/api';

/**
 * Session-aware Bearer token for Estate Planning API calls, or `null` when
 * there is no session.
 *
 * Mirrors `api.getAccessToken()`, which stopped falling back to the public anon
 * key (P1.1). Callers must omit the Authorization header when this is null.
 */
export async function getEstatePlanningAuthToken(): Promise<string | null> {
  return api.getAccessToken();
}
