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
import { Info, ArrowRight, Save, AlertCircle, Loader2, Download } from 'lucide-react';
import { IntegrationProvider, PRODUCT_CATEGORIES, IntegrationMappingConfig, ProductCategoryId } from '../types';
import { useProductSchema } from '../hooks/useProductSchema';

interface MappingTabProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
  configMapping: { source: string, target: string }[];
  configSettings: IntegrationMappingConfig;
  onUpdateMapping: (targetId: string, sourceValue: string) => void;
  onUpdateSetting: (key: keyof IntegrationMappingConfig, value: boolean) => void;
  onSave: () => void;
  onDownloadTemplate: () => void;
  isDownloadingTemplate: boolean;
}

export function MappingTab({
  provider,
  selectedCategoryId,
  configMapping,
  configSettings,
  onUpdateMapping,
  onUpdateSetting,
  onSave,
  onDownloadTemplate,
  isDownloadingTemplate
}: MappingTabProps) {

  const { currentFields: categoryFields, isLoading } = useProductSchema(selectedCategoryId as ProductCategoryId);
  const categoryName = PRODUCT_CATEGORIES.find(c => c.id === selectedCategoryId)?.name;

  const getSourceForTarget = (targetId: string) => {
    const mapping = configMapping.find(m => m.target === targetId);
    return mapping ? mapping.source : '';
  };

  if (isLoading) {
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
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
            <div>
              <CardTitle>Mapping Configuration</CardTitle>
              <CardDescription className="mt-2">
                Map your spreadsheet columns to the required system fields for <strong>{categoryName}</strong>.
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
          {/* Global Settings */}
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
                      <p className="max-w-xs">Automatically apply these column mappings to future spreadsheet uploads from this provider.</p>
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
                      <p className="max-w-xs">Columns in the spreadsheet that are NOT mapped will be skipped during import instead of causing an error.</p>
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
                      <p className="max-w-xs">If enabled, the import will be completely rejected if ANY row contains invalid data types or missing required fields.</p>
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
                      <p className="max-w-xs">Automatically publish exact policy-number matches that have valid values, no warnings, and no locked-field changes.</p>
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

          {/* Config Table */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-900">Column Mappings</h3>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-[40%]">System Field (Target)</TableHead>
                    <TableHead className="w-[5%] text-center">
                      <ArrowRight className="w-4 h-4 mx-auto text-gray-400" />
                    </TableHead>
                    <TableHead className="w-[55%]">Spreadsheet Header (Source)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryFields.map((field) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
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
                        <div className="text-xs text-gray-400 mt-1">
                          ID: {field.id}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <ArrowRight className="w-4 h-4 mx-auto text-gray-400" />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder={`Enter header for ${field.name}...`}
                          value={getSourceForTarget(field.id)}
                          onChange={(e) => onUpdateMapping(field.id, e.target.value)}
                          className={field.required && !getSourceForTarget(field.id) ? "border-red-300 bg-red-50/50" : ""}
                        />
                        {field.options && (
                          <div className="mt-1 text-xs text-gray-500">
                            Expected values: {field.options.join(', ')}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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
