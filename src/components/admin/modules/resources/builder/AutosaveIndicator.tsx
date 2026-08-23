/**
 * AutosaveIndicator — the save-status chip in the form builder header, with
 * its relative-time formatter. Moved verbatim from FormBuilder.tsx.
 */
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/tooltip';
import { Loader2, AlertCircle, Cloud, CloudOff } from 'lucide-react';
import { type AutosaveStatus } from './hooks/useAutosave';

export function AutosaveIndicator({
  status,
  lastSavedAt,
  isNew,
  manualSaving,
}: {
  status: AutosaveStatus;
  isDirty: boolean;
  lastSavedAt: Date | null;
  isNew: boolean;
  manualSaving: boolean;
}) {
  // Format relative time
  const timeAgo = lastSavedAt ? formatTimeAgo(lastSavedAt) : null;

  // During manual save, show saving state
  if (manualSaving) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
        <span>Saving…</span>
      </div>
    );
  }

  // New resource — no autosave yet
  if (isNew) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <CloudOff className="h-3.5 w-3.5" />
        <span>Not saved yet</span>
      </div>
    );
  }

  switch (status) {
    case 'saving':
      return (
        <div className="flex items-center gap-1.5 text-xs text-purple-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Saving…</span>
        </div>
      );

    case 'saved':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-green-600 cursor-default">
              <Cloud className="h-3.5 w-3.5" />
              <span>Saved</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {timeAgo ? `Last saved ${timeAgo}` : 'All changes saved'}
          </TooltipContent>
        </Tooltip>
      );

    case 'unsaved':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-amber-600 cursor-default">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Unsaved changes</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Changes will be auto-saved in a few seconds
            {timeAgo && <p className="text-gray-400 mt-0.5">Last saved {timeAgo}</p>}
          </TooltipContent>
        </Tooltip>
      );

    case 'error':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-red-600 cursor-default">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Save failed</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Auto-save failed. Will retry shortly — or save manually.
            {timeAgo && <p className="text-gray-400 mt-0.5">Last saved {timeAgo}</p>}
          </TooltipContent>
        </Tooltip>
      );

    default:
      return null;
  }
}

// ============================================================================
// Relative time formatter — e.g. "just now", "2 min ago", "1 hr ago"
// ============================================================================
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
}
