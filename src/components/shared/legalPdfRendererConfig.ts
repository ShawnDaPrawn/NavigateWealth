export type LegalPdfRendererVersion = 'legacy' | 'paged';

export type LegalPdfRendererResolution = {
  defaultVersion: LegalPdfRendererVersion;
  requestedVersion: LegalPdfRendererVersion;
  effectiveVersion: LegalPdfRendererVersion;
  source: 'default' | 'query' | 'storage';
  pagedAvailable: boolean;
};

export const DEFAULT_LEGAL_PDF_RENDERER_VERSION: LegalPdfRendererVersion = 'legacy';
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

  const effectiveVersion = requestedVersion === 'paged' && pagedAvailable
    ? 'paged'
    : DEFAULT_LEGAL_PDF_RENDERER_VERSION;

  return {
    defaultVersion: DEFAULT_LEGAL_PDF_RENDERER_VERSION,
    requestedVersion,
    effectiveVersion,
    source,
    pagedAvailable,
  };
}

