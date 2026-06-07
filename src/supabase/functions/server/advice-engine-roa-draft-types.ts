import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';

export type JsonRecord = Record<string, unknown>;

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
  evidence: Array<{
    id?: string;
    label: string;
    fileName: string;
    type: string;
    source?: string;
    sha256?: string;
    uploadedAt?: string;
  }>;
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

export interface AuthUserLike {
  id: string;
  email?: string;
  user_metadata?: JsonRecord;
}
