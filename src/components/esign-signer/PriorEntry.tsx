/**
 * A value an EARLIER signer already completed, drawn read-only on the page so
 * a later signer sees the document as it stands. It is laid out exactly as
 * the signed PDF will print it (shared/esign/fieldText.ts): no outline, no
 * interaction, and it never counts towards this signer's progress.
 */
import { fitFieldText, formatFieldDate } from '../../shared/esign/fieldText';
import type { CompletedField } from './types';

interface PriorEntryProps {
  field: CompletedField;
  pageWidthPts?: number;
  pageHeightPts?: number;
}

export function PriorEntry({ field, pageWidthPts = 595, pageHeightPts = 842 }: PriorEntryProps) {
  const value = field.value ?? '';
  if (!value) return null;

  const box = {
    left: `${field.x}%`,
    top: `${field.y}%`,
    width: `${(field.width / pageWidthPts) * 100}%`,
    height: `${(field.height / pageHeightPts) * 100}%`,
  };

  if (value.startsWith('data:image/')) {
    return (
      <div
        className="absolute flex items-center justify-center overflow-hidden pointer-events-none"
        style={box}
        aria-label="Signed by an earlier signer"
      >
        <img src={value} alt="" className="max-h-full max-w-full object-contain" />
      </div>
    );
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

  return (
    <div
      className="absolute flex items-center overflow-hidden whitespace-nowrap pointer-events-none text-gray-900"
      style={{ ...box, containerType: 'size' }}
      aria-label="Completed by an earlier signer"
    >
      <span
        style={{
          fontSize: `${(fit.size / field.height) * 100}cqh`,
          lineHeight: 1,
          paddingLeft: `${(fit.offsetX / field.width) * 100}cqw`,
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        {text}
      </span>
    </div>
  );
}
