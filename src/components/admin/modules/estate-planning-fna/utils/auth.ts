import { createClient } from '../../../../../utils/supabase/client';
import { publicAnonKey } from '../../../../../utils/supabase/info';

export async function getEstatePlanningAuthToken(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || publicAnonKey;
  } catch {
    return publicAnonKey;
  }
}
