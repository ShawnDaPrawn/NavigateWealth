/**
 * Portfolio Summary — Document Upload Modal
 * Modal for uploading documents to the secure vault.
 * Submits files via the documents API layer.
 * Guidelines §7 (presentation + local UI state), §8.3 (form patterns).
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { Upload, Loader2, CheckCircle, FileText, X } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../../../auth/AuthContext';
import { useUploadDocument } from '../hooks';

interface DocumentUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Document categories (Guidelines §5.3) ──
const DOCUMENT_CATEGORIES = [
  { value: 'Retirement', label: 'Retirement Planning' },
  { value: 'Life', label: 'Risk Management' },
  { value: 'Investment', label: 'Investment' },
  { value: 'Estate', label: 'Estate Planning' },
  { value: 'Medical Aid', label: 'Medical Aid' },
  { value: 'Short-Term', label: 'Short-Term Insurance' },
  { value: 'General', label: 'Personal Documents' },
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUploadModal({ open, onOpenChange }: DocumentUploadModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const uploadMutation = useUploadDocument();

  const canSubmit = file !== null && title.trim() !== '' && category !== '';

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      toast.error('Unsupported file type', {
        description: 'Please upload a PDF, JPG, or PNG file.',
      });
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error('File too large', {
        description: 'Maximum file size is 10MB.',
      });
      return;
    }
    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  }, [title]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFileSelect(dropped);
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) handleFileSelect(selected);
    },
    [handleFileSelect],
  );

  const handleSubmit = async () => {
    if (!user?.id || !file || !canSubmit) return;

    const result = await uploadMutation.mutateAsync({
      file,
      title: title.trim(),
      category,
      userId: user.id,
    });

    if (result.success) {
      setSubmitted(true);
      toast.success('Document uploaded', {
        description: 'Your document has been securely stored.',
      });
    } else {
      toast.error('Upload failed', {
        description: result.error || 'Please try again later.',
      });
    }
  };

  const handleClose = () => {
    setFile(null);
    setTitle('');
    setCategory('');
    setSubmitted(false);
    setIsDragging(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Upload className="h-6 w-6 text-green-600" />
            <span>Upload Document</span>
          </DialogTitle>
          <DialogDescription>
            Add documents to your secure document vault
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center py-10 text-center">
            <CheckCircle className="h-14 w-14 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-black mb-2">
              Upload Complete
            </h3>
            <p className="text-sm text-gray-600 max-w-md">
              <strong>{title}</strong> has been securely uploaded to your document vault
              under <strong>{DOCUMENT_CATEGORIES.find((c) => c.value === category)?.label || category}</strong>.
            </p>
            <Button className="mt-6" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <Label className="text-black mb-2 block">Document Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="document-name" className="text-black mb-2 block">
                Document Name
              </Label>
              <Input
                id="document-name"
                placeholder="Enter document name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Drop zone */}
            {file ? (
              <div className="border border-gray-200 rounded-lg p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-black truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <h4 className="text-black mb-1">Choose file to upload</h4>
                <p className="text-gray-600 text-sm">Drag & drop or click to browse</p>
                <p className="text-xs text-gray-500 mt-2">Supported: PDF, JPG, PNG (Max: 10MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleInputChange}
                />
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                disabled={!canSubmit || uploadMutation.isPending}
                onClick={handleSubmit}
              >
                {uploadMutation.isPending ? (
                  <div className="contents">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </div>
                ) : (
                  'Upload Document'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}