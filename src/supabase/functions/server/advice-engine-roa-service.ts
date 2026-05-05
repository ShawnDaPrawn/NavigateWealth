/**
 * Advice Engine - Record of Advice foundation service.
 *
 * Phase 1 gives the existing RoA wizard a durable backend model and a single
 * client/adviser context packet. Later phases can add module-specific
 * normalisation and document compilation without changing where drafts live.
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { NotFoundError, ValidationError } from './error.middleware.ts';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'npm:docx';
import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';
import {
  downloadRoABlob,
  roaEvidenceBlobPath,
  roaGeneratedBlobPath,
  uploadRoABlob,
} from './advice-engine-roa-storage.ts';

const log = createModuleLogger('advice-engine-roa-service');

type JsonRecord = Record<string, unknown>;

export type RoADraftStatus = 'draft' | 'complete' | 'submitted' | 'archived';

export interface RoAClientSnapshot {
  clientId: string;
  displayName: string;
  personalInformation: JsonRecord;
  contactInformation: JsonRecord;
  employmentInformation: JsonRecord;
  financialInformation: JsonRecord;
  familyMembers: unknown[];
  assets: unknown[];
  liabilities: unknown[];
  riskProfile: unknown | null;
  clientKeys: JsonRecord | null;
  policies: unknown[];
  profile: JsonRecord | null;
  capturedAt: string;
}

export interface RoAAdviserSnapshot {
  adviserId: string;
  displayName: string;
  email: string;
  role: string;
  jobTitle?: string;
  fspReference?: string;
  fscaStatus?: string;
  capturedAt: string;
}

export interface RoAClientContext {
  clientSnapshot: RoAClientSnapshot;
  adviserSnapshot: RoAAdviserSnapshot;
  fnaSummaries: Record<string, { count: number; latestUpdatedAt?: string }>;
  dataQuality: {
    missing: string[];
    warnings: string[];
    completenessScore: number;
  };
  sourceMap: Record<string, string>;
}

export interface RoADraftRecord {
  id: string;
  clientId?: string;
  clientData?: unknown;
  selectedModules: string[];
  moduleData: Record<string, unknown>;
  moduleOutputs?: Record<string, unknown>;
  moduleEvidence?: Record<string, Record<string, RoAEvidenceItem>>;
  validationResults?: RoAValidationResult;
  compiledOutput?: RoACompiledOutput;
  generatedDocuments?: RoAGeneratedDocument[];
  status: RoADraftStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
  createdBy: string;
  updatedBy: string;
  adviserId: string;
  clientSnapshot?: RoAClientSnapshot;
  adviserSnapshot?: RoAAdviserSnapshot;
  contextCapturedAt?: string;
  finalisedAt?: string;
  finalisedBy?: string;
  lockedAt?: string;
  auditEvents?: RoAAuditEvent[];
}

export interface RoAEvidenceItem {
  id: string;
  requirementId: string;
  moduleId?: string;
  label: string;
  type: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  storagePath?: string;
  sha256?: string;
  source?: string;
  uploadedBy?: string;
  uploadedAt: string;
}

export interface RoAClientFileEntry {
  id: string;
  clientId: string;
  itemType: 'generated-document' | 'evidence';
  title: string;
  fileName: string;
  contentType?: string;
  fileSize?: number;
  draftId?: string;
  moduleId?: string;
  requirementId?: string;
  storagePath?: string;
  sha256?: string;
  source?: string;
  createdAt: string;
  documentStatus?: 'draft' | 'final';
  format?: 'pdf' | 'docx';
}

export interface RoAValidationIssue {
  id: string;
  moduleId?: string;
  moduleTitle?: string;
  severity: 'blocking' | 'warning';
  message: string;
  fieldKeys?: string[];
  requirementId?: string;
}

export interface RoAValidationResult {
  valid: boolean;
  blocking: RoAValidationIssue[];
  warnings: RoAValidationIssue[];
  checkedAt: string;
}

export interface RoACompiledSection {
  id: string;
  title: string;
  content: string;
}

export interface RoACompiledModule {
  moduleId: string;
  title: string;
  category: string;
  contractVersion: number;
  contractSchemaVersion?: string;
  normalizedKey?: string;
  summary: string;
  outputValues: Array<{ label: string; value: string }>;
  evidence: Array<{ id?: string; label: string; fileName: string; type: string; source?: string; sha256?: string; uploadedAt?: string }>;
  sections: RoACompiledSection[];
  disclosures: string[];
  compilerHints?: RoAModuleContract['compilerHints'];
}

export interface RoARecommendationSummary {
  moduleId: string;
  title: string;
  category: string;
  summary: string;
  outputValues: Array<{ label: string; value: string }>;
}

export interface RoACompiledOutput {
  id: string;
  draftId: string;
  version: number;
  status: 'draft' | 'final';
  generatedAt: string;
  documentControl: JsonRecord;
  client: RoAClientSnapshot | null;
  adviser: RoAAdviserSnapshot | null;
  scopeAndPurpose: string;
  synopsis: string;
  clientProfileSummary: RoACompiledSection[];
  informationReliedUpon: string[];
  needsAndObjectives: string[];
  recommendationSummary: RoARecommendationSummary[];
  modules: RoACompiledModule[];
  replacementAnalysis: RoACompiledSection[];
  feesCostsConflicts: string[];
  risksAndDisclosures: string[];
  implementationPlan: string[];
  acknowledgements: string[];
  appendices: string[];
  documentSections: RoACompiledSection[];
  html: string;
  hash?: string;
}

export interface RoAGeneratedDocument {
  id: string;
  draftId: string;
  compilationId: string;
  format: 'pdf' | 'docx';
  documentStatus: 'draft' | 'final';
  fileName: string;
  contentType: string;
  storagePath: string;
  sha256: string;
  compilationHash?: string;
  generatedAt: string;
  generatedBy: string;
  moduleContractVersions: Record<string, number>;
  lockedAt?: string;
  finalisedAt?: string;
  downloadBase64?: string;
}

export interface RoAAuditEvent {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  createdBy: string;
  details?: JsonRecord;
}

export interface RoAEvidenceUploadInput {
  moduleId: string;
  requirementId: string;
  label?: string;
  type?: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  source?: string;
  bytesBase64: string;
}

interface AuthUserLike {
  id: string;
  email?: string;
  user_metadata?: JsonRecord;
}

const DRAFT_PREFIX = 'roa:draft:';
const CLIENT_DRAFT_PREFIX = (clientId: string) => `roa:client:${clientId}:draft:`;
const ADVISER_DRAFT_PREFIX = (adviserId: string) => `roa:adviser:${adviserId}:draft:`;
const GENERATED_PREFIX = 'roa:generated:';
const EVIDENCE_PREFIX = 'roa:evidence:';
const CLIENT_DOCUMENT_PREFIX = (clientId: string) => `roa:client:${clientId}:document:`;
const CLIENT_FILE_PREFIX = (clientId: string) => `roa:client:${clientId}:file:`;
const CLIENT_DOCUMENT_REGISTER_PREFIX = (clientId: string) => `document:${clientId}:`;
const MAX_EVIDENCE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EVIDENCE_SOURCES = new Set([
  'adviser-upload',
  'client-upload',
  'provider-sync',
  'system-import',
  'email-import',
  'legacy-import',
]);

const FNA_PREFIXES: Record<string, string> = {
  risk: 'risk-planning-fna:client:',
  medical: 'medical-fna:client:',
  retirement: 'retirement-fna:client:',
  investment: 'investment-ina:client:',
  tax: 'tax-planning-fna:client:',
  estate: 'estate-planning-fna:client:',
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as JsonRecord).length > 0;
  return true;
}

function textEncode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',').pop() || '' : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Base64(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function valueToText(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Not recorded';
  if (Array.isArray(value)) return value.map(valueToText).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function valueToHumanText(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Not recorded';
  if (Array.isArray(value)) return value.length > 0 ? value.map(valueToHumanText).join(', ') : 'Not recorded';
  if (typeof value === 'object') {
    const entries = Object.entries(value as JsonRecord)
      .filter(([, entryValue]) => hasValue(entryValue))
      .map(([key, entryValue]) => `${formatLabel(key)}: ${valueToHumanText(entryValue)}`);
    return entries.length > 0 ? entries.join('; ') : 'Not recorded';
  }
  return String(value);
}

function formatLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function snakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function camelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function findDataValue(key: string, ...sources: JsonRecord[]): unknown {
  const candidates = [key, snakeCase(key), camelCase(key)];
  for (const source of sources) {
    for (const candidate of candidates) {
      if (hasValue(source[candidate])) return source[candidate];
    }
  }
  return undefined;
}

function compactList(items: Array<string | undefined | null>): string[] {
  return items
    .map((item) => readString(item))
    .filter(Boolean);
}

function formatCurrency(value: unknown): string {
  const numeric = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/[^0-9.-]+/g, ''));
  if (!Number.isFinite(numeric)) return valueToText(value);
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(numeric);
}

function formatTokenValue(value: unknown, filter?: string): string {
  if (filter === 'currency') return formatCurrency(value);
  if (filter === 'percent' || filter === 'percentage') return hasValue(value) ? `${valueToText(value)}%` : 'Not recorded';
  if (filter === 'date') {
    const date = new Date(String(value ?? ''));
    return Number.isNaN(date.getTime()) ? valueToText(value) : date.toLocaleDateString('en-ZA');
  }
  if (filter === 'yesno') return value ? 'Yes' : 'No';
  if (filter === 'json') return JSON.stringify(value ?? null, null, 2);
  return valueToText(value);
}

function resolvePath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (!part) return current;
    if (current && typeof current === 'object') {
      return (current as JsonRecord)[part];
    }
    return undefined;
  }, source);
}

function renderTemplate(template: string, context: JsonRecord): string {
  return template.replace(/{{\s*([a-zA-Z0-9_.-]+)(?:\s*\|\s*([a-zA-Z]+))?\s*}}/g, (_match, path: string, filter?: string) => {
    const value = resolvePath(context, path);
    return formatTokenValue(value, filter);
  });
}

function markdownishToHtml(content: string): string {
  return content
    .split('\n')
    .map((line) => {
      if (line.startsWith('## ')) return `<h3>${escapeHtml(line.slice(3))}</h3>`;
      if (line.trim() === '') return '<br />';
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join('\n');
}

function flattenModuleFields(contract: RoAModuleContract): string[] {
  return contract.formSchema.sections.flatMap((section) => section.fields.map((field) => field.key));
}

function normalizeMimeType(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validateEvidenceMetadata(
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

  const size = typeof evidence.size === 'number' && Number.isFinite(evidence.size) ? evidence.size : undefined;
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

function appendAuditEvent(draft: RoADraftRecord, action: string, summary: string, user: AuthUserLike, details?: JsonRecord): RoAAuditEvent[] {
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

function getLatestUpdatedAt(items: unknown[]): string | undefined {
  let latest = '';
  for (const item of items) {
    const record = asRecord(item);
    const candidate = readString(record.updatedAt, record.updated_at, record.createdAt, record.created_at);
    if (candidate && (!latest || candidate > latest)) latest = candidate;
  }
  return latest || undefined;
}

function getClientDisplayName(profile: JsonRecord): string {
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
  return [firstName, lastName].filter(Boolean).join(' ') || readString(profile.name, personal.fullName) || 'Unknown Client';
}

function buildSourceMap(): Record<string, string> {
  return {
    clientSnapshot: 'user_profile:{clientId}:personal_info',
    clientKeys: 'user_profile:{clientId}:client_keys',
    policies: 'policies:client:{clientId}',
    riskProfile: 'client:{clientId}:risk_profile',
    adviserSnapshot: 'personnel:profile:{adviserId}',
    fnaSummaries: 'fna kv prefixes by client',
  };
}

function buildDataQuality(snapshot: RoAClientSnapshot): RoAClientContext['dataQuality'] {
  const missing: string[] = [];
  const warnings: string[] = [];
  const personal = snapshot.personalInformation;
  const contact = snapshot.contactInformation;
  const employment = snapshot.employmentInformation;

  const checks: Array<[string, boolean]> = [
    ['Client name', snapshot.displayName !== 'Unknown Client'],
    ['ID or passport number', !!readString(personal.idNumber, personal.passportNumber, snapshot.profile?.idNumber)],
    ['Date of birth', !!readString(personal.dateOfBirth, snapshot.profile?.dateOfBirth)],
    ['Email address', !!readString(personal.email, contact.email, snapshot.profile?.email)],
    ['Cellphone number', !!readString(personal.cellphone, personal.phoneNumber, contact.cellphone, snapshot.profile?.phoneNumber)],
    ['Residential address', Object.keys(asRecord(contact.residentialAddress)).length > 0 || !!readString(snapshot.profile?.residentialAddressLine1)],
    ['Employment or occupation', !!readString(employment.status, employment.occupation, snapshot.profile?.employmentStatus, snapshot.profile?.occupation)],
    ['Risk profile', !!snapshot.riskProfile || !!readString(asRecord(snapshot.profile?.riskAssessment).riskCategory)],
  ];

  for (const [label, present] of checks) {
    if (!present) missing.push(label);
  }

  if (snapshot.policies.length === 0) {
    warnings.push('No active policies were found in the policy register for this client.');
  }

  if (!snapshot.clientKeys || Object.keys(snapshot.clientKeys).length === 0) {
    warnings.push('Client financial key totals have not been calculated yet.');
  }

  const completenessScore = Math.round(((checks.length - missing.length) / checks.length) * 100);
  return { missing, warnings, completenessScore };
}

function linesFromPairs(pairs: Array<[string, unknown]>): string {
  const lines = pairs
    .filter(([, value]) => hasValue(value))
    .map(([label, value]) => `${label}: ${valueToHumanText(value)}`);
  return lines.length > 0 ? lines.join('\n') : 'No information recorded in this section.';
}

function buildClientProfileSummary(client: RoAClientSnapshot | undefined): RoACompiledSection[] {
  if (!client) {
    return [{
      id: 'client_profile_summary',
      title: 'Client Profile Summary',
      content: 'No client profile snapshot is attached to this RoA.',
    }];
  }

  const personal = asRecord(client.personalInformation);
  const contact = asRecord(client.contactInformation);
  const employment = asRecord(client.employmentInformation);
  const financial = asRecord(client.financialInformation);
  const risk = asRecord(client.riskProfile);

  return [
    {
      id: 'client_personal_details',
      title: 'Personal And Contact Details',
      content: linesFromPairs([
        ['Client', client.displayName],
        ['ID or passport', readString(personal.idNumber, personal.passportNumber)],
        ['Date of birth', readString(personal.dateOfBirth)],
        ['Nationality', readString(personal.nationality)],
        ['Marital status', readString(personal.maritalStatus)],
        ['Email', readString(contact.email, personal.email)],
        ['Cellphone', readString(contact.cellphone, personal.cellphone, personal.phoneNumber)],
        ['Residential address', contact.residentialAddress],
      ]),
    },
    {
      id: 'client_family_employment',
      title: 'Family, Employment And Income',
      content: linesFromPairs([
        ['Family members or dependants', client.familyMembers.length > 0 ? `${client.familyMembers.length} recorded` : 'None recorded'],
        ['Employment status', readString(employment.employmentStatus, employment.status)],
        ['Occupation or employer', readString(employment.occupation, employment.employerName, employment.selfEmployedCompanyName)],
        ['Gross monthly income', readString(employment.grossMonthlyIncome, financial.grossIncome)],
        ['Net monthly income', readString(employment.netMonthlyIncome, financial.netIncome)],
        ['Monthly expenses', readString(financial.monthlyExpenses)],
      ]),
    },
    {
      id: 'client_financial_position',
      title: 'Financial Position Snapshot',
      content: linesFromPairs([
        ['Assets recorded', client.assets.length],
        ['Liabilities recorded', client.liabilities.length],
        ['Policies recorded', client.policies.length],
        ['Risk profile', readString(risk.riskCategory, risk.category, risk.profile, asRecord(financial.riskAssessment).riskCategory)],
        ['Goals or objectives', financial.goals],
      ]),
    },
  ];
}

function buildInformationReliedUpon(draft: RoADraftRecord, contracts: RoAModuleContract[]): string[] {
  const sources = new Set<string>();
  if (draft.clientSnapshot) sources.add(`Client profile snapshot captured ${draft.clientSnapshot.capturedAt}`);
  if (draft.adviserSnapshot) sources.add(`Adviser profile snapshot captured ${draft.adviserSnapshot.capturedAt}`);
  if (draft.clientSnapshot?.policies?.length) sources.add(`Policy register (${draft.clientSnapshot.policies.length} active policy records)`);
  if (draft.clientSnapshot?.riskProfile) sources.add('Client risk profile');
  if (draft.clientSnapshot?.clientKeys) sources.add('Client financial key totals');

  for (const contract of contracts) {
    if (!draft.selectedModules.includes(contract.id)) continue;
    for (const inputSource of contract.input.sources) {
      sources.add(`${contract.title}: ${inputSource.label}${inputSource.required ? ' (required source)' : ''}`);
    }
  }

  for (const moduleEvidence of Object.values(draft.moduleEvidence || {})) {
    for (const item of Object.values(moduleEvidence || {})) {
      sources.add(`${item.label}: ${item.fileName}`);
    }
  }

  return [...sources];
}

function buildModuleOutputValues(contract: RoAModuleContract, moduleData: JsonRecord, moduleOutput: JsonRecord): Array<{ label: string; value: string }> {
  const outputValues = asRecord(moduleOutput.values);
  const fields = contract.output.fields.length > 0
    ? contract.output.fields
    : contract.formSchema.sections.flatMap((section) => section.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: 'string' as const,
        required: Boolean(field.required),
      })));

  return fields.map((field) => ({
    label: field.label || formatLabel(field.key),
    value: valueToHumanText(findDataValue(field.key, outputValues, moduleData)),
  }));
}

function buildModuleSummary(contract: RoAModuleContract, outputValues: Array<{ label: string; value: string }>): string {
  const recordedValues = outputValues.filter((item) => item.value !== 'Not recorded').slice(0, 3);
  if (recordedValues.length === 0) {
    return `${contract.title} has been completed using the configured ${contract.output.normalizedKey} module contract.`;
  }
  return `${contract.title}: ${recordedValues.map((item) => `${item.label} - ${item.value}`).join('; ')}.`;
}

function buildNeedsAndObjectives(draft: RoADraftRecord, modules: RoACompiledModule[]): string[] {
  const clientGoals = asRecord(draft.clientSnapshot?.financialInformation).goals;
  const goals = Array.isArray(clientGoals) ? clientGoals.map(valueToHumanText) : compactList([valueToHumanText(clientGoals)]);
  return [
    ...goals.filter((goal) => goal !== 'Not recorded'),
    ...modules.map((module) => `Advice need addressed through ${module.title}.`),
  ];
}

function buildScopeAndSynopsis(draft: RoADraftRecord, modules: RoACompiledModule[]): { scopeAndPurpose: string; synopsis: string } {
  const clientName = draft.clientSnapshot?.displayName || 'the client';
  const moduleTitles = modules.map((module) => module.title).join(', ') || 'the selected advice areas';
  const scopeAndPurpose = `This Record of Advice records the basis of advice provided to ${clientName} in respect of ${moduleTitles}. It reflects the client and adviser snapshots, the information relied upon, the completed module contracts, evidence attached to the draft, and adviser-reviewed module narratives.`;
  const synopsis = `${clientName}'s current position was considered using the available profile, financial, policy and module information. The recommendation is limited to the modules included in this RoA and should be read with the attached evidence, disclosures and implementation steps.`;
  return { scopeAndPurpose, synopsis };
}

function buildReplacementAnalysis(modules: RoACompiledModule[]): RoACompiledSection[] {
  const replacementModules = modules.filter((module) => module.compilerHints?.includeReplacementAnalysis === true);
  if (replacementModules.length === 0) return [];
  return replacementModules.map((module) => ({
    id: `replacement_${module.moduleId}`,
    title: `${module.title} Replacement Analysis`,
    content: [
      `This module has been identified as replacement, comparison or transfer advice and must be reviewed with heightened care.`,
      `Evidence reviewed: ${module.evidence.length > 0 ? module.evidence.map((item) => `${item.label} (${item.fileName})`).join(', ') : 'No evidence recorded'}.`,
      `Key adviser-reviewed points: ${module.summary}`,
      'The client should understand any lost benefits, new exclusions, penalties, tax effects, waiting periods, underwriting changes, and timing risks before implementation.',
    ].join('\n'),
  }));
}

export function buildCanonicalRoACompilation(input: {
  draft: RoADraftRecord;
  contracts: RoAModuleContract[];
  status?: 'draft' | 'final';
  now?: string;
  compilationId?: string;
}): RoACompiledOutput {
  const { draft, contracts, status = 'draft' } = input;
  const now = input.now || new Date().toISOString();
  const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));

  const modules: RoACompiledModule[] = draft.selectedModules.map((moduleId) => {
    const contract = contractsById.get(moduleId);
    if (!contract) throw new ValidationError(`Module contract not found: ${moduleId}`);
    const moduleData = asRecord(draft.moduleData[moduleId]);
    const moduleEvidence = asRecord(draft.moduleEvidence?.[moduleId]) as Record<string, RoAEvidenceItem>;
    const moduleOutput = asRecord(draft.moduleOutputs?.[moduleId]);
    const outputValues = buildModuleOutputValues(contract, moduleData, moduleOutput);
    const evidence = Object.values(moduleEvidence || {}).map((item) => ({
      id: item.id,
      label: item.label,
      fileName: item.fileName,
      type: item.type,
      source: item.source,
      sha256: item.sha256,
      uploadedAt: item.uploadedAt,
    }));
    const tokenContext: JsonRecord = {
      client: draft.clientSnapshot || {},
      adviser: draft.adviserSnapshot || {},
      module: moduleData,
      output: asRecord(moduleOutput.values),
      evidence: moduleEvidence,
      draft,
    };
    const sections = contract.documentSections
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter((section) => contract.compileOrder.length === 0 || contract.compileOrder.includes(section.id))
      .map((section) => ({
        id: section.id,
        title: section.title,
        content: renderTemplate(section.template || section.purpose, tokenContext),
      }));

    return {
      moduleId,
      title: contract.title,
      category: contract.category,
      contractVersion: contract.version,
      contractSchemaVersion: contract.schemaVersion,
      normalizedKey: contract.output.normalizedKey,
      compilerHints: contract.compilerHints,
      summary: buildModuleSummary(contract, outputValues),
      outputValues,
      evidence,
      sections,
      disclosures: contract.disclosures,
    };
  });

  const { scopeAndPurpose, synopsis } = buildScopeAndSynopsis(draft, modules);
  const clientProfileSummary = buildClientProfileSummary(draft.clientSnapshot);
  const informationReliedUpon = buildInformationReliedUpon(draft, contracts);
  const needsAndObjectives = buildNeedsAndObjectives(draft, modules);
  const recommendationSummary = modules.map((module) => ({
    moduleId: module.moduleId,
    title: module.title,
    category: module.category,
    summary: module.summary,
    outputValues: module.outputValues,
  }));
  const replacementAnalysis = buildReplacementAnalysis(modules);
  const feesCostsConflicts = [
    'All fees, premiums, costs, commissions, platform charges and adviser remuneration disclosed in the relevant module sections and supporting evidence must be checked before finalisation.',
    'The adviser must disclose any actual or potential conflict of interest that could influence the recommendation.',
  ];
  const risksAndDisclosures = Array.from(new Set([
    'Recommendations are based on the information available and recorded at the time of advice.',
    'Missing or inaccurate client information may affect the suitability of the advice.',
    ...modules.flatMap((module) => module.disclosures),
  ]));
  const implementationPlan = [
    'Confirm that the client understands the recommendation, risks, costs and alternatives.',
    'Complete provider and compliance documentation required for the selected recommendation.',
    'Do not cancel or replace existing products until replacement cover, transfer or investment instructions are accepted and implementation timing is confirmed.',
    'Schedule the next review after implementation or when the client circumstances change.',
  ];
  const acknowledgements = [
    'The client confirms receipt and understanding of this Record of Advice and the recommendations contained herein.',
    'The client confirms that the information supplied for the purpose of this advice is true and complete to the best of their knowledge.',
    'The adviser confirms this document records the basis of advice, the material information relied upon, and the reasons for the recommendation.',
  ];
  const appendices = [
    ...modules.flatMap((module) => module.evidence.map((item) => `${module.title}: ${item.label} - ${item.fileName}`)),
  ];
  const documentSections: RoACompiledSection[] = [
    { id: 'document_control', title: 'Document Control', content: linesFromPairs([
      ['Draft ID', draft.id],
      ['Status', status],
      ['Version', draft.version],
      ['Generated at', now],
      ['Client', draft.clientSnapshot?.displayName],
      ['Adviser', draft.adviserSnapshot?.displayName],
    ]) },
    { id: 'adviser_details', title: 'Adviser And FSP Details', content: linesFromPairs([
      ['Adviser', draft.adviserSnapshot?.displayName],
      ['Email', draft.adviserSnapshot?.email],
      ['Role', draft.adviserSnapshot?.role],
      ['Job title', draft.adviserSnapshot?.jobTitle],
      ['FSP reference', draft.adviserSnapshot?.fspReference],
      ['FSCA status', draft.adviserSnapshot?.fscaStatus],
    ]) },
    ...clientProfileSummary,
    { id: 'scope_and_purpose', title: 'Scope And Purpose Of Advice', content: scopeAndPurpose },
    { id: 'information_relied_upon', title: 'Information Relied Upon', content: informationReliedUpon.map((item) => `- ${item}`).join('\n') },
    { id: 'synopsis', title: 'Synopsis Of Current Position', content: synopsis },
    { id: 'needs_and_objectives', title: 'Needs And Objectives', content: needsAndObjectives.map((item) => `- ${item}`).join('\n') || 'No specific objectives were recorded beyond the selected RoA modules.' },
    { id: 'recommendation_summary', title: 'Recommendation Summary', content: recommendationSummary.map((item) => `${item.title}: ${item.summary}`).join('\n') },
    ...replacementAnalysis,
    { id: 'fees_costs_conflicts', title: 'Fees, Costs, Commission And Conflicts', content: feesCostsConflicts.map((item) => `- ${item}`).join('\n') },
    { id: 'risks_disclosures', title: 'Risks And Important Disclosures', content: risksAndDisclosures.map((item) => `- ${item}`).join('\n') },
    { id: 'implementation_plan', title: 'Implementation Plan', content: implementationPlan.map((item) => `- ${item}`).join('\n') },
    { id: 'client_acknowledgement', title: 'Client Acknowledgement', content: acknowledgements.map((item) => `- ${item}`).join('\n') },
    { id: 'appendices', title: 'Appendices And Evidence', content: appendices.length > 0 ? appendices.map((item) => `- ${item}`).join('\n') : 'No evidence appendices were recorded.' },
  ];

  const compilation: RoACompiledOutput = {
    id: input.compilationId || crypto.randomUUID(),
    draftId: draft.id,
    version: draft.version,
    status,
    generatedAt: now,
    documentControl: {
      draftId: draft.id,
      status,
      version: draft.version,
      moduleContractVersions: Object.fromEntries(modules.map((module) => [module.moduleId, module.contractVersion])),
      moduleContractSchemaVersions: Object.fromEntries(
        modules.map((module) => [module.moduleId, module.contractSchemaVersion ?? '']),
      ),
      canonicalSectionIds: documentSections.map((section) => section.id),
    },
    client: draft.clientSnapshot || null,
    adviser: draft.adviserSnapshot || null,
    scopeAndPurpose,
    synopsis,
    clientProfileSummary,
    informationReliedUpon,
    needsAndObjectives,
    recommendationSummary,
    modules,
    replacementAnalysis,
    feesCostsConflicts,
    risksAndDisclosures,
    implementationPlan,
    acknowledgements,
    appendices,
    documentSections,
    html: '',
  };
  compilation.html = createDocumentHtml(compilation);
  return compilation;
}

function createDocumentHtml(compilation: RoACompiledOutput): string {
  const staticSectionHtml = compilation.documentSections.map((section, index) => `
    <section class="roa-section">
      <div class="section-head">
        <span class="num">${String(index + 1).padStart(2, '0')}</span>
        <h2>${escapeHtml(section.title)}</h2>
      </div>
      <div class="text-block">${markdownishToHtml(section.content)}</div>
    </section>
  `).join('');

  const recommendationRows = compilation.recommendationSummary.map((item) => `
    <tr>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.summary)}</td>
    </tr>
  `).join('');

  const moduleHtml = compilation.modules.map((module) => `
    <section class="roa-section module">
      <div class="section-head">
        <span class="num">M</span>
        <h2>${escapeHtml(module.title)}</h2>
      </div>
      <p class="muted">Category: ${escapeHtml(module.category)} | Contract v${module.contractVersion} | Output: ${escapeHtml(module.normalizedKey || module.moduleId)}</p>
      ${module.outputValues.length > 0 ? `
        <table>
          <thead><tr><th>Output Field</th><th>Value</th></tr></thead>
          <tbody>${module.outputValues.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.value)}</td></tr>`).join('')}</tbody>
        </table>
      ` : ''}
      ${module.sections.map((section) => `
        <article>
          <h3>${escapeHtml(section.title)}</h3>
          <div class="text-block">${markdownishToHtml(section.content)}</div>
        </article>
      `).join('')}
      ${module.disclosures.length > 0 ? `
        <h3>Module Disclosures</h3>
        <ul>${module.disclosures.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      ` : ''}
    </section>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Record of Advice - ${escapeHtml(compilation.client?.displayName || 'Client')}</title>
  <style>
    :root {
      --nw-purple: #6d28d9;
      --ink: #111827;
      --muted: #6b7280;
      --border: #e5e7eb;
      --soft: #f9fafb;
    }
    @page { size: A4; margin: 14mm 12mm 18mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, "Segoe UI", Arial, sans-serif; color: var(--ink); line-height: 1.48; margin: 0; background: #ffffff; }
    .pdf-preview-container { max-width: 190mm; margin: 0 auto; }
    .top-masthead { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 22px; }
    .masthead-left { font-size: 11px; font-weight: 800; color: #374151; text-transform: uppercase; letter-spacing: 0.2px; }
    .masthead-right { font-size: 10px; color: var(--muted); text-align: right; }
    .cover { margin-bottom: 24px; }
    .doc-title { font-size: 26px; font-weight: 800; color: #312f55; margin: 0 0 6px; }
    .brand-subline { color: var(--muted); font-size: 12px; margin: 0; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
    .meta-cell { border: 1px solid var(--border); background: var(--soft); padding: 8px; border-radius: 6px; }
    .meta-k { display: block; font-size: 9px; color: var(--muted); text-transform: uppercase; }
    .meta-v { display: block; font-size: 11px; font-weight: 700; margin-top: 2px; }
    .roa-section { break-inside: avoid; margin: 18px 0; }
    .section-head { display: flex; gap: 8px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 5px; margin-bottom: 8px; }
    .section-head .num { color: var(--nw-purple); font-size: 11px; font-weight: 800; }
    h2 { color: #312f55; font-size: 13px; line-height: 1.2; margin: 0; text-transform: uppercase; }
    h3 { color: #374151; font-size: 11px; margin: 12px 0 5px; }
    p, li { font-size: 10.5px; margin: 0 0 5px; }
    ul { margin: 6px 0 0 18px; padding: 0; }
    .muted { color: var(--muted); }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10px; }
    th, td { border: 1px solid var(--border); padding: 6px; text-align: left; vertical-align: top; }
    th { background: var(--soft); color: #374151; font-weight: 700; }
    .pdf-footer { border-top: 1px solid var(--border); margin-top: 28px; padding-top: 10px; font-size: 9px; color: var(--muted); }
  </style>
</head>
<body>
  <div class="pdf-preview-container">
    <header class="top-masthead">
      <div class="masthead-left">Navigate Wealth | Record of Advice</div>
      <div class="masthead-right">Generated ${escapeHtml(compilation.generatedAt)}<br />Version ${compilation.version} | ${escapeHtml(compilation.status)}</div>
    </header>
    <section class="cover">
      <h1 class="doc-title">Record of Advice</h1>
      <p class="brand-subline">${escapeHtml(compilation.scopeAndPurpose)}</p>
      <div class="meta-grid">
        <div class="meta-cell"><span class="meta-k">Client</span><span class="meta-v">${escapeHtml(compilation.client?.displayName || 'Unknown Client')}</span></div>
        <div class="meta-cell"><span class="meta-k">Adviser</span><span class="meta-v">${escapeHtml(compilation.adviser?.displayName || 'Unknown Adviser')}</span></div>
        <div class="meta-cell"><span class="meta-k">Modules</span><span class="meta-v">${compilation.modules.length}</span></div>
      </div>
    </section>
    ${staticSectionHtml}
    <section class="roa-section">
      <div class="section-head"><span class="num">R</span><h2>Recommendation Summary Table</h2></div>
      <table>
        <thead><tr><th>Module</th><th>Category</th><th>Summary</th></tr></thead>
        <tbody>${recommendationRows}</tbody>
      </table>
    </section>
    ${moduleHtml}
    <footer class="pdf-footer">This document was compiled from the canonical RoA JSON/HTML source and the active module contract versions recorded in document control.</footer>
  </div>
</body>
</html>`;
}

export async function createCanonicalRoAPdf(compilation: RoACompiledOutput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let page = pdfDoc.addPage([595, 842]);
  let pageNumber = 1;
  let y = 772;

  const drawShell = () => {
    page.drawText('NAVIGATE WEALTH | RECORD OF ADVICE', {
      x: 48,
      y: 806,
      size: 8,
      font: boldFont,
      color: rgb(0.23, 0.25, 0.32),
    });
    page.drawText(`Version ${compilation.version} | ${compilation.status}`, {
      x: 430,
      y: 806,
      size: 8,
      font: regularFont,
      color: rgb(0.42, 0.45, 0.5),
    });
    page.drawLine({
      start: { x: 48, y: 794 },
      end: { x: 547, y: 794 },
      thickness: 0.6,
      color: rgb(0.9, 0.9, 0.92),
    });
    page.drawLine({
      start: { x: 48, y: 42 },
      end: { x: 547, y: 42 },
      thickness: 0.6,
      color: rgb(0.9, 0.9, 0.92),
    });
    page.drawText(`Page ${pageNumber}`, {
      x: 48,
      y: 28,
      size: 8,
      font: boldFont,
      color: rgb(0.42, 0.45, 0.5),
    });
    page.drawText('Compiled from the canonical RoA source and active module contracts.', {
      x: 100,
      y: 28,
      size: 8,
      font: regularFont,
      color: rgb(0.42, 0.45, 0.5),
    });
  };

  drawShell();

  const drawLine = (text: string, options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const size = options.size || 10;
    const font = options.bold ? boldFont : regularFont;
    const maxChars = Math.max(40, Math.floor(92 * (10 / size)));
    const words = text.split(/\s+/);
    let line = '';
    const flush = () => {
      if (!line) return;
      if (y < 56) {
        page = pdfDoc.addPage([595, 842]);
        pageNumber += 1;
        y = 772;
        drawShell();
      }
      page.drawText(line, { x: 48, y, size, font, color: options.color || rgb(0.1, 0.1, 0.1) });
      y -= size + 6;
      line = '';
    };
    for (const word of words) {
      if ((line + ' ' + word).trim().length > maxChars) flush();
      line = `${line} ${word}`.trim();
    }
    flush();
  };

  const drawSection = (section: RoACompiledSection) => {
    y -= 8;
    drawLine(section.title, { bold: true, size: 13, color: rgb(0.19, 0.18, 0.33) });
    section.content.split('\n').forEach((line) => drawLine(line.replace(/^[-#]\s*/, '')));
  };

  drawLine('Record of Advice', { bold: true, size: 20, color: rgb(0.19, 0.18, 0.33) });
  drawLine(`Client: ${compilation.client?.displayName || 'Unknown Client'}`);
  drawLine(`Adviser: ${compilation.adviser?.displayName || 'Unknown Adviser'}`);
  drawLine(`Version: ${compilation.version} | Generated: ${compilation.generatedAt}`);
  drawLine(compilation.scopeAndPurpose);

  compilation.documentSections.forEach(drawSection);

  for (const module of compilation.modules) {
    y -= 10;
    drawLine(module.title, { bold: true, size: 14, color: rgb(0.19, 0.18, 0.33) });
    drawLine(module.summary);
    module.outputValues.forEach((item) => drawLine(`${item.label}: ${item.value}`));
    for (const section of module.sections) {
      drawLine(section.title, { bold: true, size: 12 });
      section.content.split('\n').forEach((line) => drawLine(line.replace(/^##\s*/, '')));
    }
    if (module.disclosures.length > 0) {
      drawLine('Disclosures', { bold: true, size: 12 });
      module.disclosures.forEach((item) => drawLine(`- ${item}`));
    }
  }

  return await pdfDoc.save();
}

export async function createCanonicalRoADocx(compilation: RoACompiledOutput): Promise<Uint8Array> {
  const children: Paragraph[] = [
    new Paragraph({ text: 'Record of Advice', heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun(`Client: ${compilation.client?.displayName || 'Unknown Client'}`)] }),
    new Paragraph({ children: [new TextRun(`Adviser: ${compilation.adviser?.displayName || 'Unknown Adviser'}`)] }),
    new Paragraph({ children: [new TextRun(`Version: ${compilation.version}`)] }),
    new Paragraph({ text: compilation.scopeAndPurpose }),
  ];

  for (const section of compilation.documentSections) {
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }));
    section.content.split('\n').filter(Boolean).forEach((line) => {
      const cleaned = line.replace(/^[-#]\s*/, '');
      children.push(new Paragraph({ text: cleaned }));
    });
  }

  for (const module of compilation.modules) {
    children.push(new Paragraph({ text: module.title, heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph({ text: module.summary }));
    module.outputValues.forEach((item) => {
      children.push(new Paragraph({ text: `${item.label}: ${item.value}` }));
    });
    for (const section of module.sections) {
      children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2 }));
      section.content.split('\n').filter(Boolean).forEach((line) => {
        children.push(new Paragraph({ text: line.replace(/^##\s*/, '') }));
      });
    }
    if (module.disclosures.length > 0) {
      children.push(new Paragraph({ text: 'Disclosures', heading: HeadingLevel.HEADING_2 }));
      module.disclosures.forEach((item) => children.push(new Paragraph({ text: item, bullet: { level: 0 } })));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class AdviceEngineRoAService {
  private async publishClientDocumentRegisterEntry(
    clientId: string | undefined,
    entry: RoAClientFileEntry,
    user: AuthUserLike,
  ): Promise<void> {
    if (!clientId) return;

    await kv.set(`${CLIENT_DOCUMENT_REGISTER_PREFIX(clientId)}${entry.id}`, {
      id: entry.id,
      userId: clientId,
      type: 'document',
      title: entry.title,
      uploadDate: entry.createdAt,
      productCategory: 'General',
      policyNumber: 'Record of Advice',
      status: 'new',
      isFavourite: false,
      uploadedBy: user.id,
      fileName: entry.fileName,
      fileSize: entry.fileSize,
      filePath: entry.storagePath,
      sourceSystem: 'record-of-advice',
      downloadMode: entry.itemType === 'generated-document' ? 'roa-generated' : 'roa-evidence',
      roaDraftId: entry.draftId,
      roaModuleId: entry.moduleId,
      roaRequirementId: entry.requirementId,
      roaDocumentId: entry.itemType === 'generated-document' ? entry.id : undefined,
      roaEvidenceId: entry.itemType === 'evidence' ? entry.id : undefined,
      roaDocumentStatus: entry.documentStatus,
      roaFormat: entry.format,
      contentType: entry.contentType,
      sha256: entry.sha256,
      source: entry.source,
    });
  }

  private async createDocumentArtifacts(
    compiledDraft: RoADraftRecord,
    formats: Array<'pdf' | 'docx'>,
    user: AuthUserLike,
    documentStatus: 'draft' | 'final',
    now = new Date().toISOString(),
  ): Promise<RoAGeneratedDocument[]> {
    if (!compiledDraft.compiledOutput) throw new ValidationError('RoA compilation failed');

    const clientName = (compiledDraft.clientSnapshot?.displayName || 'Client')
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '');
    const statusSuffix = documentStatus === 'final' ? '_FINAL' : '_DRAFT';
    const moduleContractVersions = asRecord(
      compiledDraft.compiledOutput.documentControl.moduleContractVersions,
    ) as Record<string, number>;
    const generatedDocuments: RoAGeneratedDocument[] = [];

    for (const format of formats) {
      const bytes = format === 'pdf'
        ? await createCanonicalRoAPdf(compiledDraft.compiledOutput)
        : await createCanonicalRoADocx(compiledDraft.compiledOutput);
      const sha256 = await sha256Base64(bytes);
      const id = crypto.randomUUID();
      const fileName = `RoA_${clientName}_${now.slice(0, 10)}_v${compiledDraft.version}${statusSuffix}.${format}`;
      const storagePath = `${GENERATED_PREFIX}${id}`;
      const document: RoAGeneratedDocument = {
        id,
        draftId: compiledDraft.id,
        compilationId: compiledDraft.compiledOutput.id,
        format,
        documentStatus,
        fileName,
        contentType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        storagePath,
        sha256,
        compilationHash: compiledDraft.compiledOutput.hash,
        generatedAt: now,
        generatedBy: user.id,
        moduleContractVersions,
        lockedAt: documentStatus === 'final' ? now : undefined,
        finalisedAt: documentStatus === 'final' ? now : undefined,
        downloadBase64: bytesToBase64(bytes),
      };

      let persisted: Record<string, unknown> = {
        ...document,
        bytesBase64: document.downloadBase64,
      };

      try {
        const objectPath = roaGeneratedBlobPath(compiledDraft.clientId, compiledDraft.id, id, format);
        await uploadRoABlob(objectPath, bytes, document.contentType);
        persisted = {
          ...document,
          blobStoragePath: objectPath,
        };
      } catch (error) {
        log.warn('RoA generated artefact storage upload failed — KV byte fallback', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await kv.set(storagePath, persisted);

      if (compiledDraft.clientId) {
        const clientFile: RoAClientFileEntry = {
          id,
          clientId: compiledDraft.clientId,
          itemType: 'generated-document',
          title: `${documentStatus === 'final' ? 'Final' : 'Draft'} Record of Advice (${format.toUpperCase()})`,
          fileName,
          contentType: document.contentType,
          fileSize: bytes.byteLength,
          draftId: compiledDraft.id,
          storagePath,
          sha256,
          createdAt: now,
          documentStatus,
          format,
        };

        await kv.set(`${CLIENT_DOCUMENT_PREFIX(compiledDraft.clientId)}${id}`, {
          ...clientFile,
          documentId: id,
          draftId: compiledDraft.id,
          compilationId: compiledDraft.compiledOutput.id,
          compilationHash: compiledDraft.compiledOutput.hash,
          generatedAt: now,
          lockedAt: document.lockedAt,
          finalisedAt: document.finalisedAt,
        });
        await kv.set(`${CLIENT_FILE_PREFIX(compiledDraft.clientId)}${id}`, clientFile);
        await this.publishClientDocumentRegisterEntry(compiledDraft.clientId, clientFile, user);
      }

      generatedDocuments.push(document);
    }

    return generatedDocuments;
  }

  async buildAdviserSnapshot(user: AuthUserLike): Promise<RoAAdviserSnapshot> {
    const personnel = asRecord(await kv.get(`personnel:profile:${user.id}`));
    const metadata = asRecord(user.user_metadata);
    const firstName = readString(personnel.firstName, metadata.firstName);
    const lastName = readString(personnel.lastName, metadata.lastName, metadata.surname);
    const email = readString(personnel.email, user.email);
    const role = readString(personnel.role, metadata.role, 'adviser');

    return {
      adviserId: user.id,
      displayName: [firstName, lastName].filter(Boolean).join(' ') || email || 'Unknown Adviser',
      email,
      role,
      jobTitle: readString(personnel.jobTitle) || undefined,
      fspReference: readString(personnel.fspReference) || undefined,
      fscaStatus: readString(personnel.fscaStatus) || undefined,
      capturedAt: new Date().toISOString(),
    };
  }

  async buildClientContext(clientId: string, adviserUser: AuthUserLike): Promise<RoAClientContext> {
    if (!clientId) throw new ValidationError('clientId is required');

    const [
      profileRaw,
      clientKeysRaw,
      policiesRaw,
      riskProfileRaw,
      adviserSnapshot,
      ...fnaGroups
    ] = await Promise.all([
      kv.get(`user_profile:${clientId}:personal_info`),
      kv.get(`user_profile:${clientId}:client_keys`),
      kv.get(`policies:client:${clientId}`),
      kv.get(`client:${clientId}:risk_profile`),
      this.buildAdviserSnapshot(adviserUser),
      ...Object.values(FNA_PREFIXES).map((prefix) => kv.getByPrefix(`${prefix}${clientId}:`)),
    ]);

    const profile = asRecord(profileRaw);
    if (!profileRaw) {
      throw new NotFoundError('Client profile not found');
    }

    const personalInformation = {
      ...asRecord(profile.personalInformation),
      ...Object.fromEntries(
        [
          'title',
          'firstName',
          'middleName',
          'lastName',
          'dateOfBirth',
          'gender',
          'nationality',
          'idNumber',
          'passportNumber',
          'taxNumber',
          'maritalStatus',
          'maritalRegime',
        ]
          .filter((key) => profile[key] !== undefined)
          .map((key) => [key, profile[key]]),
      ),
    };

    const contactInformation = {
      ...asRecord(profile.contactInformation),
      email: readString(asRecord(profile.personalInformation).email, profile.email) || undefined,
      cellphone: readString(asRecord(profile.personalInformation).cellphone, profile.phoneNumber, profile.phone) || undefined,
      secondaryEmail: readString(profile.secondaryEmail) || undefined,
      residentialAddress: asRecord(profile.contactInformation).residentialAddress || {
        line1: profile.residentialAddressLine1,
        line2: profile.residentialAddressLine2,
        suburb: profile.residentialSuburb,
        city: profile.residentialCity,
        province: profile.residentialProvince,
        postalCode: profile.residentialPostalCode,
        country: profile.residentialCountry,
      },
    };

    const employmentInformation = {
      ...asRecord(profile.employmentInformation),
      employmentStatus: profile.employmentStatus,
      grossMonthlyIncome: profile.grossMonthlyIncome,
      grossAnnualIncome: profile.grossAnnualIncome,
      netMonthlyIncome: profile.netMonthlyIncome,
      employers: profile.employers,
      selfEmployedCompanyName: profile.selfEmployedCompanyName,
      selfEmployedIndustry: profile.selfEmployedIndustry,
    };

    const financialInformation = {
      ...asRecord(profile.financialInformation),
      grossIncome: profile.grossIncome,
      netIncome: profile.netIncome,
      monthlyExpenses: profile.monthlyExpenses,
      goals: profile.goals,
      riskAssessment: profile.riskAssessment,
    };

    const fnaSummaries = Object.fromEntries(
      Object.keys(FNA_PREFIXES).map((type, index) => {
        const items = asArray(fnaGroups[index]);
        return [type, { count: items.length, latestUpdatedAt: getLatestUpdatedAt(items) }];
      }),
    );

    const clientSnapshot: RoAClientSnapshot = {
      clientId,
      displayName: getClientDisplayName(profile),
      personalInformation,
      contactInformation,
      employmentInformation,
      financialInformation,
      familyMembers: asArray(profile.familyMembers),
      assets: asArray(profile.assets),
      liabilities: asArray(profile.liabilities),
      riskProfile: riskProfileRaw || profile.riskAssessment || null,
      clientKeys: clientKeysRaw ? asRecord(clientKeysRaw) : null,
      policies: asArray(policiesRaw).filter((policy) => !asRecord(policy).archived),
      profile,
      capturedAt: new Date().toISOString(),
    };

    return {
      clientSnapshot,
      adviserSnapshot,
      fnaSummaries,
      dataQuality: buildDataQuality(clientSnapshot),
      sourceMap: buildSourceMap(),
    };
  }

  async getDraft(draftId: string): Promise<RoADraftRecord> {
    const draft = await kv.get(`${DRAFT_PREFIX}${draftId}`);
    if (!draft) throw new NotFoundError('RoA draft not found');
    return draft as RoADraftRecord;
  }

  async listDrafts(filters: { status?: string; clientId?: string; adviserId?: string }): Promise<RoADraftRecord[]> {
    const drafts = (await kv.getByPrefix(DRAFT_PREFIX)) as RoADraftRecord[];
    return drafts
      .filter((draft) => !filters.status || draft.status === filters.status)
      .filter((draft) => !filters.clientId || draft.clientId === filters.clientId)
      .filter((draft) => !filters.adviserId || draft.adviserId === filters.adviserId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveDraft(input: Partial<RoADraftRecord>, user: AuthUserLike): Promise<RoADraftRecord> {
    const now = new Date().toISOString();
    const existing = input.id ? await kv.get(`${DRAFT_PREFIX}${input.id}`) as RoADraftRecord | null : null;
    if (existing?.lockedAt) {
      throw new ValidationError('Finalised RoA records are locked. Create a new version instead.');
    }
    const draftId = existing?.id || input.id || crypto.randomUUID();
    const selectedModules = Array.isArray(input.selectedModules)
      ? input.selectedModules
      : existing?.selectedModules || [];
    const moduleData = asRecord(input.moduleData || existing?.moduleData);
    const previousModules = existing?.selectedModules || [];
    const adviserSnapshot = await this.buildAdviserSnapshot(user);

    let clientSnapshot = input.clientSnapshot || existing?.clientSnapshot;
    let contextCapturedAt = existing?.contextCapturedAt;

    if (input.clientId && (!existing || existing.clientId !== input.clientId || !clientSnapshot)) {
      const context = await this.buildClientContext(input.clientId, user);
      clientSnapshot = context.clientSnapshot;
      contextCapturedAt = context.clientSnapshot.capturedAt;
    }

    const draft: RoADraftRecord = {
      id: draftId,
      clientId: input.clientId ?? existing?.clientId,
      clientData: input.clientData ?? existing?.clientData,
      selectedModules,
      moduleData,
      moduleOutputs: input.moduleOutputs || existing?.moduleOutputs,
      moduleEvidence: input.moduleEvidence || existing?.moduleEvidence,
      validationResults: input.validationResults || existing?.validationResults,
      compiledOutput: input.compiledOutput || existing?.compiledOutput,
      generatedDocuments: input.generatedDocuments || existing?.generatedDocuments,
      status: (input.status || existing?.status || 'draft') as RoADraftStatus,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      version: readNumber(input.version, existing?.version || 1),
      createdBy: existing?.createdBy || user.id,
      updatedBy: user.id,
      adviserId: existing?.adviserId || user.id,
      clientSnapshot,
      adviserSnapshot,
      contextCapturedAt,
      finalisedAt: input.finalisedAt || existing?.finalisedAt,
      finalisedBy: input.finalisedBy || existing?.finalisedBy,
      lockedAt: input.lockedAt || existing?.lockedAt,
      auditEvents: existing?.auditEvents || [],
    };

    const addedModules = selectedModules.filter((moduleId) => !previousModules.includes(moduleId));
    const removedModules = previousModules.filter((moduleId) => !selectedModules.includes(moduleId));
    if (existing?.clientId !== draft.clientId && draft.clientId) {
      draft.auditEvents = appendAuditEvent(draft, 'client_selected', 'Client selected for RoA draft', user, { clientId: draft.clientId });
    }
    if (contextCapturedAt && contextCapturedAt !== existing?.contextCapturedAt) {
      draft.auditEvents = appendAuditEvent(draft, 'snapshot_refreshed', 'Client/adviser snapshot refreshed', user, { contextCapturedAt });
    }
    if (addedModules.length > 0 || removedModules.length > 0) {
      draft.auditEvents = appendAuditEvent(draft, 'modules_updated', 'RoA module selection updated', user, { addedModules, removedModules });
    }

    await kv.set(`${DRAFT_PREFIX}${draft.id}`, draft);

    if (draft.clientId) {
      await kv.set(`${CLIENT_DRAFT_PREFIX(draft.clientId)}${draft.id}`, {
        draftId: draft.id,
        updatedAt: draft.updatedAt,
        status: draft.status,
      });
    }

    await kv.set(`${ADVISER_DRAFT_PREFIX(draft.adviserId)}${draft.id}`, {
      draftId: draft.id,
      clientId: draft.clientId,
      updatedAt: draft.updatedAt,
      status: draft.status,
    });

    log.info('Saved RoA draft', {
      draftId: draft.id,
      clientId: draft.clientId,
      adviserId: draft.adviserId,
      status: draft.status,
    });

    return draft;
  }

  async cloneDraftFromFinal(sourceDraftId: string, user: AuthUserLike): Promise<RoADraftRecord> {
    const source = await this.getDraft(sourceDraftId);
    if (!source.lockedAt || !source.finalisedAt) {
      throw new ValidationError('Only finalised RoA drafts can be branched into a new editable version.');
    }

    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const baseVersion = typeof source.version === 'number' && Number.isFinite(source.version) ? source.version : 1;
    const adviserSnapshot = await this.buildAdviserSnapshot(user);

    const newDraft: RoADraftRecord = {
      id: newId,
      clientId: source.clientId,
      clientData: source.clientData ? cloneJson(source.clientData) : undefined,
      selectedModules: [...source.selectedModules],
      moduleData: cloneJson(source.moduleData || {}),
      moduleOutputs: source.moduleOutputs ? cloneJson(source.moduleOutputs) : undefined,
      moduleEvidence: source.moduleEvidence ? cloneJson(source.moduleEvidence) : undefined,
      validationResults: undefined,
      compiledOutput: undefined,
      generatedDocuments: undefined,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      version: baseVersion + 1,
      createdBy: user.id,
      updatedBy: user.id,
      adviserId: source.adviserId,
      clientSnapshot: source.clientSnapshot ? cloneJson(source.clientSnapshot) : undefined,
      adviserSnapshot,
      contextCapturedAt: source.contextCapturedAt,
      finalisedAt: undefined,
      finalisedBy: undefined,
      lockedAt: undefined,
      auditEvents: appendAuditEvent(
        { ...source, id: newId, auditEvents: [] },
        'draft_branched_from_final',
        'New editable RoA version created from a finalised record',
        user,
        { sourceDraftId: source.id, sourceVersion: source.version },
      ),
    };

    await kv.set(`${DRAFT_PREFIX}${newDraft.id}`, newDraft);

    if (newDraft.clientId) {
      await kv.set(`${CLIENT_DRAFT_PREFIX(newDraft.clientId)}${newDraft.id}`, {
        draftId: newDraft.id,
        updatedAt: newDraft.updatedAt,
        status: newDraft.status,
      });
    }

    await kv.set(`${ADVISER_DRAFT_PREFIX(newDraft.adviserId)}${newDraft.id}`, {
      draftId: newDraft.id,
      clientId: newDraft.clientId,
      updatedAt: newDraft.updatedAt,
      status: newDraft.status,
    });

    log.info('Branched RoA draft from finalised record', {
      sourceDraftId: source.id,
      newDraftId: newDraft.id,
      adviserId: newDraft.adviserId,
    });

    return newDraft;
  }

  validateDraftWithContracts(draft: RoADraftRecord, contracts: RoAModuleContract[]): RoAValidationResult {
    const checkedAt = new Date().toISOString();
    const blocking: RoAValidationIssue[] = [];
    const warnings: RoAValidationIssue[] = [];
    const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));

    if (!draft.clientId && !draft.clientData) {
      blocking.push({
        id: 'client_required',
        severity: 'blocking',
        message: 'A client must be selected before this RoA can be compiled.',
      });
    }

    for (const moduleId of draft.selectedModules) {
      const contract = contractsById.get(moduleId);
      if (!contract) {
        blocking.push({
          id: `contract_missing:${moduleId}`,
          moduleId,
          severity: 'blocking',
          message: `The module contract for ${moduleId} is not available or not active.`,
        });
        continue;
      }

      const moduleData = asRecord(draft.moduleData[moduleId]);
      const evidence = asRecord(draft.moduleEvidence?.[moduleId]);
      const requiredFields = contract.validation.requiredFields.length > 0
        ? contract.validation.requiredFields
        : flattenModuleFields(contract);

      for (const fieldKey of requiredFields) {
        if (!hasValue(moduleData[fieldKey])) {
          blocking.push({
            id: `${moduleId}:field:${fieldKey}`,
            moduleId,
            moduleTitle: contract.title,
            severity: 'blocking',
            message: `${contract.title}: ${fieldKey.replace(/_/g, ' ')} is required.`,
            fieldKeys: [fieldKey],
          });
        }
      }

      for (const requirement of contract.evidence.requirements) {
        if (requirement.required && !hasValue(evidence[requirement.id])) {
          blocking.push({
            id: `${moduleId}:evidence:${requirement.id}`,
            moduleId,
            moduleTitle: contract.title,
            severity: 'blocking',
            requirementId: requirement.id,
            message: `${contract.title}: ${requirement.label} evidence is required.`,
          });
          continue;
        }

        if (hasValue(evidence[requirement.id])) {
          const metadataResult = validateEvidenceMetadata(contract, requirement, evidence[requirement.id]);
          blocking.push(...metadataResult.blocking);
          warnings.push(...metadataResult.warnings);
        }
      }

      for (const rule of contract.validation.rules) {
        const targetedFields = rule.fieldKeys || [];
        const targetMissing = targetedFields.length > 0 && targetedFields.some((fieldKey) => !hasValue(moduleData[fieldKey]));
        if (targetedFields.length === 0 && rule.severity === 'warning') {
          warnings.push({
            id: `${moduleId}:rule:${rule.id}`,
            moduleId,
            moduleTitle: contract.title,
            severity: 'warning',
            message: rule.message,
          });
          continue;
        }
        if (targetMissing) {
          const issue: RoAValidationIssue = {
            id: `${moduleId}:rule:${rule.id}`,
            moduleId,
            moduleTitle: contract.title,
            severity: rule.severity,
            message: rule.message,
            fieldKeys: targetedFields,
          };
          if (rule.severity === 'blocking') blocking.push(issue);
          else warnings.push(issue);
        }
      }
    }

    return { valid: blocking.length === 0, blocking, warnings, checkedAt };
  }

  async validateDraft(draftId: string, contracts: RoAModuleContract[], user: AuthUserLike): Promise<RoADraftRecord> {
    const draft = await this.getDraft(draftId);
    const validationResults = this.validateDraftWithContracts(draft, contracts);
    const updated: RoADraftRecord = {
      ...draft,
      validationResults,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
      auditEvents: appendAuditEvent(draft, 'validation_run', validationResults.valid ? 'RoA validation passed' : 'RoA validation found blockers', user, {
        blocking: validationResults.blocking.length,
        warnings: validationResults.warnings.length,
      }),
    };
    await kv.set(`${DRAFT_PREFIX}${draft.id}`, updated);
    return updated;
  }

  async uploadEvidence(
    draftId: string,
    input: RoAEvidenceUploadInput,
    contracts: RoAModuleContract[],
    user: AuthUserLike,
  ): Promise<RoADraftRecord> {
    const draft = await this.getDraft(draftId);
    if (draft.lockedAt) {
      throw new ValidationError('Finalised RoA records are locked. Create a new version instead.');
    }
    if (!draft.selectedModules.includes(input.moduleId)) {
      throw new ValidationError('Evidence can only be attached to a selected RoA module.');
    }

    const contract = contracts.find((item) => item.id === input.moduleId);
    if (!contract) throw new ValidationError('The selected module contract is not active.');
    const requirement = contract.evidence.requirements.find((item) => item.id === input.requirementId);
    if (!requirement) throw new ValidationError('The selected evidence requirement does not exist on this module contract.');

    const fileName = readString(input.fileName);
    if (!fileName) {
      throw new ValidationError('Uploaded evidence must include a file name.');
    }

    const allowedMimeTypes = (requirement.acceptedMimeTypes || []).map((type) => type.toLowerCase());
    const mimeType = normalizeMimeType(input.mimeType);
    if (allowedMimeTypes.length && !mimeType) {
      throw new ValidationError(`${requirement.label} must include a file type.`);
    }
    if (allowedMimeTypes.length && !allowedMimeTypes.includes(mimeType)) {
      throw new ValidationError(`${requirement.label} must use one of the accepted file types.`);
    }

    const bytes = base64ToBytes(input.bytesBase64);
    if (bytes.byteLength === 0) {
      throw new ValidationError('Uploaded evidence file is empty.');
    }
    if (bytes.byteLength > MAX_EVIDENCE_BYTES) {
      throw new ValidationError('Uploaded evidence exceeds the maximum allowed size.');
    }
    if (typeof input.size === 'number' && Number.isFinite(input.size) && bytes.byteLength !== input.size) {
      throw new ValidationError('Uploaded evidence size does not match the supplied file metadata.');
    }

    const source = readString(input.source) || 'adviser-upload';
    if (!ALLOWED_EVIDENCE_SOURCES.has(source)) {
      throw new ValidationError('Uploaded evidence source is not supported.');
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const sha256 = await sha256Base64(bytes);
    const storagePath = `${EVIDENCE_PREFIX}${id}`;
    const evidenceItem: RoAEvidenceItem = {
      id,
      moduleId: input.moduleId,
      requirementId: requirement.id,
      label: input.label || requirement.label,
      type: input.type || requirement.type,
      fileName,
      mimeType: mimeType || undefined,
      size: bytes.byteLength,
      storagePath,
      sha256,
      source,
      uploadedBy: user.id,
      uploadedAt: now,
    };

    const kvKey = storagePath;
    let kvPayload: Record<string, unknown>;

    try {
      const objectPath = roaEvidenceBlobPath(draft.clientId, draftId, id, evidenceItem.mimeType || mimeType);
      await uploadRoABlob(
        objectPath,
        bytes,
        evidenceItem.mimeType || mimeType || 'application/octet-stream',
      );
      kvPayload = {
        ...evidenceItem,
        draftId,
        contractVersion: contract.version,
        blobStoragePath: objectPath,
      };
    } catch (error) {
      log.warn('RoA evidence storage upload failed — KV byte fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      kvPayload = {
        ...evidenceItem,
        draftId,
        contractVersion: contract.version,
        bytesBase64: bytesToBase64(bytes),
      };
    }

    await kv.set(kvKey, kvPayload);

    if (draft.clientId) {
      const clientFile: RoAClientFileEntry = {
        id,
        clientId: draft.clientId,
        itemType: 'evidence',
        title: `${contract.title}: ${evidenceItem.label}`,
        fileName: evidenceItem.fileName,
        contentType: evidenceItem.mimeType,
        fileSize: evidenceItem.size,
        draftId,
        moduleId: input.moduleId,
        requirementId: requirement.id,
        storagePath,
        sha256,
        source: evidenceItem.source,
        createdAt: now,
      };

      await kv.set(`${CLIENT_FILE_PREFIX(draft.clientId)}${id}`, clientFile);
      await this.publishClientDocumentRegisterEntry(draft.clientId, clientFile, user);
    }

    const nextModuleEvidence = {
      ...(asRecord(draft.moduleEvidence?.[input.moduleId]) as Record<string, RoAEvidenceItem>),
      [requirement.id]: evidenceItem,
    };
    const updated: RoADraftRecord = {
      ...draft,
      moduleEvidence: {
        ...(draft.moduleEvidence || {}),
        [input.moduleId]: nextModuleEvidence,
      },
      updatedAt: now,
      updatedBy: user.id,
      auditEvents: appendAuditEvent(draft, 'evidence_uploaded', `${requirement.label} evidence uploaded`, user, {
        moduleId: input.moduleId,
        requirementId: requirement.id,
        evidenceId: id,
        fileName: input.fileName,
        sha256,
        source: evidenceItem.source,
      }),
    };

    await kv.set(`${DRAFT_PREFIX}${draft.id}`, updated);
    return updated;
  }

  /** Deletes an unlocked draft and linked artefacts (KV only — blobs may remain orphaned until TTL tooling runs). */
  async deleteDraft(draftId: string, _user: AuthUserLike): Promise<void> {
    const draft = await this.getDraft(draftId);
    if (draft.lockedAt) {
      throw new ValidationError('Cannot delete a finalised RoA draft.');
    }

    const keysToDelete: string[] = [];
    const clientId = draft.clientId ? readString(draft.clientId) : '';

    for (const doc of draft.generatedDocuments || []) {
      const rec = asRecord(doc);
      const id = readString(rec.id);
      if (!id) continue;
      keysToDelete.push(`${GENERATED_PREFIX}${id}`);
      if (clientId) {
        keysToDelete.push(`${CLIENT_DOCUMENT_PREFIX(clientId)}${id}`);
        keysToDelete.push(`${CLIENT_FILE_PREFIX(clientId)}${id}`);
        keysToDelete.push(`${CLIENT_DOCUMENT_REGISTER_PREFIX(clientId)}${id}`);
      }
    }

    for (const moduleEvidence of Object.values(draft.moduleEvidence || {})) {
      const slice = asRecord(moduleEvidence);
      for (const rawItem of Object.values(slice)) {
        const ev = rawItem as RoAEvidenceItem;
        const id = readString(ev.id);
        const storagePath = readString(ev.storagePath);
        if (storagePath) keysToDelete.push(storagePath);
        else if (id) keysToDelete.push(`${EVIDENCE_PREFIX}${id}`);
        if (clientId && id) {
          keysToDelete.push(`${CLIENT_FILE_PREFIX(clientId)}${id}`);
          keysToDelete.push(`${CLIENT_DOCUMENT_REGISTER_PREFIX(clientId)}${id}`);
        }
      }
    }

    const uniqueKeys = [...new Set(keysToDelete.filter(Boolean))];
    if (uniqueKeys.length > 0) {
      await kv.mdel(uniqueKeys);
    }

    await kv.del(`${DRAFT_PREFIX}${draftId}`);
    if (clientId) {
      await kv.del(`${CLIENT_DRAFT_PREFIX(clientId)}${draftId}`);
    }
    const adviserId = readString(draft.adviserId);
    if (adviserId) {
      await kv.del(`${ADVISER_DRAFT_PREFIX(adviserId)}${draftId}`);
    }

    log.info('RoA draft deleted', { draftId, deletedBy: _user.id });
  }

  async compileDraft(draftId: string, contracts: RoAModuleContract[], user: AuthUserLike, status: 'draft' | 'final' = 'draft'): Promise<RoADraftRecord> {
    const draft = await this.getDraft(draftId);
    if (draft.lockedAt) {
      throw new ValidationError('Finalised RoA records are locked. Create a new version instead.');
    }

    const validationResults = this.validateDraftWithContracts(draft, contracts);
    if (!validationResults.valid) {
      const updated = {
        ...draft,
        validationResults,
        updatedAt: new Date().toISOString(),
        updatedBy: user.id,
        auditEvents: appendAuditEvent(draft, 'compilation_blocked', 'RoA compilation blocked by validation', user, {
          blocking: validationResults.blocking.length,
        }),
      };
      await kv.set(`${DRAFT_PREFIX}${draft.id}`, updated);
      throw new ValidationError('RoA cannot be compiled while blocking validation issues remain');
    }

    const now = new Date().toISOString();
    const compilation = buildCanonicalRoACompilation({
      draft,
      contracts,
      status,
      now,
    });
    compilation.hash = await sha256Base64(textEncode(compilation.html));

    const updated: RoADraftRecord = {
      ...draft,
      validationResults,
      compiledOutput: compilation,
      updatedAt: now,
      updatedBy: user.id,
      auditEvents: appendAuditEvent(draft, 'document_compiled', 'RoA compiled from module contracts', user, {
        compilationId: compilation.id,
        modules: compilation.modules.map((module) => module.moduleId),
        canonicalSections: compilation.documentSections.map((section) => section.id),
      }),
    };
    await kv.set(`${DRAFT_PREFIX}${draft.id}`, updated);
    return updated;
  }

  async generateDocuments(draftId: string, formats: Array<'pdf' | 'docx'>, contracts: RoAModuleContract[], user: AuthUserLike): Promise<RoADraftRecord> {
    const existing = await this.getDraft(draftId);
    if (existing.lockedAt) {
      throw new ValidationError('Finalised RoA records are locked. Download the stored final documents instead.');
    }

    const compiledDraft = await this.compileDraft(draftId, contracts, user, 'draft');
    if (!compiledDraft.compiledOutput) throw new ValidationError('RoA compilation failed');

    const now = new Date().toISOString();
    const generatedDocuments = await this.createDocumentArtifacts(compiledDraft, formats, user, 'draft', now);

    const updated: RoADraftRecord = {
      ...compiledDraft,
      generatedDocuments: [...(compiledDraft.generatedDocuments || []), ...generatedDocuments],
      status: 'complete',
      updatedAt: now,
      updatedBy: user.id,
      auditEvents: appendAuditEvent(compiledDraft, 'document_generated', 'RoA document artefacts generated', user, {
        formats,
        documentIds: generatedDocuments.map((document) => document.id),
        documentStatus: 'draft',
        compilationHash: compiledDraft.compiledOutput.hash,
      }),
    };
    await kv.set(`${DRAFT_PREFIX}${compiledDraft.id}`, updated);
    return updated;
  }

  async finaliseDraft(draftId: string, contracts: RoAModuleContract[], user: AuthUserLike): Promise<RoADraftRecord> {
    const existing = await this.getDraft(draftId);
    if (existing.lockedAt) {
      throw new ValidationError('This RoA has already been finalised and locked.');
    }

    const compiledDraft = await this.compileDraft(draftId, contracts, user, 'final');
    const now = new Date().toISOString();
    const finalDocuments = await this.createDocumentArtifacts(compiledDraft, ['pdf', 'docx'], user, 'final', now);
    const withGeneratedAudit: RoADraftRecord = {
      ...compiledDraft,
      generatedDocuments: [...(compiledDraft.generatedDocuments || []), ...finalDocuments],
      auditEvents: appendAuditEvent(compiledDraft, 'final_documents_generated', 'Final RoA PDF and DOCX artefacts generated', user, {
        documentIds: finalDocuments.map((document) => document.id),
        compilationId: compiledDraft.compiledOutput?.id,
        compilationHash: compiledDraft.compiledOutput?.hash,
      }),
    };
    const finalised: RoADraftRecord = {
      ...withGeneratedAudit,
      status: 'submitted',
      finalisedAt: now,
      finalisedBy: user.id,
      lockedAt: now,
      updatedAt: now,
      updatedBy: user.id,
      auditEvents: appendAuditEvent(withGeneratedAudit, 'finalised', 'RoA finalised and locked', user, {
        compiledOutputId: withGeneratedAudit.compiledOutput?.id,
        finalDocumentIds: finalDocuments.map((document) => document.id),
      }),
    };
    await kv.set(`${DRAFT_PREFIX}${finalised.id}`, finalised);
    return finalised;
  }

  async getGeneratedDocument(documentId: string): Promise<RoAGeneratedDocument> {
    const stored = asRecord(await kv.get(`${GENERATED_PREFIX}${documentId}`));
    if (!stored.id) throw new NotFoundError('Generated RoA document not found');

    let downloadBase64 = readString(stored.bytesBase64, stored.downloadBase64) || undefined;
    const blobPath = readString(stored.blobStoragePath);
    if (!downloadBase64 && blobPath) {
      try {
        const retrieved = await downloadRoABlob(blobPath);
        downloadBase64 = bytesToBase64(retrieved);
      } catch (error) {
        log.warn('RoA generated document hydrate from storage failed', {
          blobPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      id: readString(stored.id),
      draftId: readString(stored.draftId),
      compilationId: readString(stored.compilationId),
      format: readString(stored.format) === 'docx' ? 'docx' : 'pdf',
      documentStatus: readString(stored.documentStatus) === 'final' ? 'final' : 'draft',
      fileName: readString(stored.fileName),
      contentType: readString(stored.contentType),
      storagePath: readString(stored.storagePath),
      sha256: readString(stored.sha256),
      compilationHash: readString(stored.compilationHash) || undefined,
      generatedAt: readString(stored.generatedAt),
      generatedBy: readString(stored.generatedBy),
      moduleContractVersions: asRecord(stored.moduleContractVersions) as Record<string, number>,
      lockedAt: readString(stored.lockedAt) || undefined,
      finalisedAt: readString(stored.finalisedAt) || undefined,
      downloadBase64,
    };
  }

  async listClientFiles(clientId: string): Promise<RoAClientFileEntry[]> {
    if (!clientId) throw new ValidationError('clientId is required');

    const records = await kv.getByPrefix(CLIENT_FILE_PREFIX(clientId));
    return records
      .map((record) => asRecord(record))
      .filter((record) => readString(record.id) && readString(record.fileName))
      .map((record): RoAClientFileEntry => ({
        id: readString(record.id),
        clientId,
        itemType: readString(record.itemType) === 'evidence' ? 'evidence' : 'generated-document',
        title: readString(record.title, record.fileName),
        fileName: readString(record.fileName),
        contentType: readString(record.contentType) || undefined,
        fileSize: typeof record.fileSize === 'number' ? record.fileSize : undefined,
        draftId: readString(record.draftId) || undefined,
        moduleId: readString(record.moduleId) || undefined,
        requirementId: readString(record.requirementId) || undefined,
        storagePath: readString(record.storagePath) || undefined,
        sha256: readString(record.sha256) || undefined,
        source: readString(record.source) || undefined,
        createdAt: readString(record.createdAt) || new Date(0).toISOString(),
        documentStatus: readString(record.documentStatus) === 'final' ? 'final' : readString(record.documentStatus) === 'draft' ? 'draft' : undefined,
        format: readString(record.format) === 'docx' ? 'docx' : readString(record.format) === 'pdf' ? 'pdf' : undefined,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async submitDraft(draftId: string, user: AuthUserLike): Promise<RoADraftRecord> {
    const existing = await this.getDraft(draftId);
    return this.saveDraft({
      ...existing,
      status: 'submitted',
      version: existing.version + 1,
    }, user);
  }
}
