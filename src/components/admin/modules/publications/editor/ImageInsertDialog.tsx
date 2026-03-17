/**
 * ImageInsertDialog — Inline image insertion dialog
 *
 * Allows the author to insert images into the article body via:
 * 1. Direct URL input
 * 2. File upload to Supabase Storage (reuses publications bucket)
 *
 * Also supports alt-text and optional caption.
 *
 * @module publications/editor/ImageInsertDialog
 */

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Link as LinkIcon,
  Loader2,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { cn } from '../../../../ui/utils';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

interface ImageInsertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (url: string, alt: string) => void;
}

export function ImageInsertDialog({
  isOpen,
  onClose,
  onInsert,
}: ImageInsertDialogProps) {
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [url, setUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications`;

  const handleUrlSubmit = () => {
    if (!url.trim()) {
      setError('Please enter an image URL');
      return;
    }
    onInsert(url.trim(), altText.trim() || 'Article image');
    resetAndClose();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${baseUrl}/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      const uploadedUrl = data.url || data.data?.url;

      if (!uploadedUrl) {
        throw new Error('No URL returned from upload');
      }

      setUrl(uploadedUrl);
      setPreview(uploadedUrl);
    } catch (err) {
      console.error('Image upload error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to upload image'
      );
    } finally {
      setUploading(false);
    }
  };

  const resetAndClose = () => {
    setUrl('');
    setAltText('');
    setError(null);
    setPreview(null);
    setMode('url');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Insert Image</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetAndClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setMode('url')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2',
              mode === 'url'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <LinkIcon className="h-4 w-4 inline mr-2" />
            URL
          </button>
          <button
            onClick={() => setMode('upload')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2',
              mode === 'upload'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Upload className="h-4 w-4 inline mr-2" />
            Upload
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {mode === 'url' ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="image-url" className="text-sm font-medium text-gray-700">
                  Image URL
                </Label>
                <Input
                  id="image-url"
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setPreview(e.target.value);
                    setError(null);
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="mt-1"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                  uploading
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50'
                )}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                    <span className="text-sm text-purple-600">Uploading...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Click to select or drag an image
                    </span>
                    <span className="text-xs text-gray-400">
                      PNG, JPG, WebP up to 5MB
                    </span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Alt text */}
          <div>
            <Label htmlFor="image-alt" className="text-sm font-medium text-gray-700">
              Alt Text
            </Label>
            <Input
              id="image-alt"
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Describe the image for accessibility"
              className="mt-1"
            />
            <p className="text-xs text-gray-400 mt-1">
              Required for accessibility (WCAG 2.1 AA)
            </p>
          </div>

          {/* Preview */}
          {preview && (
            <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              <img
                src={preview}
                alt={altText || 'Preview'}
                className="max-h-40 w-full object-contain"
                onError={() => setError('Failed to load image preview')}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <Button variant="outline" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button
            onClick={handleUrlSubmit}
            disabled={!url.trim() || uploading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Insert Image
          </Button>
        </div>
      </div>
    </div>
  );
}
