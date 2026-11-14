/**
 * Drop images or videos onto a channel.
 *
 * Adapted from the earlier media drop zone; the depth counter is still there
 * because `dragenter`/`dragleave` fire for child elements too, so a boolean
 * flickers as the pointer crosses the label inside.
 */

import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

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
      className={`rounded-xl border border-dashed px-4 py-[18px] text-center text-[13.5px] transition-colors ${
        isDragging ? 'border-nw-violet bg-nw-violet-50' : 'border-[#c4c8cf] bg-white'
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
      {isUploading ? (
        <span className="inline-flex items-center gap-2 text-nw-text-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Uploading…
        </span>
      ) : (
        <span className="text-nw-text-2">
          Drop finished images or videos for {channelLabel}, or{' '}
          <button
            type="button"
            className="font-medium text-nw-violet underline underline-offset-2 hover:text-nw-violet-600"
            onClick={() => inputRef.current?.click()}
          >
            choose files
          </button>
          <span className="ds-meta mt-1 block">
            PNG, JPEG or WebP up to {imageMb}MB · MP4, MOV or WebM up to {videoMb}MB
          </span>
        </span>
      )}
    </div>
  );
}
