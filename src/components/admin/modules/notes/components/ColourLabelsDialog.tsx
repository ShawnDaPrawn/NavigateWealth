/**
 * ColourLabelsDialog — Editor for custom colour descriptions
 *
 * §7 — Presentation + local UI state only
 * §8.3 — Admin panel dialog patterns
 *
 * Lets the user assign a meaningful description to each note colour,
 * e.g. Green → "New Business", Red → "Follow Up".
 */

import { useState, useEffect, useCallback } from 'react';
import type { NoteColor, CustomColourLabels } from '../types';
import { NOTE_COLOR_CONFIG, NOTE_COLORS } from '../constants';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '../../../../ui/dialog';
import { Palette, RotateCcw } from 'lucide-react';

interface ColourLabelsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The useColourLabels hook return value */
  labels: {
    customLabels: CustomColourLabels;
    setAllLabels: (labels: CustomColourLabels) => void;
  };
  personnelId: string;
}

export function ColourLabelsDialog({
  isOpen,
  onClose,
  labels,
}: ColourLabelsDialogProps) {
  const { customLabels, setAllLabels } = labels;
  // Local draft state — only committed on Save
  const [draft, setDraft] = useState<Record<NoteColor, string>>(() => buildDraft(customLabels));

  // Reset draft when dialog opens
  useEffect(() => {
    if (isOpen) {
      setDraft(buildDraft(customLabels));
    }
  }, [isOpen, customLabels]);

  const handleChange = useCallback((color: NoteColor, value: string) => {
    setDraft((prev) => ({ ...prev, [color]: value }));
  }, []);

  const handleClearAll = useCallback(() => {
    const cleared: Record<NoteColor, string> = {} as Record<NoteColor, string>;
    NOTE_COLORS.forEach((c) => { cleared[c] = ''; });
    setDraft(cleared);
  }, []);

  const handleSave = useCallback(() => {
    // Convert to CustomColourLabels (only non-empty entries)
    const labels: CustomColourLabels = {};
    for (const color of NOTE_COLORS) {
      const val = draft[color]?.trim();
      if (val) {
        labels[color] = val;
      }
    }
    setAllLabels(labels);
    onClose();
  }, [draft, setAllLabels, onClose]);

  const hasAnyLabel = NOTE_COLORS.some((c) => draft[c]?.trim());

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
            <Palette className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold text-gray-900">
              Colour Labels
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Assign a description to each colour for quick identification.
            </p>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          {NOTE_COLORS.map((color) => {
            const cfg = NOTE_COLOR_CONFIG[color];
            return (
              <div key={color} className="flex items-center gap-3">
                {/* Colour indicator */}
                <div className={`w-8 h-8 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
                  <div className={`w-4 h-4 rounded-full ${cfg.dot}`} />
                </div>
                {/* Default name */}
                <Label className="text-xs font-medium text-gray-500 w-12 shrink-0">
                  {cfg.label}
                </Label>
                {/* Custom description input */}
                <Input
                  value={draft[color] || ''}
                  onChange={(e) => handleChange(color, e.target.value)}
                  placeholder={`e.g. ${getPlaceholder(color)}`}
                  className="h-8 text-sm flex-1"
                />
              </div>
            );
          })}
        </div>

        {/* Preview */}
        {hasAnyLabel && (
          <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Preview</p>
            <div className="flex flex-wrap gap-2">
              {NOTE_COLORS.map((color) => {
                const label = draft[color]?.trim();
                if (!label) return null;
                const cfg = NOTE_COLOR_CONFIG[color];
                return (
                  <span
                    key={color}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} border ${cfg.border}`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div>
            {hasAnyLabel && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-400 hover:text-gray-600 gap-1"
                onClick={handleClearAll}
              >
                <RotateCcw className="h-3 w-3" />
                Clear All
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleSave}
            >
              Save Labels
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function buildDraft(customLabels: CustomColourLabels): Record<NoteColor, string> {
  const draft: Record<NoteColor, string> = {} as Record<NoteColor, string>;
  NOTE_COLORS.forEach((c) => {
    draft[c] = customLabels[c] || '';
  });
  return draft;
}

/** Contextual placeholder hints per colour */
function getPlaceholder(color: NoteColor): string {
  switch (color) {
    case 'default': return 'General';
    case 'yellow':  return 'In Progress';
    case 'green':   return 'New Business';
    case 'blue':    return 'Research';
    case 'purple':  return 'VIP Client';
    case 'pink':    return 'Urgent';
    case 'orange':  return 'Follow Up';
    default:        return 'Description';
  }
}