import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, CheckCircle2, Clock3, Loader2, TriangleAlert, XCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { LEGAL_PDF_QA_FIXTURES, analyzeLegalPagedPreview, type LegalPdfQaAnalysis, type LegalPdfQaFixture } from '../shared/legalPdfQa';
import { LegalDocumentPdfLayout, type LegalPdfDocumentData } from '../shared/LegalDocumentPdf';
import { normalizeLegalDocumentAnchors, sanitizeLegalDocumentHtml } from '../../utils/legalHtml';
import {
  clearStoredLegalPdfRendererOverride,
  DEFAULT_LEGAL_PDF_RENDERER_VERSION,
  getStoredLegalPdfRendererOverride,
  resolveLegalPdfRendererVersion,
  setStoredLegalPdfRendererOverride,
  type LegalPdfRendererVersion,
} from '../shared/legalPdfRendererConfig';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

type PublicLegalDocumentResponse = {
  available: boolean;
  slug: string;
  document?: {
    id: string;
    title: string;
    description?: string;
    version: string;
    updatedAt: string;
    effectiveDate: string | null;
    section: string | null;
    toc: Array<{ id: string; title: string; level: number }>;
    contentHtml: string | null;
    pdfConfig: {
      pageSize: 'A4' | 'A3';
      orientation: 'portrait' | 'landscape';
    };
  };
};

type FixtureStatus = 'idle' | 'loading' | 'ready' | 'warn' | 'fail';

type FixtureResult = {
  fixture: LegalPdfQaFixture;
  status: FixtureStatus;
  analysis?: LegalPdfQaAnalysis;
  error?: string;
};

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

function statusVariant(status: FixtureStatus) {
  if (status === 'ready') return 'default';
  if (status === 'warn') return 'secondary';
  if (status === 'fail') return 'destructive';
  return 'outline';
}

function statusLabel(status: FixtureStatus) {
  switch (status) {
    case 'ready':
      return 'Pass';
    case 'warn':
      return 'Warn';
    case 'fail':
      return 'Fail';
    case 'loading':
      return 'Running';
    default:
      return 'Idle';
  }
}

function normalizeResponseToPdfDocument(payload: PublicLegalDocumentResponse['document']): LegalPdfDocumentData | null {
  if (!payload) return null;
  const html = sanitizeLegalDocumentHtml(payload.contentHtml || '<p></p>');
  const normalized = normalizeLegalDocumentAnchors(html, payload.toc || []);

  return {
    title: payload.title,
    description: payload.description || null,
    version: payload.version,
    effectiveDate: payload.effectiveDate,
    updatedAt: payload.updatedAt,
    sectionLabel: payload.section,
    html: normalized.html,
    toc: normalized.toc,
    pdfConfig: payload.pdfConfig,
  };
}

