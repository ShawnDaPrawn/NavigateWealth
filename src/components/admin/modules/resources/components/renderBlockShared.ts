/**
 * Shared shape for the PDF block renderers: the data-binding resolver the
 * host (LetterRenderer / DynamicFormRenderer) supplies.
 */
export type ResolveFunction = (obj: Record<string, unknown>, path: string) => unknown;
