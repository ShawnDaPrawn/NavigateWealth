import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../ui/table';
import { Input } from '../../../../ui/input';
import { Separator } from '../../../../ui/separator';
import { Badge } from '../../../../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Textarea } from '../../../../ui/textarea';
import { Info, Save, AlertCircle, Loader2, Download } from 'lucide-react';
import { IntegrationProvider, PRODUCT_CATEGORIES, IntegrationFieldBinding, IntegrationMappingConfig, ProductField } from '../types';
import { normaliseIntegrationLabelList } from '@/shared/integrations/binding-utils';

interface MappingTabProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
  categoryFields: ProductField[];
  configBindings: IntegrationFieldBinding[];
  configSettings: IntegrationMappingConfig;
  onUpdateBinding: (targetFieldId: string, patch: Partial<IntegrationFieldBinding>) => void;
  onUpdateSetting: (key: keyof IntegrationMappingConfig, value: boolean) => void;
  onSave: () => void;
  onDownloadTemplate: () => void;
  isDownloadingTemplate: boolean;
  isLoadingFields: boolean;
}

const blankBehaviorOptions: Array<{ value: NonNullable<IntegrationFieldBinding['blankBehavior']>; label: string; help: string }> = [
  { value: 'ignore', label: 'Ignore blank', help: 'Blank values do nothing. Only populated changes stage updates.' },
  { value: 'clear', label: 'Clear on blank', help: 'A blank value stages a DB clear when the admin approves it.' },
  { value: 'error', label: 'Error on blank', help: 'A blank value is held as invalid for this field.' },
];

