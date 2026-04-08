export type LegalPdfRendererVersion = 'legacy' | 'paged';

export type LegalPdfRendererResolution = {
  defaultVersion: LegalPdfRendererVersion;
  requestedVersion: LegalPdfRendererVersion;
  effectiveVersion: LegalPdfRendererVersion;
  source: 'default' | 'query' | 'storage';
  pagedAvailable: boolean;
};

export const DEFAULT_LEGAL_PDF_RENDERER_VERSION: LegalPdfRendererVersion = 'paged';
export const LEGAL_PDF_RENDERER_QUERY_PARAM = 'legalPdfRenderer';
export const LEGAL_PDF_RENDERER_STORAGE_KEY = 'nw:legal-pdf-renderer';

function normalizeLegalPdfRendererVersion(value: string | null | undefined): LegalPdfRendererVersion | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'legacy' || normalized === 'paged') {
    return normalized;
  }
  return null;
}

export function getStoredLegalPdfRendererOverride(): LegalPdfRendererVersion | null {
  if (typeof window === 'undefined') return null;
  return normalizeLegalPdfRendererVersion(window.localStorage.getItem(LEGAL_PDF_RENDERER_STORAGE_KEY));
}

export function setStoredLegalPdfRendererOverride(version: LegalPdfRendererVersion) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LEGAL_PDF_RENDERER_STORAGE_KEY, version);
}

export function clearStoredLegalPdfRendererOverride() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LEGAL_PDF_RENDERER_STORAGE_KEY);
}

export function resolveLegalPdfRendererVersion({
  pagedAvailable = false,
}: {
  pagedAvailable?: boolean;
} = {}): LegalPdfRendererResolution {
  let requestedVersion = DEFAULT_LEGAL_PDF_RENDERER_VERSION;
  let source: LegalPdfRendererResolution['source'] = 'default';

  if (typeof window !== 'undefined') {
    const queryValue = normalizeLegalPdfRendererVersion(
      new URLSearchParams(window.location.search).get(LEGAL_PDF_RENDERER_QUERY_PARAM),
    );
    const storageValue = normalizeLegalPdfRendererVersion(
      window.localStorage.getItem(LEGAL_PDF_RENDERER_STORAGE_KEY),
    );

    if (queryValue) {
      requestedVersion = queryValue;
      source = 'query';
    } else if (storageValue) {
      requestedVersion = storageValue;
      source = 'storage';
    }
  }

  const effectiveVersion: LegalPdfRendererVersion = requestedVersion === 'paged'
    ? (pagedAvailable ? 'paged' : 'legacy')
    : 'legacy';

  return {
    defaultVersion: DEFAULT_LEGAL_PDF_RENDERER_VERSION,
    requestedVersion,
    effectiveVersion,
    source,
    pagedAvailable,
  };
}
