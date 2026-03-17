/**
 * Tax Documents Section
 * Manages ad-hoc tax documents not tied to a specific tax policy record.
 * E.g., tax returns, IRP5 certificates, IT3 forms, SARS assessments, tax clearance certificates.
 *
 * Follows the collapsible card pattern established by EstateDocumentsSection (per Guidelines §8.1).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Download,
  Trash2,
  Plus,
  Loader2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Receipt,
  FileCheck,
  FileSpreadsheet,
  ClipboardCheck,
  ShieldCheck,
  File,
  Paperclip,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

// ── Constants ────────────────────────────────────────────────────

const TAX_DOCUMENT_TYPES = [
  { value: 'tax_return', label: 'Tax Return (ITR12)', icon: Receipt },
  { value: 'irp5', label: 'IRP5 Certificate', icon: FileSpreadsheet },
  { value: 'it3', label: 'IT3 Certificate', icon: FileSpreadsheet },
  { value: 'sars_assessment', label: 'SARS Assessment', icon: FileCheck },
  { value: 'tax_clearance', label: 'Tax Clearance Certificate', icon: ShieldCheck },
  { value: 'provisional_tax', label: 'Provisional Tax Return', icon: ClipboardCheck },
  { value: 'supporting_schedule', label: 'Supporting Schedule', icon: FileText },
  { value: 'correspondence', label: 'SARS Correspondence', icon: FileText },
  { value: 'other', label: 'Other Tax Document', icon: File },
] as const;

type TaxDocumentType = typeof TAX_DOCUMENT_TYPES[number]['value'];

const DOCUMENT_TYPE_CONFIG: Record<string, { label: string; badgeClass: string; icon: React.ElementType }> = {
  tax_return: { label: 'Tax Return', badgeClass: 'bg-blue-100 text-blue-800', icon: Receipt },
  irp5: { label: 'IRP5', badgeClass: 'bg-green-100 text-green-800', icon: FileSpreadsheet },
  it3: { label: 'IT3', badgeClass: 'bg-teal-100 text-teal-800', icon: FileSpreadsheet },
  sars_assessment: { label: 'SARS Assessment', badgeClass: 'bg-purple-100 text-purple-800', icon: FileCheck },
  tax_clearance: { label: 'Tax Clearance', badgeClass: 'bg-emerald-100 text-emerald-800', icon: ShieldCheck },
  provisional_tax: { label: 'Provisional Tax', badgeClass: 'bg-amber-100 text-amber-800', icon: ClipboardCheck },
  supporting_schedule: { label: 'Schedule', badgeClass: 'bg-indigo-100 text-indigo-800', icon: FileText },
  correspondence: { label: 'SARS Correspondence', badgeClass: 'bg-orange-100 text-orange-800', icon: FileText },
  other: { label: 'Other', badgeClass: 'bg-gray-100 text-gray-800', icon: File },
};

// ── Types ────────────────────────────────────────────────────────

interface TaxDocument {
  id: string;
  clientId: string;
  title: string;
  documentType: TaxDocumentType;
  taxYear: string;
  notes: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
}

interface TaxDocumentsSectionProps {
  clientId: string;
  clientName: string;
}

// ── API Base ─────────────────────────────────────────────────────

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/tax-planning-fna`;

// ── Component ────────────────────────────────────────────────────

export function TaxDocumentsSection({ clientId, clientName }: TaxDocumentsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaxDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<TaxDocumentType | ''>('');
  const [taxYear, setTaxYear] = useState('');
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate tax year options (current year down to 10 years ago)
  const currentYear = new Date().getFullYear();
  const taxYearOptions = Array.from({ length: 11 }, (_, i) => {
    const year = currentYear - i;
    return { value: `${year}`, label: `${year}/${year + 1}` };
  });

  useEffect(() => {
    if (clientId) {
      loadDocuments();
    }
  }, [clientId]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/tax-docs/${clientId}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to load tax documents: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setDocuments(result.data || []);
      }
    } catch (error) {
      console.error('Error loading tax documents:', error);
      // Silently fail on first load — not critical to page render
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title || !documentType) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', title);
      formData.append('documentType', documentType);
      formData.append('notes', notes);
      if (taxYear) formData.append('taxYear', taxYear);

      const response = await fetch(`${API_BASE}/tax-docs/${clientId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to upload document');
      }

      const result = await response.json();
      if (result.success) {
        toast.success('Tax document uploaded successfully');
        setDocuments(prev => [result.data, ...prev]);
        resetForm();
        setUploadDialogOpen(false);
      }
    } catch (error) {
      console.error('Error uploading tax document:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (doc: TaxDocument) => {
    try {
      setDownloadingDocId(doc.id);
      const response = await fetch(`${API_BASE}/tax-docs/${clientId}/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      if (!response.ok) throw new Error('Failed to get download URL');

      const result = await response.json();
      if (result.success && result.url) {
        window.open(result.url, '_blank');
      }
    } catch (error) {
      console.error('Error downloading tax document:', error);
      toast.error('Failed to download document');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`${API_BASE}/tax-docs/${clientId}/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      if (!response.ok) throw new Error('Failed to delete document');

      toast.success('Tax document deleted');
      setDocuments(prev => prev.filter(d => d.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting tax document:', error);
      toast.error('Failed to delete document');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setTitle('');
    setDocumentType('');
    setTaxYear('');
    setNotes('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const getDocTypeConfig = (type: string) => {
    return DOCUMENT_TYPE_CONFIG[type] || DOCUMENT_TYPE_CONFIG.other;
  };

  return (
    <div className="space-y-0">
      {/* Collapsible Header */}
      <Card>
        <CardHeader
          className="cursor-pointer py-4"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Paperclip className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base font-medium">Tax Documents</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Tax returns, IRP5s, SARS assessments, and other tax documents
                </p>
              </div>
              {documents.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {documents.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setUploadDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 border-t">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-gray-400" />
                  </div>
                </div>
                <h4 className="text-sm font-medium text-gray-900 mb-1">No Tax Documents</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Upload tax returns, IRP5 certificates, or other tax documents for {clientName}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload First Document
                </Button>
              </div>
            ) : (
              <div className="border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Tax Year</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => {
                      const config = getDocTypeConfig(doc.documentType);
                      const DocIcon = config.icon;
                      return (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <DocIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div>
                                <p className="font-medium text-sm">{doc.title}</p>
                                <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={config.badgeClass}>
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {doc.taxYear ? `${doc.taxYear}/${parseInt(doc.taxYear) + 1}` : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(doc.uploadedAt)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatFileSize(doc.fileSize)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(doc)}
                                disabled={downloadingDocId === doc.id}
                              >
                                {downloadingDocId === doc.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(doc)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Tax Document</DialogTitle>
            <DialogDescription>
              Upload a tax document for {clientName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Document Type */}
            <div className="space-y-2">
              <Label>Document Type <span className="text-red-500">*</span></Label>
              <Select
                value={documentType}
                onValueChange={(v) => setDocumentType(v as TaxDocumentType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {TAX_DOCUMENT_TYPES.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>
                      {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., IRP5 - ABC Employer - 2025/2026"
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>File <span className="text-red-500">*</span></Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center relative">
                {selectedFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="text-left">
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(selectedFile.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Click to select or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, JPEG, or PNG (max 50MB)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setSelectedFile(file);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Tax Year (optional) */}
            <div className="space-y-2">
              <Label>Tax Year <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select
                value={taxYear}
                onValueChange={(v) => setTaxYear(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tax year" />
                </SelectTrigger>
                <SelectContent>
                  {taxYearOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes (optional) */}
            <div className="space-y-2">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any relevant notes about this document..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setUploadDialogOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={isUploading || !selectedFile || !title || !documentType}>
              {isUploading ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </div>
              ) : (
                <div className="contents">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tax Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.title}&rdquo;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </div>
              ) : (
                <div className="contents">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </div>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
