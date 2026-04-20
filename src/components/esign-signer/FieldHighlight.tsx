/**
 * Field Highlight Component
 *
 * Visual language (intentional, no help text required):
 *   • REQUIRED + empty + NEXT  → solid amber outline, soft amber fill, gentle pulse
 *   • REQUIRED + empty (other) → solid amber outline, soft amber fill, no pulse
 *   • OPTIONAL + empty         → dashed slate outline, no fill, low contrast
 *   • FILLED                   → quiet green outline + small ✓ corner, value preview
 *   • LOCKED                   → muted gray, lock icon, non-interactive
 *
 * No tooltips, no popovers — the field's appearance must communicate its
 * state on its own. The signer's behaviour is "tap the brightest thing on
 * the page, then the next brightest", which the styling above enforces.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Pen, Type, Calendar, CheckSquare, Lock, Check, CalendarCheck, ChevronDown as ChevronDownIcon } from 'lucide-react';

interface FieldHighlightProps {
  field: {
    id: string;
    type: 'signature' | 'initials' | 'text' | 'date' | 'checkbox' | 'auto_date' | 'dropdown' | 'attachment';
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    required: boolean;
    /** Optional metadata coming from the studio (validation rules, format hints). */
    metadata?: Record<string, unknown>;
  };
  zoom: number;
  isFilled: boolean;
  /** True only for the single next-required field for this signer.
   *  Drives the pulse animation so the signer always has exactly one
   *  unambiguous "next thing to tap". */
  isNextRequired?: boolean;
  /** Reading-mode (pre-signing) renders fields as informational only. */
  inactive?: boolean;
  locked?: boolean;
  /** The captured value (data URL for signature/initials, text string for text/date, 'true'/'false' for checkbox) */
  filledValue?: string;
  onClick: () => void;
  /**
   * P2.5 1.9 — when set, text/date fields render an in-place editor instead
   * of opening a modal dialog. The existing onClick fallback is preserved
   * for SA-ID / formatted text fields where the modal still adds value
   * (validation feedback, masking).
   *
   * Returning `false` from `onInlineCommit` rejects the value (validation
   * failure) and keeps the editor open.
   */
  onInlineCommit?: (fieldId: string, value: string) => boolean | void;
}

