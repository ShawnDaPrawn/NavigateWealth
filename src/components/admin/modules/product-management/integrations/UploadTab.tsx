import React from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Separator } from '../../../../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../ui/table';
import { CheckCircle2, AlertCircle, FileSpreadsheet, X, RefreshCw, FileAxis3D } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { IntegrationProvider, PRODUCT_CATEGORIES, PreviewData, IntegrationStats } from '../types';

interface UploadTabProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
  uploadedFile: { name: string, size: string, uploadedAt: string } | null;
  isProcessing: boolean;
  showPreview: boolean;
  onDrop: (e: React.DragEvent) => void;
  onManualUpload: () => void;
  onProcess: () => void;
  onClear: () => void;
  onConfirm: () => void;
  isColumnMapped: (col: string) => boolean;
  previewData?: PreviewData | null;
  stats: IntegrationStats;
  matchedColumnsCount: number;
}

export function UploadTab({
  provider,
  selectedCategoryId,
  uploadedFile,
  isProcessing,
  showPreview,
  onDrop,
  onManualUpload,
  onProcess,
  onClear,
  onConfirm,
  isColumnMapped,
  previewData,
  stats,
  matchedColumnsCount
}: UploadTabProps) {


  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gray-50 border-gray-200 shadow-none">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Last Attempted</p>
            <p className="text-sm font-semibold">{stats.lastAttempted || '-'}</p>
          </CardContent>
        </Card>
        <Card className={cn(
          "border-gray-200 shadow-none",
          stats.lastUpdateStatus === 'success' ? "bg-green-50/50" : 
          stats.lastUpdateStatus === 'failed' ? "bg-red-50/50" : "bg-gray-50"
        )}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Last Status</p>
            <div className="flex items-center gap-2">
              {stats.lastUpdateStatus === 'success' ? (
                <div className="contents"><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="text-sm font-semibold text-green-700">Successful</span></div>
              ) : stats.lastUpdateStatus === 'failed' ? (
                <div className="contents"><AlertCircle className="w-4 h-4 text-red-600" /><span className="text-sm font-semibold text-red-700">Failed</span></div>
              ) : (
                <span className="text-sm font-semibold text-gray-600">No Data</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200 shadow-none">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Last Successful</p>
            <p className="text-sm font-semibold">{stats.lastSuccessful || '-'}</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Spreadsheet Upload</h3>
        </div>

        {!uploadedFile ? (
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center bg-white hover:bg-blue-50/50 hover:border-blue-300 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-full shadow-sm flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-6 h-6 text-blue-500" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Drag and drop your file here</h4>
            <p className="text-sm text-gray-500 mb-6">
              Using saved mapping for <span className="font-semibold text-blue-600">{PRODUCT_CATEGORIES.find(c => c.id === selectedCategoryId)?.name}</span>
            </p>
            <Button 
              onClick={onManualUpload} 
              variant="outline" 
              className="mx-auto"
            >
              Browse Files
            </Button>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{uploadedFile.name}</h4>
                    <p className="text-sm text-gray-500">{uploadedFile.size} • Uploaded at {uploadedFile.uploadedAt}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClear} aria-label="Clear uploaded file">
                  <X className="w-4 h-4 text-gray-400" />
                </Button>
              </div>

              {!showPreview ? (
                <div className="flex justify-end pt-4 border-t">
                   <Button 
                    onClick={onProcess} 
                    disabled={isProcessing}
                    className="bg-purple-600 hover:bg-purple-700 min-w-[140px]"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <FileAxis3D className="w-4 h-4 mr-2" />
                    )}
                    {isProcessing ? 'Processing...' : 'Process & Preview'}
                  </Button>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                  {previewData?.validationErrors && previewData.validationErrors.length > 0 && (
                      <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-start gap-3">
                         <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                         <div>
                           <h5 className="font-medium text-red-900">Validation Errors Detected</h5>
                           <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                               {previewData.validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                           </ul>
                         </div>
                      </div>
                  )}
                  
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                     <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
                     <div>
                       <h5 className="font-medium text-blue-900">File Processed Successfully</h5>
                       <p className="text-sm text-blue-700 mt-1">
                         The file matched {matchedColumnsCount} configured columns for {PRODUCT_CATEGORIES.find(c => c.id === selectedCategoryId)?.name}. 
                         Review the preview below before confirming the import.
                       </p>
                     </div>
                  </div>

                  {/* Read-Only Preview Table */}
                   <div className="border rounded-lg overflow-x-auto bg-white">
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow>
                            {previewData?.headers.map((col, i) => (
                              <TableHead 
                                key={i} 
                                className={cn(
                                  "whitespace-nowrap border-b-2",
                                  isColumnMapped(col) ? "border-green-400 bg-green-50/20 text-green-700" : "border-red-300 bg-red-50/20 text-red-700"
                                )}
                              >
                                {col}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData?.rows.map((row, idx) => (
                            <TableRow key={idx}>
                              {previewData.headers.map((_, cellIdx) => {
                                const colName = previewData.headers[cellIdx];
                                const mapped = isColumnMapped(colName);
                                const cell = row[colName] || ''; 
                                return (
                                  <TableCell 
                                    key={cellIdx} 
                                    className={cn(
                                      "whitespace-nowrap text-xs",
                                      mapped ? "text-gray-700" : "text-gray-400 bg-gray-50/50"
                                    )}
                                  >
                                    {typeof cell === 'object' ? JSON.stringify(cell) : cell}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <Button variant="outline" onClick={onClear}>
                        Cancel
                      </Button>
                      <Button className="bg-green-600 hover:bg-green-700" onClick={onConfirm}>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Confirm Import
                      </Button>
                    </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}