import { Hono } from 'npm:hono';
import { requireAuth } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { AdviceEngineRoAService } from './advice-engine-roa-service.ts';
import { AdviceEngineRoAContractService } from './advice-engine-roa-contract-service.ts';
import { ClientIdParamSchema } from './advice-engine-validation.ts';

const app = new Hono();
const roaService = new AdviceEngineRoAService();
const roaContractService = new AdviceEngineRoAContractService();

function canUseRoA(role: string | undefined): boolean {
  return ['super_admin', 'super-admin', 'admin', 'adviser', 'paraplanner', 'compliance'].includes(
    role || '',
  );
}

function canManageRoAContracts(role: string | undefined): boolean {
  return ['super_admin', 'super-admin'].includes(role || '');
}

function canReviewAllRoADrafts(role: string | undefined): boolean {
  return ['super_admin', 'super-admin', 'admin', 'compliance'].includes(role || '');
}

function canAccessRoADraft(
  role: string | undefined,
  userId: string | undefined,
  draft: { adviserId?: string; createdBy?: string; updatedBy?: string },
): boolean {
  if (canReviewAllRoADrafts(role)) return true;
  if (!userId) return false;
  return draft.adviserId === userId || draft.createdBy === userId || draft.updatedBy === userId;
}

function forbiddenRoADraftResponse(c: any) {
  return c.json(
    { error: 'Forbidden: RoA draft is not visible to this user', code: 'FORBIDDEN_ROA_DRAFT' },
    403,
  );
}

// ============================================================================
// RECORD OF ADVICE FOUNDATION
// ============================================================================

app.get(
  '/roa/client/:clientId/context',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const { clientId } = ClientIdParamSchema.parse(c.req.param());
    const context = await roaService.buildClientContext(
      clientId,
      c.get('user') as { id: string; email?: string },
    );

    return c.json({ context });
  }),
);

app.get(
  '/roa/modules',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const modules = await roaContractService.listLegacyModules();
    return c.json({ modules });
  }),
);

app.get(
  '/roa/module-contracts/schema',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    return c.json({ schema: roaContractService.getSchemaFormat() });
  }),
);

app.get(
  '/roa/module-contracts',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const requestedStatus = c.req.query('status');
    const status = ['draft', 'active', 'archived'].includes(requestedStatus || '')
      ? (requestedStatus as 'draft' | 'active' | 'archived')
      : undefined;
    const includeArchived =
      canManageRoAContracts(role) && c.req.query('includeArchived') === 'true';
    const contracts = await roaContractService.listContracts({
      status: canManageRoAContracts(role) ? status : 'active',
      includeArchived,
    });

    return c.json({ contracts });
  }),
);

app.get(
  '/roa/module-contracts/:moduleId',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const contract = await roaContractService.getContract(c.req.param('moduleId')!);
    if (contract.status !== 'active' && !canManageRoAContracts(role)) {
      return c.json(
        { error: 'Forbidden: Super admin access required', code: 'FORBIDDEN_ROA_CONTRACT' },
        403,
      );
    }

    return c.json({ contract });
  }),
);

app.post(
  '/roa/module-contracts',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canManageRoAContracts(role)) {
      return c.json(
        { error: 'Forbidden: Super admin access required', code: 'FORBIDDEN_ROA_CONTRACT' },
        403,
      );
    }

    const body = await c.req.json();
    const contract = await roaContractService.saveContract(
      body,
      c.get('user') as { id: string; email?: string },
    );
    return c.json({ contract });
  }),
);

app.put(
  '/roa/module-contracts/:moduleId',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canManageRoAContracts(role)) {
      return c.json(
        { error: 'Forbidden: Super admin access required', code: 'FORBIDDEN_ROA_CONTRACT' },
        403,
      );
    }

    const body = await c.req.json();
    const contract = await roaContractService.saveContract(
      { ...body, id: c.req.param('moduleId')! },
      c.get('user') as { id: string; email?: string },
    );
    return c.json({ contract });
  }),
);

