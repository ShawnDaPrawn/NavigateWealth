import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { NotFoundError, ValidationError } from './error.middleware.ts';
import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';
import { uploadRoABlob, roaGeneratedBlobPath } from './advice-engine-roa-storage.ts';
import { createCanonicalRoAPdf, createCanonicalRoADocx } from './advice-engine-roa-document-gen.ts';
import type {
  AuthUserLike,
  RoAAdviserSnapshot,
  RoAClientContext,
  RoAClientFileEntry,
  RoAClientSnapshot,
  RoADraftRecord,
  RoAGeneratedDocument,
  RoAValidationIssue,
  RoAValidationResult,
} from './advice-engine-roa-draft-types.ts';
import {
  asArray,
  asRecord,
  bytesToBase64,
  flattenModuleFields,
  getClientDisplayName,
  getLatestUpdatedAt,
  hasValue,
  readString,
  sha256Base64,
  validateEvidenceMetadata,
} from './advice-engine-roa-utils.ts';
import { buildDataQuality, buildSourceMap } from './advice-engine-roa-compilation.ts';

const log = createModuleLogger('advice-engine-roa-service');

export const GENERATED_PREFIX = 'roa:generated:';
export const CLIENT_DOCUMENT_PREFIX = (clientId: string) => `roa:client:${clientId}:document:`;
export const CLIENT_FILE_PREFIX = (clientId: string) => `roa:client:${clientId}:file:`;
export const CLIENT_DOCUMENT_REGISTER_PREFIX = (clientId: string) => `document:${clientId}:`;

const FNA_PREFIXES: Record<string, string> = {
  risk: 'risk-planning-fna:client:',
  medical: 'medical-fna:client:',
  retirement: 'retirement-fna:client:',
  investment: 'investment-ina:client:',
  tax: 'tax-planning-fna:client:',
  estate: 'estate-planning-fna:client:',
};

export async function publishClientDocumentRegisterEntry(
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

export async function createDocumentArtifacts(
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
    const bytes =
      format === 'pdf'
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
      contentType:
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
      await publishClientDocumentRegisterEntry(compiledDraft.clientId, clientFile, user);
    }

    generatedDocuments.push(document);
  }

  return generatedDocuments;
}

export async function buildAdviserSnapshot(user: AuthUserLike): Promise<RoAAdviserSnapshot> {
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

export async function buildClientContext(
  clientId: string,
  adviserUser: AuthUserLike,
): Promise<RoAClientContext> {
  if (!clientId) throw new ValidationError('clientId is required');

  const [profileRaw, clientKeysRaw, policiesRaw, riskProfileRaw, adviserSnapshot, ...fnaGroups] =
    await Promise.all([
      kv.get(`user_profile:${clientId}:personal_info`),
      kv.get(`user_profile:${clientId}:client_keys`),
      kv.get(`policies:client:${clientId}`),
      kv.get(`client:${clientId}:risk_profile`),
      buildAdviserSnapshot(adviserUser),
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
    cellphone:
      readString(
        asRecord(profile.personalInformation).cellphone,
        profile.phoneNumber,
        profile.phone,
      ) || undefined,
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

export function validateDraftWithContracts(
  draft: RoADraftRecord,
  contracts: RoAModuleContract[],
): RoAValidationResult {
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
    const requiredFields =
      contract.validation.requiredFields.length > 0
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
        const metadataResult = validateEvidenceMetadata(
          contract,
          requirement,
          evidence[requirement.id],
        );
        blocking.push(...metadataResult.blocking);
        warnings.push(...metadataResult.warnings);
      }
    }

    for (const rule of contract.validation.rules) {
      const targetedFields = rule.fieldKeys || [];
      const targetMissing =
        targetedFields.length > 0 &&
        targetedFields.some((fieldKey) => !hasValue(moduleData[fieldKey]));
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
