/**
 * GA4 / dataLayer helpers. gtag is injected in App.tsx; dataLayer works with GTM.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

/** Fired when the user lands on the dedicated consultation booking entry (UTMs optional). */
export function trackConsultationFlowStarted(params?: Record<string, unknown>) {
  const payload = { ...params };
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'consultation_flow_started', payload);
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'consultation_flow_started', ...payload });
}
