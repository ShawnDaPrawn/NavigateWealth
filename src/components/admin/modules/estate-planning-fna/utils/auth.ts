import { api } from '../../../../../utils/api';

/** Session-aware Bearer token for Estate Planning API calls. */
export async function getEstatePlanningAuthToken(): Promise<string> {
  return api.getAccessToken();
}
