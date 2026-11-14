/**
 * Sanctions Screening Panel
 *
 * Replaces the mock "Quick Sanctions Check" with a real integration:
 *   GET /search-sanctions-natural-persons
 *   GET /search-sanctions-natural-persons-by-source
 *
 * Auto-populates search fields from client data. Supports filtering by
 * sanctions list source (OFAC, UN, EU, etc.).
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../../../ui/button';
import { Label } from '../../../../../ui/label';
import { Input } from '../../../../../ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../../../../utils/api';
import { HoneycombActionCard } from './HoneycombActionCard';
import { PanelCard, StatusPill } from './ComplianceShared';

interface SanctionsScreeningPanelProps {
  clientId: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  passport: string | null;
  onCheckComplete?: () => void;
}

interface SanctionsResult {
  success: boolean;
  data?: {
    results?: SanctionsMatch[];
    totalMatches?: number;
    searchedLists?: string[];
    [key: string]: unknown;
  };
  error?: string;
}

interface SanctionsMatch {
  name?: string;
  source?: string;
  matchScore?: number;
  listingDate?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

interface SearchHistoryEntry {
  id: string;
  checkType: string;
  submittedAt: string;
  status: string;
  summary: string;
}

const SANCTIONS_SOURCES = [
  { value: '', label: 'All lists' },
  { value: 'OFAC', label: 'OFAC (US)' },
  { value: 'UN', label: 'UN Security Council' },
  { value: 'EU', label: 'European Union' },
  { value: 'UK', label: 'UK HMT' },
  { value: 'SARS', label: 'SARS (South Africa)' },
  { value: 'FIC', label: 'FIC (South Africa)' },
];

export function SanctionsScreeningPanel({
  clientId,
  firstName,
  lastName,
  idNumber,
  onCheckComplete,
}: SanctionsScreeningPanelProps) {
  // Search fields (pre-populated from client)
  const [searchName, setSearchName] = useState(firstName);
  const [searchSurname, setSearchSurname] = useState(lastName);
  const [searchIdNumber, setSearchIdNumber] = useState(idNumber || '');
  const [selectedSource, setSelectedSource] = useState('');

  // State
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SanctionsResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // History
  const [_history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [_showHistory, _setShowHistory] = useState(false);
  const [_isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await api.get<{ history?: SearchHistoryEntry[] }>(
        `/integrations/honeycomb/checks/history/${clientId}/sanctions_search`,
      );
      setHistory(data.history || []);
    } catch (err) {
      console.error('[Sanctions Panel] History load error:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [clientId]);

  // Update search fields when client changes
  useEffect(() => {
    setSearchName(firstName);
    setSearchSurname(lastName);
    setSearchIdNumber(idNumber || '');
    setResult(null);
    loadHistory();
  }, [clientId, firstName, lastName, idNumber, loadHistory]);

  const handleSearch = async () => {
    if (!searchName && !searchSurname && !searchIdNumber) {
      toast.error('Please provide at least a name, surname, or ID number to search.');
      return;
    }

    setIsSearching(true);
    setResult(null);
    const toastId = toast.loading('Searching sanctions lists...');

    try {
      const data = await api.post<{
        data?: SanctionsResult['data'];
        results?: SanctionsMatch[];
        totalMatches?: number;
      }>(`/integrations/honeycomb/sanctions/search`, {
        clientId,
        name: searchName,
        surname: searchSurname,
        identityNumber: searchIdNumber || undefined,
        uniqueId: clientId,
        source: selectedSource || undefined,
      });

      const sanctionsData = (data.data || data) as SanctionsResult['data'];
      const totalMatches = sanctionsData?.totalMatches ?? sanctionsData?.results?.length ?? 0;

      setResult({ success: true, data: sanctionsData });

      if (totalMatches === 0) {
        toast.success('No sanctions matches found — client is clear', { id: toastId });
      } else {
        toast.error(`${totalMatches} potential sanctions match(es) found`, { id: toastId });
      }

      loadHistory();
      onCheckComplete?.();
    } catch (err: unknown) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Network error' });
      toast.error(err instanceof Error ? err.message : 'Network error', { id: toastId });
    } finally {
      setIsSearching(false);
    }
  };

  const totalMatches = result?.data?.totalMatches ?? result?.data?.results?.length ?? 0;
  const isClear = result?.success && totalMatches === 0;
  const hasMatches = result?.success && totalMatches > 0;

  const listCount = result?.data?.searchedLists?.length || SANCTIONS_SOURCES.length - 1;
  const fieldId = (name: string) => `sanctions-${name}-${clientId}`;

  return (
    <div className="space-y-4">
      {/* Design CM-K-Screening: the search, the latest result, then the two other searches. */}
      <PanelCard title="Sanctions search">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={fieldId('name')} className="text-xs">
                First name
              </Label>
              <Input
                id={fieldId('name')}
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={fieldId('surname')} className="text-xs">
                Surname
              </Label>
              <Input
                id={fieldId('surname')}
                value={searchSurname}
                onChange={(e) => setSearchSurname(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={fieldId('id')} className="text-xs">
                Identity number
              </Label>
              <Input
                id={fieldId('id')}
                value={searchIdNumber}
                onChange={(e) => setSearchIdNumber(e.target.value)}
                placeholder="SA ID number (optional)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={fieldId('list')} className="text-xs">
                Sanctions list
              </Label>
              <select
                id={fieldId('list')}
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {SANCTIONS_SOURCES.map((src) => (
                  <option key={src.value} value={src.value}>
                    {src.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-nw-text-3">
            {SANCTIONS_SOURCES.map((src) => src.label).join(' · ')}
          </p>
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Search
          </Button>
        </div>
      </PanelCard>

      {result && (
        <PanelCard
          title="Latest result"
          aside={
            !result.success ? (
              <StatusPill tone="bad">Search failed</StatusPill>
            ) : isClear ? (
              <StatusPill tone="good">Clear</StatusPill>
            ) : (
              <StatusPill tone="bad">
                {totalMatches} potential match{totalMatches > 1 ? 'es' : ''}
              </StatusPill>
            )
          }
        >
          {!result.success ? (
            <p className="text-sm text-red-700">{result.error}</p>
          ) : (
            <div className="space-y-3">
              {hasMatches && (
                <p className="text-sm text-nw-text-2">
                  Review each match: decide whether it is the client or a false positive.
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-nw-bg text-left text-xs font-medium text-nw-text-3">
                      <th scope="col" className="px-3 py-2.5">
                        Name
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Source
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Match score
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Listed
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isClear || !result.data?.results?.length ? (
                      <tr className="border-t border-nw-line">
                        <td className="px-3 py-3 text-nw-ink">
                          No matches found across {listCount} lists
                        </td>
                        <td className="px-3 py-3 text-nw-text-3">—</td>
                        <td className="px-3 py-3 text-nw-text-3">—</td>
                        <td className="px-3 py-3 text-nw-text-3">—</td>
                      </tr>
                    ) : (
                      result.data.results.map((match, idx) => (
                        <tr key={idx} className="border-t border-nw-line">
                          <td className="px-3 py-3 font-medium text-nw-ink">
                            {match.name || 'Unknown'}
                          </td>
                          <td className="px-3 py-3 text-nw-text-2">{match.source || '—'}</td>
                          <td className="px-3 py-3 text-nw-text-2">
                            {match.matchScore != null
                              ? `${Math.round(match.matchScore * 100)}%`
                              : '—'}
                          </td>
                          <td className="px-3 py-3 text-nw-text-2">
                            {match.listingDate
                              ? new Date(match.listingDate).toLocaleDateString('en-ZA')
                              : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs font-medium text-nw-violet hover:underline"
              >
                {showDetails ? 'Hide' : 'Show'} raw response
              </button>
              {showDetails && (
                <pre className="max-h-48 overflow-auto rounded bg-gray-900 p-2 font-mono text-xs text-gray-100">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </PanelCard>
      )}

      {/* Phase 2: Enforcement Actions & Legal A Listing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HoneycombActionCard
          title="Enforcement Actions"
          description="Search regulatory enforcement actions (FSCA, NCR, SARB) for enforcement proceedings, fines, or debarments against this client."
          actionLabel="Search Enforcement Actions"
          endpoint="sanctions/enforcement-actions"
          requestBody={{
            clientId,
            name: firstName,
            surname: lastName,
            identityNumber: idNumber || undefined,
            uniqueId: clientId,
          }}
          onSuccess={onCheckComplete}
        />

        <HoneycombActionCard
          title="Legal A Listing"
          description="Search court judgments and legal proceedings (civil judgments, administration orders, sequestrations) for this client."
          actionLabel="Search Legal A Listings"
          endpoint="sanctions/legal-a-listing"
          requestBody={{
            clientId,
            name: firstName,
            surname: lastName,
            identityNumber: idNumber || undefined,
            uniqueId: clientId,
          }}
          onSuccess={onCheckComplete}
        />
      </div>
    </div>
  );
}
