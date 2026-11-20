/**
 * Where an EARLIER signer's completed value sits on the page and how it is
 * drawn — laid out exactly as the signed PDF will print it
 * (shared/esign/fieldText.ts).
 *
 * Moved verbatim out of PriorEntry.tsx so the live entry and the Navigator
 * redesign (src/site/sections/ESignField.tsx) place it identically.
 */
import type { CSSProperties } from 'react';
import { fitFieldText, formatFieldDate } from '../../shared/esign/fieldText';
import type { CompletedField } from './types';

export type PriorEntryLayout =
  | { kind: 'image'; box: CSSProperties; value: string }
  | { kind: 'text'; box: CSSProperties; text: string; textStyle: CSSProperties };

/** Null when there is nothing to draw. */
export function priorEntryLayout(
  field: CompletedField,
  pageWidthPts = 595,
  pageHeightPts = 842,
): PriorEntryLayout | null {
  const value = field.value ?? '';
  // Attachments are not document content (their value is a storage marker);
  // the signed PDF skips them, so they are not drawn here either.
  if (!value || field.type === 'attachment' || value.startsWith('attachment:')) return null;

  const box = {
    left: `${field.x}%`,
    top: `${field.y}%`,
    width: `${(field.width / pageWidthPts) * 100}%`,
    height: `${(field.height / pageHeightPts) * 100}%`,
  };

  if (value.startsWith('data:image/')) {
    return { kind: 'image', box, value };
  }

  const text =
    field.type === 'checkbox'
      ? value === 'true' || value === 'checked'
        ? 'X'
        : ''
      : field.type === 'date' || field.type === 'auto_date'
        ? formatFieldDate(value)
        : value;
  if (!text) return null;
  const fit = fitFieldText(text, field.width, field.height);

  return {
    kind: 'text',
    box,
    text,
    textStyle: {
      fontSize: `${(fit.size / field.height) * 100}cqh`,
      lineHeight: 1,
      paddingLeft: `${(fit.offsetX / field.width) * 100}cqw`,
      fontFamily: 'Helvetica, Arial, sans-serif',
    },
  };
}
