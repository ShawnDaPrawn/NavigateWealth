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
import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';
import {
  deleteRoABlobs,
  downloadRoABlob,
  roaEvidenceBlobPath,
  uploadRoABlob,
} from './advice-engine-roa-storage.ts';
import { buildCanonicalRoACompilation } from './advice-engine-roa-compilation.ts';
import {
  CLIENT_DOCUMENT_PREFIX,
  CLIENT_DOCUMENT_REGISTER_PREFIX,
  CLIENT_FILE_PREFIX,
  GENERATED_PREFIX,
  buildAdviserSnapshot,
  buildClientContext,
  createDocumentArtifacts,
  publishClientDocumentRegisterEntry,
  validateDraftWithContracts,
} from './advice-engine-roa-service-helpers.ts';
import {
  appendAuditEvent,
  asRecord,
  base64ToBytes,
  bytesToBase64,
  normalizeMimeType,
  readNumber,
  readString,
  sha256Base64,
  textEncode,
} from './advice-engine-roa-utils.ts';

export type {
  RoADraftStatus,
  RoAClientSnapshot,
  RoAAdviserSnapshot,
  RoAClientContext,
  RoADraftRecord,
  RoAEvidenceItem,
  RoAClientFileEntry,
  RoAValidationIssue,
  RoAValidationResult,
  RoACompiledSection,
  RoACompiledModule,
  RoARecommendationSummary,
  RoACompiledOutput,
  RoAGeneratedDocument,
  RoAAuditEvent,
  RoAEvidenceUploadInput,
  RoAModuleConversationStatus,
  RoAConvUploadRef,
  RoAConvMessage,
  RoAModuleNarrative,
  RoAModuleConversationRecord,
} from './advice-engine-roa-draft-types.ts';
export { buildCanonicalRoACompilation } from './advice-engine-roa-compilation.ts';
export { createCanonicalRoAPdf, createCanonicalRoADocx } from './advice-engine-roa-document-gen.ts';

import type {
  AuthUserLike,
  RoAClientFileEntry,
  RoADraftRecord,
  RoADraftStatus,
  RoAEvidenceItem,
  RoAEvidenceUploadInput,
  RoAGeneratedDocument,
  RoAValidationResult,
} from './advice-engine-roa-draft-types.ts';

const log = createModuleLogger('advice-engine-roa-service');

