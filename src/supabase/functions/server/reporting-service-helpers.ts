/**
 * Shared plumbing for the reporting service slices: the service-role
 * Supabase client.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

export function getReportingSupabaseClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}
