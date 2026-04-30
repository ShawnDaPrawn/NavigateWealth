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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
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
  AlertTriangle,
  Info,
  Lock,
  Unlock,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { createClient } from '../../../utils/supabase/client';
import { ExtractionHistoryPanel } from './ExtractionHistoryPanel';
import { PolicyDocumentViewer } from './PolicyDocumentViewer';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;

/** Document type options matching the server validation */
const DOCUMENT_TYPES = [
  { value: 'policy_schedule', label: 'Policy Schedule' },
  { value: 'amendment', label: 'Amendment' },
  { value: 'statement', label: 'Statement' },
  { value: 'benefit_summary', label: 'Benefit Summary' },
  { value: 'other', label: 'Other' },
] as const;

/** Metadata shape matching the server's PolicyDocument interface */
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
interface ExtractionResult {
  extractedData: ExtractedPolicyData | null;
  extractedAt: string;
  confidence: number;
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
  appliedAt?: string;
  appliedFields?: string[];
  model?: string;
  validationWarnings?: ValidationWarning[];
}

/** Validation warning from cross-field checks */
interface ValidationWarning {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  relatedFields?: string[];
}

/** Field diff for change detection */
interface FieldDiff {
  schemaFieldId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  oldConfidence: number;
  newConfidence: number;
  changed: boolean;
}

interface ExtractedField<T> {
  value: T;
  confidence: number;
  source?: string;
}

interface ExtractedBenefit {
  canonicalType: ExtractedField<string>;
  providerTermName: ExtractedField<string>;
  coverAmount?: ExtractedField<number>;
  waitingPeriod?: ExtractedField<string>;
  expiryAge?: ExtractedField<number>;
}

interface ExtractedPolicyData {
  policyNumber?: ExtractedField<string>;
  providerName?: ExtractedField<string>;
  productName?: ExtractedField<string>;
  policyOwner?: ExtractedField<string>;
  insuredLife?: ExtractedField<string>;
  policyStartDate?: ExtractedField<string>;
  policyStatus?: ExtractedField<string>;
  premiumAmount?: ExtractedField<number>;
  premiumFrequency?: ExtractedField<string>;
  benefits: ExtractedBenefit[];
  overallConfidence: number;
  aiSummary?: string;
}

/** Field mapping from server */
interface FieldMappingEntry {
  canonicalKey: string;
  schemaFieldId: string;
  schemaFieldName: string;
  value: unknown;
  confidence: number;
  currentValue?: unknown;
  locked?: boolean;
}

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDocType(type: string): string {
  const found = DOCUMENT_TYPES.find(d => d.value === type);
  return found?.label || type;
}

function getConfidenceBadge(confidence: number) {
  if (confidence >= 0.85) {
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] px-1.5 py-0">High</Badge>;
  }
  if (confidence >= 0.5) {
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] px-1.5 py-0">Medium</Badge>;
  }
  return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] px-1.5 py-0">Low</Badge>;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return `R${value.toLocaleString('en-ZA')}`;
  }
  return String(value);
}

function hasExtractedValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
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
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(existingExtraction || null);
  const [fieldMappings, setFieldMappings] = useState<FieldMappingEntry[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [showExtractionPanel, setShowExtractionPanel] = useState(false);
  // Phase 3: Change detection diffs from re-extraction
  const [extractionDiffs, setExtractionDiffs] = useState<FieldDiff[]>([]);
  const [showDiffPanel, setShowDiffPanel] = useState(false);

  // Field locking state
  const [lockedFields, setLockedFields] = useState<Set<string>>(new Set(existingLockedFields || []));
  const [lockingField, setLockingField] = useState<string | null>(null);

  const getAuthToken = useCallback(async (): Promise<string> => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || publicAnonKey;
  }, []);

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
      const token = await getAuthToken();
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('policyId', policyId);
      formData.append('clientId', clientId);
      formData.append('documentType', documentType);
      formData.append('uploadedBy', user?.id || 'unknown');

      const res = await fetch(`${API_BASE}/policy-documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      toast.success(
        existingDocument ? 'Policy document replaced' : 'Policy document attached',
        { id: toastId },
      );
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
      const token = await getAuthToken();
      const res = await fetch(
        `${API_BASE}/policy-documents/download?policyId=${encodeURIComponent(policyId)}&clientId=${encodeURIComponent(clientId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to get download link');
      }
      const { url } = await res.json();
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
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/policy-documents`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ policyId, clientId }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to remove document');
      }
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
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/policy-extraction/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ policyId, clientId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Extraction failed');
      }

      const data = await res.json();
      setExtractionResult(data.extraction);
      setFieldMappings(data.fieldMappings || []);

      // Phase 3: Capture diffs from re-extraction
      const diffs = (data.diff || []).filter((d: FieldDiff) => d.changed);
      setExtractionDiffs(diffs);
      if (diffs.length > 0) {
        setShowDiffPanel(true);
      }

      // Auto-select high-confidence fields
      const highConfidence = new Set<string>();
      for (const mapping of (data.fieldMappings || [])) {
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
        toast.error(
          data.extraction?.errorMessage || 'Extraction failed',
          { id: toastId },
        );
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
    setSelectedFields(prev => {
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
    setSelectedFields(new Set(
      fieldMappings
        .filter(m => !lockedFields.has(m.schemaFieldId))
        .map(m => m.schemaFieldId)
    ));
  };

  const selectHighConfidenceFields = () => {
    // Exclude locked fields from "select high confidence"
    setSelectedFields(new Set(
      fieldMappings
        .filter(m => m.confidence >= 0.85 && !lockedFields.has(m.schemaFieldId))
        .map(m => m.schemaFieldId),
    ));
  };

  const handleApplySelected = async () => {
    if (selectedFields.size === 0) {
      toast.error('No fields selected to apply');
      return;
    }

    setIsApplying(true);
    const toastId = toast.loading('Applying extracted data...');

    try {
      const token = await getAuthToken();
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

      const res = await fetch(`${API_BASE}/policy-extraction/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ policyId, clientId, fieldsToApply }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to apply data');
      }

      const result = await res.json();
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
      for (const fieldId of (result.appliedFields || Object.keys(fieldsToApply))) {
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

  const handleToggleLock = useCallback(async (fieldId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click (toggle selection)
    const isCurrentlyLocked = lockedFields.has(fieldId);
    const action = isCurrentlyLocked ? 'unlock' : 'lock';

    setLockingField(fieldId);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/policy-extraction/lock-fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ policyId, clientId, fieldIds: [fieldId], action }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to ${action} field`);
      }

      const data = await res.json();
      setLockedFields(new Set(data.lockedFields || []));

      // If locking, deselect the field
      if (action === 'lock') {
        setSelectedFields(prev => {
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
  }, [lockedFields, getAuthToken, policyId, clientId]);

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
                  {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  title="Remove document"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
                    {showExtractionPanel ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
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
          <div className="border border-purple-200 rounded-lg overflow-hidden mb-3">
            {/* Header */}
            <div className="bg-purple-50 px-3 py-2 flex items-center justify-between border-b border-purple-200">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-800">AI Extraction Results</span>
                <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px]">
                  {Math.round(extractionResult.extractedData.overallConfidence * 100)}% confidence
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectHighConfidenceFields}
                  className="text-xs h-6 text-purple-600 hover:text-purple-700"
                >
                  High Only
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllFields}
                  className="text-xs h-6 text-purple-600 hover:text-purple-700"
                >
                  Select All
                </Button>
              </div>
            </div>

            {/* AI Summary */}
            {extractionResult.extractedData.aiSummary && (
              <div className="px-3 py-2 bg-gray-50 border-b border-purple-100 text-xs text-gray-600">
                {extractionResult.extractedData.aiSummary}
              </div>
            )}

            {/* Phase 3: Validation Warnings */}
            {extractionResult.validationWarnings && extractionResult.validationWarnings.length > 0 && (
              <div className="px-3 py-2 border-b border-purple-100 space-y-1.5">
                {extractionResult.validationWarnings.map((warning, idx) => (
                  <div
                    key={`warn-${idx}`}
                    className={`flex items-start gap-2 text-xs rounded-md px-2.5 py-1.5 ${
                      warning.severity === 'error'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : warning.severity === 'warning'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {warning.severity === 'error' ? (
                      <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    ) : warning.severity === 'warning' ? (
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{warning.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Phase 3: Change Detection Diff Panel */}
            {extractionDiffs.length > 0 && (
              <div className="border-b border-purple-100">
                <button
                  onClick={() => setShowDiffPanel(!showDiffPanel)}
                  className="w-full px-3 py-1.5 flex items-center justify-between bg-amber-50/50 hover:bg-amber-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs font-medium text-amber-800">
                      {extractionDiffs.length} field{extractionDiffs.length > 1 ? 's' : ''} changed from current values
                    </span>
                  </div>
                  {showDiffPanel ? (
                    <ChevronUp className="h-3.5 w-3.5 text-amber-600" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-amber-600" />
                  )}
                </button>
                {showDiffPanel && (
                  <div className="divide-y divide-amber-100">
                    {extractionDiffs.map(diff => (
                      <div key={diff.schemaFieldId} className="px-3 py-2 bg-amber-50/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">{diff.fieldName}</span>
                          {diff.newConfidence > 0 && getConfidenceBadge(diff.newConfidence)}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span className="text-red-500 line-through">{formatValue(diff.oldValue)}</span>
                          <span className="text-gray-400">&rarr;</span>
                          <span className="text-green-700 font-medium">{formatValue(diff.newValue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Field Mappings Table */}
            {fieldMappings.length > 0 ? (
              <div className="divide-y divide-purple-100">
                {fieldMappings.map(mapping => {
                  const isSelected = selectedFields.has(mapping.schemaFieldId);
                  const isLocked = lockedFields.has(mapping.schemaFieldId);
                  const hasCurrentValue = mapping.currentValue !== null && mapping.currentValue !== undefined && mapping.currentValue !== '';
                  const valueChanged = hasCurrentValue && String(mapping.currentValue) !== String(mapping.value);

                  return (
                    <div
                      key={mapping.schemaFieldId}
                      className={`px-3 py-2 flex items-center gap-3 transition-colors ${
                        isLocked
                          ? 'bg-gray-50/50 cursor-default'
                          : isSelected
                          ? 'bg-purple-50/30 cursor-pointer hover:bg-purple-50/50'
                          : 'cursor-pointer hover:bg-purple-50/50'
                      }`}
                      onClick={() => !isLocked && toggleFieldSelection(mapping.schemaFieldId)}
                      title={isLocked ? 'This field is locked — unlock to select it' : undefined}
                    >
                      {/* Checkbox */}
                      <div className={`
                        h-4 w-4 rounded border flex items-center justify-center flex-shrink-0
                        ${isLocked
                          ? 'bg-gray-200 border-gray-300 cursor-not-allowed'
                          : isSelected
                          ? 'bg-purple-600 border-purple-600'
                          : 'border-gray-300 bg-white'
                        }
                      `}>
                        {isLocked ? (
                          <Lock className="h-2.5 w-2.5 text-gray-400" />
                        ) : isSelected ? (
                          <Check className="h-3 w-3 text-white" />
                        ) : null}
                      </div>

                      {/* Field Name */}
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className={`text-xs font-medium ${isLocked ? 'text-gray-500' : 'text-gray-700'}`}>
                          {mapping.schemaFieldName}
                        </span>
                        {isLocked && (
                          <Badge className="bg-gray-200 text-gray-500 hover:bg-gray-200 text-[8px] px-1 py-0">
                            Locked
                          </Badge>
                        )}
                      </div>

                      {/* Confidence */}
                      <div className="flex-shrink-0">
                        {getConfidenceBadge(mapping.confidence)}
                      </div>

                      {/* Values */}
                      <div className="flex items-center gap-2 text-xs flex-shrink-0">
                        {hasCurrentValue && valueChanged && (
                          <span className="text-gray-400 line-through">{formatValue(mapping.currentValue)}</span>
                        )}
                        <span className={`font-medium ${isLocked ? 'text-gray-500' : valueChanged ? 'text-purple-700' : 'text-gray-700'}`}>
                          {formatValue(mapping.value)}
                        </span>
                      </div>

                      {/* Lock/Unlock Toggle */}
                      <button
                        onClick={(e) => handleToggleLock(mapping.schemaFieldId, e)}
                        disabled={lockingField === mapping.schemaFieldId}
                        className={`flex-shrink-0 p-1 rounded transition-colors ${
                          isLocked
                            ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                            : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                        }`}
                        title={isLocked ? 'Unlock field — allow AI overwrite' : 'Lock field — protect from AI overwrite'}
                      >
                        {lockingField === mapping.schemaFieldId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isLocked ? (
                          <Lock className="h-3.5 w-3.5" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-4 text-center text-xs text-gray-500">
                No field mappings could be generated. The extracted data may not match the current schema fields.
              </div>
            )}

            {/* Extracted Benefits (if any extra info) */}
            {extractionResult.extractedData.benefits.length > 0 && (
              <div className="px-3 py-2 bg-gray-50 border-t border-purple-200">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Benefits Identified</p>
                <div className="flex flex-wrap gap-1">
                  {extractionResult.extractedData.benefits.map((benefit, i) => (
                    <Badge
                      key={`benefit-${i}`}
                      className="bg-white border border-gray-200 text-gray-600 hover:bg-white text-[10px]"
                    >
                      {benefit.providerTermName?.value || benefit.canonicalType?.value || 'Unknown'}
                      {benefit.coverAmount?.value ? ` — R${Number(benefit.coverAmount.value).toLocaleString('en-ZA')}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Apply Button */}
            {fieldMappings.length > 0 && (
              <div className="px-3 py-2 bg-purple-50 border-t border-purple-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-purple-600">
                    {selectedFields.size} of {fieldMappings.length} fields selected
                  </span>
                  {lockedFields.size > 0 && (
                    <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                      <Lock className="h-2.5 w-2.5" />
                      {lockedFields.size} locked
                    </span>
                  )}
                </div>
                <Button
                  onClick={handleApplySelected}
                  disabled={isApplying || selectedFields.size === 0}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-xs h-7"
                >
                  {isApplying ? (
                    <div className="contents">
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Applying...
                    </div>
                  ) : (
                    <div className="contents">
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Apply Selected
                    </div>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Extraction Error Display */}
        {extractionFailed && showExtractionPanel && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Extraction failed</p>
              <p className="text-red-600 mt-0.5">{extractionResult?.errorMessage || 'An unknown error occurred during extraction.'}</p>
              <p className="text-red-500 mt-1">You can try again — if the issue persists, the document may not be machine-readable.</p>
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
              ${isDragOver
                ? 'border-purple-400 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
              }
            `}
          >
            <Upload className={`h-6 w-6 mx-auto mb-2 ${isDragOver ? 'text-purple-500' : 'text-gray-400'}`} />
            <p className="text-sm text-gray-600">
              {existingDocument ? 'Drop a new PDF to replace' : 'Drop a PDF here or click to browse'}
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
                    {DOCUMENT_TYPES.map(dt => (
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
                <span>This will replace the existing document. The previous file will be permanently deleted.</span>
              </div>
            )}
          </div>
        )}

        {/* Phase 3: Extraction History Panel */}
        {hasDocument && (existingExtractionHistory?.length || hasExtraction || extractionFailed) && (
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
            documentMeta={existingDocument ? {
              fileName: existingDocument.fileName,
              fileSize: existingDocument.fileSize,
              documentType: existingDocument.documentType,
              uploadDate: existingDocument.uploadDate,
            } : null}
          />
        )}
      </div>
    </div>
  );
}
