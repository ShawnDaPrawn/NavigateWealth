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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Badge } from '../../../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Sparkles,
  Building2,
  Plus,
  Trash2,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  FileText,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { publicAnonKey } from '../../../../../utils/supabase/info';
import { createClient } from '../../../../../utils/supabase/client';
import { useProviders } from '../hooks/useProviders';
import { ExtractionQualityDashboard } from './ExtractionQualityDashboard';
import { RenewalAlertScanner } from './RenewalAlertScanner';

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
  const { providers, isLoading: providersLoading } = useProviders();
  const [terminologies, setTerminologies] = useState<TerminologyMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
      if (res.ok) {
        const data = await res.json();
        setTerminologies(data.terminologies || []);
      }
    } catch (err) {
      console.error('Failed to fetch terminologies:', err);
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
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Document AI Configuration</CardTitle>
              <CardDescription>
                Configure provider-specific terminology mappings to improve AI extraction accuracy.
                When a provider's benefit term is mapped, the AI will use the mapping instead of
                guessing.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Extraction Quality Dashboard */}
      <ExtractionQualityDashboard />

      {/* Renewal Alert Scanner */}
      <RenewalAlertScanner />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search providers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Provider List */}
      <div className="space-y-3">
        {filteredProviders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-sm">
              No providers found. Add providers in the Provider Management tab first.
            </p>
          </div>
        ) : (
          filteredProviders.map((provider) => {
            const existingMap = terminologies.find((t) => t.providerId === provider.id);
            const benefitCount = existingMap
              ? Object.keys(existingMap.benefitMappings || {}).length
              : 0;
            const productCount = existingMap
              ? Object.keys(existingMap.productMappings || {}).length
              : 0;
            const isExpanded = expandedProvider === provider.id;

            return (
              <Card key={provider.id} className={isExpanded ? 'border-purple-300' : ''}>
                {/* Provider Header */}
                <div
                  className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50/50"
                  onClick={() => handleExpandProvider(provider.id)}
                >
                  <div className="flex items-center gap-3">
                    {provider.logo ? (
                      <img
                        src={provider.logo}
                        alt={provider.name}
                        className="h-8 w-8 object-contain"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{provider.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {benefitCount > 0 && (
                          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px] px-1.5 py-0">
                            {benefitCount} benefit mapping{benefitCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {productCount > 0 && (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] px-1.5 py-0">
                            {productCount} product mapping{productCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {benefitCount === 0 && productCount === 0 && (
                          <span className="text-[10px] text-gray-400">No mappings configured</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <CardContent className="border-t pt-4 space-y-6">
                    {/* Benefit Mappings */}
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-purple-600" />
                        Benefit Term Mappings
                      </Label>
                      <p className="text-xs text-gray-500 mb-3">
                        Map provider-specific benefit names to canonical Navigate Wealth keys. These
                        override the AI's best guess during extraction.
                      </p>

                      {/* Existing benefit mappings */}
                      {Object.keys(editingBenefitMappings).length > 0 && (
                        <div className="space-y-2 mb-3">
                          {Object.entries(editingBenefitMappings).map(([term, key]) => {
                            const keyLabel =
                              CANONICAL_BENEFIT_KEYS.find((k) => k.value === key)?.label || key;
                            return (
                              <div
                                key={term}
                                className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
                              >
                                <span className="text-xs font-medium text-gray-700 flex-1 truncate">
                                  {term}
                                </span>
                                <ArrowRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-xs text-purple-700 font-medium flex-1 truncate">
                                  {keyLabel}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveBenefitMapping(term)}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add new benefit mapping */}
                      <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] text-gray-500">Provider Term</Label>
                          <Input
                            placeholder="e.g. Lifestyle Protector"
                            value={newBenefitRow.term}
                            onChange={(e) =>
                              setNewBenefitRow((prev) => ({ ...prev, term: e.target.value }))
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] text-gray-500">Canonical Key</Label>
                          <Select
                            value={newBenefitRow.canonicalKey}
                            onValueChange={(v) =>
                              setNewBenefitRow((prev) => ({ ...prev, canonicalKey: v }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {CANONICAL_BENEFIT_KEYS.map((k) => (
                                <SelectItem key={k.value} value={k.value} className="text-xs">
                                  {k.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={handleAddBenefitMapping}
                          size="sm"
                          variant="outline"
                          className="h-8"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Product Mappings */}
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        Product Name Mappings
                      </Label>
                      <p className="text-xs text-gray-500 mb-3">
                        Map provider product names to internal product categories.
                      </p>

                      {/* Existing product mappings */}
                      {Object.keys(editingProductMappings).length > 0 && (
                        <div className="space-y-2 mb-3">
                          {Object.entries(editingProductMappings).map(([term, catId]) => {
                            const catLabel =
                              PRODUCT_CATEGORIES.find((c) => c.value === catId)?.label || catId;
                            return (
                              <div
                                key={term}
                                className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
                              >
                                <span className="text-xs font-medium text-gray-700 flex-1 truncate">
                                  {term}
                                </span>
                                <ArrowRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-xs text-blue-700 font-medium flex-1 truncate">
                                  {catLabel}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveProductMapping(term)}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add new product mapping */}
                      <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] text-gray-500">Product Name</Label>
                          <Input
                            placeholder="e.g. Glacier Investment"
                            value={newProductRow.term}
                            onChange={(e) =>
                              setNewProductRow((prev) => ({ ...prev, term: e.target.value }))
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] text-gray-500">Category</Label>
                          <Select
                            value={newProductRow.canonicalKey}
                            onValueChange={(v) =>
                              setNewProductRow((prev) => ({ ...prev, canonicalKey: v }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {PRODUCT_CATEGORIES.map((c) => (
                                <SelectItem key={c.value} value={c.value} className="text-xs">
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={handleAddProductMapping}
                          size="sm"
                          variant="outline"
                          className="h-8"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      {existingMap?.updatedAt && (
                        <span className="text-[10px] text-gray-400">
                          Last updated:{' '}
                          {new Date(existingMap.updatedAt).toLocaleDateString('en-ZA')}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        {(benefitCount > 0 || productCount > 0) && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBulkReextractPreview(provider.id, provider.name);
                            }}
                            variant="outline"
                            size="sm"
                            disabled={isBulkExtracting}
                            className="text-amber-700 border-amber-300 hover:bg-amber-50"
                          >
                            {isBulkExtracting && bulkReextractProvider?.id === provider.id ? (
                              <div className="contents">
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                Scanning...
                              </div>
                            ) : (
                              <div className="contents">
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                Bulk Re-extract
                              </div>
                            )}
                          </Button>
                        )}
                        <Button
                          onClick={() => handleSave(provider.id, provider.name)}
                          disabled={isSaving}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          {isSaving ? (
                            <div className="contents">
                              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                              Saving...
                            </div>
                          ) : (
                            <div className="contents">
                              <Save className="h-4 w-4 mr-1.5" />
                              Save Mappings
                            </div>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
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
    </div>
  );
}
