/**
 * SubmissionPage
 *
 * One submission as a page of its own (design system: records are pages),
 * opened from the board or the archive and kept in the address
 * (?type=<type>&id=<id>). The header carries the status picker beside the
 * title, Archive, a ⋯ menu with Delete and the primary "Mark completed".
 *
 * Features kept from the old detail dialog:
 * - Phase 2 structured detail rendering with sections & tags
 * - Generic fallback for legacy/non-Phase-2 submissions
 * - Internal notes (saved explicitly)
 * - Branded PDF download (pdf-lib, isolated in submission-pdf-generator.ts)
 * - Client signup: View in Applications / Open client profile
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Textarea } from '../../../../ui/textarea';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { toast } from 'sonner';
import type { Submission, SubmissionStatus } from '../types';
import {
  SUBMISSION_STATUS_CONFIG,
  SUBMISSION_TYPE_CONFIG,
  SOURCE_CHANNEL_LABELS,
} from '../constants';
import { Phase2DetailRenderer, isPhase2Payload, getPhase2Data } from './Phase2DetailRenderer';
import { useConfirm } from '../../../layout/page';
import { BackLink } from '../../../layout/page/FilterControls';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubmissionPageProps {
  submission: Submission;
  /** Leaves the page (back to the board or the archive). */
  onClose: () => void;
  /** Where "Back to …" goes, e.g. "board". */
  backLabel?: string;
  onStatusChange: (id: string, status: SubmissionStatus) => Promise<unknown>;
  onNotesChange: (id: string, notes: string) => Promise<unknown>;
  /** Deletes the submission; the page asks first. */
  onDelete: (id: string) => Promise<unknown> | void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Formats a payload key from machine-readable to human-readable.
 */
function formatPayloadKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '\u2014';
    if (value.every((v) => typeof v === 'string')) return value.join(', ');
    if (value.every((v) => typeof v === 'object' && v !== null && ('dob' in v || 'age' in v))) {
      return value
        .map((child, i) => {
          const c = child as Record<string, unknown>;
          if (c.dob) {
            try {
              return `Child ${i + 1}: ${new Date(String(c.dob)).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}`;
            } catch {
              return `Child ${i + 1}: ${c.dob}`;
            }
          }
          return `Child ${i + 1}: Age ${c.age}`;
        })
        .join(', ');
    }
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/** Keys to skip entirely — shown elsewhere or internal references */
const SKIP_KEYS = new Set([
  'quoteRequestId',
  'contactFormId',
  'consultationId',
  'parentSubmissionId',
]);

/** Keys to skip in Phase 2 payloads (productDetails is rendered separately) */
const PHASE2_TOP_SKIP = new Set([...SKIP_KEYS, 'productDetails']);

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
      const effectiveGroup =
        group ?? (depth > 0 ? formatPayloadKey(keyPath.split('.').pop() || keyPath) : undefined);

      if (value !== null && typeof value === 'object' && !Array.isArray(value) && depth < 3) {
        const vObj = value as Record<string, unknown>;
        if ('selected' in vObj && 'adviser_assist' in vObj) {
          if (vObj.selected) {
            const coverLabel = formatPayloadKey(key);
            let coverValue: string;
            if (vObj.adviser_assist) {
              coverValue = 'Adviser assistance requested';
            } else {
              const amt = vObj.amount ?? vObj.amount_per_month ?? null;
              const suffix = vObj.amount_per_month !== undefined ? ' /month' : '';
              coverValue = amt
                ? `R${Math.round(Number(amt))
                    .toString()
                    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${suffix}`
                : 'Amount not specified';
            }
            result.push({
              key: fullKey,
              label: coverLabel,
              value: coverValue,
              group: effectiveGroup,
            });
          }
          continue;
        }

        recurse(vObj, fullKey, effectiveGroup ?? label, depth + 1);
      } else {
        result.push({
          key: fullKey,
          label,
          value: formatPayloadValue(value),
          group: effectiveGroup,
        });
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

const STATUS_DOT: Record<SubmissionStatus, string> = {
  new: 'bg-blue-500',
  pending: 'bg-amber-500',
  completed: 'bg-green-500',
  archived: 'bg-gray-400',
};

// ── PDF Download (Isolated — pdf-lib loaded in separate chunk) ────────────────
// The PDF generator is in its own file to isolate the pdf-lib dependency.
// This prevents pdf-lib resolution failures from breaking the module chunk.

async function downloadAsPdf(submission: Submission): Promise<void> {
  const { downloadSubmissionAsPdf } = await import('./submission-pdf-generator');
  return downloadSubmissionAsPdf(submission);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="min-w-[120px] shrink-0 pt-0.5 text-xs font-medium text-nw-text-3">{label}</dt>
      <dd className="text-right text-sm font-medium break-words text-nw-ink">{children}</dd>
    </div>
  );
}

