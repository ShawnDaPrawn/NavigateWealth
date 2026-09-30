/**
 * Portfolio table service.
 * ========================
 *
 * The provider + product-category "book": every client's policies for one
 * provider and one product, laid out as the Product Structure defines it — a
 * column per schema field — plus when each record was last updated and which
 * policy print (PDF) is on file. Three consumers share it:
 *
 *   - the Portfolio tab on the admin Integrations panel renders it;
 *   - the spreadsheet download serialises it, and a re-upload of that sheet
 *     (or any sheet with the same headers) updates the matching records;
 *   - `/integrations/portfolio-table` hands the same JSON to an outside agent,
 *     which posts corrections on its own schedule.
 *
 * HOW A ROW FINDS ITS POLICY
 * --------------------------
 * By CLIENT NAME + POLICY NUMBER, both of which a human or a bot can read off
 * the table. The hidden `_NW` id columns a downloaded sheet carries are used
 * first when present — they survive a client rename and tell two identical
 * policy numbers apart — but the client name on the row still has to match
 * the policy's owner. A policy number that belongs to a different client is
 * reported as `client_mismatch` and never applied: the number alone is not
 * the key, because a wrong row would otherwise write into a stranger's record.
 *
 * WHAT APPLYING MEANS
 * -------------------
 * Values are coerced by field type exactly as a spreadsheet upload's are, a
 * field an adviser has locked is never overwritten, and a row with any invalid
 * cell is refused whole (an automated caller should fix and resend rather
 * than have half a row land). Writes go through `publishSyncRun`, so a policy
 * updated here carries the same `integrationSyncHistory` provenance as one
 * updated by the portal worker, and client totals are recalculated the same
 * way. Changes apply directly — there is no staging step — which is why every
 * caller can ask for a dry run first and why the run is persisted afterwards.
 *
 * Nothing here touches `kv_store` directly: reads and writes go through the
 * repositories and the sync engine, so the kv-direct-access ratchet holds.
 */

import { createModuleLogger } from './stderr-logger.ts';
import { normaliseIntegrationBlankBehavior } from '../../../shared/integrations/binding-utils.ts';
import {
  PORTFOLIO_CLIENT_COLUMN,
  PORTFOLIO_MAX_ROWS,
  PORTFOLIO_PRINT_COLUMN,
  PORTFOLIO_SHEET_NAME,
  PORTFOLIO_UPDATED_COLUMN,
  clientNamesMatch,
  displayNameFromProfile,
  type PortfolioApplyReport,
  type PortfolioApplySummary,
  type PortfolioCatalogueEntry,
  type PortfolioColumn,
  type PortfolioRow,
  type PortfolioRowChange,
  type PortfolioRowInput,
  type PortfolioRowOutcome,
  type PortfolioRowStatus,
  type PortfolioTable,
} from '../../../shared/integrations/portfolio-table.ts';
import { normaliseIntegrationConfig } from './integrations-config-utils.ts';
import {
  POLICY_CATEGORY_LABELS,
  createPolicyDocumentSignedUrl,
} from './integrations-document-storage.ts';
import {
  coerceFieldValue,
  findPolicyNumberField,
  getPolicyNumberForPolicy,
  getSchemaForCategory,
  isBlank,
  valuesDiffer,
} from './integrations-field-utils.ts';
import {
  TEMPLATE_METADATA_COLUMNS,
  appendSpreadsheetRowsSheet,
  appendSpreadsheetSheet,
  buildTemplateFileName,
  createSpreadsheetWorkbook,
  encodeSpreadsheetRange,
  getTemplateRowMetadata,
  isTemplateMetadataColumn,
  jsonRowsToSpreadsheetSheet,
  normalisePolicyNumber,
  readSpreadsheetUpload,
  rowsToSpreadsheetSheet,
  serialiseTemplateCellValue,
  stripUnsafeSpreadsheetKeys,
  writeSpreadsheetWorkbook,
} from './integrations-spreadsheet.ts';
import {
  getTemplateFieldBindings,
  listPoliciesForProviderCategory,
  publishSyncRun,
  summariseSyncRows,
} from './integrations-sync-engine.ts';
import type {
  IntegrationFieldBinding,
  IntegrationSyncRow,
  IntegrationSyncRun,
  UploadHistory,
} from './integrations-core-types.ts';
import type {
  KvPolicy,
  KvProvider,
  KvSchema,
  PolicyDocument,
  SchemaField,
} from './integrations-types.ts';
import { providers } from './repositories/portal-automation-repository.ts';
import {
  clientPolicies,
  getClientProfiles,
  integrationConfigs,
  recordUploadHistory,
  syncRuns,
} from './repositories/integration-book-repository.ts';

