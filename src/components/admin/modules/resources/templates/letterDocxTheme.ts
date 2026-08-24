/**
 * Shared visual constants for the letter .docx export: colour tokens, A4
 * margins, and the no-border table-cell helper. Moved verbatim from
 * letterDocxExport.ts.
 */
import { BorderStyle } from 'docx';

export const NW_PURPLE = '6D28D9';
export const TEXT_DARK = '111827';
export const TEXT_MUTED = '6B7280';
export const TEXT_LIGHT = '9CA3AF';
export const BORDER_COLOR = 'E5E7EB';

/** A4 margins in mm matching the CSS layout */
export const MARGIN_TOP_MM = 15;
export const MARGIN_BOTTOM_MM = 10;
export const MARGIN_LEFT_MM = 18;
export const MARGIN_RIGHT_MM = 18;

// No-border helper for table cells
export const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
} as const;
