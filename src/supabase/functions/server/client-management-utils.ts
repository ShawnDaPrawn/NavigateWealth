import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

export function createServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

export function deepSanitize(obj: unknown): unknown {
  if (obj === undefined || obj === null) return obj;

  if (typeof obj !== 'object') return obj;

  if (obj instanceof Date) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => deepSanitize(item));
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === 'string') {
      if (key === 'fileUrl' || key === 'path' || key === 'url' || key === 'href') {
        if (value.startsWith('data:')) {
          continue;
        }
        cleaned[key] = value;
        continue;
      }

      if (value.startsWith('data:') || value.length > 5000) {
        continue;
      }

      cleaned[key] = value;
    } else {
      cleaned[key] = deepSanitize(value);
    }
  }

  return cleaned;
}
