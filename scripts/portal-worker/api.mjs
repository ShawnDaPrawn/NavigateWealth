/**
 * Portal worker — Navigate Wealth API client.
 * ===========================================
 *
 * Extracted verbatim from scripts/provider-portal-worker.mjs (worker
 * decomposition). Owns every HTTP call to the integrations API: job claim,
 * runtime load, status updates, item lifecycle, and staging.
 * Behaviour-preserving move.
 */
import { apiBase, authToken, workerSecret, workerId } from './config.mjs';
import {
  activeJobId,
  itemWarnings,
  jobWarnings,
  latestWarning,
  rememberItemWarnings,
  rememberJobWarnings,
  sanitiseWarning,
  uniqueWarnings,
} from './state.mjs';

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(workerSecret ? { 'X-Portal-Worker-Secret': workerSecret } : {}),
      'X-Portal-Worker-Id': workerId,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

export async function apiUpload(path, formData) {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(workerSecret ? { 'X-Portal-Worker-Secret': workerSecret } : {}),
      'X-Portal-Worker-Id': workerId,
    },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Upload failed: ${response.status}`);
  }
  return data;
}

export function jobPath(suffix = '') {
  if (!activeJobId) throw new Error('No active portal job id.');
  return workerSecret && !authToken
    ? `/portal-worker/jobs/${activeJobId}${suffix}`
    : `/portal-jobs/${activeJobId}${suffix}`;
}

export function workerJobPath(suffix = '') {
  if (!activeJobId) throw new Error('No active portal job id.');
  return `/portal-worker/jobs/${activeJobId}${suffix}`;
}

export async function updateJob(status, patch = {}) {
  rememberJobWarnings(patch);
  const warnings = uniqueWarnings(Array.isArray(patch.warnings) ? patch.warnings : jobWarnings);
  return apiFetch(jobPath('/status'), {
    method: 'POST',
    body: JSON.stringify({
      status,
      ...patch,
      warnings,
      warning: patch.warning ? sanitiseWarning(patch.warning) : latestWarning(warnings),
    }),
  });
}

export async function claimNextPolicyItem() {
  const data = await apiFetch(jobPath('/items/claim'), {
    method: 'POST',
    body: JSON.stringify({ workerId }),
  });
  return data.item || null;
}

export async function updatePolicyItem(itemId, status, patch = {}) {
  rememberItemWarnings(itemId, patch);
  const warnings = uniqueWarnings(Array.isArray(patch.warnings) ? patch.warnings : (itemWarnings.get(itemId) || []));
  return apiFetch(jobPath(`/items/${itemId}/status`), {
    method: 'POST',
    body: JSON.stringify({
      status,
      ...patch,
      warnings,
      warning: patch.warning ? sanitiseWarning(patch.warning) : latestWarning(warnings),
    }),
  });
}

export async function stageCompletedPolicyItems() {
  return apiFetch(jobPath('/stage-items'), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function loadRuntime(jobId) {
  if (workerSecret && !authToken) {
    return apiFetch(`/portal-worker/jobs/${jobId}/runtime`);
  }

  const { job } = await apiFetch(`/portal-jobs/${jobId}`);
  const { flow } = await apiFetch(`/portal-flows/${job.providerId}`);
  return { job, flow, credentials: null, brain: { available: false, configured: false, model: '', memory: null } };
}
