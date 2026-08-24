/**
 * The bar that appears once two or more fields are selected.
 *
 *
 * Renders nothing below the threshold the studio applied inline
 * (`totalSelected > 1`); the condition moved in with the markup rather than being
 * left behind at the call site.
 *
 * Split out of `PrepareFormStudio.tsx` (1,529 lines), whose `return` held the
 * toolbar, recipient strip, bulk-action bar, canvas and five dialogs together.
 * Presentational — it owns no state.
 */
import { ChevronDown, Users, Copy, Trash2, Layers } from 'lucide-react';
import type { SignerFormData } from '../../types';
import { SIGNER_COLORS } from '../../constants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../../ui/dropdown-menu';

interface BulkActionBarProps {
  eligibleSigners: SignerFormData[];
  handleApplyToAllPages: () => void;
  handleBulkDelete: () => void;
  handleBulkReassign: (signerId: string) => void;
  handleBulkRequired: (required: boolean) => void;
  handleDuplicate: () => void;
  pageCount: number;
  totalSelected: number;
}

export function BulkActionBar({
  eligibleSigners,
  handleApplyToAllPages,
  handleBulkDelete,
  handleBulkReassign,
  handleBulkRequired,
  handleDuplicate,
  pageCount,
  totalSelected,
}: BulkActionBarProps) {
  if (!(totalSelected > 1)) return null;

  return (
    <div className="bg-purple-600 text-white px-4 py-1.5 flex items-center gap-3 text-sm shrink-0">
      <span className="font-medium">{totalSelected} fields selected</span>
      <div className="h-4 w-px bg-white/30" />
      <button
        type="button"
        onClick={handleDuplicate}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10"
      >
        <Copy className="h-3.5 w-3.5" />
        Duplicate
      </button>
      {pageCount > 1 && (
        <button
          type="button"
          onClick={handleApplyToAllPages}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10"
          title={`Replicate selection to all ${pageCount} pages`}
        >
          <Layers className="h-3.5 w-3.5" />
          Apply to all pages
        </button>
      )}

      {/* Bulk reassign — dropdown of eligible (non-cc) signers. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10"
          >
            <Users className="h-3.5 w-3.5" />
            Reassign
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {eligibleSigners.length === 0 ? (
            <DropdownMenuItem disabled>No eligible signers</DropdownMenuItem>
          ) : (
            eligibleSigners.map((s, idx) => {
              const color = SIGNER_COLORS[idx % SIGNER_COLORS.length].hex;
              return (
                <DropdownMenuItem
                  key={s.email}
                  onSelect={() => handleBulkReassign(s.email)}
                  className="flex items-center gap-2"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate">{s.name}</span>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={() => handleBulkRequired(true)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10"
        title="Mark all selected as required"
      >
        Required
      </button>
      <button
        type="button"
        onClick={() => handleBulkRequired(false)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10"
        title="Mark all selected as optional"
      >
        Optional
      </button>

      <button
        type="button"
        onClick={handleBulkDelete}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
      <div className="ml-auto text-xs opacity-80">
        ⌘/Ctrl + C / V / D · Backspace to delete · Esc to clear
      </div>
    </div>
  );
}
