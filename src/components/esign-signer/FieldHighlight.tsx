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

import { motion } from 'motion/react';
import {
  Pen,
  Type,
  Calendar,
  CheckSquare,
  Lock,
  Check,
  CalendarCheck,
  ChevronDown as ChevronDownIcon,
  CircleDot,
} from 'lucide-react';
import { useFieldHighlight, type FieldHighlightProps } from './hooks/useFieldHighlight';

export function FieldHighlight(props: FieldHighlightProps) {
  const {
    field,
    isFilled,
    isNextRequired = false,
    inactive = false,
    locked = false,
    filledValue,
    onClick,
  } = props;
  const {
    meta,
    inlineEligible,
    isEditing,
    setIsEditing,
    draft,
    setDraft,
    inputRef,
    commitInline,
    getFieldLabel,
    leftPercent,
    topPercent,
    widthPercent,
    heightPercent,
    textStyle,
    displayValue,
    isImagePreview,
    isTextPreview,
    isCheckboxFilled,
    shouldPulse,
  } = useFieldHighlight(props);

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
      case 'radio':
        return <CircleDot className="h-3 w-3" />;
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

  // ── Note render branch ──
  // A note is sender-authored read-only text: never an input, never
  // required, no click action. Rendered as quiet informational copy so it
  // reads as part of the document rather than a thing to tap.
  if (field.type === 'note') {
    return (
      <div
        className="absolute border border-amber-300/70 bg-amber-50/80 px-1 overflow-hidden pointer-events-none z-10"
        style={{
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          width: `${widthPercent}%`,
          height: `${heightPercent}%`,
        }}
        role="note"
        aria-label="Note from the sender"
      >
        <span className="text-xs text-amber-900 leading-snug">{filledValue ?? ''}</span>
      </div>
    );
  }

  // ── Inline editor render branch (P2.5 1.9) ──
  // Render an in-place input instead of a button when:
  //   • the field is eligible (text-without-format / date), and
  //   • the signer has activated it (single tap), or
  //   • the field is empty and is the next-required field (auto-focus).
  if (inlineEligible && (isEditing || (!isFilled && isNextRequired))) {
    return (
      <div
        className={`absolute border-2 ${field.required ? 'border-amber-500 bg-amber-50' : 'border-gray-400 bg-white'} shadow-sm pointer-events-auto z-20 flex items-center`}
        style={{
          left: `${field.x}%`,
          top: `${field.y}%`,
          width: `${widthPercent}%`,
          // At least a usable typing height while editing; the field itself
          // is drawn at its true size the rest of the time.
          height: `max(${heightPercent}%, 28px)`,
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
          ? {
              boxShadow: [
                '0 0 0 0 rgba(245, 158, 11, 0)',
                '0 0 0 6px rgba(245, 158, 11, 0.35)',
                '0 0 0 0 rgba(245, 158, 11, 0)',
              ],
            }
          : {}
      }
      transition={shouldPulse ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
      className={`absolute transition-colors pointer-events-auto z-10 ${
        locked || inactive ? 'opacity-80' : 'cursor-pointer'
      } ${getFieldClasses()}`}
      style={{
        left: `${leftPercent}%`,
        top: `${topPercent}%`,
        width: `${widthPercent}%`,
        height: `${heightPercent}%`,
        // Drawn at its TRUE size and with square corners, so it lines up with
        // the printed box (a 24px minimum and rounded corners made small boxes
        // look twice their size). The touch target is enlarged invisibly below.
        containerType: 'size',
      }}
    >
      {/* Invisible larger hit area for fingers; does not change the drawing. */}
      <span aria-hidden className="absolute -inset-1.5 md:inset-0" />
      {/* Filled State: Signature/Initials Image Preview */}
      {isImagePreview && (
        <div className="absolute inset-0.5 flex items-center justify-center overflow-hidden">
          <img src={filledValue} alt="" className="max-h-full max-w-full object-contain" />
          <div className="absolute top-0 right-0 bg-green-500 text-white p-px">
            <Check className="h-2 w-2" />
          </div>
        </div>
      )}

      {/* Filled State: Text/Date Preview */}
      {isTextPreview && (
        <div className="absolute inset-0 flex items-center overflow-hidden whitespace-nowrap">
          <span className="text-gray-900" style={textStyle(displayValue ?? '')}>
            {displayValue}
          </span>
          {!locked && (
            <div className="absolute top-0 right-0 bg-green-500 text-white p-px">
              <Check className="h-2 w-2" />
            </div>
          )}
        </div>
      )}

      {/* Filled State: Checkbox */}
      {isCheckboxFilled && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[85%] aspect-square bg-green-500 flex items-center justify-center">
            <Check className="h-[80%] w-[80%] text-white" />
          </div>
        </div>
      )}

      {/* Empty/Unfilled State — short label + icon, no help text */}
      {!isFilled && !locked && (
        <div className="absolute inset-0 flex items-center justify-center p-1 overflow-hidden">
          <div
            className={`flex items-center gap-1 text-[11px] font-semibold leading-none ${
              field.required ? 'text-amber-900' : 'text-gray-500'
            }`}
          >
            {getFieldIcon()}
            <span className="truncate">{getFieldLabel()}</span>
          </div>
        </div>
      )}

      {/* Locked State — the label only when there is no value to show. A
          locked prefill or calculated value used to have "Locked" printed
          over it; now the value shows with a small lock in the corner. */}
      {locked && isFilled && (
        <div className="absolute top-0 right-0 bg-gray-400 text-white p-px" aria-hidden>
          <Lock className="h-2 w-2" />
        </div>
      )}
      {locked && !isFilled && (
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
