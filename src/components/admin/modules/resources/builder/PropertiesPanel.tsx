import React from 'react';
import { FormBlock } from './types';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Trash2, ChevronUp, ChevronDown, Copy, Mail, User, FileText, Hash, Calendar, Pen, Plus, X, Type } from 'lucide-react';
import { getBlockDefinition } from './registry';
import type { LetterMeta, Signatory } from '../templates/LetterheadPdfLayout';
import { resolveSignatories } from '../templates/LetterheadPdfLayout';
import type { Recipient } from '../templates/LetterheadPdfLayout';
import { resolveRecipients } from '../templates/LetterheadPdfLayout';

// Phase 2 — Conditional Logic
import { ConditionalLogicEditor } from './components/ConditionalLogicEditor';
import type { BlockVisibilityRule } from './constants';

interface PropertiesPanelProps {
  block: FormBlock | null;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onMove?: (id: string, direction: 'up' | 'down') => void;
  onDuplicate?: (id: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  /** Current resource category — used to show letter settings */
  category?: string;
  /** Letter metadata (only for Letters category) */
  letterMeta?: LetterMeta;
  /** Callback to update letter metadata */
  onLetterMetaChange?: (meta: LetterMeta) => void;
}

export const PropertiesPanel = ({ 
  block, 
  onUpdate, 
  onDelete,
  onMove,
  onDuplicate,
  isFirst = false,
  isLast = false,
  category,
  letterMeta,
  onLetterMetaChange,
}: PropertiesPanelProps) => {
  const isLetterMode = category === 'Letters';

  // -- No block selected --
  if (!block) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
        {isLetterMode && letterMeta && onLetterMetaChange ? (
          // Show letter metadata editor when no block is selected
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-violet-500" />
                <h3 className="font-semibold text-sm text-gray-900">Letter Settings</h3>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Configure the letterhead details for this letter
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <LetterMetaEditor meta={letterMeta} onChange={onLetterMetaChange} />
            </div>
          </div>
        ) : (
          // Default empty state
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div>
              <p className="text-sm text-gray-500">Select a block on the canvas to edit its properties.</p>
              <div className="mt-4 text-xs text-gray-400 space-y-1">
                <p><kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-[10px]">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-[10px]">S</kbd> Save</p>
                <p><kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-[10px]">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-[10px]">Z</kbd> Undo</p>
                <p><kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-[10px]">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-[10px]">⇧Z</kbd> Redo</p>
                <p><kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-[10px]">Alt</kbd>+<kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-[10px]">↑↓</kbd> Move block</p>
                <p><kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-[10px]">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-[10px]">D</kbd> Duplicate</p>
                <p><kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-[10px]">Del</kbd> Delete block</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleChange = (keyOrUpdates: string | Record<string, unknown>, value?: unknown) => {
    if (typeof keyOrUpdates === 'object' && keyOrUpdates !== null) {
      onUpdate(block.id, { ...block.data, ...keyOrUpdates });
    } else {
      onUpdate(block.id, { ...block.data, [keyOrUpdates]: value });
    }
  };

  const definition = getBlockDefinition(block.type);

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header with block info and actions */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-sm text-gray-900">Properties</h3>
            {definition && (
              <p className="text-[10px] text-gray-400 mt-0.5">{definition.label}</p>
            )}
          </div>
        </div>

        {/* Action Bar — Move, Duplicate, Delete */}
        <div className="flex items-center gap-1 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={isFirst}
            onClick={() => onMove?.(block.id, 'up')}
            title="Move Up (Alt+Up)"
          >
            <ChevronUp className="h-3.5 w-3.5 mr-1" />
            Up
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={isLast}
            onClick={() => onMove?.(block.id, 'down')}
            title="Move Down (Alt+Down)"
          >
            <ChevronDown className="h-3.5 w-3.5 mr-1" />
            Down
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onDuplicate?.(block.id)}
            title="Duplicate (Ctrl+D)"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="outline"
            size="sm" 
            className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
            onClick={() => onDelete(block.id)}
            title="Delete (Del)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Properties Editor + Letter Meta (scrollable together) */}
      <div className="flex-1 overflow-y-auto">
        {/* Block Properties */}
        <div className="p-4 space-y-6">
          {definition ? (
            definition.editor({ 
              block, 
              onChange: (key, value) => handleChange(key, value) 
            })
          ) : (
            <div className="p-4 bg-amber-50 text-amber-700 text-xs rounded border border-amber-200">
              No editor registered for block type: <code className="font-mono">{block.type}</code>
            </div>
          )}
        </div>

        {/* Phase 2: Conditional Visibility Rules — available for all block types */}
        {block.type !== 'page_break' && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <ConditionalLogicEditor
              rule={block.visibilityRule as BlockVisibilityRule | undefined}
              onChange={(rule) => {
                // visibilityRule lives on the FormBlock, not in block.data
                // So we need a special update that patches the block itself
                // For now, store in data as __visibilityRule for simplicity
                onUpdate(block.id, { ...block.data, __visibilityRule: rule });
              }}
            />
          </div>
        )}

