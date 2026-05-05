/**
 * Advice Engine Module - Routes
 * Fresh file moved to root to fix bundling issues
 * 
 * Unified Financial Needs Analysis (FNA) system:
 * - Risk Planning FNA
 * - Medical Aid FNA
 * - Retirement FNA
 * - Investment Needs Analysis (INA)
 * - Tax Planning FNA
 * - Estate Planning FNA
 * - AI Advisor Integration
 * 
 * Updated Phase 3 - Increment 3.2: Added comprehensive validation
 */

import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { AdviceEngineService } from './advice-engine-service.ts';
import { AdviceEngineRoAService } from './advice-engine-roa-service.ts';
import { AdviceEngineRoAContractService } from './advice-engine-roa-contract-service.ts';
import {
  CreateRiskFNASchema,
  UpdateRiskFNASchema,
  CreateMedicalFNASchema,
  UpdateMedicalFNASchema,
  CreateRetirementFNASchema,
  UpdateRetirementFNASchema,
  CreateInvestmentINASchema,
  UpdateInvestmentINASchema,
  CreateTaxFNASchema,
  UpdateTaxFNASchema,
  CreateEstateFNASchema,
  UpdateEstateFNASchema,
  FNAIdParamSchema,
  ClientIdParamSchema,
  AIChatRequestSchema,
  AIAnalysisRequestSchema,
} from './advice-engine-validation.ts';

const app = new Hono();
const log = createModuleLogger('advice-engine');
const service = new AdviceEngineService();
const roaService = new AdviceEngineRoAService();
const roaContractService = new AdviceEngineRoAContractService();

function canUseRoA(role: string | undefined): boolean {
  return ['super_admin', 'super-admin', 'admin', 'adviser', 'paraplanner', 'compliance'].includes(role || '');
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
  return c.json({ error: 'Forbidden: RoA draft is not visible to this user', code: 'FORBIDDEN_ROA_DRAFT' }, 403);
}

// ============================================================================
// RISK PLANNING FNA
// ============================================================================

/**
 * POST /advice-engine/fna/create
 * Create new Risk Planning FNA
 */
app.post('/fna/create', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  // Validate input
  const validated = CreateRiskFNASchema.parse(body);
  
  log.info('Creating Risk FNA', { userId, clientId: validated.clientId });
  
  const fna = await service.createFNA('risk', userId, validated);
  
  log.success('Risk FNA created', { userId, fnaId: fna.id });
  
  return c.json({ fna });
}));

/**
 * PUT /advice-engine/fna/:id
 * Update Risk Planning FNA
 */
app.put('/fna/:id', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
  const body = await c.req.json();
  
  // Validate input
  const updates = UpdateRiskFNASchema.parse(body);
  
  log.info('Updating Risk FNA', { userId, fnaId });
  
  const fna = await service.updateFNA('risk', fnaId, updates);
  
  return c.json({ fna });
}));

/**
 * GET /advice-engine/fna/client/:clientId
 * Get all Risk FNAs for client
 */
app.get('/fna/client/:clientId', requireAuth, asyncHandler(async (c) => {
  const { clientId } = ClientIdParamSchema.parse(c.req.param());
  
  const fnas = await service.getClientFNAs('risk', clientId);
  
  return c.json({ fnas });
}));

/**
 * GET /advice-engine/fna/:id
 * Get specific Risk FNA
 */
app.get('/fna/:id', requireAuth, asyncHandler(async (c) => {
  const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
  
  const fna = await service.getFNAById('risk', fnaId);
  
  return c.json({ fna });
}));

/**
 * POST /advice-engine/fna/:id/publish
 * Publish Risk FNA
 */
app.post('/fna/:id/publish', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
  
  log.info('Publishing Risk FNA', { adminUserId, fnaId });
  
  const fna = await service.publishFNA('risk', fnaId, adminUserId);
  
  log.success('Risk FNA published', { fnaId });
  
  return c.json({ fna });
}));

// ============================================================================
// MEDICAL AID FNA
// ============================================================================

/**
 * POST /advice-engine/medical-fna/create
 * Create new Medical Aid FNA
 */
app.post('/medical-fna/create', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  // Validate input
  const validated = CreateMedicalFNASchema.parse(body);
  
  log.info('Creating Medical FNA', { userId, clientId: validated.clientId });
  
  const fna = await service.createFNA('medical', userId, validated);
  
  log.success('Medical FNA created', { userId, fnaId: fna.id });
  
  return c.json({ fna });
}));

