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
const log = createModuleLogger('advice-engine-fna');
const service = new AdviceEngineService();

// ============================================================================
// RISK PLANNING FNA
// ============================================================================

app.post(
  '/fna/create',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const validated = CreateRiskFNASchema.parse(body);
    log.info('Creating Risk FNA', { userId, clientId: validated.clientId });
    const fna = await service.createFNA('risk', userId, validated);
    log.success('Risk FNA created', { userId, fnaId: fna.id });
    return c.json({ fna });
  }),
);

app.put(
  '/fna/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
    const body = await c.req.json();
    const updates = UpdateRiskFNASchema.parse(body);
    log.info('Updating Risk FNA', { userId, fnaId });
    const fna = await service.updateFNA('risk', fnaId, updates);
    return c.json({ fna });
  }),
);

app.get(
  '/fna/client/:clientId',
  requireAuth,
  asyncHandler(async (c) => {
    const { clientId } = ClientIdParamSchema.parse(c.req.param());
    const fnas = await service.getClientFNAs('risk', clientId);
    return c.json({ fnas });
  }),
);

app.get(
  '/fna/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
    const fna = await service.getFNAById('risk', fnaId);
    return c.json({ fna });
  }),
);

app.post(
  '/fna/:id/publish',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId');
    const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
    log.info('Publishing Risk FNA', { adminUserId, fnaId });
    const fna = await service.publishFNA('risk', fnaId, adminUserId);
    log.success('Risk FNA published', { fnaId });
    return c.json({ fna });
  }),
);

// ============================================================================
// MEDICAL AID FNA
// ============================================================================

app.post(
  '/medical-fna/create',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const validated = CreateMedicalFNASchema.parse(body);
    log.info('Creating Medical FNA', { userId, clientId: validated.clientId });
    const fna = await service.createFNA('medical', userId, validated);
    log.success('Medical FNA created', { userId, fnaId: fna.id });
    return c.json({ fna });
  }),
);

app.put(
  '/medical-fna/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const _userId = c.get('userId');
    const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
    const body = await c.req.json();
    const updates = UpdateMedicalFNASchema.parse(body);
    const fna = await service.updateFNA('medical', fnaId, updates);
    return c.json({ fna });
  }),
);

app.get(
  '/medical-fna/client/:clientId',
  requireAuth,
  asyncHandler(async (c) => {
    const { clientId } = ClientIdParamSchema.parse(c.req.param());
    const fnas = await service.getClientFNAs('medical', clientId);
    return c.json({ fnas });
  }),
);

app.post(
  '/medical-fna/:id/publish',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId');
    const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
    const fna = await service.publishFNA('medical', fnaId, adminUserId);
    return c.json({ fna });
  }),
);

// ============================================================================
// RETIREMENT FNA
// ============================================================================

app.post(
  '/retirement-fna/create',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const validated = CreateRetirementFNASchema.parse(body);
    log.info('Creating Retirement FNA', { userId, clientId: validated.clientId });
    const fna = await service.createFNA('retirement', userId, validated);
    log.success('Retirement FNA created', { userId, fnaId: fna.id });
    return c.json({ fna });
  }),
);

app.put(
  '/retirement-fna/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const _userId = c.get('userId');
    const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
    const body = await c.req.json();
    const updates = UpdateRetirementFNASchema.parse(body);
    const fna = await service.updateFNA('retirement', fnaId, updates);
    return c.json({ fna });
  }),
);

app.get(
  '/retirement-fna/client/:clientId',
  requireAuth,
  asyncHandler(async (c) => {
    const { clientId } = ClientIdParamSchema.parse(c.req.param());
    const fnas = await service.getClientFNAs('retirement', clientId);
    return c.json({ fnas });
  }),
);

app.post(
  '/retirement-fna/:id/publish',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId');
    const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
    const fna = await service.publishFNA('retirement', fnaId, adminUserId);
    return c.json({ fna });
  }),
);

// ============================================================================
// INVESTMENT NEEDS ANALYSIS (INA)
// ============================================================================

app.post(
  '/investment-ina/create',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const validated = CreateInvestmentINASchema.parse(body);
    log.info('Creating Investment INA', { userId, clientId: validated.clientId });
    const ina = await service.createFNA('investment', userId, validated);
    log.success('Investment INA created', { userId, inaId: ina.id });
    return c.json({ ina });
  }),
);

