/**
 * Document Upload Step
 * Step 1 of the Envelope Creation Wizard
 * Supports drag & drop, file validation, and metadata entry
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Button } from '../../../../ui/button';
import { 
  Upload, 
  FileText, 
  XCircle, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';

interface DocumentUploadStepProps {
  onNext: (files: File[], title: string, message: string, expiryDays: number) => void;
  onCancel: () => void;
  initialData?: {
    files?: File[];
    title?: string;
    message?: string;
    expiryDays?: number;
  };
  /** Override the outer container className (default: 'max-w-4xl mx-auto space-y-6') */
  containerClassName?: string;
  /** Hide the internal header (title + subtitle) when the parent provides its own */
  hideHeader?: boolean;
  /** Hide the bottom navigation buttons when the parent provides its own */
  hideFooter?: boolean;
}

export function DocumentUploadStep({ onNext, onCancel, initialData, containerClassName, hideHeader, hideFooter }: DocumentUploadStepProps) {
  const [files, setFiles] = useState<File[]>(initialData?.files || []);
  const [title, setTitle] = useState(initialData?.title || '');
  const [message, setMessage] = useState(initialData?.message || '');
  const [expiryDays, setExpiryDays] = useState<number>(initialData?.expiryDays || 30);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const isPdf = file.type === 'application/pdf';
      return isPdf;
    });

    if (validFiles.length !== newFiles.length) {
      setError('Only PDF files are currently supported.');
    } else {
      setError(null);
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      // Auto-set title if empty
      if (!title && validFiles[0]) {
        setTitle(validFiles[0].name.replace(/\.pdf$/i, ''));
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    if (files.length === 0) {
      setError('Please upload at least one document.');
      return;
    }
    if (!title.trim()) {
      setError('Please provide a title for the envelope.');
      return;
    }
    onNext(files, title, message, expiryDays);
  };

  return (
    <div className={containerClassName ?? 'max-w-4xl mx-auto space-y-6'}>
      {!hideHeader && (
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">Add Documents</h2>
        <p className="text-sm text-gray-500">Upload the files you want to send for signature.</p>
      </div>
      )}

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Upload Zone */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-10 text-center transition-all ${
              dragActive
                ? 'border-purple-500 bg-purple-50 scale-[1.01]'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer block w-full h-full">
              <div className="space-y-4">
                <div className="h-16 w-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto">
                  <Upload className="h-8 w-8" />
                </div>
                <div>
                   <p className="font-medium text-gray-900 text-lg">
                    Drop files here or click to upload
                  </p>
                  <p className="text-sm text-gray-500 mt-1">PDF files only</p>
                </div>
              </div>
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Uploaded Documents</Label>
                <span className="text-xs text-muted-foreground">{files.length} file{files.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="max-h-[30vh] overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white">
                <div className="grid gap-0 divide-y divide-gray-100">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-10 w-10 bg-white border rounded flex items-center justify-center flex-shrink-0 text-red-500 font-bold text-xs">
                          PDF
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-red-500 flex-shrink-0"
                      >
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Details Form */}
          <div className="grid gap-6 md:grid-cols-2 pt-4 border-t">
             <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Envelope Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Sales Contract - Acme Corp"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="message">Email Message (Optional)</Label>
              <Input
                id="message"
                placeholder="Please review and sign..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="space-y-2">
               <Label htmlFor="expiry">Days to expire</Label>
               <Input
                 id="expiry"
                 type="number"
                 min="1"
                 max="365"
                 value={expiryDays}
                 onChange={(e) => setExpiryDays(parseInt(e.target.value) || 30)}
               />
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {!hideFooter && (
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button 
          onClick={handleContinue}
          disabled={files.length === 0 || !title}
          className="bg-purple-600 hover:bg-purple-700"
        >
          Next: Add Recipients
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
      )}
    </div>
  );
}