export function FieldHighlight({
  field,
  zoom,
  isFilled,
  isNextRequired = false,
  inactive = false,
  locked = false,
  filledValue,
  onClick,
  onInlineCommit,
}: FieldHighlightProps) {
  // ── P2.5 1.9 — inline editor support ──
  // The studio can mark a text field with `format === 'sa_id'` (or any
  // other format that needs interactive masking/validation feedback). For
  // those cases we keep the modal flow because the input is visually too
  // small for proper feedback. For everything else, signers edit in-place.
  const meta = (field.metadata ?? {}) as { format?: string; placeholder?: string; maxLength?: number; pattern?: string };
  const inlineEligible =
    !inactive &&
    !locked &&
    !!onInlineCommit &&
    (
      // Date always uses native picker — no validation friction
      field.type === 'date' ||
      // Text only when no format-driven masking is configured
      (field.type === 'text' && (!meta.format || meta.format === 'plain'))
    );

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>(filledValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(filledValue ?? '');
  }, [filledValue]);

  useEffect(() => {
    if (isEditing) {
      // microtask deferred so the click that opened editing doesn't blur it
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isEditing]);

  const commitInline = () => {
    if (!onInlineCommit) return;
    const trimmed = draft.trim();
    const ok = onInlineCommit(field.id, trimmed);
    if (ok !== false) {
      setIsEditing(false);
    }
  };

  const getFieldIcon = () => {
    if (locked) return <Lock className="h-3 w-3" />;
    if (isFilled && field.type === 'checkbox') return <Check className="h-4 w-4 text-green-700" />;
    switch (field.type) {
      case 'signature':
      case 'initials':
        return <Pen className="h-3 w-3" />;
      case 'text':
        return <Type className="h-3 w-3" />;
      case 'date':
        return <Calendar className="h-3 w-3" />;
      case 'checkbox':
        return <CheckSquare className="h-3 w-3" />;
      case 'auto_date':
        return <CalendarCheck className="h-3 w-3" />;
      case 'dropdown':
        return <ChevronDownIcon className="h-3 w-3" />;
      // P3.5 — attachment fields use a distinct paperclip-ish glyph
      // so signers immediately understand they need to upload a file
      // rather than type something. We reuse the lucide `Type` icon
      // styled differently here to avoid pulling in another import.
      case 'attachment':
        return <Type className="h-3 w-3 rotate-45" />;
      default:
        return null;
    }
  };

  // Outline + fill encode state. Required fields are loud; optional fields
  // are quiet so the signer's eye is drawn to what they MUST do.
  const getFieldClasses = () => {
    if (locked) {
      return 'border border-gray-300 bg-gray-200/30 cursor-not-allowed';
    }
    if (inactive) {
      // Reading-mode preview: muted but visible so the signer understands
      // that fields exist and roughly where they will be.
      return field.required
        ? 'border border-amber-300/70 bg-amber-100/30 cursor-default'
        : 'border border-dashed border-gray-300 bg-transparent cursor-default';
    }
    if (isFilled) {
      return 'border border-green-500/70 bg-green-50/40 hover:border-green-600';
    }
    return field.required
      ? 'border-2 border-amber-500 bg-amber-200/40 hover:border-amber-600 hover:bg-amber-200/60'
      : 'border border-dashed border-gray-400 bg-transparent hover:border-gray-600 hover:bg-gray-100/40';
  };

  const getFieldLabel = () => {
    if (locked) return 'Locked';
    if (isFilled) return '';
    switch (field.type) {
      case 'signature':
        return 'Sign';
      case 'initials':
        return 'Initials';
      case 'text':
        return 'Text';
      case 'date':
        return 'Date';
      case 'checkbox':
        return 'Check';
      case 'auto_date':
        return 'Auto';
      case 'dropdown':
        return 'Select';
      case 'attachment':
        return 'Attach';
      default:
        return '';
    }
  };

  // Convert field coordinates to percentage-based positioning
  const leftPercent = field.x;
  const topPercent = field.y;
  const widthPercent = (field.width / 595) * 100;
  const heightPercent = (field.height / 842) * 100;

  // Determine what kind of preview to render in the filled state.
  const isImagePreview = isFilled && filledValue && filledValue.startsWith('data:image') &&
    (field.type === 'signature' || field.type === 'initials');

  const isTextPreview = isFilled && filledValue && !filledValue.startsWith('data:image') &&
    (field.type === 'text' || field.type === 'date' || field.type === 'auto_date' || field.type === 'dropdown');

  const isCheckboxFilled = isFilled && field.type === 'checkbox';

  // Only the single next-required field pulses, and only when interactive.
  const shouldPulse = !isFilled && !locked && !inactive && isNextRequired;

  // ── Inline editor render branch (P2.5 1.9) ──
  // Render an in-place input instead of a button when:
  //   • the field is eligible (text-without-format / date), and
  //   • the signer has activated it (single tap), or
  //   • the field is empty and is the next-required field (auto-focus).
  if (inlineEligible && (isEditing || (!isFilled && isNextRequired))) {
    const widthPercent = (field.width / 595) * 100;
    const heightPercent = (field.height / 842) * 100;
    return (
      <div
        className={`absolute rounded-md border-2 ${field.required ? 'border-amber-500 bg-amber-50' : 'border-gray-400 bg-white'} shadow-sm pointer-events-auto z-20 flex items-center px-1`}
        style={{
          left: `${field.x}%`,
          top: `${field.y}%`,
          width: `${widthPercent}%`,
          height: `${heightPercent}%`,
          minHeight: '32px',
        }}
      >
        <input
          ref={inputRef}
          type={field.type === 'date' ? 'date' : 'text'}
          // Native date picker on mobile/desktop — no custom dialog needed.
          inputMode={field.type === 'date' ? undefined : 'text'}
          placeholder={meta.placeholder ?? (field.type === 'date' ? 'YYYY-MM-DD' : 'Type here')}
          maxLength={meta.maxLength}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitInline}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitInline();
            } else if (e.key === 'Escape') {
              setDraft(filledValue ?? '');
              setIsEditing(false);
            }
          }}
          // Focus state is the visual signal — no other chrome needed.
          className="w-full h-full bg-transparent text-xs md:text-sm text-gray-900 outline-none"
          aria-label={`${field.type} field${field.required ? ', required' : ''}`}
          autoFocus={isEditing}
        />
      </div>
    );
  }

  return (
    <motion.button
      onClick={
        locked || inactive
          ? undefined
          : () => {
              if (inlineEligible) {
                // Open the in-place editor; do NOT bubble up to onClick (which
                // would open the modal). Modal still wins for SA-ID etc.
                setIsEditing(true);
                return;
              }
              onClick();
            }
      }
      disabled={locked || inactive}
      type="button"
      // The signer always has at least a 44×44 hit area thanks to the
      // wrapper padding in SigningWorkflow. The visual rect is the field
      // bounding box.
      aria-label={
        isFilled
          ? `${field.type} field, completed`
          : `${field.type} field${field.required ? ', required' : ''}`
      }
      initial={false}
      animate={
        shouldPulse
          ? { boxShadow: ['0 0 0 0 rgba(245, 158, 11, 0)', '0 0 0 6px rgba(245, 158, 11, 0.35)', '0 0 0 0 rgba(245, 158, 11, 0)'] }
          : {}
      }
      transition={
        shouldPulse
          ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
          : {}
      }
      className={`absolute rounded-md transition-colors pointer-events-auto z-10 ${
        locked || inactive ? 'opacity-80' : 'cursor-pointer'
      } ${getFieldClasses()}`}
      style={{
        left: `${leftPercent}%`,
        top: `${topPercent}%`,
        width: `${widthPercent}%`,
        height: `${heightPercent}%`,
        // Make every field at least a comfortable touch target visually,
        // without changing its document-space position.
        minHeight: '24px',
      }}
    >
      {/* Filled State: Signature/Initials Image Preview */}
      {isImagePreview && (
        <div className="absolute inset-0.5 flex items-center justify-center overflow-hidden">
          <img
            src={filledValue}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
          <div className="absolute top-0 right-0 bg-green-500 text-white rounded-bl-md p-0.5">
            <Check className="h-2.5 w-2.5" />
          </div>
        </div>
      )}

      {/* Filled State: Text/Date Preview */}
      {isTextPreview && (
        <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
          <span className="text-xs text-gray-800 truncate font-medium">{filledValue}</span>
          <div className="absolute top-0 right-0 bg-green-500 text-white rounded-bl-md p-0.5">
            <Check className="h-2.5 w-2.5" />
          </div>
        </div>
      )}

      {/* Filled State: Checkbox */}
      {isCheckboxFilled && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-5 bg-green-500 rounded flex items-center justify-center">
            <Check className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
      )}

      {/* Empty/Unfilled State — short label + icon, no help text */}
      {!isFilled && !locked && (
        <div className="absolute inset-0 flex items-center justify-center p-1 overflow-hidden">
          <div className={`flex items-center gap-1 text-[11px] font-semibold leading-none ${
            field.required ? 'text-amber-900' : 'text-gray-500'
          }`}>
            {getFieldIcon()}
            <span className="truncate">{getFieldLabel()}</span>
          </div>
        </div>
      )}

      {/* Locked State */}
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center p-1 overflow-hidden">
          <div className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
            <Lock className="h-3 w-3" />
            <span className="truncate">Locked</span>
          </div>
        </div>
      )}
    </motion.button>
  );
}