/** The submission's id, shortened for the header ("SUB-•••8f21"). */
function shortSubmissionId(id: string): string {
  return `SUB-•••${id.slice(-4)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SubmissionPage({
  submission,
  onClose,
  backLabel = 'board',
  onStatusChange,
  onNotesChange,
  onDelete,
}: SubmissionPageProps) {
  const [notes, setNotes] = useState(submission.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirm();

  // Sync local notes with the submission when it changes
  React.useEffect(() => {
    setNotes(submission.notes ?? '');
  }, [submission.id, submission.notes]);

  const handleSaveNotes = useCallback(async () => {
    setSavingNotes(true);
    const result = (await onNotesChange(submission.id, notes)) as { success: boolean };
    setSavingNotes(false);
    if (result?.success) toast.success('Notes saved');
    else toast.error('Failed to save notes');
  }, [submission.id, notes, onNotesChange]);

  const handleStatusChange = useCallback(
    async (status: SubmissionStatus) => {
      if (status === submission.status) return;
      setAdvancing(true);
      await onStatusChange(submission.id, status);
      setAdvancing(false);
    },
    [submission.id, submission.status, onStatusChange],
  );

  const handleDownload = useCallback(async () => {
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

  const handleDelete = useCallback(async () => {
    const ok = await confirm({
      title: 'Delete submission?',
      description: 'This permanently deletes the submission. This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await onDelete(submission.id);
  }, [confirm, onDelete, submission.id]);

  const typeCfg = SUBMISSION_TYPE_CONFIG[submission.type];
  const phone = submission.payload.phone as string | undefined;
  const isSignup = submission.type === 'client_signup';
  const isArchived = submission.status === 'archived';
  const isCompleted = submission.status === 'completed';

  const isP2 = isPhase2Payload(submission.payload);
  const phase2Data = getPhase2Data(submission.payload);
  const topLevelFields = getTopLevelFields(submission.payload, isP2);

  // Derive service name for display
  const serviceName = submission.payload.productName
    ? String(submission.payload.productName)
    : submission.payload.service
      ? String(submission.payload.service)
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : null;

  const statusOptions: SubmissionStatus[] = isArchived
    ? ['new', 'pending', 'completed', 'archived']
    : ['new', 'pending', 'completed'];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 p-6 lg:p-8">
      <BackLink label={`Back to ${backLabel}`} onClick={onClose} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight break-words text-nw-ink">
            {submission.submitterName || 'Unknown submitter'}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-nw-text-3">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-nw-text-2">
              {typeCfg.label}
            </span>
            <span>
              Submitted {formatDate(submission.submittedAt)} · {shortSubmissionId(submission.id)}
            </span>
            <Select
              value={submission.status}
              onValueChange={(v) => void handleStatusChange(v as SubmissionStatus)}
              disabled={advancing}
            >
              <SelectTrigger aria-label="Status" className="h-8 w-[150px] bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])}
                        aria-hidden="true"
                      />
                      {SUBMISSION_STATUS_CONFIG[status].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {!isArchived && (
            <Button
              variant="outline"
              onClick={() => void handleStatusChange('archived')}
              disabled={advancing}
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
              Archive
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More submission actions">
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onSelect={() => void handleDelete()}
                className="text-red-600 focus:bg-red-50 focus:text-red-700"
              >
                Delete…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {!isCompleted && !isArchived && (
            <Button onClick={() => void handleStatusChange('completed')} disabled={advancing}>
              {advancing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              )}
              Mark completed
            </Button>
          )}
        </div>
      </div>

      <div className="flex max-w-[880px] flex-col gap-5">
        {/* ── Who sent it ── */}
        <section className="rounded-xl border border-nw-line bg-white">
          <dl className="divide-y divide-nw-line-2">
            {submission.submitterEmail && (
              <Row label="Email">
                <a
                  href={`mailto:${submission.submitterEmail}`}
                  className="text-nw-violet-600 hover:underline"
                >
                  {submission.submitterEmail}
                </a>
              </Row>
            )}
            {phone && (
              <Row label="Phone">
                <a href={`tel:${phone}`} className="text-nw-violet-600 hover:underline">
                  {phone}
                </a>
              </Row>
            )}
            {isSignup && (
              <Row label="Account type">
                {String(submission.payload.accountType || 'Personal client')}
              </Row>
            )}
            {isSignup && !!submission.payload.applicationNumber && (
              <Row label="Application">
                {String(submission.payload.applicationNumber)} ·{' '}
                {String(submission.payload.applicationStatus || 'draft')}
              </Row>
            )}
            <Row label="Source">
              {SOURCE_CHANNEL_LABELS[submission.sourceChannel] ?? submission.sourceChannel}
            </Row>
          </dl>
          <div className="flex flex-wrap gap-2 border-t border-nw-line-2 px-4 py-3">
            {isSignup && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/admin?module=applications')}
              >
                <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                View in Applications
              </Button>
            )}
            {isSignup && !!submission.payload.userId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  navigate(`/admin?module=clients&clientId=${submission.payload.userId}`)
                }
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Open client profile
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleDownload()}
              disabled={downloading}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {downloading ? 'Generating…' : 'Download PDF'}
            </Button>
          </div>
        </section>

        {/* ── What they sent ── */}
        <section className="space-y-3 rounded-xl border border-nw-line bg-white p-4">
          <h2 className="text-sm font-semibold text-nw-ink">What they sent</h2>
          {(serviceName || !!submission.payload.stage || isP2) && (
            <div className="flex flex-wrap items-center gap-2">
              {serviceName && (
                <Badge
                  variant="secondary"
                  className="border-gray-200 bg-gray-100 text-xs text-gray-700"
                >
                  {serviceName}
                </Badge>
              )}
              {!!submission.payload.stage && (
                <Badge
                  variant="secondary"
                  className="border-gray-200 bg-gray-100 text-xs text-gray-600"
                >
                  {submission.payload.stage === 'full' ? 'Full quote' : 'Initial enquiry'}
                </Badge>
              )}
              {isP2 && (
                <Badge
                  variant="secondary"
                  className="border-gray-200 bg-gray-100 text-xs text-gray-600"
                >
                  Phase 2
                </Badge>
              )}
            </div>
          )}

          {topLevelFields.length > 0 && (
            <dl className="divide-y divide-nw-line-2 rounded-lg border border-nw-line-2">
              {topLevelFields.map((entry) => (
                <Row key={entry.key} label={entry.label}>
                  {entry.value}
                </Row>
              ))}
            </dl>
          )}

          {isP2 && phase2Data && <Phase2DetailRenderer productDetails={phase2Data} />}

          {!isP2 && topLevelFields.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
              <AlertCircle className="mx-auto mb-2 h-6 w-6 text-gray-300" aria-hidden="true" />
              <p className="text-sm text-nw-text-3">No submission fields recorded.</p>
            </div>
          )}
        </section>

        {/* ── Internal notes ── */}
        <section className="space-y-2 rounded-xl border border-nw-line bg-white p-4">
          <Label htmlFor="submission-notes" className="text-sm font-semibold text-nw-ink">
            Internal notes
          </Label>
          <Textarea
            id="submission-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes visible only to admin staff…"
            className="min-h-[100px] resize-y text-sm"
            rows={4}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleSaveNotes()}
              disabled={savingNotes || notes === (submission.notes ?? '')}
            >
              {savingNotes ? 'Saving…' : 'Save notes'}
            </Button>
          </div>
        </section>
      </div>

      {confirmDialog}
    </div>
  );
}
