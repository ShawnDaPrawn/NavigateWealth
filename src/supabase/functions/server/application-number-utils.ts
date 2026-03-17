/**
 * Application Number Utilities
 * Shared helper for generating sequential application numbers.
 * Format: APP-YYYY-NNNN (e.g. APP-2026-0042)
 */

import * as kv from './kv_store.tsx';

/**
 * Generate a unique application number for the current year.
 * Scans all existing applications to find the highest sequence number.
 */
export async function generateApplicationNumber(): Promise<string> {
  const year = new Date().getFullYear();

  const allApplications = await kv.getByPrefix('application:');

  if (!allApplications || allApplications.length === 0) {
    return `APP-${year}-0001`;
  }

  // Find highest number for current year
  const currentYearApps = allApplications.filter(
    (app: { application_number?: string; [key: string]: unknown }) =>
      app.application_number &&
      app.application_number.startsWith(`APP-${year}-`)
  );

  if (currentYearApps.length === 0) {
    return `APP-${year}-0001`;
  }

  const numbers = currentYearApps.map((app: { application_number?: string; [key: string]: unknown }) => {
    const match = app.application_number.match(/APP-\d{4}-(\d{4})/);
    return match ? parseInt(match[1], 10) : 0;
  });

  const maxNumber = Math.max(...numbers);
  const nextNumber = (maxNumber + 1).toString().padStart(4, '0');

  return `APP-${year}-${nextNumber}`;
}