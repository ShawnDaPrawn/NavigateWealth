/**
 * E-Signature Tab (Unified)
 *
 * Uses the SAME wizard flow as the standalone E-Sign module:
 *   Upload -> Recipients -> Prepare Fields -> Send
 *
 * Key differences from standalone:
 *   - Pre-populates the client profile as the first signer (removable)
 *   - Queries envelopes by BOTH client_id AND signer email for consolidated history
 *   - Scoped to a single client's envelope list
 *
 * No forced signer restrictions -- the client is a convenient default, not a mandate.
 *
 * Guidelines:
 *   SS4.1  -- Module structure
 *   SS7    -- Presentation layer (no business logic in UI)
 *   SS8.3  -- Status colour vocabulary, stat card standards
 *   SS8.4  -- Platform-specific constraints (sonner version, contents wrapper)
 *   SS19.1 -- Query keys via centralised registry
 */

import React, { useState, useMemo, Suspense } from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../../ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Textarea } from '../../../../ui/textarea';
import { Label } from '../../../../ui/label';
import { Skeleton } from '../../../../ui/skeleton';
import {
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  AlertCircle,
  Users,
  Trash2,
  Undo2,
  Loader2,
  Pencil,
  Search,
  X,
  Award,
  ArrowLeft,
  ArrowRight,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { logger } from '../../../../../utils/logger';

// ==================== SHARED E-SIGN MODULE IMPORTS ====================
// Direct imports -- avoid barrel (esign/index.tsx) to prevent circular dependency
// with the full standalone page component.

import { useEnvelopes } from '../../esign/hooks/useEnvelopesQuery';
import { esignApi } from '../../esign/api';
import { useEnvelopeActions } from '../../esign/hooks/useEnvelopeActions';
import { EmptyState } from '../../esign/components/EmptyState';
import { EnvelopeDetailsDialog } from '../../esign/components/EnvelopeDetailsDialog';
import {
  formatEnvelopeDate,
  getDaysUntilExpiry,
  isExpiringSoon,
  getEnvelopeStatusColor,
  getEnvelopeStatusLabel,
} from '../../esign/types';
import { calculateSigningProgress } from '../../esign/utils/esignHelpers';

import type { Client } from '../types';
import type { EsignEnvelope, EnvelopeStatus, EsignField, SignerFormData } from '../../esign/types';

// Lazy-load heavy wizard components (same as standalone module)
const DocumentUploadStep = React.lazy(() =>
  import('../../esign/components/DocumentUploadStep').then(m => ({ default: m.DocumentUploadStep }))
);
const RecipientsManager = React.lazy(() =>
  import('../../esign/components/RecipientsManager').then(m => ({ default: m.RecipientsManager }))
);
const PrepareFormStudio = React.lazy(() =>
  import('../../esign/components/PrepareFormStudio').then(m => ({ default: m.PrepareFormStudio }))
);

function StepFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
    </div>
  );
}

// ==================== TYPES ====================

interface EsignTabProps {
  selectedClient: Client;
}

/** View modes -- 'list' is the envelope table, others are wizard steps */
type ViewMode = 'list' | 'wizard-upload' | 'wizard-recipients' | 'prepare';

/** Logical status groups for the filter dropdown */
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

/** Maps each logical filter group to the raw EnvelopeStatus values it covers */
const STATUS_FILTER_MAP: Record<StatusFilter, EnvelopeStatus[] | null> = {
  all: null,
  draft: ['draft'],
  pending: ['sent', 'viewed', 'partially_signed'],
  completed: ['completed'],
  rejected: ['rejected', 'declined'],
  expired: ['expired'],
  voided: ['voided'],
};

// ==================== STAT CARD CONFIG (SS8.3) ====================