/**
 * PUT /advice-engine/medical-fna/:id
 * Update Medical Aid FNA
 */
app.put('/medical-fna/:id', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
  const body = await c.req.json();
  
  // Validate input
  const updates = UpdateMedicalFNASchema.parse(body);
  
  const fna = await service.updateFNA('medical', fnaId, updates);
  
  return c.json({ fna });
}));

/**
 * GET /advice-engine/medical-fna/client/:clientId
 * Get all Medical FNAs for client
 */
app.get('/medical-fna/client/:clientId', requireAuth, asyncHandler(async (c) => {
  const { clientId } = ClientIdParamSchema.parse(c.req.param());
  
  const fnas = await service.getClientFNAs('medical', clientId);
  
  return c.json({ fnas });
}));

/**
 * POST /advice-engine/medical-fna/:id/publish
 * Publish Medical FNA
 */
app.post('/medical-fna/:id/publish', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
  
  const fna = await service.publishFNA('medical', fnaId, adminUserId);
  
  return c.json({ fna });
}));

// ============================================================================
// RETIREMENT FNA
// ============================================================================

/**
 * POST /advice-engine/retirement-fna/create
 * Create new Retirement FNA
 */
app.post('/retirement-fna/create', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  // Validate input
  const validated = CreateRetirementFNASchema.parse(body);
  
  log.info('Creating Retirement FNA', { userId, clientId: validated.clientId });
  
  const fna = await service.createFNA('retirement', userId, validated);
  
  log.success('Retirement FNA created', { userId, fnaId: fna.id });
  
  return c.json({ fna });
}));

/**
 * PUT /advice-engine/retirement-fna/:id
 * Update Retirement FNA
 */
app.put('/retirement-fna/:id', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
  const body = await c.req.json();
  
  // Validate input
  const updates = UpdateRetirementFNASchema.parse(body);
  
  const fna = await service.updateFNA('retirement', fnaId, updates);
  
  return c.json({ fna });
}));

/**
 * GET /advice-engine/retirement-fna/client/:clientId
 * Get all Retirement FNAs for client
 */
app.get('/retirement-fna/client/:clientId', requireAuth, asyncHandler(async (c) => {
  const { clientId } = ClientIdParamSchema.parse(c.req.param());
  
  const fnas = await service.getClientFNAs('retirement', clientId);
  
  return c.json({ fnas });
}));

/**
 * POST /advice-engine/retirement-fna/:id/publish
 * Publish Retirement FNA
 */
app.post('/retirement-fna/:id/publish', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
  
  const fna = await service.publishFNA('retirement', fnaId, adminUserId);
  
  return c.json({ fna });
}));

// ============================================================================
// INVESTMENT NEEDS ANALYSIS (INA)
// ============================================================================

/**
 * POST /advice-engine/investment-ina/create
 * Create new Investment INA
 */
app.post('/investment-ina/create', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  // Validate input
  const validated = CreateInvestmentINASchema.parse(body);
  
  log.info('Creating Investment INA', { userId, clientId: validated.clientId });
  
  const ina = await service.createFNA('investment', userId, validated);
  
  log.success('Investment INA created', { userId, inaId: ina.id });
  
  return c.json({ ina });
}));

/**
 * PUT /advice-engine/investment-ina/:id
 * Update Investment INA
 */
app.put('/investment-ina/:id', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const { id: inaId } = FNAIdParamSchema.parse(c.req.param());
  const body = await c.req.json();
  
  // Validate input
  const updates = UpdateInvestmentINASchema.parse(body);
  
  const ina = await service.updateFNA('investment', inaId, updates);
  
  return c.json({ ina });
}));

/**
 * GET /advice-engine/investment-ina/client/:clientId
 * Get all Investment INAs for client
 */
app.get('/investment-ina/client/:clientId', requireAuth, asyncHandler(async (c) => {
  const { clientId } = ClientIdParamSchema.parse(c.req.param());
  
  const inas = await service.getClientFNAs('investment', clientId);
  
  return c.json({ inas });
}));

/**
 * POST /advice-engine/investment-ina/:id/publish
 * Publish Investment INA
 */
