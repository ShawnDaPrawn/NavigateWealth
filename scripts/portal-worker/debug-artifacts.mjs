/**
 * Portal worker — debug artifacts (JSON snapshots + screenshots).
 * ===============================================================
 *
 * Extracted verbatim from scripts/provider-portal-worker.mjs (worker
 * decomposition). Writes per-item diagnostics into NW_PORTAL_DEBUG_DIR when
 * configured; every helper is a no-op without a debug dir.
 * Behaviour-preserving move.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { debugDir } from './config.mjs';
import { activeJobId } from './state.mjs';
import { capturePolicyConfirmationSnapshot } from './page-utils.mjs';

export function safeDebugFilePart(value) {
  return String(value || 'debug')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'debug';
}

export async function ensureDir(path) {
  if (!path) return;
  await mkdir(path, { recursive: true }).catch(() => undefined);
}

export async function ensureDebugDir() {
  await ensureDir(debugDir);
}

export function buildDebugAssetPath(name, extension) {
  if (!debugDir) return '';
  return `${debugDir}/${safeDebugFilePart(activeJobId)}-${safeDebugFilePart(name)}.${extension}`;
}

export async function writeDebugArtifact(item, name, payload) {
  if (!debugDir) return;
  await ensureDebugDir();
  const fileName = [
    safeDebugFilePart(activeJobId),
    safeDebugFilePart(item?.policyNumber || item?.id),
    safeDebugFilePart(name),
  ].join('-');
  await writeFile(
    `${debugDir}/${fileName}.json`,
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  ).catch(() => undefined);
}

export async function writeDebugScreenshot(page, item, name) {
  if (!debugDir) return;
  await ensureDebugDir();
  const fileName = [
    safeDebugFilePart(activeJobId),
    safeDebugFilePart(item?.policyNumber || item?.id),
    safeDebugFilePart(name),
  ].join('-');
  await page.screenshot({
    path: `${debugDir}/${fileName}.png`,
    fullPage: true,
  }).catch(() => undefined);
}

export async function writePageDiagnostics(page, name, payload = {}) {
  const snapshot = await capturePolicyConfirmationSnapshot(page).catch(() => ({
    currentUrl: page.url(),
    title: '',
    sample: '',
  }));
  await writeDebugArtifact(null, name, {
    ...payload,
    snapshot: {
      currentUrl: snapshot.currentUrl || page.url(),
      title: snapshot.title || '',
      sample: snapshot.sample || '',
    },
    createdAt: new Date().toISOString(),
  });
  await writeDebugScreenshot(page, null, name);
}

export async function writeOtpDiagnostics(page, name, payload = {}) {
  await writePageDiagnostics(page, name, payload);
}
