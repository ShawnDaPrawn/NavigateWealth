import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';
import type {
  AuthUserLike,
  JsonRecord,
  RoAAuditEvent,
  RoADraftRecord,
  RoAValidationIssue,
} from './advice-engine-roa-draft-types.ts';

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as JsonRecord).length > 0;
  return true;
}

export function textEncode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',').pop() || '' : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function sha256Base64(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function valueToText(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Not recorded';
  if (Array.isArray(value)) return value.map(valueToText).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function valueToHumanText(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Not recorded';
  if (Array.isArray(value))
    return value.length > 0 ? value.map(valueToHumanText).join(', ') : 'Not recorded';
  if (typeof value === 'object') {
    const entries = Object.entries(value as JsonRecord)
      .filter(([, entryValue]) => hasValue(entryValue))
      .map(([key, entryValue]) => `${formatLabel(key)}: ${valueToHumanText(entryValue)}`);
    return entries.length > 0 ? entries.join('; ') : 'Not recorded';
  }
  return String(value);
}

export function formatLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function snakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

export function camelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

export function findDataValue(key: string, ...sources: JsonRecord[]): unknown {
  const candidates = [key, snakeCase(key), camelCase(key)];
  for (const source of sources) {
    for (const candidate of candidates) {
      if (hasValue(source[candidate])) return source[candidate];
    }
  }
  return undefined;
}

export function compactList(items: Array<string | undefined | null>): string[] {
  return items.map((item) => readString(item)).filter(Boolean);
}

export function formatCurrency(value: unknown): string {
  const numeric =
    typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.-]+/g, ''));
  if (!Number.isFinite(numeric)) return valueToText(value);
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(numeric);
}

export function formatTokenValue(value: unknown, filter?: string): string {
  if (filter === 'currency') return formatCurrency(value);
  if (filter === 'percent' || filter === 'percentage')
    return hasValue(value) ? `${valueToText(value)}%` : 'Not recorded';
  if (filter === 'date') {
    const date = new Date(String(value ?? ''));
    return Number.isNaN(date.getTime()) ? valueToText(value) : date.toLocaleDateString('en-ZA');
  }
  if (filter === 'yesno') return value ? 'Yes' : 'No';
  if (filter === 'json') return JSON.stringify(value ?? null, null, 2);
  return valueToText(value);
}

export function resolvePath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (!part) return current;
    if (current && typeof current === 'object') {
      return (current as JsonRecord)[part];
    }
    return undefined;
  }, source);
}

export function renderTemplate(template: string, context: JsonRecord): string {
  return template.replace(
    /{{\s*([a-zA-Z0-9_.-]+)(?:\s*\|\s*([a-zA-Z]+))?\s*}}/g,
    (_match, path: string, filter?: string) => {
      const value = resolvePath(context, path);
      return formatTokenValue(value, filter);
    },
  );
}