app.put(
  '/investment-ina/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const _userId = c.get('userId');
    const { id: inaId } = FNAIdParamSchema.parse(c.req.param());
    const body = await c.req.json();
    const updates = UpdateInvestmentINASchema.parse(body);
    const ina = await service.updateFNA('investment', inaId, updates);
    return c.json({ ina });
  }),
);

app.get(
  '/investment-ina/client/:clientId',
  requireAuth,
  asyncHandler(async (c) => {
    const { clientId } = ClientIdParamSchema.parse(c.req.param());
    const inas = await service.getClientFNAs('investment', clientId);
    return c.json({ inas });
  }),
);

app.post(
  '/investment-ina/:id/publish',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId');
    const { id: inaId } = FNAIdParamSchema.parse(c.req.param());
    const ina = await service.publishFNA('investment', inaId, adminUserId);
    return c.json({ ina });
  }),
);

// ============================================================================
// TAX PLANNING FNA
// ============================================================================

app.post(
  '/tax-planning-fna/create',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const validated = CreateTaxFNASchema.parse(body);
    log.info('Creating Tax Planning FNA', { userId, clientId: validated.clientId });
    const fna = await service.createFNA('tax', userId, validated);
    log.success('Tax Planning FNA created', { userId, fnaId: fna.id });
    return c.json({ fna });
  }),
);

app.put(
  '/tax-planning-fna/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const _userId = c.get('userId');
    const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
    const body = await c.req.json();
    const updates = UpdateTaxFNASchema.parse(body);
    const fna = await service.updateFNA('tax', fnaId, updates);
    return c.json({ fna });
  }),
);

app.get(
  '/tax-planning-fna/client/:clientId',
  requireAuth,
  asyncHandler(async (c) => {
    const { clientId } = ClientIdParamSchema.parse(c.req.param());
    const fnas = await service.getClientFNAs('tax', clientId);
    return c.json({ fnas });
  }),
);

app.post(
  '/tax-planning-fna/:id/publish',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId');
    const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
    const fna = await service.publishFNA('tax', fnaId, adminUserId);
    return c.json({ fna });
  }),
);

// ============================================================================
// ESTATE PLANNING FNA
// ============================================================================

app.post(
  '/estate-planning-fna/create',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const validated = CreateEstateFNASchema.parse(body);
    log.info('Creating Estate Planning FNA', { userId, clientId: validated.clientId });
    const fna = await service.createFNA('estate', userId, validated);
    log.success('Estate Planning FNA created', { userId, fnaId: fna.id });
    return c.json({ fna });
  }),
);

app.put(
  '/estate-planning-fna/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const _userId = c.get('userId');
    const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
    const body = await c.req.json();
    const updates = UpdateEstateFNASchema.parse(body);
    const fna = await service.updateFNA('estate', fnaId, updates);
    return c.json({ fna });
  }),
);

app.get(
  '/estate-planning-fna/client/:clientId',
  requireAuth,
  asyncHandler(async (c) => {
    const { clientId } = ClientIdParamSchema.parse(c.req.param());
    const fnas = await service.getClientFNAs('estate', clientId);
    return c.json({ fnas });
  }),
);

app.post(
  '/estate-planning-fna/:id/publish',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId');
    const { id: fnaId } = FNAIdParamSchema.parse(c.req.param());
    const fna = await service.publishFNA('estate', fnaId, adminUserId);
    return c.json({ fna });
  }),
);

// ============================================================================
// AI ADVISOR & INTELLIGENCE
// ============================================================================

app.post(
  '/ai/chat',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const { message, context } = AIChatRequestSchema.parse(body);
    log.info('AI Advisor chat', { userId });
    const response = await service.aiChat(userId, message, context);
    return c.json(response);
  }),
);

app.post(
  '/ai/analyze',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId');
    const body = await c.req.json();
    const { clientId, analysisType, data } = AIAnalysisRequestSchema.parse(body);
    log.info('AI Intelligence analysis', { adminUserId, clientId, analysisType });
    const analysis = await service.aiAnalyze(clientId, analysisType, data);
    return c.json(analysis);
  }),
);

export default app;
