import React, { useState, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../../../ui/table';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Checkbox } from '../../../../ui/checkbox';
import { 
  Search, 
  Filter, 
  Eye, 
  MoreHorizontal, 
  FileText,
  Ban,
  Trash2,
  Calendar as CalendarIcon,
  X,
  RefreshCw,
  PenTool,
  Loader2,
  Send,
  CheckCircle2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../ui/popover';
import { Calendar } from '../../../../ui/calendar';
import { useEnvelopes } from '../hooks/useEnvelopes';
import { useEnvelopeActions } from '../hooks/useEnvelopeActions';
import { StatusBadge } from './StatusBadge';
import { EsignEnvelope } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { cn } from '../../../../ui/utils';
import { DateRange } from 'react-day-picker';
import { VoidEnvelopeDialog } from './VoidEnvelopeDialog';
import { DiscardEnvelopeDialog } from './DiscardEnvelopeDialog';
import { BulkRemindDialog, BulkVoidDialog } from './BulkActionDialogs';
import { toast } from 'sonner@2.0.3';

interface EnvelopesListProps {
  onViewEnvelope: (envelope: EsignEnvelope) => void;
  onCreateNew: () => void;
  onResumePrepare?: (envelope: EsignEnvelope) => void;
  resumingEnvelopeId?: string | null;
  refreshTrigger?: number;
}

/** Statuses eligible for bulk actions */
const REMINDABLE_STATUSES = ['sent', 'viewed', 'partially_signed'];
const VOIDABLE_STATUSES = ['sent', 'viewed', 'partially_signed'];

export function EnvelopesList({ onViewEnvelope, onCreateNew, onResumePrepare, resumingEnvelopeId, refreshTrigger }: EnvelopesListProps) {
  const { envelopes, loading, error, refetch } = useEnvelopes({ autoLoad: true, refreshTrigger });
  const { voidEnvelope, voiding, deleteEnvelope, deleting } = useEnvelopeActions();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // ==================== SELECTION STATE ====================
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Void Dialog State
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [selectedForVoid, setSelectedForVoid] = useState<EsignEnvelope | null>(null);

  // Bulk Dialogs
  const [bulkRemindOpen, setBulkRemindOpen] = useState(false);
  const [bulkVoidOpen, setBulkVoidOpen] = useState(false);

  const handleVoidClick = (envelope: EsignEnvelope) => {
    setSelectedForVoid(envelope);
    setVoidDialogOpen(true);
  };

  const handleVoidConfirm = async (reason: string) => {
    if (selectedForVoid) {
      const success = await voidEnvelope(selectedForVoid.id, reason);
      if (success) {
        toast.success('Envelope voided successfully');
        refetch();
      } else {
        toast.error('Failed to void envelope');
      }
    }
  };

  // Discard Dialog State
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [selectedForDiscard, setSelectedForDiscard] = useState<EsignEnvelope | null>(null);

  function isDiscardable(env: EsignEnvelope): boolean {
    const discardableStatuses = ['draft', 'sent', 'viewed'];
    if (!discardableStatuses.includes(env.status)) return false;
    return !env.signedCount || env.signedCount === 0;
  }

  const handleDiscardClick = (envelope: EsignEnvelope) => {
    setSelectedForDiscard(envelope);
    setDiscardDialogOpen(true);
  };

  const handleDiscardConfirm = async () => {
    if (!selectedForDiscard) return;
    const success = await deleteEnvelope(selectedForDiscard.id);
    if (success) {
      toast.success('Envelope discarded');
      setDiscardDialogOpen(false);
      setSelectedForDiscard(null);
      refetch();
    } else {
      toast.error('Failed to discard envelope');
    }
  };

  // ==================== FILTERING ====================
  const filteredEnvelopes = useMemo(() => envelopes.filter(envelope => {
    const matchesSearch = 
      envelope.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      envelope.recipients?.some(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.email.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || envelope.status === statusFilter;

    let matchesDate = true;
    if (dateRange?.from) {
      const envelopeDate = new Date(envelope.updated_at || envelope.updatedAt || envelope.created_at || envelope.createdAt);
      const start = startOfDay(dateRange.from);
      const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      matchesDate = isWithinInterval(envelopeDate, { start, end });
    }

    return matchesSearch && matchesStatus && matchesDate;
  }), [envelopes, searchQuery, statusFilter, dateRange]);

  // ==================== SELECTION HELPERS ====================
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEnvelopes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEnvelopes.map(e => e.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());
  const hasSelection = selectedIds.size > 0;

  const selectedEnvelopes = filteredEnvelopes.filter(e => selectedIds.has(e.id));
  const remindableIds = selectedEnvelopes.filter(e => REMINDABLE_STATUSES.includes(e.status)).map(e => e.id);
  const voidableIds = selectedEnvelopes.filter(e => VOIDABLE_STATUSES.includes(e.status)).map(e => e.id);
  const canBulkRemind = remindableIds.length > 0;
  const canBulkVoid = voidableIds.length > 0;

  const handleBulkComplete = () => {
    clearSelection();
    refetch();
  };

  // ==================== LOADING & ERROR ====================
  if (loading && envelopes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <RefreshCw className="h-8 w-8 animate-spin mb-4" />
        <p>Loading envelopes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-red-500">
        <p>Error loading envelopes: {error}</p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ==================== BULK ACTION BAR ==================== */}
      {hasSelection && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size} envelope{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="text-blue-600 hover:text-blue-800 h-7 px-2">
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {canBulkRemind && (
              <Button size="sm" variant="outline" onClick={() => setBulkRemindOpen(true)} className="h-8 gap-1.5">
                <Send className="h-3.5 w-3.5" />
                Send Reminders ({remindableIds.length})
              </Button>
            )}
            {canBulkVoid && (
              <Button size="sm" variant="destructive" onClick={() => setBulkVoidOpen(true)} className="h-8 gap-1.5">
                <Ban className="h-3.5 w-3.5" />
                Void Selected ({voidableIds.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ==================== FILTERS ==================== */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search envelopes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  {statusFilter === 'all' ? 'Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>All Statuses</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatusFilter('draft')}>Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('sent')}>Sent</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('viewed')}>Viewed</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('partially_signed')}>Partially Signed</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('completed')}>Completed</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('expired')}>Expired</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('voided')}>Voided</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-[260px] justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <div className="contents">
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </div>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              {dateRange && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setDateRange(undefined)}
                  title="Clear date filter"
                  aria-label="Clear date filter"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => refetch()} 
              size="icon" 
              title="Refresh"
              aria-label="Refresh envelopes"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ==================== TABLE ==================== */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={filteredEnvelopes.length > 0 && selectedIds.size === filteredEnvelopes.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all envelopes"
                />
              </TableHead>
              <TableHead>Envelope</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEnvelopes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="h-8 w-8 mb-2 opacity-20" />
                    <p>No envelopes found</p>
                    {envelopes.length === 0 && (
                      <Button variant="link" onClick={onCreateNew} className="mt-2">
                        Create your first envelope
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredEnvelopes.map((envelope) => (
                <TableRow key={envelope.id} className={selectedIds.has(envelope.id) ? 'bg-blue-50/50' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(envelope.id)}
                      onCheckedChange={() => toggleSelect(envelope.id)}
                      aria-label={`Select envelope ${envelope.title}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-[250px] sm:max-w-[300px]">
                    <div className="flex flex-col">
                      <span className="font-medium truncate" title={envelope.title}>{envelope.title}</span>
                      <span className="text-xs text-muted-foreground">ID: {envelope.id.slice(0, 8)}...</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={envelope.status} type="envelope" showIcon size="sm" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {envelope.recipients?.slice(0, 2).map((r: { id: string; name: string; status?: string }) => (
                        <div key={r.id} className="text-sm flex items-center gap-1">
                           <span className={r.status === 'signed' ? 'text-green-600 font-medium' : ''}>
                             {r.name}
                           </span>
                           {r.status === 'signed' && (
                             <CheckCircle2 className="h-3 w-3 text-green-500" />
                           )}
                        </div>
                      ))}
                      {(envelope.recipients?.length || 0) > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{envelope.recipients!.length - 2} more
                        </span>
                      )}
                      {envelope.signedCount != null && envelope.totalSigners > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {envelope.signedCount}/{envelope.totalSigners} signed
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(envelope.updated_at || envelope.updatedAt || envelope.created_at || envelope.createdAt), 'MMM d, yyyy HH:mm')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onViewEnvelope(envelope)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {envelope.status === 'draft' && onResumePrepare && (
                          <DropdownMenuItem 
                            onClick={() => onResumePrepare(envelope)}
                            disabled={resumingEnvelopeId === envelope.id}
                          >
                            {resumingEnvelopeId === envelope.id ? (
                              <div className="contents">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading...
                              </div>
                            ) : (
                              <div className="contents">
                                <PenTool className="mr-2 h-4 w-4" />
                                Continue Editing
                              </div>
                            )}
                          </DropdownMenuItem>
                        )}
                        {envelope.status === 'completed' && (
                          <DropdownMenuItem onClick={() => onViewEnvelope(envelope)}>
                            <FileText className="mr-2 h-4 w-4" />
                            View Signed Package
                          </DropdownMenuItem>
                        )}
                        {['sent', 'viewed', 'partially_signed'].includes(envelope.status) && (
                          <DropdownMenuItem 
                            onClick={() => handleVoidClick(envelope)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Void Envelope
                          </DropdownMenuItem>
                        )}
                        {isDiscardable(envelope) && (
                          <DropdownMenuItem 
                            onClick={() => handleDiscardClick(envelope)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Discard Envelope
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="text-xs text-muted-foreground text-center">
        Showing {filteredEnvelopes.length} of {envelopes.length} envelopes
        {hasSelection && ` \u00b7 ${selectedIds.size} selected`}
      </div>

      {/* ==================== DIALOGS ==================== */}
      <VoidEnvelopeDialog 
        open={voidDialogOpen} 
        onOpenChange={setVoidDialogOpen}
        onConfirm={handleVoidConfirm}
        loading={voiding}
        title={selectedForVoid?.title}
      />

      <DiscardEnvelopeDialog 
        open={discardDialogOpen} 
        onOpenChange={setDiscardDialogOpen}
        onConfirm={handleDiscardConfirm}
        loading={deleting}
        title={selectedForDiscard?.title}
        envelopeStatus={selectedForDiscard?.status || 'draft'}
      />

      <BulkRemindDialog
        open={bulkRemindOpen}
        onOpenChange={setBulkRemindOpen}
        envelopeIds={remindableIds}
        onComplete={handleBulkComplete}
      />

      <BulkVoidDialog
        open={bulkVoidOpen}
        onOpenChange={setBulkVoidOpen}
        envelopeIds={voidableIds}
        onComplete={handleBulkComplete}
      />
    </div>
  );
}
