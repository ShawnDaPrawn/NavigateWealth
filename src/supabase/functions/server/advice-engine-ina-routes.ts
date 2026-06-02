import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { AdviceEngineService } from './advice-engine-service.ts';
import {
  CreateInvestmentINASchema,
  UpdateInvestmentINASchema,
  FNAIdParamSchema,
  ClientIdParamSchema,
} from './advice-engine-validation.ts';

const app = new Hono();
const log = createModuleLogger('advice-engine');
const service = new AdviceEngineService();

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
    const userId = c.get('userId');
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

export default app;
