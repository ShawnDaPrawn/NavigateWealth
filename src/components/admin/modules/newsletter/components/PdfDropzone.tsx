/**
 * Newsletter — the PDF input.
 *
 * Drag a PDF in or browse for one. Checks the type and the 5 MB cap locally
 * so the admin hears about a problem before the upload starts; the server
 * checks the bytes again. Shows the stored file once there is one, with a
 * preview link and a replace action.
 */
import { useId, useRef, useState, type DragEvent } from 'react';
import { ExternalLink, FileText, Loader2, RefreshCw, UploadCloud } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { cn } from '../../../../ui/utils';
import { MAX_PDF_LABEL } from '../constants';
import type { NewsletterPdf } from '../types';
import { formatRelative } from '../utils/format';
import { formatFileSize, pdfFileProblem } from '../utils/pdf';

export function PdfDropzone({
  stored,
  pending,
  onSelect,
  onPreview,
  disabled,
  error,
}: {
  /** The PDF already stored on the newsletter, if any. */
  stored: NewsletterPdf | null;
  /** True while an upload is in flight. */
  pending?: boolean;
  onSelect: (file: File) => void;
  /** Opens the stored PDF in a new tab; absent while nothing is stored. */
  onPreview?: () => void;
  disabled?: boolean;
  /** A server-side rejection to show under the control. */
  error?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const choose = (file: File | undefined) => {
    if (!file) return;
    const problem = pdfFileProblem(file);
    setLocalError(problem);
    if (!problem) onSelect(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled || pending) return;
    choose(event.dataTransfer.files?.[0]);
  };

  const shownError = localError ?? error ?? null;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={disabled || pending}
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {stored ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
            <FileText className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{stored.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(stored.sizeBytes)} · uploaded {formatRelative(stored.uploadedAt)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {onPreview ? (
              <Button type="button" variant="outline" size="sm" onClick={onPreview}>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Preview
              </Button>
            ) : null}
            {!disabled ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                )}
                Replace
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || pending}
          aria-label="Upload the newsletter PDF"
          onClick={() => !disabled && !pending && inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (!disabled && !pending) inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled && !pending) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
            dragging
              ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/20'
              : 'border-border hover:border-purple-300 hover:bg-muted/30',
            (disabled || pending) && 'cursor-not-allowed opacity-60',
          )}
        >
          {pending ? (
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-purple-600" aria-hidden />
          ) : (
            <UploadCloud className="mb-3 h-8 w-8 text-purple-600" aria-hidden />
          )}
          <p className="text-sm font-medium">
            {pending ? 'Uploading…' : 'Drop the newsletter PDF here, or click to browse'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">PDF only, up to {MAX_PDF_LABEL}.</p>
        </div>
      )}
      {shownError ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
