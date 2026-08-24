/**
 * Presentational chrome of the note editor modal: the auto-save status
 * indicator and the markdown help tooltip. Moved verbatim from
 * NoteEditorModal.tsx.
 */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../ui/tooltip';
import { Cloud, CloudOff, HelpCircle, Loader2 } from 'lucide-react';
import type { AutoSaveStatus } from '../hooks';

export function AutoSaveIndicator({ status }: { status: AutoSaveStatus }) {
  if (status === 'idle') return null;

  const configs: Record<
    Exclude<AutoSaveStatus, 'idle'>,
    { icon: React.ReactNode; text: string; className: string }
  > = {
    saving: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      text: 'Saving...',
      className: 'text-gray-400',
    },
    saved: {
      icon: <Cloud className="h-3 w-3" />,
      text: 'Saved',
      className: 'text-green-500',
    },
    error: {
      icon: <CloudOff className="h-3 w-3" />,
      text: 'Save failed',
      className: 'text-red-500',
    },
  };

  const cfg = configs[status];

  return (
    <span className={`flex items-center gap-1 text-[11px] ${cfg.className} transition-opacity`}>
      {cfg.icon}
      {cfg.text}
    </span>
  );
}

// ============================================================================
// MARKDOWN HELP TOOLTIP
// ============================================================================

export function MarkdownHelpTooltip() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-gray-400 hover:text-gray-500 transition-colors">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed p-3">
          <p className="font-semibold mb-1">Markdown shortcuts</p>
          <div className="space-y-0.5 text-gray-600">
            <p>
              <code className="bg-gray-100 px-1 rounded">**bold**</code> → <strong>bold</strong>
            </p>
            <p>
              <code className="bg-gray-100 px-1 rounded">*italic*</code> → <em>italic</em>
            </p>
            <p>
              <code className="bg-gray-100 px-1 rounded"># Heading</code> → heading
            </p>
            <p>
              <code className="bg-gray-100 px-1 rounded">- item</code> → bullet list
            </p>
            <p>
              <code className="bg-gray-100 px-1 rounded">1. item</code> → numbered list
            </p>
            <p>
              <code className="bg-gray-100 px-1 rounded">- [ ] task</code> → checklist
            </p>
            <p>
              <code className="bg-gray-100 px-1 rounded">`code`</code> →{' '}
              <code className="bg-gray-100 px-0.5 text-pink-600 rounded">code</code>
            </p>
            <p>
              <code className="bg-gray-100 px-1 rounded">&gt; quote</code> → blockquote
            </p>
            <p>
              <code className="bg-gray-100 px-1 rounded">[text](url)</code> → link
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