export function markdownishToHtml(content: string): string {
  return content
    .split('\n')
    .map((line) => {
      if (line.startsWith('## ')) return `<h3>${escapeHtml(line.slice(3))}</h3>`;
      if (line.trim() === '') return '<br />';
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join('\n');
}

export function flattenModuleFields(contract: RoAModuleContract): string[] {
  return contract.formSchema.sections.flatMap((section) =>
    section.fields.map((field) => field.key),
  );
}

export function normalizeMimeType(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validateEvidenceMetadata(
  contract: RoAModuleContract,
  requirement: RoAModuleContract['evidence']['requirements'][number],
  evidenceValue: unknown,
): { blocking: RoAValidationIssue[]; warnings: RoAValidationIssue[] } {
  const evidence = asRecord(evidenceValue);
  const blocking: RoAValidationIssue[] = [];
  const warnings: RoAValidationIssue[] = [];
  const issueBase = {
    moduleId: contract.id,
    moduleTitle: contract.title,
    requirementId: requirement.id,
  };

  const fileName = readString(evidence.fileName);
  if (!fileName) {
    blocking.push({
      ...issueBase,
      id: `${contract.id}:evidence:${requirement.id}:file_name`,
      severity: 'blocking',
      message: `${contract.title}: ${requirement.label} evidence must include a file name.`,
    });
  }

  const evidenceRequirementId = readString(evidence.requirementId);
  if (evidenceRequirementId && evidenceRequirementId !== requirement.id) {
    blocking.push({
      ...issueBase,
      id: `${contract.id}:evidence:${requirement.id}:requirement_mismatch`,
      severity: 'blocking',
      message: `${contract.title}: ${requirement.label} evidence is attached to the wrong requirement slot.`,
    });
  }

  const allowedMimeTypes = (requirement.acceptedMimeTypes || []).map((type) => type.toLowerCase());
  const mimeType = normalizeMimeType(evidence.mimeType);
  if (allowedMimeTypes.length > 0) {
    if (!mimeType) {
      blocking.push({
        ...issueBase,
        id: `${contract.id}:evidence:${requirement.id}:mime_missing`,
        severity: 'blocking',
        message: `${contract.title}: ${requirement.label} evidence must include a file type.`,
      });
    } else if (!allowedMimeTypes.includes(mimeType)) {
      blocking.push({
        ...issueBase,
        id: `${contract.id}:evidence:${requirement.id}:mime_type`,
        severity: 'blocking',
        message: `${contract.title}: ${requirement.label} evidence must use an accepted file type.`,
      });
    }
  }

  const size =
    typeof evidence.size === 'number' && Number.isFinite(evidence.size) ? evidence.size : undefined;
  if (size !== undefined && size <= 0) {
    blocking.push({
      ...issueBase,
      id: `${contract.id}:evidence:${requirement.id}:empty_file`,
      severity: 'blocking',
      message: `${contract.title}: ${requirement.label} evidence file is empty.`,
    });
  }

  if (!readString(evidence.source)) {
    warnings.push({
      ...issueBase,
      id: `${contract.id}:evidence:${requirement.id}:source_missing`,
      severity: 'warning',
      message: `${contract.title}: ${requirement.label} evidence source is not recorded.`,
    });
  }

  if (!readString(evidence.uploadedAt)) {
    warnings.push({
      ...issueBase,
      id: `${contract.id}:evidence:${requirement.id}:uploaded_at_missing`,
      severity: 'warning',
      message: `${contract.title}: ${requirement.label} evidence upload timestamp is not recorded.`,
    });
  }

  if (!readString(evidence.sha256)) {
    warnings.push({
      ...issueBase,
      id: `${contract.id}:evidence:${requirement.id}:hash_missing`,
      severity: 'warning',
      message: `${contract.title}: ${requirement.label} evidence hash is not recorded.`,
    });
  }

  return { blocking, warnings };
}

export function appendAuditEvent(
  draft: RoADraftRecord,
  action: string,
  summary: string,
  user: AuthUserLike,
  details?: JsonRecord,
): RoAAuditEvent[] {
  const event: RoAAuditEvent = {
    id: crypto.randomUUID(),
    action,
    summary,
    createdAt: new Date().toISOString(),
    createdBy: user.id,
    details,
  };
  return [...(draft.auditEvents || []), event].slice(-200);
}

export function getLatestUpdatedAt(items: unknown[]): string | undefined {
  let latest = '';
  for (const item of items) {
    const record = asRecord(item);
    const candidate = readString(
      record.updatedAt,
      record.updated_at,
      record.createdAt,
      record.created_at,
    );
    if (candidate && (!latest || candidate > latest)) latest = candidate;
  }
  return latest || undefined;
}

export function getClientDisplayName(profile: JsonRecord): string {
  const personal = asRecord(profile.personalInformation);
  const firstName = readString(
    profile.firstName,
    profile.first_name,
    personal.firstName,
    personal.first_name,
  );
  const lastName = readString(
    profile.lastName,
    profile.surname,
    profile.last_name,
    personal.lastName,
    personal.surname,
    personal.last_name,
  );
  return (
    [firstName, lastName].filter(Boolean).join(' ') ||
    readString(profile.name, personal.fullName) ||
    'Unknown Client'
  );
}
