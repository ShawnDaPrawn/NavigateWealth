/**
 * Compliance Auth Helper
 *
 * Resolves the logged-in admin user's access token for Honeycomb API calls.
 * All Honeycomb routes require `requireAuth` middleware, so the Supabase
 * anon key is not sufficient — we must pass the user's JWT.
 */

import { createClient as createSupabaseClient } from '../../../../../../utils/supabase/client';
import { publicAnonKey } from '../../../../../../utils/supabase/info';

/** Resolve the logged-in user's access token, falling back to the anon key. */
export async function getAuthToken(): Promise<string> {
  try {
    const supabase = createSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || publicAnonKey;
  } catch {
    return publicAnonKey;
  }
}
