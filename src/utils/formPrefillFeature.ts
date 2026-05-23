/**
 * Feature flag for unified form prefill (rollback lever).
 * Defaults to enabled when unset so existing adviser flows keep working.
 */
export function isFormPrefillEnabled(): boolean {
  const raw = import.meta.env.VITE_FORM_PREFILL_ENABLED;
  if (raw === undefined || raw === '') return true;
  return raw === 'true' || raw === '1';
}
