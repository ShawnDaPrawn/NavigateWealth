/**
 * Envelope Inspector - Professional E-Signature Sidebar
 * DocuSign-style audit trail, recipient routing, and document info
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "../../../../ui/sheet";
import { Button } from "../../../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../ui/card";
import { Badge } from "../../../../ui/badge";
import { ScrollArea } from "../../../../ui/scroll-area";
import { Separator } from "../../../../ui/separator";
import {
  Download,
  Send,
  Ban,
  Eye,
  Users,
  FileText,
  Mail,
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  MoreVertical,
  Shield,
  ChevronRight,
  Trash2,
  FileCheck,
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
  ExternalLink,
  Loader2,
  RefreshCw,
  FileDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../../ui/dropdown-menu";

import { StatusBadge } from './StatusBadge';
import type { EsignEnvelope, EsignSigner, EsignAuditEvent } from '../types';
import type { SigningMode } from '../types';
import { esignApi } from '../api';
import { format } from 'date-fns';
import { toast } from 'sonner@2.0.3';
import { cn } from '../../../../ui/utils';
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
        description: metadata?.fileCount > 1 
          ? `${metadata.fileCount} documents merged and uploaded` 
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
    case 'otp_sent':
      return {
        icon: <ShieldCheck className="h-4 w-4" />,
        label: 'OTP Sent',
        description: metadata?.note || 'Verification code sent to signer',
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
        description: metadata?.error || 'Envelope completion workflow failed',
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
        description: metadata?.reason || 'Envelope was voided by admin',
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
        label: action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: `Action: ${action}`,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50 border-gray-200',
      };
  }
}

function getActorLabel(event: EsignAuditEvent): string {
  if (event.actor_type === 'system') return 'System';
  if (event.actor_type === 'sender_user') return event.email || 'Admin';
  if (event.actor_type === 'signer') return event.email || 'Signer';
  return event.email || 'Unknown';
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
  const [activeTab, setActiveTab] = useState<'routing' | 'details' | 'audit'>('routing');
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
      esignApi.getEnvelope(envelope.id).then(data => {
        if (data) setFullEnvelope(data);
      }).catch(() => {
        // Fallback to what we have
      });
    }
  }, [open, envelope?.id]);

  // Fetch audit trail when audit tab is selected
  useEffect(() => {
    if (activeTab === 'audit' && envelope?.id) {
      setAuditLoading(true);
      esignApi.getAuditTrail(envelope.id).then(data => {
        setAuditEvents(data.events || []);
      }).catch(() => {
        setAuditEvents([]);
      }).finally(() => {
        setAuditLoading(false);
      });
    }
  }, [activeTab, envelope?.id]);

  if (!envelope) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(envelope.id);
    toast.success("Envelope ID copied to clipboard");
  };

  const handleResend = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSendReminder) {
      onSendReminder(envelope.id);
      toast.success("Reminder sent to current recipient");
    }
  };

  // Use full envelope data if available for signers
  const envelopeData = fullEnvelope || envelope;
  const sortedSigners = [...(envelopeData.signers || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const isActive = ['sent', 'viewed', 'partially_signed'].includes(envelope.status);
  const isCompleted = envelope.status === 'completed';
  const isDraft = envelope.status === 'draft';

  // Sort audit events chronologically (newest first)
  const sortedAuditEvents = [...auditEvents].sort((a, b) => {
    const dateA = new Date(a.at || a.created_at || 0).getTime();
    const dateB = new Date(b.at || b.created_at || 0).getTime();
    return dateB - dateA;
  });

  return (
    <div className="contents">
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-background sm:border-l border-border shadow-xl">
          {/* Status Indicator Strip */}
          <div className={cn(
            "h-1 w-full shrink-0",
            isCompleted ? "bg-green-500" :
            envelope.status === 'voided' ? "bg-red-500" :
            isDraft ? "bg-gray-300" :
            "bg-blue-500"
          )} />
          
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleCopyId}
                    className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    title="Click to copy ID"
                  >
                    <span className="truncate max-w-[180px]">{envelope.id}</span>
                    <Copy className="h-3 w-3 shrink-0" />
                  </button>
                </div>
                <SheetTitle className="text-lg font-semibold leading-tight truncate pr-4" title={envelope.title}>
                  {envelope.title}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Envelope details for {envelope.title}
                </SheetDescription>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={envelope.status} type="envelope" showIcon size="sm" />
                  {envelope.expires_at && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expires {formatShortDateTime(envelope.expires_at)}
                    </span>
                  )}
                  {sortedSigners.length > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {sortedSigners.filter(s => s.status === 'signed').length}/{sortedSigners.length} signed
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {isDraft && onResumePrepare && (
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => onResumePrepare(envelope)}
                    disabled={resumingEnvelopeId === envelope.id}
                  >
                    {resumingEnvelopeId === envelope.id ? (
                      <div className="contents">
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        Loading...
                      </div>
                    ) : (
                      <div className="contents">
                        <PenTool className="h-4 w-4 mr-1.5" />
                        Continue Editing
                      </div>
                    )}
                  </Button>
                )}
                {isCompleted && (
                  <Button size="sm" variant="outline" onClick={() => onDownloadDocument?.(envelope.id)}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Download
                  </Button>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    {isDraft && onDeleteEnvelope && (
                      <DropdownMenuItem 
                        onClick={() => setDiscardDialogOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Discard Draft
                      </DropdownMenuItem>
                    )}
                    {isActive && (
                      <div className="contents">
                        <DropdownMenuItem onClick={handleResend}>
                          <Send className="mr-2 h-4 w-4" /> Send Reminder
                        </DropdownMenuItem>
                        {onDeleteEnvelope && !envelope.signedCount && (
                          <DropdownMenuItem
                            onClick={() => setDiscardDialogOpen(true)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Discard Envelope
                          </DropdownMenuItem>
                        )}
                        {onVoidEnvelope && (
                          <div className="contents">
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => setVoidDialogOpen(true)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Ban className="mr-2 h-4 w-4" /> Void Envelope
                            </DropdownMenuItem>
                          </div>
                        )}
                      </div>
                    )}
                    {isCompleted && (
                      <DropdownMenuItem onClick={() => onDownloadDocument?.(envelope.id)}>
                        <Download className="mr-2 h-4 w-4" /> Download Signed PDF
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="px-6 border-b shrink-0">
            <div className="flex gap-0">
              {[
                { key: 'routing' as const, label: 'Recipients', icon: Users },
                { key: 'details' as const, label: 'Details', icon: FileText },
                { key: 'audit' as const, label: 'Activity', icon: History },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.key
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* ============ RECIPIENTS TAB ============ */}
              {activeTab === 'routing' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">Signing Order</h3>
                      {(() => {
                        const mode: SigningMode = envelopeData.signing_mode || 'sequential';
                        return (
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-normal ${
                              mode === 'sequential'
                                ? 'border-purple-200 bg-purple-50 text-purple-700'
                                : 'border-blue-200 bg-blue-50 text-blue-700'
                            }`}
                          >
                            {mode === 'sequential' ? 'Sequential' : 'Parallel'}
                          </Badge>
                        );
                      })()}
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {sortedSigners.length} Recipient{sortedSigners.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  {sortedSigners.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No recipients added yet</p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Vertical connector line */}
                      {sortedSigners.length > 1 && (
                        <div className="absolute left-5 top-8 bottom-8 w-px bg-border" />
                      )}

                      <div className="space-y-4">
                        {sortedSigners.map((signer, index) => {
                          const isSigned = signer.status === 'signed';
                          const isCurrent = ['sent', 'viewed', 'otp_verified'].includes(signer.status);
                          const isPending = signer.status === 'pending';
                          const isDeclined = signer.status === 'declined' || signer.status === 'rejected';
                          const isEnvelopeVoided = envelope.status === 'voided';
                          
                          return (
                            <div key={signer.id} className="relative flex gap-4">
                              {/* Step indicator */}
                              <div className={cn(
                                "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background transition-all",
                                isSigned ? "border-green-500 text-green-500" :
                                isDeclined ? "border-red-500 text-red-500" :
                                isCurrent ? "border-blue-500 text-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]" :
                                isEnvelopeVoided ? "border-gray-300 text-gray-400" :
                                "border-muted text-muted-foreground"
                              )}>
                                {isSigned ? <CheckCircle2 className="h-5 w-5" /> :
                                 isDeclined ? <XCircle className="h-5 w-5" /> :
                                 isCurrent ? <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" /> :
                                 <span className="text-xs font-semibold">{index + 1}</span>}
                              </div>

                              {/* Signer card */}
                              <div className={cn(
                                "flex-1 rounded-lg border p-4 transition-all",
                                isCurrent ? "border-blue-200 bg-blue-50/50 shadow-sm" :
                                isSigned ? "border-green-100 bg-green-50/30" :
                                isDeclined ? "border-red-100 bg-red-50/30" :
                                isPending ? "border-dashed opacity-60" : ""
                              )}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="font-medium text-sm">{signer.name}</h4>
                                      {signer.role && (
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                                          {signer.role}
                                        </Badge>
                                      )}
                                      {signer.otp_required && (
                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-0.5 border-amber-200 text-amber-700 bg-amber-50">
                                          <Shield className="h-3 w-3" /> OTP
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <Mail className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{signer.email}</span>
                                    </p>
                                  </div>
                                  <StatusBadge status={signer.status} type="signer" size="sm" />
                                </div>

                                {/* Timestamp / actions */}
                                {(isSigned || isCurrent) && (
                                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                      {isSigned && signer.signed_at
                                        ? `Signed ${formatShortDateTime(signer.signed_at)}`
                                        : isCurrent
                                        ? 'Awaiting signature'
                                        : ''}
                                    </span>
                                    {isCurrent && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 -mr-2"
                                        onClick={handleResend}
                                      >
                                        <Send className="h-3 w-3 mr-1" /> Remind
                                      </Button>
                                    )}
                                  </div>
                                )}
                                {isDeclined && (
                                  <div className="mt-3 pt-3 border-t text-xs text-red-600">
                                    Declined{signer.rejection_reason ? `: "${signer.rejection_reason}"` : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============ DETAILS TAB ============ */}
              {activeTab === 'details' && (
                <div className="space-y-5">
                  {/* Document */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Document
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
                        <div className="h-10 w-8 bg-red-50 border border-red-100 rounded flex items-center justify-center shrink-0">
                          <span className="text-[7px] font-bold text-red-600 uppercase">PDF</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {envelopeData.document?.original_filename || envelopeData.document?.filename || 'Document.pdf'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {envelopeData.document?.page_count ? `${envelopeData.document.page_count} pages` : 'PDF Document'}
                          </p>
                        </div>
                        {isCompleted && (
                          <Button variant="outline" size="sm" onClick={() => onDownloadDocument?.(envelope.id)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      {isCompleted && (
                        <div className="mt-3 flex items-center gap-2 p-2.5 bg-green-50 border border-green-100 rounded-lg">
                          <FileCheck className="h-4 w-4 text-green-600 shrink-0" />
                          <p className="text-xs text-green-700 font-medium">
                            Signed document package available for download
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Message */}
                  {envelope.message && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          Email Message
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-muted/20 p-3 rounded-lg text-sm italic text-muted-foreground border">
                          "{envelope.message}"
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Created', value: formatShortDateTime(envelope.created_at) },
                      { label: 'Last Updated', value: formatShortDateTime(envelope.updated_at || (envelope as Record<string, unknown>).updatedAt as string) },
                      { label: 'Expires', value: envelope.expires_at ? formatShortDateTime(envelope.expires_at) : 'Never' },
                      { label: 'Completed', value: envelope.completed_at ? formatShortDateTime(envelope.completed_at) : isCompleted ? 'Yes' : '—' },
                    ].map(item => (
                      <div key={item.label} className="p-3 border rounded-lg bg-muted/10">
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1">{item.label}</p>
                        <p className="text-sm font-medium">{item.value}</p>
                      </div>
                    ))}
                  </div>

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
                          } catch (err) {
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
                        {sortedAuditEvents.length} event{sortedAuditEvents.length !== 1 ? 's' : ''}
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
                          const eventTime = event.at || (event as Record<string, unknown>).created_at as string;
                          const isFirst = index === 0;

                          return (
                            <div key={event.id || index} className="relative flex gap-3 pb-5 last:pb-0">
                              {/* Timeline dot */}
                              <div className={cn(
                                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background",
                                isFirst ? display.bgColor : "border-muted bg-muted/30"
                              )}>
                                <span className={cn("flex items-center justify-center", isFirst ? display.color : "text-muted-foreground")}>
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
                                  <span className="text-[11px] text-muted-foreground" title={formatAuditDateTime(eventTime)}>
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
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <VoidEnvelopeDialog 
        open={voidDialogOpen} 
        onOpenChange={setVoidDialogOpen}
        onConfirm={(reason) => {
          if (onVoidEnvelope) {
            onVoidEnvelope(envelope.id, reason);
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