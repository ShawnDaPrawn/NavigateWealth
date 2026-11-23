/**
 * DOCUMENT AI MAPPING TAB
 *
 * Admin configuration for provider terminology mappings used by
 * the AI policy document extraction system (Phase 3).
 *
 * Features:
 * - View all providers with their terminology mappings
 * - Add/edit/remove benefit term → canonical key mappings
 * - Add/edit/remove product → category mappings
 * - Inline editing with save
 *
 * @module DocumentMappingTab
 */

import { useState, useEffect, useCallback } from 'react';

import { Input } from '../../../../ui/input';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { publicAnonKey } from '../../../../../utils/supabase/info';
import { createClient } from '../../../../../utils/supabase/client';
import { useProviders } from '../hooks/useProviders';
import { ExtractionQualityDashboard } from './ExtractionQualityDashboard';
import { RenewalAlertScanner } from './RenewalAlertScanner';
import { Tabs, TabsContent } from '../../../../ui/tabs';
import {
  DsButton,
  ErrorState,
  SegmentedList,
  SegmentedTrigger,
  useBreadcrumbTrail,
  useUrlState,
} from '../../../layout/page';

const DOC_AI_VIEWS = ['extraction', 'renewals'] as const;
type DocAiView = (typeof DOC_AI_VIEWS)[number];

import {
  API_BASE,
  CANONICAL_BENEFIT_KEYS,
  PRODUCT_CATEGORIES,
  type TerminologyMap,
  type NewMappingRow,
  type BulkProvider,
  type BulkPreview,
  type BulkResults,
  type BulkProgress,
  type StreamingResult,
} from './documentMappingModel';
import { BulkReextractDialog } from './BulkReextractDialog';

