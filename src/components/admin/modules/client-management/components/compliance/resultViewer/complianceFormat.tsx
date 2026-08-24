/**
 * Dates, currency, and the coercions the result views apply to unknown values.
 *
 * Split out of `ComplianceResultViewer.tsx` (1,486 lines), which held forty
 * named functions: the viewer, seventeen per-check result views, the primitives
 * they share, and an HTML report generator. Each was already self-contained.
 */
import React from 'react';

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatShortDate(dateStr: unknown): string {
  return new Date(dateStr as string | number).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatCurrency(val: unknown): string {
  const n = typeof val === 'number' ? val : Number(val);
  if (val == null || !Number.isFinite(n)) return '—';
  const isNeg = n < 0;
  const abs = Math.abs(n);
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNeg ? '-' : ''}R${withCommas}.${decPart}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function toNode(value: unknown): React.ReactNode {
  if (value == null) return null;
  if (React.isValidElement(value)) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value as string | number | boolean;
}

/** Coerce an unknown rawResponse value to a string for display / string args. */
export function str(value: unknown): string {
  return value == null ? '' : String(value);
}

/** Coerce an unknown rawResponse value to a finite number (0 fallback). */
export function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