const log = createModuleLogger('integrations-portfolio-table');

export const PORTFOLIO_INSTRUCTIONS_SHEET_NAME = 'Instructions';
export const PORTFOLIO_DICTIONARY_SHEET_NAME = 'Field Dictionary';

/** The hidden id columns a downloaded sheet carries, in column order. */
const PORTFOLIO_METADATA_COLUMNS = [
  TEMPLATE_METADATA_COLUMNS.policyId,
  TEMPLATE_METADATA_COLUMNS.clientId,
  TEMPLATE_METADATA_COLUMNS.providerId,
  TEMPLATE_METADATA_COLUMNS.categoryId,
] as const;

const RESERVED_HEADERS = new Set(
  [PORTFOLIO_CLIENT_COLUMN, PORTFOLIO_UPDATED_COLUMN, PORTFOLIO_PRINT_COLUMN].map((h) =>
    h.toLowerCase(),
  ),
);

/** One policy of the book with the two things a row is matched on resolved. */
export interface PortfolioBookEntry {
  policy: KvPolicy;
  policyNumber: string;
  normalizedPolicyNumber: string;
  clientName: string;
}

/** Everything a table, a workbook or an apply needs about one provider + category. */
export interface PortfolioBook {
  provider: KvProvider;
  providerId: string;
  providerName: string;
  categoryId: string;
  categoryLabel: string;
  fields: SchemaField[];
  policyNumberField: SchemaField | undefined;
  bindings: IntegrationFieldBinding[];
  entries: PortfolioBookEntry[];
}

/** A proposed row, plus errors the sheet parser already found on it. */
export interface PortfolioRowDraft extends PortfolioRowInput {
  errors?: string[];
}

export function getPortfolioCategoryLabel(categoryId: string): string {
  return POLICY_CATEGORY_LABELS[categoryId] || categoryId;
}

function providerCategoryIds(provider: KvProvider): string[] {
  const raw = (provider.category_ids as string[] | undefined) || provider.categoryIds || [];
  return Array.isArray(raw) ? raw.map((id) => String(id)).filter(Boolean) : [];
}

function compareEntries(a: PortfolioBookEntry, b: PortfolioBookEntry): number {
  return (
    a.clientName.localeCompare(b.clientName) ||
    a.policyNumber.localeCompare(b.policyNumber) ||
    a.policy.id.localeCompare(b.policy.id)
  );
}

/**
 * Load the book. Returns null when the provider does not exist, which the
 * routes answer as the same 400 the sibling integrations routes give.
 */
export async function loadPortfolioBook(
  providerId: string,
  categoryId: string,
): Promise<PortfolioBook | null> {
  const provider = await providers.get(providerId);
  if (!provider) return null;

  const schema = await getSchemaForCategory(categoryId);
  const fields = schema.fields || [];
  const storedConfig = await integrationConfigs.get(`${providerId}:${categoryId}`);
  const config = normaliseIntegrationConfig(
    storedConfig ? { ...storedConfig, providerId, categoryId } : null,
    fields,
  );
  const bindings = getTemplateFieldBindings(config, fields);

  // `listPoliciesForProviderCategory` treats a parent id as its whole group,
  // so a request for `employee_benefits` would also load the `_risk` and
  // `_retirement` policies — whose schemas differ from the parent's. The
  // table's columns and the fields a row may write come from ONE schema, so
  // the book holds only policies filed under exactly this category id; a row
  // can never write one schema's field ids into a policy that uses another.
  const policies = (await listPoliciesForProviderCategory(providerId, categoryId)).filter(
    (policy) => policy.categoryId === categoryId,
  );

  // Warm the schema cache per distinct category first, so resolving a policy
  // number below is a lookup rather than a read per policy.
  const schemaCache = new Map<string, KvSchema>([[categoryId, schema]]);
  for (const policyCategoryId of new Set(policies.map((policy) => policy.categoryId))) {
    if (!schemaCache.has(policyCategoryId)) {
      schemaCache.set(policyCategoryId, await getSchemaForCategory(policyCategoryId));
    }
  }

  const profiles = await getClientProfiles(policies.map((policy) => policy.clientId));

  const entries: PortfolioBookEntry[] = [];
  for (const policy of policies) {
    const policyNumber = await getPolicyNumberForPolicy(policy, fields, schemaCache);
    entries.push({
      policy,
      policyNumber,
      normalizedPolicyNumber: normalisePolicyNumber(policyNumber),
      clientName: displayNameFromProfile(profiles.get(policy.clientId), policy.clientId),
    });
  }
  entries.sort(compareEntries);

  return {
    provider,
    providerId,
    providerName: provider.name || providerId,
    categoryId,
    categoryLabel: getPortfolioCategoryLabel(categoryId),
    fields,
    policyNumberField: findPolicyNumberField(fields),
    bindings,
    entries,
  };
}

