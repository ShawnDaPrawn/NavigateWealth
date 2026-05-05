import React, { useState } from 'react';
import { toast } from 'sonner@2.0.3';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import { Input } from '../../../../../ui/input';
import { Textarea } from '../../../../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { Label } from '../../../../../ui/label';
import { Checkbox } from '../../../../../ui/checkbox';
import { Progress } from '../../../../../ui/progress';
import { RoADraft, RoAField, RoAModule } from '../DraftRoAInterface';
import { roaApi } from '../../api';
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle, FileText, Save, Upload } from 'lucide-react';
import {
  buildRuntimeTemplateContext,
  coerceRuntimeFieldValue,
  getFallbackRuntimeModule,
  getModuleRuntimeStatus,
  getModuleSectionsForRuntime,
  normalizeModuleOutput,
  renderRuntimeTemplate,
} from '../../roaModuleRuntime';

interface RoAStepModuleDetailsProps {
  draft: RoADraft | null;
  onUpdate: (updates: Partial<RoADraft>) => void;
  modules?: RoAModule[];
}

type FieldValue = string | string[] | boolean | number;

function valueToDisplay(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Not mapped yet';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read evidence file'));
    reader.readAsDataURL(file);
  });
}

const MAX_EVIDENCE_BYTES = 15 * 1024 * 1024;

function formatEvidenceSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function RoAStepModuleDetails({ draft, onUpdate, modules }: RoAStepModuleDetailsProps) {
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingEvidenceId, setUploadingEvidenceId] = useState<string | null>(null);

  if (!draft || !draft.selectedModules.length) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground opacity-50 mx-auto mb-4" />
        <p className="text-muted-foreground">No modules selected. Please go back and select modules first.</p>
      </div>
    );
  }

  const currentModuleId = draft.selectedModules[currentModuleIndex];
  const currentModule = modules?.find(module => module.id === currentModuleId) || getFallbackRuntimeModule(currentModuleId);
  const currentModuleData = draft.moduleData[currentModuleId] || {};
  const currentEvidence = draft.moduleEvidence?.[currentModuleId] || {};

  if (!currentModule) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">Module configuration not found</p>
      </div>
    );
  }

  const runtimeStatus = getModuleRuntimeStatus(currentModule, currentModuleData, currentEvidence);
  const currentSections = getModuleSectionsForRuntime(currentModule);
  const normalizedOutput = normalizeModuleOutput(currentModule, currentModuleData, currentEvidence);
  const templateContext = buildRuntimeTemplateContext(draft, currentModuleId);

  const persistModuleRuntime = (
    nextModuleData = currentModuleData,
    nextEvidence = currentEvidence,
  ) => {
    const normalized = normalizeModuleOutput(currentModule, nextModuleData, nextEvidence);
    return {
      moduleOutputs: {
        ...(draft.moduleOutputs || {}),
        [currentModuleId]: normalized as unknown as Record<string, unknown>,
      },
    };
  };

  const handleFieldChange = async (fieldKey: string, value: FieldValue) => {
    const nextModuleData = {
      ...currentModuleData,
      [fieldKey]: value,
    };
    const updatedModuleData = {
      ...draft.moduleData,
      [currentModuleId]: nextModuleData,
    };

    onUpdate({
      moduleData: updatedModuleData,
      ...persistModuleRuntime(nextModuleData, currentEvidence),
    });

    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1000);
  };

  const handleEvidenceFile = async (requirement: NonNullable<RoAModule['evidence']>['requirements'][number], file: File | null) => {
    if (!file) return;
    const acceptedMimeTypes = requirement.acceptedMimeTypes || [];
    if (acceptedMimeTypes.length > 0 && !acceptedMimeTypes.includes(file.type)) {
      toast.error(`${requirement.label} must use one of the accepted file types.`);
      return;
    }
    if (file.size === 0) {
      toast.error('Evidence file is empty.');
      return;
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      toast.error(`Evidence files must be ${formatEvidenceSize(MAX_EVIDENCE_BYTES)} or smaller.`);
      return;
    }
    setUploadingEvidenceId(requirement.id);
    try {
      const bytesBase64 = await readFileAsBase64(file);
      const result = await roaApi.uploadDraftEvidence(draft.id, {
        moduleId: currentModuleId,
        requirementId: requirement.id,
        label: requirement.label,
        type: requirement.type,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        source: 'adviser-upload',
        bytesBase64,
      });

      onUpdate(result.draft);
      toast.success(`${requirement.label} attached`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload evidence');
    } finally {
      setUploadingEvidenceId(null);
    }
  };

  const renderField = (field: RoAField) => {
    const value = coerceRuntimeFieldValue((currentModuleData as Record<string, string | string[] | boolean | number | null | undefined>)[field.key] ?? field.default);
    const stringValue = Array.isArray(value) ? value.join(', ') : String(value ?? '');
    const isRequired = field.required;

    switch (field.type) {
      case 'text':
        return (
          <Input
            value={stringValue}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={isRequired && !stringValue ? 'border-orange-300' : ''}
          />
        );
      case 'textarea':
        return (
          <Textarea
            value={stringValue}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={`min-h-[100px] ${isRequired && !stringValue ? 'border-orange-300' : ''}`}
          />
        );
      case 'number':
      case 'currency':
      case 'percentage':
        return (
          <Input
            type="number"
            value={stringValue}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={isRequired && !stringValue ? 'border-orange-300' : ''}
          />
        );
      case 'date':
        return (
          <Input
            type="date"
            value={stringValue}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className={isRequired && !stringValue ? 'border-orange-300' : ''}
          />
        );
      case 'file':
        return (
          <Input
            type="file"
            onChange={(e) => handleFieldChange(field.key, e.target.files?.[0]?.name || '')}
            className={isRequired && !stringValue ? 'border-orange-300' : ''}
          />
        );
      case 'select':
        return (
          <Select
            value={stringValue}
            onValueChange={(newValue) => handleFieldChange(field.key, newValue)}
          >
            <SelectTrigger className={isRequired && !stringValue ? 'border-orange-300' : ''}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'chips': {
        const chipsValue = Array.isArray(value) ? value : (stringValue ? stringValue.split(',').map((item) => item.trim()).filter(Boolean) : []);
        return (
          <div className="space-y-2">
            <Input
              placeholder="Type and press Enter to add items"
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const input = e.target as HTMLInputElement;
                const newItem = input.value.trim();
                if (newItem && !chipsValue.includes(newItem)) {
                  handleFieldChange(field.key, [...chipsValue, newItem]);
                  input.value = '';
                }
              }}
              className={isRequired && chipsValue.length === 0 ? 'border-orange-300' : ''}
            />
            {chipsValue.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chipsValue.map((item, index) => (
                  <Badge
                    key={`${item}-${index}`}
                    variant="secondary"
                    className="cursor-pointer hover:bg-red-100"
                    onClick={() => handleFieldChange(field.key, chipsValue.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    {item} x
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );
      }
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleFieldChange(field.key, checked === true)}
            />
            <span className="text-sm">{field.label}</span>
          </div>
        );
      default:
        return <Input value={stringValue} onChange={(e) => handleFieldChange(field.key, e.target.value)} />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {currentModule.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Module {currentModuleIndex + 1} of {draft.selectedModules.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && (
                <Badge variant="outline" className="text-blue-600 border-blue-200">
                  <Save className="h-3 w-3 mr-1" />
                  Saving...
                </Badge>
              )}
              {runtimeStatus.complete && (
                <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>
                  {runtimeStatus.percentage}% complete ({runtimeStatus.completedRequiredFields}/{runtimeStatus.totalRequiredFields} fields, {runtimeStatus.completedRequiredEvidence}/{runtimeStatus.totalRequiredEvidence} evidence)
                </span>
              </div>
              <Progress value={runtimeStatus.percentage} className="w-full" />
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentModuleIndex((index) => Math.max(0, index - 1))}
                disabled={currentModuleIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous Module
              </Button>

              <div className="flex gap-2">
                {draft.selectedModules.map((moduleId, index) => {
                  const module = modules?.find(item => item.id === moduleId) || getFallbackRuntimeModule(moduleId);
                  const moduleData = draft.moduleData[moduleId] || {};
                  const isComplete = module
                    ? getModuleRuntimeStatus(module, moduleData, draft.moduleEvidence?.[moduleId] || {}).complete
                    : false;

                  return (
                    <Button
                      key={moduleId}
                      variant={index === currentModuleIndex ? 'default' : 'outline'}
                      size="sm"
                      className="relative"
                      onClick={() => setCurrentModuleIndex(index)}
                    >
                      {index + 1}
                      {isComplete && (
                        <CheckCircle className="h-3 w-3 absolute -top-1 -right-1 text-green-600" />
                      )}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentModuleIndex((index) => Math.min(draft.selectedModules.length - 1, index + 1))}
                disabled={currentModuleIndex === draft.selectedModules.length - 1}
              >
                Next Module
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Module Details</CardTitle>
          <p className="text-sm text-muted-foreground">{currentModule.description}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentModule.input && (
            <div className="rounded-lg border bg-muted/20 p-4">
              <h4 className="font-medium">Module Data Contract</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Gathering Methods</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentModule.input.gatheringMethods.map((method) => (
                      <Badge key={method} variant="secondary">{method}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Configured Sources</p>
                  <div className="mt-2 space-y-1">
                    {currentModule.input.sources.map((source) => (
                      <p key={source.id} className="text-xs">
                        <span className="font-medium">{source.label}</span>
                        <span className="text-muted-foreground"> - {source.type}{source.required ? ' required' : ' optional'}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {currentSections.map((section) => (
              <div key={section.id} className="space-y-3 rounded-lg border p-4">
                <div>
                  <h4 className="font-medium">{section.title}</h4>
                  {section.description && (
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  )}
                </div>
                {section.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key} className="flex items-center gap-2">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                      {field.source && <Badge variant="outline">{field.source}</Badge>}
                    </Label>
                    {renderField(field)}
                    {field.helpText && (
                      <p className="text-xs text-muted-foreground">{field.helpText}</p>
                    )}
                    {field.required && !((currentModuleData as Record<string, unknown>)[field.key]) && (
                      <p className="text-xs text-orange-600">This field is required</p>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {currentModule.evidence && currentModule.evidence.requirements.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Required Evidence</h4>
              <div className="grid gap-3">
                {currentModule.evidence.requirements.map((requirement) => {
                  const evidence = currentEvidence[requirement.id];
                  return (
                    <div key={requirement.id} className="rounded-md border p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{requirement.label}</span>
                            {requirement.required && <Badge variant="outline">Required</Badge>}
                          </div>
                          {requirement.guidance && (
                            <p className="mt-1 text-xs text-muted-foreground">{requirement.guidance}</p>
                          )}
                          {requirement.acceptedMimeTypes && requirement.acceptedMimeTypes.length > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Accepted: {requirement.acceptedMimeTypes.join(', ')}. Max {formatEvidenceSize(MAX_EVIDENCE_BYTES)}.
                            </p>
                          )}
                          {evidence && (
                            <div className="mt-2 space-y-1 text-xs text-green-700">
                              <p>Attached: {evidence.fileName}</p>
                              {evidence.sha256 && (
                                <p className="text-muted-foreground">SHA-256: {evidence.sha256.slice(0, 12)}...</p>
                              )}
                              {evidence.source && (
                                <p className="text-muted-foreground">Source: {evidence.source}</p>
                              )}
                            </div>
                          )}
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                          <Upload className="h-4 w-4" />
                          {uploadingEvidenceId === requirement.id ? 'Uploading...' : 'Attach'}
                          <input
                            type="file"
                            className="hidden"
                            accept={requirement.acceptedMimeTypes?.join(',')}
                            disabled={uploadingEvidenceId === requirement.id}
                            onChange={(event) => handleEvidenceFile(requirement, event.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentModule.disclosures.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Regulatory Disclosures</h4>
              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                {currentModule.disclosures.map((disclosure, index) => (
                  <p key={`${disclosure}-${index}`} className="text-sm text-muted-foreground">
                    - {disclosure}
                  </p>
                ))}
              </div>
            </div>
          )}

          {currentModule.output && (
            <div className="space-y-3">
              <h4 className="font-medium">Normalized Module Output</h4>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Output key: <span className="font-medium text-foreground">{normalizedOutput.normalizedKey}</span>
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {currentModule.output.fields.map((field) => (
                    <div key={field.key} className="rounded-md bg-background p-2 text-sm">
                      <p className="text-xs text-muted-foreground">{field.label}</p>
                      <p className="font-medium">{valueToDisplay(normalizedOutput.values[field.key])}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentModule.documentSections && currentModule.documentSections.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Module RoA Section Preview</h4>
              <div className="space-y-3">
                {currentModule.documentSections
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .filter((section) => currentModule.compileOrder.length === 0 || currentModule.compileOrder.includes(section.id))
                  .map((section) => (
                    <div key={section.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{section.title}</p>
                        {section.required && <Badge variant="outline">Required</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{section.purpose}</p>
                      <pre className="mt-3 whitespace-pre-wrap rounded bg-muted/40 p-3 text-xs text-muted-foreground">
                        {renderRuntimeTemplate(section.template || section.purpose, templateContext)}
                      </pre>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {!runtimeStatus.complete && (
            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
              <p className="text-sm font-medium text-orange-700">Complete the contract requirements to proceed.</p>
              <div className="mt-2 space-y-1 text-xs text-orange-700">
                {runtimeStatus.blocking.map((issue) => (
                  <p key={issue.id}>{issue.message}</p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
