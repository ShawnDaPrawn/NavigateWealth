/**
 * Small helpers shared by the Navigator account pages (login, signup, password
 * recovery, email verification). Kept out of the component files so each of
 * those exports components only.
 */
import { useEffect } from 'react';

/** The id of a field's inline error message. */
export const fieldErrorId = (fieldId: string) => `${fieldId}-error`;

/** Joins the ids an input is described by, skipping the absent ones. */
export function describedBy(...ids: Array<string | false | null | undefined>): string | undefined {
  const present = ids.filter(Boolean);
  return present.length > 0 ? present.join(' ') : undefined;
}

/**
 * Moves focus to the field a validation message is about, once per submit
 * attempt, so keyboard and screen-reader users land on what needs fixing.
 */
export function useFocusOnInvalid(attempt: number, fieldId: string | null) {
  useEffect(() => {
    if (attempt > 0 && fieldId) document.getElementById(fieldId)?.focus();
  }, [attempt, fieldId]);
}

/** The colour band a 0–4 password score falls in. */
export function strengthTone(score: number): 'weak' | 'fair' | 'strong' {
  if (score <= 1) return 'weak';
  if (score === 2) return 'fair';
  return 'strong';
}

/** True for a plain left click: the in-page viewer handles it, not the browser. */
export function isPlainClick(e: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
