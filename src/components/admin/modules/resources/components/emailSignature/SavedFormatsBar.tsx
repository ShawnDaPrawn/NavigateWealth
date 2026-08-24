/**
 * The saved-format strip: load, delete, or open the save dialog.
 *
 * Split out of `EmailSignatureGenerator.tsx` (1,640 lines). Presentational —
 * it owns no state; everything it needs arrives as a prop.
 */
import { Button } from '../../../../../ui/button';
import { Bookmark, FolderOpen, Trash2 } from 'lucide-react';
import { type SavedFormat } from './signatureModel';

interface SavedFormatsBarProps {
  savedFormats: SavedFormat[];
  onOpenSaveDialog: () => void;
  onLoadFormat: (format: SavedFormat) => void;
  onDeleteFormat: (id: string) => void;
}

export function SavedFormatsBar({
  savedFormats,
  onOpenSaveDialog,
  onLoadFormat,
  onDeleteFormat,
}: SavedFormatsBarProps) {
  return (
    <div className="rounded-xl border bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-purple-50">
            <FolderOpen className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <span className="text-sm font-semibold">Saved Formats</span>
          {savedFormats.length > 0 && (
            <span className="text-[10px] bg-purple-100 text-purple-700 font-medium px-1.5 py-0.5 rounded-full">
              {savedFormats.length}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
          onClick={onOpenSaveDialog}
        >
          <Bookmark className="h-3 w-3 mr-1.5" />
          Save current
        </Button>
      </div>

      {savedFormats.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-muted-foreground">
            No saved formats yet. Configure branding settings and click{' '}
            <button
              className="text-purple-600 underline underline-offset-2"
              onClick={onOpenSaveDialog}
            >
              Save Format
            </button>{' '}
            to reuse them for other personnel.
          </p>
        </div>
      ) : (
        <div className="p-3 flex flex-wrap gap-2">
          {savedFormats.map((fmt) => (
            <div
              key={fmt.id}
              className="group flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg border border-border bg-gray-50 hover:border-purple-300 hover:bg-purple-50/50 transition-colors"
            >
              {/* Colour swatch */}
              <div
                className="h-3 w-3 rounded-full shrink-0 ring-1 ring-white ring-offset-1 ring-offset-gray-50"
                style={{ backgroundColor: (fmt.fields.primaryColour as string) || '#6d28d9' }}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate max-w-[120px]">
                  {fmt.name}
                </p>
                <p className="text-[10px] text-muted-foreground capitalize">{fmt.template}</p>
              </div>
              <div className="flex items-center gap-0.5 ml-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                  onClick={() => onLoadFormat(fmt)}
                  title="Load this format"
                >
                  Load
                </Button>
                <button
                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={() => onDeleteFormat(fmt.id)}
                  title="Delete format"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
