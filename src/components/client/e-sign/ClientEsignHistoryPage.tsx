/**
 * Client portal — E‑signature envelope history (read-only).
 */

import React, { useMemo, useState } from 'react';
import { AlertCircle, FileText, Loader2, PenLine, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { PortalPageHeader } from '../../portal/PortalPageHeader';
import { ACTIVE_THEME } from '../../portal/portal-theme';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';

import { useClientEnvelopes } from '../../admin/modules/esign/hooks/useEnvelopesQuery';
import { esignApi } from '../../admin/modules/esign/api';
import { EnvelopeManagementTableRow } from '../../admin/modules/esign/components/EnvelopeManagementTableRow';
import { EnvelopeDetailsDialog } from '../../admin/modules/esign/components/EnvelopeDetailsDialog';
import type { EsignEnvelope, EnvelopeStatus } from '../../admin/modules/esign/types';

/** Same grouping as Client Management E‑Sign tab ([EsignTab.tsx](client-management/components/EsignTab.tsx)) */
type StatusFilter = 'all' | 'draft' | 'pending' | 'completed' | 'rejected' | 'expired' | 'voided';

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'voided', label: 'Voided' },
];

const STATUS_FILTER_MAP: Record<StatusFilter, EnvelopeStatus[] | null> = {
  all: null,
  draft: ['draft'],
  pending: ['sent', 'viewed', 'partially_signed'],
  completed: ['completed'],
  rejected: ['rejected', 'declined'],
  expired: ['expired'],
  voided: ['voided'],
};

export function ClientEsignHistoryPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedEnvelope, setSelectedEnvelope] = useState<EsignEnvelope | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const cid = user?.id ?? '';
  const loadEnvelopes = Boolean(user?.id);
  const { data: envelopes = [], isLoading: loading, error: envelopeQueryErr, refetch } = useClientEnvelopes(
    cid,
    loadEnvelopes,
    user?.email || undefined,
  );
  const error = envelopeQueryErr?.message ?? null;

  const filteredEnvelopes = useMemo(() => {
    let result = envelopes;
    const allowed = STATUS_FILTER_MAP[statusFilter];
    if (allowed) {
      result = result.filter((e) => allowed.includes(e.status as EnvelopeStatus));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((e) => e.title.toLowerCase().includes(q));
    }
    return result;
  }, [envelopes, statusFilter, searchQuery]);

  const isFiltered = statusFilter !== 'all' || searchQuery.trim().length > 0;

  const handleDownload = async (envelope: EsignEnvelope) => {
    await esignApi.downloadDocument(envelope.id, envelope.title || 'document.pdf');
  };

  const handleDialogDownload = (envelopeId: string) => {
    const env = envelopes.find((e) => e.id === envelopeId);
    void esignApi.downloadDocument(envelopeId, env?.title || 'document.pdf');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  if (!user?.id) {
    return (
      <div className={`min-h-screen ${ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'}`}>
        <PortalPageHeader
          title="E‑Signatures"
          subtitle="Documents sent to you for electronic signature"
          icon={PenLine}
          compact
        />
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-12 text-center text-muted-foreground text-sm">
          Sign in to view your envelopes.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'}`}>
        <PortalPageHeader
          title="E‑Signatures"
          subtitle="Documents sent to you for electronic signature"
          icon={PenLine}
          compact
        />
        <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading your envelopes…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'}`}>
        <PortalPageHeader
          title="E‑Signatures"
          subtitle="Documents sent to you for electronic signature"
          icon={PenLine}
          compact
        />
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="pt-10 pb-10 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
              <h3 className="font-semibold">Could not load envelopes</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const stats = {
    total: envelopes.length,
    pending: envelopes.filter((e) => ['sent', 'viewed', 'partially_signed'].includes(e.status)).length,
    completed: envelopes.filter((e) => e.status === 'completed').length,
  };

  return (
    <div className={`min-h-screen ${ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'}`}>
      <PortalPageHeader
        title="E‑Signatures"
        subtitle="Documents your adviser sends for electronic signature appear here."
        icon={PenLine}
        compact
      />

      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
        {/* Summary — align with branded portal density */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none">{stats.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50">
                  <PenLine className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <FileText className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground mt-1">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">Showing filtered results from your signer history.</p>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => refetch()}
            className="text-gray-500 hover:text-gray-900"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="sr-only md:not-sr-only md:ml-2">Refresh</span>
          </Button>
        </div>

        {envelopes.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-xs min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  Clear
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isFiltered && (
              <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}

        {envelopes.length === 0 ? (
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="py-14 text-center max-w-lg mx-auto">
              <PenLine className="h-14 w-14 text-purple-600/40 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900">Nothing to sign yet</h2>
              <p className="text-sm text-muted-foreground mt-2">
                When your adviser sends PDFs for electronic signature, they will appear in this list. You’ll also receive
                email links when it’s your turn to sign.
              </p>
            </CardContent>
          </Card>
        ) : filteredEnvelopes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-sm">No envelopes match your filters</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 whitespace-nowrap">Document</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Signers</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnvelopes.map((envelope) => (
                    <EnvelopeManagementTableRow
                      key={envelope.id}
                      envelope={envelope}
                      portalReadOnly
                      onRowClick={() => {
                        setSelectedEnvelope(envelope);
                        setDetailsDialogOpen(true);
                      }}
                      onView={() => {
                        setSelectedEnvelope(envelope);
                        setDetailsDialogOpen(true);
                      }}
                      onDownload={() => handleDownload(envelope)}
                      onDelete={() => {}}
                      onRecall={() => {}}
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <EnvelopeDetailsDialog
          open={detailsDialogOpen}
          readOnly
          onOpenChange={setDetailsDialogOpen}
          envelope={selectedEnvelope}
          onDownloadDocument={handleDialogDownload}
        />
      </div>
    </div>
  );
}

export default ClientEsignHistoryPage;
