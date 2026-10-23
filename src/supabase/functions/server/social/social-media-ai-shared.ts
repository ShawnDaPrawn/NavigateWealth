/**
 * Shared plumbing for the social-media AI slices: the OpenAI key lookup and
 * the lazy Supabase admin client used for Storage operations.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

export const getOpenAIKey = () => Deno.env.get('OPENAI_API_KEY');

/** Lazy Supabase admin client for Storage operations */
export const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
