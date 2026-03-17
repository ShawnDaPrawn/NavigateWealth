/**
 * Reusable Document Upload Component
 * Handles file uploads with validation and preview
 */

import React, { useRef } from 'react';
import { Button } from '../../ui/button';
import { Upload, FileText, CheckCircle, X } from 'lucide-react';

interface DocumentUploadProps {
  label: string;
  fileName?: string;
  fileSize?: number;
  onUpload: (file: File) => void;
  onRemove?: () => void;
  disabled?: boolean;
  required?: boolean;
  accept?: string;
  maxSize?: number; // in MB
  hint?: string;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  label,
  fileName,
  fileSize,
  onUpload,
  onRemove,
  disabled = false,
  required = false,
  accept = '.pdf,.jpg,.jpeg,.png',
  maxSize = 5,
  hint = `Accepted formats: PDF, JPG, PNG (Max ${maxSize}MB)`,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File size must be less than ${maxSize}MB`);
      return;
    }

    // Validate file type
    const validTypes = accept.split(',').map(t => {
      if (t === '.pdf') return 'application/pdf';
      if (t === '.jpg' || t === '.jpeg') return 'image/jpeg';
      if (t === '.png') return 'image/png';
      return t;
    });

    if (!validTypes.includes(file.type)) {
      alert(`Please upload a valid file type: ${accept}`);
      return;
    }

    onUpload(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      </div>

      {fileName ? (
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-sm text-green-900">{fileName}</p>
              {fileSize && (
                <p className="text-xs text-green-700">{formatFileSize(fileSize)}</p>
              )}
            </div>
          </div>
          {onRemove && !disabled && (
            <Button
              onClick={onRemove}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-green-100"
            >
              <X className="h-4 w-4 text-green-700" />
            </Button>
          )}
        </div>
      ) : (
        <div className="contents">
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            disabled={disabled}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            variant="outline"
            className="w-full border-dashed border-2 border-gray-300 hover:border-[#6d28d9] hover:bg-[#6d28d9]/5"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>
      )}

      {hint && !fileName && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
};