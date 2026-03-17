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

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Label } from '../../../../../ui/label';
import { Input } from '../../../../../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../../ui/table';
import {
  Shield,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronUp,
  XCircle,
  History,
  Clock,
  Gavel,
  Scale,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../../../../../../utils/supabase/info';
import { getAuthToken } from './compliance-auth';
import { HoneycombActionCard } from './HoneycombActionCard';

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

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/honeycomb`;

const SANCTIONS_SOURCES = [
  { value: '', label: 'All Lists' },
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
  passport,
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
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Update search fields when client changes
  useEffect(() => {
    setSearchName(firstName);
    setSearchSurname(lastName);
    setSearchIdNumber(idNumber || '');
    setResult(null);
    loadHistory();
  }, [clientId, firstName, lastName, idNumber]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/checks/history/${clientId}/sanctions_search`, {
        headers: { Authorization: `Bearer ${await getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('[Sanctions Panel] History load error:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSearch = async () => {
    if (!searchName && !searchSurname && !searchIdNumber) {
      toast.error('Please provide at least a name, surname, or ID number to search.');
      return;
    }

    setIsSearching(true);
    setResult(null);
    const toastId = toast.loading('Searching sanctions lists...');

    try {
      const res = await fetch(`${API_BASE}/sanctions/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          name: searchName,
          surname: searchSurname,
          identityNumber: searchIdNumber || undefined,
          uniqueId: clientId,
          source: selectedSource || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error);
        setResult({ success: false, error: errMsg });
        toast.error(errMsg, { id: toastId });
        return;
      }

      const sanctionsData = data.data || data;
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

  return (
    <div className="space-y-4">
      {/* Main Search Card */}
      <Card className="bg-purple-50/50 border-purple-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-medium flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            Sanctions & PEP Screening
          </CardTitle>
          <CardDescription>
            Search international sanctions lists (OFAC, UN, EU, UK HMT) and South African
            regulatory lists (SARS, FIC) for potential matches against the client.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">First Name</Label>
              <Input
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="First name"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Surname</Label>
              <Input
                value={searchSurname}
                onChange={(e) => setSearchSurname(e.target.value)}
                placeholder="Surname"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Identity Number</Label>
              <Input
                value={searchIdNumber}
                onChange={(e) => setSearchIdNumber(e.target.value)}
                placeholder="SA ID number (optional)"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sanctions List</Label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {SANCTIONS_SOURCES.map((src) => (
                  <option key={src.value} value={src.value}>{src.label}</option>
                ))}
              </select>
            </div>
          </div>

          <Button
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Search Sanctions Lists
          </Button>

          {/* Result summary */}
          {result && (
            <div className={`rounded-lg p-3 text-sm ${
              result.success
                ? isClear
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {!result.success && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-red-800 font-medium">Search Failed</span>
                  <p className="text-red-700 text-xs mt-1">{result.error}</p>
                </div>
              )}

              {isClear && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <span className="text-green-800 font-medium">No Matches Found</span>
                    <p className="text-green-700 text-xs mt-0.5">
                      Client is clear across {result.data?.searchedLists?.join(', ') || 'all'} sanctions lists.
                    </p>
                  </div>
                </div>
              )}

              {hasMatches && (
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <span className="text-red-800 font-medium">
                      {totalMatches} Potential Match{totalMatches > 1 ? 'es' : ''} Found
                    </span>
                  </div>
                  <p className="text-red-700 text-xs mt-1 mb-3">
                    Review the matches below. These require manual assessment to determine
                    if they are true positive matches or false positives.
                  </p>

                  {/* Matches table */}
                  {result.data?.results && result.data.results.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Source</TableHead>
                          <TableHead className="text-xs">Match Score</TableHead>
                          <TableHead className="text-xs">Listed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.data.results.map((match, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-medium">
                              {match.name || 'Unknown'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {match.source || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {match.matchScore != null
                                ? `${Math.round(match.matchScore * 100)}%`
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {match.listingDate
                                ? new Date(match.listingDate).toLocaleDateString('en-ZA')
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}

              {/* Toggle raw response */}
              {result.success && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showDetails ? 'Hide' : 'Show'} raw response
                  </button>

                  {showDetails && (
                    <pre className="mt-2 p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-auto max-h-48 font-mono">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase 2: Enforcement Actions & Legal A Listing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HoneycombActionCard
          title="Enforcement Actions"
          description="Search regulatory enforcement actions (FSCA, NCR, SARB) for enforcement proceedings, fines, or debarments against this client."
          icon={<Gavel className="h-5 w-5 text-red-600" />}
          actionLabel="Search Enforcement Actions"
          endpoint="sanctions/enforcement-actions"
          requestBody={{
            clientId,
            name: firstName,
            surname: lastName,
            identityNumber: idNumber || undefined,
            uniqueId: clientId,
          }}
          variant="default"
          onSuccess={onCheckComplete}
        />

        <HoneycombActionCard
          title="Legal A Listing"
          description="Search court judgments and legal proceedings (civil judgments, administration orders, sequestrations) for this client."
          icon={<Scale className="h-5 w-5 text-amber-600" />}
          actionLabel="Search Legal A Listings"
          endpoint="sanctions/legal-a-listing"
          requestBody={{
            clientId,
            name: firstName,
            surname: lastName,
            identityNumber: idNumber || undefined,
            uniqueId: clientId,
          }}
          variant="amber"
          onSuccess={onCheckComplete}
        />
      </div>
    </div>
  );
}