/**
 * Estate Documents Section
 * Manages ad-hoc legal documents not tied to a specific will record.
 * E.g., trust deeds, power of attorney, codicils, pre-existing wills.
 * 
 * Follows the collapsible card pattern used in other estate planning sections.
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
  Scroll,
  Heart,
  Scale,
  Shield,
  BookOpen,
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

const ESTATE_DOCUMENT_TYPES = [
  { value: 'last_will_scanned', label: 'Last Will & Testament (Scanned)', icon: Scroll },
  { value: 'living_will_scanned', label: 'Living Will (Scanned)', icon: Heart },
  { value: 'codicil', label: 'Codicil', icon: FileText },
  { value: 'trust_deed', label: 'Trust Deed', icon: Scale },
  { value: 'power_of_attorney', label: 'Power of Attorney', icon: Shield },
  { value: 'letter_of_wishes', label: 'Letter of Wishes', icon: BookOpen },
  { value: 'other', label: 'Other Estate Document', icon: File },
] as const;

type EstateDocumentType = typeof ESTATE_DOCUMENT_TYPES[number]['value'];

const DOCUMENT_TYPE_CONFIG: Record<string, { label: string; badgeClass: string; icon: React.ElementType }> = {
  last_will_scanned: { label: 'Last Will (Scanned)', badgeClass: 'bg-purple-100 text-purple-800', icon: Scroll },
  living_will_scanned: { label: 'Living Will (Scanned)', badgeClass: 'bg-blue-100 text-blue-800', icon: Heart },
  codicil: { label: 'Codicil', badgeClass: 'bg-amber-100 text-amber-800', icon: FileText },
  trust_deed: { label: 'Trust Deed', badgeClass: 'bg-green-100 text-green-800', icon: Scale },
  power_of_attorney: { label: 'Power of Attorney', badgeClass: 'bg-red-100 text-red-800', icon: Shield },
  letter_of_wishes: { label: 'Letter of Wishes', badgeClass: 'bg-indigo-100 text-indigo-800', icon: BookOpen },
  other: { label: 'Other', badgeClass: 'bg-gray-100 text-gray-800', icon: File },
};

// ── Types ────────────────────────────────────────────────────────

interface EstateDocument {
  id: string;
  clientId: string;
  title: string;
  documentType: EstateDocumentType;
  notes: string;
  signingDate: string | null;
  fileName: string;
  fileSize: number;
  filePath: string;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
}

interface EstateDocumentsSectionProps {
  clientId: string;
  clientName: string;
}

// ── API Base ─────────────────────────────────────────────────────

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/estate-planning-fna`;

// ── Component ────────────────────────────────────────────────────

export function EstateDocumentsSection({ clientId, clientName }: EstateDocumentsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [documents, setDocuments] = useState<EstateDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EstateDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<EstateDocumentType | ''>('');
  const [notes, setNotes] = useState('');
  const [signingDate, setSigningDate] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (clientId) {
      loadDocuments();
    }
  }, [clientId]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/estate-docs/${clientId}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to load estate documents: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setDocuments(result.data || []);
      }
    } catch (error) {
      console.error('Error loading estate documents:', error);
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
      if (signingDate) formData.append('signingDate', signingDate);

      const response = await fetch(`${API_BASE}/estate-docs/${clientId}/upload`, {
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
        toast.success('Estate document uploaded successfully');
        setDocuments(prev => [result.data, ...prev]);
        resetForm();
        setUploadDialogOpen(false);
      }
    } catch (error) {
      console.error('Error uploading estate document:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (doc: EstateDocument) => {
    try {
      setDownloadingDocId(doc.id);
      const response = await fetch(`${API_BASE}/estate-docs/${clientId}/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      if (!response.ok) throw new Error('Failed to get download URL');

      const result = await response.json();
      if (result.success && result.url) {
        window.open(result.url, '_blank');
      }
    } catch (error) {
      console.error('Error downloading estate document:', error);
      toast.error('Failed to download document');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`${API_BASE}/estate-docs/${clientId}/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      if (!response.ok) throw new Error('Failed to delete document');

      toast.success('Estate document deleted');
      setDocuments(prev => prev.filter(d => d.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting estate document:', error);
      toast.error('Failed to delete document');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setTitle('');
    setDocumentType('');
    setNotes('');
    setSigningDate('');
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
              <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <Paperclip className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base font-medium">Estate Documents</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Scanned wills, trust deeds, power of attorney and other legal documents
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
                <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 border-t">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-gray-400" />
                  </div>
                </div>
                <h4 className="text-sm font-medium text-gray-900 mb-1">No Estate Documents</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Upload scanned wills, trust deeds, or other legal documents for {clientName}
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
                      <TableHead>Signing Date</TableHead>
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
                            {doc.signingDate ? formatDate(doc.signingDate) : '—'}
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
            <DialogTitle>Upload Estate Document</DialogTitle>
            <DialogDescription>
              Upload a scanned legal document for {clientName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Document Type */}
            <div className="space-y-2">
              <Label>Document Type <span className="text-red-500">*</span></Label>
              <Select
                value={documentType}
                onValueChange={(v) => setDocumentType(v as EstateDocumentType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {ESTATE_DOCUMENT_TYPES.map((dt) => (
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
                placeholder="e.g., Last Will & Testament - Signed 2025"
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

            {/* Signing Date (optional) */}
            <div className="space-y-2">
              <Label>Date of Signing <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                type="date"
                value={signingDate}
                onChange={(e) => setSigningDate(e.target.value)}
              />
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
            <AlertDialogTitle>Delete Estate Document?</AlertDialogTitle>
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