const DRAFT_PREFIX = 'roa:draft:';
/** Per-module conversation transcripts (distinct namespace so it never pollutes draft listings). */
export const CONVERSATION_PREFIX = 'roa:conversation:';
const CLIENT_DRAFT_PREFIX = (clientId: string) => `roa:client:${clientId}:draft:`;
const ADVISER_DRAFT_PREFIX = (adviserId: string) => `roa:adviser:${adviserId}:draft:`;
const EVIDENCE_PREFIX = 'roa:evidence:';
const MAX_EVIDENCE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EVIDENCE_SOURCES = new Set([
  'adviser-upload',
  'client-upload',
  'provider-sync',
  'system-import',
  'email-import',
  'legacy-import',
]);

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class AdviceEngineRoAService {
  validateDraftWithContracts(
    draft: RoADraftRecord,
    contracts: RoAModuleContract[],
  ): RoAValidationResult {
    return validateDraftWithContracts(draft, contracts);
  }

  async getDraft(draftId: string): Promise<RoADraftRecord> {
    const draft = await kv.get(`${DRAFT_PREFIX}${draftId}`);
    if (!draft) throw new NotFoundError('RoA draft not found');
    return draft as RoADraftRecord;
  }

  async listDrafts(filters: {
    status?: string;
    clientId?: string;
    adviserId?: string;
  }): Promise<RoADraftRecord[]> {
    const drafts = (await kv.getByPrefix(DRAFT_PREFIX)) as RoADraftRecord[];
    return drafts
      .filter((draft) => !filters.status || draft.status === filters.status)
      .filter((draft) => !filters.clientId || draft.clientId === filters.clientId)
      .filter((draft) => !filters.adviserId || draft.adviserId === filters.adviserId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveDraft(input: Partial<RoADraftRecord>, user: AuthUserLike): Promise<RoADraftRecord> {
    const now = new Date().toISOString();
    const existing = input.id
      ? ((await kv.get(`${DRAFT_PREFIX}${input.id}`)) as RoADraftRecord | null)
      : null;
    if (existing?.lockedAt) {
      throw new ValidationError('Finalised RoA records are locked. Create a new version instead.');
    }
    const draftId = existing?.id || input.id || crypto.randomUUID();
    const selectedModules = Array.isArray(input.selectedModules)
      ? input.selectedModules
      : existing?.selectedModules || [];
    const moduleData = asRecord(input.moduleData || existing?.moduleData);
    const previousModules = existing?.selectedModules || [];
    const adviserSnapshot = await buildAdviserSnapshot(user);

    let clientSnapshot = input.clientSnapshot || existing?.clientSnapshot;
    let contextCapturedAt = existing?.contextCapturedAt;

    if (input.clientId && (!existing || existing.clientId !== input.clientId || !clientSnapshot)) {
      const context = await buildClientContext(input.clientId, user);
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
      authoringMode: input.authoringMode ?? existing?.authoringMode ?? 'conversation',
      moduleConversationStatus:
        input.moduleConversationStatus ?? existing?.moduleConversationStatus,
      moduleNarratives: input.moduleNarratives ?? existing?.moduleNarratives,
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
    const removedModules = previousModules.filter(
      (moduleId) => !selectedModules.includes(moduleId),
    );
    if (existing?.clientId !== draft.clientId && draft.clientId) {
      draft.auditEvents = appendAuditEvent(
        draft,
        'client_selected',
        'Client selected for RoA draft',
        user,
        { clientId: draft.clientId },
      );
    }
    if (contextCapturedAt && contextCapturedAt !== existing?.contextCapturedAt) {
      draft.auditEvents = appendAuditEvent(
        draft,
        'snapshot_refreshed',
        'Client/adviser snapshot refreshed',
        user,
        { contextCapturedAt },
      );
    }
    if (addedModules.length > 0 || removedModules.length > 0) {
      draft.auditEvents = appendAuditEvent(
        draft,
        'modules_updated',
        'RoA module selection updated',
        user,
        { addedModules, removedModules },
      );
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
      throw new ValidationError(
        'Only finalised RoA drafts can be branched into a new editable version.',
      );
    }

    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const baseVersion =
      typeof source.version === 'number' && Number.isFinite(source.version) ? source.version : 1;
    const adviserSnapshot = await buildAdviserSnapshot(user);

    const newDraft: RoADraftRecord = {
      id: newId,
      clientId: source.clientId,
      clientData: source.clientData ? cloneJson(source.clientData) : undefined,
      selectedModules: [...source.selectedModules],
      moduleData: cloneJson(source.moduleData || {}),
      moduleOutputs: source.moduleOutputs ? cloneJson(source.moduleOutputs) : undefined,
      moduleEvidence: source.moduleEvidence ? cloneJson(source.moduleEvidence) : undefined,
      authoringMode: source.authoringMode ?? 'conversation',
      moduleConversationStatus: source.moduleConversationStatus
        ? cloneJson(source.moduleConversationStatus)
        : undefined,
      moduleNarratives: source.moduleNarratives ? cloneJson(source.moduleNarratives) : undefined,
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

  async validateDraft(
    draftId: string,
    contracts: RoAModuleContract[],
    user: AuthUserLike,
  ): Promise<RoADraftRecord> {
    const draft = await this.getDraft(draftId);
    const validationResults = validateDraftWithContracts(draft, contracts);
    const updated: RoADraftRecord = {
      ...draft,
      validationResults,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
      auditEvents: appendAuditEvent(
        draft,
        'validation_run',
        validationResults.valid ? 'RoA validation passed' : 'RoA validation found blockers',
        user,
        {
          blocking: validationResults.blocking.length,
          warnings: validationResults.warnings.length,
        },
      ),
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
    const requirement = contract.evidence.requirements.find(
      (item) => item.id === input.requirementId,
    );
    if (!requirement)
      throw new ValidationError(
        'The selected evidence requirement does not exist on this module contract.',
      );

    const fileName = readString(input.fileName);
    if (!fileName) {
      throw new ValidationError('Uploaded evidence must include a file name.');
    }

    const allowedMimeTypes = (requirement.acceptedMimeTypes || []).map((type) =>
      type.toLowerCase(),
    );
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
    if (
      typeof input.size === 'number' &&
      Number.isFinite(input.size) &&
      bytes.byteLength !== input.size
    ) {
      throw new ValidationError(
        'Uploaded evidence size does not match the supplied file metadata.',
      );
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
      const objectPath = roaEvidenceBlobPath(
        draft.clientId,
        draftId,
        id,
        evidenceItem.mimeType || mimeType,
      );
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
      await publishClientDocumentRegisterEntry(draft.clientId, clientFile, user);
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
      auditEvents: appendAuditEvent(
        draft,
        'evidence_uploaded',
        `${requirement.label} evidence uploaded`,
        user,
        {
          moduleId: input.moduleId,
          requirementId: requirement.id,
          evidenceId: id,
          fileName: input.fileName,
          sha256,
          source: evidenceItem.source,
        },
      ),
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

    // Per-module conversation transcripts live in a distinct namespace.
    const conversationRecords = await kv.getByPrefix(`${CONVERSATION_PREFIX}${draftId}:`);
    for (const record of conversationRecords) {
      const moduleId = readString(asRecord(record).moduleId);
      if (moduleId) keysToDelete.push(`${CONVERSATION_PREFIX}${draftId}:${moduleId}`);
    }

    const uniqueKeys = [...new Set(keysToDelete.filter(Boolean))];

    // Purge the Storage objects BEFORE the KV rows that name them.
    //
    // `blobStoragePath` is the Supabase Storage object path, and it lives on
    // the KV record — not on the RoAEvidenceItem embedded in the draft — so the
    // records have to be read back to find it. Doing that after `mdel` would
    // leave nothing to read, and every blob would be orphaned exactly as it was
    // before: evidence a client uploaded to support advice, and the generated
    // Records of Advice themselves, kept in the bucket forever after the draft
    // that owned them was deleted.
    //
    // Storage failure is deliberately NOT fatal. The KV delete is what the
    // caller asked for and what the UI reflects; a bucket outage must not leave
    // a draft that refuses to delete. A failure here is logged with the paths
    // so the objects can be swept later, which is the same trade the tax-docs
    // delete makes.
    const blobBearingKeys = uniqueKeys.filter(
      (key) => key.startsWith(EVIDENCE_PREFIX) || key.startsWith(GENERATED_PREFIX),
    );
    if (blobBearingKeys.length > 0) {
      const records = await kv.mget(blobBearingKeys);
      const objectPaths = records
        .map((record) => readString(asRecord(record).blobStoragePath))
        .filter((path): path is string => Boolean(path));

      if (objectPaths.length > 0) {
        try {
          await deleteRoABlobs(objectPaths);
        } catch (error) {
          log.warn('RoA blob purge failed — KV rows still deleted, objects left behind', {
            draftId,
            objectPaths,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

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

  async compileDraft(
    draftId: string,
    contracts: RoAModuleContract[],
    user: AuthUserLike,
    status: 'draft' | 'final' = 'draft',
  ): Promise<RoADraftRecord> {
    const draft = await this.getDraft(draftId);
    if (draft.lockedAt) {
      throw new ValidationError('Finalised RoA records are locked. Create a new version instead.');
    }

    const validationResults = validateDraftWithContracts(draft, contracts);
    if (!validationResults.valid) {
      const updated = {
        ...draft,
        validationResults,
        updatedAt: new Date().toISOString(),
        updatedBy: user.id,
        auditEvents: appendAuditEvent(
          draft,
          'compilation_blocked',
          'RoA compilation blocked by validation',
          user,
          {
            blocking: validationResults.blocking.length,
          },
        ),
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
      auditEvents: appendAuditEvent(
        draft,
        'document_compiled',
        'RoA compiled from module contracts',
        user,
        {
          compilationId: compilation.id,
          modules: compilation.modules.map((module) => module.moduleId),
          canonicalSections: compilation.documentSections.map((section) => section.id),
        },
      ),
    };
    await kv.set(`${DRAFT_PREFIX}${draft.id}`, updated);
    return updated;
  }

  async generateDocuments(
    draftId: string,
    formats: Array<'pdf' | 'docx'>,
    contracts: RoAModuleContract[],
    user: AuthUserLike,
  ): Promise<RoADraftRecord> {
    const existing = await this.getDraft(draftId);
    if (existing.lockedAt) {
      throw new ValidationError(
        'Finalised RoA records are locked. Download the stored final documents instead.',
      );
    }

    const compiledDraft = await this.compileDraft(draftId, contracts, user, 'draft');
    if (!compiledDraft.compiledOutput) throw new ValidationError('RoA compilation failed');

    const now = new Date().toISOString();
    const generatedDocuments = await createDocumentArtifacts(
      compiledDraft,
      formats,
      user,
      'draft',
      now,
    );

    const updated: RoADraftRecord = {
      ...compiledDraft,
      generatedDocuments: [...(compiledDraft.generatedDocuments || []), ...generatedDocuments],
      status: 'complete',
      updatedAt: now,
      updatedBy: user.id,
      auditEvents: appendAuditEvent(
        compiledDraft,
        'document_generated',
        'RoA document artefacts generated',
        user,
        {
          formats,
          documentIds: generatedDocuments.map((document) => document.id),
          documentStatus: 'draft',
          compilationHash: compiledDraft.compiledOutput.hash,
        },
      ),
    };
    await kv.set(`${DRAFT_PREFIX}${compiledDraft.id}`, updated);
    return updated;
  }

  async finaliseDraft(
    draftId: string,
    contracts: RoAModuleContract[],
    user: AuthUserLike,
  ): Promise<RoADraftRecord> {
    const existing = await this.getDraft(draftId);
    if (existing.lockedAt) {
      throw new ValidationError('This RoA has already been finalised and locked.');
    }

    const compiledDraft = await this.compileDraft(draftId, contracts, user, 'final');
    const now = new Date().toISOString();
    const finalDocuments = await createDocumentArtifacts(
      compiledDraft,
      ['pdf', 'docx'],
      user,
      'final',
      now,
    );
    const withGeneratedAudit: RoADraftRecord = {
      ...compiledDraft,
      generatedDocuments: [...(compiledDraft.generatedDocuments || []), ...finalDocuments],
      auditEvents: appendAuditEvent(
        compiledDraft,
        'final_documents_generated',
        'Final RoA PDF and DOCX artefacts generated',
        user,
        {
          documentIds: finalDocuments.map((document) => document.id),
          compilationId: compiledDraft.compiledOutput?.id,
          compilationHash: compiledDraft.compiledOutput?.hash,
        },
      ),
    };
    const finalised: RoADraftRecord = {
      ...withGeneratedAudit,
      status: 'submitted',
      finalisedAt: now,
      finalisedBy: user.id,
      lockedAt: now,
      updatedAt: now,
      updatedBy: user.id,
      auditEvents: appendAuditEvent(
        withGeneratedAudit,
        'finalised',
        'RoA finalised and locked',
        user,
        {
          compiledOutputId: withGeneratedAudit.compiledOutput?.id,
          finalDocumentIds: finalDocuments.map((document) => document.id),
        },
      ),
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
      .map(
        (record): RoAClientFileEntry => ({
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
          documentStatus:
            readString(record.documentStatus) === 'final'
              ? 'final'
              : readString(record.documentStatus) === 'draft'
                ? 'draft'
                : undefined,
          format:
            readString(record.format) === 'docx'
              ? 'docx'
              : readString(record.format) === 'pdf'
                ? 'pdf'
                : undefined,
        }),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async submitDraft(draftId: string, user: AuthUserLike): Promise<RoADraftRecord> {
    const existing = await this.getDraft(draftId);
    return this.saveDraft(
      {
        ...existing,
        status: 'submitted',
        version: existing.version + 1,
      },
      user,
    );
  }
}
