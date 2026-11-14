/**
 * Envelope Inspector - Professional E-Signature Sidebar
 * DocuSign-style audit trail, recipient routing, and document info
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../../../../ui/button';

import {
  Download,
  Ban,
  MoreHorizontal,
  FileText,
  Mail,
  History,
  CheckCircle2,
  Copy,
  Trash2,
  PenTool,
  UserCheck,
  XCircle,
  MailCheck,
  ShieldCheck,
  Globe,
  Fingerprint,
  AlertTriangle,
  RotateCcw,
  FileSignature,
  ArrowDownToLine,
  Loader2,
  RefreshCw,
  FileDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';

import { StatusBadge } from './StatusBadge';
import type { EsignEnvelope, EsignAuditEvent } from '../types';

import { esignApi } from '../api';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../../../../ui/utils';
import { BackLink } from '../../../layout/page/FilterControls';
import { DsButton, DsSegmented, PageHeader } from '../../../layout/page';
import { VoidEnvelopeDialog } from './VoidEnvelopeDialog';
import { DiscardEnvelopeDialog } from './DiscardEnvelopeDialog';
import { ReminderConfigPanel } from './ReminderSettingsPanel';

// ============================================================================
// AUDIT EVENT DISPLAY HELPERS
// ============================================================================

interface AuditDisplayInfo {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}

function getAuditDisplayInfo(action: string, metadata?: Record<string, unknown>): AuditDisplayInfo {
  switch (action) {
    case 'envelope_created':
      return {
        icon: <FileText className="h-4 w-4" />,
        label: 'Envelope Created',
        description: `Envelope "${metadata?.title || ''}" was created`,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 border-blue-200',
      };
    case 'document_uploaded':
      return {
        icon: <ArrowDownToLine className="h-4 w-4" />,
        label: 'Document Uploaded',
        description:
          Number(metadata?.fileCount) > 1
            ? `${metadata?.fileCount} documents merged and uploaded`
            : `Document "${metadata?.filename || ''}" uploaded (${metadata?.pageCount || '?'} pages)`,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 border-blue-200',
      };
    case 'fields_updated':
      return {
        icon: <PenTool className="h-4 w-4" />,
        label: 'Form Fields Updated',
        description: `${metadata?.fieldCount || 0} field(s) configured on document`,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50 border-indigo-200',
      };
    case 'status_changed':
      return {
        icon: <RefreshCw className="h-4 w-4" />,
        label: 'Status Changed',
        description: `Status changed from "${metadata?.from}" to "${metadata?.to}"`,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50 border-gray-200',
      };
    case 'invite_sent':
      return {
        icon: <MailCheck className="h-4 w-4" />,
        label: 'Invitation Sent',
        description: `Signing invitation sent to ${metadata?.signerName || 'recipient'}`,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50 border-purple-200',
      };
    // Rendered in red rather than falling through to the neutral default.
    // This is the event that explains a stalled envelope: the recipient was
    // never told, so nobody is waiting on a signature they know about. It has
    // to be findable at a glance in the timeline.
    case 'invite_send_failed':
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        label: 'Invitation Not Delivered',
        description: `Signing invitation to ${metadata?.signerName || 'recipient'} could not be sent`,
        color: 'text-red-700',
        bgColor: 'bg-red-50 border-red-200',
      };
    case 'otp_sent':
      return {
        icon: <ShieldCheck className="h-4 w-4" />,
        label: 'OTP Sent',
        description: (metadata?.note as string) || 'Verification code sent to signer',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 border-amber-200',
      };
    case 'otp_resent':
      return {
        icon: <ShieldCheck className="h-4 w-4" />,
        label: 'OTP Resent',
        description: 'Verification code resent to signer',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 border-amber-200',
      };
    case 'otp_verified':
      return {
        icon: <Fingerprint className="h-4 w-4" />,
        label: 'Identity Verified',
        description: 'Signer identity verified via OTP',
        color: 'text-green-600',
        bgColor: 'bg-green-50 border-green-200',
      };
    case 'signer_status_changed':
      return {
        icon: <UserCheck className="h-4 w-4" />,
        label: 'Signer Status Updated',
        description: `Signer status changed from "${metadata?.from}" to "${metadata?.to}"`,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50 border-gray-200',
      };
    case 'signed':
      return {
        icon: <FileSignature className="h-4 w-4" />,
        label: 'Document Signed',
        description: `${metadata?.signerName || 'Signer'} signed the document`,
        color: 'text-green-600',
        bgColor: 'bg-green-50 border-green-200',
      };
    case 'declined':
      return {
        icon: <XCircle className="h-4 w-4" />,
        label: 'Signing Declined',
        description: metadata?.reason
          ? `Signer declined: "${metadata.reason}"`
          : 'Signer declined to sign',
        color: 'text-red-600',
        bgColor: 'bg-red-50 border-red-200',
      };
    case 'envelope_completed':
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        label: 'Envelope Completed',
        description: 'All signers have completed signing',
        color: 'text-green-700',
        bgColor: 'bg-green-50 border-green-200',
      };
    case 'completion_failed':
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        label: 'Completion Failed',
        description: (metadata?.error as string) || 'Envelope completion workflow failed',
        color: 'text-red-600',
        bgColor: 'bg-red-50 border-red-200',
      };
    case 'email_failed':
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        label: 'Email Failed',
        description: 'Failed to send notification email',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 border-amber-200',
      };
    case 'voided':
    case 'envelope_voided':
      return {
        icon: <Ban className="h-4 w-4" />,
        label: 'Envelope Voided',
        description: (metadata?.reason as string) || 'Envelope was voided by admin',
        color: 'text-red-600',
        bgColor: 'bg-red-50 border-red-200',
      };
    case 'field_deleted':
      return {
        icon: <Trash2 className="h-4 w-4" />,
        label: 'Field Deleted',
        description: 'A form field was removed',
        color: 'text-gray-500',
        bgColor: 'bg-gray-50 border-gray-200',
      };
    case 'system_reset':
      return {
        icon: <RotateCcw className="h-4 w-4" />,
        label: 'System Reset',
        description: 'Full system data wipe initiated',
        color: 'text-red-700',
        bgColor: 'bg-red-50 border-red-200',
      };
    default:
      return {
        icon: <History className="h-4 w-4" />,
        label: action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        description: `Action: ${action}`,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50 border-gray-200',
      };
  }
}

function formatAuditDateTime(dateString?: string): string {
  if (!dateString) return 'N/A';
  try {
    return format(new Date(dateString), 'MMM d, yyyy h:mm:ss a');
  } catch {
    return 'Invalid Date';
  }
}

function formatShortDateTime(dateString?: string): string {
  if (!dateString) return 'N/A';
  try {
    return format(new Date(dateString), 'MMM d, h:mm a');
  } catch {
    return 'Invalid Date';
  }
}

function getRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return format(date, 'MMM d');
  } catch {
    return '';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface EnvelopeInspectorProps {
  envelope: EsignEnvelope | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendReminder?: (envelopeId: string) => void;
  onVoidEnvelope?: (envelopeId: string, reason: string) => void;
  onDeleteEnvelope?: (envelopeId: string) => void;
  onDownloadDocument?: (envelopeId: string) => void;
  onResumePrepare?: (envelope: EsignEnvelope) => void;
  resumingEnvelopeId?: string | null;
}

export function EnvelopeInspector({
  envelope,
  open,
  onOpenChange,
  onSendReminder,
  onVoidEnvelope,
  onDeleteEnvelope,
  onDownloadDocument,
  onResumePrepare,
  resumingEnvelopeId,
}: EnvelopeInspectorProps) {
  const [activeTab, setActiveTab] = useState<'routing' | 'details' | 'audit'>('details');
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [auditEvents, setAuditEvents] = useState<EsignAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [fullEnvelope, setFullEnvelope] = useState<EsignEnvelope | null>(null);

  // Fetch full envelope details (with signers/fields) when inspector opens
  useEffect(() => {
    if (open && envelope?.id) {
      setFullEnvelope(envelope);
      // Fetch fresh envelope details to get signers
      esignApi
        .getEnvelope(envelope.id)
        .then((data) => {
          if (data) setFullEnvelope(data);
        })
        .catch(() => {
          // Fallback to what we have
        });
    }
  }, [open, envelope?.id, envelope]);

  // Fetch audit trail when audit tab is selected
  useEffect(() => {
    if (activeTab === 'audit' && envelope?.id) {
      setAuditLoading(true);
      esignApi
        .getAuditTrail(envelope.id)
        .then((data) => {
          setAuditEvents(data.events || []);
        })
        .catch(() => {
          setAuditEvents([]);
        })
        .finally(() => {
          setAuditLoading(false);
        });
    }
  }, [activeTab, envelope?.id]);

  if (!envelope) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(envelope.id);
    toast.success('Envelope ID copied to clipboard');
  };

  const handleResend = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSendReminder) {
      onSendReminder(envelope.id);
      toast.success('Reminder sent to current recipient');
    }
  };

  // Use full envelope data if available for signers
  const envelopeData = fullEnvelope || envelope;
  const sortedSigners = [...(envelopeData.signers || [])].sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );
  const isActive = ['sent', 'viewed', 'partially_signed'].includes(envelope.status);
  const isCompleted = envelope.status === 'completed';
  const isDraft = envelope.status === 'draft';

  // Sort audit events chronologically (newest first)
  const sortedAuditEvents = [...auditEvents].sort((a, b) => {
    const dateA = new Date(a.at || 0).getTime();
    const dateB = new Date(b.at || 0).getTime();
    return dateB - dateA;
  });

  return (
    <div className="contents">
      {open && (
        <div className="ds-page">
          <BackLink label="Envelopes" onClick={() => onOpenChange(false)} />
          <PageHeader
            title={envelope.title}
            description={
              <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span>Envelope</span>
                {envelope.created_at && (
                  <span>· Created {formatShortDateTime(envelope.created_at)}</span>
                )}
                {envelope.expires_at && (
                  <span>· expires {formatShortDateTime(envelope.expires_at)}</span>
                )}
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="ds-meta inline-flex items-center gap-1 font-mono hover:text-nw-ink"
                  title="Copy envelope ID"
                >
                  · {envelope.id.slice(0, 8)}…
                  <Copy className="h-3 w-3" aria-hidden="true" />
                  <span className="sr-only">Copy envelope ID</span>
                </button>
              </span>
            }
            actions={
              <>
                {isCompleted && (
                  <DsButton onClick={() => onDownloadDocument?.(envelope.id)}>Download</DsButton>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <DsButton variant="ghost" aria-label="More envelope actions">
                      <MoreHorizontal aria-hidden="true" />
                    </DsButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isDraft && onDeleteEnvelope && (
                      <DropdownMenuItem
                        onClick={() => setDiscardDialogOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Discard draft
                      </DropdownMenuItem>
                    )}
                    {isActive && (
                      <div className="contents">
                        {onDeleteEnvelope && !envelope.signedCount && (
                          <DropdownMenuItem
                            onClick={() => setDiscardDialogOpen(true)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Discard envelope
                          </DropdownMenuItem>
                        )}
                        {onVoidEnvelope && (
                          <div className="contents">
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setVoidDialogOpen(true)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Ban className="mr-2 h-4 w-4" /> Void…
                            </DropdownMenuItem>
                          </div>
                        )}
                      </div>
                    )}
                    {isCompleted && (
                      <div className="contents">
                        <DropdownMenuItem onClick={() => onDownloadDocument?.(envelope.id)}>
                          <Download className="mr-2 h-4 w-4" /> Download signed PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              await esignApi.downloadEvidencePack(envelope.id, envelope.title);
                            } catch (err) {
                              const message =
                                err instanceof Error
                                  ? err.message
                                  : 'Failed to export evidence pack';
                              toast.error(message);
                            }
                          }}
                        >
                          <FileDown className="mr-2 h-4 w-4" /> Download evidence pack (.zip)
                        </DropdownMenuItem>
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {isActive && onSendReminder && (
                  <DsButton variant="primary" onClick={handleResend}>
                    Send reminder
                  </DsButton>
                )}
                {isDraft && onResumePrepare && (
                  <DsButton
                    variant="primary"
                    onClick={() => onResumePrepare(envelope)}
                    disabled={resumingEnvelopeId === envelope.id}
                  >
                    {resumingEnvelopeId === envelope.id ? (
                      <>
                        <Loader2 className="animate-spin" aria-hidden="true" /> Loading…
                      </>
                    ) : (
                      'Continue editing'
                    )}
                  </DsButton>
                )}
              </>
            }
          />
          <div className="ds-card max-w-[880px]">
            <div className="ds-card-b flex flex-col gap-4">
              <DsSegmented
                label="Envelope details"
                value={activeTab}
                onChange={setActiveTab}
                options={[
                  { value: 'details', label: 'Overview' },
                  { value: 'routing', label: `Signers · ${sortedSigners.length}` },
                  { value: 'audit', label: 'Activity' },
                ]}
              />
              <div className="space-y-6">
                {/* ============ RECIPIENTS TAB ============ */}
                {activeTab === 'routing' && (
                  <div className="space-y-3">
                    <p className="ds-meta">
                      {(envelopeData.signing_mode || 'sequential') === 'sequential'
                        ? 'Signers sign in order.'
                        : 'Signers can sign at the same time.'}
                    </p>
                    {sortedSigners.length === 0 ? (
                      <p className="ds-meta py-6 text-center">No signers added yet.</p>
                    ) : (
                      /* ES-Details: one timeline row per signer, pill on the right. */
                      <div className="ds-tl">
                        {sortedSigners.map((signer) => {
                          const isSigned = signer.status === 'signed';
                          const isCurrent = ['sent', 'viewed', 'otp_verified'].includes(
                            signer.status,
                          );
                          const isDeclined =
                            signer.status === 'declined' || signer.status === 'rejected';
                          const line = isSigned
                            ? signer.signed_at
                              ? `Signed ${formatShortDateTime(signer.signed_at)}`
                              : 'Signed'
                            : isDeclined
                              ? `Declined${signer.rejection_reason ? `: “${signer.rejection_reason}”` : ''}`
                              : isCurrent
                                ? 'Waiting for their signature'
                                : 'Not their turn yet';
                          return (
                            <div key={signer.id} className="ds-tl-i">
                              <span
                                className="dot"
                                style={
                                  isSigned
                                    ? undefined
                                    : isDeclined
                                      ? { background: '#b91c1c', boxShadow: '0 0 0 4px #fef2f2' }
                                      : { background: '#d1d5db', boxShadow: '0 0 0 4px #f3f4f6' }
                                }
                                aria-hidden="true"
                              />
                              <div className="min-w-0 flex-1">
                                <b className="font-medium">
                                  {signer.name}
                                  {signer.role ? (
                                    <span className="ds-meta"> · {signer.role}</span>
                                  ) : null}
                                  {signer.otp_required ? (
                                    <span className="ds-meta"> · OTP</span>
                                  ) : null}
                                </b>
                                <span className="ds-meta block truncate">
                                  {signer.email} · {line}
                                </span>
                              </div>
                              {isCurrent && onSendReminder && (
                                <DsButton size="sm" variant="ghost" onClick={handleResend}>
                                  Remind
                                </DsButton>
                              )}
                              <StatusBadge status={signer.status} type="signer" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ============ DETAILS TAB ============ */}
                {activeTab === 'details' && (
                  <div className="space-y-5">
                    {/* ES-DetailsOverview: the facts as a description list. */}
                    <div className="ds-dl">
                      <div>
                        <span>Status</span>
                        <StatusBadge status={envelope.status} type="envelope" />
                      </div>
                      <div>
                        <span>Created</span>
                        {formatShortDateTime(envelope.created_at)}
                      </div>
                      <div>
                        <span>Expires</span>
                        {envelope.expires_at ? formatShortDateTime(envelope.expires_at) : 'Never'}
                      </div>
                      <div>
                        <span>Envelope ID</span>
                        <span className="font-mono text-[12.5px] text-nw-text-2">
                          {envelope.id.slice(0, 8)}…{envelope.id.slice(-4)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span>Documents</span>
                        <span className="block truncate">
                          {envelopeData.document?.filename || 'Document.pdf'}
                          {envelopeData.document?.page_count
                            ? ` · ${envelopeData.document.page_count} pages`
                            : ''}
                        </span>
                      </div>
                      <div>
                        <span>Signing order</span>
                        {(envelopeData.signing_mode || 'sequential') === 'sequential'
                          ? 'In order'
                          : 'All at once'}
                      </div>
                      <div>
                        <span>Last updated</span>
                        {formatShortDateTime(envelope.updated_at)}
                      </div>
                      <div>
                        <span>Completed</span>
                        {envelope.completed_at
                          ? formatShortDateTime(envelope.completed_at)
                          : isCompleted
                            ? 'Yes'
                            : '—'}
                      </div>
                    </div>

                    {envelope.message && (
                      <div>
                        <b className="font-semibold">Message to signers</b>
                        <p className="ds-meta mt-0.5">{envelope.message}</p>
                      </div>
                    )}

                    {/* Per-Envelope Reminder Settings */}
                    {!isCompleted && envelope.status !== 'voided' && (
                      <ReminderConfigPanel
                        envelopeId={envelope.id}
                        envelopeStatus={envelope.status}
                      />
                    )}
                  </div>
                )}

                {/* ============ ACTIVITY / AUDIT TAB ============ */}
                {activeTab === 'audit' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">Activity Log</h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await esignApi.downloadAuditTrailCsv(envelope.id);
                            } catch (_err) {
                              toast.error('Failed to export audit trail');
                            }
                          }}
                          className="h-7 text-xs gap-1"
                          title="Export audit trail as CSV"
                        >
                          <FileDown className="h-3 w-3" />
                          Export CSV
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {sortedAuditEvents.length} event
                          {sortedAuditEvents.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {auditLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                        <span className="text-sm text-muted-foreground">Loading activity...</span>
                      </div>
                    ) : sortedAuditEvents.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No activity recorded</p>
                      </div>
                    ) : (
                      <div className="relative">
                        {/* Timeline connector */}
                        <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border" />

                        <div className="space-y-0">
                          {sortedAuditEvents.map((event, index) => {
                            const display = getAuditDisplayInfo(event.action, event.metadata);
                            const eventTime = event.at;
                            const isFirst = index === 0;

                            return (
                              <div
                                key={event.id || index}
                                className="relative flex gap-3 pb-5 last:pb-0"
                              >
                                {/* Timeline dot */}
                                <div
                                  className={cn(
                                    'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background',
                                    isFirst ? display.bgColor : 'border-muted bg-muted/30',
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'flex items-center justify-center',
                                      isFirst ? display.color : 'text-muted-foreground',
                                    )}
                                  >
                                    {display.icon}
                                  </span>
                                </div>

                                {/* Event content */}
                                <div className="flex-1 min-w-0 pt-0.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground leading-tight">
                                        {display.label}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                        {display.description}
                                      </p>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap pt-0.5">
                                      {getRelativeTime(eventTime)}
                                    </span>
                                  </div>

                                  {/* Actor & metadata row */}
                                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                    {event.email && (
                                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        {event.email}
                                      </span>
                                    )}
                                    {event.ip && event.ip !== 'unknown' && (
                                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <Globe className="h-3 w-3" />
                                        {event.ip}
                                      </span>
                                    )}
                                    <span
                                      className="text-[11px] text-muted-foreground"
                                      title={formatAuditDateTime(eventTime)}
                                    >
                                      {formatAuditDateTime(eventTime)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <VoidEnvelopeDialog
        open={voidDialogOpen}
        onOpenChange={setVoidDialogOpen}
        onConfirm={async (reason) => {
          if (onVoidEnvelope) {
            await onVoidEnvelope(envelope.id, reason);
            setVoidDialogOpen(false);
            onOpenChange(false);
          }
        }}
        title={envelope.title}
      />

      <DiscardEnvelopeDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        envelopeStatus={envelope.status}
        onConfirm={async () => {
          if (onDeleteEnvelope) {
            onDeleteEnvelope(envelope.id);
            setDiscardDialogOpen(false);
            onOpenChange(false);
          }
        }}
        title={envelope.title}
      />
    </div>
  );
}
