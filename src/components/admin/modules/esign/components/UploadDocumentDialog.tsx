/**
 * Upload Document Dialog
 * Modal for uploading PDF documents and creating e-signature envelopes
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useEnvelopeActions } from '../hooks/useEnvelopeActions';
import type { Client } from '../../client-management/types';

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
  onSuccess?: (envelopeId: string) => void;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  client,
  onSuccess,
}: UploadDocumentDialogProps) {
  const { uploadDocument, uploading, uploadError } = useEnvelopeActions();

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [expiryDays, setExpiryDays] = useState<number>(30);
  const [dragActive, setDragActive] = useState(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  }, []);

  const validateAndSetFile = (selectedFile: File) => {
    const newErrors: Record<string, string> = {};

    // Validate file type
    if (!selectedFile.type.includes('pdf')) {
      newErrors.file = 'Only PDF files are supported';
      setErrors(newErrors);
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      newErrors.file = 'File size must be less than 10MB';
      setErrors(newErrors);
      return;
    }

    setFile(selectedFile);
    setErrors({});

    // Auto-populate title from filename if empty
    if (!title) {
      const fileName = selectedFile.name.replace('.pdf', '');
      setTitle(fileName);
    }
  };

  const removeFile = () => {
    setFile(null);
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!file) {
      newErrors.file = 'Please select a PDF file';
    }

    if (!title.trim()) {
      newErrors.title = 'Document title is required';
    }

    if (expiryDays < 1 || expiryDays > 365) {
      newErrors.expiryDays = 'Expiry must be between 1 and 365 days';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpload = async () => {
    if (!validateForm() || !file) return;

    try {
      const result = await uploadDocument({
        files: file ? [file] : [],
        context: {
          clientId: client.id,
          title,
          message: message.trim() || undefined,
          expiryDays,
        },
      });

      // Reset form
      setFile(null);
      setTitle('');
      setMessage('');
      setExpiryDays(30);
      setErrors({});

      // Close dialog
      onOpenChange(false);

      // Call success callback with envelope ID
      if (onSuccess && result) {
        onSuccess(result.id);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setTitle('');
    setMessage('');
    setExpiryDays(30);
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Document for E-Signature</DialogTitle>
          <DialogDescription>
            Upload a PDF document to send to {client.firstName} {client.lastName} for electronic signature
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Upload Area */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Document File *</Label>
            
            {!file ? (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-purple-500 bg-purple-50'
                    : errors.file
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Drag and drop your PDF file here
                  </p>
                  <p className="text-xs text-muted-foreground">or</p>
                  <label htmlFor="file-upload">
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer"
                      asChild
                    >
                      <span>Browse Files</span>
                    </Button>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">
                    PDF files only, max 10MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded">
                      <FileText className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {errors.file && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.file}
              </p>
            )}
          </div>

          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title">Document Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Client Agreement, Policy Application"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={errors.title ? 'border-red-300' : ''}
            />
            {errors.title && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.title}
              </p>
            )}
          </div>

          {/* Message (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="message">Message to Signer (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal message that will be included in the signing invitation..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/500
            </p>
          </div>

          {/* Expiry Days */}
          <div className="space-y-2">
            <Label htmlFor="expiryDays">Expires After (Days)</Label>
            <Input
              id="expiryDays"
              type="number"
              min={1}
              max={365}
              value={expiryDays}
              onChange={(e) => setExpiryDays(parseInt(e.target.value) || 30)}
              className={errors.expiryDays ? 'border-red-300' : ''}
            />
            {errors.expiryDays && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.expiryDays}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Document will expire on{' '}
              {new Date(
                Date.now() + expiryDays * 24 * 60 * 60 * 1000
              ).toLocaleDateString('en-ZA')}
            </p>
          </div>

          {/* Upload Error */}
          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-red-900">Upload Failed</p>
                  <p className="text-sm text-red-700 mt-1">{uploadError}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !file}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {uploading ? (
              <div className="contents">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </div>
            ) : (
              <div className="contents">
                <Upload className="h-4 w-4 mr-2" />
                Upload & Continue
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}