function latestSync(policy: KvPolicy): PortfolioRow['lastSync'] {
  const history = Array.isArray(policy.integrationSyncHistory) ? policy.integrationSyncHistory : [];
  const latest = history[history.length - 1];
  return latest?.publishedAt ? { source: latest.source, publishedAt: latest.publishedAt } : null;
}

function policyPrintOf(policy: KvPolicy): PortfolioRow['policyPrint'] {
  const document = policy.document;
  if (!document?.storageKey) return null;
  return {
    fileName: document.fileName || 'policy_schedule.pdf',
    uploadDate: document.uploadDate || '',
    documentType: document.documentType || 'policy_schedule',
    fileSize: Number(document.fileSize) || 0,
  };
}

export function tableFromBook(book: PortfolioBook): PortfolioTable {
  const columns: PortfolioColumn[] = book.fields.map((field) => ({
    id: field.id,
    name: String(field.name || field.id),
    type: String(field.type || 'text'),
    required: field.required === true,
    ...(Array.isArray(field.options)
      ? { options: (field.options as unknown[]).map((option) => String(option)) }
      : {}),
    isPolicyNumber: field.id === book.policyNumberField?.id,
  }));

  const rows: PortfolioRow[] = book.entries.map((entry) => ({
    clientId: entry.policy.clientId,
    clientName: entry.clientName,
    policyId: entry.policy.id,
    policyNumber: entry.policyNumber,
    categoryId: entry.policy.categoryId,
    updatedAt: entry.policy.updatedAt || entry.policy.createdAt || '',
    ...(entry.policy.createdAt ? { createdAt: entry.policy.createdAt } : {}),
    lockedFields: Array.isArray(entry.policy.lockedFields) ? [...entry.policy.lockedFields] : [],
    values: Object.fromEntries(
      book.fields.map((field) => [field.id, entry.policy.data?.[field.id] ?? null]),
    ),
    lastSync: latestSync(entry.policy),
    policyPrint: policyPrintOf(entry.policy),
  }));

  return {
    providerId: book.providerId,
    providerName: book.providerName,
    categoryId: book.categoryId,
    categoryLabel: book.categoryLabel,
    generatedAt: new Date().toISOString(),
    columns,
    rows,
    clientCount: new Set(rows.map((row) => row.clientId)).size,
    policyCount: rows.length,
  };
}

export async function buildPortfolioTable(
  providerId: string,
  categoryId: string,
): Promise<PortfolioTable | null> {
  const book = await loadPortfolioBook(providerId, categoryId);
  return book ? tableFromBook(book) : null;
}

// ---------------------------------------------------------------------------
// Spreadsheet
// ---------------------------------------------------------------------------

/**
 * The header each schema column gets in the sheet: its field name, or
 * `name [id]` when the name would collide with a reserved column or another
 * field — the parser reads the bracketed id back.
 */
export function portfolioColumnHeaders(columns: PortfolioColumn[]): Map<string, string> {
  const used = new Set(RESERVED_HEADERS);
  const headers = new Map<string, string>();
  for (const column of columns) {
    let header = column.name.trim() || column.id;
    if (used.has(header.toLowerCase())) header = `${header} [${column.id}]`;
    used.add(header.toLowerCase());
    headers.set(column.id, header);
  }
  return headers;
}

function describePrint(print: PortfolioRow['policyPrint']): string {
  if (!print) return '';
  const day = print.uploadDate ? print.uploadDate.slice(0, 10) : '';
  return day ? `${print.fileName} (${day})` : print.fileName;
}

