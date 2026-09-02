/**
 * Presentation helpers for the document summary timeline.
 *
 * Pure functions, no React — the timeline's date/label logic is the part most
 * worth testing, and it should not need a render to exercise.
 */

import type { DocumentSummary, SummaryEditDraft } from './summaryTypes';

/** `13 May 2026` — the format the rest of the Documents tab already uses. */
export function formatSummaryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Month heading used to break the timeline into readable runs. */
export function timelinePeriod(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Undated';
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/**
 * Group summaries under their month heading, preserving the order they arrive
 * in (the server sorts newest first).
 */
export function groupSummariesByPeriod(
  summaries: DocumentSummary[],
): Array<{ period: string; summaries: DocumentSummary[] }> {
  const periods: Array<{ period: string; summaries: DocumentSummary[] }> = [];

  for (const summary of summaries) {
    const period = timelinePeriod(summary.documentDate);
    const current = periods[periods.length - 1];
    if (current && current.period === period) current.summaries.push(summary);
    else periods.push({ period, summaries: [summary] });
  }

  return periods;
}

/**
 * How much of the batch the model actually read.
 *
 * Word/Excel files and links contribute metadata only, so a summary can cover
 * six documents having read two. Saying so is the difference between a useful
 * record and a misleading one.
 */
export function analysedCoverage(summary: DocumentSummary): {
  analysed: number;
  total: number;
  partial: boolean;
} {
  const total = summary.documents?.length ?? summary.documentCount ?? 0;
  const analysed = (summary.documents ?? []).filter((doc) => doc.analysed).length;
  return { analysed, total, partial: total > 0 && analysed < total };
}

/** Seed the edit form from a stored summary. */
export function toEditDraft(summary: DocumentSummary): SummaryEditDraft {
  return {
    headline: summary.headline,
    summary: summary.summary,
    highlights: [...(summary.highlights ?? [])],
    followUps: [...(summary.followUps ?? [])],
  };
}

/** Bullet lists are edited as one textarea; one non-empty line each. */
export function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

export function listToLines(value: string[] | undefined): string {
  return (value ?? []).join('\n');
}