        {/* Letter Metadata — shown below block properties when in letter mode */}
        {isLetterMode && letterMeta && onLetterMetaChange && (
          <div className="border-t border-gray-200">
            <div className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-violet-500" />
                <h4 className="font-semibold text-xs text-gray-700">Letter Settings</h4>
              </div>
            </div>
            <LetterMetaEditor meta={letterMeta} onChange={onLetterMetaChange} />
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// LETTER META EDITOR — Editable fields for letter metadata
// ============================================================================

interface LetterMetaEditorProps {
  meta: LetterMeta;
  onChange: (meta: LetterMeta) => void;
}

function LetterMetaEditor({ meta, onChange }: LetterMetaEditorProps) {
  const update = (key: keyof LetterMeta, value: string | string[] | undefined) => {
    onChange({ ...meta, [key]: value || undefined });
  };

  // Resolve signatories from meta (handles legacy single-signatory fields)
  const signatories = resolveSignatories(meta);

  const updateSignatory = (index: number, field: keyof Signatory, value: string) => {
    const updated = [...signatories];
    updated[index] = { ...updated[index], [field]: value || undefined };
    // Clear legacy fields when using the array
    onChange({
      ...meta,
      signatories: updated,
      signatoryName: undefined,
      signatoryTitle: undefined,
    });
  };

  const addSignatory = () => {
    const updated = [...signatories, { name: '', title: '' }];
    onChange({
      ...meta,
      signatories: updated,
      signatoryName: undefined,
      signatoryTitle: undefined,
    });
  };

  const removeSignatory = (index: number) => {
    const updated = signatories.filter((_, i) => i !== index);
    onChange({
      ...meta,
      signatories: updated.length > 0 ? updated : undefined,
      signatoryName: undefined,
      signatoryTitle: undefined,
    });
  };

  // Resolve recipients from meta (handles legacy single-recipient fields)
  const recipients = resolveRecipients(meta);

  const updateRecipient = (index: number, field: keyof Recipient, value: string) => {
    const updated = [...recipients];
    updated[index] = { ...updated[index], [field]: value || undefined };
    // Clear legacy fields when using the array
    onChange({
      ...meta,
      recipients: updated,
      recipientName: undefined,
      recipientTitle: undefined,
      recipientCompany: undefined,
      recipientAddress: undefined,
    });
  };

  const addRecipient = () => {
    const updated = [...recipients, { name: '', title: '', company: '', address: '' }];
    onChange({
      ...meta,
      recipients: updated,
      recipientName: undefined,
      recipientTitle: undefined,
      recipientCompany: undefined,
      recipientAddress: undefined,
    });
  };

  const removeRecipient = (index: number) => {
    const updated = recipients.filter((_, i) => i !== index);
    onChange({
      ...meta,
      recipients: updated.length > 0 ? updated : undefined,
      recipientName: undefined,
      recipientTitle: undefined,
      recipientCompany: undefined,
      recipientAddress: undefined,
    });
  };

  return (
    <div className="px-4 pb-4 space-y-5">
      {/* ---- Recipient Section ---- */}
      <fieldset className="space-y-3">
        <legend className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
          <User className="h-3 w-3" />
          Recipient
        </legend>

        {/* Recipient list */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600">
              Recipients ({recipients.length})
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={addRecipient}
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </div>

          {recipients.length === 0 && (
            <div className="text-center py-3 text-[10px] text-gray-400 bg-gray-50 rounded-md border border-dashed border-gray-200">
              No recipients added. Click "Add" to include a recipient.
            </div>
          )}

          {recipients.map((recipient, index) => (
            <RecipientCard
              key={index}
              index={index}
              recipient={recipient}
              onUpdate={updateRecipient}
              onRemove={removeRecipient}
              total={recipients.length}
            />
          ))}
        </div>
      </fieldset>

      {/* ---- Letter Details Section ---- */}
      <fieldset className="space-y-3">
        <legend className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
          <FileText className="h-3 w-3" />
          Letter Details
        </legend>

        <div className="space-y-1">
          <Label htmlFor="lm-date" className="text-xs text-gray-600">Date</Label>
          <Input
            id="lm-date"
            className="h-8 text-xs"
            placeholder="Leave blank for today's date"
            value={meta.date || ''}
            onChange={(e) => update('date', e.target.value)}
          />
          <p className="text-[10px] text-gray-400">Format: dd Month yyyy (e.g. 14 February 2026)</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="lm-subject" className="text-xs text-gray-600">Subject</Label>
          <Input
            id="lm-subject"
            className="h-8 text-xs"
            placeholder="e.g. Portfolio Review — Q1 2026"
            value={meta.subject || ''}
            onChange={(e) => update('subject', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="lm-reference" className="text-xs text-gray-600">Reference Number</Label>
          <Input
            id="lm-reference"
            className="h-8 text-xs"
            placeholder="e.g. NW/2026/001"
            value={meta.reference || ''}
            onChange={(e) => update('reference', e.target.value)}
          />
        </div>
      </fieldset>

      {/* ---- Closing & Signatories Section ---- */}
      <fieldset className="space-y-3">
        <legend className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
          <Pen className="h-3 w-3" />
          Closing &amp; Signatories
        </legend>

        <div className="space-y-1">
          <Label htmlFor="lm-closing" className="text-xs text-gray-600">Closing</Label>
          <Input
            id="lm-closing"
            className="h-8 text-xs"
            placeholder="e.g. Yours faithfully"
            value={meta.closing || ''}
            onChange={(e) => update('closing', e.target.value)}
          />
        </div>

        {/* Signatory list */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600">
              Signatories ({signatories.length})
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={addSignatory}
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </div>

          {signatories.length === 0 && (
            <div className="text-center py-3 text-[10px] text-gray-400 bg-gray-50 rounded-md border border-dashed border-gray-200">
              No signatories added. Click "Add" to include a signatory with a signing line.
            </div>
          )}

          {signatories.map((signatory, index) => (
            <SignatoryCard
              key={index}
              index={index}
              signatory={signatory}
              onUpdate={updateSignatory}
              onRemove={removeSignatory}
              total={signatories.length}
            />
          ))}
        </div>

        {signatories.length > 0 && (
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Each signatory gets a signing line on the printed letter for a wet signature.
          </p>
        )}
      </fieldset>

      {/* ---- Typography Section ---- */}
      <fieldset className="space-y-3">
        <legend className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
          <Type className="h-3 w-3" />
          Typography
        </legend>

        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Font Size ({meta.fontSize || 10}px)</Label>
          <input
            type="range"
            min="7"
            max="14"
            step="0.5"
            value={meta.fontSize || 10}
            onChange={(e) => onChange({ ...meta, fontSize: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
          />
          <div className="flex justify-between text-[9px] text-gray-400">
            <span>7px</span>
            <span>10px (default)</span>
            <span>14px</span>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Line Spacing ({meta.lineHeight || 1.65}x)</Label>
          <input
            type="range"
            min="1.0"
            max="2.5"
            step="0.05"
            value={meta.lineHeight || 1.65}
            onChange={(e) => onChange({ ...meta, lineHeight: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
          />
          <div className="flex justify-between text-[9px] text-gray-400">
            <span>1.0x (tight)</span>
            <span>1.65x (default)</span>
            <span>2.5x (wide)</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-[10px]"
          onClick={() => onChange({ ...meta, fontSize: undefined, lineHeight: undefined })}
        >
          Reset to Defaults
        </Button>
      </fieldset>
    </div>
  );
}

// ============================================================================
// SIGNATORY CARD — Individual signatory editor within the list
// ============================================================================

interface SignatoryCardProps {
  index: number;
  signatory: Signatory;
  onUpdate: (index: number, field: keyof Signatory, value: string) => void;
  onRemove: (index: number) => void;
  total: number;
}

function SignatoryCard({ index, signatory, onUpdate, onRemove, total }: SignatoryCardProps) {
  return (
    <div className="relative rounded-md border border-gray-200 bg-gray-50/50 p-3 space-y-2">
      {/* Card header with number and remove button */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          Signatory {index + 1}
        </span>
        <button
          onClick={() => onRemove(index)}
          className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Remove signatory"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-gray-500">Name</Label>
        <Input
          className="h-7 text-xs"
          placeholder="e.g. Jane van der Merwe"
          value={signatory.name || ''}
          onChange={(e) => onUpdate(index, 'name', e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-gray-500">Title</Label>
        <Input
          className="h-7 text-xs"
          placeholder="e.g. Senior Financial Adviser"
          value={signatory.title || ''}
          onChange={(e) => onUpdate(index, 'title', e.target.value)}
        />
      </div>
    </div>
  );
}

// ============================================================================
// RECIPIENT CARD — Individual recipient editor within the list
// ============================================================================

interface RecipientCardProps {
  index: number;
  recipient: Recipient;
  onUpdate: (index: number, field: keyof Recipient, value: string) => void;
  onRemove: (index: number) => void;
  total: number;
}

function RecipientCard({ index, recipient, onUpdate, onRemove, total }: RecipientCardProps) {
  return (
    <div className="relative rounded-md border border-gray-200 bg-gray-50/50 p-3 space-y-2">
      {/* Card header with number and remove button */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          Recipient {index + 1}
        </span>
        <button
          onClick={() => onRemove(index)}
          className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Remove recipient"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-gray-500">Name</Label>
        <Input
          className="h-7 text-xs"
          placeholder="e.g. Mr John Smith"
          value={recipient.name || ''}
          onChange={(e) => onUpdate(index, 'name', e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-gray-500">Title / Role</Label>
        <Input
          className="h-7 text-xs"
          placeholder="e.g. Financial Director"
          value={recipient.title || ''}
          onChange={(e) => onUpdate(index, 'title', e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-gray-500">Company</Label>
        <Input
          className="h-7 text-xs"
          placeholder="e.g. ABC Holdings (Pty) Ltd"
          value={recipient.company || ''}
          onChange={(e) => onUpdate(index, 'company', e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-gray-500">Address</Label>
        <textarea
          className="w-full h-16 rounded-md border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          placeholder={"123 Main Street\nSandton, 2196"}
          value={recipient.address || ''}
          onChange={(e) => onUpdate(index, 'address', e.target.value)}
        />
      </div>
    </div>
  );
}