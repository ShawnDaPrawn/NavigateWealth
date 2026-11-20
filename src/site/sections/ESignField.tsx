/**
 * A signer's field over the PDF page, and an earlier signer's entry, drawn in
 * the ESign board's field language: a dashed ink box to fill, a solid pulsing
 * one for the next field, green once done, a quiet paper box for what an
 * earlier signer completed.
 *
 * Where a field sits, its size, the in-place editor for plain text and dates,
 * the filled preview, its text sizing and its short label all come from the
 * live field (useFieldHighlight, priorEntryLayout), so a field lands exactly
 * where the live page — and the signed PDF — put it.
 */
import type { ReactNode } from 'react';
import {
  useFieldHighlight,
  type FieldHighlightProps,
} from '../../components/esign-signer/hooks/useFieldHighlight';
import { priorEntryLayout } from '../../components/esign-signer/priorEntryLayout';
import type { CompletedField } from '../../components/esign-signer/types';
import { ESignIcon, type ESignIconName } from './ESignIcons';

/** The board's empty-field marks: a pen to sign, a calendar for a date, a box to tick. */
const EMPTY_ICON: Partial<Record<FieldHighlightProps['field']['type'], ESignIconName>> = {
  signature: 'pen',
  date: 'calendar',
  auto_date: 'calendar',
  checkbox: 'square',
  dropdown: 'chevron',
  radio: 'circleDot',
  attachment: 'paperclip',
};

export function ESignField(props: FieldHighlightProps) {
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

  const box = {
    left: `${leftPercent}%`,
    top: `${topPercent}%`,
    width: `${widthPercent}%`,
    height: `${heightPercent}%`,
  };

  // A note is the sender's read-only text, as the board's "Note from the sender".
  if (field.type === 'note') {
    return (
      <div
        id={`field-${field.id}`}
        className="nwes-note-field"
        style={box}
        role="note"
        aria-label="Note from the sender"
      >
        <span>{filledValue ?? ''}</span>
      </div>
    );
  }

  if (inlineEligible && (isEditing || (!isFilled && isNextRequired))) {
    return (
      <div
        id={`field-${field.id}`}
        className={`nwes-inline${field.required ? ' nwes-inline--required' : ''}`}
        style={{ ...box, height: `max(${heightPercent}%, 28px)` }}
      >
        <input
          ref={inputRef}
          type={field.type === 'date' ? 'date' : 'text'}
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
          aria-label={`${field.type} field${field.required ? ', required' : ''}`}
          autoFocus={isEditing}
        />
      </div>
    );
  }

  const state = locked
    ? 'locked'
    : inactive
      ? 'reading'
      : isFilled
        ? 'done'
        : shouldPulse
          ? 'next'
          : field.required
            ? 'todo'
            : 'optional';

  let content: ReactNode = null;
  if (isImagePreview) {
    content = <img className="nwes-field-img" src={filledValue} alt="" />;
  } else if (isTextPreview) {
    content = (
      <span className="nwes-field-text">
        <span style={textStyle(displayValue ?? '')}>{displayValue}</span>
      </span>
    );
  } else if (isCheckboxFilled) {
    content = (
      <span className="nwes-field-tick">
        <span>
          <ESignIcon name="check" size={13} />
        </span>
      </span>
    );
  } else if (!isFilled && !locked) {
    const icon = EMPTY_ICON[field.type];
    content = (
      <span className="nwes-field-label">
        {icon && <ESignIcon name={icon} size={16} className="nwes-field-mark" />}
        <span>{getFieldLabel()}</span>
      </span>
    );
  } else if (locked && !isFilled) {
    content = (
      <span className="nwes-field-label">
        <ESignIcon name="lock" size={16} className="nwes-field-mark" />
        <span>Locked</span>
      </span>
    );
  }

  return (
    <button
      id={`field-${field.id}`}
      type="button"
      className={`nwes-field nwes-field--${state}`}
      style={box}
      onClick={
        locked || inactive
          ? undefined
          : () => {
              if (inlineEligible) {
                setIsEditing(true);
                return;
              }
              onClick();
            }
      }
      disabled={locked || inactive}
      aria-label={
        isFilled
          ? `${field.type} field, completed`
          : `${field.type} field${field.required ? ', required' : ''}`
      }
    >
      {content}
      {locked && isFilled && (
        <span className="nwes-field-lock" aria-hidden="true">
          <ESignIcon name="lock" size={9} />
        </span>
      )}
    </button>
  );
}

interface ESignPriorEntryProps {
  field: CompletedField;
  pageWidthPts?: number;
  pageHeightPts?: number;
}

/** What an earlier signer completed: read-only, in the board's "Signed" box. */
export function ESignPriorEntry({ field, pageWidthPts, pageHeightPts }: ESignPriorEntryProps) {
  const layout = priorEntryLayout(field, pageWidthPts, pageHeightPts);
  if (!layout) return null;

  if (layout.kind === 'image') {
    return (
      <div
        className="nwes-prior"
        style={layout.box}
        role="img"
        aria-label="Signed by an earlier signer"
      >
        <img src={layout.value} alt="" />
        <span className="nwes-prior-chip" aria-hidden="true">
          Signed
        </span>
      </div>
    );
  }

  return (
    <div
      className="nwes-prior nwes-prior--text"
      style={layout.box}
      aria-label="Completed by an earlier signer"
    >
      <span style={layout.textStyle}>{layout.text}</span>
    </div>
  );
}