export function DocumentMappingTab() {
  // Extraction or Renewal alerts, in the address (?docai=renewals).
  const [docAiView, setDocAiView] = useUrlState<DocAiView>('docai', 'extraction', DOC_AI_VIEWS);
  useBreadcrumbTrail(
    docAiView === 'renewals'
      ? [
          { label: 'Document AI', onClick: () => setDocAiView('extraction') },
          { label: 'Renewal alerts' },
        ]
      : [{ label: 'Document AI' }],
  );
  const {
    providers,
    isLoading: providersLoading,
    error: providersError,
    fetchProviders: refetchProviders,
  } = useProviders();
  const [terminologies, setTerminologies] = useState<TerminologyMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state
  const [editingBenefitMappings, setEditingBenefitMappings] = useState<Record<string, string>>({});
  const [editingProductMappings, setEditingProductMappings] = useState<Record<string, string>>({});
  const [newBenefitRow, setNewBenefitRow] = useState<NewMappingRow>({ term: '', canonicalKey: '' });
  const [newProductRow, setNewProductRow] = useState<NewMappingRow>({ term: '', canonicalKey: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [_hasChanges, setHasChanges] = useState(false);

  // Bulk re-extract state
  const [bulkReextractProvider, setBulkReextractProvider] = useState<BulkProvider | null>(null);
  const [isBulkExtracting, setIsBulkExtracting] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<BulkPreview | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResults | null>(null);
  // Streaming progress state
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [streamingResults, setStreamingResults] = useState<StreamingResult[]>([]);

  const getAuthToken = useCallback(async (): Promise<string> => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || publicAnonKey;
  }, []);

  const fetchTerminologies = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/provider-terminology`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Terminology mappings request failed (${res.status})`);
      }
      const data = await res.json();
      setTerminologies(data.terminologies || []);
      setLoadError(null);
    } catch (err) {
      console.error('Failed to fetch terminologies:', err);
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    fetchTerminologies();
  }, [fetchTerminologies]);

  const handleExpandProvider = (providerId: string) => {
    if (expandedProvider === providerId) {
      setExpandedProvider(null);
      return;
    }
    setExpandedProvider(providerId);
    setHasChanges(false);

    // Load existing mappings for this provider
    const existing = terminologies.find((t) => t.providerId === providerId);
    setEditingBenefitMappings(existing?.benefitMappings || {});
    setEditingProductMappings(existing?.productMappings || {});
    setNewBenefitRow({ term: '', canonicalKey: '' });
    setNewProductRow({ term: '', canonicalKey: '' });
  };

  const handleAddBenefitMapping = () => {
    if (!newBenefitRow.term.trim() || !newBenefitRow.canonicalKey) {
      toast.error('Please enter both a provider term and a canonical key');
      return;
    }
    setEditingBenefitMappings((prev) => ({
      ...prev,
      [newBenefitRow.term.trim()]: newBenefitRow.canonicalKey,
    }));
    setNewBenefitRow({ term: '', canonicalKey: '' });
    setHasChanges(true);
  };

  const handleRemoveBenefitMapping = (term: string) => {
    setEditingBenefitMappings((prev) => {
      const next = { ...prev };
      delete next[term];
      return next;
    });
    setHasChanges(true);
  };

  const handleAddProductMapping = () => {
    if (!newProductRow.term.trim() || !newProductRow.canonicalKey) {
      toast.error('Please enter both a product name and a category');
      return;
    }
    setEditingProductMappings((prev) => ({
      ...prev,
      [newProductRow.term.trim()]: newProductRow.canonicalKey,
    }));
    setNewProductRow({ term: '', canonicalKey: '' });
    setHasChanges(true);
  };

  const handleRemoveProductMapping = (term: string) => {
    setEditingProductMappings((prev) => {
      const next = { ...prev };
      delete next[term];
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = async (providerId: string, providerName: string) => {
    setIsSaving(true);
    const toastId = toast.loading('Saving terminology mappings...');
    try {
      const token = await getAuthToken();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const res = await fetch(`${API_BASE}/provider-terminology`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          providerId,
          providerName,
          benefitMappings: editingBenefitMappings,
          productMappings: editingProductMappings,
          updatedBy: user?.id || 'admin',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save');
      }

      toast.success('Terminology mappings saved', { id: toastId });
      setHasChanges(false);
      await fetchTerminologies();
    } catch (err: unknown) {
      console.error('Save terminology error:', err);
      toast.error((err as Error)?.message || 'Failed to save mappings', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter providers by search
  const filteredProviders = providers.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleBulkReextractPreview = async (providerId: string, providerName: string) => {
    setBulkReextractProvider({ id: providerId, name: providerName });
    setBulkResults(null);
    setBulkPreview(null);
    setIsBulkExtracting(true);

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/policy-extraction/bulk-reextract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ providerId, dryRun: true }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to preview');
      }

      const data = await res.json();
      setBulkPreview({
        candidateCount: data.candidateCount,
        candidates: data.candidates || [],
      });
    } catch (err: unknown) {
      console.error('Bulk re-extract preview error:', err);
      toast.error((err as Error)?.message || 'Failed to preview bulk re-extraction');
      setBulkReextractProvider(null);
    } finally {
      setIsBulkExtracting(false);
    }
  };

  const handleBulkReextractExecute = async () => {
    if (!bulkReextractProvider) return;
    setIsBulkExtracting(true);
    setBulkPreview(null);
    setBulkProgress({
      current: 0,
      total: bulkPreview?.candidateCount || 0,
      currentFileName: '',
      currentStatus: 'starting',
      completedTimestamps: [],
      startedAt: Date.now(),
    });
    setStreamingResults([]);

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/policy-extraction/bulk-reextract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ providerId: bulkReextractProvider.id, dryRun: false }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Bulk re-extraction failed');
      }

      // Read NDJSON stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: { totalProcessed: number; successCount: number; failCount: number } | null =
        null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === 'progress') {
              setBulkProgress((prev) =>
                prev
                  ? {
                      ...prev,
                      current: event.current,
                      total: event.total,
                      currentFileName: event.fileName || '',
                      currentStatus: 'processing',
                    }
                  : {
                      current: event.current,
                      total: event.total,
                      currentFileName: event.fileName || '',
                      currentStatus: 'processing',
                      completedTimestamps: [],
                      startedAt: Date.now(),
                    },
              );
            } else if (event.type === 'result') {
              setBulkProgress((prev) =>
                prev
                  ? {
                      ...prev,
                      current: event.current,
                      currentFileName: event.fileName || '',
                      currentStatus: event.status,
                      completedTimestamps: [...prev.completedTimestamps, Date.now()],
                    }
                  : null,
              );
              setStreamingResults((prev) => [
                ...prev,
                {
                  policyId: event.policyId,
                  fileName: event.fileName || '',
                  status: event.status,
                  confidence: event.confidence,
                  error: event.error,
                },
              ]);
            } else if (event.type === 'complete') {
              finalResult = {
                totalProcessed: event.totalProcessed,
                successCount: event.successCount,
                failCount: event.failCount,
              };
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      // Set final results
      if (finalResult) {
        setBulkResults({
          ...finalResult,
          results: [], // Results are in streamingResults
        });
        setBulkProgress(null);

        if (finalResult.failCount === 0) {
          toast.success(`All ${finalResult.successCount} policies re-extracted successfully`);
        } else {
          toast.warning(`${finalResult.successCount} succeeded, ${finalResult.failCount} failed`);
        }
      }
    } catch (err: unknown) {
      console.error('Bulk re-extract execute error:', err);
      toast.error((err as Error)?.message || 'Bulk re-extraction failed');
      setBulkProgress(null);
    } finally {
      setIsBulkExtracting(false);
    }
  };

  if (providersLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <Tabs
      value={docAiView}
      onValueChange={(v) => setDocAiView(v as DocAiView)}
      className="flex flex-col gap-5"
    >
      <SegmentedList aria-label="Document AI views">
        <SegmentedTrigger value="extraction">Extraction</SegmentedTrigger>
        <SegmentedTrigger value="renewals">Renewal alerts</SegmentedTrigger>
      </SegmentedList>
      <TabsContent value="renewals" className="m-0 focus-visible:outline-none">
        <RenewalAlertScanner />
      </TabsContent>
      <TabsContent value="extraction" className="m-0 focus-visible:outline-none">
        <ExtractionQualityDashboard>
          {loadError || providersError ? (
            <ErrorState
              title="Unable to load terminology mappings"
              onRetry={() => {
                void fetchTerminologies();
                if (providersError) void refetchProviders();
              }}
              details={loadError ?? (providersError as Error).message}
            />
          ) : (
            <>
              {/* PM-DocAI: one "Terminology mappings" card, search in its header */}
              <section className="ds-card overflow-hidden">
                <div className="ds-card-h flex-wrap">
                  <h3>Terminology mappings</h3>
                  <input
                    className="ds-input w-full sm:w-auto sm:min-w-[220px]"
                    placeholder="Search providers…"
                    aria-label="Search providers"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <p className="ds-card-b ds-meta border-b border-nw-line">
                  Map a provider&apos;s own benefit or product names (e.g. &quot;Lifestyle
                  Protector&quot;) to our fields, so AI extraction uses the mapping instead of
                  guessing.
                </p>

                {filteredProviders.length === 0 ? (
                  <div className="ds-card-b">
                    <span className="ds-meta">
                      {searchQuery ? 'No providers match your search.' : 'No providers yet.'}
                    </span>
                  </div>
                ) : (
                  <ul className="divide-y divide-nw-line">
                    {filteredProviders.map((provider) => {
                      const existingMap = terminologies.find((t) => t.providerId === provider.id);
                      const benefitCount = existingMap
                        ? Object.keys(existingMap.benefitMappings || {}).length
                        : 0;
                      const productCount = existingMap
                        ? Object.keys(existingMap.productMappings || {}).length
                        : 0;
                      const isExpanded = expandedProvider === provider.id;
                      const countLine =
                        benefitCount === 0 && productCount === 0
                          ? 'No mappings'
                          : [
                              benefitCount > 0 &&
                                `${benefitCount} benefit mapping${benefitCount > 1 ? 's' : ''}`,
                              productCount > 0 &&
                                `${productCount} product mapping${productCount > 1 ? 's' : ''}`,
                            ]
                              .filter(Boolean)
                              .join(' · ');

                      return (
                        <li key={provider.id}>
                          <button
                            type="button"
                            className="ds-todo-row w-full text-left hover:bg-[#fbfaf7]"
                            aria-expanded={isExpanded}
                            onClick={() => handleExpandProvider(provider.id)}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-nw-violet-50 text-[11.5px] font-semibold text-nw-violet">
                              {provider.logo ? (
                                <img
                                  src={provider.logo}
                                  alt=""
                                  className="h-full w-full bg-white object-contain p-0.5"
                                />
                              ) : (
                                provider.name.slice(0, 2).toUpperCase()
                              )}
                            </span>
                            <span className="grow min-w-0">
                              <b className="block text-[13.5px] font-medium text-nw-ink">
                                {provider.name}
                              </b>
                              <span className="ds-meta">{countLine}</span>
                            </span>
                            <ChevronDown
                              className={`h-4 w-4 text-nw-text-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              aria-hidden="true"
                            />
                          </button>

                          {isExpanded && (
                            <div className="space-y-5 border-t border-nw-line bg-[#fbfaf7] px-4 py-4">
                              <MappingTable
                                title="Benefit terms"
                                termHeading="Provider term"
                                targetHeading="Maps to"
                                rows={Object.entries(editingBenefitMappings).map(([term, key]) => ({
                                  term,
                                  target:
                                    CANONICAL_BENEFIT_KEYS.find((k) => k.value === key)?.label ||
                                    key,
                                }))}
                                onRemove={handleRemoveBenefitMapping}
                                newTerm={newBenefitRow.term}
                                onNewTerm={(term) =>
                                  setNewBenefitRow((prev) => ({ ...prev, term }))
                                }
                                newTarget={newBenefitRow.canonicalKey}
                                onNewTarget={(canonicalKey) =>
                                  setNewBenefitRow((prev) => ({ ...prev, canonicalKey }))
                                }
                                options={CANONICAL_BENEFIT_KEYS}
                                onAdd={handleAddBenefitMapping}
                              />
                              <MappingTable
                                title="Product names"
                                termHeading="Product name"
                                targetHeading="Category"
                                rows={Object.entries(editingProductMappings).map(
                                  ([term, catId]) => ({
                                    term,
                                    target:
                                      PRODUCT_CATEGORIES.find((c) => c.value === catId)?.label ||
                                      catId,
                                  }),
                                )}
                                onRemove={handleRemoveProductMapping}
                                newTerm={newProductRow.term}
                                onNewTerm={(term) =>
                                  setNewProductRow((prev) => ({ ...prev, term }))
                                }
                                newTarget={newProductRow.canonicalKey}
                                onNewTarget={(canonicalKey) =>
                                  setNewProductRow((prev) => ({ ...prev, canonicalKey }))
                                }
                                options={PRODUCT_CATEGORIES}
                                onAdd={handleAddProductMapping}
                              />

                              <div className="flex flex-wrap items-center gap-2">
                                {existingMap?.updatedAt && (
                                  <span className="ds-meta">
                                    Updated{' '}
                                    {new Date(existingMap.updatedAt).toLocaleDateString('en-ZA')}
                                  </span>
                                )}
                                <span className="grow" />
                                {(benefitCount > 0 || productCount > 0) && (
                                  <DsButton
                                    size="sm"
                                    disabled={isBulkExtracting}
                                    onClick={() =>
                                      handleBulkReextractPreview(provider.id, provider.name)
                                    }
                                  >
                                    {isBulkExtracting && bulkReextractProvider?.id === provider.id
                                      ? 'Scanning…'
                                      : 'Bulk re-extract'}
                                  </DsButton>
                                )}
                                <DsButton
                                  size="sm"
                                  variant="primary"
                                  disabled={isSaving}
                                  onClick={() => handleSave(provider.id, provider.name)}
                                >
                                  {isSaving ? 'Saving…' : 'Save mappings'}
                                </DsButton>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              <BulkReextractDialog
                bulkReextractProvider={bulkReextractProvider}
                setBulkReextractProvider={setBulkReextractProvider}
                bulkPreview={bulkPreview}
                setBulkPreview={setBulkPreview}
                bulkResults={bulkResults}
                setBulkResults={setBulkResults}
                bulkProgress={bulkProgress}
                setBulkProgress={setBulkProgress}
                streamingResults={streamingResults}
                setStreamingResults={setStreamingResults}
                isBulkExtracting={isBulkExtracting}
                onExecute={handleBulkReextractExecute}
              />
            </>
          )}
        </ExtractionQualityDashboard>
      </TabsContent>
    </Tabs>
  );
}

/** One block of term → target mappings, with an add row, in the board's table style. */
function MappingTable({
  title,
  termHeading,
  targetHeading,
  rows,
  onRemove,
  newTerm,
  onNewTerm,
  newTarget,
  onNewTarget,
  options,
  onAdd,
}: {
  title: string;
  termHeading: string;
  targetHeading: string;
  rows: { term: string; target: string }[];
  onRemove: (term: string) => void;
  newTerm: string;
  onNewTerm: (term: string) => void;
  newTarget: string;
  onNewTarget: (value: string) => void;
  options: readonly { value: string; label: string }[];
  onAdd: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-nw-line bg-white">
      <div className="border-b border-nw-line px-3.5 py-2.5 text-[13px] font-medium text-nw-ink">
        {title}
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-nw-line bg-[#fbfaf7] text-left text-[12px] text-nw-text-3">
            <th className="px-3.5 py-2 font-medium">{termHeading}</th>
            <th className="px-3.5 py-2 font-medium">{targetHeading}</th>
            <th className="w-[90px] px-3.5 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-nw-line">
          {rows.map((row) => (
            <tr key={row.term}>
              <td className="px-3.5 py-2 text-nw-ink">{row.term}</td>
              <td className="px-3.5 py-2 text-nw-text-2">{row.target}</td>
              <td className="px-3.5 py-1.5 text-right">
                <DsButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${row.term}`}
                  onClick={() => onRemove(row.term)}
                >
                  Remove
                </DsButton>
              </td>
            </tr>
          ))}
          <tr>
            <td className="px-3.5 py-2">
              <Input
                aria-label={termHeading}
                value={newTerm}
                onChange={(e) => onNewTerm(e.target.value)}
                className="h-8 text-[13px]"
              />
            </td>
            <td className="px-3.5 py-2">
              <Select value={newTarget} onValueChange={onNewTarget}>
                <SelectTrigger className="h-8 text-[13px]" aria-label={targetHeading}>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </td>
            <td className="px-3.5 py-1.5 text-right">
              <DsButton size="sm" onClick={onAdd}>
                Add
              </DsButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