const STAT_CONFIG = {
  total: { label: 'Total', icon: FileText, iconColor: 'text-blue-600', bgColor: 'bg-blue-50' },
  pending: { label: 'Pending', icon: Clock, iconColor: 'text-amber-600', bgColor: 'bg-amber-50' },
  completed: { label: 'Completed', icon: CheckCircle2, iconColor: 'text-green-600', bgColor: 'bg-green-50' },
  rejected: { label: 'Rejected', icon: XCircle, iconColor: 'text-red-600', bgColor: 'bg-red-50' },
} as const;

// ==================== MAIN COMPONENT ====================

export function EsignTab({ selectedClient }: EsignTabProps) {
  // Data fetching -- passes client email for consolidated cross-origin history
  const { envelopes, loading, error, refetch } = useEnvelopes({
    clientId: selectedClient.id,
    clientEmail: selectedClient.email,
    autoLoad: true,
  });

  const {
    uploadDocument,
    sendInvites,
    deleteEnvelope,
    voidEnvelope,
    downloadDocument,
    saveFields,
    uploading,
    sending,
    savingFields,
    deleting,
  } = useEnvelopeActions();

  // ==================== VIEW STATE ====================

  const [view, setView] = useState<ViewMode>('list');

  // Wizard state (mirrors standalone module)
  const [wizardData, setWizardData] = useState<{
    files: File[];
    title: string;
    message: string;
    expiryDays: number;
    signers: SignerFormData[];
  }>({
    files: [],
    title: '',
    message: '',
    expiryDays: 30,
    signers: [],
  });

  // Prepare state
  const [activeEnvelope, setActiveEnvelope] = useState<EsignEnvelope | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);

  // List view state
  const [selectedEnvelope, setSelectedEnvelope] = useState<EsignEnvelope | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recallDialogOpen, setRecallDialogOpen] = useState(false);
  const [envelopeToDelete, setEnvelopeToDelete] = useState<EsignEnvelope | null>(null);
  const [envelopeToRecall, setEnvelopeToRecall] = useState<EsignEnvelope | null>(null);
  const [recallReason, setRecallReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [resumingEnvelopeId, setResumingEnvelopeId] = useState<string | null>(null);

  // ==================== CLIENT CONTEXT ====================
  // Passed to RecipientsManager so the profile's client is auto-added as
  // the first signer (but fully removable -- no forced restriction).
  const clientContext = useMemo(() => ({
    id: selectedClient.id,
    firstName: selectedClient.firstName,
    lastName: selectedClient.lastName,
    email: selectedClient.email,
  }), [selectedClient.id, selectedClient.firstName, selectedClient.lastName, selectedClient.email]);

  // ==================== DERIVED STATS ====================

  const stats = {
    total: envelopes.length,
    pending: envelopes.filter(e => ['sent', 'viewed', 'partially_signed'].includes(e.status)).length,
    completed: envelopes.filter(e => e.status === 'completed').length,
    rejected: envelopes.filter(e => ['rejected', 'declined'].includes(e.status)).length,
  };

  const filteredEnvelopes = useMemo(() => {
    let result = envelopes;
    const allowedStatuses = STATUS_FILTER_MAP[statusFilter];
    if (allowedStatuses) {
      result = result.filter(e => allowedStatuses.includes(e.status));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(e => e.title.toLowerCase().includes(q));
    }
    return result;
  }, [envelopes, statusFilter, searchQuery]);

  const isFiltered = statusFilter !== 'all' || searchQuery.trim().length > 0;

  // ==================== WIZARD HANDLERS ====================

  const handleStartNew = () => {
    setWizardData({ files: [], title: '', message: '', expiryDays: 30, signers: [] });
    setView('wizard-upload');
  };

  const handleUploadNext = (files: File[], title: string, message: string, expiryDays: number) => {
    setWizardData(prev => ({ ...prev, files, title, message, expiryDays }));
    setView('wizard-recipients');
  };

  const handleRecipientsNext = async () => {
    if (wizardData.signers.length === 0) {
      toast.error('Please add at least one recipient.');
      return;
    }
    if (!wizardData.files || wizardData.files.length === 0) {
      toast.error('No documents found. Please go back and upload a document.');
      return;
    }

    try {
      const primarySystemSigner = wizardData.signers.find(s => s.isSystemClient && s.clientId);
      const clientId = primarySystemSigner?.clientId || selectedClient.id;

      const result = await uploadDocument({
        files: wizardData.files,
        context: {
          clientId,
          title: wizardData.title,
          message: wizardData.message,
          expiresAt: new Date(Date.now() + wizardData.expiryDays * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      if (!result || !result.id) {
        throw new Error('Failed to create envelope');
      }

      setActiveEnvelope(result);

      const url = result.document?.url || result.documentUrl;
      if (url) setDocumentUrl(url);

      // Persist draft signers
      try {
        await esignApi.saveDraftSigners(result.id, wizardData.signers.map((s, idx) => ({
          name: s.name,
          email: s.email,
          role: s.role || 'Signer',
          order: s.order ?? idx + 1,
          otpRequired: s.otpRequired,
          accessCode: s.accessCode,
          clientId: s.clientId,
          isSystemClient: s.isSystemClient,
        })));
      } catch (draftErr) {
        logger.warn('Failed to persist draft signers (non-critical):', draftErr);
      }

      toast.success('Document uploaded! Now prepare the form fields.');
      setView('prepare');
    } catch (err: unknown) {
      logger.error('Failed to create envelope:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload document');
    }
  };

  const handleSaveFields = async (fields: EsignField[]) => {
    if (!activeEnvelope) return;
    try {
      await saveFields(activeEnvelope.id, fields);
      setActiveEnvelope({ ...activeEnvelope, fields });
      toast.success('Fields saved successfully');
    } catch (err) {
      logger.error(err);
      toast.error('Failed to save fields');
    }
  };

  const handleSend = async (currentFields?: EsignField[]) => {
    if (!activeEnvelope) return;
    const fieldsToUse = currentFields || activeEnvelope.fields || [];
    try {
      const fieldsForInvite = fieldsToUse.map(f => {
        const signerIndex = wizardData.signers.findIndex(s => s.email === f.signer_id);
        return { ...f, signerIndex: signerIndex >= 0 ? signerIndex : 0 };
      });

      await sendInvites(activeEnvelope.id, {
        signers: wizardData.signers.map(s => ({
          name: s.name,
          email: s.email,
          role: s.role,
          order: s.order,
          otpRequired: s.otpRequired,
          accessCode: s.accessCode,
          clientId: s.clientId,
        })),
        fields: fieldsForInvite,
        message: wizardData.message,
        expiryDays: wizardData.expiryDays,
      });

      toast.success('Document sent for signature!');
      setView('list');
      refetch();
    } catch (err: unknown) {
      logger.error('Failed to send:', err);
      toast.error('Failed to send envelope');
    }
  };

  // ==================== RESUME DRAFT (Continue Editing) ====================

  const handleResumePrepare = async (envelope: EsignEnvelope) => {
    if (resumingEnvelopeId) return;
    setResumingEnvelopeId(envelope.id);
    try {
      const fullEnvelope = await esignApi.getEnvelope(envelope.id);
      if (!fullEnvelope || !fullEnvelope.id) throw new Error('Envelope not found');

      let docUrl: string | null = null;
      try {
        const urlResponse = await esignApi.getDocumentUrl(fullEnvelope.id);
        docUrl = urlResponse?.url || null;
      } catch {
        docUrl = fullEnvelope.document?.url || fullEnvelope.documentUrl || null;
      }
      if (!docUrl) {
        toast.error('Could not load the document. The file may have expired.');
        return;
      }

      // Reconstruct signers from draft_signers or real signers
      let signers: SignerFormData[] = [];
      const realSigners = fullEnvelope.signers || [];
      const draftSigners = fullEnvelope.draft_signers || [];

      if (realSigners.length > 0) {
        signers = realSigners.map((s: Record<string, unknown>) => ({
          name: s.name as string,
          email: s.email as string,
          role: (s.role as string) || 'Signer',
          order: s.order as number | undefined,
          otpRequired: (s.otp_required ?? s.requires_otp ?? false) as boolean,
          accessCode: (s.access_code as string) || undefined,
          clientId: (s.client_id as string) || undefined,
          isSystemClient: !!(s.client_id),
        }));
      } else if (draftSigners.length > 0) {
        signers = draftSigners.map((s: Record<string, unknown>) => ({
          name: s.name as string,
          email: s.email as string,
          role: (s.role as string) || 'Signer',
          order: s.order as number | undefined,
          otpRequired: (s.otpRequired ?? false) as boolean,
          accessCode: (s.accessCode as string) || undefined,
          clientId: (s.clientId as string) || undefined,
          isSystemClient: (s.isSystemClient ?? !!(s.clientId)) as boolean,
        }));
      }

      setWizardData(prev => ({
        ...prev,
        title: fullEnvelope.title,
        message: fullEnvelope.message || '',
        signers,
      }));
      setActiveEnvelope(fullEnvelope);
      setDocumentUrl(docUrl);
      setDetailsDialogOpen(false);
      setView('prepare');
      toast.success('Draft loaded -- continue placing fields.');
    } catch (err: unknown) {
      logger.error('Failed to resume draft:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load draft');
    } finally {
      setResumingEnvelopeId(null);
    }
  };

  // ==================== LIST VIEW HANDLERS ====================

  const handleEnvelopeClick = (envelope: EsignEnvelope) => {
    if (envelope.status === 'draft') {
      handleResumePrepare(envelope);
    } else {
      setSelectedEnvelope(envelope);
      setDetailsDialogOpen(true);
    }
  };

  const handleViewEnvelope = (envelope: EsignEnvelope) => {
    setSelectedEnvelope(envelope);
    setDetailsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (envelopeToDelete) {
      const success = await deleteEnvelope(envelopeToDelete.id);
      if (success) {
        toast.success('Envelope deleted successfully');
        refetch();
      }
    }
    setDeleteDialogOpen(false);
    setEnvelopeToDelete(null);
  };

  const handleRecall = async () => {
    if (envelopeToRecall) {
      const success = await voidEnvelope(envelopeToRecall.id, recallReason);
      if (success) {
        toast.success('Envelope recalled successfully');
        refetch();
      }
    }
    setRecallDialogOpen(false);
    setEnvelopeToRecall(null);
    setRecallReason('');
  };

  const handleDownload = async (envelope: EsignEnvelope) => {
    await downloadDocument(envelope.id, envelope.title || 'document');
  };

  const handleDialogDownload = (envelopeId: string) => {
    const env = envelopes.find(e => e.id === envelopeId);
    downloadDocument(envelopeId, env?.title || 'document');
  };

  const handleDialogVoid = async (envelopeId: string, reason: string) => {
    const success = await voidEnvelope(envelopeId, reason);
    if (success) {
      toast.success('Envelope voided successfully');
      setDetailsDialogOpen(false);
      refetch();
    }
  };

  const handleDialogSendReminder = async (envelopeId: string) => {
    try {
      const result = await esignApi.sendReminder(envelopeId);
      if (result.totalReminders > 0) {
        toast.success(`Reminder sent to ${result.totalReminders} signer${result.totalReminders > 1 ? 's' : ''}`);
      } else {
        toast.info('No pending signers to remind');
      }
    } catch (err) {
      console.error('Failed to send reminder:', err);
      toast.error('Failed to send reminder. Please try again.');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  // ==================== PREPARE VIEW ====================

  if (view === 'prepare' && activeEnvelope) {
    return (
      <div className="space-y-6">
        <WizardHeader
          currentStep={3}
          title="Prepare Form Fields"
          subtitle="Drag and drop fields onto the document for each signer."
          onCancel={() => {
            if (wizardData.files.length > 0) {
              setView('wizard-recipients');
            } else {
              setView('list');
              refetch();
            }
          }}
        />
        <Suspense fallback={<StepFallback />}>
          <PrepareFormStudio
            envelope={activeEnvelope}
            signers={wizardData.signers}
            onBack={() => {
              if (wizardData.files.length > 0) {
                setView('wizard-recipients');
              } else {
                setView('list');
                refetch();
              }
            }}
            onSaveFields={handleSaveFields}
            onSendForSignature={handleSend}
            saving={savingFields}
            sending={sending}
            documentUrl={documentUrl || undefined}
          />
        </Suspense>
      </div>
    );
  }

  // ==================== WIZARD UPLOAD STEP ====================

  if (view === 'wizard-upload') {
    return (
      <div className="space-y-6">
        <WizardHeader
          currentStep={1}
          title="Add Documents"
          subtitle="Upload the PDF files you want to send for signature."
          onCancel={() => setView('list')}
        />
        <Suspense fallback={<StepFallback />}>
          <DocumentUploadStep
            onNext={handleUploadNext}
            onCancel={() => setView('list')}
            initialData={{
              files: wizardData.files,
              title: wizardData.title,
              message: wizardData.message,
              expiryDays: wizardData.expiryDays,
            }}
            containerClassName="space-y-6"
            hideHeader
          />
        </Suspense>
      </div>
    );
  }

  // ==================== WIZARD RECIPIENTS STEP ====================

  if (view === 'wizard-recipients') {
    return (
      <div className="space-y-6">
        <WizardHeader
          currentStep={2}
          title="Add Recipients"
          subtitle="Who needs to sign this document?"
          onCancel={() => setView('list')}
        />

        <Card>
          <CardContent className="p-6">
            <Suspense fallback={<StepFallback />}>
              <RecipientsManager
                signers={wizardData.signers}
                onChange={(signers) => setWizardData(prev => ({ ...prev, signers }))}
                clientContext={clientContext}
              />
            </Suspense>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={() => setView('wizard-upload')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleRecipientsNext}
            disabled={uploading || wizardData.signers.length === 0}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {uploading ? (
              <div className="contents">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Envelope...
              </div>
            ) : (
              <div className="contents">
                Next: Prepare Fields
                <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ==================== LIST VIEW (DEFAULT) ====================

  if (loading) return <EsignTabSkeleton />;

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
            <div>
              <h3 className="font-semibold">Failed to load envelopes</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold leading-none">E-Signature Documents</h2>
          <p className="text-sm text-muted-foreground mt-1">
            All e-sign documents associated with this client
          </p>
        </div>
        <Button
          size="sm"
          className="bg-purple-600 hover:bg-purple-700"
          onClick={handleStartNew}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Document
        </Button>
      </div>

      {/* Statistics Cards (SS8.3 stat card standards) */}
      <div className="grid grid-cols-4 gap-4">
        {(Object.keys(STAT_CONFIG) as Array<keyof typeof STAT_CONFIG>).map((key) => {
          const cfg = STAT_CONFIG[key];
          const Icon = cfg.icon;
          return (
            <Card key={key}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${cfg.bgColor}`}>
                    <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold leading-none">{stats[key]}</p>
                    <p className="text-xs text-muted-foreground mt-1">{cfg.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search & Filter Bar */}
      {envelopes.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="All Statuses" />
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {filteredEnvelopes.length} of {envelopes.length}
              </span>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Envelopes Table */}
      {envelopes.length === 0 ? (
        <EmptyState onUpload={handleStartNew} />
      ) : filteredEnvelopes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-sm">No envelopes match your filters</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or status filter</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Signers</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEnvelopes.map((envelope) => (
                  <EnvelopeRow
                    key={envelope.id}
                    envelope={envelope}
                    resuming={resumingEnvelopeId === envelope.id}
                    onRowClick={() => handleEnvelopeClick(envelope)}
                    onView={() => handleViewEnvelope(envelope)}
                    onDownload={() => handleDownload(envelope)}
                    onDelete={() => {
                      setEnvelopeToDelete(envelope);
                      setDeleteDialogOpen(true);
                    }}
                    onRecall={() => {
                      setEnvelopeToRecall(envelope);
                      setRecallDialogOpen(true);
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ==================== DIALOGS ==================== */}

      <EnvelopeDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        envelope={selectedEnvelope}
        onDownloadDocument={handleDialogDownload}
        onVoidEnvelope={handleDialogVoid}
        onSendReminder={handleDialogSendReminder}
      />

      {/* Delete Envelope Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Envelope</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{envelopeToDelete?.title}&rdquo;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recall Envelope Dialog */}
      <Dialog open={recallDialogOpen} onOpenChange={setRecallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recall Envelope</DialogTitle>
            <DialogDescription>
              Recalling &ldquo;{envelopeToRecall?.title}&rdquo; will void it and notify all signers.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="recallReason">Reason for Recall</Label>
            <Textarea
              id="recallReason"
              value={recallReason}
              onChange={(e) => setRecallReason(e.target.value)}
              placeholder="Enter the reason for recalling the envelope..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecallDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRecall}>
              Recall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== WIZARD PROGRESS HEADER ====================

const WIZARD_STEPS = [
  { step: 1, label: 'Upload', icon: Upload },
  { step: 2, label: 'Recipients', icon: Users },
  { step: 3, label: 'Prepare', icon: FileText },
] as const;

interface WizardHeaderProps {
  currentStep: 1 | 2 | 3;
  title: string;
  subtitle: string;
  onCancel: () => void;
}

function WizardHeader({ currentStep, title, subtitle, onCancel }: WizardHeaderProps) {
  return (
    <div className="space-y-5">
      {/* Back to list link */}
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to documents
      </button>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {WIZARD_STEPS.map((ws, idx) => {
          const StepIcon = ws.icon;
          const isActive = ws.step === currentStep;
          const isCompleted = ws.step < currentStep;
          return (
            <div key={ws.step} className="contents">
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isActive
                      ? 'border-purple-600 bg-purple-50'
                      : isCompleted
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <StepIcon className={`h-4 w-4 ${isActive ? 'text-purple-600' : 'text-gray-400'}`} />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isActive ? 'text-purple-700' : isCompleted ? 'text-green-700' : 'text-gray-400'
                  }`}
                >
                  {ws.label}
                </span>
              </div>
              {idx < WIZARD_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px mx-4 ${
                    ws.step < currentStep ? 'bg-green-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Title & subtitle */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-900 leading-none">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

// ==================== SKELETON LOADING STATE ====================

function EsignTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-5 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {(Object.keys(STAT_CONFIG) as Array<keyof typeof STAT_CONFIG>).map((key) => {
          const cfg = STAT_CONFIG[key];
          return (
            <Card key={key}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${cfg.bgColor}`}>
                    <Skeleton className="h-4 w-4 rounded bg-transparent" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-8" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64 rounded-md" />
        <Skeleton className="h-9 w-[160px] rounded-md" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Document</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Signers</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-1.5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== ENVELOPE TABLE ROW ====================

interface EnvelopeRowProps {
  envelope: EsignEnvelope;
  resuming?: boolean;
  onRowClick: () => void;
  onView: () => void;
  onDownload: () => Promise<void>;
  onDelete: () => void;
  onRecall: () => void;
}

function EnvelopeRow({
  envelope,
  resuming = false,
  onRowClick,
  onView,
  onDownload,
  onDelete,
  onRecall,
}: EnvelopeRowProps) {
  const progress = calculateSigningProgress(envelope);
  const daysUntilExpiry = getDaysUntilExpiry(envelope.expires_at);
  const expiringSoon = isExpiringSoon(envelope.expires_at);
  const isDraft = envelope.status === 'draft';
  const isPending = ['sent', 'viewed', 'partially_signed'].includes(envelope.status);
  const isCompleted = envelope.status === 'completed';

  const [downloadLoading, setDownloadLoading] = useState(false);
  const [certLoading, setCertLoading] = useState(false);

  const handleDownloadDocument = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadLoading(true);
    try { await onDownload(); } finally { setDownloadLoading(false); }
  };

  const handleDownloadCertificate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setCertLoading(true);
    try {
      const response = await esignApi.getCertificateUrl(envelope.id);
      if (response.url) {
        window.open(response.url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Certificate not available');
      }
    } catch (err: unknown) {
      console.error('Failed to download certificate:', err);
      const errObj = err as { status?: number; message?: string };
      if (errObj?.status === 404 || errObj?.message?.includes('not found')) {
        toast.error('Completion certificate has not been generated yet');
      } else {
        toast.error('Unable to download certificate. Please try again.');
      }
    } finally {
      setCertLoading(false);
    }
  };

  return (
    <TableRow
      className="cursor-pointer"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        onRowClick();
      }}
    >
      {/* Document */}
      <TableCell className="pl-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-gray-50">
            {resuming ? (
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate max-w-[220px]">{envelope.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatEnvelopeDate(envelope.created_at)}
            </p>
          </div>
        </div>
      </TableCell>

      {/* Status */}
      <TableCell>
        <Badge className={`${getEnvelopeStatusColor(envelope.status)} text-xs font-medium px-2 py-0.5`}>
          {getEnvelopeStatusLabel(envelope.status)}
        </Badge>
      </TableCell>

      {/* Progress */}
      <TableCell>
        {isDraft ? (
          <span className="text-xs text-muted-foreground">--</span>
        ) : (
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress.isComplete
                    ? 'bg-green-500'
                    : progress.percentComplete > 0
                    ? 'bg-blue-500'
                    : 'bg-gray-300'
                }`}
                style={{ width: `${progress.percentComplete}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {progress.signedCount}/{progress.totalSigners}
            </span>
          </div>
        )}
      </TableCell>

      {/* Signers */}
      <TableCell>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{envelope.totalSigners || progress.totalSigners || 0}</span>
        </div>
      </TableCell>

      {/* Expiry */}
      <TableCell>
        {envelope.expires_at ? (
          <span
            className={`text-xs ${
              expiringSoon
                ? 'text-amber-600 font-medium'
                : daysUntilExpiry !== null && daysUntilExpiry <= 0
                ? 'text-red-600 font-medium'
                : 'text-muted-foreground'
            }`}
          >
            {daysUntilExpiry !== null && daysUntilExpiry > 0 ? `${daysUntilExpiry}d` : 'Expired'}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        )}
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right pr-4">
        <div className="flex items-center justify-end gap-1">
          {isDraft && (
            <div className="contents">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); onRowClick(); }}
                    aria-label="Continue editing"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Continue Editing</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    aria-label="Delete envelope"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          )}

          {isPending && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                  onClick={(e) => { e.stopPropagation(); onRecall(); }}
                  aria-label="Recall envelope"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Recall</TooltipContent>
            </Tooltip>
          )}

          {isCompleted && (
            <div className="contents">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleDownloadDocument}
                    disabled={downloadLoading}
                    aria-label="Download PDF"
                  >
                    {downloadLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download PDF</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleDownloadCertificate}
                    disabled={certLoading}
                    aria-label="Download certificate"
                  >
                    {certLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Award className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Certificate</TooltipContent>
              </Tooltip>
            </div>
          )}

          {!isDraft && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={(e) => { e.stopPropagation(); onView(); }}
                  aria-label="View details"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Details</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}