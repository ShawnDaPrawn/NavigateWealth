/**
 * Newsletter Studio — preview helpers shared by the composer, drill-down and
 * template library. Kept out of component files so fast refresh stays intact.
 */
import DOMPurify from 'dompurify';
import { MERGE_FIELDS } from '../constants';

/** Replace every merge token with its sample value for previews. */
export function applySampleMergeFields(input: string): string {
  return MERGE_FIELDS.reduce((out, field) => out.split(field.token).join(field.sample), input);
}

/** Sanitize admin-authored HTML before rendering it in the admin UI. */
export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

/** True when the HTML carries visible text (not just empty tags). */
export function hasVisibleText(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim().length > 0
  );
}
