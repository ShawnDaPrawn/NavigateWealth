/**
 * The bulk-import dialog of the newsletter subscribers screen: template
 * download, spreadsheet upload, parsed preview, and upload results. JSX
 * moved verbatim from NewsletterSubscribers.tsx; every captured name became
 * a prop.
 */
import React from 'react';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseSubscriberFile } from '../utils';
import { useBulkUpload } from '../hooks/useNewsletterMutations';

interface SubscriberBulkImportDialogProps {
  bulkOpen: boolean;
  setBulkOpen: React.Dispatch<React.SetStateAction<boolean>>;
  bulkFile: File | null;
  setBulkFile: React.Dispatch<React.SetStateAction<File | null>>;
  bulkParsed: { email: string; firstName: string; surname: string }[];
  setBulkParsed: React.Dispatch<
    React.SetStateAction<{ email: string; firstName: string; surname: string }[]>
  >;
  bulkResult: { added: number; skipped: number; errors: string[] } | null;
  setBulkResult: React.Dispatch<
    React.SetStateAction<{ added: number; skipped: number; errors: string[] } | null>
  >;
  bulkMutation: ReturnType<typeof useBulkUpload>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBulkUpload: () => Promise<void>;
  handleDownloadTemplate: () => void;
  resetBulk: () => void;
}

export function SubscriberBulkImportDialog({
  bulkOpen,
  setBulkOpen,
  bulkFile,
  setBulkFile,
  bulkParsed,
  setBulkParsed,
  bulkResult,
  setBulkResult,
  bulkMutation,
  fileInputRef,
  handleFileChange,
  handleBulkUpload,
  handleDownloadTemplate,
  resetBulk,
}: SubscriberBulkImportDialogProps) {
  return (
    <>
      {/* ═══════ Bulk Import Dialog ═══════ */}
      <Dialog
        open={bulkOpen}
        onOpenChange={(open) => {
          setBulkOpen(open);
          if (!open) resetBulk();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-purple-500" />
              Bulk Import Subscribers
            </DialogTitle>
            <DialogDescription>
              Upload an Excel spreadsheet with subscriber details. All imported subscribers are
              assumed to have opted in offline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Template download */}
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-dashed">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Download Template</p>
                  <p className="text-[11px] text-muted-foreground">
                    Excel template with Email, First Name/s, and Surname columns
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Template
              </Button>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>Upload File</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center hover:border-purple-300 hover:bg-purple-50/30 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('border-purple-400', 'bg-purple-50/50');
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50/50');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50/50');
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    setBulkFile(file);
                    setBulkResult(null);
                    parseSubscriberFile(file, (rows) => {
                      if (rows.length === 0) {
                        toast.error(
                          'No valid email addresses found. Ensure your file has an "Email" column.',
                        );
                      }
                      setBulkParsed(rows);
                    });
                  }
                }}
              >
                <Upload className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {bulkFile ? bulkFile.name : 'Drop an Excel file here or click to browse'}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Accepts .xlsx, .xls, and .csv files (max 500 rows)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Parsed preview */}
            {bulkParsed.length > 0 && !bulkResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Preview ({bulkParsed.length} subscribers found)
                  </p>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={resetBulk}>
                    Clear
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">
                          #
                        </th>
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">
                          First Name
                        </th>
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">
                          Surname
                        </th>
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">
                          Email
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkParsed.slice(0, 10).map((row, i) => (
                        <tr key={row.email} className="border-b last:border-0">
                          <td className="py-1.5 px-3 text-muted-foreground">{i + 1}</td>
                          <td className="py-1.5 px-3 text-foreground">
                            {row.firstName || <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="py-1.5 px-3 text-foreground">
                            {row.surname || <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="py-1.5 px-3 font-mono">{row.email}</td>
                        </tr>
                      ))}
                      {bulkParsed.length > 10 && (
                        <tr>
                          <td colSpan={4} className="py-1.5 px-3 text-muted-foreground text-center">
                            ...and {bulkParsed.length - 10} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Upload results */}
            {bulkResult && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Import Results</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-bold text-green-800">{bulkResult.added}</p>
                      <p className="text-[10px] text-green-600">Added</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-lg">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">{bulkResult.skipped}</p>
                      <p className="text-[10px] text-amber-600">Skipped</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 bg-red-50 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <div>
                      <p className="text-sm font-bold text-red-800">{bulkResult.errors.length}</p>
                      <p className="text-[10px] text-red-600">Errors</p>
                    </div>
                  </div>
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-24 overflow-y-auto">
                    {bulkResult.errors.map((err, i) => (
                      <p key={i} className="text-[11px] text-red-700">
                        {err}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkOpen(false);
                resetBulk();
              }}
            >
              {bulkResult ? 'Done' : 'Cancel'}
            </Button>
            {!bulkResult && (
              <Button
                className="bg-purple-600 hover:bg-purple-700"
                onClick={handleBulkUpload}
                disabled={bulkParsed.length === 0 || bulkMutation.isPending}
              >
                {bulkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1.5" />
                )}
                Import {bulkParsed.length} Subscriber{bulkParsed.length !== 1 ? 's' : ''}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
