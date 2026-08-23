/**
 * POLICY DOCUMENT UPLOAD COMPONENT
 *
 * Allows attaching a single policy document (PDF) to a policy line item.
 * One-active-doc-per-policy: uploading a new file replaces the previous one.
 * Phase 2: AI-powered extraction with review panel and field application.
 * Field locking: fields can be locked to prevent AI extraction overwrite.
 *
 * Only available when editing an existing policy (needs a saved policy ID).
 */

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import {
  FileText,
  Upload,
  X,
  ExternalLink,
  Loader2,
  AlertCircle,
  Trash2,
  Sparkles,
  Check,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../utils/api';
import { createClient } from '../../../utils/supabase/client';
import { ExtractionHistoryPanel } from './ExtractionHistoryPanel';
import { PolicyDocumentViewer } from './PolicyDocumentViewer';

/** Document type options matching the server validation */
import {
  DOCUMENT_TYPES,
  formatFileSize,
  formatDocType,
  hasExtractedValue,
  type ExtractionResult,
  type FieldDiff,
  type FieldMappingEntry,
} from './policyDocumentModel';
import { ExtractionReviewPanel } from './ExtractionReviewPanel';

export interface PolicyDocumentMeta {
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  provider: string;
  productType: string;
  documentType: string;
  uploadDate: string;
  uploadedBy: string;
}

/** Extraction result shape from the server */

interface PolicyDocumentUploadProps {
  policyId: string;
  clientId: string;
  /** Existing document metadata (if any) */
  existingDocument?: PolicyDocumentMeta | null;
  /** Existing extraction result (if any) */
  existingExtraction?: ExtractionResult | null;
  /** Existing extraction history entries (if any) */
  existingExtractionHistory?: Array<{ id: string; [key: string]: unknown }>;
  /** Existing locked fields from the policy (if any) */
  existingLockedFields?: string[];
  /** Called after upload/delete/apply so parent can refresh data */
  onDocumentChange?: () => void;
  /** Called when extracted data is applied — passes { fieldId: value } map */
  onApplyExtractedData?: (fieldsToApply: Record<string, unknown>) => void;
}

export function PolicyDocumentUpload({
  policyId,
  clientId,
  existingDocument,
  existingExtraction,
  existingExtractionHistory,
  existingLockedFields,
  onDocumentChange,
  onApplyExtractedData,
}: PolicyDocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('policy_schedule');
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extraction state
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(
    existingExtraction || null,
  );
  const [fieldMappings, setFieldMappings] = useState<FieldMappingEntry[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [showExtractionPanel, setShowExtractionPanel] = useState(false);
  // Phase 3: Change detection diffs from re-extraction
  const [extractionDiffs, setExtractionDiffs] = useState<FieldDiff[]>([]);
  const [showDiffPanel, setShowDiffPanel] = useState(false);

  // Field locking state
  const [lockedFields, setLockedFields] = useState<Set<string>>(
    new Set(existingLockedFields || []),
  );
  const [lockingField, setLockingField] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are accepted');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File exceeds maximum size of 20MB');
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    const toastId = toast.loading(
      existingDocument ? 'Replacing policy document...' : 'Uploading policy document...',
    );

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('policyId', policyId);
      formData.append('clientId', clientId);
      formData.append('documentType', documentType);
      formData.append('uploadedBy', user?.id || 'unknown');

      await api.post('/integrations/policy-documents/upload', formData);

      toast.success(existingDocument ? 'Policy document replaced' : 'Policy document attached', {
        id: toastId,
      });
      setSelectedFile(null);
      // Clear previous extraction since the document changed
      setExtractionResult(null);
      setFieldMappings([]);
      setSelectedFields(new Set());
      onDocumentChange?.();
    } catch (err: unknown) {
      console.error('Policy document upload error:', err);
      toast.error((err as Error)?.message || 'Failed to upload document', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!existingDocument) return;
    setIsDownloading(true);
    try {
      const { url } = await api.get<{ url: string }>(
        `/integrations/policy-documents/download?policyId=${encodeURIComponent(policyId)}&clientId=${encodeURIComponent(clientId)}`,
      );
      window.open(url, '_blank');
    } catch (err: unknown) {
      console.error('Policy document download error:', err);
      toast.error((err as Error)?.message || 'Failed to download document');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingDocument) return;
    setIsDeleting(true);
    const toastId = toast.loading('Removing policy document...');
    try {
      await api.delete('/integrations/policy-documents', {
        body: JSON.stringify({ policyId, clientId }),
      });
      toast.success('Policy document removed', { id: toastId });
      setExtractionResult(null);
      setFieldMappings([]);
      onDocumentChange?.();
    } catch (err: unknown) {
      console.error('Policy document delete error:', err);
      toast.error((err as Error)?.message || 'Failed to remove document', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  // ============================================================================
  // EXTRACTION (Phase 2)
  // ============================================================================

  const handleExtract = async () => {
    setIsExtracting(true);
    setShowExtractionPanel(true);
    const toastId = toast.loading('Extracting policy data with AI... This may take 15-30 seconds.');

    try {
      const data = await api.post<{
        extraction?: ExtractionResult;
        fieldMappings?: FieldMappingEntry[];
        diff?: FieldDiff[];
      }>('/integrations/policy-extraction/extract', { policyId, clientId });
      setExtractionResult(data.extraction ?? null);
      setFieldMappings(data.fieldMappings || []);

      // Phase 3: Capture diffs from re-extraction
      const diffs = (data.diff || []).filter((d: FieldDiff) => d.changed);
      setExtractionDiffs(diffs);
      if (diffs.length > 0) {
        setShowDiffPanel(true);
      }

      // Auto-select high-confidence fields
      const highConfidence = new Set<string>();
      for (const mapping of data.fieldMappings || []) {
        if (mapping.confidence >= 0.85) {
          highConfidence.add(mapping.schemaFieldId);
        }
      }
      setSelectedFields(highConfidence);

      if (data.extraction?.status === 'completed') {
        toast.success(
          `Extraction complete — ${(data.fieldMappings || []).length} fields identified`,
          { id: toastId },
        );
      } else {
        toast.error(data.extraction?.errorMessage || 'Extraction failed', { id: toastId });
      }
      onDocumentChange?.();
    } catch (err: unknown) {
      console.error('Policy extraction error:', err);
      toast.error((err as Error)?.message || 'Extraction failed', { id: toastId });
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleFieldSelection = (fieldId: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  const selectAllFields = () => {
    // Exclude locked fields from "select all"
    setSelectedFields(
      new Set(
        fieldMappings.filter((m) => !lockedFields.has(m.schemaFieldId)).map((m) => m.schemaFieldId),
      ),
    );
  };

  const selectHighConfidenceFields = () => {
    // Exclude locked fields from "select high confidence"
    setSelectedFields(
      new Set(
        fieldMappings
          .filter((m) => m.confidence >= 0.85 && !lockedFields.has(m.schemaFieldId))
          .map((m) => m.schemaFieldId),
      ),
    );
  };

  const handleApplySelected = async () => {
    if (selectedFields.size === 0) {
      toast.error('No fields selected to apply');
      return;
    }

    setIsApplying(true);
    const toastId = toast.loading('Applying extracted data...');

    try {
      const fieldsToApply: Record<string, unknown> = {};

      for (const mapping of fieldMappings) {
        if (selectedFields.has(mapping.schemaFieldId) && hasExtractedValue(mapping.value)) {
          fieldsToApply[mapping.schemaFieldId] = mapping.value;
        }
      }

      if (Object.keys(fieldsToApply).length === 0) {
        toast.error('No extractable field values selected to apply', { id: toastId });
        setIsApplying(false);
        return;
      }

      const result = await api.post<{
        appliedFields?: string[];
        skippedLockedFields?: string[];
      }>('/integrations/policy-extraction/apply', { policyId, clientId, fieldsToApply });
      const appliedCount = result.appliedFields?.length || selectedFields.size;
      const skippedCount = result.skippedLockedFields?.length || 0;

      if (skippedCount > 0) {
        toast.warning(
          `${appliedCount} fields applied, ${skippedCount} locked field${skippedCount > 1 ? 's' : ''} skipped`,
          { id: toastId },
        );
      } else {
        toast.success(`${appliedCount} fields applied to policy`, { id: toastId });
      }

      // Only pass actually applied fields to the parent
      const appliedFieldsToApply: Record<string, unknown> = {};
      for (const fieldId of result.appliedFields || Object.keys(fieldsToApply)) {
        if (fieldsToApply[fieldId] !== undefined) {
          appliedFieldsToApply[fieldId] = fieldsToApply[fieldId];
        }
      }
      onApplyExtractedData?.(appliedFieldsToApply);
      onDocumentChange?.();
    } catch (err: unknown) {
      console.error('Apply extraction error:', err);
      toast.error((err as Error)?.message || 'Failed to apply data', { id: toastId });
    } finally {
      setIsApplying(false);
    }
  };

  const handleToggleLock = useCallback(
    async (fieldId: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent row click (toggle selection)
      const isCurrentlyLocked = lockedFields.has(fieldId);
      const action = isCurrentlyLocked ? 'unlock' : 'lock';

      setLockingField(fieldId);
      try {
        const data = await api.post<{ lockedFields?: string[] }>(
          '/integrations/policy-extraction/lock-fields',
          { policyId, clientId, fieldIds: [fieldId], action },
        );
        setLockedFields(new Set(data.lockedFields || []));

        // If locking, deselect the field
        if (action === 'lock') {
          setSelectedFields((prev) => {
            const next = new Set(prev);
            next.delete(fieldId);
            return next;
          });
        }

        toast.success(
          isCurrentlyLocked
            ? 'Field unlocked — AI extraction can now overwrite this value'
            : 'Field locked — protected from AI extraction overwrite',
        );
      } catch (err: unknown) {
        console.error(`Error ${action}ing field:`, err);
        toast.error((err as Error)?.message || `Failed to ${action} field`);
      } finally {
        setLockingField(null);
      }
    },
    [lockedFields, policyId, clientId],
  );

  // Derive extraction display state
  const hasDocument = !!existingDocument;
  const hasExtraction = extractionResult?.status === 'completed' && extractionResult.extractedData;
  const extractionPending = isExtracting || extractionResult?.status === 'pending';
  const extractionFailed = extractionResult?.status === 'failed';

  return (
    <div className="col-span-full mt-2">
      <div className="border-t border-gray-200 pt-4">
        <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-purple-600" />
          Policy Document
        </Label>

        {/* Existing document display */}
        {existingDocument && !selectedFile && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {existingDocument.fileName}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{formatFileSize(existingDocument.fileSize)}</span>
                    <span className="text-gray-300">|</span>
                    <span>{formatDocType(existingDocument.documentType)}</span>
                    <span className="text-gray-300">|</span>
                    <span>{new Date(existingDocument.uploadDate).toLocaleDateString('en-ZA')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewerOpen(true)}
                  title="Preview document"
                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  title="Open in new tab"
                  className="text-green-700 hover:text-green-800 hover:bg-green-100"
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  title="Remove document"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* AI Extraction Button — shown when document exists */}
            <div className="mt-2 pt-2 border-t border-green-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {hasExtraction && (
                  <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px]">
                    <Check className="h-3 w-3 mr-1" />
                    Extracted
                  </Badge>
                )}
                {extractionPending && (
                  <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px]">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Extracting...
                  </Badge>
                )}
                {extractionFailed && (
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px]">
                    <XCircle className="h-3 w-3 mr-1" />
                    Failed
                  </Badge>
                )}
                {extractionResult?.appliedAt && (
                  <span className="text-[10px] text-gray-500">
                    Applied {new Date(extractionResult.appliedAt).toLocaleDateString('en-ZA')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasExtraction && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowExtractionPanel(!showExtractionPanel)}
                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 text-xs h-7"
                  >
                    {showExtractionPanel ? (
                      <ChevronUp className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 mr-1" />
                    )}
                    {showExtractionPanel ? 'Hide' : 'Review'}
                  </Button>
                )}
                <Button
                  onClick={handleExtract}
                  disabled={isExtracting || isUploading}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-xs h-7"
                >
                  {isExtracting ? (
                    <div className="contents">
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Extracting...
                    </div>
                  ) : (
                    <div className="contents">
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                      {hasExtraction ? 'Re-extract' : 'Extract Data'}
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Extraction Review Panel */}
        {showExtractionPanel && hasExtraction && extractionResult?.extractedData && (
          <ExtractionReviewPanel
            extractionResult={extractionResult}
            extractedData={extractionResult.extractedData}
            fieldMappings={fieldMappings}
            extractionDiffs={extractionDiffs}
            showDiffPanel={showDiffPanel}
            setShowDiffPanel={setShowDiffPanel}
            selectedFields={selectedFields}
            toggleFieldSelection={toggleFieldSelection}
            selectAllFields={selectAllFields}
            selectHighConfidenceFields={selectHighConfidenceFields}
            lockedFields={lockedFields}
            lockingField={lockingField}
            handleToggleLock={handleToggleLock}
            isApplying={isApplying}
            handleApplySelected={handleApplySelected}
          />
        )}

        {/* Extraction Error Display */}
        {extractionFailed && showExtractionPanel && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Extraction failed</p>
              <p className="text-red-600 mt-0.5">
                {extractionResult?.errorMessage || 'An unknown error occurred during extraction.'}
              </p>
              <p className="text-red-500 mt-1">
                You can try again — if the issue persists, the document may not be machine-readable.
              </p>
            </div>
          </div>
        )}

        {/* Upload area: drag & drop + file picker */}
        {!selectedFile && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative cursor-pointer rounded-lg border-2 border-dashed p-4 text-center
              transition-all duration-150
              ${
                isDragOver
                  ? 'border-purple-400 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
              }
            `}
          >
            <Upload
              className={`h-6 w-6 mx-auto mb-2 ${isDragOver ? 'text-purple-500' : 'text-gray-400'}`}
            />
            <p className="text-sm text-gray-600">
              {existingDocument
                ? 'Drop a new PDF to replace'
                : 'Drop a PDF here or click to browse'}
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF only, max 20MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {/* Selected file preview + document type selector + upload button */}
        {selectedFile && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
                title="Remove selection"
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-gray-600">Document Type</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((dt) => (
                      <SelectItem key={dt.value} value={dt.value}>
                        {dt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="bg-purple-600 hover:bg-purple-700 h-9"
              >
                {isUploading ? (
                  <div className="contents">
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Uploading...
                  </div>
                ) : (
                  <div className="contents">
                    <Upload className="h-4 w-4 mr-1.5" />
                    {existingDocument ? 'Replace' : 'Upload'}
                  </div>
                )}
              </Button>
            </div>

            {existingDocument && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  This will replace the existing document. The previous file will be permanently
                  deleted.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Phase 3: Extraction History Panel */}
        {hasDocument &&
          (existingExtractionHistory?.length || hasExtraction || extractionFailed) && (
            <ExtractionHistoryPanel
              policyId={policyId}
              clientId={clientId}
              initialHistory={existingExtractionHistory as any}
            />
          )}

        {/* Inline Document Viewer Dialog */}
        {hasDocument && (
          <PolicyDocumentViewer
            open={viewerOpen}
            onOpenChange={setViewerOpen}
            policyId={policyId}
            clientId={clientId}
            documentMeta={
              existingDocument
                ? {
                    fileName: existingDocument.fileName,
                    fileSize: existingDocument.fileSize,
                    documentType: existingDocument.documentType,
                    uploadDate: existingDocument.uploadDate,
                  }
                : null
            }
          />
        )}
      </div>
    </div>
  );
}