app.post('/investment-ina/:id/publish', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const { id: inaId } = FNAIdParamSchema.parse(c.req.param());
  
  const ina = await service.publishFNA('investment', inaId, adminUserId);
  
  return c.json({ ina });
}));

// ============================================================================
// TAX PLANNING FNA
// ============================================================================

/**
 * POST /advice-engine/tax-planning-fna/create
 * Create new Tax Planning FNA
 */
app.post('/tax-planning-fna/create', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  // Validate input
  const validated = CreateTaxFNASchema.parse(body);
  
  log.info('Creating Tax Planning FNA', { userId, clientId: validated.clientId });
  
  const fna = await service.createFNA('tax', userId, validated);
  
  log.success('Tax Planning FNA created', { userId, fnaId: fna.id });
  
  return c.json({ fna });
}));

/**
 * PUT /advice-engine/tax-planning-fna/:id
 * Update Tax Planning FNA
 */
app.put('/tax-planning-fna/:id', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
  const body = await c.req.json();
  
  // Validate input
  const updates = UpdateTaxFNASchema.parse(body);
  
  const fna = await service.updateFNA('tax', fnaId, updates);
  
  return c.json({ fna });
}));

/**
 * GET /advice-engine/tax-planning-fna/client/:clientId
 * Get all Tax Planning FNAs for client
 */
app.get('/tax-planning-fna/client/:clientId', requireAuth, asyncHandler(async (c) => {
  const { clientId } = ClientIdParamSchema.parse(c.req.param());
  
  const fnas = await service.getClientFNAs('tax', clientId);
  
  return c.json({ fnas });
}));

/**
 * POST /advice-engine/tax-planning-fna/:id/publish
 * Publish Tax Planning FNA
 */
app.post('/tax-planning-fna/:id/publish', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
  
  const fna = await service.publishFNA('tax', fnaId, adminUserId);
  
  return c.json({ fna });
}));

// ============================================================================
// ESTATE PLANNING FNA
// ============================================================================

/**
 * POST /advice-engine/estate-planning-fna/create
 * Create new Estate Planning FNA
 */
app.post('/estate-planning-fna/create', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  // Validate input
  const validated = CreateEstateFNASchema.parse(body);
  
  log.info('Creating Estate Planning FNA', { userId, clientId: validated.clientId });
  
  const fna = await service.createFNA('estate', userId, validated);
  
  log.success('Estate Planning FNA created', { userId, fnaId: fna.id });
  
  return c.json({ fna });
}));

/**
 * PUT /advice-engine/estate-planning-fna/:id
 * Update Estate Planning FNA
 */
app.put('/estate-planning-fna/:id', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
  const body = await c.req.json();
  
  // Validate input
  const updates = UpdateEstateFNASchema.parse(body);
  
  const fna = await service.updateFNA('estate', fnaId, updates);
  
  return c.json({ fna });
}));

/**
 * GET /advice-engine/estate-planning-fna/client/:clientId
 * Get all Estate Planning FNAs for client
 */
app.get('/estate-planning-fna/client/:clientId', requireAuth, asyncHandler(async (c) => {
  const { clientId } = ClientIdParamSchema.parse(c.req.param());
  
  const fnas = await service.getClientFNAs('estate', clientId);
  
  return c.json({ fnas });
}));

/**
 * POST /advice-engine/estate-planning-fna/:id/publish
 * Publish Estate Planning FNA
 */
app.post('/estate-planning-fna/:id/publish', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
  
  const fna = await service.publishFNA('estate', fnaId, adminUserId);
  
  return c.json({ fna });
}));

// ============================================================================
// AI ADVISOR & INTELLIGENCE
// ============================================================================

/**
 * POST /advice-engine/ai/chat
 * AI Advisor chat (client portal)
 */
app.post('/ai/chat', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  // Validate input
  const { message, context } = AIChatRequestSchema.parse(body);
  
  log.info('AI Advisor chat', { userId });
  
  const response = await service.aiChat(userId, message, context);
  
  return c.json(response);
}));

/**
 * POST /advice-engine/ai/analyze
 * AI Intelligence analysis (admin)
 */
