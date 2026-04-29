/**
 * EnvelopeDetailsDialog
 *
 * Full-screen-style dialog for viewing envelope details.
 *
 * Fixes in this revision:
 *  - Activity tab now references correct audit event fields (action, at, ip, email)
 *  - Activity events are lazy-loaded via esignApi.getAuditTrail when the tab is selected
 *  - Preview Document fetches the document URL and opens in a new tab
 *  - Visual improvements: compact detail grid, event-type icons, better layout
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../../ui/tabs';
import {
  Card,
  CardContent,
} from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Skeleton } from '../../../../ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../../ui/tooltip';
import {
  Download,
  Send,
  Ban,
  Eye,
  Calendar,
  Users,
  FileText,
  Mail,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  ShieldCheck,
  Bell,
  FilePlus,
  PenTool,
  UserPlus,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Globe,
  Award,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { SigningProgressTimeline } from './SigningProgressTimeline';
import { ReminderConfigPanel, SigningModeSelector } from './ReminderSettingsPanel';
import type { EsignEnvelope, EsignAuditEvent } from '../types';
import { esignApi } from '../api';
import { format, differenceInDays, formatDistanceToNow } from 'date-fns';
import { VoidEnvelopeDialog } from './VoidEnvelopeDialog';
import { toast } from 'sonner@2.0.3';

// ==================== HELPERS ====================

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '—';
  try {
    return format(new Date(dateString), 'dd MMM yyyy');
  } catch {
    return '—';
  }
};

const formatDateTime = (dateString?: string | null): string => {
  if (!dateString) return '—';
  try {
    return format(new Date(dateString), 'dd MMM yyyy, HH:mm');
  } catch {
    return '—';
  }
};

const formatRelative = (dateString?: string | null): string => {
  if (!dateString) return '';
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return '';
  }
};

const getDaysUntilExpiry = (dateString?: string | null): number | null => {
  if (!dateString) return null;
  try {
    return differenceInDays(new Date(dateString), new Date());
  } catch {
    return null;
  }
};

// ==================== AUDIT EVENT CONFIG ====================

interface AuditEventStyle {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const AUDIT_EVENT_CONFIG: Record<string, AuditEventStyle> = {
  envelope_created: { label: 'Envelope Created', icon: FilePlus, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  envelope_sent: { label: 'Envelope Sent', icon: Send, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  envelope_completed: { label: 'Envelope Completed', icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50' },
  envelope_voided: { label: 'Envelope Voided', icon: Ban, color: 'text-red-600', bgColor: 'bg-red-50' },
  envelope_expired: { label: 'Envelope Expired', icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  signer_invited: { label: 'Signer Invited', icon: UserPlus, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  signer_viewed: { label: 'Document Viewed', icon: Eye, color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  signer_signed: { label: 'Document Signed', icon: PenTool, color: 'text-green-600', bgColor: 'bg-green-50' },
  signer_rejected: { label: 'Signing Rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
  signer_declined: { label: 'Signing Declined', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
  otp_sent: { label: 'OTP Sent', icon: Shield, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  otp_verified: { label: 'OTP Verified', icon: ShieldCheck, color: 'text-green-600', bgColor: 'bg-green-50' },
  reminder_sent: { label: 'Reminder Sent', icon: Bell, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  document_uploaded: { label: 'Document Uploaded', icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  fields_updated: { label: 'Fields Updated', icon: PenTool, color: 'text-gray-600', bgColor: 'bg-gray-50' },
  certificate_generated: { label: 'Certificate Generated', icon: FileText, color: 'text-green-600', bgColor: 'bg-green-50' },
};

const DEFAULT_EVENT_STYLE: AuditEventStyle = {
  label: 'Event',
  icon: History,
  color: 'text-gray-600',
  bgColor: 'bg-gray-50',
};

function getEventStyle(action: string): AuditEventStyle {
  return AUDIT_EVENT_CONFIG[action] || { ...DEFAULT_EVENT_STYLE, label: formatActionLabel(action) };
}

/** Convert snake_case action to Title Case label */
function formatActionLabel(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ==================== PROPS ====================

interface EnvelopeDetailsDialogProps {
  envelope: EsignEnvelope | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hides reminders, void, and signing/reminder administrator controls — client portal */
  readOnly?: boolean;
  onSendReminder?: (envelopeId: string) => void;
  onVoidEnvelope?: (envelopeId: string, reason: string) => void;
  onDownloadDocument?: (envelopeId: string) => void;
}

// ==================== MAIN COMPONENT ====================

export function EnvelopeDetailsDialog({
  envelope,
  open,
  onOpenChange,
  readOnly = false,
  onSendReminder,
  onVoidEnvelope,
  onDownloadDocument,
}: EnvelopeDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [certificateLoading, setCertificateLoading] = useState(false);

  // Lazy-loaded audit events
  const [auditEvents, setAuditEvents] = useState<EsignAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Reset state when envelope changes or dialog opens
  useEffect(() => {
    if (open && envelope) {
      setActiveTab('overview');
      setAuditLoaded(false);
      setAuditEvents([]);
      setAuditError(null);
      setCopiedId(false);
    }
  }, [open, envelope?.id]);

  // Lazy-load audit events when Activity tab is selected
  const loadAuditEvents = useCallback(async () => {
    if (!envelope || auditLoaded || auditLoading) return;

    // If envelope already has audit_events populated, use them directly
    if (envelope.audit_events && envelope.audit_events.length > 0) {
      setAuditEvents(envelope.audit_events);
      setAuditLoaded(true);
      return;
    }

    // Otherwise fetch from API
    setAuditLoading(true);
    setAuditError(null);
    try {
      const result = await esignApi.getAuditTrail(envelope.id);
      setAuditEvents(result.events || []);
      setAuditLoaded(true);
    } catch (err) {
      console.error('Failed to load audit trail:', err);
      setAuditError('Unable to load activity log. Please try again.');
    } finally {
      setAuditLoading(false);
    }
  }, [envelope, auditLoaded, auditLoading]);

  // Trigger load when switching to activity tab
  useEffect(() => {
    if (activeTab === 'activity') {
      loadAuditEvents();
    }
  }, [activeTab, loadAuditEvents]);

  if (!envelope) return null;

  const daysUntilExpiry = getDaysUntilExpiry(envelope.expires_at);
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 3;
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
  const isPending = ['sent', 'viewed', 'partially_signed'].includes(envelope.status);
  const isCompleted = envelope.status === 'completed';

  // ---------- Handlers ----------

  const handleSendReminder = () => {
    if (onSendReminder) {
      onSendReminder(envelope.id);
    }
  };

  const handleVoidClick = () => {
    setVoidDialogOpen(true);
  };

  const handleVoidConfirm = async (reason: string) => {
    if (onVoidEnvelope) {
      onVoidEnvelope(envelope.id, reason);
      setVoidDialogOpen(false);
      onOpenChange(false);
    }
  };

  const handleDownload = () => {
    if (onDownloadDocument) {
      onDownloadDocument(envelope.id);
    }
  };

  const handlePreviewDocument = async () => {
    setPreviewing(true);
    try {
      const { url } = await esignApi.getDocumentUrl(envelope.id);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Document URL not available');
      }
    } catch (err) {
      console.error('Failed to preview document:', err);
      toast.error('Unable to preview document. Please try again.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(envelope.id).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  const handleDownloadCertificate = async () => {
    setCertificateLoading(true);
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
      // 404 means certificate hasn't been generated yet
      if (errObj?.status === 404 || errObj?.message?.includes('not found')) {
        toast.error('Completion certificate has not been generated yet');
      } else {
        toast.error('Unable to download certificate. Please try again.');
      }
    } finally {
      setCertificateLoading(false);
    }
  };

  return (
    <div className="contents">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto p-0">
          {/* ==================== HEADER ==================== */}
          <div className="px-6 pt-6 pb-4 border-b bg-gray-50/50">
            <DialogHeader className="space-y-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-xl font-semibold leading-tight truncate">
                    {envelope.title}
                  </DialogTitle>
                  <DialogDescription className="mt-1.5 flex items-center gap-2 text-sm">
                    <span>Created {formatDate(envelope.created_at)}</span>
                    <span className="text-muted-foreground/40">•</span>
                    <button
                      onClick={handleCopyId}
                      className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy Envelope ID"
                    >
                      {envelope.id.slice(0, 8)}…
                      {copiedId ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </DialogDescription>
                </div>
                <StatusBadge status={envelope.status} type="envelope" showIcon={true} />
              </div>
            </DialogHeader>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-4">
              {isCompleted && (
                <div className="contents">
                  <Button onClick={handleDownload} variant="outline" size="sm" className="h-8">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download PDF
                  </Button>
                  <Button
                    onClick={handleDownloadCertificate}
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={certificateLoading}
                  >
                    {certificateLoading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Award className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Certificate
                  </Button>
                </div>
              )}
              <Button
                onClick={handlePreviewDocument}
                variant="outline"
                size="sm"
                className="h-8"
                disabled={previewing}
              >
                {previewing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                )}
                Preview Document
              </Button>
              {isPending && !readOnly && (
                <div className="contents">
                  <Button onClick={handleSendReminder} variant="outline" size="sm" className="h-8">
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Send Reminder
                  </Button>
                  <Button
                    onClick={handleVoidClick}
                    variant="outline"
                    size="sm"
                    className="h-8 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                  >
                    <Ban className="h-3.5 w-3.5 mr-1.5" />
                    Void
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ==================== TABS ==================== */}
          <div className="px-6 pb-6 pt-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="signers">Signers ({envelope.signers?.length || 0})</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              {/* ==================== OVERVIEW TAB ==================== */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                {/* Compact detail grid */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border p-4">
                  <DetailItem
                    icon={Calendar}
                    label="Created"
                    value={formatDateTime(envelope.created_at)}
                  />
                  <DetailItem
                    icon={Calendar}
                    label="Expires"
                    value={
                      envelope.expires_at
                        ? formatDateTime(envelope.expires_at)
                        : 'No expiry set'
                    }
                    valueClassName={
                      isExpired ? 'text-red-600 font-medium' :
                      isExpiringSoon ? 'text-amber-600 font-medium' : undefined
                    }
                    suffix={
                      daysUntilExpiry !== null && daysUntilExpiry > 0
                        ? `(${daysUntilExpiry} days)`
                        : daysUntilExpiry !== null && daysUntilExpiry < 0
                        ? '(Expired)'
                        : undefined
                    }
                  />
                  <DetailItem
                    icon={Users}
                    label="Total Signers"
                    value={String(envelope.totalSigners || envelope.signers?.length || 0)}
                  />
                  <DetailItem
                    icon={FileText}
                    label="Document"
                    value={envelope.document?.filename || envelope.title}
                  />
                  {envelope.signing_mode && (
                    <DetailItem
                      icon={Clock}
                      label="Signing Mode"
                      value={envelope.signing_mode === 'sequential' ? 'Sequential' : 'Parallel'}
                    />
                  )}
                  {envelope.completed_at && (
                    <DetailItem
                      icon={CheckCircle2}
                      label="Completed"
                      value={formatDateTime(envelope.completed_at)}
                    />
                  )}
                </div>

                {/* Signing Progress */}
                <Card>
                  <CardContent className="pt-5 pb-5 space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Signing Progress
                    </h3>
                    <SigningProgressTimeline envelope={envelope} />
                  </CardContent>
                </Card>

                {/* Message */}
                {envelope.message && (
                  <div className="rounded-lg border p-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Message to Signers
                    </h3>
                    <p className="text-sm leading-relaxed">{envelope.message}</p>
                  </div>
                )}

                {/* Signing Mode & Reminders (for active envelopes) */}
                {isPending && !readOnly && (
                  <div className="grid grid-cols-2 gap-4">
                    <SigningModeSelector
                      envelopeId={envelope.id}
                      currentMode={envelope.signing_mode || 'sequential'}
                      envelopeStatus={envelope.status}
                    />
                    <ReminderConfigPanel
                      envelopeId={envelope.id}
                      envelopeStatus={envelope.status}
                    />
                  </div>
                )}
              </TabsContent>

              {/* ==================== SIGNERS TAB ==================== */}
              <TabsContent value="signers" className="space-y-3 mt-4">
                {envelope.signers && envelope.signers.length > 0 ? (
                  envelope.signers.map((signer) => (
                    <div
                      key={signer.id}
                      className="flex items-center justify-between gap-4 rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex-shrink-0 h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-sm font-semibold text-purple-700">
                            {(signer.name || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{signer.name}</span>
                            {signer.role && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                {signer.role}
                              </Badge>
                            )}
                            {envelope.signing_mode === 'sequential' && (
                              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                                #{signer.order || 1}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 shrink-0" />
                              {signer.email}
                            </span>
                            {signer.otp_required && (
                              <span className="flex items-center gap-1 text-amber-600 shrink-0">
                                <Shield className="h-3 w-3" />
                                OTP
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {signer.signed_at && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[11px] text-muted-foreground">
                                {formatDate(signer.signed_at)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Signed {formatDateTime(signer.signed_at)}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <StatusBadge status={signer.status} type="signer" showIcon={true} size="sm" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No signers configured</p>
                  </div>
                )}
              </TabsContent>

              {/* ==================== ACTIVITY TAB ==================== */}
              <TabsContent value="activity" className="mt-4">
                <ActivityTimeline
                  events={auditEvents}
                  loading={auditLoading}
                  error={auditError}
                  onRetry={loadAuditEvents}
                />
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {!readOnly && (
        <VoidEnvelopeDialog
          open={voidDialogOpen}
          onOpenChange={setVoidDialogOpen}
          onConfirm={handleVoidConfirm}
          title={envelope.title}
        />
      )}
    </div>
  );
}

// ==================== DETAIL ITEM ====================

interface DetailItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClassName?: string;
  suffix?: string;
}

function DetailItem({ icon: Icon, label, value, valueClassName, suffix }: DetailItemProps) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium truncate ${valueClassName || ''}`}>
          {value}
          {suffix && (
            <span className="text-xs text-muted-foreground font-normal ml-1.5">{suffix}</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ==================== ACTIVITY TIMELINE ====================

interface ActivityTimelineProps {
  events: EsignAuditEvent[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function ActivityTimeline({ events, loading, error, onRetry }: ActivityTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try Again
        </Button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No activity recorded yet</p>
      </div>
    );
  }

  // Sort events newest first
  const sorted = [...events].sort((a, b) => {
    const timeA = a.at || (a as Record<string, unknown>).created_at as string || '';
    const timeB = b.at || (b as Record<string, unknown>).created_at as string || '';
    return timeB.localeCompare(timeA);
  });

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border" />

      <div className="space-y-0">
        {sorted.map((event, index) => {
          // Use correct field names: action (not event_type), at (not created_at)
          const action = event.action || (event as Record<string, unknown>).event_type as string || 'unknown';
          const timestamp = event.at || (event as Record<string, unknown>).created_at as string || '';
          const style = getEventStyle(action);
          const EventIcon = style.icon;
          const isFirst = index === 0;

          return (
            <div key={event.id || index} className="relative flex gap-3 py-2.5">
              {/* Icon node */}
              <div
                className={`relative z-10 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${style.bgColor} ${style.color}`}
              >
                <EventIcon className="h-3.5 w-3.5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-medium ${isFirst ? 'text-foreground' : 'text-foreground/80'}`}>
                    {style.label}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {formatRelative(timestamp)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {formatDateTime(timestamp)}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Actor / context info */}
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {event.email && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {event.email}
                    </span>
                  )}
                  {event.metadata?.signer_name && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {event.metadata.signer_name}
                    </span>
                  )}
                  {event.ip && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Globe className="h-3 w-3" />
                      {event.ip}
                    </span>
                  )}
                  {event.metadata?.reason && (
                    <span className="text-xs text-muted-foreground italic">
                      &ldquo;{event.metadata.reason}&rdquo;
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}