export function buildPortfolioWorkbook(
  table: PortfolioTable,
  bindings: IntegrationFieldBinding[] = [],
): { bytes: ArrayBuffer; fileName: string } {
  const headersById = portfolioColumnHeaders(table.columns);
  const headers = [
    PORTFOLIO_CLIENT_COLUMN,
    ...table.columns.map((column) => headersById.get(column.id)!),
    PORTFOLIO_UPDATED_COLUMN,
    PORTFOLIO_PRINT_COLUMN,
    ...PORTFOLIO_METADATA_COLUMNS,
  ];

  const rows = table.rows.map((row) => ({
    [PORTFOLIO_CLIENT_COLUMN]: row.clientName,
    ...Object.fromEntries(
      table.columns.map((column) => [
        headersById.get(column.id)!,
        serialiseTemplateCellValue(row.values[column.id]),
      ]),
    ),
    [PORTFOLIO_UPDATED_COLUMN]: row.updatedAt,
    [PORTFOLIO_PRINT_COLUMN]: describePrint(row.policyPrint),
    [TEMPLATE_METADATA_COLUMNS.policyId]: row.policyId,
    [TEMPLATE_METADATA_COLUMNS.clientId]: row.clientId,
    [TEMPLATE_METADATA_COLUMNS.providerId]: table.providerId,
    [TEMPLATE_METADATA_COLUMNS.categoryId]: row.categoryId,
  }));

  const workbook = createSpreadsheetWorkbook();
  const sheet =
    rows.length > 0
      ? jsonRowsToSpreadsheetSheet(rows, { header: headers })
      : rowsToSpreadsheetSheet([headers]);
  sheet['!cols'] = headers.map((header) => ({
    wch: isTemplateMetadataColumn(header) ? 22 : Math.max(14, Math.min(36, header.length + 4)),
    hidden: isTemplateMetadataColumn(header),
  }));
  sheet['!autofilter'] = {
    ref: encodeSpreadsheetRange({
      s: { r: 0, c: 0 },
      e: { r: rows.length, c: headers.length - 1 },
    }),
  };
  appendSpreadsheetSheet(workbook, sheet, PORTFOLIO_SHEET_NAME);

  appendSpreadsheetRowsSheet(
    workbook,
    [
      ['Navigate Wealth Portfolio'],
      ['Provider', table.providerName],
      ['Product Type', table.categoryLabel],
      ['Generated', table.generatedAt],
      ['Policies', table.policyCount],
      ['Clients', table.clientCount],
      [],
      ['How to use this sheet'],
      [`1. Work in the ${PORTFOLIO_SHEET_NAME} sheet. One row is one client policy.`],
      [
        `2. Rows are matched to records by ${PORTFOLIO_CLIENT_COLUMN} plus the policy number. The hidden _NW columns pin a row to its exact record; keep them.`,
      ],
      [
        '3. Change any product column and upload the sheet in Product Configuration > Integrations > Portfolio. Only cells that differ from the record are applied.',
      ],
      [
        `4. ${PORTFOLIO_UPDATED_COLUMN} and ${PORTFOLIO_PRINT_COLUMN} are read-only; edits to them are ignored.`,
      ],
      ['5. A field an adviser has locked is never overwritten from a sheet.'],
      [
        '6. A blank cell leaves the record alone unless the field is configured to clear on blank (see the Field Dictionary).',
      ],
    ],
    PORTFOLIO_INSTRUCTIONS_SHEET_NAME,
  );

  const bindingByField = new Map(bindings.map((binding) => [binding.targetFieldId, binding]));
  appendSpreadsheetRowsSheet(
    workbook,
    [
      ['Column', 'Field ID', 'Type', 'Required', 'Dropdown Options', 'Blank Handling', 'Notes'],
      ...table.columns.map((column) => [
        headersById.get(column.id)!,
        column.id,
        column.type,
        column.required ? 'yes' : 'no',
        (column.options || []).join('|'),
        normaliseIntegrationBlankBehavior(bindingByField.get(column.id)?.blankBehavior),
        column.isPolicyNumber ? 'Match field, with the client name.' : '',
      ]),
    ],
    PORTFOLIO_DICTIONARY_SHEET_NAME,
  );

  return {
    bytes: writeSpreadsheetWorkbook(workbook),
    fileName: buildTemplateFileName(table.providerName, table.categoryLabel, 'Portfolio'),
  };
}

function normaliseHeaderKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Resolve a column header or a JSON key to a schema field: by id, by the
 * `name [id]` form the sheet writes on collisions, by field name, or by the
 * spreadsheet column configured in Mapping Configuration.
 */
export function buildFieldResolver(book: PortfolioBook): (key: unknown) => SchemaField | undefined {
  const byId = new Map(book.fields.map((field) => [field.id, field]));
  const byName = new Map<string, SchemaField>();
  for (const field of book.fields) {
    const name = normaliseHeaderKey(field.name);
    if (name && !byName.has(name)) byName.set(name, field);
  }
  const byColumn = new Map<string, SchemaField>();
  for (const binding of book.bindings) {
    const field = byId.get(binding.targetFieldId);
    const column = normaliseHeaderKey(binding.columnName);
    if (field && column && !byColumn.has(column)) byColumn.set(column, field);
  }

  return (key: unknown) => {
    const raw = String(key ?? '').trim();
    if (!raw) return undefined;
    if (byId.has(raw)) return byId.get(raw);
    const bracketed = raw.match(/\[([^\]]+)\]\s*$/);
    if (bracketed && byId.has(bracketed[1])) return byId.get(bracketed[1]);
    const normalised = normaliseHeaderKey(raw);
    return byName.get(normalised) || byColumn.get(normalised);
  };
}

