/**
 * The studio toolbar: save, send, undo/redo, snap, and the dialog triggers.
 *
 *
 * Split out of `PrepareFormStudio.tsx` (1,529 lines), whose `return` held the
 * toolbar, recipient strip, bulk-action bar, canvas and five dialogs together.
 * Presentational — it owns no state.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../../../../ui/button';
import {
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Undo,
  Redo,
  Settings as SettingsIcon,
  Eye,
  Keyboard,
  Users,
  Magnet,
  Layers,
} from 'lucide-react';
import type { EsignEnvelope, SignerFormData } from '../../types';

interface StudioToolbarProps {
  autoSaving: boolean;
  canRedo: boolean;
  canUndo: boolean;
  documentUrl: string | undefined;
  envelope: EsignEnvelope;
  handleBack: () => void;
  handleSave: () => void;
  handleSend: () => void;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  redo: () => void;
  saving: boolean;
  sendActionBusyLabel: string;
  sendActionLabel: string;
  sending: boolean;
  setShowPageManager: Dispatch<SetStateAction<boolean>>;
  setShowPreview: Dispatch<SetStateAction<boolean>>;
  setShowRecipients: Dispatch<SetStateAction<boolean>>;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  setShowShortcuts: Dispatch<SetStateAction<boolean>>;
  setSnapEnabled: Dispatch<SetStateAction<boolean>>;
  signers: SignerFormData[];
  snapEnabled: boolean;
  undo: () => void;
}

export function StudioToolbar({
  autoSaving,
  canRedo,
  canUndo,
  documentUrl,
  envelope,
  handleBack,
  handleSave,
  handleSend,
  hasUnsavedChanges,
  lastSavedAt,
  redo,
  saving,
  sendActionBusyLabel,
  sendActionLabel,
  sending,
  setShowPageManager,
  setShowPreview,
  setShowRecipients,
  setShowSettings,
  setShowShortcuts,
  setSnapEnabled,
  signers,
  snapEnabled,
  undo,
}: StudioToolbarProps) {
  return (
    <div className="h-14 bg-white border-b flex items-center justify-between px-4 shadow-sm z-10 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="h-6 w-px bg-gray-200" />
        <h2 className="font-semibold text-gray-900 truncate max-w-[260px]" title={envelope.title}>
          {envelope.title}
        </h2>
        {/* Recipients quick-edit trigger */}
        <button
          type="button"
          onClick={() => setShowRecipients(true)}
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition shrink-0"
          title="Edit recipients"
        >
          <Users className="h-3 w-3" />
          {signers.length} Recipient{signers.length !== 1 ? 's' : ''}
        </button>
        {/* Auto-save status indicator */}
        <div className="text-xs text-gray-500 ml-1 min-w-[110px]" aria-live="polite">
          {saving || autoSaving ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          ) : hasUnsavedChanges ? (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertCircle className="h-3 w-3" />
              Unsaved changes
            </span>
          ) : lastSavedAt ? (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Snap toggle — Magnet icon makes the metaphor self-explanatory. */}
        <Button
          variant={snapEnabled ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setSnapEnabled((v) => !v)}
          className="h-8 px-2 gap-1"
          title="Toggle snap to grid (hold Alt while dragging to bypass)"
        >
          <Magnet className="h-3.5 w-3.5" />
          <span className="text-xs">Snap</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(true)}
          className="h-8 px-2 gap-1"
          title="Edit envelope settings"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
          <span className="text-xs">Settings</span>
        </Button>

        {/* P3.3 — Reorder / delete / rotate pages before sending. Only
            shown for envelopes that actually have a source PDF. */}
        {(envelope.document?.url || envelope.documentUrl || documentUrl) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPageManager(true)}
            className="h-8 px-2 gap-1"
            title="Reorder, rotate, or delete pages"
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="text-xs">Pages</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(true)}
          className="h-8 px-2 gap-1"
          title="Preview as recipient"
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="text-xs">Preview</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowShortcuts(true)}
          className="h-8 w-8"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="h-3.5 w-3.5" />
        </Button>

        <div className="h-6 w-px bg-gray-200 mx-1" />

        <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} aria-label="Undo">
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} aria-label="Redo">
          <Redo className="h-4 w-4" />
        </Button>

        <div className="h-6 w-px bg-gray-200 mx-1" />

        <Button
          variant="outline"
          onClick={handleSave}
          disabled={!hasUnsavedChanges || saving || autoSaving}
          className="w-24"
        >
          {saving || autoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </Button>

        <Button
          onClick={handleSend}
          disabled={sending}
          className="min-w-[140px] bg-purple-600 hover:bg-purple-700"
        >
          {sending ? (
            <div className="contents">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {sendActionBusyLabel}
            </div>
          ) : (
            <div className="contents">
              {sendActionLabel}
              <Send className="h-4 w-4 ml-2" />
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
