/**
 * Normalizes FNA list API responses across module-specific route shapes.
 */
export function normalizeFnaListResponse<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  const payload = result as {
    success?: boolean;
    data?: T[];
    error?: string;
  };

  if (payload.success && Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  throw new Error(payload.error || 'Failed to load FNAs');
}