app.post('/ai/analyze', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const body = await c.req.json();
  
  // Validate input
  const { clientId, analysisType, data } = AIAnalysisRequestSchema.parse(body);
  
  log.info('AI Intelligence analysis', { adminUserId, clientId, analysisType });
  
  const analysis = await service.aiAnalyze(clientId, analysisType, data);
  
  return c.json(analysis);
}));

// ============================================================================
// RECORD OF ADVICE FOUNDATION
// ============================================================================

/**
 * GET /advice-engine/roa/client/:clientId/context
 * Build the client/adviser context packet used to create RoA snapshots.
 */
app.get('/roa/client/:clientId/context', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const { clientId } = ClientIdParamSchema.parse(c.req.param());
  const context = await roaService.buildClientContext(clientId, c.get('user'));

  return c.json({ context });
}));

/**
 * GET /advice-engine/roa/modules
 * Active module registry adapted to the current wizard's legacy module shape.
 */
app.get('/roa/modules', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const modules = await roaContractService.listLegacyModules();
  return c.json({ modules });
}));

/**
 * GET /advice-engine/roa/module-contracts/schema
 * Controlled schema format for a future super-admin contract editor.
 */
app.get('/roa/module-contracts/schema', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  return c.json({ schema: roaContractService.getSchemaFormat() });
}));

/**
 * GET /advice-engine/roa/module-contracts
 * List module contracts. Super admins can include drafts/archives for editing;
 * advisers receive active contracts only.
 */
app.get('/roa/module-contracts', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const requestedStatus = c.req.query('status');
  const status = ['draft', 'active', 'archived'].includes(requestedStatus || '')
    ? requestedStatus as 'draft' | 'active' | 'archived'
    : undefined;
  const includeArchived = canManageRoAContracts(role) && c.req.query('includeArchived') === 'true';
  const contracts = await roaContractService.listContracts({
    status: canManageRoAContracts(role) ? status : 'active',
    includeArchived,
  });

  return c.json({ contracts });
}));

/**
 * GET /advice-engine/roa/module-contracts/:moduleId
 * Load one module contract.
 */
app.get('/roa/module-contracts/:moduleId', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const contract = await roaContractService.getContract(c.req.param('moduleId'));
  if (contract.status !== 'active' && !canManageRoAContracts(role)) {
    return c.json({ error: 'Forbidden: Super admin access required', code: 'FORBIDDEN_ROA_CONTRACT' }, 403);
  }

  return c.json({ contract });
}));

/**
 * POST /advice-engine/roa/module-contracts
 * Create or replace a module contract. Super-admin only.
 */
app.post('/roa/module-contracts', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canManageRoAContracts(role)) {
    return c.json({ error: 'Forbidden: Super admin access required', code: 'FORBIDDEN_ROA_CONTRACT' }, 403);
  }

  const body = await c.req.json();
  const contract = await roaContractService.saveContract(body, c.get('user'));
  return c.json({ contract });
}));

/**
 * PUT /advice-engine/roa/module-contracts/:moduleId
 * Update a module contract. Super-admin only.
 */
app.put('/roa/module-contracts/:moduleId', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canManageRoAContracts(role)) {
    return c.json({ error: 'Forbidden: Super admin access required', code: 'FORBIDDEN_ROA_CONTRACT' }, 403);
  }

  const body = await c.req.json();
  const contract = await roaContractService.saveContract({ ...body, id: c.req.param('moduleId') }, c.get('user'));
  return c.json({ contract });
}));

/**
 * POST /advice-engine/roa/module-contracts/:moduleId/publish
 * Publish a draft contract so advisers can use it.
 */
app.post('/roa/module-contracts/:moduleId/publish', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canManageRoAContracts(role)) {
    return c.json({ error: 'Forbidden: Super admin access required', code: 'FORBIDDEN_ROA_CONTRACT' }, 403);
  }

  const contract = await roaContractService.publishContract(c.req.param('moduleId'), c.get('user'));
  return c.json({ contract });
}));

/**
 * POST /advice-engine/roa/module-contracts/:moduleId/archive
 * Archive a module contract without deleting its history.
 */
app.post('/roa/module-contracts/:moduleId/archive', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canManageRoAContracts(role)) {
    return c.json({ error: 'Forbidden: Super admin access required', code: 'FORBIDDEN_ROA_CONTRACT' }, 403);
  }

  const contract = await roaContractService.archiveContract(c.req.param('moduleId'), c.get('user'));
  return c.json({ contract });
}));