export function MappingTab({
  provider,
  selectedCategoryId,
  categoryFields,
  configBindings,
  configSettings,
  onUpdateBinding,
  onUpdateSetting,
  onSave,
  onDownloadTemplate,
  isDownloadingTemplate,
  isLoadingFields,
}: MappingTabProps) {
  const categoryName = PRODUCT_CATEGORIES.find(c => c.id === selectedCategoryId)?.name;

  const getBindingForField = (field: ProductField): IntegrationFieldBinding => {
    const existing = configBindings.find((binding) => binding.targetFieldId === field.id);
    return existing || {
      targetFieldId: field.id,
      targetFieldName: field.name,
      columnName: field.name,
      required: field.required,
      fieldType: field.type,
      portalLabels: [],
      blankBehavior: 'ignore',
      transform: 'trim',
    };
  };

  if (isLoadingFields) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Loader2 className="w-8 h-8 mx-auto mb-2 text-purple-600 animate-spin" />
        <p>Loading system fields...</p>
      </div>
    );
  }

  if (categoryFields.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>No schema configuration found for this category.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
            <div>
              <CardTitle>Mapping Configuration</CardTitle>
              <CardDescription className="mt-2">
                Configure the canonical integration contract for <strong>{provider.name}</strong> / <strong>{categoryName}</strong>.
                The Integration Template, spreadsheet upload, and portal automation all stage through these same field bindings.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onDownloadTemplate} disabled={isDownloadingTemplate}>
              {isDownloadingTemplate ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download Template
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 p-4 bg-gray-50 rounded-lg border border-gray-100 sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2">
                <Label className="font-medium text-gray-700 cursor-pointer" htmlFor="auto-map">Auto-Map Future Uploads</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Automatically apply these bindings to future spreadsheet uploads from this provider.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-map"
                  checked={!!configSettings.autoMap}
                  onCheckedChange={(c) => onUpdateSetting('autoMap', c)}
                />
                <span className="text-xs text-gray-500">{configSettings.autoMap ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2">
                <Label className="font-medium text-gray-700 cursor-pointer" htmlFor="ignore-unmatched">Ignore Unmatched</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Columns that are not part of the canonical template contract will be skipped instead of causing an error.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="ignore-unmatched"
                  checked={!!configSettings.ignoreUnmatched}
                  onCheckedChange={(c) => onUpdateSetting('ignoreUnmatched', c)}
                />
                <span className="text-xs text-gray-500">{configSettings.ignoreUnmatched ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2">
                <Label className="font-medium text-gray-700 cursor-pointer" htmlFor="strict-mode">Strict Mode</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Reject the upload if any row contains invalid values or required contract issues.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="strict-mode"
                  checked={!!configSettings.strictMode}
                  onCheckedChange={(c) => onUpdateSetting('strictMode', c)}
                />
                <span className="text-xs text-gray-500">{configSettings.strictMode ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2">
                <Label className="font-medium text-gray-700 cursor-pointer" htmlFor="auto-publish">Auto-Publish Safe Rows</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Automatically publish exact, clean matches with no warnings and no locked-field conflicts.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-publish"
                  checked={!!configSettings.autoPublish}
                  onCheckedChange={(c) => onUpdateSetting('autoPublish', c)}
                />
                <span className="text-xs text-gray-500">{configSettings.autoPublish ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="rounded-md border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
            The spreadsheet column name is the canonical upload contract. Portal labels tell the Playwright worker what wording to look for on the provider site. Selector overrides are optional and only needed when the label-based extraction is ambiguous.
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-900">Field Bindings</h3>
            </div>

            <div className="border rounded-lg overflow-x-auto bg-white">
              <Table className="min-w-[1100px]">
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-[20%]">Navigate Wealth Field</TableHead>
                    <TableHead className="w-[16%]">Spreadsheet Column</TableHead>
                    <TableHead className="w-[26%]">Provider Labels</TableHead>
                    <TableHead className="w-[16%]">Blank Handling</TableHead>
                    <TableHead className="w-[22%]">Selector Override</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryFields.map((field) => {
                    const binding = getBindingForField(field);
                    const blankBehavior = binding.blankBehavior || 'ignore';

                    return (
                      <TableRow key={field.id}>
                        <TableCell className="align-top">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-700">{field.name}</span>
                            {field.required && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1 text-red-600 border-red-200 bg-red-50">
                                Required
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-[10px] h-5 px-1 text-gray-500">
                              {field.type}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">ID: {field.id}</div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            value={binding.columnName || ''}
                            onChange={(event) => onUpdateBinding(field.id, {
                              targetFieldName: field.name,
                              required: field.required,
                              fieldType: field.type,
                              columnName: event.target.value,
                            })}
                            placeholder={`Column name for ${field.name}`}
                            className={field.required && !binding.columnName ? 'border-red-300 bg-red-50/50' : ''}
                          />
                          <p className="mt-2 text-xs text-gray-500">
                            This is the header used by the Integration Template and spreadsheet upload.
                          </p>
                        </TableCell>
                        <TableCell className="align-top">
                          <Textarea
                            value={normaliseIntegrationLabelList(binding.portalLabels).join('\n')}
                            onChange={(event) => onUpdateBinding(field.id, {
                              targetFieldName: field.name,
                              required: field.required,
                              fieldType: field.type,
                              portalLabels: normaliseIntegrationLabelList(event.target.value),
                            })}
                            className="min-h-24 bg-white"
                            placeholder={`Provider wording for ${field.name}`}
                          />
                          <p className="mt-2 text-xs text-gray-500">
                            One phrase per line. Leave blank if you only want selector-based extraction or provider-level fallback labels from Portal Automation.
                          </p>
                        </TableCell>
                        <TableCell className="align-top">
                          <Select
                            value={blankBehavior}
                            onValueChange={(value) => onUpdateBinding(field.id, {
                              targetFieldName: field.name,
                              required: field.required,
                              fieldType: field.type,
                              blankBehavior: value as NonNullable<IntegrationFieldBinding['blankBehavior']>,
                            })}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {blankBehaviorOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="mt-2 text-xs text-gray-500">
                            {blankBehaviorOptions.find((option) => option.value === blankBehavior)?.help}
                          </p>
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            value={binding.portalSelector || ''}
                            onChange={(event) => onUpdateBinding(field.id, {
                              targetFieldName: field.name,
                              required: field.required,
                              fieldType: field.type,
                              portalSelector: event.target.value,
                            })}
                            placeholder="Optional CSS selector override"
                          />
                          <p className="mt-2 text-xs text-gray-500">
                            Optional category-specific fallback. Use this only when label-based extraction is not stable enough.
                          </p>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={onSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
