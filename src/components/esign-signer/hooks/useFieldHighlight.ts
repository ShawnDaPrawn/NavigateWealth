/**
 * useFieldHighlight — what a signer's field on the page is and does: its box
 * on the page (left/top/width/height as percentages of the real page size),
 * the in-place editor for plain text and dates (when it is offered, the draft,
 * commit on Enter or blur, Escape to cancel), the filled-value preview and
 * its text sizing (the signed PDF's own rule), the short label and which
 * field pulses as the next one to fill.
 *
 * Moved verbatim out of FieldHighlight.tsx so the live field and the Navigator
 * redesign (src/site/sections/ESignField.tsx) place, size, edit and label
 * every field identically and differ only in how the field is drawn.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { fitFieldText, formatFieldDate } from '../../../shared/esign/fieldText';

export interface FieldHighlightProps {
  field: {
    id: string;
    type:
      | 'signature'
      | 'initials'
      | 'text'
      | 'date'
      | 'checkbox'
      | 'auto_date'
      | 'dropdown'
      | 'radio'
      | 'note'
      | 'attachment';
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
  /**
   * Real page size in PDF points. Field width/height are stored in points,
   * so converting them to a percentage of the page needs the actual page
   * size — the old hardcoded A4 (595×842) made fields render at the wrong
   * size on any non-A4 page. Defaults keep A4 behaviour when unknown.
   */
  pageWidthPts?: number;
  pageHeightPts?: number;
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

export function useFieldHighlight({
  field,
  pageWidthPts = 595,
  pageHeightPts = 842,
  isFilled,
  isNextRequired = false,
  inactive = false,
  locked = false,
  filledValue,
  onInlineCommit,
}: FieldHighlightProps) {
  // ── P2.5 1.9 — inline editor support ──
  // The studio can mark a text field with `format === 'sa_id'` (or any
  // other format that needs interactive masking/validation feedback). For
  // those cases we keep the modal flow because the input is visually too
  // small for proper feedback. For everything else, signers edit in-place.
  const meta = (field.metadata ?? {}) as {
    format?: string;
    placeholder?: string;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
  };
  // Inline editing skips the modal's validation, so it is only offered for
  // free text with no rule to check. The studio writes 'free_text' (this
  // used to test for 'plain' only), and a minimum length or pattern needs
  // the modal's feedback.
  const isFreeText = !meta.format || meta.format === 'plain' || meta.format === 'free_text';
  const inlineEligible =
    !inactive &&
    !locked &&
    !!onInlineCommit &&
    // Date always uses native picker — no validation friction
    (field.type === 'date' ||
      (field.type === 'text' && isFreeText && !meta.minLength && !meta.pattern));

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
      case 'radio':
        return 'Choose';
      case 'attachment':
        return 'Attach';
      default:
        return '';
    }
  };

  // Convert field coordinates to percentage-based positioning.
  // x/y are already percent; width/height are PDF points of the real page.
  const leftPercent = field.x;
  const topPercent = field.y;
  const widthPercent = (field.width / pageWidthPts) * 100;
  const heightPercent = (field.height / pageHeightPts) * 100;

  // Text is sized by the SAME rule as the signed PDF (shared/esign/fieldText):
  // one line, as large as fits the box, clipped at its edge. The size is in
  // points; `cqh` (a percent of the field's own height — the field is a size
  // container) turns it into pixels at whatever zoom the page is shown.
  // It used to be a fixed 12px with an ellipsis, unrelated to what printed.
  const textStyle = (text: string): CSSProperties => {
    const fit = fitFieldText(text, field.width, field.height);
    return {
      fontSize: `${(fit.size / field.height) * 100}cqh`,
      lineHeight: 1,
      paddingLeft: `${(fit.offsetX / field.width) * 100}cqw`,
      fontFamily: 'Helvetica, Arial, sans-serif',
    };
  };
  const displayValue =
    filledValue && (field.type === 'date' || field.type === 'auto_date')
      ? formatFieldDate(filledValue)
      : filledValue;

  // Determine what kind of preview to render in the filled state.
  const isImagePreview =
    isFilled &&
    filledValue &&
    filledValue.startsWith('data:image') &&
    (field.type === 'signature' || field.type === 'initials');

  const isTextPreview =
    isFilled &&
    filledValue &&
    !filledValue.startsWith('data:image') &&
    (field.type === 'text' ||
      field.type === 'date' ||
      field.type === 'auto_date' ||
      field.type === 'dropdown' ||
      field.type === 'radio');

  const isCheckboxFilled = isFilled && field.type === 'checkbox';

  // Only the single next-required field pulses, and only when interactive.
  const shouldPulse = !isFilled && !locked && !inactive && isNextRequired;

  return {
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
  };
}
