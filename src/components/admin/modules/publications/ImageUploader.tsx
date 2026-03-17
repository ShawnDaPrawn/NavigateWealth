import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, Link } from 'lucide-react';
import { Button } from '../../../ui/button';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  label: string;
  previewHeight?: string;
}

export function ImageUploader({ value, onChange, label, previewHeight = 'h-48' }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications`;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Upload to server endpoint
      const response = await fetch(`${baseUrl}/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload image');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to upload image');
      }

      onChange(data.data.url);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
      setShowUrlInput(false);
    }
  };

  const handleRemove = () => {
    onChange('');
    setError(null);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {value ? (
        <div className="space-y-2">
          <div className={`relative ${previewHeight} bg-gray-100 rounded-lg overflow-hidden group`}>
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EImage not found%3C/text%3E%3C/svg%3E';
              }}
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemove}
                className="bg-white hover:bg-gray-100"
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500 truncate">{value}</p>
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {showUrlInput ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <Button onClick={handleUrlSubmit} size="sm">
                  Add
                </Button>
                <Button onClick={() => setShowUrlInput(false)} variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className={`border-2 border-dashed border-gray-300 rounded-lg ${previewHeight} flex flex-col items-center justify-center gap-3 hover:border-purple-400 transition-colors`}>
              <ImageIcon className="h-12 w-12 text-gray-400" />
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">Upload an image or add URL</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <div className="contents">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </div>
                    ) : (
                      <div className="contents">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload File
                      </div>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUrlInput(true)}
                  >
                    <Link className="h-4 w-4 mr-2" />
                    Add URL
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Max size: 5MB</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}