app.post(
  '/roa/module-contracts/:moduleId/publish',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canManageRoAContracts(role)) {
      return c.json(
        { error: 'Forbidden: Super admin access required', code: 'FORBIDDEN_ROA_CONTRACT' },
        403,
      );
    }

    const contract = await roaContractService.publishContract(
      c.req.param('moduleId')!,
      c.get('user') as { id: string; email?: string },
    );
    return c.json({ contract });
  }),
);

app.post(
  '/roa/module-contracts/:moduleId/archive',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canManageRoAContracts(role)) {
      return c.json(
        { error: 'Forbidden: Super admin access required', code: 'FORBIDDEN_ROA_CONTRACT' },
        403,
      );
    }

    const contract = await roaContractService.archiveContract(
      c.req.param('moduleId')!,
      c.get('user') as { id: string; email?: string },
    );
    return c.json({ contract });
  }),
);

app.get(
  '/roa/drafts',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const userId = c.get('userId') as string;
    const status = c.req.query('status');
    const clientId = c.req.query('clientId');
    const adviserId = canReviewAllRoADrafts(role) ? c.req.query('adviserId') : userId;

    const drafts = await roaService.listDrafts({ status, clientId, adviserId });
    return c.json({ drafts });
  }),
);

app.get(
  '/roa/client/:clientId/files',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const files = await roaService.listClientFiles(c.req.param('clientId')!);
    return c.json({ files });
  }),
);

app.post(
  '/roa/drafts',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const userId = c.get('userId') as string;
    const body = await c.req.json();
    const draft = await roaService.saveDraft(
      { ...body, adviserId: userId },
      c.get('user') as { id: string; email?: string },
    );

    return c.json({ draft });
  }),
);

app.get(
  '/roa/drafts/:draftId',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const draft = await roaService.getDraft(c.req.param('draftId')!);
    if (!canAccessRoADraft(role, c.get('userId') as string, draft)) {
      return forbiddenRoADraftResponse(c);
    }
    return c.json({ draft });
  }),
);

app.put(
  '/roa/drafts/:draftId',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const draftId = c.req.param('draftId')!;
    const existingDraft = await roaService.getDraft(draftId);
    if (!canAccessRoADraft(role, c.get('userId') as string, existingDraft)) {
      return forbiddenRoADraftResponse(c);
    }

    const body = await c.req.json();
    const draft = await roaService.saveDraft(
      { ...body, id: draftId, adviserId: existingDraft.adviserId },
      c.get('user') as { id: string; email?: string },
    );

    return c.json({ draft });
  }),
);

app.delete(
  '/roa/drafts/:draftId',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const draftId = c.req.param('draftId')!;
    const existingDraft = await roaService.getDraft(draftId);
    if (!canAccessRoADraft(role, c.get('userId') as string, existingDraft)) {
      return forbiddenRoADraftResponse(c);
    }

    await roaService.deleteDraft(draftId, c.get('user') as { id: string; email?: string });
    return c.body(null, 204);
  }),
);

app.post(
  '/roa/drafts/:draftId/clone-from-final',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const draftId = c.req.param('draftId')!;
    const existingDraft = await roaService.getDraft(draftId);
    if (!canAccessRoADraft(role, c.get('userId') as string, existingDraft)) {
      return forbiddenRoADraftResponse(c);
    }

    const draft = await roaService.cloneDraftFromFinal(
      draftId,
      c.get('user') as { id: string; email?: string },
    );
    return c.json({ draft });
  }),
);

app.post(
  '/roa/drafts/:draftId/submit',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const draftId = c.req.param('draftId')!;
    const existingDraft = await roaService.getDraft(draftId);
    if (!canAccessRoADraft(role, c.get('userId') as string, existingDraft)) {
      return forbiddenRoADraftResponse(c);
    }

    const draft = await roaService.submitDraft(
      draftId,
      c.get('user') as { id: string; email?: string },
    );
    return c.json({ draft });
  }),
);