/**
 * GET /advice-engine/roa/drafts
 * List RoA drafts visible to the current adviser/admin.
 */
app.get('/roa/drafts', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const userId = c.get('userId');
  const status = c.req.query('status');
  const clientId = c.req.query('clientId');
  const adviserId = canReviewAllRoADrafts(role)
    ? c.req.query('adviserId')
    : userId;

  const drafts = await roaService.listDrafts({ status, clientId, adviserId });
  return c.json({ drafts });
}));

/**
 * GET /advice-engine/roa/client/:clientId/files
 * List RoA-generated documents and evidence indexed against the client file.
 */
app.get('/roa/client/:clientId/files', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const files = await roaService.listClientFiles(c.req.param('clientId'));
  return c.json({ files });
}));

/**
 * POST /advice-engine/roa/drafts
 * Create a new RoA draft or save an optimistic client-created draft.
 */
app.post('/roa/drafts', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const userId = c.get('userId');
  const body = await c.req.json();
  const draft = await roaService.saveDraft({ ...body, adviserId: userId }, c.get('user'));

  return c.json({ draft });
}));

/**
 * GET /advice-engine/roa/drafts/:draftId
 * Load a persisted RoA draft.
 */
app.get('/roa/drafts/:draftId', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const draft = await roaService.getDraft(c.req.param('draftId'));
  if (!canAccessRoADraft(role, c.get('userId'), draft)) {
    return forbiddenRoADraftResponse(c);
  }
  return c.json({ draft });
}));

/**
 * PUT /advice-engine/roa/drafts/:draftId
 * Save changes to a persisted RoA draft.
 */
app.put('/roa/drafts/:draftId', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const draftId = c.req.param('draftId');
  const existingDraft = await roaService.getDraft(draftId);
  if (!canAccessRoADraft(role, c.get('userId'), existingDraft)) {
    return forbiddenRoADraftResponse(c);
  }

  const body = await c.req.json();
  const draft = await roaService.saveDraft({ ...body, id: draftId, adviserId: existingDraft.adviserId }, c.get('user'));

  return c.json({ draft });
}));

/**
 * DELETE /advice-engine/roa/drafts/:draftId
 * Remove an unlocked RoA draft and best-effort cleanup of linked KV artefacts.
 */
app.delete('/roa/drafts/:draftId', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const draftId = c.req.param('draftId');
  const existingDraft = await roaService.getDraft(draftId);
  if (!canAccessRoADraft(role, c.get('userId'), existingDraft)) {
    return forbiddenRoADraftResponse(c);
  }

  await roaService.deleteDraft(draftId, c.get('user'));
  return c.body(null, 204);
}));

/**
 * POST /advice-engine/roa/drafts/:draftId/clone-from-final
 * Create a new editable draft from a finalised (locked) RoA, preserving module data and evidence references.
 */
app.post('/roa/drafts/:draftId/clone-from-final', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const draftId = c.req.param('draftId');
  const existingDraft = await roaService.getDraft(draftId);
  if (!canAccessRoADraft(role, c.get('userId'), existingDraft)) {
    return forbiddenRoADraftResponse(c);
  }

  const draft = await roaService.cloneDraftFromFinal(draftId, c.get('user'));
  return c.json({ draft });
}));

/**
 * POST /advice-engine/roa/drafts/:draftId/submit
 * Mark a draft as submitted/final-review-ready.
 */
app.post('/roa/drafts/:draftId/submit', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const draftId = c.req.param('draftId');
  const existingDraft = await roaService.getDraft(draftId);
  if (!canAccessRoADraft(role, c.get('userId'), existingDraft)) {
    return forbiddenRoADraftResponse(c);
  }

  const draft = await roaService.submitDraft(draftId, c.get('user'));
  return c.json({ draft });
}));

/**
 * POST /advice-engine/roa/drafts/:draftId/validate
 * Run the generic contract-driven RoA validator.
 */
app.post('/roa/drafts/:draftId/validate', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const draftId = c.req.param('draftId');
  const existingDraft = await roaService.getDraft(draftId);
  if (!canAccessRoADraft(role, c.get('userId'), existingDraft)) {
    return forbiddenRoADraftResponse(c);
  }

  const contracts = await roaContractService.listContracts({ status: 'active' });
  const draft = await roaService.validateDraft(draftId, contracts, c.get('user'));
  return c.json({ draft, validation: draft.validationResults });
}));

