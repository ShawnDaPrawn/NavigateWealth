/**
 * Newsletter Subscribers Management
 *
 * Admin panel for manually adding newsletter subscribers (individual + bulk Excel).
 * Assumes offline opt-in with records kept elsewhere (POPIA compliance).
 *
 * Guidelines:
 *   §7    — Presentation layer only (no business logic, no direct data access)
 *   §8.3  — Status colour vocabulary
 *   §8.4  — Platform constraints (sonner@2.0.3)
 *   §5.4  — KV key: newsletter:{email}
 *   §6    — Server state via React Query hooks
 */

import React, { useState, useRef } from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Skeleton } from '../../../../ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../../ui/tooltip';
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Trash2,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  Info,
  UserMinus,
  RotateCcw,
  Calendar,
  FileDown,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

// ── Module imports (types, constants, utils, hooks) ──────────────────
import type { SubscriberStatusFilter, UnsubTimeRange, Subscriber } from '../types';
import {
  SUBSCRIBER_STATUS_CONFIG,
  SUBSCRIBER_SOURCE_LABELS,
  UNSUB_TIME_RANGE_OPTIONS,
} from '../constants';
import {
  deriveSubscriberStatus,
  deriveUnsubscribeReason,
  formatDateZA,
  exportUnsubscribedToExcel,
  downloadSubscriberExcelTemplate,
  parseSubscriberFile,
} from '../utils';
import {
  useNewsletterSubscribers,
} from '../hooks/useNewsletterSubscribers';
import {
  useAddSubscriber,
  useBulkUpload,
  useRemoveSubscriber,
  useResubscribe,
} from '../hooks/useNewsletterMutations';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function NewsletterSubscribers() {
  // ── Server state (React Query) ───────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriberStatusFilter>('all');
  const [unsubTimeRange, setUnsubTimeRange] = useState<UnsubTimeRange>('all');

  const { subscribers, filtered, stats, isLoading, refetch } =
    useNewsletterSubscribers({ statusFilter, search, unsubTimeRange });

  const addMutation = useAddSubscriber();
  const bulkMutation = useBulkUpload();
  const removeMutation = useRemoveSubscriber();
  const resubscribeMutation = useResubscribe();

  // ── Local UI state ───────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addFirstName, setAddFirstName] = useState('');
  const [addSurname, setAddSurname] = useState('');
  const [addEmail, setAddEmail] = useState('');

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkParsed, setBulkParsed] = useState<{ email: string; firstName: string; surname: string }[]>([]);
  const [bulkResult, setBulkResult] = useState<{ added: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [resubscribeTarget, setResubscribeTarget] = useState<string | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleAddSingle = async () => {
    if (!addEmail.trim()) return;
    await addMutation.mutateAsync({
      email: addEmail.trim(),
      firstName: addFirstName.trim(),
      surname: addSurname.trim(),
    });
    setAddOpen(false);
    setAddEmail('');
    setAddFirstName('');
    setAddSurname('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);
    setBulkResult(null);
    parseSubscriberFile(file, (rows) => {
      if (rows.length === 0) {
        toast.error('No valid email addresses found. Ensure your file has an "Email" column.');
      }
      setBulkParsed(rows);
    });
  };

  const handleBulkUpload = async () => {
    if (bulkParsed.length === 0) return;
    const result = await bulkMutation.mutateAsync(bulkParsed);
    setBulkResult({ added: result.added, skipped: result.skipped, errors: result.errors || [] });
  };

  const resetBulk = () => {
    setBulkFile(null);
    setBulkParsed([]);
    setBulkResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    await removeMutation.mutateAsync(removeTarget);
    setRemoveTarget(null);
  };

  const handleResubscribe = async () => {
    if (!resubscribeTarget) return;
    await resubscribeMutation.mutateAsync(resubscribeTarget);
    setResubscribeTarget(null);
  };

  const handleExportUnsubscribed = () => {
    if (filtered.length === 0) {
      toast.error('No unsubscribed subscribers to export');
      return;
    }
    exportUnsubscribedToExcel(filtered, unsubTimeRange);
    toast.success(
      `Exported ${filtered.length} unsubscribed subscriber${filtered.length !== 1 ? 's' : ''}`,
    );
  };

  const handleDownloadTemplate = () => {
    downloadSubscriberExcelTemplate();
    toast.success('Template downloaded');
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Newsletter Subscribers</h3>
          <p className="text-sm text-muted-foreground">
            Manually add subscribers who have opted in offline. Records must be kept separately for POPIA compliance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Bulk Import
          </Button>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Add Subscriber
          </Button>
        </div>
      </div>

      {/* POPIA Notice */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-md bg-amber-100">
              <Info className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-900">Offline Opt-In Records</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Subscribers added here are assumed to have opted in offline. You are responsible for maintaining
                proof of consent (signed forms, recorded verbal agreement, etc.) in accordance with POPIA.
                These subscribers bypass double opt-in and are immediately active.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-10" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {([
            { key: 'total', label: 'Total', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
            { key: 'active', label: 'Active', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { key: 'pending', label: 'Pending', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { key: 'unsubscribed', label: 'Unsubscribed', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
          ] as const).map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.key}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${s.bg}`}>
                      <Icon className={`h-4 w-4 ${s.color}`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold leading-none">{stats[s.key]}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center border rounded-lg overflow-hidden">
          {(['all', 'active', 'pending', 'unsubscribed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === f
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
              }`}
            >
              {f}
              {f !== 'all' && (
                <span className="ml-1 text-[10px] opacity-60">
                  {stats[f as keyof typeof stats]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Unsubscribed Toolbar — time-range filter + export */}
      {statusFilter === 'unsubscribed' && !isLoading && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Time range:</span>
            <div className="flex items-center border rounded-lg overflow-hidden">
              {UNSUB_TIME_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setUnsubTimeRange(opt.value as UnsubTimeRange)}
                  className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    unsubTimeRange === opt.value
                      ? 'bg-red-100 text-red-700'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportUnsubscribed}
            disabled={filtered.length === 0}
          >
            <FileDown className="h-3.5 w-3.5 mr-1.5" />
            Export Unsubscribed
          </Button>
        </div>
      )}

      {/* Subscriber Table */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Mail className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-sm">
              {subscribers.length === 0 ? 'No subscribers yet' : 'No matching subscribers'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {subscribers.length === 0
                ? 'Add your first subscriber manually or import from a spreadsheet.'
                : 'Try adjusting your search or filter.'}
            </p>
            {subscribers.length === 0 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Bulk Import
                </Button>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setAddOpen(true)}>
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  Add Subscriber
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-2.5 px-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">First Name</th>
                  <th className="text-left py-2.5 px-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Surname</th>
                  <th className="text-left py-2.5 px-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="text-left py-2.5 px-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left py-2.5 px-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">
                    {statusFilter === 'unsubscribed' ? 'Reason' : 'Source'}
                  </th>
                  <th className="text-left py-2.5 px-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">
                    {statusFilter === 'unsubscribed' ? 'Unsubscribed' : 'Subscribed'}
                  </th>
                  <th className="text-right py-2.5 px-4 font-medium text-xs text-muted-foreground uppercase tracking-wider w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => (
                  <SubscriberRow
                    key={sub.email}
                    sub={sub}
                    statusFilter={statusFilter}
                    onRemove={setRemoveTarget}
                    onResubscribe={setResubscribeTarget}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-2.5 text-xs text-muted-foreground bg-muted/20">
            Showing {filtered.length} of {subscribers.length} subscribers
          </div>
        </Card>
      )}

      {/* ═══════ Add Single Subscriber Dialog ═══════ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-purple-500" />
              Add Newsletter Subscriber
            </DialogTitle>
            <DialogDescription>
              Add a subscriber who has provided offline opt-in consent. This bypasses double opt-in and immediately activates them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email Address <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="subscriber@example.com"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
              />
            </div>
            <div className="space-y-2">
              <Label>First Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={addFirstName}
                onChange={(e) => setAddFirstName(e.target.value)}
                placeholder="John"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
              />
            </div>
            <div className="space-y-2">
              <Label>Surname <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={addSurname}
                onChange={(e) => setAddSurname(e.target.value)}
                placeholder="Smith"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleAddSingle}
              disabled={!addEmail.trim().includes('@') || addMutation.isPending}
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1.5" />}
              Add Subscriber
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ Bulk Import Dialog ═══════ */}
      <Dialog open={bulkOpen} onOpenChange={(open) => { setBulkOpen(open); if (!open) resetBulk(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-purple-500" />
              Bulk Import Subscribers
            </DialogTitle>
            <DialogDescription>
              Upload an Excel spreadsheet with subscriber details. All imported subscribers are assumed to have opted in offline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Template download */}
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-dashed">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Download Template</p>
                  <p className="text-[11px] text-muted-foreground">Excel template with Email, First Name/s, and Surname columns</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Template
              </Button>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>Upload File</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center hover:border-purple-300 hover:bg-purple-50/30 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-purple-400', 'bg-purple-50/50'); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50/50'); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50/50');
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    setBulkFile(file);
                    setBulkResult(null);
                    parseSubscriberFile(file, (rows) => {
                      if (rows.length === 0) {
                        toast.error('No valid email addresses found. Ensure your file has an "Email" column.');
                      }
                      setBulkParsed(rows);
                    });
                  }
                }}
              >
                <Upload className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {bulkFile ? bulkFile.name : 'Drop an Excel file here or click to browse'}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Accepts .xlsx, .xls, and .csv files (max 500 rows)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Parsed preview */}
            {bulkParsed.length > 0 && !bulkResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Preview ({bulkParsed.length} subscribers found)</p>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={resetBulk}>
                    Clear
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">#</th>
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">First Name</th>
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">Surname</th>
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkParsed.slice(0, 10).map((row, i) => (
                        <tr key={row.email} className="border-b last:border-0">
                          <td className="py-1.5 px-3 text-muted-foreground">{i + 1}</td>
                          <td className="py-1.5 px-3 text-foreground">{row.firstName || <span className="text-muted-foreground/40">—</span>}</td>
                          <td className="py-1.5 px-3 text-foreground">{row.surname || <span className="text-muted-foreground/40">—</span>}</td>
                          <td className="py-1.5 px-3 font-mono">{row.email}</td>
                        </tr>
                      ))}
                      {bulkParsed.length > 10 && (
                        <tr>
                          <td colSpan={4} className="py-1.5 px-3 text-muted-foreground text-center">
                            ...and {bulkParsed.length - 10} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Upload results */}
            {bulkResult && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Import Results</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-bold text-green-800">{bulkResult.added}</p>
                      <p className="text-[10px] text-green-600">Added</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-lg">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">{bulkResult.skipped}</p>
                      <p className="text-[10px] text-amber-600">Skipped</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 bg-red-50 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <div>
                      <p className="text-sm font-bold text-red-800">{bulkResult.errors.length}</p>
                      <p className="text-[10px] text-red-600">Errors</p>
                    </div>
                  </div>
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-24 overflow-y-auto">
                    {bulkResult.errors.map((err, i) => (
                      <p key={i} className="text-[11px] text-red-700">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkOpen(false); resetBulk(); }}>
              {bulkResult ? 'Done' : 'Cancel'}
            </Button>
            {!bulkResult && (
              <Button
                className="bg-purple-600 hover:bg-purple-700"
                onClick={handleBulkUpload}
                disabled={bulkParsed.length === 0 || bulkMutation.isPending}
              >
                {bulkMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                Import {bulkParsed.length} Subscriber{bulkParsed.length !== 1 ? 's' : ''}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ Remove Confirmation Dialog ═══════ */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Remove Subscriber
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{removeTarget}</strong> from the newsletter? They will no longer receive future communications.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ Re-subscribe Confirmation Dialog ═══════ */}
      <Dialog open={!!resubscribeTarget} onOpenChange={(open) => { if (!open) setResubscribeTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Re-subscribe Subscriber
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to re-subscribe <strong>{resubscribeTarget}</strong> to the newsletter? They will receive future communications.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResubscribeTarget(null)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleResubscribe}
              disabled={resubscribeMutation.isPending}
            >
              {resubscribeMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
              Re-subscribe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// SUBSCRIBER TABLE ROW (extracted for clarity)
// ============================================================================

interface SubscriberRowProps {
  sub: Subscriber;
  statusFilter: SubscriberStatusFilter;
  onRemove: (email: string) => void;
  onResubscribe: (email: string) => void;
}

function SubscriberRow({ sub, statusFilter, onRemove, onResubscribe }: SubscriberRowProps) {
  const status = deriveSubscriberStatus(sub);
  const cfg = SUBSCRIBER_STATUS_CONFIG[status];
  const isUnsub = status === 'unsubscribed';

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors">
      <td className="py-2.5 px-4 text-foreground">
        {sub.firstName || <span className="text-muted-foreground/40">—</span>}
      </td>
      <td className="py-2.5 px-4 text-foreground">
        {sub.surname || <span className="text-muted-foreground/40">—</span>}
      </td>
      <td className="py-2.5 px-4">
        <span className="font-medium text-foreground">{sub.email}</span>
      </td>
      <td className="py-2.5 px-4">
        <Badge className={`text-[10px] ${cfg.badgeClass}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${cfg.dotClass}`} />
          {cfg.label}
        </Badge>
      </td>
      <td className="py-2.5 px-4 text-xs text-muted-foreground">
        {isUnsub ? (
          <span className="flex items-center gap-1">
            {sub.removedBy === 'admin' ? (
              <span className="inline-flex items-center gap-1 text-purple-600">
                <UserMinus className="h-3 w-3" />
                Admin Removed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-red-500">
                <UserMinus className="h-3 w-3" />
                Self-Unsubscribed
              </span>
            )}
          </span>
        ) : (
          SUBSCRIBER_SOURCE_LABELS[sub.source] || sub.source
        )}
      </td>
      <td className="py-2.5 px-4 text-xs text-muted-foreground">
        {isUnsub ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default">{formatDateZA(sub.unsubscribedAt)}</span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs space-y-0.5">
                <p>Subscribed: {formatDateZA(sub.subscribedAt)}</p>
                <p>Unsubscribed: {formatDateZA(sub.unsubscribedAt)}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          formatDateZA(sub.subscribedAt)
        )}
      </td>
      <td className="py-2.5 px-4 text-right">
        {status === 'active' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                onClick={() => onRemove(sub.email)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove subscriber</TooltipContent>
          </Tooltip>
        )}
        {isUnsub && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-green-500 hover:text-green-700 hover:bg-green-50"
                onClick={() => onResubscribe(sub.email)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Re-subscribe</TooltipContent>
          </Tooltip>
        )}
      </td>
    </tr>
  );
}
