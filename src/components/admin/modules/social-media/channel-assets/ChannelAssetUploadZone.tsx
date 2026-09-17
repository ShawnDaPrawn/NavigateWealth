/**
 * Drop images or videos onto a channel.
 *
 * Adapted from the earlier media drop zone; the depth counter is still there
 * because `dragenter`/`dragleave` fire for child elements too, so a boolean
 * flickers as the pointer crosses the label inside.
 */

import { useRef, useState } from 'react';
import { FilmIcon, ImagePlus, Loader2, Upload } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { ACCEPT_ATTRIBUTE, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '../hooks/useChannelAssets';

interface ChannelAssetUploadZoneProps {
  channelLabel: string;
  onFiles: (files: File[]) => void;
  isUploading?: boolean;
}

export function ChannelAssetUploadZone({
  channelLabel,
  onFiles,
  isUploading,
}: ChannelAssetUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const imageMb = Math.round(MAX_IMAGE_BYTES / 1024 / 1024);
  const videoMb = Math.round(MAX_VIDEO_BYTES / 1024 / 1024);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      data-testid="channel-asset-drop-zone"
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
      className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-muted-foreground/25 bg-muted/20'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        className="hidden"
        aria-label={`Choose files for ${channelLabel}`}
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
          <div className="flex items-center gap-2 text-muted-foreground">
            <ImagePlus className="h-7 w-7" />
            <FilmIcon className="h-7 w-7" />
          </div>
        )}
        <p className="text-sm font-medium">
          {isUploading ? 'Uploading…' : `Drag files here for ${channelLabel}`}
        </p>
        <Button variant="outline" disabled={isUploading} onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          Choose files
        </Button>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG or WebP up to {imageMb}MB · MP4, MOV or WebM up to {videoMb}MB
        </p>
      </div>
    </div>
  );
}