/**
 * POST /advice-engine/roa/drafts/:draftId/evidence
 * Store an adviser-uploaded evidence artefact against a module contract requirement.
 */
app.post('/roa/drafts/:draftId/evidence', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const body = await c.req.json();
  const draftId = c.req.param('draftId');
  const existingDraft = await roaService.getDraft(draftId);
  if (!canAccessRoADraft(role, c.get('userId'), existingDraft)) {
    return forbiddenRoADraftResponse(c);
  }

  const contracts = await roaContractService.listContracts({ status: 'active' });
  const draft = await roaService.uploadEvidence(draftId, body, contracts, c.get('user'));
  const evidence = draft.moduleEvidence?.[body.moduleId]?.[body.requirementId];
  return c.json({ draft, evidence });
}));

/**
 * POST /advice-engine/roa/drafts/:draftId/compile
 * Compile the RoA from saved draft data and editable module contracts.
 */
app.post('/roa/drafts/:draftId/compile', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const draftId = c.req.param('draftId');
  const existingDraft = await roaService.getDraft(draftId);
  if (!canAccessRoADraft(role, c.get('userId'), existingDraft)) {
    return forbiddenRoADraftResponse(c);
  }

  const contracts = await roaContractService.listContracts({ status: 'active' });
  const draft = await roaService.compileDraft(draftId, contracts, c.get('user'));
  return c.json({ draft, compilation: draft.compiledOutput, validation: draft.validationResults });
}));

/**
 * POST /advice-engine/roa/drafts/:draftId/generate
 * Generate document artefacts from the same canonical compiled RoA.
 */
app.post('/roa/drafts/:draftId/generate', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const requestedFormats = Array.isArray(body.formats) ? body.formats : [body.format || 'pdf'];
  const formats = requestedFormats
    .filter((format: unknown): format is 'pdf' | 'docx' => format === 'pdf' || format === 'docx');
  const draftId = c.req.param('draftId');
  const before = await roaService.getDraft(draftId);
  if (!canAccessRoADraft(role, c.get('userId'), before)) {
    return forbiddenRoADraftResponse(c);
  }

  const existingDocumentIds = new Set((before.generatedDocuments || []).map((document) => document.id));
  const contracts = await roaContractService.listContracts({ status: 'active' });
  const draft = await roaService.generateDocuments(
    draftId,
    formats.length > 0 ? formats : ['pdf'],
    contracts,
    c.get('user'),
  );
  const documents = (draft.generatedDocuments || []).filter((document) => !existingDocumentIds.has(document.id));
  return c.json({ draft, documents, compilation: draft.compiledOutput });
}));

/**
 * POST /advice-engine/roa/drafts/:draftId/finalise
 * Finalise and lock a compiled RoA record.
 */
app.post('/roa/drafts/:draftId/finalise', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const draftId = c.req.param('draftId');
  const before = await roaService.getDraft(draftId);
  if (!canAccessRoADraft(role, c.get('userId'), before)) {
    return forbiddenRoADraftResponse(c);
  }

  const existingDocumentIds = new Set((before.generatedDocuments || []).map((document) => document.id));
  const contracts = await roaContractService.listContracts({ status: 'active' });
  const draft = await roaService.finaliseDraft(draftId, contracts, c.get('user'));
  const documents = (draft.generatedDocuments || []).filter((document) => !existingDocumentIds.has(document.id));
  return c.json({ draft, documents, compilation: draft.compiledOutput });
}));

/**
 * GET /advice-engine/roa/documents/:documentId/download
 * Return a stored generated RoA artefact without regenerating a locked record.
 */
app.get('/roa/documents/:documentId/download', requireAuth, asyncHandler(async (c) => {
  const role = c.get('userRole');
  if (!canUseRoA(role)) {
    return c.json({ error: 'Forbidden: Advice access required', code: 'FORBIDDEN_ADVICE' }, 403);
  }

  const document = await roaService.getGeneratedDocument(c.req.param('documentId'));
  const draft = await roaService.getDraft(document.draftId);
  if (!canAccessRoADraft(role, c.get('userId'), draft)) {
    return forbiddenRoADraftResponse(c);
  }

  return c.json({ document });
}));

export default app;
