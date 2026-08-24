/**
 * The e-sign function's base URL — needed by more than one API slice, and by
 * nothing else.
 */
import { projectId } from '../../../../../utils/supabase/info';

export function getApiBaseUrl(): string {
  return `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/esign`;
}
