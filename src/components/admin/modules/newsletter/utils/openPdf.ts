import { newsletterStudioApi } from '../api';

/**
 * Opens a campaign's PDF in a new tab. The CSP blocks inline frames from
 * storage and the raw-fetch ratchet forbids fetching it, so the tab navigates
 * to a signed URL. The placeholder tab is opened synchronously in the click
 * handler (a tab opened after an await is popup-blocked) and its handle is
 * kept — the `noopener` feature makes `window.open` return null in some
 * browsers — with `opener` cleared by hand instead (review finding).
 */
export function openPdf(campaignId: string): void {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  newsletterStudioApi
    .getPdfUrl(campaignId)
    .then(({ url }) => {
      if (tab && !tab.closed) tab.location.href = url;
      else window.open(url, '_blank', 'noopener');
    })
    .catch(() => {
      if (tab && !tab.closed) tab.close();
    });
}