export interface ParsedPortfolioSheet {
  rows: PortfolioRowDraft[];
  warnings: string[];
}

/**
 * Turn an uploaded workbook into row drafts against the book's fields.
 *
 * Throws (with a plain-English message) on a workbook that cannot be read at
 * all; per-row problems are carried on the draft for the apply report.
 */
export function parsePortfolioSpreadsheet(
  buffer: ArrayBuffer,
  book: PortfolioBook,
): ParsedPortfolioSheet {
  const { headers, rawRows } = readSpreadsheetUpload(buffer, {
    preferredSheets: [PORTFOLIO_SHEET_NAME],
  });
  if (headers.length === 0) throw new Error('The spreadsheet has no headers in its first row');

  const resolveField = buildFieldResolver(book);
  const fieldHeaders = new Map<string, SchemaField>();
  let clientHeader: string | undefined;
  const unknownHeaders: string[] = [];

  for (const header of headers) {
    const key = normaliseHeaderKey(header);
    if (key === PORTFOLIO_CLIENT_COLUMN.toLowerCase()) {
      clientHeader = header;
      continue;
    }
    if (RESERVED_HEADERS.has(key) || isTemplateMetadataColumn(header)) continue;
    const field = resolveField(header);
    if (field) fieldHeaders.set(header, field);
    else unknownHeaders.push(header);
  }

  const warnings: string[] = [];
  if (fieldHeaders.size === 0) {
    throw new Error(
      `None of the columns match the ${book.categoryLabel} product structure. Download the Portfolio sheet and edit that.`,
    );
  }
  if (!clientHeader) {
    warnings.push(
      `The sheet has no "${PORTFOLIO_CLIENT_COLUMN}" column, so rows can only be matched through the hidden _NW columns of a downloaded sheet.`,
    );
  }
  if (unknownHeaders.length > 0) {
    warnings.push(
      `Ignored columns that are not part of the ${book.categoryLabel} product structure: ${unknownHeaders.join(', ')}`,
    );
  }

  const policyNumberHeader = [...fieldHeaders.entries()].find(
    ([, field]) => field.id === book.policyNumberField?.id,
  )?.[0];

  const rows: PortfolioRowDraft[] = rawRows.map((raw, index) => {
    const metadata = getTemplateRowMetadata(raw);
    const errors: string[] = [];
    if (metadata.providerId && metadata.providerId !== book.providerId) {
      errors.push('This row belongs to a different provider sheet');
    }
    if (metadata.categoryId && metadata.categoryId !== book.categoryId) {
      errors.push('This row belongs to a different product sheet');
    }
    const values: Record<string, unknown> = {};
    for (const [header, field] of fieldHeaders) values[field.id] = raw[header];
    return {
      rowNumber: index + 2,
      clientName: clientHeader ? String(raw[clientHeader] ?? '').trim() : '',
      policyNumber: policyNumberHeader ? String(raw[policyNumberHeader] ?? '').trim() : '',
      ...(metadata.policyId ? { policyId: metadata.policyId } : {}),
      ...(metadata.clientId ? { clientId: metadata.clientId } : {}),
      values,
      ...(errors.length > 0 ? { errors } : {}),
    };
  });

  return { rows, warnings };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export interface ApplyPortfolioRowsParams {
  providerId: string;
  categoryId: string;
  rows: PortfolioRowDraft[];
  dryRun: boolean;
  source: 'spreadsheet' | 'api';
  /** Who is writing, for the run and history records. */
  actor: string;
  fileName?: string;
  sheetWarnings?: string[];
  /** A book already loaded by the caller (the upload path parses with it first). */
  book?: PortfolioBook;
}

function summariseOutcomes(outcomes: PortfolioRowOutcome[]): PortfolioApplySummary {
  const count = (status: PortfolioRowStatus) =>
    outcomes.filter((outcome) => outcome.status === status).length;
  return {
    rows: outcomes.length,
    updated: count('updated'),
    unchanged: count('unchanged'),
    unmatched: count('unmatched'),
    clientMismatch: count('client_mismatch'),
    duplicate: count('duplicate'),
    invalid: count('invalid'),
    failed: count('failed'),
    clientsTouched: new Set(
      outcomes
        .filter((outcome) => outcome.status === 'updated')
        .map((outcome) => outcome.clientId)
        .filter(Boolean),
    ).size,
  };
}

interface RowEvaluation {
  outcome: PortfolioRowOutcome;
  syncRow: IntegrationSyncRow;
}

function evaluateRow(
  book: PortfolioBook,
  index: number,
  input: PortfolioRowDraft,
  lookups: {
    resolveField: (key: unknown) => SchemaField | undefined;
    blankBehaviorByField: Map<string, 'ignore' | 'clear' | 'error'>;
    byPolicyId: Map<string, PortfolioBookEntry>;
    byNumber: Map<string, PortfolioBookEntry[]>;
    fieldById: Map<string, SchemaField>;
  },
): RowEvaluation {
  const rowNumber = input.rowNumber ?? index + 1;
  const clientName = String(input.clientName ?? '').trim();
  const errors = [...(input.errors || [])];
  const warnings: string[] = [];
  const values = stripUnsafeSpreadsheetKeys(input.values || {});
  const mappedData: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(values)) {
    const field = lookups.resolveField(key);
    if (!field) {
      warnings.push(`"${key}" is not a field of ${book.categoryLabel} and was ignored`);
      continue;
    }
    const blankBehavior = lookups.blankBehaviorByField.get(field.id) || 'ignore';
    if (isBlank(raw)) {
      if (blankBehavior === 'clear') mappedData[field.id] = '';
      else if (blankBehavior === 'error') errors.push(`${field.name} cannot be blank`);
      continue;
    }
    const { value, error } = coerceFieldValue(field, raw);
    if (error) {
      errors.push(error);
      continue;
    }
    mappedData[field.id] = value;
  }

  let policyNumber = String(input.policyNumber ?? '').trim();
  if (!policyNumber && book.policyNumberField && !isBlank(mappedData[book.policyNumberField.id])) {
    policyNumber = String(mappedData[book.policyNumberField.id]).trim();
  }
  const normalizedPolicyNumber = normalisePolicyNumber(policyNumber);

  let status: PortfolioRowStatus | null = null;
  let matched: PortfolioBookEntry | undefined;
  let matchedBy: PortfolioRowOutcome['matchedBy'] = null;
  let matchedClientName: string | undefined;

  if (errors.length === 0) {
    const policyId = String(input.policyId ?? '').trim();
    const clientId = String(input.clientId ?? '').trim();
    if (policyId || clientId) {
      const candidate = policyId ? lookups.byPolicyId.get(policyId) : undefined;
      if (!candidate || (clientId && candidate.policy.clientId !== clientId)) {
        errors.push(
          `The hidden policy and client ids do not match a ${book.providerName} ${book.categoryLabel} policy`,
        );
      } else if (clientName && !clientNamesMatch(candidate.clientName, clientName)) {
        status = 'client_mismatch';
        matchedClientName = candidate.clientName;
        errors.push(
          `Client "${clientName}" is not the owner of policy ${candidate.policyNumber || candidate.policy.id} (${candidate.clientName})`,
        );
      } else {
        matched = candidate;
        matchedBy = 'ids';
        if (normalizedPolicyNumber && normalizedPolicyNumber !== candidate.normalizedPolicyNumber) {
          warnings.push(
            `Policy number "${policyNumber}" differs from the record's "${candidate.policyNumber}"`,
          );
        }
      }
    } else if (!normalizedPolicyNumber) {
      errors.push('Policy number is required for matching');
    } else if (!clientName) {
      errors.push('Client name is required for matching');
    } else {
      const numberMatches = lookups.byNumber.get(normalizedPolicyNumber) || [];
      if (numberMatches.length === 0) {
        status = 'unmatched';
        errors.push(
          `No ${book.providerName} ${book.categoryLabel} policy carries the number "${policyNumber}"`,
        );
      } else {
        const nameMatches = numberMatches.filter((entry) =>
          clientNamesMatch(entry.clientName, clientName),
        );
        if (nameMatches.length === 1) {
          matched = nameMatches[0];
          matchedBy = 'client_name_policy_number';
        } else if (nameMatches.length === 0) {
          status = 'client_mismatch';
          matchedClientName = numberMatches.map((entry) => entry.clientName).join('; ');
          errors.push(
            `Policy "${policyNumber}" belongs to ${matchedClientName}, not "${clientName}"`,
          );
        } else {
          status = 'duplicate';
          errors.push(
            `${nameMatches.length} policies share number "${policyNumber}" for ${clientName}. Download the sheet and keep its hidden _NW columns to target one.`,
          );
        }
      }
    }
  }

  const changes: PortfolioRowChange[] = [];
  if (matched) {
    matchedClientName = matched.clientName;
    const locked = new Set(matched.policy.lockedFields || []);
    for (const [fieldId, newValue] of Object.entries(mappedData)) {
      const oldValue = matched.policy.data?.[fieldId];
      if (!valuesDiffer(oldValue, newValue)) continue;
      const fieldName = lookups.fieldById.get(fieldId)?.name || fieldId;
      if (locked.has(fieldId)) {
        warnings.push(`${fieldName} is locked and was not changed`);
        continue;
      }
      changes.push({ fieldId, fieldName, oldValue, newValue });
    }
  }

  if (!status) {
    status =
      errors.length > 0
        ? 'invalid'
        : !matched
          ? 'unmatched'
          : changes.length > 0
            ? 'updated'
            : 'unchanged';
  }

  const outcome: PortfolioRowOutcome = {
    rowNumber,
    clientName,
    policyNumber,
    status,
    ...(matched ? { policyId: matched.policy.id, clientId: matched.policy.clientId } : {}),
    ...(matchedClientName ? { matchedClientName } : {}),
    matchedBy,
    changes,
    warnings,
    errors,
  };

  const syncRow: IntegrationSyncRow = {
    id: crypto.randomUUID(),
    rowNumber,
    rawData: { [PORTFOLIO_CLIENT_COLUMN]: clientName, ...values },
    mappedData,
    policyNumber,
    normalizedPolicyNumber,
    matchMethod:
      matchedBy === 'ids' ? 'template_metadata' : normalizedPolicyNumber ? 'policy_number' : 'none',
    matchStatus: matched
      ? 'matched'
      : status === 'duplicate'
        ? 'duplicate'
        : status === 'invalid'
          ? 'invalid'
          : 'unmatched',
    publishStatus: matched ? (changes.length > 0 ? 'pending' : 'skipped') : 'held',
    autoPublishEligible: false,
    validationErrors: errors,
    warnings,
    diffs: changes,
    ...(matched ? { clientId: matched.policy.clientId, policyId: matched.policy.id } : {}),
    providerName: book.providerName,
  };

  return { outcome, syncRow };
}

