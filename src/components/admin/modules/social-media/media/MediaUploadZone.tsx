/**
 * The drop zone. Drag pictures onto it, or click to pick them.
 *
 * Kept separate from the library and the picker because both need it and it
 * owns awkward browser detail: `dragenter`/`dragleave` fire for child elements
 * too, so the highlight is tracked with a depth counter rather than a boolean.
 */

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Upload } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES } from '../hooks/useSocialMediaLibrary';

interface MediaUploadZoneProps {
  onFiles: (files: File[]) => void;
  isUploading?: boolean;
  /** Compact form for inside a dialog. */
  dense?: boolean;
}

export function MediaUploadZone({ onFiles, isUploading, dense }: MediaUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const limitMb = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      data-testid="media-drop-zone"
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setIsDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setIsDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setIsDragging(false);
        take(e.dataTransfer?.files ?? null);
      }}
      className={`rounded-lg border-2 border-dashed text-center transition-colors ${
        dense ? 'p-4' : 'p-8'
      } ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-muted-foreground/25 bg-muted/20'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        className="hidden"
        aria-label="Choose images to upload"
        onChange={(e) => {
          take(e.target.files);
          // Let the same file be chosen twice in a row.
          e.target.value = '';
        }}
      />
      <div className="flex flex-col items-center gap-2">
        {isUploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className={`text-muted-foreground ${dense ? 'h-5 w-5' : 'h-8 w-8'}`} />
        )}
        {!dense && (
          <p className="text-sm font-medium">
            {isUploading ? 'Uploading…' : 'Drag images here, or choose them'}
          </p>
        )}
        <Button
          variant="outline"
          size={dense ? 'sm' : 'default'}
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload images
        </Button>
        <p className="text-xs text-muted-foreground">PNG, JPEG or WebP · up to {limitMb}MB each</p>
      </div>
    </div>
  );
}
