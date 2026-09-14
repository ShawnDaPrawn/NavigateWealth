/**
 * Documents step — step 1 of the send-for-signature flow.
 *
 * Content only: the heading, the progress rail and the Back/Continue bar all
 * belong to `EsignWizardShell`, so this step renders the same way from the
 * standalone module and from the client drawer's E-Sign tab.
 *
 * Controlled, because both callers already keep the same four values in their
 * own wizard state. Holding a second copy here meant the parent could not tell
 * whether Continue should be enabled, so it stayed enabled and failed loudly
 * after the click. The parent now derives that from `documentStepBlocker`.
 */

import React, { useCallback, useId, useMemo, useState } from 'react';
import { AlertCircle, FileText, Settings2, Upload, XCircle } from 'lucide-react';

import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Button } from '../../../../ui/button';
import { cn } from '../../../../ui/utils';
import { EsignWizardSection } from './wizard';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '../constants';
import {
  MAX_ENVELOPE_MESSAGE_LENGTH,
  MAX_EXPIRY_DAYS,
  MIN_EXPIRY_DAYS,
  isValidExpiry,
  type DocumentUploadValue,
} from './documentStepModel';

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface DocumentUploadStepProps {
  value: DocumentUploadValue;
  onChange: (next: DocumentUploadValue) => void;
  disabled?: boolean;
}

export function DocumentUploadStep({ value, onChange, disabled = false }: DocumentUploadStepProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  const { files, title, message, expiryDays } = value;

  const patch = useCallback(
    (next: Partial<DocumentUploadValue>) => onChange({ ...value, ...next }),
    [onChange, value],
  );

  const handleDrag = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
      else if (e.type === 'dragleave') setDragActive(false);
    },
    [disabled],
  );

  const processFiles = useCallback(
    (incoming: File[]) => {
      const rejected: string[] = [];
      const accepted: File[] = [];

      for (const file of incoming) {
        if (!(ALLOWED_FILE_TYPES as readonly string[]).includes(file.type)) {
          rejected.push(`${file.name} is not a PDF`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          rejected.push(`${file.name} is larger than ${MAX_FILE_SIZE_MB}MB`);
          continue;
        }
        if (files.some((existing) => existing.name === file.name && existing.size === file.size)) {
          rejected.push(`${file.name} was already added`);
          continue;
        }
        accepted.push(file);
      }

      setError(rejected.length > 0 ? rejected.join(' · ') : null);

      if (accepted.length === 0) return;

      // First file names the envelope when the user has not titled it yet —
      // one less thing to type for the common single-document send.
      const nextTitle = title.trim() ? title : accepted[0].name.replace(/\.pdf$/i, '');
      patch({ files: [...files, ...accepted], title: nextTitle });
    },
    [files, patch, title],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (disabled) return;
      if (e.dataTransfer.files?.length) processFiles(Array.from(e.dataTransfer.files));
    },
    [disabled, processFiles],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFiles(Array.from(e.target.files));
    // Let the same file be re-picked after a removal.
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    patch({ files: files.filter((_, i) => i !== index) });
    setError(null);
  };

  const expiryDate = useMemo(() => {
    if (!Number.isFinite(expiryDays) || expiryDays < MIN_EXPIRY_DAYS) return null;
    return new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [expiryDays]);

  const expiryInvalid = !isValidExpiry(expiryDays);

  return (
    <div className="space-y-6">
      <EsignWizardSection
        icon={Upload}
        title="Documents"
        description={`PDF only, up to ${MAX_FILE_SIZE_MB}MB each. Add more than one and they are signed as a single envelope.`}
        action={
          files.length > 0 ? (
            <span className="text-xs font-medium text-gray-500">
              {files.length} file{files.length === 1 ? '' : 's'}
            </span>
          ) : undefined
        }
      >
        <div
          className={cn(
            'relative rounded-xl border-2 border-dashed p-8 text-center transition-colors',
            dragActive
              ? 'border-purple-400 bg-purple-50'
              : 'border-gray-200 bg-gray-50/60 hover:border-purple-300 hover:bg-purple-50/40',
            disabled && 'pointer-events-none opacity-60',
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={handleFileSelect}
            className="sr-only"
            id={inputId}
            disabled={disabled}
          />
          <label htmlFor={inputId} className="block cursor-pointer space-y-3">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600">
              <Upload className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="block text-sm font-medium text-gray-900">
              Drop PDFs here, or <span className="text-purple-700 underline">browse</span>
            </span>
            <span className="block text-xs text-gray-500">
              {files.length > 0
                ? 'Everything you add is signed together, in the order listed below.'
                : `One or more PDFs, each up to ${MAX_FILE_SIZE_MB}MB.`}
            </span>
          </label>
        </div>

        {files.length > 0 && (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center justify-between gap-3 bg-white p-3 transition-colors hover:bg-gray-50/70"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-50 text-[10px] font-bold text-red-600">
                    PDF
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {file.name}
                    </span>
                    <span className="block text-xs text-gray-500">{formatSize(file.size)}</span>
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 text-gray-400 hover:text-red-600"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </EsignWizardSection>

      <EsignWizardSection
        icon={FileText}
        title="Envelope details"
        description="What recipients see in the invitation email."
      >
        <div className="space-y-2">
          <Label htmlFor="esign-envelope-title">Envelope title</Label>
          <Input
            id="esign-envelope-title"
            placeholder="e.g. Discretionary mandate — M. Dlamini"
            value={title}
            disabled={disabled}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="esign-envelope-message">Message to recipients</Label>
            <span className="text-xs text-gray-400">Optional</span>
          </div>
          <Textarea
            id="esign-envelope-message"
            placeholder="Please review and sign by the end of the week. Reply here if anything looks off."
            value={message}
            rows={3}
            maxLength={MAX_ENVELOPE_MESSAGE_LENGTH}
            disabled={disabled}
            onChange={(e) => patch({ message: e.target.value })}
          />
          <p className="text-right text-xs text-gray-400">
            {message.length}/{MAX_ENVELOPE_MESSAGE_LENGTH}
          </p>
        </div>
      </EsignWizardSection>

      <EsignWizardSection
        icon={Settings2}
        title="Expiry"
        description="After this, the signing link stops working and the envelope is marked expired."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2 sm:w-40">
            <Label htmlFor="esign-envelope-expiry">Days to expire</Label>
            <Input
              id="esign-envelope-expiry"
              type="number"
              inputMode="numeric"
              min={MIN_EXPIRY_DAYS}
              max={MAX_EXPIRY_DAYS}
              value={Number.isFinite(expiryDays) ? expiryDays : ''}
              disabled={disabled}
              aria-invalid={expiryInvalid || undefined}
              onChange={(e) => patch({ expiryDays: parseInt(e.target.value, 10) })}
              className={cn(expiryInvalid && 'border-red-300 focus-visible:ring-red-200')}
            />
          </div>
          <p className="pb-2 text-sm text-gray-500">
            {expiryInvalid
              ? `Choose between ${MIN_EXPIRY_DAYS} and ${MAX_EXPIRY_DAYS} days.`
              : `Expires on ${expiryDate}.`}
          </p>
        </div>
      </EsignWizardSection>
    </div>
  );
}