async function fetchLegalPdfFixture(slug: string): Promise<LegalPdfDocumentData> {
  const res = await fetch(`${BASE_URL}/resources/legal/${slug}`, {
    headers: {
      Authorization: `Bearer ${publicAnonKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Fixture fetch failed (${res.status})`);
  }

  const payload = await res.json() as PublicLegalDocumentResponse;
  if (!payload.available || !payload.document) {
    throw new Error('Fixture is not publicly available');
  }

  const normalized = normalizeResponseToPdfDocument(payload.document);
  if (!normalized) {
    throw new Error('Fixture could not be normalized');
  }

  return normalized;
}

export function LegalPdfQaPage() {
  const [results, setResults] = useState<Record<string, FixtureResult>>(() => Object.fromEntries(
    LEGAL_PDF_QA_FIXTURES.map((fixture) => [
      fixture.slug,
      {
        fixture,
        status: 'idle' as const,
      },
    ]),
  ));
  const [activeSlug, setActiveSlug] = useState<string>(LEGAL_PDF_QA_FIXTURES[0]?.slug || '');
  const [activeDocument, setActiveDocument] = useState<LegalPdfDocumentData | null>(null);
  const [documentCache, setDocumentCache] = useState<Record<string, LegalPdfDocumentData>>({});
  const [runningQueue, setRunningQueue] = useState<string[]>([]);
  const [renderState, setRenderState] = useState<{
    ready: boolean;
    error: string | null;
    activeRenderer: 'legacy' | 'paged';
  }>({
    ready: false,
    error: null,
    activeRenderer: 'paged',
  });
  const [rendererResolution, setRendererResolution] = useState(() => resolveLegalPdfRendererVersion({ pagedAvailable: true }));

  const previewRef = useRef<HTMLDivElement | null>(null);
  const runTokenRef = useRef(0);

  const activeResult = activeSlug ? results[activeSlug] : undefined;

  const refreshRendererResolution = useCallback(() => {
    setRendererResolution(resolveLegalPdfRendererVersion({ pagedAvailable: true }));
  }, []);

  const startFixtureRun = useCallback(async (slug: string) => {
    const fixture = LEGAL_PDF_QA_FIXTURES.find((item) => item.slug === slug);
    if (!fixture) return;

    runTokenRef.current += 1;
    const runToken = runTokenRef.current;

    setActiveSlug(slug);
    setActiveDocument(null);
    setRenderState({
      ready: false,
      error: null,
      activeRenderer: 'paged',
    });
    setResults((current) => ({
      ...current,
      [slug]: {
        fixture,
        status: 'loading',
      },
    }));

    try {
      const document = await fetchLegalPdfFixture(slug);
      if (runToken !== runTokenRef.current) {
        return;
      }
      setDocumentCache((current) => ({
        ...current,
        [slug]: document,
      }));
      setActiveDocument(document);
    } catch (error) {
      if (runToken !== runTokenRef.current) {
        return;
      }
      setResults((current) => ({
        ...current,
        [slug]: {
          fixture,
          status: 'fail',
          error: error instanceof Error ? error.message : 'Unknown fixture load error',
        },
      }));
      setRunningQueue((current) => current.slice(1));
    }
  }, []);

  const runSuite = useCallback(() => {
    const queue = LEGAL_PDF_QA_FIXTURES.map((fixture) => fixture.slug);
    setRunningQueue(queue);
    void startFixtureRun(queue[0]);
  }, [startFixtureRun]);

  const runSingleFixture = useCallback((slug: string) => {
    setRunningQueue([slug]);
    void startFixtureRun(slug);
  }, [startFixtureRun]);

  const applyRendererOverride = useCallback((version: LegalPdfRendererVersion | null) => {
    if (version) {
      setStoredLegalPdfRendererOverride(version);
    } else {
      clearStoredLegalPdfRendererOverride();
    }
    refreshRendererResolution();
  }, [refreshRendererResolution]);

  useEffect(() => {
    if (!activeDocument || !activeSlug || !renderState.ready || renderState.activeRenderer !== 'paged') {
      return;
    }

    const previewRoot = previewRef.current;
    if (!previewRoot) {
      return;
    }

    const analysis = analyzeLegalPagedPreview(previewRoot);
    const status: FixtureStatus = analysis.warnings.length > 0 ? 'warn' : 'ready';

    setResults((current) => ({
      ...current,
      [activeSlug]: {
        fixture: current[activeSlug]?.fixture || LEGAL_PDF_QA_FIXTURES.find((item) => item.slug === activeSlug)!,
        status,
        analysis,
      },
    }));

    setRunningQueue((current) => {
      if (current.length <= 1) return [];
      const [, ...rest] = current;
      const nextSlug = rest[0];
      window.setTimeout(() => {
        void startFixtureRun(nextSlug);
      }, 80);
      return rest;
    });
  }, [activeDocument, activeSlug, renderState, startFixtureRun]);

  useEffect(() => {
    if (!activeSlug && LEGAL_PDF_QA_FIXTURES[0]) {
      setActiveSlug(LEGAL_PDF_QA_FIXTURES[0].slug);
    }
  }, [activeSlug]);

  useEffect(() => {
    refreshRendererResolution();
  }, [refreshRendererResolution]);

  const summary = useMemo(() => {
    const values = Object.values(results);
    return {
      pass: values.filter((item) => item.status === 'ready').length,
      warn: values.filter((item) => item.status === 'warn').length,
      fail: values.filter((item) => item.status === 'fail').length,
      idle: values.filter((item) => item.status === 'idle').length,
    };
  }, [results]);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
              Back to admin
            </Link>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Legal PDF QA Pack</h1>
              <p className="text-sm text-slate-600">
                Representative paged-render validation for legal disclosures, privacy docs, manuals, and long-form policies.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => activeSlug && runSingleFixture(activeSlug)}>
              Re-run selected
            </Button>
            <Button onClick={runSuite} disabled={runningQueue.length > 0}>
              {runningQueue.length > 0 ? 'Running suite...' : 'Run representative suite'}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Suite Summary</CardTitle>
                <CardDescription>Track rollout readiness and keep rollback one click away if the paged renderer misbehaves.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-white px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Pass</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-700">{summary.pass}</div>
                </div>
                <div className="rounded-xl border bg-white px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Warn</div>
                  <div className="mt-2 text-2xl font-semibold text-amber-700">{summary.warn}</div>
                </div>
                <div className="rounded-xl border bg-white px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Fail</div>
                  <div className="mt-2 text-2xl font-semibold text-rose-700">{summary.fail}</div>
                </div>
                <div className="rounded-xl border bg-white px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Pending</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-700">{summary.idle}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Renderer Rollout Control</CardTitle>
                <CardDescription>
                  Global default is <strong>{DEFAULT_LEGAL_PDF_RENDERER_VERSION}</strong>. Use these local overrides for testing or instant rollback on this browser.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border bg-white px-4 py-3 text-sm text-slate-700">
                  <div><strong>Effective renderer:</strong> {rendererResolution.effectiveVersion}</div>
                  <div><strong>Resolution source:</strong> {rendererResolution.source}</div>
                  <div><strong>Stored override:</strong> {getStoredLegalPdfRendererOverride() || 'none'}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    Emergency rollback also remains available via <code>?legalPdfRenderer=legacy</code>.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={rendererResolution.source === 'storage' && rendererResolution.requestedVersion === 'legacy' ? 'default' : 'outline'}
                    onClick={() => applyRendererOverride('legacy')}
                  >
                    Force legacy locally
                  </Button>
                  <Button
                    variant={rendererResolution.source === 'storage' && rendererResolution.requestedVersion === 'paged' ? 'default' : 'outline'}
                    onClick={() => applyRendererOverride('paged')}
                  >
                    Force paged locally
                  </Button>
                  <Button variant="ghost" onClick={() => applyRendererOverride(null)}>
                    Clear local override
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Representative Fixtures</CardTitle>
                <CardDescription>These documents cover the main legal layouts we need to support before rollout.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {LEGAL_PDF_QA_FIXTURES.map((fixture) => {
                  const result = results[fixture.slug];
                  const active = fixture.slug === activeSlug;
                  return (
                    <button
                      key={fixture.slug}
                      type="button"
                      onClick={() => {
                        setActiveSlug(fixture.slug);
                        if (documentCache[fixture.slug]) {
                          setActiveDocument(documentCache[fixture.slug]);
                          setRenderState({
                            ready: false,
                            error: null,
                            activeRenderer: 'paged',
                          });
                        } else if (result?.status === 'idle') {
                          void runSingleFixture(fixture.slug);
                        }
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-950">{fixture.label}</div>
                          <div className="mt-1 text-sm text-slate-600">{fixture.scenario}</div>
                        </div>
                        <Badge variant={statusVariant(result?.status || 'idle')}>{statusLabel(result?.status || 'idle')}</Badge>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{activeResult?.fixture.label || 'Renderer preview'}</CardTitle>
                <CardDescription>
                  {activeResult?.fixture.scenario || 'Select a representative fixture to inspect the paged renderer.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {activeResult?.status === 'ready' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  {activeResult?.status === 'warn' && <TriangleAlert className="h-4 w-4 text-amber-600" />}
                  {activeResult?.status === 'fail' && <XCircle className="h-4 w-4 text-rose-600" />}
                  {activeResult?.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  {activeResult?.status === 'idle' && <Clock3 className="h-4 w-4 text-slate-500" />}
                  <span className="text-sm text-slate-700">
                    {activeResult?.status === 'loading'
                      ? 'Rendering paged preview and measuring page quality...'
                      : activeResult?.error || 'Use the suite runner or select a fixture to inspect it.'}
                  </span>
                </div>

                {activeResult?.analysis && (
                  <>
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-xl border bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Pages</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">{activeResult.analysis.pageCount}</div>
                      </div>
                      <div className="rounded-xl border bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Max gap</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">{activeResult.analysis.maxGapMm} mm</div>
                      </div>
                      <div className="rounded-xl border bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Average gap</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">{activeResult.analysis.averageGapMm} mm</div>
                      </div>
                      <div className="rounded-xl border bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Max overflow</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">{activeResult.analysis.maxOverflowMm} mm</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-sm font-medium text-slate-900">Warnings</div>
                      <Separator className="my-3" />
                      {activeResult.analysis.warnings.length > 0 ? (
                        <ul className="space-y-2 text-sm text-slate-700">
                          {activeResult.analysis.warnings.map((warning) => (
                            <li key={warning} className="flex items-start gap-2">
                              <TriangleAlert className="mt-0.5 h-4 w-4 text-amber-600" />
                              <span>{warning}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-emerald-700">No QA warnings on this fixture run.</div>
                      )}
                    </div>
                  </>
                )}

                <div className="rounded-2xl border bg-white p-4">
                  <div className="mb-3 text-sm font-medium text-slate-900">Paged preview</div>
                  <div
                    ref={previewRef}
                    className="max-h-[72vh] overflow-auto rounded-2xl border bg-slate-100 p-4"
                  >
                    {activeDocument ? (
                      <LegalDocumentPdfLayout
                        document={activeDocument}
                        rendererVersion="paged"
                        onPagedRendererStateChange={setRenderState}
                      />
                    ) : (
                      <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
                        {activeResult?.status === 'loading' ? 'Fetching fixture...' : 'No fixture loaded yet.'}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LegalPdfQaPage;
