/**
 * SubmissionDetailModal
 *
 * Centered dialog modal for viewing a single submission — matches the
 * TaskFormModal pattern (Dialog, max-w-4xl, clean white header, structured
 * two-column layout on desktop).
 *
 * Replaces the old SubmissionDetailDrawer (Sheet-based, squashed right side).
 *
 * Features:
 * - Phase 2 structured detail rendering with sections & tags
 * - Generic fallback for legacy/non-Phase-2 submissions
 * - Status dropdown in header (no timeline, no full-width advance buttons)
 * - Notes editor (saved explicitly)
 * - Branded PDF download (pdf-lib, isolated in submission-pdf-generator.ts)
 *
 * §7 — No business logic in UI; status derivation uses constants.
 * §8 — Design System components throughout.
 * §8.1 — Mirrors TaskFormModal layout pattern.
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../../ui/dialog';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Textarea } from '../../../../ui/textarea';
import { Separator } from '../../../../ui/separator';
import {
  MessageSquare, FileText, Calculator, Download, User,
  Mail, Clock, Globe, Trash2, Save, Calendar, Phone,
  CheckCircle2, AlertCircle, ChevronDown,
  UserPlus, ExternalLink, ClipboardList,
} from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { toast } from 'sonner@2.0.3';
import type { Submission, SubmissionStatus, SubmissionType } from '../types';
import {
  SUBMISSION_STATUS_CONFIG,
  SUBMISSION_TYPE_CONFIG,
  SOURCE_CHANNEL_LABELS,
} from '../constants';
import { Phase2DetailRenderer, isPhase2Payload, getPhase2Data } from './Phase2DetailRenderer';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubmissionDetailModalProps {
  submission: Submission | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: SubmissionStatus) => Promise<unknown>;
  onNotesChange: (id: string, notes: string) => Promise<unknown>;
  onDelete: (id: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-ZA', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function TypeIcon({ type, className }: { type: SubmissionType; className?: string }) {
  const c = className || 'h-4 w-4';
  switch (type) {
    case 'will_draft':     return <FileText className={c} />;
    case 'tax_planning':   return <Calculator className={c} />;
    case 'consultation':   return <Calendar className={c} />;
    case 'contact':        return <Mail className={c} />;
    case 'client_signup':  return <UserPlus className={c} />;
    case 'quote':
    default:               return <MessageSquare className={c} />;
  }
}

/**
 * Formats a payload key from machine-readable to human-readable.
 */
function formatPayloadKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '\u2014';
    if (value.every(v => typeof v === 'string')) return value.join(', ');
    if (value.every(v => typeof v === 'object' && v !== null && ('dob' in v || 'age' in v))) {
      return value.map((child, i) => {
        const c = child as Record<string, unknown>;
        if (c.dob) {
          try {
            return `Child ${i + 1}: ${new Date(String(c.dob)).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}`;
          } catch { return `Child ${i + 1}: ${c.dob}`; }
        }
        return `Child ${i + 1}: Age ${c.age}`;
      }).join(', ');
    }
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/** Keys to skip entirely — shown elsewhere or internal references */
const SKIP_KEYS = new Set([
  'quoteRequestId', 'contactFormId', 'consultationId', 'parentSubmissionId',
]);

/** Keys to skip in Phase 2 payloads (productDetails is rendered separately) */
const PHASE2_TOP_SKIP = new Set([
  ...SKIP_KEYS,
  'productDetails',
]);

/**
 * Flatten payload entries for display.
 */
function flattenPayload(
  payload: Record<string, unknown>,
  skipKeys: Set<string> = SKIP_KEYS,
): Array<{
  key: string;
  label: string;
  value: string;
  group?: string;
}> {
  const result: Array<{ key: string; label: string; value: string; group?: string }> = [];

  function recurse(
    obj: Record<string, unknown>,
    keyPath: string,
    group: string | undefined,
    depth: number,
  ) {
    for (const [key, value] of Object.entries(obj)) {
      if (depth === 0 && skipKeys.has(key)) continue;

      const fullKey = keyPath ? `${keyPath}.${key}` : key;
      const label = formatPayloadKey(key);
      const effectiveGroup = group ?? (depth > 0 ? formatPayloadKey(keyPath.split('.').pop() || keyPath) : undefined);

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        depth < 3
      ) {
        const vObj = value as Record<string, unknown>;
        if ('selected' in vObj && 'adviser_assist' in vObj) {
          if (vObj.selected) {
            const coverLabel = formatPayloadKey(key);
            let coverValue = '';
            if (vObj.adviser_assist) {
              coverValue = 'Adviser assistance requested';
            } else {
              const amt = vObj.amount ?? vObj.amount_per_month ?? null;
              const suffix = vObj.amount_per_month !== undefined ? ' /month' : '';
              coverValue = amt
                ? `R${Math.round(Number(amt)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${suffix}`
                : 'Amount not specified';
            }
            result.push({ key: fullKey, label: coverLabel, value: coverValue, group: effectiveGroup });
          }
          continue;
        }

        recurse(vObj, fullKey, effectiveGroup ?? label, depth + 1);
      } else {
        result.push({ key: fullKey, label, value: formatPayloadValue(value), group: effectiveGroup });
      }
    }
  }

  recurse(payload, '', undefined, 0);
  return result;
}

