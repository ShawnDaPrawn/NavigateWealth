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

export default app;
