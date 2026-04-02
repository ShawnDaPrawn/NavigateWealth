/**
 * Person name helpers shared across admin modules.
 *
 * Keeps display names stable when legacy metadata still stores ALL CAPS.
 */

interface ResolvePersonNameInput {
  profileFirstName?: string | null;
  profileLastName?: string | null;
  metadataFirstName?: string | null;
  metadataLastName?: string | null;
  fullName?: string | null;
  fallbackFirstName?: string;
  fallbackLastName?: string;
}

function compactWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const compact = compactWhitespace(value);
    if (compact) return compact;
  }
  return '';
}

function isAllCapsName(value: string): boolean {
  const lettersOnly = value.replace(/[^a-zA-Z]/g, '');
  return lettersOnly.length > 1 && lettersOnly === lettersOnly.toUpperCase();
}

function toSmartTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s-])[a-z]/g, match => match.toUpperCase())
    .replace(/(')[a-z]/g, match => match.toUpperCase());
}

export function normalizePersonNamePart(value?: string | null): string {
  if (!value) return '';
  const compact = compactWhitespace(value);
  if (!compact) return '';
  return isAllCapsName(compact) ? toSmartTitleCase(compact) : compact;
}

export function resolvePersonName(input: ResolvePersonNameInput): { firstName: string; lastName: string } {
  const fullName = firstNonEmpty(input.fullName);
  const [splitFirstName = '', ...splitLastParts] = fullName ? fullName.split(' ') : [];
  const splitLastName = splitLastParts.join(' ');

  const firstName = normalizePersonNamePart(
    firstNonEmpty(
      input.profileFirstName,
      input.metadataFirstName,
      splitFirstName,
      input.fallbackFirstName ?? 'Unknown',
    ),
  );

  const lastName = normalizePersonNamePart(
    firstNonEmpty(
      input.profileLastName,
      input.metadataLastName,
      splitLastName,
      input.fallbackLastName ?? 'User',
    ),
  );

  return { firstName, lastName };
}

