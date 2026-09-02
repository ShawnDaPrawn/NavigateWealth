import { useState } from 'react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Textarea } from '../../../../ui/textarea';
import {
  AlertTriangle,
  Check,
  FileText,
  Files,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { DocumentSummary, SummaryEditDraft } from './documents/summaryTypes';
import {
  analysedCoverage,
  formatSummaryDate,
  linesToList,
  listToLines,
  toEditDraft,
} from './documents/summaryFormat';

interface DocumentSummaryEntryProps {
  summary: DocumentSummary;
  /** Server's answer — super admin only. Never derived in the browser. */
  canEdit: boolean;
  canRegenerate: boolean;
  busy: boolean;
  onSave: (summaryId: string, edit: SummaryEditDraft) => Promise<void>;
  onDelete: (summary: DocumentSummary) => void;
  onRegenerate: (summary: DocumentSummary) => void;
}

/**
 * One entry on the client's document timeline: what a batch of documents was,
 * and what it shows was done.
 *
 * The edit form is inline rather than a dialog — a correction is usually one
 * word in the summary, and a modal makes that feel heavier than it is.
 */
export function DocumentSummaryEntry({
  summary,
  canEdit,
  canRegenerate,
  busy,
  onSave,
  onDelete,
  onRegenerate,
}: DocumentSummaryEntryProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SummaryEditDraft>(() => toEditDraft(summary));
  const [saving, setSaving] = useState(false);

  const failed = summary.status === 'failed';
  const coverage = analysedCoverage(summary);

  const startEditing = () => {
    setDraft(toEditDraft(summary));
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(summary.id, draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative pl-8">
      {/* Timeline rail marker */}
      <span
        aria-hidden="true"
        className={`absolute left-[11px] top-5 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white ${
          failed ? 'bg-red-500' : summary.edited ? 'bg-violet-500' : 'bg-blue-500'
        }`}
      />

      <div
        className={`rounded-lg border p-4 transition-colors ${
          failed ? 'border-red-200 bg-red-50/40' : 'hover:border-gray-300'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {formatSummaryDate(summary.documentDate)}
              </span>

              <Badge variant="secondary" className="text-xs">
                <span className="flex items-center gap-1">
                  {summary.scope === 'pack' ? (
                    <Files className="h-3 w-3" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {summary.documentCount} {summary.documentCount === 1 ? 'file' : 'files'}
                </span>
              </Badge>

              {summary.edited ? (
                <Badge className="bg-violet-100 text-violet-800 text-xs">Edited</Badge>
              ) : (
                <Badge className="bg-blue-50 text-blue-700 text-xs">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI
                  </span>
                </Badge>
              )}

              {summary.source === 'scheduled' && (
                <Badge variant="outline" className="text-xs">
                  Weekly scan
                </Badge>
              )}

              {failed && <Badge className="bg-red-100 text-red-800 text-xs">Failed</Badge>}
            </div>

            {editing ? (
              <Input
                value={draft.headline}
                onChange={(event) => setDraft({ ...draft, headline: event.target.value })}
                aria-label="Summary headline"
                className="mb-2"
              />
            ) : (
              <h4 className="font-medium leading-snug">{summary.headline}</h4>
            )}

            <p className="mt-0.5 truncate text-xs text-muted-foreground">{summary.title}</p>
          </div>

          {!editing && (
            <div className="flex flex-shrink-0 items-center gap-1">
              {canRegenerate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={busy}
                  onClick={() => onRegenerate(summary)}
                  title="Regenerate this summary"
                >
                  <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                </Button>
              )}
              {canEdit && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={startEditing}
                    title="Edit summary"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    onClick={() => onDelete(summary)}
                    title="Delete summary"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-3 space-y-3">
            <div>
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor={`summary-body-${summary.id}`}
              >
                Summary
              </label>
              <Textarea
                id={`summary-body-${summary.id}`}
                rows={4}
                value={draft.summary}
                onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
              />
            </div>

            <div>
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor={`summary-highlights-${summary.id}`}
              >
                Key points (one per line)
              </label>
              <Textarea
                id={`summary-highlights-${summary.id}`}
                rows={4}
                value={listToLines(draft.highlights)}
                onChange={(event) =>
                  setDraft({ ...draft, highlights: linesToList(event.target.value) })
                }
              />
            </div>

            <div>
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor={`summary-followups-${summary.id}`}
              >
                Follow-ups (one per line)
              </label>
              <Textarea
                id={`summary-followups-${summary.id}`}
                rows={3}
                value={listToLines(draft.followUps)}
                onChange={(event) =>
                  setDraft({ ...draft, followUps: linesToList(event.target.value) })
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving || !draft.summary.trim()}>
                <Check className="mr-2 h-4 w-4" />
                {saving ? 'Saving…' : 'Save summary'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{summary.summary}</p>

            {summary.highlights?.length > 0 && (
              <ul className="mt-3 space-y-1">
                {summary.highlights.map((highlight, index) => (
                  <li
                    key={`${summary.id}-h-${index}`}
                    className="flex gap-2 text-sm text-slate-600"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-slate-400"
                    />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            )}

            {summary.followUps?.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Outstanding
                </p>
                <ul className="space-y-1">
                  {summary.followUps.map((item, index) => (
                    <li key={`${summary.id}-f-${index}`} className="text-sm text-amber-900">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {failed && summary.error && (
              <p className="mt-2 text-xs text-red-700">Reason: {summary.error}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Summarised {formatSummaryDate(summary.generatedAt)}</span>
              {summary.model && <span>· {summary.model}</span>}
              {coverage.partial && (
                <span className="text-amber-700">
                  · {coverage.analysed} of {coverage.total} files read by the AI; the rest are
                  described from their filing details only
                </span>
              )}
              {summary.edited && summary.editedAt && (
                <span>· edited {formatSummaryDate(summary.editedAt)}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