/**
 * Match every proposed row to its policy and, unless this is a dry run, write
 * the differences. Returns null when the provider does not exist.
 */
export async function applyPortfolioRows(
  params: ApplyPortfolioRowsParams,
): Promise<PortfolioApplyReport | null> {
  if (params.rows.length > PORTFOLIO_MAX_ROWS) {
    throw new Error(`At most ${PORTFOLIO_MAX_ROWS} rows can be applied in one request`);
  }
  const book = params.book ?? (await loadPortfolioBook(params.providerId, params.categoryId));
  if (!book) return null;

  const byPolicyId = new Map(book.entries.map((entry) => [entry.policy.id, entry]));
  const byNumber = new Map<string, PortfolioBookEntry[]>();
  for (const entry of book.entries) {
    if (!entry.normalizedPolicyNumber) continue;
    const bucket = byNumber.get(entry.normalizedPolicyNumber) || [];
    bucket.push(entry);
    byNumber.set(entry.normalizedPolicyNumber, bucket);
  }
  const lookups = {
    resolveField: buildFieldResolver(book),
    blankBehaviorByField: new Map(
      book.bindings.map((binding) => [
        binding.targetFieldId,
        normaliseIntegrationBlankBehavior(binding.blankBehavior),
      ]),
    ),
    byPolicyId,
    byNumber,
    fieldById: new Map(book.fields.map((field) => [field.id, field])),
  };

  const evaluations = params.rows.map((row, index) => evaluateRow(book, index, row, lookups));
  const outcomes = evaluations.map((evaluation) => evaluation.outcome);
  const syncRows = evaluations.map((evaluation) => evaluation.syncRow);

  const now = new Date().toISOString();
  const fileName =
    params.fileName ||
    (params.source === 'api'
      ? `Portfolio update via API (${params.actor})`
      : 'Portfolio spreadsheet upload');
  const run: IntegrationSyncRun = {
    id: crypto.randomUUID(),
    providerId: book.providerId,
    providerName: book.providerName,
    categoryId: book.categoryId,
    fileName,
    source: 'portfolio_table',
    status: 'staged',
    createdAt: now,
    updatedAt: now,
    mappingVersion: `${book.providerId}:${book.categoryId}:portfolio:${now}`,
    autoPublish: false,
    summary: summariseSyncRows(syncRows),
    rows: syncRows,
  };

  let runId: string | null = null;
  if (!params.dryRun && run.summary.changedRows > 0) {
    const published = await publishSyncRun(run);
    published.rows.forEach((row, index) => {
      const outcome = outcomes[index];
      if (outcome.status !== 'updated') return;
      if (row.publishStatus === 'failed') {
        outcome.status = 'failed';
        outcome.warnings = [...row.warnings];
      } else if (row.publishStatus === 'skipped') {
        outcome.status = 'unchanged';
      }
    });
    await syncRuns.put(published.id, published);
    runId = published.id;
  }

  const summary = summariseOutcomes(outcomes);
  const errorCount =
    summary.unmatched + summary.clientMismatch + summary.duplicate + summary.invalid;

  // A run that changed nothing and hit nothing leaves no history entry: a bot
  // on a schedule would otherwise write a row per tick into a namespace the
  // Integrations header prefix-scans on every load.
  if (!params.dryRun && (summary.updated > 0 || summary.failed > 0 || errorCount > 0)) {
    const history: UploadHistory = {
      id: crypto.randomUUID(),
      providerId: book.providerId,
      categoryId: book.categoryId,
      fileName,
      // An entry is only written when something was updated or something went
      // wrong, so a run that updated nothing is a failed attempt — otherwise a
      // submission where every row was refused would show in the Integrations
      // header as the last SUCCESSFUL sync.
      status: summary.updated > 0 ? 'success' : 'failed',
      rowCount: outcomes.length,
      errorCount: errorCount + summary.failed,
      uploadedAt: now,
      errors: [],
      ...(runId ? { runId } : {}),
      publishedRows: summary.updated,
    };
    await recordUploadHistory(history);
  }

  log.info('Portfolio rows evaluated', {
    providerId: book.providerId,
    categoryId: book.categoryId,
    source: params.source,
    actor: params.actor,
    dryRun: params.dryRun,
    ...summary,
  });

  return {
    success: true,
    dryRun: params.dryRun,
    providerId: book.providerId,
    providerName: book.providerName,
    categoryId: book.categoryId,
    categoryLabel: book.categoryLabel,
    source: params.source,
    runId,
    appliedAt: now,
    summary,
    warnings: [...(params.sheetWarnings || [])],
    rows: outcomes,
  };
}

