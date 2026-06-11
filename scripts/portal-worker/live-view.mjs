/**
 * Portal worker — live-view screenshot publishing.
 * ================================================
 *
 * Extracted verbatim from scripts/provider-portal-worker.mjs (worker
 * decomposition). Throttled JPEG uploads that power the admin "Live Portal
 * View" feed while a job runs. Behaviour-preserving move.
 */
import { liveViewIntervalMs } from './config.mjs';
import { activeJobId } from './state.mjs';
import { apiUpload, jobPath } from './api.mjs';
import { safeDebugFilePart } from './debug-artifacts.mjs';

let liveViewUploadPromise = null;
let lastLiveViewUploadAt = 0;

export function resetLiveViewState() {
  lastLiveViewUploadAt = 0;
  liveViewUploadPromise = null;
}

export async function publishLiveView(page, options = {}) {
  if (!page || typeof page.isClosed === 'function' && page.isClosed()) return;
  const force = options.force === true;
  const now = Date.now();
  if (!force && now - lastLiveViewUploadAt < liveViewIntervalMs) return;
  if (liveViewUploadPromise && !force) return liveViewUploadPromise.catch(() => undefined);

  liveViewUploadPromise = (async () => {
    const imageBytes = await page.screenshot({
      type: 'jpeg',
      quality: 55,
      fullPage: false,
      animations: 'disabled',
    }).catch(() => null);
    if (!imageBytes) return;

    const formData = new FormData();
    formData.append('file', new File(
      [imageBytes],
      `${safeDebugFilePart(activeJobId || 'portal-job')}-live-view.jpg`,
      { type: 'image/jpeg' },
    ));
    formData.append('pageUrl', String(page.url() || '').slice(0, 1000));

    const pageTitle = await page.title().catch(() => '');
    if (pageTitle) {
      formData.append('pageTitle', pageTitle.slice(0, 240));
    }
    if (options.note) {
      formData.append('note', String(options.note).slice(0, 500));
    }

    await apiUpload(jobPath('/live-view'), formData).catch(() => undefined);
    lastLiveViewUploadAt = Date.now();
  })().finally(() => {
    liveViewUploadPromise = null;
  });

  return liveViewUploadPromise;
}