// ── Non-Phase-2 Detail Fields Renderer ────────────────────────────────────────

function getTopLevelFields(payload: Record<string, unknown>, isP2: boolean) {
  const skipSet = isP2 ? PHASE2_TOP_SKIP : SKIP_KEYS;
  return flattenPayload(payload, skipSet);
}

// ── Status Config ─────────────────────────────────────────────────────────────

const STATUS_ORDER: SubmissionStatus[] = ['new', 'pending', 'completed', 'archived'];

// ── PDF Download (Isolated — pdf-lib loaded in separate chunk) ────────────────
// The PDF generator is in its own file to isolate the pdf-lib dependency.
// This prevents pdf-lib resolution failures from breaking the module chunk.

async function downloadAsPdf(submission: Submission): Promise<void> {
  const { downloadSubmissionAsPdf } = await import('./submission-pdf-generator');
  return downloadSubmissionAsPdf(submission);
}

// ── Status Dropdown (simple, muted) ───────────────────────────────────────────

function StatusDropdown({
  current,
  onSelect,
  disabled,
}: {
  current: SubmissionStatus;
  onSelect: (status: SubmissionStatus) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const currentCfg = SUBMISSION_STATUS_CONFIG[current];

  // Muted dot colour per status (not the garish badge colours)
  const DOT_COLORS: Record<SubmissionStatus, string> = {
    new: 'bg-blue-500',
    pending: 'bg-amber-500',
    completed: 'bg-green-500',
    archived: 'bg-gray-400',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border border-gray-200',
          'bg-white text-gray-700 hover:bg-gray-50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', DOT_COLORS[current])} />
        {currentCfg.label}
        <ChevronDown className={cn('h-3 w-3 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="contents">
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[150px]">
            {STATUS_ORDER.map((status) => {
              const cfg = SUBMISSION_STATUS_CONFIG[status];
              const isCurrent = status === current;
              return (
                <button
                  key={status}
                  onClick={() => {
                    if (!isCurrent) onSelect(status);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors',
                    isCurrent
                      ? 'bg-gray-50 text-gray-900 cursor-default'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full', DOT_COLORS[status])} />
                  {cfg.label}
                  {isCurrent && (
                    <CheckCircle2 className="h-3 w-3 text-gray-400 ml-auto" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SubmissionDetailModal({
  submission,
  open,
  onClose,
  onStatusChange,
  onNotesChange,
  onDelete,
}: SubmissionDetailModalProps) {
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const navigate = useNavigate();

  // Sync local notes with submission when it changes
  React.useEffect(() => {
    setNotes(submission?.notes ?? '');
  }, [submission?.id, submission?.notes]);

  const handleSaveNotes = useCallback(async () => {
    if (!submission) return;
    setSavingNotes(true);
    const result = await onNotesChange(submission.id, notes) as { success: boolean };
    setSavingNotes(false);
    if (result?.success) toast.success('Notes saved');
    else toast.error('Failed to save notes');
  }, [submission, notes, onNotesChange]);

  const handleStatusChange = useCallback(async (status: SubmissionStatus) => {
    if (!submission) return;
    setAdvancing(true);
    await onStatusChange(submission.id, status);
    setAdvancing(false);
  }, [submission, onStatusChange]);

  const handleDownload = useCallback(async () => {
    if (!submission) return;
    setDownloading(true);
    try {
      await downloadAsPdf(submission);
      toast.success('PDF downloaded');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  }, [submission]);

  if (!submission) return null;

  const typeCfg = SUBMISSION_TYPE_CONFIG[submission.type];
  const phone = submission.payload.phone as string | undefined;

  const isP2 = isPhase2Payload(submission.payload);
  const phase2Data = getPhase2Data(submission.payload);
  const topLevelFields = getTopLevelFields(submission.payload, isP2);

  // Derive service name for display
  const serviceName = submission.payload.productName
    ? String(submission.payload.productName)
    : submission.payload.service
      ? String(submission.payload.service).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : null;

  return (
    <div className="contents">
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-4xl h-[85vh] p-0 gap-0 overflow-hidden bg-white flex flex-col" hideCloseButton>
          {/* ── Clean White Header ── */}
          <div className="px-6 py-4 border-b flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                <TypeIcon type={submission.type} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">
                  {typeCfg.label}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400 mt-0.5">
                  {submission.submitterName || 'Unknown'} &middot; {formatDate(submission.submittedAt)}
                </DialogDescription>
              </div>
            </div>
            <StatusDropdown
              current={submission.status}
              onSelect={handleStatusChange}
              disabled={advancing}
            />
          </div>

          {/* ── Scrollable Content ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 md:p-8 space-y-6">

              {/* ── Contact Information ── */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Contact Information
                </h4>
                <div className="bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100">
                  {submission.submitterName && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-900">{submission.submitterName}</span>
                    </div>
                  )}
                  {submission.submitterEmail && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <a
                        href={`mailto:${submission.submitterEmail}`}
                        className="text-sm text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {submission.submitterEmail}
                      </a>
                    </div>
                  )}
                  {phone && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <a
                        href={`tel:${phone}`}
                        className="text-sm text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {phone}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-600 font-medium">
                        {SOURCE_CHANNEL_LABELS[submission.sourceChannel] ?? submission.sourceChannel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDate(submission.submittedAt)}
                    </div>
                  </div>
                </div>
              </section>

              <Separator />

              {/* ── Client Signup Actions CTA ── */}
              {submission.type === 'client_signup' && (
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Actions
                  </h4>
                  <div className="bg-violet-50 rounded-xl border border-violet-100 p-4 space-y-3">
                    <p className="text-sm text-gray-700">
                      A new client has signed up and their application is in <strong className="font-semibold">{String(submission.payload.applicationStatus || 'draft')}</strong> status.
                      You can view their application in the Applications module, or wait for the client to log in and complete it themselves.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                        onClick={() => {
                          onClose();
                          navigate('/admin?module=applications');
                        }}
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                        View in Applications
                      </Button>
                      {submission.payload.userId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50"
                          onClick={() => {
                            onClose();
                            navigate(`/admin?module=clients&clientId=${submission.payload.userId}`);
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open Client Profile
                        </Button>
                      )}
                    </div>
                    {submission.payload.applicationNumber && (
                      <p className="text-xs text-gray-500">
                        Application #{String(submission.payload.applicationNumber)} &middot; {String(submission.payload.accountType || 'Personal Client')}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {submission.type === 'client_signup' && <Separator />}

              {/* ── Submission Details ── */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Submission Details
                </h4>

                {/* Service / product context — muted badges */}
                {(serviceName || submission.payload.stage) && (
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {serviceName && (
                      <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700 border-gray-200">
                        {serviceName}
                      </Badge>
                    )}
                    {submission.payload.stage && (
                      <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600 border-gray-200">
                        {submission.payload.stage === 'full' ? 'Full Quote' : 'Initial Enquiry'}
                      </Badge>
                    )}
                    {isP2 && (
                      <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600 border-gray-200">
                        Phase 2
                      </Badge>
                    )}
                  </div>
                )}

                {/* Top-level fields */}
                {topLevelFields.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50 mb-4">
                    {topLevelFields.map((entry) => (
                      <div key={entry.key} className="flex justify-between items-start px-4 py-2.5 gap-4">
                        <span className="text-xs font-medium text-gray-500 min-w-[100px] flex-shrink-0 pt-0.5">
                          {entry.label}
                        </span>
                        <span className="text-sm text-gray-900 text-right break-words font-medium">
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Phase 2 structured rendering */}
                {isP2 && phase2Data && (
                  <Phase2DetailRenderer productDetails={phase2Data} />
                )}

                {/* Non-Phase-2 generic rendering — empty state */}
                {!isP2 && topLevelFields.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
                    <AlertCircle className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">
                      No submission fields recorded.
                    </p>
                  </div>
                )}
              </section>

              <Separator />

              {/* ── Internal Notes ── */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Internal Notes
                </h4>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add internal notes visible only to admin staff\u2026"
                  className="resize-none min-h-[100px] text-sm rounded-xl"
                  rows={4}
                />
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveNotes}
                    disabled={savingNotes || notes === (submission.notes ?? '')}
                    className="gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingNotes ? 'Saving\u2026' : 'Save Notes'}
                  </Button>
                </div>
              </section>
            </div>
          </div>

          {/* ── Footer Actions ── */}
          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-3 bg-white shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
              onClick={() => {
                onClose();
                onDelete(submission.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              disabled={downloading}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? 'Generating\u2026' : 'Download PDF'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}