// ---------------------------------------------------------------------------
// Catalogue and policy prints
// ---------------------------------------------------------------------------

/** Every provider with its product categories and how many policies each holds. */
export async function listPortfolioCatalogue(): Promise<PortfolioCatalogueEntry[]> {
  const [allProviders, books] = await Promise.all([
    providers.listAll('portfolio catalogue: every provider and its product categories'),
    clientPolicies.listAll('portfolio catalogue: policy counts per provider and product'),
  ]);

  const policiesByProvider = new Map<string, KvPolicy[]>();
  for (const book of books) {
    if (!Array.isArray(book)) continue;
    for (const policy of book) {
      if (!policy || policy.archived || !policy.providerId) continue;
      const bucket = policiesByProvider.get(policy.providerId) || [];
      bucket.push(policy);
      policiesByProvider.set(policy.providerId, bucket);
    }
  }

  return allProviders
    .filter((provider) => provider && provider.id)
    .map((provider) => {
      const providerPolicies = policiesByProvider.get(provider.id) || [];
      return {
        providerId: provider.id,
        providerName: provider.name || provider.id,
        categories: providerCategoryIds(provider).map((categoryId) => {
          // Exact match, the same scope as the table itself, so the count a
          // bot reads here is the number of rows it will get.
          const matching = providerPolicies.filter((policy) => policy.categoryId === categoryId);
          return {
            categoryId,
            categoryLabel: getPortfolioCategoryLabel(categoryId),
            policyCount: matching.length,
            clientCount: new Set(matching.map((policy) => policy.clientId)).size,
          };
        }),
      };
    })
    .sort((a, b) => a.providerName.localeCompare(b.providerName));
}

export type PolicyPrintDownload =
  | { status: 'ok'; url: string; document: PolicyDocument }
  | { status: 'no_policy' }
  | { status: 'no_document' }
  | { status: 'storage_error' };

/** A short-lived link to the policy print on record for one policy. */
export async function createPolicyPrintDownload(
  clientId: string,
  policyId: string,
): Promise<PolicyPrintDownload> {
  const policies = (await clientPolicies.get(clientId)) || [];
  const policy = policies.find((candidate) => candidate.id === policyId);
  if (!policy) return { status: 'no_policy' };
  if (!policy.document?.storageKey) return { status: 'no_document' };
  const url = await createPolicyDocumentSignedUrl(policy.document.storageKey);
  if (!url) return { status: 'storage_error' };
  return { status: 'ok', url, document: policy.document };
}