app.post(
  '/roa/drafts/:draftId/validate',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const draftId = c.req.param('draftId')!;
    const existingDraft = await roaService.getDraft(draftId);
    if (!canAccessRoADraft(role, c.get('userId') as string, existingDraft)) {
      return forbiddenRoADraftResponse(c);
    }

    const contracts = await roaContractService.listContracts({ status: 'active' });
    const draft = await roaService.validateDraft(
      draftId,
      contracts,
      c.get('user') as { id: string; email?: string },
    );
    return c.json({ draft, validation: draft.validationResults });
  }),
);

app.post(
  '/roa/drafts/:draftId/evidence',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const body = await c.req.json();
    const draftId = c.req.param('draftId')!;
    const existingDraft = await roaService.getDraft(draftId);
    if (!canAccessRoADraft(role, c.get('userId') as string, existingDraft)) {
      return forbiddenRoADraftResponse(c);
    }

    const contracts = await roaContractService.listContracts({ status: 'active' });
    const draft = await roaService.uploadEvidence(
      draftId,
      body,
      contracts,
      c.get('user') as { id: string; email?: string },
    );
    const evidence = draft.moduleEvidence?.[body.moduleId]?.[body.requirementId];
    return c.json({ draft, evidence });
  }),
);

app.post(
  '/roa/drafts/:draftId/compile',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const draftId = c.req.param('draftId')!;
    const existingDraft = await roaService.getDraft(draftId);
    if (!canAccessRoADraft(role, c.get('userId') as string, existingDraft)) {
      return forbiddenRoADraftResponse(c);
    }

    const contracts = await roaContractService.listContracts({ status: 'active' });
    const draft = await roaService.compileDraft(
      draftId,
      contracts,
      c.get('user') as { id: string; email?: string },
    );
    return c.json({
      draft,
      compilation: draft.compiledOutput,
      validation: draft.validationResults,
    });
  }),
);

app.post(
  '/roa/drafts/:draftId/generate',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const requestedFormats = Array.isArray(body.formats) ? body.formats : [body.format || 'pdf'];
    const formats = requestedFormats.filter(
      (format: unknown): format is 'pdf' | 'docx' => format === 'pdf' || format === 'docx',
    );
    const draftId = c.req.param('draftId')!;
    const before = await roaService.getDraft(draftId);
    if (!canAccessRoADraft(role, c.get('userId') as string, before)) {
      return forbiddenRoADraftResponse(c);
    }

    const existingDocumentIds = new Set(
      (before.generatedDocuments || []).map((document) => document.id),
    );
    const contracts = await roaContractService.listContracts({ status: 'active' });
    const draft = await roaService.generateDocuments(
      draftId,
      formats.length > 0 ? formats : ['pdf'],
      contracts,
      c.get('user') as { id: string; email?: string },
    );
    const documents = (draft.generatedDocuments || []).filter(
      (document) => !existingDocumentIds.has(document.id),
    );
    return c.json({ draft, documents, compilation: draft.compiledOutput });
  }),
);

app.post(
  '/roa/drafts/:draftId/finalise',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const draftId = c.req.param('draftId')!;
    const before = await roaService.getDraft(draftId);
    if (!canAccessRoADraft(role, c.get('userId') as string, before)) {
      return forbiddenRoADraftResponse(c);
    }

    const existingDocumentIds = new Set(
      (before.generatedDocuments || []).map((document) => document.id),
    );
    const contracts = await roaContractService.listContracts({ status: 'active' });
    const draft = await roaService.finaliseDraft(
      draftId,
      contracts,
      c.get('user') as { id: string; email?: string },
    );
    const documents = (draft.generatedDocuments || []).filter(
      (document) => !existingDocumentIds.has(document.id),
    );
    return c.json({ draft, documents, compilation: draft.compiledOutput });
  }),
);

app.get(
  '/roa/documents/:documentId/download',
  requireAuth,
  asyncHandler(async (c) => {
    const role = c.get('userRole') as string | undefined;
    if (!canUseRoA(role)) {
      return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
    }

    const document = await roaService.getGeneratedDocument(c.req.param('documentId')!);
    const draft = await roaService.getDraft(document.draftId);
    if (!canAccessRoADraft(role, c.get('userId') as string, draft)) {
      return forbiddenRoADraftResponse(c);
    }

    return c.json({ document });
  }),
);

export default app;
