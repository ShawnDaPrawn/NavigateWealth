/**
 * Portal worker — shared mutable run state + warning helpers.
 * ===========================================================
 *
 * Extracted verbatim from scripts/provider-portal-worker.mjs (worker
 * decomposition). Owns the active job id and the job/item warning buffers the
 * monolith kept at module scope. Behaviour-preserving move.
 */
import { initialJobId } from './config.mjs';

export let activeJobId = initialJobId;

export function setActiveJobId(jobId) {
  activeJobId = jobId;
}

export const jobWarnings = [];
export const itemWarnings = new Map();

export function sanitiseWarning(value) {
  return String(value || '').trim().slice(0, 500);
}

export function uniqueWarnings(values = []) {
  return Array.from(new Set(values.map(sanitiseWarning).filter(Boolean))).slice(-20);
}

export function latestWarning(values = []) {
  return values.length ? values[values.length - 1] : undefined;
}

export function rememberJobWarnings(patch = {}) {
  const additions = Array.isArray(patch.warnings)
    ? patch.warnings
    : patch.warning
      ? [patch.warning]
      : [];
  const merged = uniqueWarnings([...jobWarnings, ...additions]);
  jobWarnings.splice(0, jobWarnings.length, ...merged);
}

export function rememberItemWarnings(itemId, patch = {}) {
  if (!itemId) return;
  const existing = itemWarnings.get(itemId) || [];
  const additions = Array.isArray(patch.warnings)
    ? patch.warnings
    : patch.warning
      ? [patch.warning]
      : [];
  itemWarnings.set(itemId, uniqueWarnings([...existing, ...additions]));
}

export function addJobWarning(warning) {
  if (!warning) return;
  rememberJobWarnings({ warning });
}

export function addItemWarning(itemId, warning) {
  if (!warning) return;
  rememberItemWarnings(itemId, { warning });
}
