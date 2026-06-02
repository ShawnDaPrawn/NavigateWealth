import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { AdviceEngineService } from './advice-engine-service.ts';
import { AIChatRequestSchema, AIAnalysisRequestSchema } from './advice-engine-validation.ts';

const app = new Hono();
const log = createModuleLogger('advice-engine');
const service = new AdviceEngineService();

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
