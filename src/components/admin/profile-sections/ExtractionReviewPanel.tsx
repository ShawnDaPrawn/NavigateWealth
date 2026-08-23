/**
 * Extraction review panel of the policy document upload: AI summary,
 * validation warnings, the change-detection diff, the field-mappings table,
 * extracted benefits, and the apply action. Pure view over props from
 * PolicyDocumentUpload.
 */
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

import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  Loader2,
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

/** Document type options matching the server validation */
import {
  getConfidenceBadge,
  formatValue,
  type ExtractionResult,
  type FieldMappingEntry,
  type FieldDiff,
  type ExtractedPolicyData,
} from './policyDocumentModel';
import type { Dispatch, SetStateAction } from 'react';

interface ExtractionReviewPanelProps {
  extractionResult: ExtractionResult;
  extractedData: ExtractedPolicyData;
  fieldMappings: FieldMappingEntry[];
  extractionDiffs: FieldDiff[];
  showDiffPanel: boolean;
  setShowDiffPanel: Dispatch<SetStateAction<boolean>>;
  selectedFields: Set<string>;
  toggleFieldSelection: (fieldId: string) => void;
  selectAllFields: () => void;
  selectHighConfidenceFields: () => void;
  lockedFields: Set<string>;
  lockingField: string | null;
  handleToggleLock: (fieldId: string, e: React.MouseEvent) => void;
  isApplying: boolean;
  handleApplySelected: () => void;
}

export function ExtractionReviewPanel({
  extractionResult,
  extractedData,
  fieldMappings,
  extractionDiffs,
  showDiffPanel,
  setShowDiffPanel,
  selectedFields,
  toggleFieldSelection,
  selectAllFields,
  selectHighConfidenceFields,
  lockedFields,
  lockingField,
  handleToggleLock,
  isApplying,
  handleApplySelected,
}: ExtractionReviewPanelProps) {
  return (
    <div className="border border-purple-200 rounded-lg overflow-hidden mb-3">
      {/* Header */}
      <div className="bg-purple-50 px-3 py-2 flex items-center justify-between border-b border-purple-200">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-800">AI Extraction Results</span>
          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px]">
            {Math.round(extractedData.overallConfidence * 100)}% confidence
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
      {extractedData.aiSummary && (
        <div className="px-3 py-2 bg-gray-50 border-b border-purple-100 text-xs text-gray-600">
          {extractedData.aiSummary}
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
                {extractionDiffs.length} field{extractionDiffs.length > 1 ? 's' : ''} changed from
                current values
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
              {extractionDiffs.map((diff) => (
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
          {fieldMappings.map((mapping) => {
            const isSelected = selectedFields.has(mapping.schemaFieldId);
            const isLocked = lockedFields.has(mapping.schemaFieldId);
            const hasCurrentValue =
              mapping.currentValue !== null &&
              mapping.currentValue !== undefined &&
              mapping.currentValue !== '';
            const valueChanged =
              hasCurrentValue && String(mapping.currentValue) !== String(mapping.value);

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
                <div
                  className={`
                        h-4 w-4 rounded border flex items-center justify-center flex-shrink-0
                        ${
                          isLocked
                            ? 'bg-gray-200 border-gray-300 cursor-not-allowed'
                            : isSelected
                              ? 'bg-purple-600 border-purple-600'
                              : 'border-gray-300 bg-white'
                        }
                      `}
                >
                  {isLocked ? (
                    <Lock className="h-2.5 w-2.5 text-gray-400" />
                  ) : isSelected ? (
                    <Check className="h-3 w-3 text-white" />
                  ) : null}
                </div>

                {/* Field Name */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <span
                    className={`text-xs font-medium ${isLocked ? 'text-gray-500' : 'text-gray-700'}`}
                  >
                    {mapping.schemaFieldName}
                  </span>
                  {isLocked && (
                    <Badge className="bg-gray-200 text-gray-500 hover:bg-gray-200 text-[8px] px-1 py-0">
                      Locked
                    </Badge>
                  )}
                </div>

                {/* Confidence */}
                <div className="flex-shrink-0">{getConfidenceBadge(mapping.confidence)}</div>

                {/* Values */}
                <div className="flex items-center gap-2 text-xs flex-shrink-0">
                  {hasCurrentValue && valueChanged && (
                    <span className="text-gray-400 line-through">
                      {formatValue(mapping.currentValue)}
                    </span>
                  )}
                  <span
                    className={`font-medium ${isLocked ? 'text-gray-500' : valueChanged ? 'text-purple-700' : 'text-gray-700'}`}
                  >
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
                  title={
                    isLocked
                      ? 'Unlock field — allow AI overwrite'
                      : 'Lock field — protect from AI overwrite'
                  }
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
          No field mappings could be generated. The extracted data may not match the current schema
          fields.
        </div>
      )}

      {/* Extracted Benefits (if any extra info) */}
      {extractedData.benefits.length > 0 && (
        <div className="px-3 py-2 bg-gray-50 border-t border-purple-200">
          <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
            Benefits Identified
          </p>
          <div className="flex flex-wrap gap-1">
            {extractedData.benefits.map((benefit, i) => (
              <Badge
                key={`benefit-${i}`}
                className="bg-white border border-gray-200 text-gray-600 hover:bg-white text-[10px]"
              >
                {benefit.providerTermName?.value || benefit.canonicalType?.value || 'Unknown'}
                {benefit.coverAmount?.value
                  ? ` — R${Number(benefit.coverAmount.value).toLocaleString('en-ZA')}`
                  : ''}
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
  );
}
