/**
 * A value an EARLIER signer already completed, drawn read-only on the page so
 * a later signer sees the document as it stands. It is laid out exactly as
 * the signed PDF will print it (shared/esign/fieldText.ts): no outline, no
 * interaction, and it never counts towards this signer's progress.
 */
import { priorEntryLayout } from './priorEntryLayout';
import type { CompletedField } from './types';

interface PriorEntryProps {
  field: CompletedField;
  pageWidthPts?: number;
  pageHeightPts?: number;
}

export function PriorEntry({ field, pageWidthPts = 595, pageHeightPts = 842 }: PriorEntryProps) {
  const layout = priorEntryLayout(field, pageWidthPts, pageHeightPts);
  if (!layout) return null;

  if (layout.kind === 'image') {
    return (
      <div
        className="absolute flex items-center justify-center overflow-hidden pointer-events-none"
        style={layout.box}
        aria-label="Signed by an earlier signer"
      >
        <img src={layout.value} alt="" className="max-h-full max-w-full object-contain" />
      </div>
    );
  }

  return (
    <div
      className="absolute flex items-center overflow-hidden whitespace-nowrap pointer-events-none text-gray-900"
      style={{ ...layout.box, containerType: 'size' }}
      aria-label="Completed by an earlier signer"
    >
      <span style={layout.textStyle}>{layout.text}</span>
    </div>
  );
}
